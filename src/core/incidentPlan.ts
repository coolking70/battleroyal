import { INCIDENT_DEFINITIONS, tryGetIncidentDef } from '../data/incidents';
import { canSearchLandmark } from './landmarks';
import { canUseFacility } from './facilities';
import { canResolveIncident } from './incidentEffects';
import { actorKnowsIncidentActive, knownActiveIncidentForZone } from './incidentVisibility';
import { tryGetZoneDef } from '../data/zones';
import type { Combatant, GameState } from './types';
import type { WorldSource } from './worldSources';

/**
 * Phase 4T — planning integration.
 *
 * Incidents are an ADDITIONAL known opportunity for actors who have legally
 * observed them. They never replace the existing Phase 4R planner: the actual
 * MOVE / SEARCH_LANDMARK / INTERACT_LANDMARK / RESOLVE_INCIDENT commands still
 * come from `npcDecide` + `runNpcTurn`. This module only:
 *   1. exposes actor-scoped incident source candidates,
 *   2. resolves the deterministic in-zone response action,
 *   3. nudges zone preference toward a known incident.
 */

/** Actor-scoped incident source candidates: only incidents the actor last-knows as active. */
export function incidentSourcesForActor(state: GameState, actor: Combatant, itemId: string): WorldSource[] {
  const out: WorldSource[] = [];
  for (const def of INCIDENT_DEFINITIONS) {
    if (!actorKnowsIncidentActive(actor, def.id)) continue;
    const zone = state.zones[def.zoneId];
    if (!zone || zone.status === 'restricted') continue;
    const effect = def.effect;
    if ((effect.kind !== 'reward_pool' && effect.kind !== 'reward_with_hazard')) continue;
    if (!effect.itemIds.includes(itemId)) continue;
    out.push({
      kind: 'incident_loot',
      zoneIds: [def.zoneId],
      incidentIds: [def.id],
    });
  }
  return out.sort((a, b) => a.zoneIds[0]!.localeCompare(b.zoneIds[0]!));
}

/**
 * Deterministic in-zone response action for an actor who knows an active
 * incident here. Returns the formal action to take, or null.
 */
export function inZoneIncidentAction(
  state: GameState,
  actor: Combatant,
): { kind: 'resolve_incident'; incidentId: string; label: string }
  | { kind: 'search_landmark'; landmarkId: string; label: string }
  | { kind: 'interact_landmark'; landmarkId: string; interactionId: string; label: string }
  | null {
  // The action is driven by the actor's high-level commitment, so formal goals
  // (pursue_research, pursue_extraction, contest_apex) take over and the NPC
  // ignores the incident opportunity here. This keeps the existing planner
  // authoritative for the research route.
  if (actor.strategicIntent && actor.strategicIntent.type !== 'respond_to_incident') return null;
  // Stable ordering so the same state always picks the same incident.
  const incidentIds = knownActiveIncidentForZone(actor, actor.currentZoneId).sort();
  for (const incidentId of incidentIds) {
    const def = tryGetIncidentDef(incidentId);
    if (!def || def.zoneId !== actor.currentZoneId) continue;
    const runtime = state.incidents[incidentId];
    if (!runtime || runtime.status !== 'ACTIVE') continue;
    if (def.effect.kind === 'reward_pool' || def.effect.kind === 'reward_with_hazard') {
      const check = canResolveIncident(state, actor, incidentId);
      if (check.ok) return { kind: 'resolve_incident', incidentId, label: def.actionLabel };
    } else if (def.effect.kind === 'facility_overlay') {
      const facilityCheck = canUseFacility(state, actor, def.effect.landmarkId, def.effect.interactionId);
      if (facilityCheck.ok) {
        return { kind: 'interact_landmark', landmarkId: def.effect.landmarkId, interactionId: def.effect.interactionId, label: def.actionLabel };
      }
    } else if (def.effect.kind === 'access_override') {
      const searchCheck = canSearchLandmark(state, actor.id, def.effect.landmarkId);
      if (searchCheck.ok) return { kind: 'search_landmark', landmarkId: def.effect.landmarkId, label: def.actionLabel };
    }
  }
  return null;
}

/** Zone preference multiplier for a known incident target (used in MOVE weighting). */
export function incidentZonePreference(actor: Combatant, zoneId: string): number {
  const target = actor.strategicIntent?.targetId;
  if (actor.strategicIntent?.type === 'respond_to_incident' && target === zoneId) return 5;
  return 1;
}

/** Whether the actor last-knows an active incident in the given zone. */
export function knowsIncidentInZone(actor: Combatant, zoneId: string): boolean {
  return knownActiveIncidentForZone(actor, zoneId).length > 0;
}

/** Convenience: the zone of the actor's latest known active incident, if any. */
export function latestKnownIncidentZone(actor: Combatant): string | null {
  for (const def of INCIDENT_DEFINITIONS) {
    if (actorKnowsIncidentActive(actor, def.id) && tryGetZoneDef(def.zoneId)) return def.zoneId;
  }
  return null;
}
