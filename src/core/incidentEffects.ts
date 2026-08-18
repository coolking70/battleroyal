import { GAME_CONFIG } from '../data/gameConfig';
import { getIncidentDef, tryGetIncidentDef } from '../data/incidents';
import { getItem } from '../data/items';
import { canPayActionCost, payActionCost } from './actionCosts';
import { pushEvent } from './events';
import {
  claimIncidentReward,
  nextIncidentRewardStack,
  noteIncidentContention,
  noteIncidentResponse,
  resolveIncident,
} from './incidents';
import { actorKnowsIncidentActive, observeIncidentLocal } from './incidentVisibility';
import { addItem, canAccept } from './inventory';
import { landmarkState } from './landmarks';
import { observeOwnAction, observeZoneVisit } from './npcKnowledge';
import { applyDamage } from './vitals';
import type { Combatant, GameState } from './types';
import type { SeededRandom } from './random';

/**
 * Phase 4T — temporary effects and the formal incident interaction.
 *
 * Temporary incident effects are kept OUT of permanent landmark/facility
 * runtime: the incident overlay is added on top of the base runtime and is
 * removed on resolution/expiry without "restoring" anything that was already
 * permanently disabled/locked/drained.
 */

/** Effective charges for a facility: base runtime + ACTIVE incident overlays. */
export function effectiveFacilityCharges(state: GameState, landmarkId: string): number | null {
  const base = landmarkState(state, landmarkId);
  if (!base) return null;
  let total = base.charges;
  for (const runtime of Object.values(state.incidents)) {
    if (runtime.status !== 'ACTIVE') continue;
    const def = tryGetIncidentDef(runtime.incidentId);
    if (def?.effect.kind === 'facility_overlay' && def.effect.landmarkId === landmarkId) {
      total += runtime.overlayCharges;
    }
  }
  return total;
}

/**
 * Consume one facility charge: overlay first, permanent base runtime only when no overlay remains.
 * The optional observer is the acting actor: if consuming the last overlay
 * charge resolves the incident, the observer's own memory is refreshed through
 * the legal local observation entry.
 */
export function consumeFacilityCharge(state: GameState, landmarkId: string, observer: Combatant | null = null): void {
  const base = landmarkState(state, landmarkId);
  if (!base) return;
  for (const runtime of Object.values(state.incidents)) {
    if (runtime.status !== 'ACTIVE') continue;
    const def = tryGetIncidentDef(runtime.incidentId);
    if (def?.effect.kind === 'facility_overlay' && def.effect.landmarkId === landmarkId
      && runtime.overlayCharges > 0) {
      runtime.overlayCharges -= 1;
      if (runtime.overlayCharges === 0) {
        // The emergency window has been fully consumed → public resolution.
        resolveIncident(state, runtime.incidentId, null);
        if (observer && observer.alive) observeIncidentLocal(state, observer, runtime.incidentId);
      }
      noteIncidentResponse(state, runtime.incidentId);
      return;
    }
  }
  if (base.charges > 0) base.charges -= 1;
}

/** Effective lock state: a temporary access window can override a base lock. */
export function effectiveLandmarkLocked(state: GameState, landmarkId: string, baseLocked: boolean): boolean {
  if (!baseLocked) return false;
  for (const runtime of Object.values(state.incidents)) {
    if (runtime.status !== 'ACTIVE') continue;
    const def = tryGetIncidentDef(runtime.incidentId);
    if (def?.effect.kind === 'access_override' && def.effect.landmarkId === landmarkId && runtime.accessActive) {
      return false;
    }
  }
  return true;
}

/**
 * After an actor searches a landmark during an access window, the incident may resolve when loot is gone.
 * The observer's own memory is refreshed immediately when this resolves.
 */
export function checkAccessOverrideResolution(state: GameState, landmarkId: string, observer: Combatant | null = null): void {
  for (const runtime of Object.values(state.incidents)) {
    if (runtime.status !== 'ACTIVE') continue;
    const def = tryGetIncidentDef(runtime.incidentId);
    if (def?.effect.kind !== 'access_override' || def.effect.landmarkId !== landmarkId) continue;
    const landmark = landmarkState(state, landmarkId);
    if (landmark && (landmark.exhausted || landmark.remainingSearches <= 0 || landmark.loot.length === 0)) {
      resolveIncident(state, runtime.incidentId, null);
      if (observer && observer.alive) observeIncidentLocal(state, observer, runtime.incidentId);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Formal RESOLVE_INCIDENT interaction                                 */
/* ------------------------------------------------------------------ */

export interface ResolveIncidentResult {
  ok: boolean;
  message: string;
  staminaSpent: number;
  claimedItemId: string | null;
  rejection: 'game_over' | 'dead' | 'no_stamina' | 'illegal_target' | 'not_found' | null;
}

/**
 * The single formal incident interaction for reward-based incidents.
 *
 * Requires: playing, alive, incident ACTIVE, actor in the zone, positive
 * stamina, and (for LOCAL_DISCOVERY) the actor last-knows the incident as
 * active. Reward is a shared finite pool; claiming uses the official
 * `addItem`/`canAccept` path with real UIDs created by `createStack`.
 */
export function canResolveIncident(
  state: GameState,
  actor: Combatant,
  incidentId: string,
): { ok: boolean; reason: string | null; cost: number } {
  const def = tryGetIncidentDef(incidentId);
  const cost = GAME_CONFIG.incidentInteractionStaminaCost;
  if (!def) return { ok: false, reason: '事件不存在。', cost };
  if (state.status !== 'playing') return { ok: false, reason: '对局已经结束。', cost };
  if (!actor.alive) return { ok: false, reason: '已死亡的角色无法行动。', cost };
  if (actor.currentZoneId !== def.zoneId) return { ok: false, reason: '事件不在当前区域。', cost };
  const runtime = state.incidents[incidentId];
  if (!runtime || runtime.status !== 'ACTIVE') return { ok: false, reason: '事件当前不可交互。', cost };
  if (def.effect.kind !== 'reward_pool' && def.effect.kind !== 'reward_with_hazard') {
    return { ok: false, reason: '该事件通过其他方式交互。', cost };
  }
  // Information boundary: LOCAL incidents require the actor to have discovered
  // them; PUBLIC incidents are auto-broadcast to all actors.
  if (def.visibility === 'LOCAL_DISCOVERY' && !actorKnowsIncidentActive(actor, incidentId)) {
    return { ok: false, reason: '尚未发现该事件。', cost };
  }
  if (runtime.reward.length === 0) return { ok: false, reason: '事件奖励已经领完。', cost };
  const check = canPayActionCost(actor, 'RESOLVE_INCIDENT');
  return check.ok ? { ok: true, reason: null, cost } : { ok: false, reason: check.reason, cost };
}

/**
 * Execute the formal RESOLVE_INCIDENT action. Only reward-based incidents use
 * this command; facility/access incidents reuse INTERACT_LANDMARK and
 * SEARCH_LANDMARK respectively.
 */
export function resolveIncidentActor(
  state: GameState,
  actor: Combatant,
  incidentId: string,
  _rng: SeededRandom,
): ResolveIncidentResult {
  const check = canResolveIncident(state, actor, incidentId);
  if (!check.ok) {
    const def = tryGetIncidentDef(incidentId);
    if (def && (state.incidents[incidentId]?.reward.length ?? 0) === 0) {
      noteIncidentContention(state, incidentId);
    }
    return { ok: false, message: check.reason ?? '无法处理该事件。', staminaSpent: 0, claimedItemId: null, rejection: 'illegal_target' };
  }
  const def = getIncidentDef(incidentId);
  const runtime = state.incidents[incidentId]!;
  const before = actor.stamina;
  payActionCost(actor, 'RESOLVE_INCIDENT');
  const spent = before - actor.stamina;

  const next = nextIncidentRewardStack(runtime);
  if (!next) {
    noteIncidentContention(state, incidentId);
    return { ok: false, message: '事件奖励已经领完。', staminaSpent: spent, claimedItemId: null, rejection: 'not_found' };
  }
  const stack = runtime.reward.find((candidate) => candidate.uid === next.uid)!;

  // Risk/reward incidents apply a deterministic hazard before the reward.
  if (def.effect.kind === 'reward_with_hazard' && def.effect.hazardDamage > 0) {
    applyDamage(state, actor, def.effect.hazardDamage, null, `${def.title}环境风险`);
    if (!actor.alive) {
      // A lethal hazard keeps the death but grants nothing: no reward, no
      // claim, the pool/UID stays intact and no success fact is recorded.
      return { ok: false, message: `${def.title}的环境风险致命。`, staminaSpent: spent, claimedItemId: null, rejection: 'illegal_target' };
    }
  }

  if (!canAccept(actor, stack)) {
    // Inventory full: the failed attempt consumes nothing (no claim, no reward).
    return { ok: false, message: '背包已满，无法收取事件奖励。', staminaSpent: spent, claimedItemId: null, rejection: 'illegal_target' };
  }
  addItem(actor, stack);
  claimIncidentReward(state, incidentId, stack.uid, actor.id);

  noteIncidentResponse(state, incidentId);
  observeOwnAction(state, actor, 'RESOLVE_INCIDENT', 'success', 'item', stack.itemId);
  observeZoneVisit(state, actor);
  // The claim itself may have resolved the incident (last reward taken).
  // Refresh the actor's own memory through the legal local observation entry
  // so it does not carry a stale 'active' fact until its next move.
  observeIncidentLocal(state, actor, incidentId);
  pushEvent(state, {
    type: 'INCIDENT_CLAIMED',
    actorId: actor.id,
    zoneId: def.zoneId,
    importance: 'minor',
    message: `${actor.name} 在${def.title}中获得了 ${getItem(stack.itemId).name}。`,
    metadata: { incidentId, itemId: stack.itemId, zoneId: def.zoneId },
  });
  return { ok: true, message: `获得 ${getItem(stack.itemId).name}。`, staminaSpent: spent, claimedItemId: stack.itemId, rejection: null };
}
