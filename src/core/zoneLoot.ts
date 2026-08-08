/**
 * 有限区域物资系统（第二阶段核心改动）。
 *
 * 第一阶段的做法是「物资系数随搜索衰减，但有 0.15 的下限」——
 * 结果是任何区域都能被无限刷取，只是变慢，策略层面完全失效。
 *
 * 第二阶段改为**开局一次性生成、只减不增**的库存：
 * - 每个区域按种子生成 18~28 件普通物资 + 2~5 件稀有物资；
 * - 每次搜索命中"发现物品"时，从库存里真实扣掉一件；
 * - 扣光即"搜空"，之后该区域只会出现"一无所获"或"遭遇敌人"；
 * - 玩家与 NPC 共享同一份库存，先到先得。
 *
 * 本模块不写事件、不推进时间，只负责库存本身，保持职责单一。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { getZoneDef } from '../data/zones';
import { getItem } from '../data/items';
import type { SeededRandom } from './random';
import type {
  GameState,
  SupplyStatus,
  ZoneLootEntry,
  ZoneState,
} from './types';

/* ------------------------------------------------------------------ */
/* 生成                                                                */
/* ------------------------------------------------------------------ */

/** 把若干抽样结果压缩成 `{itemId, count}` 形式的库存条目 */
function collapse(ids: string[], rarity: ZoneLootEntry['rarity']): ZoneLootEntry[] {
  const map = new Map<string, number>();
  for (const id of ids) map.set(id, (map.get(id) ?? 0) + 1);
  return [...map.entries()].map(([itemId, count]) => ({ itemId, count, rarity }));
}

/**
 * 为一个区域生成完整的物资清单。
 * 抽样顺序完全由传入的 rng 决定，因此同种子必然生成同一份清单。
 */
export function generateZoneLoot(zoneId: string, rng: SeededRandom): ZoneLootEntry[] {
  const def = getZoneDef(zoneId);

  const normalCount = rng.int(
    GAME_CONFIG.zoneLootNormalMin,
    GAME_CONFIG.zoneLootNormalMax,
  );
  const rareCount =
    def.rarePool.length === 0
      ? 0
      : rng.int(GAME_CONFIG.zoneLootRareMin, GAME_CONFIG.zoneLootRareMax);

  const normalIds: string[] = [];
  for (let i = 0; i < normalCount; i++) {
    const picked = rng.pick(def.basePool);
    if (picked) normalIds.push(picked);
  }

  const rareIds: string[] = [];
  for (let i = 0; i < rareCount; i++) {
    const picked = rng.pick(def.rarePool);
    if (picked) rareIds.push(picked);
  }

  return [...collapse(normalIds, 'normal'), ...collapse(rareIds, 'rare')];
}

/** 统计库存总件数 */
export function countLoot(loot: ZoneLootEntry[]): number {
  return loot.reduce((sum, e) => sum + e.count, 0);
}

/** 把生成好的库存写进区域状态并同步派生字段 */
export function initZoneLoot(zone: ZoneState, loot: ZoneLootEntry[]): void {
  zone.loot = loot;
  zone.initialLootCount = countLoot(loot);
  zone.remainingLootCount = zone.initialLootCount;
  zone.searchedEmptyCount = 0;
  syncSupplyRatio(zone);
}

/* ------------------------------------------------------------------ */
/* 扣减                                                                */
/* ------------------------------------------------------------------ */

/** 重新计算 `supply` 派生比例，任何改动库存的地方都必须调用 */
export function syncSupplyRatio(zone: ZoneState): void {
  zone.remainingLootCount = countLoot(zone.loot);
  zone.supply =
    zone.initialLootCount <= 0
      ? 0
      : Math.max(0, Math.min(1, zone.remainingLootCount / zone.initialLootCount));
}

export function isZoneExhausted(zone: ZoneState): boolean {
  return zone.remainingLootCount <= 0;
}

/**
 * 向区域库存补充一件物品（Phase 3 Step 4 空投用）。
 * 若已存在同 itemId 的普通池条目则累加，否则新建一条；
 * 同步派生字段（剩余件数 / 物资比例）。
 */
export function addLootItem(zone: ZoneState, itemId: string, count: number): void {
  if (count <= 0) return;
  const existing = zone.loot.find((e) => e.itemId === itemId && e.rarity === 'normal');
  if (existing) {
    existing.count += count;
  } else {
    zone.loot.push({ itemId, count, rarity: 'normal' });
  }
  syncSupplyRatio(zone);
}

/**
 * 从区域库存中取走一件物品。
 *
 * @param preferRare 是否优先尝试稀有池（由调用方按概率决定）
 * @param materialBias 材料类物品的额外权重（工程师被动 × 研究异常世界事件）
 * @param consumableBias 消耗品类物品的额外权重（医疗管制世界事件）
 * @returns 取到的 itemId；库存为空时返回 null
 *
 * 说明：世界事件只能通过这两个 bias **改变取出的偏好**，
 * 无法增加库存总量 —— 对应红线「世界事件不修改隐藏库存」。
 */
export function takeLootItem(
  zone: ZoneState,
  rng: SeededRandom,
  preferRare: boolean,
  materialBias = 1,
  consumableBias = 1,
): { itemId: string; rarity: ZoneLootEntry['rarity'] } | null {
  if (isZoneExhausted(zone)) return null;

  const rarePool = zone.loot.filter((e) => e.rarity === 'rare' && e.count > 0);
  const normalPool = zone.loot.filter((e) => e.rarity === 'normal' && e.count > 0);

  let pool = preferRare && rarePool.length > 0 ? rarePool : normalPool;
  if (pool.length === 0) pool = rarePool.length > 0 ? rarePool : normalPool;
  if (pool.length === 0) return null;

  const entry = rng.pickWeighted(
    pool.map((e) => {
      let weight = e.count;
      const category = getItem(e.itemId).category;
      if (materialBias !== 1 && category === 'material') {
        weight *= materialBias;
      }
      if (consumableBias !== 1 && category === 'consumable') {
        weight *= consumableBias;
      }
      return { value: e, weight };
    }),
  );
  if (!entry) return null;

  entry.count -= 1;
  if (entry.count <= 0) {
    zone.loot = zone.loot.filter((e) => e !== entry);
  }
  syncSupplyRatio(zone);

  return { itemId: entry.itemId, rarity: entry.rarity };
}

/* ------------------------------------------------------------------ */
/* 展示                                                                */
/* ------------------------------------------------------------------ */

/** 玩家可见的模糊分档（精确件数只给调试面板） */
export function supplyStatusOf(zone: ZoneState): SupplyStatus {
  if (zone.remainingLootCount <= 0) return 'empty';
  const ratio = zone.supply;
  if (ratio > GAME_CONFIG.supplyRichThreshold) return 'rich';
  if (ratio > GAME_CONFIG.supplyNormalThreshold) return 'normal';
  return 'scarce';
}

export const SUPPLY_STATUS_LABEL: Record<SupplyStatus, string> = {
  rich: '物资充足',
  normal: '物资一般',
  scarce: '物资稀少',
  empty: '已被搜空',
};

/** 全场剩余物资比例，用于终局触发判定 */
export function globalLootRatio(state: GameState): number {
  let initial = 0;
  let remaining = 0;
  for (const zone of Object.values(state.zones)) {
    initial += zone.initialLootCount;
    remaining += zone.remainingLootCount;
  }
  if (initial <= 0) return 0;
  return remaining / initial;
}
