/**
 * 统一行动服务的公共基座（Phase 3 Step 10 从 actorActions.ts 拆出）。
 *
 * 只包含结果类型与三个所有行动共用的小工具：`fail` / `done` / `who` / `guard`。
 * 拆出的唯一目的是让 `actorActions.ts` 与 `actorCombatActions.ts` 共享同一份
 * 前置校验，避免两边各写一遍导致玩家 / NPC 规则再次漂移。
 */

import { canPayActionCost, type CostedAction } from './actionCosts';
import type { Combatant, GameState } from './types';

/* ------------------------------------------------------------------ */
/* 结果类型                                                            */
/* ------------------------------------------------------------------ */

export interface ActorActionResult {
  ok: boolean;
  /** 面向日志/界面的说明；失败时是拒绝原因 */
  message: string;
  /** 实际扣掉的体力（失败时恒为 0） */
  staminaSpent: number;
  /** 失败的机器可读原因，便于模拟器统计 */
  rejection:
    | null
    | 'game_over'
    | 'dead'
    | 'no_stamina'
    | 'illegal_target'
    | 'illegal_zone'
    | 'not_found';
}

export function fail(
  rejection: NonNullable<ActorActionResult['rejection']>,
  message: string,
): ActorActionResult {
  return { ok: false, message, staminaSpent: 0, rejection };
}

export function done(message: string, staminaSpent: number): ActorActionResult {
  return { ok: true, message, staminaSpent, rejection: null };
}

/** 第二人称 / 第三人称的统一称呼 */
export function who(actor: Combatant): string {
  return actor.isPlayer ? '你' : actor.name;
}

/**
 * 所有行动的公共前置：对局进行中 + 行动者存活 + 付得起体力。
 * 返回 `null` 表示通过，否则返回应当直接抛给调用方的失败结果。
 */
export function guard(
  state: GameState,
  actor: Combatant,
  action: CostedAction | null,
): ActorActionResult | null {
  if (state.status !== 'playing') return fail('game_over', '对局已经结束。');
  if (!actor.alive) return fail('dead', '已经死亡的角色无法行动。');
  if (action) {
    const cost = canPayActionCost(actor, action);
    if (!cost.ok) return fail('no_stamina', cost.reason ?? '体力不足。');
  }
  return null;
}
