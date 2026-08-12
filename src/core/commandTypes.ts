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
/* 世界事件（Phase 3A Step 6，取代 Phase 3 的动态事件）                    */
/* ------------------------------------------------------------------ */

/**
 * 世界事件 id（6 种，全部为「环境修正型」，不直接造成伤害）。
 *
 * Phase 3A 红线（相对 Phase 3 的 storm / supply_drop / ambush）：
 * - **不修改隐藏库存**：不再有 supply_drop 那种直接往 zoneLoot 里塞东西的写法，
 *   要影响产出只能改「搜索权重」，玩家仍须付出搜索行动才拿得到；
 * - **不瞬移角色**：不再有 ambush 那种把 NPC 直接挪到玩家区域的写法；
 * - **不绕过 applyDamage**：6 种事件均不直接扣血，因此结构上不可能绕过伤害管线。
 *
 * - `blackout`            大停电（区域）：命中↓、搜索↓、屏蔽情报
 * - `rain`                连绵阴雨（全局）：命中↓、逃跑↑
 * - `emergency_broadcast` 紧急广播（全局）：公开全部存活者位置
 * - `medical_alert`       医疗管制（全局）：治疗品效果↓、医疗物资更易搜到
 * - `research_anomaly`    研究异常（区域）：材料更易搜到、装备耐久损耗↑
 * - `citywide_unrest`     全城骚动（全局）：NPC 更具攻击性、遭遇率↑
 */
export type WorldEventId =
  | 'blackout'
  | 'rain'
  | 'emergency_broadcast'
  | 'medical_alert'
  | 'research_anomaly'
  | 'citywide_unrest';

/** 世界事件作用范围：`global` 覆盖全图，`zone` 只作用于 `zoneId` 指向的区域 */
export type WorldEventScope = 'global' | 'zone';

/**
 * 当前生效中的世界事件实例（用于 UI 横幅展示与确定性回放）。
 * 全部事件都是持续型：`remaining` 为剩余时间单位，衰减到 0 时移除并广播结束。
 */
export interface WorldEventState {
  /** 实例 id（`we{seq}`），同一种事件多次触发也各自唯一 */
  id: string;
  eventId: WorldEventId;
  scope: WorldEventScope;
  /** `scope === 'zone'` 时为目标区域；全局事件恒为 null */
  zoneId: string | null;
  startedAtTime: number;
  /** 剩余生效时间单位（<=0 移除） */
  remaining: number;
  label: string;
  description: string;
}

/** 已结束事件的归档记录（供模拟统计「6 种事件各 ≥ 50 次」验收） */
export interface WorldEventRecord {
  id: string;
  eventId: WorldEventId;
  zoneId: string | null;
  startedAtTime: number;
  endedAtTime: number;
}

export type Command =
  | { type: 'MOVE'; zoneId: string }
  | { type: 'SEARCH' }
  | { type: 'REST' }
  | { type: 'CRAFT'; recipeId: string }
  | { type: 'USE_ITEM'; uid: string }
  | { type: 'EQUIP'; uid: string }
  | { type: 'UNEQUIP'; slot: 'weapon' | 'armor' | 'utility' }
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
