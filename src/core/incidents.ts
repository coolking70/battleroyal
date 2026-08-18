import { INCIDENT_DEFINITIONS, getIncidentDef, tryGetIncidentDef } from '../data/incidents';
import { pushEvent } from './events';
import { createStack } from './inventory';
import { SeededRandom } from './random';
import { observeIncidentPublic } from './incidentVisibility';
import type {
  GameState,
  IncidentDefinition,
  IncidentRuntime,
} from './types';

/**
 * Phase 4T — deterministic incident lifecycle.
 *
 * Scheduling is resolved per match from a seed-derived RNG so different seeds
 * produce different local opportunities while the same seed replays exactly.
 * All transitions are driven by `state.time` (never wall clock / timers) and
 * stop as soon as the match is terminal (`tickIncidents` is only called from
 * `advanceTime` before the terminal guard short-circuits).
 */

const INCIDENT_SCHEDULE_SEED_PREFIX = 'phase4t:schedule';

/** Create the per-match incident runtimes with deterministic schedules. */
export function initializeIncidents(state: GameState): void {
  state.incidents = {};
  const rng = new SeededRandom(`${INCIDENT_SCHEDULE_SEED_PREFIX}:${state.seed}`);
  for (const def of INCIDENT_DEFINITIONS) {
    state.incidents[def.id] = {
      incidentId: def.id,
      status: 'SCHEDULED',
      scheduledAt: rng.int(def.scheduleMin, def.scheduleMax),
      startedAt: null,
      expiresAt: null,
      resolvedAt: null,
      resolvedByActorId: null,
      publicBroadcastDone: false,
      localDiscoveries: 0,
      responses: 0,
      rewardClaimedCount: 0,
      contentionFailures: 0,
      reward: [],
      overlayCharges: 0,
      accessActive: false,
    };
    state.stats.incidentScheduled = (state.stats.incidentScheduled ?? 0) + 1;
  }
}

export function incidentRuntime(state: GameState, incidentId: string): IncidentRuntime | null {
  return state.incidents[incidentId] ?? null;
}

function createRewardPool(state: GameState, def: IncidentDefinition): void {
  const runtime = state.incidents[def.id]!;
  const effect = def.effect;
  if (effect.kind !== 'reward_pool' && effect.kind !== 'reward_with_hazard') return;
  runtime.reward = [];
  for (const itemId of effect.itemIds) {
    for (let index = 0; index < effect.countPerItem; index += 1) {
      runtime.reward.push(createStack(state, itemId, 1));
    }
  }
  runtime.rewardClaimedCount = 0;
}

function activateIncident(state: GameState, def: IncidentDefinition): void {
  const runtime = state.incidents[def.id]!;
  if (runtime.status !== 'SCHEDULED') return;
  runtime.status = 'ACTIVE';
  runtime.startedAt = state.time;
  runtime.expiresAt = state.time + def.duration;
  state.stats.incidentActivated = (state.stats.incidentActivated ?? 0) + 1;

  const effect = def.effect;
  if (effect.kind === 'reward_pool' || effect.kind === 'reward_with_hazard') {
    createRewardPool(state, def);
  } else if (effect.kind === 'facility_overlay') {
    runtime.overlayCharges = effect.overlayCharges;
  } else if (effect.kind === 'access_override') {
    runtime.accessActive = true;
  }

  if (def.visibility === 'PUBLIC_BROADCAST' && !runtime.publicBroadcastDone) {
    runtime.publicBroadcastDone = true;
    state.stats.incidentPublicBroadcasts = (state.stats.incidentPublicBroadcasts ?? 0) + 1;
    pushEvent(state, {
      type: 'INCIDENT_ACTIVATED',
      zoneId: def.zoneId,
      importance: 'major',
      message: `广播：${def.publicFact}`,
      metadata: { incidentId: def.id, zoneId: def.zoneId, visibility: def.visibility },
    });
    observeIncidentPublic(state, def.id, 'active');
  }
}

/** A reward-based incident resolves when its finite pool is fully claimed. */
function checkRewardResolution(state: GameState, def: IncidentDefinition, byActorId: string | null): void {
  const runtime = state.incidents[def.id]!;
  const effect = def.effect;
  if ((effect.kind !== 'reward_pool' && effect.kind !== 'reward_with_hazard') || runtime.status !== 'ACTIVE') return;
  if (runtime.reward.length === 0 && runtime.rewardClaimedCount > 0) {
    resolveIncident(state, def.id, byActorId);
  }
}

export function resolveIncident(state: GameState, incidentId: string, byActorId: string | null): void {
  const runtime = state.incidents[incidentId];
  const def = tryGetIncidentDef(incidentId);
  if (!runtime || !def || runtime.status !== 'ACTIVE') return;
  runtime.status = 'RESOLVED';
  runtime.resolvedAt = state.time;
  runtime.resolvedByActorId = byActorId;
  // A resolved incident must not keep a claimable reward pool.
  runtime.reward = [];
  runtime.overlayCharges = 0;
  runtime.accessActive = false;
  state.stats.incidentResolved = (state.stats.incidentResolved ?? 0) + 1;
  if (def.publicResolution) {
    pushEvent(state, {
      type: 'INCIDENT_RESOLVED',
      actorId: byActorId,
      zoneId: def.zoneId,
      importance: 'major',
      message: `广播：${def.title}已经结束。`,
      metadata: { incidentId, zoneId: def.zoneId, resolvedBy: byActorId },
    });
    observeIncidentPublic(state, incidentId, 'resolved');
  }
}

function expireIncident(state: GameState, def: IncidentDefinition): void {
  const runtime = state.incidents[def.id]!;
  if (runtime.status !== 'ACTIVE') return;
  runtime.status = 'EXPIRED';
  runtime.expiresAt = Math.min(runtime.expiresAt ?? state.time, state.time);
  // No claimable active reward may survive expiry.
  runtime.reward = [];
  runtime.overlayCharges = 0;
  runtime.accessActive = false;
  state.stats.incidentExpired = (state.stats.incidentExpired ?? 0) + 1;
  if (def.visibility === 'PUBLIC_BROADCAST') {
    pushEvent(state, {
      type: 'INCIDENT_EXPIRED',
      zoneId: def.zoneId,
      importance: 'minor',
      message: `${def.title}的机会窗口已关闭。`,
      metadata: { incidentId: def.id, zoneId: def.zoneId },
    });
    observeIncidentPublic(state, def.id, 'expired');
  }
}

/**
 * One deterministic lifecycle step per time unit.
 *
 * Called from `advanceTime` after Apex processing and before NPC turns, so an
 * incident activated at time T is legally observable by actors acting at T.
 */
export function tickIncidents(state: GameState): void {
  if (state.status !== 'playing') return;
  for (const def of INCIDENT_DEFINITIONS) {
    const runtime = state.incidents[def.id];
    if (!runtime) continue;
    if (runtime.status === 'SCHEDULED' && state.time >= runtime.scheduledAt) {
      activateIncident(state, def);
    } else if (runtime.status === 'ACTIVE' && (runtime.expiresAt ?? Infinity) <= state.time) {
      expireIncident(state, def);
    }
  }
}

/** Called from the shared action path after a formal incident interaction. */
export function noteIncidentResponse(state: GameState, incidentId: string): void {
  const runtime = state.incidents[incidentId];
  if (!runtime || runtime.status !== 'ACTIVE') return;
  runtime.responses = (runtime.responses ?? 0) + 1;
  state.stats.incidentResponses = (state.stats.incidentResponses ?? 0) + 1;
}

/** Called when an actor successfully claims one reward stack from a finite pool. */
export function claimIncidentReward(state: GameState, incidentId: string, stackUid: string, byActorId: string | null): boolean {
  const runtime = state.incidents[incidentId];
  if (!runtime || runtime.status !== 'ACTIVE') return false;
  const index = runtime.reward.findIndex((stack) => stack.uid === stackUid);
  if (index < 0) return false;
  runtime.reward.splice(index, 1);
  runtime.rewardClaimedCount = (runtime.rewardClaimedCount ?? 0) + 1;
  state.stats.incidentRewardsClaimed = (state.stats.incidentRewardsClaimed ?? 0) + 1;
  const def = tryGetIncidentDef(incidentId);
  if (def) checkRewardResolution(state, def, byActorId);
  return true;
}

/** Called when a claim is rejected because the pool is exhausted (contention). */
export function noteIncidentContention(state: GameState, incidentId: string): void {
  const runtime = state.incidents[incidentId];
  if (!runtime) return;
  runtime.contentionFailures = (runtime.contentionFailures ?? 0) + 1;
  state.stats.incidentContentionFailures = (state.stats.incidentContentionFailures ?? 0) + 1;
}

/** Deterministic select: the next claimable stack (lowest uid) or null. */
export function nextIncidentRewardStack(runtime: IncidentRuntime): { uid: string; itemId: string } | null {
  if (runtime.status !== 'ACTIVE' || runtime.reward.length === 0) return null;
  const sorted = runtime.reward.slice().sort((a, b) => a.uid.localeCompare(b.uid));
  const stack = sorted[0]!;
  return { uid: stack.uid, itemId: stack.itemId };
}

export function incidentDefinition(id: string): IncidentDefinition | null {
  return tryGetIncidentDef(id);
}

export { getIncidentDef };
