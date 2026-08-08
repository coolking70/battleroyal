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
import type { AttackStyle, Combatant } from './types';

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
    case 'CRAFT':
      return actor.passiveId === 'tinkerer'
        ? GAME_CONFIG.craftStaminaCostEngineer
        : GAME_CONFIG.craftStaminaCost;
    case 'GUARD':
      // 防御姿态需要付出体力，但比一次 heavy 攻击便宜
      return GAME_CONFIG.guardStaminaCost;
    default:
      return 0;
  }
}

/** 取某个攻击风格的体力成本（Phase 3 Step 1，供 UI 显示） */
export function getAttackStyleStaminaCost(style: AttackStyle): number {
  return GAME_CONFIG.attackStyleStaminaCost[style];
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
 * - 成本为 0 的动作永远放行（免费动作，目前是 FLEE）。
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
