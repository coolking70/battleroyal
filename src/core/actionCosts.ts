/**
 * 统一的行动体力成本层。
 *
 * 第一阶段的体力检查散落在 `commandHandlers` / `search` / `combat` / `crafting`
 * 四处，各写一套，导致「零体力仍可行动」这类边界不一致。
 * 第二阶段起，**所有**消耗体力的行为都必须经过本文件：
 *
 *     const check = canPayActionCost(actor, 'MOVE');
 *     if (!check.ok) return { ok: false, message: check.reason };
 *     payActionCost(actor, 'MOVE');
 *
 * 这样只要新增动作时在 `ACTION_COST_TABLE` 里登记一行，闸门就自动生效。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { worldModifiersAt } from './worldEvents';
import { adrenalineStaminaDelta, hasFieldCraftCharge } from './statusIds';
import type { AttackStyle, Combatant, GameState } from './types';

/** 所有会消耗体力的行动 */
export type CostedAction = 'MOVE' | 'SEARCH' | 'ATTACK' | 'CRAFT' | 'FLEE' | 'GUARD';

export const ACTION_LABEL: Record<CostedAction, string> = {
  MOVE: '移动',
  SEARCH: '搜索',
  ATTACK: '攻击',
  CRAFT: '合成',
  FLEE: '脱离',
  GUARD: '防御',
};

/**
 * 取某个角色执行某动作的体力成本。
 * 被动带来的折扣（如工程师合成只要 1 点）也在这里统一处理，
 * 避免出现"某处算了折扣、另一处没算"的分叉。
 */
export function getActionStaminaCost(actor: Combatant, action: CostedAction): number {
  switch (action) {
    case 'MOVE':
      return GAME_CONFIG.moveStaminaCost;
    case 'SEARCH':
      return GAME_CONFIG.searchStaminaCost;
    case 'ATTACK':
      return GAME_CONFIG.attackStaminaCost;
    case 'FLEE':
      // Phase 2A：脱离是免费行动（成本 0），保证遭遇战中永远存在
      // 一个可执行、且能推进时间的出口，从根上消灭零体力死锁。
      return GAME_CONFIG.fleeStaminaCost;
    case 'CRAFT': {
      // Phase 3A：工程师「野外工造」期间合成完全免体力。
      // 折扣写在这里而不是 crafting.ts —— 闸门、扣费、UI 预估三处读的是同一个数，
      // 才不会出现「界面说要 1 点、实际扣了 2 点」这种分叉。
      if (hasFieldCraftCharge(actor)) return 0;
      return actor.passiveId === 'tinkerer'
        ? GAME_CONFIG.craftStaminaCostEngineer
        : GAME_CONFIG.craftStaminaCost;
    }
    case 'GUARD':
      // 资源耗尽时保留一个有意义的防守选择：仅在恰好 0 体力时免费。
      // 体力仍有 1 点但不足以支付完整防御成本时，防御继续被拒绝，
      // 避免把免费防御扩成可在任意低体力值下刷出的通用动作。
      return actor.stamina === 0 ? 0 : GAME_CONFIG.guardStaminaCost;
    default:
      return 0;
  }
}

/** 取某个攻击风格的**基础**体力成本（不含角色状态修正，供配置表与文档引用） */
export function getAttackStyleStaminaCost(style: AttackStyle): number {
  return GAME_CONFIG.attackStyleStaminaCost[style];
}

/**
 * 取某个角色打出某种风格所需的**实际**体力（Phase 3A）。
 *
 * 肾上腺素在这里生效。UI 的攻击按钮、legalActions 的可行性判断、
 * combat 的实际扣费三处都必须调这一个函数，否则又会出现
 * BUG-01 那种「界面一个数、核心另一个数」的分叉。
 * 成本有下限 1：技能可以让攻击变便宜，但不能变成完全免费。
 */
export function attackStaminaCostFor(actor: Combatant, style: AttackStyle): number {
  const base = GAME_CONFIG.attackStyleStaminaCost[style];
  return Math.max(1, base + adrenalineStaminaDelta(actor));
}

/**
 * 移动体力成本（Phase 3A-1 RULE-WE-07）。
 *
 * 「连绵阴雨」给移动 +1 体力，玩家与 NPC **共用**这一个入口，
 * 禁止在 player MOVE / NPC MOVE 两处分别硬编码。
 * 调用方：移动闸门（guard）、扣费（moveActor）、合法集可行性、UI 预估。
 */
export function moveStaminaCostFor(state: GameState, actor: Combatant): number {
  return (
    GAME_CONFIG.moveStaminaCost +
    worldModifiersAt(state, actor.currentZoneId).moveCostBonus
  );
}

/** 移动闸门（带世界事件修正）：对局进行中 + 存活 + 付得起移动体力 */
export function canPayMove(state: GameState, actor: Combatant): CostCheck {
  const cost = moveStaminaCostFor(state, actor);
  if (!actor.alive) {
    return { ok: false, reason: '已经死亡的角色无法行动。', cost };
  }
  if (cost <= 0) {
    return { ok: true, reason: null, cost };
  }
  if (actor.stamina < cost) {
    return {
      ok: false,
      reason: `体力不足：移动需要 ${cost} 点，当前只有 ${Math.floor(actor.stamina)} 点。请先休息或使用恢复品。`,
      cost,
    };
  }
  return { ok: true, reason: null, cost };
}

/** 扣除移动体力（带世界事件修正），返回实际扣除点数 */
export function payMoveCost(state: GameState, actor: Combatant): number {
  const cost = moveStaminaCostFor(state, actor);
  if (cost <= 0) return 0;
  const before = actor.stamina;
  actor.stamina = clampStamina(actor, actor.stamina - cost);
  return before - actor.stamina;
}

export interface CostCheck {
  ok: boolean;
  reason: string | null;
  cost: number;
}

/**
 * 判断角色能否支付某个动作的体力。
 *
 * 规则：
 * - 死亡角色一律不能行动；
 * - 体力必须 **大于等于** 成本，`stamina === 0` 且成本 > 0 时必然失败；
 * - 成本为 0 的动作永远放行（FLEE，以及恰好 0 体力时的 GUARD）。
 *
 * 注意：免费 ≠ 无代价。免费动作依然会推进时间，
 * 时间本身就是最稀缺的资源（禁区收缩、终局衰竭都按时间结算）。
 */
export function canPayActionCost(actor: Combatant, action: CostedAction): CostCheck {
  const cost = getActionStaminaCost(actor, action);
  if (!actor.alive) {
    return { ok: false, reason: '已经死亡的角色无法行动。', cost };
  }
  if (cost <= 0) {
    return { ok: true, reason: null, cost };
  }
  if (actor.stamina < cost) {
    return {
      ok: false,
      reason: `体力不足：${ACTION_LABEL[action]}需要 ${cost} 点，当前只有 ${Math.floor(actor.stamina)} 点。请先休息或使用恢复品。`,
      cost,
    };
  }
  return { ok: true, reason: null, cost };
}

/**
 * 扣除体力。**调用前必须先通过 `canPayActionCost`。**
 * 为了防御性编程，这里仍会把体力夹在 `[0, maxStamina]`。
 * 返回实际扣除的点数。
 */
export function payActionCost(actor: Combatant, action: CostedAction): number {
  const cost = getActionStaminaCost(actor, action);
  if (cost <= 0) return 0;
  const before = actor.stamina;
  actor.stamina = clampStamina(actor, actor.stamina - cost);
  return before - actor.stamina;
}

/** 恢复体力（休息、消耗品），统一夹取上下限 */
export function gainStamina(actor: Combatant, amount: number): number {
  if (amount <= 0) return 0;
  const before = actor.stamina;
  actor.stamina = clampStamina(actor, actor.stamina + amount);
  return actor.stamina - before;
}

export function clampStamina(actor: Combatant, value: number): number {
  return Math.max(0, Math.min(actor.maxStamina, value));
}

/** 便捷组合：检查 + 扣费，失败时不产生任何副作用 */
export function tryPayActionCost(actor: Combatant, action: CostedAction): CostCheck {
  const check = canPayActionCost(actor, action);
  if (!check.ok) return check;
  payActionCost(actor, action);
  return check;
}

/**
 * 按任意体力数值做闸门检查（战斗风格的成本各不相同，无法用 `CostedAction` 枚举穷举）。
 * 返回结果与 `canPayActionCost` 同构，便于在结算里统一处理。
 */
export function canPayStamina(actor: Combatant, amount: number): CostCheck {
  if (!actor.alive) {
    return { ok: false, reason: '已经死亡的角色无法行动。', cost: amount };
  }
  if (amount <= 0) return { ok: true, reason: null, cost: amount };
  if (actor.stamina < amount) {
    return {
      ok: false,
      reason: `体力不足：需要 ${amount} 点，当前只有 ${Math.floor(actor.stamina)} 点。`,
      cost: amount,
    };
  }
  return { ok: true, reason: null, cost: amount };
}

/** 直接扣除指定体力（防御姿态 / 战斗风格攻击共用），返回实际扣除点数 */
export function spendStamina(actor: Combatant, amount: number): number {
  if (amount <= 0) return 0;
  const before = actor.stamina;
  actor.stamina = clampStamina(actor, actor.stamina - amount);
  return before - actor.stamina;
}
