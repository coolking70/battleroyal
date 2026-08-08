import { GAME_CONFIG } from '../data/gameConfig';
import { getItem } from '../data/items';
import { getZoneDef } from '../data/zones';
import { canPayActionCost, payActionCost } from './actionCosts';
import { pushEvent } from './events';
import { addNoise } from './info';
import { addItem, canAccept, createStack } from './inventory';
import { charactersInZone } from './gameState';
import { hasScoutAwareness } from './statusIds';
import { isZoneExhausted, takeLootItem } from './zoneLoot';
import { worldModifiersAt } from './worldEvents';
import type { SeededRandom } from './random';
import type { Combatant, GameState, ItemStack, LootRarity } from './types';

export type SearchOutcome =
  | {
      kind: 'item';
      stack: ItemStack;
      itemName: string;
      rarity: LootRarity;
      /** 是否已经进入背包 */
      pickedUp: boolean;
      /** 背包已满，等待玩家决策 */
      pending: boolean;
    }
  | { kind: 'enemy'; enemyId: string; reconInitiative?: boolean }
  | { kind: 'nothing' };

export interface SearchCheck {
  ok: boolean;
  reason: string | null;
}

/** 搜索前置条件校验（体力、存活、对局状态） */
export function canSearch(state: GameState, actor: Combatant): SearchCheck {
  if (state.status !== 'playing') return { ok: false, reason: '对局已经结束。' };
  const check = canPayActionCost(actor, 'SEARCH');
  if (!check.ok) return { ok: false, reason: check.reason };
  return { ok: true, reason: null };
}

/**
 * 计算三种搜索结果的权重。
 *
 * 第二阶段起，`zone.supply` 是**真实剩余物资比例**（remaining / initial），
 * 不再是一个永不归零的衰减系数。区域被搜空后 `supply === 0`，
 * "发现物品"权重直接归零，只剩"一无所获"与"遭遇敌人"。
 *
 * 影响因素：
 * - 角色感知：提高发现物品概率、降低空手概率
 * - 区域剩余物资比例：直接乘在「发现物品」权重上
 * - 区域已搜索次数：额外提高「空手」权重
 * - 角色被动：锐目降低空手、临床在医院加成
 * - 区域类型：同区域有其他角色时才可能触发遭遇
 */
export function computeSearchWeights(
  state: GameState,
  actor: Combatant,
): { find: number; enemy: number; nothing: number } {
  const zone = state.zones[actor.currentZoneId];
  if (!zone) return { find: 1, enemy: 0, nothing: 0 };

  const perceptionFactor = 1 + actor.perception * 0.03;

  // 搜空的区域彻底不会再产出物品
  let find = isZoneExhausted(zone)
    ? 0
    : GAME_CONFIG.searchBaseFindWeight * zone.supply * perceptionFactor;

  // 医学生在医院的额外加成
  if (actor.passiveId === 'field_medic' && zone.id === 'hospital') {
    find *= 1 + GAME_CONFIG.medicHospitalFindBonus;
  }

  const others = charactersInZone(state, actor.currentZoneId).filter(
    (c) => c.id !== actor.id,
  );
  let enemy =
    others.length === 0
      ? 0
      : GAME_CONFIG.searchBaseEnemyWeight * (1 + (others.length - 1) * 0.6);

  // 锐目（侦察员）：更容易先发现同区域的敌人（Phase 2A-1）
  if (actor.passiveId === 'keen_eye' && enemy > 0) {
    enemy *= GAME_CONFIG.keenEyeEncounterBonus;
  }

  // 区域被翻得越多，越容易一无所获
  let nothing =
    GAME_CONFIG.searchBaseNothingWeight +
    (1 - zone.supply) * 45 +
    zone.searchCount * 1.5;
  nothing = Math.max(4, nothing - actor.perception * 1.2);

  if (actor.passiveId === 'keen_eye') {
    nothing *= GAME_CONFIG.keenEyeNothingMultiplier;
  }
  if (isZoneExhausted(zone)) {
    nothing += GAME_CONFIG.emptyZoneNothingBonus;
  }

  // 世界事件修正（Phase 3A-1）：
  // 停电：搜索遭遇敌人权重 ×0.8、空手权重 ×1.1（搜索与发现变得不可靠，
  // 不影响战斗命中）。这里改的是**概率权重**而非区域库存。
  const mods = worldModifiersAt(state, zone.id);
  if (enemy > 0) enemy *= mods.searchEnemyMult;
  nothing *= mods.searchNothingMult;

  // 警觉侦察（NPC 侧）：提升对活动区域的搜索权重，不获得任何角色位置
  if (hasScoutAwareness(actor) && !actor.isPlayer && enemy > 0) {
    enemy *= GAME_CONFIG.scoutAwarenessNpcSearchBoost;
  }

  return { find, enemy, nothing };
}

/**
 * 从区域**有限库存**中取走一件物品。
 * 库存为空时返回 null，调用方必须退化为"一无所获"。
 */
export function rollItemId(
  state: GameState,
  actor: Combatant,
  rng: SeededRandom,
): { itemId: string; rarity: LootRarity } | null {
  const zone = state.zones[actor.currentZoneId];
  if (!zone) return null;

  const preferRare = rng.chance(GAME_CONFIG.rareChance);
  // 物品类别偏好只来自角色被动，世界事件不参与（Phase 3A-1：研究异常不再加材料搜索率）
  const materialBias = actor.passiveId === 'tinkerer' ? GAME_CONFIG.tinkererMaterialBias : 1;

  return takeLootItem(zone, rng, preferRare, materialBias, 1);
}

/**
 * 执行一次搜索（玩家与 NPC 共用）。
 * 调用方负责推进时间与写入 SEARCH_STARTED 之外的后续事件。
 */
export function performSearch(
  state: GameState,
  actor: Combatant,
  rng: SeededRandom,
): SearchOutcome {
  const zone = state.zones[actor.currentZoneId];
  if (!zone) return { kind: 'nothing' };

  payActionCost(actor, 'SEARCH');
  zone.searchCount += 1;
  actor.stats.searches += 1;
  state.stats.searches += 1;
  addNoise(state, zone.id, 'search');

  const w = computeSearchWeights(state, actor);
  const kind = rng.pickWeighted<'item' | 'enemy' | 'nothing'>([
    { value: 'item', weight: w.find },
    { value: 'enemy', weight: w.enemy },
    { value: 'nothing', weight: w.nothing },
  ]);
  // Phase 3A-1 统计：记录本次搜索时世界事件是否生效（停电影响搜索权重）
  const modsForStats = worldModifiersAt(state, zone.id);
  pushEvent(state, {
    type: 'SEARCH_STARTED',
    actorId: actor.id,
    zoneId: zone.id,
    message: `${actor.name} 在${getZoneDef(zone.id).name}搜索。`,
    metadata: {
      searchCount: zone.searchCount,
      blackoutActive: modsForStats.searchEnemyMult < 1,
      enemyWeight: w.enemy,
      nothingWeight: w.nothing,
      // Phase 3A-1：骚动期间搜索噪音放大统计
      unrestActive: modsForStats.searchNoiseMultiplier > 1,
      searchNoiseBonus:
        modsForStats.searchNoiseMultiplier > 1
          ? Math.ceil(GAME_CONFIG.noiseFromSearch * modsForStats.searchNoiseMultiplier) -
            GAME_CONFIG.noiseFromSearch
          : 0,
    },
  });

  if (kind === 'enemy') {
    const others = charactersInZone(state, actor.currentZoneId).filter(
      (c) => c.id !== actor.id,
    );
    const enemy = rng.pick(others);
    if (enemy) {
      // Phase 3A-1：侦察员警觉状态下由 SEARCH 建立新遭遇 → 该次遭遇获得先手
      const reconInitiative = actor.isPlayer && hasScoutAwareness(actor);
      if (!actor.knownEnemies.includes(enemy.id)) actor.knownEnemies.push(enemy.id);
      if (!enemy.knownEnemies.includes(actor.id)) enemy.knownEnemies.push(actor.id);
      pushEvent(state, {
        type: 'ENCOUNTER_STARTED',
        actorId: actor.id,
        targetId: enemy.id,
        zoneId: zone.id,
        message: `${actor.name} 在搜索中撞见了 ${enemy.name}。`,
        metadata: { reconInitiative },
      });
      return { kind: 'enemy', enemyId: enemy.id, reconInitiative };
    }
    // 没有可遭遇对象则退化为空手
    return emptyHanded(state, actor, zone.id);
  }

  if (kind === 'item') {
    const taken = rollItemId(state, actor, rng);
    if (!taken) return emptyHanded(state, actor, zone.id);

    const stack = createStack(state, taken.itemId, 1);
    const itemName = getItem(taken.itemId).name;
    pushEvent(state, {
      type: 'ITEM_FOUND',
      actorId: actor.id,
      zoneId: zone.id,
      importance: taken.rarity === 'rare' ? 'major' : 'minor',
      message: `${actor.name} 找到了 ${itemName}${taken.rarity === 'rare' ? '（稀有）' : ''}。`,
      metadata: { itemId: taken.itemId, rarity: taken.rarity },
    });

    // 刚好把这个区域搜空
    if (isZoneExhausted(zone) && zone.searchedEmptyCount === 0) {
      state.stats.zonesExhausted += 1;
      pushEvent(state, {
        type: 'ZONE_EXHAUSTED',
        zoneId: zone.id,
        message: `${getZoneDef(zone.id).name}的物资已经被搜刮一空。`,
        metadata: { zoneId: zone.id, searchCount: zone.searchCount },
      });
    }

    if (canAccept(actor, stack)) {
      addItem(actor, stack);
      pushEvent(state, {
        type: 'ITEM_PICKED',
        actorId: actor.id,
        zoneId: zone.id,
        message: `${actor.name} 收起了 ${itemName}。`,
        metadata: { itemId: taken.itemId },
      });
      return {
        kind: 'item',
        stack,
        itemName,
        rarity: taken.rarity,
        pickedUp: true,
        pending: false,
      };
    }

    return {
      kind: 'item',
      stack,
      itemName,
      rarity: taken.rarity,
      pickedUp: false,
      pending: true,
    };
  }

  return emptyHanded(state, actor, zone.id);
}

function emptyHanded(
  state: GameState,
  actor: Combatant,
  zoneId: string,
): SearchOutcome {
  const zone = state.zones[zoneId];
  const exhausted = zone ? isZoneExhausted(zone) : false;
  if (zone && exhausted) zone.searchedEmptyCount += 1;

  pushEvent(state, {
    type: 'SEARCH_STARTED',
    actorId: actor.id,
    zoneId,
    message: exhausted
      ? `${actor.name} 翻遍了${getZoneDef(zoneId).name}，这里已经什么都不剩了。`
      : `${actor.name} 一无所获。`,
    metadata: { empty: true, exhausted },
  });
  return { kind: 'nothing' };
}
