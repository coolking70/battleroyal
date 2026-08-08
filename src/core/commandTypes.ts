/**
 * 命令与动态事件相关类型（Phase 3 Step 10 从 types.ts 拆出）。
 *
 * 与 `types.ts` 之间只有**类型层**的相互引用（编译期完全擦除，无运行时循环依赖）。
 * `types.ts` 仍统一再导出这些类型，因此所有既有 `from './types'` 的写法保持不变。
 */

import type { GameState } from './types';

/* ------------------------------------------------------------------ */
/* 命令                                                                */
/* ------------------------------------------------------------------ */

/** 攻击风格（Phase 3 Step 1）：rapid 轻量高命中低伤、normal 基准、heavy 重击高伤低命中且更易招来反击 */
export type AttackStyle = 'quick' | 'normal' | 'heavy';

/* ------------------------------------------------------------------ */
/* 动态事件（Phase 3 Step 4）                                            */
/* ------------------------------------------------------------------ */

/** 动态事件类型：风暴 / 空投 / 伏击 */
export type DynamicEventType = 'storm' | 'supply_drop' | 'ambush';

/**
 * 当前生效中的动态事件（用于 UI 横幅展示与确定性回放）。
 * 瞬时型事件（空投 / 伏击）remaining 为 1，仅作一回合播报；
 * 持续型（风暴）remaining = 持续回合，期间对区域内角色持续生效。
 */
export interface ActiveEvent {
  id: string;
  type: DynamicEventType;
  zoneId: string;
  startedAtTime: number;
  /** 剩余生效回合（<=0 移除） */
  remaining: number;
  label: string;
  description: string;
}

export type Command =
  | { type: 'MOVE'; zoneId: string }
  | { type: 'SEARCH' }
  | { type: 'REST' }
  | { type: 'CRAFT'; recipeId: string }
  | { type: 'USE_ITEM'; uid: string }
  | { type: 'EQUIP'; uid: string }
  | { type: 'UNEQUIP'; slot: 'weapon' | 'armor' }
  | { type: 'DROP_ITEM'; uid: string }
  | { type: 'ATTACK'; targetId: string; style: AttackStyle }
  | { type: 'ATTACK_NEARBY'; style: AttackStyle }
  | { type: 'GUARD' }
  | { type: 'USE_SKILL'; skillId: string }
  | { type: 'FLEE' }
  | { type: 'PICKUP_GROUND'; uid: string }
  | { type: 'RESOLVE_PICKUP'; accept: boolean; dropUid?: string }
  | { type: 'CLOSE_ENCOUNTER' }
  | { type: 'SET_CRAFT_GOAL'; recipeId: string | null }
  | { type: 'DEBUG_ADVANCE_TIME' }
  | { type: 'DEBUG_GIVE_MATERIAL' }
  | { type: 'DEBUG_HEAL_PLAYER' }
  | { type: 'DEBUG_TRIGGER_ZONE' }
  | { type: 'DEBUG_WEAKEN_NPC'; npcId: string };

export interface CommandResult {
  state: GameState;
  ok: boolean;
  /** 失败时给玩家看的可读提示；成功时可作为操作反馈 */
  message: string | null;
}
