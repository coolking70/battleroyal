import { EXTRACTION_DELAY, EXTRACTION_ZONE_ID } from '../data/victoryConditions';
import { consumeOne, countItem } from './inventory';
import { pushEvent } from './events';
import { canPayActionCost, payActionCost, type CostedAction } from './actionCosts';
import type { Combatant, GameState, VictoryType } from './types';

export const EXTRACTION_BEACON_ID = 'extraction_beacon';
export const RESEARCH_PACKAGE_ID = 'research_package';

export interface VictoryEligibility {
  ok: boolean;
  reason: string | null;
  cost: number;
}

function fail(reason: string, cost = 0): VictoryEligibility {
  return { ok: false, reason, cost };
}

function actorCanAct(state: GameState, actor: Combatant): VictoryEligibility | null {
  if (state.status !== 'playing') return fail('对局已经结束。');
  if (!actor.alive) return fail('已经死亡的角色无法行动。');
  return null;
}

function objectiveCheck(
  state: GameState,
  actor: Combatant,
  action: CostedAction,
): VictoryEligibility {
  const base = actorCanAct(state, actor);
  if (base) return base;
  return canPayActionCost(actor, action);
}

export function canCallExtraction(state: GameState, actor: Combatant): VictoryEligibility {
  const base = objectiveCheck(state, actor, 'CALL_EXTRACTION');
  if (!base.ok) return base;
  if (actor.currentZoneId !== EXTRACTION_ZONE_ID) return fail('必须在车站才能呼叫撤离。', base.cost);
  if (state.activeExtraction) return fail('已经有一场撤离呼叫在进行中。', base.cost);
  if (countItem(actor, EXTRACTION_BEACON_ID) < 1) return fail('需要携带撤离信标。', base.cost);
  return base;
}

export function canExtract(state: GameState, actor: Combatant): VictoryEligibility {
  const base = objectiveCheck(state, actor, 'EXTRACT');
  if (!base.ok) return base;
  const active = state.activeExtraction;
  if (!active) return fail('当前没有进行中的撤离呼叫。', base.cost);
  if (active.callerId !== actor.id) return fail('只有呼叫者可以完成撤离。', base.cost);
  if (active.phase !== 'ready' || state.time < active.readyAtTime) return fail('撤离窗口尚未准备好。', base.cost);
  if (actor.currentZoneId !== EXTRACTION_ZONE_ID) return fail('必须留在车站才能完成撤离。', base.cost);
  if (countItem(actor, EXTRACTION_BEACON_ID) < 1) return fail('撤离信标已经不在身上。', base.cost);
  return base;
}

export function canSubmitResearch(state: GameState, actor: Combatant): VictoryEligibility {
  const base = objectiveCheck(state, actor, 'SUBMIT_RESEARCH');
  if (!base.ok) return base;
  if (actor.currentZoneId !== 'lab') return fail('必须在研究所才能提交研究。', base.cost);
  if (countItem(actor, RESEARCH_PACKAGE_ID) < 1) return fail('需要携带研究成果包。', base.cost);
  return base;
}

function consumeOneByItemId(actor: Combatant, itemId: string): boolean {
  const stack = actor.inventory.find((candidate) => candidate.itemId === itemId);
  return stack ? consumeOne(actor, stack.uid) : false;
}

/**
 * The sole contestant-winner mutation. It is intentionally independent of
 * route eligibility so classic, NPC, and alternative routes share one latch.
 */
export function declareVictory(
  state: GameState,
  winnerId: string,
  type: VictoryType,
): boolean {
  if (state.status !== 'playing') return false;
  if (state.victory.winnerId !== null || state.victory.type !== null) return false;
  const winner = state.characters[winnerId];
  if (!winner || !winner.alive || !state.turnOrder.includes(winnerId)) return false;

  state.victory = { winnerId, type, declaredAtTime: state.time };
  state.endedAtTime = state.time;
  state.status = winnerId === state.playerId ? 'won' : 'lost';
  state.endReason = type === 'last_survivor' && winnerId === state.playerId
    ? 'player_won'
    : type;
  state.encounter = null;
  state.activeExtraction = null;

  pushEvent(state, {
    type: 'VICTORY_DECLARED',
    actorId: winnerId,
    importance: 'critical',
    message: `${winner.name} 达成${typeLabel(type)}胜利。`,
    metadata: { winnerId, victoryType: type, time: state.time },
  });
  pushEvent(state, {
    type: 'GAME_ENDED',
    actorId: winnerId,
    importance: 'critical',
    message: winnerId === state.playerId
      ? type === 'last_survivor'
        ? `全场只剩下你一人，第 ${state.time} 个时间单位胜出。`
        : `你完成了${typeLabel(type)}路线，第 ${state.time} 个时间单位胜出。`
      : `${winner.name} 完成了${typeLabel(type)}路线；你已出局。`,
    metadata: {
      result: state.status,
      reason: state.endReason,
      winnerId,
      victoryType: type,
      time: state.time,
    },
  });
  return true;
}

function typeLabel(type: VictoryType): string {
  switch (type) {
    case 'last_survivor': return '最后生还者';
    case 'extraction': return '撤离';
    case 'research': return '研究';
  }
}

export interface ObjectiveActionResult {
  ok: boolean;
  message: string;
}

/** Production-path implementation shared by player commands and NPC turns. */
export function performObjectiveAction(
  state: GameState,
  actor: Combatant,
  type: 'CALL_EXTRACTION' | 'EXTRACT' | 'SUBMIT_RESEARCH',
): ObjectiveActionResult {
  if (type === 'CALL_EXTRACTION') {
    const check = canCallExtraction(state, actor);
    if (!check.ok) return { ok: false, message: check.reason ?? '无法呼叫撤离。' };
    payActionCost(actor, 'CALL_EXTRACTION');
    state.activeExtraction = {
      callerId: actor.id,
      zoneId: EXTRACTION_ZONE_ID,
      startedAtTime: state.time,
      readyAtTime: state.time + EXTRACTION_DELAY,
      phase: 'called',
    };
    pushEvent(state, {
      type: 'EXTRACTION_CALLED',
      actorId: actor.id,
      zoneId: EXTRACTION_ZONE_ID,
      importance: 'major',
      message: `${actor.name} 在车站呼叫了撤离。`,
      metadata: { zoneId: EXTRACTION_ZONE_ID, readyAtTime: state.activeExtraction.readyAtTime },
    });
    return { ok: true, message: '撤离呼叫已发出，等待窗口准备。' };
  }

  if (type === 'EXTRACT') {
    const check = canExtract(state, actor);
    if (!check.ok) return { ok: false, message: check.reason ?? '无法完成撤离。' };
    payActionCost(actor, 'EXTRACT');
    if (!consumeOneByItemId(actor, EXTRACTION_BEACON_ID)) {
      return { ok: false, message: '撤离信标已经不在身上。' };
    }
    pushEvent(state, {
      type: 'EXTRACTION_COMPLETED',
      actorId: actor.id,
      zoneId: EXTRACTION_ZONE_ID,
      importance: 'critical',
      message: `${actor.name} 已完成撤离。`,
      metadata: { zoneId: EXTRACTION_ZONE_ID },
    });
    declareVictory(state, actor.id, 'extraction');
    return { ok: true, message: '撤离完成，你赢得了这场对局。' };
  }

  const check = canSubmitResearch(state, actor);
  if (!check.ok) return { ok: false, message: check.reason ?? '无法提交研究。' };
  payActionCost(actor, 'SUBMIT_RESEARCH');
  if (!consumeOneByItemId(actor, RESEARCH_PACKAGE_ID)) {
    return { ok: false, message: '研究成果包已经不在身上。' };
  }
  pushEvent(state, {
    type: 'RESEARCH_COMPLETED',
    actorId: actor.id,
    zoneId: actor.currentZoneId,
    importance: 'critical',
    message: `${actor.name} 已提交研究成果。`,
    metadata: { zoneId: actor.currentZoneId },
  });
  declareVictory(state, actor.id, 'research');
  return { ok: true, message: '研究成果提交完成，你赢得了这场对局。' };
}

/** Synchronize cancellation and the public ready transition. */
export function syncActiveExtraction(state: GameState): void {
  const active = state.activeExtraction;
  if (!active || state.status !== 'playing') return;
  const caller = state.characters[active.callerId];
  const invalid = !caller || !caller.alive || caller.currentZoneId !== active.zoneId
    || countItem(caller, EXTRACTION_BEACON_ID) < 1;
  if (invalid) {
    pushEvent(state, {
      type: 'EXTRACTION_CANCELLED',
      actorId: active.callerId,
      zoneId: active.zoneId,
      importance: 'major',
      message: '撤离呼叫已取消。',
      metadata: { zoneId: active.zoneId },
    });
    state.activeExtraction = null;
    return;
  }
  if (active.phase === 'called' && state.time >= active.readyAtTime) {
    active.phase = 'ready';
    pushEvent(state, {
      type: 'EXTRACTION_READY',
      actorId: active.callerId,
      zoneId: active.zoneId,
      importance: 'major',
      message: '撤离窗口已准备好。',
      metadata: { zoneId: active.zoneId },
    });
  }
}
