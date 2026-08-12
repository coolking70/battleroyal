/**
 * 逃离与战力评估（Phase 3A-1 从 combat.ts 拆分，保持单文件 ≤ 500 行）。
 *
 * 为什么拆出来：combat.ts 因 Phase 3A-1 统计元数据扩充超过 500 行；
 * 逃离（flee）与战力评估（estimatePower）是独立于「命中/伤害/反击」的模块，
 * 抽到本文件后 combat.ts 回落至 4xx 行（不变量 #15）。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { getZoneDef } from '../data/zones';
import { pushEvent } from './events';
import { refreshZoneOccupants } from './gameState';
import { totalAttack, totalDefense } from './inventory';
import { fleeChanceBonus } from './statusIds';
import type { SeededRandom } from './random';
import type { Combatant, GameState } from './types';

export interface FleeResult {
  ok: boolean;
  toZoneId: string | null;
  message: string;
}

/**
 * 逃跑成功率基础值。
 *            + 濒死时的求生加成
 *            - 斗士被动惩罚
 *            + 谨慎人格加成
 */
export function fleeChanceOf(actor: Combatant, enemy: Combatant): number {
  let p =
    GAME_CONFIG.baseFleeChance + (actor.speed - enemy.speed) * 0.03;
  const hpRatio = actor.hp / actor.maxHp;
  if (hpRatio < 0.3) p += 0.1;
  if (actor.passiveId === 'brawler') p -= GAME_CONFIG.brawlerFleePenalty;
  // 锐目（侦察员）：更擅长脱身（Phase 2A-1）
  if (actor.passiveId === 'keen_eye') p += GAME_CONFIG.keenEyeFleeBonus;
  if (actor.personality === 'cautious') p += 0.1;
  if (actor.personality === 'aggressive') p -= 0.05;
  p += fleeChanceBonus(actor);
  return Math.min(0.9, Math.max(0.1, p));
}

/**
 * 带世界事件修正的逃跑成功率。
 * 与 {@link hitChanceIn} 同理：判定与展示都走这里，避免两套数字。
 *
 * Phase 3A-1：连绵阴雨不再影响逃跑概率（效果已改为移动/远程命中）。
 */
export function fleeChanceIn(
  state: GameState,
  actor: Combatant,
  enemy: Combatant,
): number {
  void state; // 保留形参以维持调用契约（UI 同源入口）
  const base = fleeChanceOf(actor, enemy);
  return Math.min(0.9, Math.max(0.1, base));
}

/** 逃跑可以去的相邻区域（排除正式禁区，优先安全区） */
export function fleeDestinations(state: GameState, actor: Combatant): string[] {
  const def = getZoneDef(actor.currentZoneId);
  const legal = def.adjacent.filter(
    (id) => state.zones[id]?.status !== 'restricted',
  );
  const safe = legal.filter((id) => state.zones[id]?.status === 'safe');
  return safe.length > 0 ? safe : legal;
}

export function attemptFlee(
  state: GameState,
  actor: Combatant,
  enemy: Combatant,
  rng: SeededRandom,
): FleeResult {
  const destinations = fleeDestinations(state, actor);
  if (destinations.length === 0) {
    // 最后一个安全区时仍要保留“脱离接触”的出口，但不能把角色送入
    // 禁区。原地脱离不做成功率判定，因此不会进入 fleeActor 的追击分支。
    const msg = `${actor.name} 无相邻可退区域，原地脱离。`;
    pushEvent(state, {
      type: 'CHARACTER_ESCAPED',
      actorId: actor.id,
      targetId: enemy.id,
      zoneId: actor.currentZoneId,
      message: msg,
      metadata: { success: true, reason: 'no_exit', stationary: true },
    });
    return { ok: true, toZoneId: null, message: msg };
  }

  const chance = fleeChanceIn(state, actor, enemy);
  if (!rng.chance(chance)) {
    const msg = `${actor.name} 试图脱离，但被 ${enemy.name} 缠住了。`;
    pushEvent(state, {
      type: 'CHARACTER_ESCAPED',
      actorId: actor.id,
      targetId: enemy.id,
      zoneId: actor.currentZoneId,
      message: msg,
      metadata: { success: false, chance: Math.round(chance * 100) },
    });
    return { ok: false, toZoneId: null, message: msg };
  }

  const target = rng.pick(destinations);
  if (!target) {
    return { ok: false, toZoneId: null, message: '逃跑失败。' };
  }

  actor.currentZoneId = target;
  actor.stats.moves += 1;
  refreshZoneOccupants(state);

  const msg = `${actor.name} 摆脱了 ${enemy.name}，撤往${getZoneDef(target).name}。`;
  pushEvent(state, {
    type: 'CHARACTER_ESCAPED',
    actorId: actor.id,
    targetId: enemy.id,
    zoneId: target,
    message: msg,
    metadata: { success: true, toZoneId: target },
  });
  return { ok: true, toZoneId: target, message: msg };
}

/* ------------------------------------------------------------------ */
/* 战力评估（NPC 决策用）                                               */
/* ------------------------------------------------------------------ */

/**
 * 粗略战力评估。
 * NPC 只使用「公开可见」的信息：属性、当前生命、已装备的武器防具。
 * 不读取对方背包内容。
 */
export function estimatePower(c: Combatant): number {
  return (
    totalAttack(c) * 2 +
    totalDefense(c) * 1.5 +
    c.hp * 0.25 +
    c.speed * 0.5
  );
}
