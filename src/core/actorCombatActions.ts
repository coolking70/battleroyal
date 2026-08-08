/**
 * 战斗类统一行动（Phase 3 Step 10 从 actorActions.ts 拆出）：
 * 攻击 / 防御 / 技能 / 逃跑。
 *
 * 与拆分前逐行一致：玩家与 NPC 共用同一套体力闸门、反击对称性与追击规则，
 * 没有任何一方享有特权。前置校验统一来自 `actorActionBase.ts`。
 */

import { payActionCost } from './actionCosts';
import { attemptFlee, canAttack, counterChanceOf, resolveAttack } from './combat';
import { canUseSkill, useSkill, type SkillId } from './skills';
import { pushEvent } from './events';
import { done, fail, guard, who, type ActorActionResult } from './actorActionBase';
import type { SeededRandom } from './random';
import type { AttackStyle, Combatant, GameState } from './types';

/* ------------------------------------------------------------------ */
/* 攻击                                                                */
/* ------------------------------------------------------------------ */

export interface AttackActorResult extends ActorActionResult {
  targetDied: boolean;
  /** 是否触发了目标反击 */
  countered: boolean;
  /** 反击的结算文本，未触发时为 null（供遭遇日志与事件流展示） */
  counterMessage: string | null;
  /** 反击是否直接反杀了攻击者 */
  attackerDied: boolean;
}

/**
 * 攻击同区域的一名角色。
 *
 * 统一规则（旧 NPC 路径全部缺失）：
 * - 目标必须存在、存活、且与自己**同区域**；
 * - 攻击者必须通过 `canAttack` 体力闸门（`canAttack` 内部即 `canPayActionCost(actor,'ATTACK')`）；
 * - 反击方同样要过闸门，零体力打不出反击。
 *
 * **反击对称性**：`allowCounter` 默认开启，且**不区分攻防双方是不是玩家**。
 * 早期实现里"NPC 打玩家时玩家不反击"，导致玩家是全场唯一挨打不还手的角色
 * （实测受伤是 NPC 平均值的 2 倍、输出只有 0.27 倍），已在 Phase 2A 修正。
 *
 * 与玩家交手时不在这里建立 `encounter`，那是玩家界面的概念，
 * 由调用方（`commandHandlers` / `npcAi`）按需维护。
 */
export function attackActor(
  state: GameState,
  actor: Combatant,
  target: Combatant | null | undefined,
  rng: SeededRandom,
  options: { allowCounter?: boolean; style?: AttackStyle } = {},
): AttackActorResult {
  const style = options.style ?? 'normal';
  const base = {
    targetDied: false,
    countered: false,
    counterMessage: null,
    attackerDied: false,
  };
  if (!target || !target.alive) {
    return { ...fail('illegal_target', '目标已经不在了。'), ...base };
  }
  if (target.currentZoneId !== actor.currentZoneId) {
    return { ...fail('illegal_target', '目标不在当前区域。'), ...base };
  }
  const blocked = guard(state, actor, null);
  if (blocked) return { ...blocked, ...base };
  // 风格对应的体力闸门（quick/normal/heavy 成本不同）
  const costCheck = canAttack(actor, style);
  if (!costCheck.ok) return { ...fail('no_stamina', costCheck.reason ?? '体力不足。'), ...base };

  // `resolveAttack` 内部扣除攻击体力，这里只负责闸门与反击对称性
  const cost = costCheck;
  const result = resolveAttack(state, actor, target, rng, style);
  let countered = false;
  let counterMessage: string | null = null;

  const allowCounter = options.allowCounter ?? true;
  if (allowCounter && !result.targetDied && target.alive && canAttack(target).ok) {
    // 反击统一走普通攻击（normal 风格）
    if (rng.chance(counterChanceOf(target, actor, style))) {
      const counter = resolveAttack(state, target, actor, rng);
      countered = true;
      counterMessage = counter.message;
    }
  }

  const message = counterMessage
    ? `${result.message}\n${counterMessage}`
    : result.message;

  return {
    ...done(message, cost.cost),
    targetDied: result.targetDied,
    countered,
    counterMessage,
    attackerDied: !actor.alive,
  };
}

/**
 * 摆出防御姿态。
 *
 * 与攻击共用同一套体力闸门（成本见 `GAME_CONFIG.guardStaminaCost`）。
 * 防御姿态会减免下一次所受伤害，并在该角色出手或被新攻击命中后自动解除——
 * 因此它是「用一回合的进攻机会换一次减伤」，而非永久无敌。
 */
export function guardActor(
  state: GameState,
  actor: Combatant,
): ActorActionResult {
  const blocked = guard(state, actor, 'GUARD');
  if (blocked) return blocked;
  const spent = payActionCost(actor, 'GUARD');
  actor.guarding = true;
  pushEvent(state, {
    type: 'GUARD',
    actorId: actor.id,
    zoneId: actor.currentZoneId,
    message: `${who(actor)}摆出防御姿态。`,
    metadata: { guarding: true },
  });
  return done(`${who(actor)}摆出防御姿态。`, spent);
}

/**
 * 释放角色技能（Phase 3 Step 3）。
 *
 * 前置校验（拥有该技能 / 冷却就绪 / 体力）由 `canUseSkill` 负责；
 * 体力在 `useSkill` 内部扣除（与普通行动统一走 `spendStamina`）。
 * 技能效果（治疗 / 修理 / 增益状态）全部在 `skills.ts` 中实现，
 * 玩家与 NPC 共用同一段逻辑。
 */
export function useSkillActor(
  state: GameState,
  actor: Combatant,
  skillId: SkillId,
  rng: SeededRandom,
): ActorActionResult {
  const blocked = guard(state, actor, null);
  if (blocked) return blocked;
  const check = canUseSkill(actor, skillId);
  if (!check.ok) return fail('no_stamina', check.reason ?? '无法使用技能。');
  const res = useSkill(state, actor, skillId, rng);
  if (!res.ok) return fail('not_found', res.message);
  return done(res.message, check.cost);
}

/* ------------------------------------------------------------------ */
/* 逃跑                                                                */
/* ------------------------------------------------------------------ */

export interface FleeActorResult extends ActorActionResult {
  escaped: boolean;
  toZoneId: string | null;
  /** 逃跑失败后是否被追击 */
  pursued: boolean;
}

/**
 * 脱离战斗。**Phase 2A 起体力成本为 0（免费行动）**，
 * 因此闸门只校验"活着"，不校验体力——这是遭遇战不死锁的根本保证。
 *
 * 免费不等于无代价：
 * 1. 调用方仍会推进 1 个时间单位；
 * 2. 逃跑失败时敌人获得一次**追击**（同样要过体力闸门）；
 * 3. 追击伤害走正常结算，可以直接把人打死。
 */
export function fleeActor(
  state: GameState,
  actor: Combatant,
  enemy: Combatant | null | undefined,
  rng: SeededRandom,
  options: { allowPursuit?: boolean } = {},
): FleeActorResult {
  const base = { escaped: false, toZoneId: null as string | null, pursued: false };
  if (!enemy || !enemy.alive) {
    return { ...fail('illegal_target', '当前没有需要脱离的敌人。'), ...base };
  }
  const blocked = guard(state, actor, 'FLEE');
  if (blocked) return { ...blocked, ...base };

  const spent = payActionCost(actor, 'FLEE'); // 成本 0 时返回 0
  const res = attemptFlee(state, actor, enemy, rng);
  if (res.ok) {
    return {
      ...done(res.message, spent),
      escaped: true,
      toZoneId: res.toZoneId,
      pursued: false,
    };
  }

  // 追击：敌人必须自己付得起攻击体力，规则与玩家完全一致
  const allowPursuit = options.allowPursuit ?? true;
  if (allowPursuit && enemy.alive && canAttack(enemy).ok) {
    const counter = resolveAttack(state, enemy, actor, rng);
    return {
      ...done(`${res.message} ${counter.message}`, spent),
      ...base,
      pursued: true,
    };
  }
  return { ...done(res.message, spent), ...base };
}
