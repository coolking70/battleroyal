import { tryGetLandmarkDef } from '../data/landmarks';
import { tryGetItem } from '../data/items';
import { tryGetRecipe } from '../data/recipes';
import { tryGetWildEnemy } from '../data/wildEnemies';
import type {
  ActorKnowledgeMemory,
  ActorMemoryEntry,
  ActorObservation,
  CoarseThreat,
  Combatant,
  GameEvent,
  GameState,
  ObservationAction,
  ObservationProvenance,
  ObservationTargetKind,
  RecalledKnowledge,
} from './types';

export const ACTOR_MEMORY_CAPACITY = 32;
export const SOURCE_FAILURE_FRESH_TURNS = 12;
export const THREAT_MEMORY_FRESH_TURNS = 10;

export function createActorKnowledgeMemory(ownerId: string): ActorKnowledgeMemory {
  return { ownerId, capacity: ACTOR_MEMORY_CAPACITY, evictions: 0, entries: [] };
}

function observationKey(observation: ActorObservation): string {
  switch (observation.kind) {
    case 'zone_visit': return `zone:${observation.zoneId}`;
    case 'landmark_state': return `landmark:${observation.landmarkId}`;
    case 'source_status': return `source:${observation.itemId}:${observation.landmarkId}`;
    case 'actor_sighting': return `actor:${observation.subjectActorId}`;
    case 'wild_seen': return `wild:${observation.wildDefId}`;
    case 'apex_public': return `apex:${observation.wildDefId}`;
    case 'public_match': return `public:${observation.eventType}:${observation.subjectActorId ?? '-'}:${observation.zoneId ?? '-'}`;
    case 'recent_action': return `action:${observation.action}:${observation.targetKind}:${observation.targetId ?? '-'}`;
    case 'own_item': return `item:${observation.itemId}`;
    case 'own_goal': return `goal:${observation.goalType}`;
    case 'incident_observed': return `incident:${observation.incidentId}`;
  }
}

function stableMemoryOrder(a: ActorMemoryEntry, b: ActorMemoryEntry): number {
  return a.observedAt - b.observedAt || a.kind.localeCompare(b.kind) || a.key.localeCompare(b.key);
}

function isLocalObservationLegal(state: GameState, actor: Combatant, observation: ActorObservation): boolean {
  if (observation.kind === 'zone_visit') return observation.zoneId === actor.currentZoneId;
  if (observation.kind === 'landmark_state' || observation.kind === 'source_status') {
    return tryGetLandmarkDef(observation.landmarkId)?.zoneId === actor.currentZoneId;
  }
  if (observation.kind === 'actor_sighting') {
    const subject = state.characters[observation.subjectActorId];
    return Boolean(subject && subject.id !== actor.id && subject.currentZoneId === actor.currentZoneId
      && observation.zoneId === actor.currentZoneId);
  }
  if (observation.kind === 'wild_seen') {
    return observation.zoneId === actor.currentZoneId && Boolean(tryGetWildEnemy(observation.wildDefId));
  }
  return true;
}

/** The only mutation gate for memory. It accepts typed facts, never runtime objects. */
export function rememberActorObservation(
  state: GameState,
  actor: Combatant,
  observation: ActorObservation,
): ActorMemoryEntry | null {
  if (state.status !== 'playing' || !actor.alive || actor.knowledgeMemory.ownerId !== actor.id) return null;
  if (observation.observedAt !== state.time) return null;
  if ((observation.provenance === 'DIRECT_LOCAL' || observation.provenance === 'SELF_ACTION')
    && !isLocalObservationLegal(state, actor, observation)) return null;

  const key = observationKey(observation);
  const entry = { ...observation, key } as ActorMemoryEntry;
  const previous = actor.knowledgeMemory.entries.find((candidate) => candidate.key === key);
  actor.knowledgeMemory.entries = actor.knowledgeMemory.entries.filter((candidate) => candidate.key !== key);
  actor.knowledgeMemory.entries.push(entry);
  actor.knowledgeMemory.entries.sort(stableMemoryOrder);
  state.stats.memoryObservations = (state.stats.memoryObservations ?? 0) + 1;

  while (actor.knowledgeMemory.entries.length > actor.knowledgeMemory.capacity) {
    actor.knowledgeMemory.entries.shift();
    actor.knowledgeMemory.evictions += 1;
    state.stats.memoryEvictions = (state.stats.memoryEvictions ?? 0) + 1;
  }
  if (entry.kind === 'source_status' && entry.state !== 'available'
    && (!previous || previous.kind !== 'source_status' || previous.state !== entry.state)) {
    state.stats.sourceFailuresRemembered = (state.stats.sourceFailuresRemembered ?? 0) + 1;
  }
  return entry;
}

export function observeZoneVisit(state: GameState, actor: Combatant): ActorMemoryEntry | null {
  return rememberActorObservation(state, actor, {
    kind: 'zone_visit',
    zoneId: actor.currentZoneId,
    observedAt: state.time,
    provenance: 'SELF_ACTION',
  });
}

/** Records only a coarse local state; exact searches, loot, charges and timestamps never enter memory. */
export function observeLocalLandmark(
  state: GameState,
  actor: Combatant,
  landmarkId: string,
  provenance: Extract<ObservationProvenance, 'DIRECT_LOCAL' | 'SELF_ACTION'> = 'SELF_ACTION',
): ActorMemoryEntry[] {
  const def = tryGetLandmarkDef(landmarkId);
  const runtime = state.landmarks[landmarkId];
  if (!def || !runtime || def.zoneId !== actor.currentZoneId || state.status !== 'playing') return [];
  const landmarkState = runtime.exhausted || runtime.remainingSearches <= 0 || runtime.loot.length === 0
    ? 'exhausted'
    : runtime.locked || runtime.disabled
      ? 'blocked'
      : 'available';
  const entries: ActorMemoryEntry[] = [];
  const landmark = rememberActorObservation(state, actor, {
    kind: 'landmark_state', landmarkId, state: landmarkState,
    observedAt: state.time, provenance,
  });
  if (landmark) entries.push(landmark);

  for (const itemId of [...new Set(def.initialLoot.map((entry) => entry.itemId))].sort()) {
    const source = rememberActorObservation(state, actor, {
      kind: 'source_status', landmarkId, itemId,
      state: landmarkState === 'available' ? 'available' : landmarkState === 'exhausted' ? 'exhausted' : 'unavailable',
      observedAt: state.time, provenance,
    });
    if (source) entries.push(source);
  }
  return entries;
}

function coarseThreat(owner: Combatant, subject: Combatant): CoarseThreat {
  const ownerPower = Math.max(1, owner.attack + owner.defense + owner.level * 2);
  const subjectPower = subject.attack + subject.defense + subject.level * 2;
  const ratio = subjectPower / ownerPower;
  if (!Number.isFinite(ratio)) return 'unknown';
  if (ratio >= 1.35) return 'high';
  if (ratio >= 0.9) return 'medium';
  return 'low';
}

export function observeActorSighting(
  state: GameState,
  observer: Combatant,
  subject: Combatant,
  provenance: Extract<ObservationProvenance, 'DIRECT_LOCAL' | 'SELF_ACTION'> = 'DIRECT_LOCAL',
): ActorMemoryEntry | null {
  if (observer.id === subject.id || observer.currentZoneId !== subject.currentZoneId) return null;
  return rememberActorObservation(state, observer, {
    kind: 'actor_sighting', subjectActorId: subject.id, zoneId: observer.currentZoneId,
    threat: coarseThreat(observer, subject), observedAt: state.time, provenance,
  });
}

export function observeWildSighting(
  state: GameState,
  observer: Combatant,
  wildDefId: string,
): ActorMemoryEntry | null {
  const def = tryGetWildEnemy(wildDefId);
  if (!def) return null;
  return rememberActorObservation(state, observer, {
    kind: 'wild_seen', wildDefId, zoneId: observer.currentZoneId, tier: def.tier,
    observedAt: state.time, provenance: 'DIRECT_LOCAL',
  });
}

export function observeOwnAction(
  state: GameState,
  actor: Combatant,
  action: ObservationAction,
  outcome: 'success' | 'failure',
  targetKind: ObservationTargetKind = 'none',
  targetId: string | null = null,
): ActorMemoryEntry | null {
  return rememberActorObservation(state, actor, {
    kind: 'recent_action', action, outcome, targetKind, targetId,
    observedAt: state.time, provenance: 'SELF_ACTION',
  });
}

export function observeOwnItem(state: GameState, actor: Combatant, itemId: string): ActorMemoryEntry | null {
  if (!tryGetItem(itemId)) return null;
  return rememberActorObservation(state, actor, {
    kind: 'own_item', itemId, observedAt: state.time, provenance: 'SELF_ACTION',
  });
}

export function observeOwnGoal(
  state: GameState,
  actor: Combatant,
  goalType: 'craft' | 'research' | 'extraction' | 'apex',
  progress: 'started' | 'progressed' | 'completed',
): ActorMemoryEntry | null {
  return rememberActorObservation(state, actor, {
    kind: 'own_goal', goalType, progress, observedAt: state.time, provenance: 'SELF_ACTION',
  });
}

/** Converts only formally public events into actor-private remembered knowledge. */
export function observePublicGameEvent(state: GameState, event: GameEvent): void {
  if (state.status !== 'playing') return;
  for (const actor of Object.values(state.characters)) {
    if (!actor.alive) continue;
    if (event.type === 'APEX_SPAWNED' || event.type === 'APEX_DEFEATED') {
      const wildDefId = typeof event.metadata.wildDefId === 'string' ? event.metadata.wildDefId : null;
      if (!wildDefId || !event.zoneId) continue;
      rememberActorObservation(state, actor, {
        kind: 'apex_public', wildDefId, zoneId: event.zoneId,
        lifecycle: event.type === 'APEX_SPAWNED' ? 'spawned' : 'defeated',
        observedAt: state.time, provenance: 'PUBLIC_EVENT',
      });
    } else if (event.type === 'CHARACTER_DIED' || event.type === 'VICTORY_DECLARED' || event.type === 'ZONE_RESTRICTED') {
      rememberActorObservation(state, actor, {
        kind: 'public_match', eventType: event.type,
        subjectActorId: event.type === 'CHARACTER_DIED' ? event.targetId : null,
        zoneId: event.zoneId, observedAt: state.time, provenance: 'PUBLIC_EVENT',
      });
    }
  }
}

export function recallEntry<T extends ActorMemoryEntry>(entry: T): RecalledKnowledge<T> {
  return {
    provenance: 'LAST_KNOWN_MEMORY', originalProvenance: entry.provenance,
    observedAt: entry.observedAt, value: entry,
  };
}

export function recalledSourceStatus(
  actor: Combatant,
  itemId: string,
  landmarkId: string,
): RecalledKnowledge<Extract<ActorMemoryEntry, { kind: 'source_status' }>> | null {
  const entry = actor.knowledgeMemory.entries.find((candidate): candidate is Extract<ActorMemoryEntry, { kind: 'source_status' }> =>
    candidate.kind === 'source_status' && candidate.itemId === itemId && candidate.landmarkId === landmarkId);
  return entry ? recallEntry(entry) : null;
}

export function isRecentlyKnownSourceUnavailable(
  actor: Combatant,
  itemId: string,
  landmarkId: string,
  now: number,
): boolean {
  const recalled = recalledSourceStatus(actor, itemId, landmarkId);
  return Boolean(recalled && recalled.value.state !== 'available'
    && now - recalled.observedAt <= SOURCE_FAILURE_FRESH_TURNS);
}

export function recentHighThreat(actor: Combatant, now: number): Extract<ActorMemoryEntry, { kind: 'actor_sighting' }> | null {
  return actor.knowledgeMemory.entries
    .filter((entry): entry is Extract<ActorMemoryEntry, { kind: 'actor_sighting' }> =>
      entry.kind === 'actor_sighting' && entry.threat === 'high' && now - entry.observedAt <= THREAT_MEMORY_FRESH_TURNS)
    .sort((a, b) => b.observedAt - a.observedAt || a.subjectActorId.localeCompare(b.subjectActorId))[0] ?? null;
}

export function latestPublicApex(actor: Combatant): Extract<ActorMemoryEntry, { kind: 'apex_public' }> | null {
  return actor.knowledgeMemory.entries
    .filter((entry): entry is Extract<ActorMemoryEntry, { kind: 'apex_public' }> => entry.kind === 'apex_public')
    .sort((a, b) => b.observedAt - a.observedAt || a.wildDefId.localeCompare(b.wildDefId))[0] ?? null;
}

export function knownActionTargetExists(kind: ObservationTargetKind, id: string | null): boolean {
  if (kind === 'none') return id === null;
  if (id === null) return false;
  if (kind === 'item') return Boolean(tryGetItem(id));
  if (kind === 'recipe') return Boolean(tryGetRecipe(id));
  return true;
}
