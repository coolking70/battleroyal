/**
 * EXPOSED（露出破绽）状态（Phase 3A Step 3）。
 *
 * Phase 3 的 heavy 只有收益没有风险：高伤、低命中、易被反击 —— 但「易被反击」
 * 只在遭遇里生效，实战中 heavy 近乎无脑最优。EXPOSED 就是补上那份风险：
 *
 *   重击挥空 → 自己露出破绽 → 对手下一次打中你会更疼。
 *
 * 三条红线：
 * 1. **只由 heavy miss 产生**。quick / normal 落空不产生，heavy 命中也不产生。
 * 2. **只影响攻击类战斗伤害**。禁区侵蚀 / 世界事件 / 持续伤害 / 终局衰竭都是
 *    直接调 `applyDamage`，不经过 `resolveAttack`，因此天然吃不到这 20% —— 这个
 *    隔离是靠「修正只写在 resolveAttack 里」保证的，不要把它挪进 `applyHpChange`。
 * 3. **不可叠加**。重复获得只刷新，永远最多一层。
 *
 * 生命周期（两个互斥的失效条件）：
 * - 条件A：受到一次成功的战斗伤害 → 立即移除（破绽被兑现了）。
 * - 条件B：一直没挨打 → 自己完成**下一次**有效行动后移除。
 *
 * 条件B 的坑：heavy miss 发生在角色自己这次行动的**中途**，如果不做处理，
 * 这次行动结束时就会把刚生成的 EXPOSED 立刻清掉，等于该状态从不存在。
 * 因此创建时带 `skipOwnActionClearOnce = true`，由产生它的那次行动消费掉，
 * 从下一次行动起才真正开始计数。这比记 `createdAtTime` 再做时间比较更确定，
 * 也不受「一个时间单位内做了几个动作」的影响。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { pushEvent } from './events';
import type { Combatant, GameState, StatusEffect } from './types';

/** 状态 id：存档、UI、模拟统计都以此为准 */
export const EXPOSED_ID = 'exposed';

/** 中文标签 */
export const EXPOSED_LABEL = '露出破绽';

/** 面向玩家的效果说明 */
export const EXPOSED_DESCRIPTION = `下一次受到攻击伤害 +${Math.round(
  (GAME_CONFIG.exposedDamageMult - 1) * 100,
)}%`;

/** 角色当前是否处于破绽状态 */
export function hasExposed(c: Combatant): boolean {
  return c.statusEffects.some((e) => e.id === EXPOSED_ID);
}

/**
 * 取受击伤害倍率。
 * 未处于破绽时返回 1（调用方可据此跳过任何计算）。
 */
export function exposedDamageMultiplier(c: Combatant): number {
  return hasExposed(c) ? GAME_CONFIG.exposedDamageMult : 1;
}

/**
 * 施加破绽。已有则刷新（不叠层），并重新武装「跳过一次自身行动清除」。
 *
 * @returns 是否真的挂上了状态（死人不挂）
 */
export function applyExposed(state: GameState, actor: Combatant): boolean {
  // state 目前不需要（事件由调用方 resolveAttack 一并记进 ATTACK_MISSED），
  // 但保留形参让四个入口签名一致，将来要单独发事件时不必改所有调用点。
  void state;
  if (!actor.alive) return false;

  const effect: StatusEffect = {
    id: EXPOSED_ID,
    // EXPOSED 不靠时间单位过期，靠上面两个条件；remaining 只作为兜底上限，
    // 防止极端情况下（角色再也不行动、也再没挨打）状态永久残留。
    remaining: GAME_CONFIG.exposedMaxDuration,
    hpPerTick: 0,
    label: EXPOSED_LABEL,
    damageTakenMult: GAME_CONFIG.exposedDamageMult,
    skipOwnActionClearOnce: true,
  };

  // 不叠加：先清掉旧的，再挂新的（等价于刷新）
  actor.statusEffects = actor.statusEffects.filter((e) => e.id !== EXPOSED_ID);
  actor.statusEffects.push(effect);
  return true;
}

/**
 * 条件A：角色受到一次成功的战斗伤害后调用，移除破绽。
 *
 * @returns 是否确实移除了（用于模拟器统计「破绽被兑现」的次数）
 */
export function consumeExposedOnDamage(state: GameState, c: Combatant): boolean {
  if (!hasExposed(c)) return false;
  c.statusEffects = c.statusEffects.filter((e) => e.id !== EXPOSED_ID);
  void state;
  return true;
}

/**
 * 条件B：角色完成一次自己的有效行动后调用。
 *
 * 第一次调用只消费掉「跳过一次」的标记（那就是产生破绽的 heavy miss 本身），
 * 第二次调用才真正移除。玩家侧由 `executeCommand` 的 finish 收口，
 * NPC 侧由 `runNpcTurn` 收口 —— 两边共用这一个函数，规则只写一遍。
 */
export function noteOwnActionCompleted(state: GameState, actor: Combatant): void {
  const effect = actor.statusEffects.find((e) => e.id === EXPOSED_ID);
  if (!effect) return;

  if (effect.skipOwnActionClearOnce) {
    effect.skipOwnActionClearOnce = false;
    return;
  }

  actor.statusEffects = actor.statusEffects.filter((e) => e.id !== EXPOSED_ID);
  if (actor.alive) {
    pushEvent(state, {
      type: 'STATUS_EXPIRED',
      actorId: actor.id,
      zoneId: actor.currentZoneId,
      importance: 'minor',
      message: `${actor.isPlayer ? '你' : actor.name}调整好了姿态，${EXPOSED_LABEL}状态解除。`,
      metadata: { statusId: EXPOSED_ID, reason: 'own_action' },
    });
  }
}
