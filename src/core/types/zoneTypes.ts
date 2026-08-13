import type { ItemStack } from './itemTypes';

/* ------------------------------------------------------------------ */
/* 区域                                                                */
/* ------------------------------------------------------------------ */

export interface ZoneDef {
  id: string;
  name: string;
  description: string;
  /** 相邻区域 id，双向 */
  adjacent: string[];
  /** 基础物品池 */
  basePool: string[];
  /** 稀有物品池 */
  rarePool: string[];
  /** Optional objective source, generated separately from legacy loot RNG. */
  objectivePool?: string[];
  /** 色块主题色（UI 占位美术用） */
  color: string;
}

export type ZoneStatus = 'safe' | 'warning' | 'restricted';
/** 物资稀有度 */
export type LootRarity = 'normal' | 'rare';

/** 区域物资库存中的一条。第二阶段起，区域物资是开局一次性生成的有限清单。 */
export interface ZoneLootEntry {
  itemId: string;
  /** 剩余件数，扣到 0 后该条目被移除 */
  count: number;
  rarity: LootRarity;
}

/** 区域噪音等级（玩家可见的模糊信息） */
export type NoiseLevel = 'quiet' | 'active' | 'loud';
/** 玩家可见的区域物资状态（模糊分档，精确数字仅调试面板可见） */
export type SupplyStatus = 'rich' | 'normal' | 'scarce' | 'empty';

export interface ZoneState {
  id: string;
  status: ZoneStatus;
  /** 该区域被搜索过的次数 */
  searchCount: number;
  /** 剩余物资比例 = remainingLootCount / initialLootCount，取值 [0, 1]。 */
  supply: number;
  /** 有限物资库存 */
  loot: ZoneLootEntry[];
  /** Finite route-specific source kept outside legacy supply accounting. */
  objectiveLoot: ZoneLootEntry[];
  /** 开局生成的物资总件数（普通 + 稀有） */
  initialLootCount: number;
  /** 当前剩余物资总件数 */
  remainingLootCount: number;
  /** 库存已空之后又被搜索了多少次（用于提示"这里已经被翻烂了"） */
  searchedEmptyCount: number;
  /** 进入预警的时间单位 */
  warningAtTime: number | null;
  /** 正式成为禁区的时间单位 */
  restrictedAtTime: number | null;
  /** 地面上的掉落物（尸体 / 丢弃） */
  groundItems: ItemStack[];
  /** 当前该区域存活角色 id（每个时间单位刷新） */
  aliveCharacterIds: string[];
  /** Phase 4N finite wild population; ids never overlap contestant ids. */
  wildEnemyIds: string[];
  /** 最近一次发生战斗的时间单位，-1 表示从未 */
  lastCombatTime: number;
  /** 最近一次产生噪音的时间单位，-1 表示从未 */
  lastNoiseTime: number;
  /** 噪音累计值，随时间衰减；玩家只能看到它的分档结果 */
  noiseLevel: number;
}
