import { tryGetIncidentDef } from '../data/incidents';
import { rememberActorObservation } from './npcKnowledge';
import type {
  ActorMemoryEntry,
  Combatant,
  GameState,
  IncidentMemoryState,
} from './types';

/**
 * Phase 4T — incident observation and actor-scoped memory integration.
 *
 * Incidents enter the existing Phase 4S `ActorKnowledgeMemory` through the
 * `incident_observed` entry. The memory is ALWAYS last-known data:
 *   - PUBLIC_BROADCAST activation/resolution/expiry updates every actor's
 *     memory through a legal PUBLIC_EVENT.
 *   - LOCAL_DISCOVERY incidents are written only when the actor is physically
 *     in the zone (DIRECT_LOCAL), and that local write reflects the live
 *     authoritative state at that moment.
 * A remote actor never reads `state.incidents[id]`; planning reads only the
 * actor's own bounded memory.
 */

function incidentStateFromRuntime(state: GameState, incidentId: string): IncidentMemoryState | null {
  const runtime = state.incidents[incidentId];
  const def = tryGetIncidentDef(incidentId);
  if (!runtime || !def) return null;
  if (runtime.status === 'ACTIVE') return 'active';
  if (runtime.status === 'RESOLVED') return 'resolved';
  if (runtime.status === 'EXPIRED') return 'expired';
  return null;
}

/** Public broadcast only: every alive actor learns a coarse incident fact. */
export function observeIncidentPublic(state: GameState, incidentId: string, observedState: IncidentMemoryState): void {
  if (state.status !== 'playing') return;
  const def = tryGetIncidentDef(incidentId);
  if (!def || def.visibility !== 'PUBLIC_BROADCAST') return;
  for (const actor of Object.values(state.characters)) {
    if (!actor.alive) continue;
    rememberActorObservation(state, actor, {
      kind: 'incident_observed',
      incidentId,
      zoneId: def.zoneId,
      observedState,
      observedAt: state.time,
      provenance: 'PUBLIC_EVENT',
    });
  }
}

/**
 * Local discovery / revisit: only legal for an actor physically in the zone.
 * The observed state is the authoritative local runtime at this moment, so a
 * stale remote memory can be corrected by a legal revisit.
 */
export function observeIncidentLocal(state: GameState, actor: Combatant, incidentId: string): ActorMemoryEntry | null {
  if (state.status !== 'playing' || !actor.alive) return null;
  const def = tryGetIncidentDef(incidentId);
  if (!def || def.zoneId !== actor.currentZoneId) return null;
  const observedState = incidentStateFromRuntime(state, incidentId);
  if (!observedState) return null;
  state.stats.incidentLocalDiscoveries = (state.stats.incidentLocalDiscoveries ?? 0) + 1;
  const runtime = state.incidents[incidentId];
  if (runtime) runtime.localDiscoveries = (runtime.localDiscoveries ?? 0) + 1;
  return rememberActorObservation(state, actor, {
    kind: 'incident_observed',
    incidentId,
    zoneId: def.zoneId,
    observedState,
    observedAt: state.time,
    provenance: 'DIRECT_LOCAL',
  });
}

export function incidentMemory(
  actor: Combatant,
  incidentId: string,
): Extract<ActorMemoryEntry, { kind: 'incident_observed' }> | null {
  return actor.knowledgeMemory.entries
    .filter((entry): entry is Extract<ActorMemoryEntry, { kind: 'incident_observed' }> =>
      entry.kind === 'incident_observed' && entry.incidentId === incidentId)
    .sort((a, b) => b.observedAt - a.observedAt)[0] ?? null;
}

/** Last-known active incident memory (never a live runtime probe). */
export function actorKnowsIncidentActive(actor: Combatant, incidentId: string): boolean {
  return incidentMemory(actor, incidentId)?.observedState === 'active';
}

/** Zones where this actor last-knows a specific incident as active. */
export function knownActiveIncidentForZone(actor: Combatant, zoneId: string): string[] {
  const seen = new Set<string>();
  for (const entry of actor.knowledgeMemory.entries) {
    if (entry.kind !== 'incident_observed' || entry.observedState !== 'active' || entry.zoneId !== zoneId) continue;
    seen.add(entry.incidentId);
  }
  return [...seen].sort();
}

/** The single newest active incident memory across all zones (for intent). */
export function latestKnownActiveIncident(actor: Combatant): Extract<ActorMemoryEntry, { kind: 'incident_observed' }> | null {
  return actor.knowledgeMemory.entries
    .filter((entry): entry is Extract<ActorMemoryEntry, { kind: 'incident_observed' }> =>
      entry.kind === 'incident_observed' && entry.observedState === 'active')
    .sort((a, b) => b.observedAt - a.observedAt || a.incidentId.localeCompare(b.incidentId))[0] ?? null;
}

/** All last-known incident memories (active, resolved, or expired). */
export function allIncidentMemories(actor: Combatant): Extract<ActorMemoryEntry, { kind: 'incident_observed' }>[] {
  return actor.knowledgeMemory.entries
    .filter((entry): entry is Extract<ActorMemoryEntry, { kind: 'incident_observed' }> => entry.kind === 'incident_observed')
    .sort((a, b) => a.incidentId.localeCompare(b.incidentId));
}

/** Does this incident's reward pool contain the given item? (definition-level) */
export function incidentOffersItem(incidentId: string, itemId: string): boolean {
  const def = tryGetIncidentDef(incidentId);
  if (!def) return false;
  const effect = def.effect;
  return (effect.kind === 'reward_pool' || effect.kind === 'reward_with_hazard')
    && effect.itemIds.includes(itemId);
}

/** Observe every incident whose zone the actor currently occupies (legal local revisit). */
export function observeIncidentsInZone(state: GameState, actor: Combatant): void {
  if (state.status !== 'playing' || !actor.alive) return;
  for (const incidentId of Object.keys(state.incidents)) {
    const def = tryGetIncidentDef(incidentId);
    if (def && def.zoneId === actor.currentZoneId) observeIncidentLocal(state, actor, incidentId);
  }
}
