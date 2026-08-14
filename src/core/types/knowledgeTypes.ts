export type KnowledgeProvenance =
  | 'STATIC_PUBLIC'
  | 'PUBLIC_EVENT'
  | 'DIRECT_LOCAL'
  | 'SELF_ACTION'
  | 'LAST_KNOWN_MEMORY';

export type ObservationProvenance = Exclude<
  KnowledgeProvenance,
  'STATIC_PUBLIC' | 'LAST_KNOWN_MEMORY'
>;

export type CoarseThreat = 'unknown' | 'low' | 'medium' | 'high';
export type LandmarkKnowledgeState = 'available' | 'blocked' | 'exhausted';
export type SourceKnowledgeState = 'available' | 'unavailable' | 'exhausted';

interface ObservationBase {
  observedAt: number;
  provenance: ObservationProvenance;
}

export type ObservationAction =
  | 'MOVE'
  | 'SEARCH'
  | 'SEARCH_LANDMARK'
  | 'INTERACT_LANDMARK'
  | 'ATTACK'
  | 'FLEE'
  | 'CRAFT'
  | 'PICKUP'
  | 'EQUIP'
  | 'EXTRACT'
  | 'SUBMIT_RESEARCH'
  | 'GUARD'
  | 'REST';

export type ObservationTargetKind =
  | 'none'
  | 'zone'
  | 'landmark'
  | 'actor'
  | 'wild'
  | 'recipe'
  | 'item';

export type ActorObservation = ObservationBase & (
  | { kind: 'zone_visit'; zoneId: string }
  | { kind: 'landmark_state'; landmarkId: string; state: LandmarkKnowledgeState }
  | {
    kind: 'source_status';
    landmarkId: string;
    itemId: string;
    state: SourceKnowledgeState;
  }
  | {
    kind: 'actor_sighting';
    subjectActorId: string;
    zoneId: string;
    threat: CoarseThreat;
  }
  | {
    kind: 'wild_seen';
    wildDefId: string;
    zoneId: string;
    tier: 'common' | 'elite' | 'apex';
  }
  | {
    kind: 'apex_public';
    wildDefId: string;
    zoneId: string;
    lifecycle: 'spawned' | 'defeated';
  }
  | {
    kind: 'public_match';
    eventType: 'CHARACTER_DIED' | 'VICTORY_DECLARED' | 'ZONE_RESTRICTED';
    subjectActorId: string | null;
    zoneId: string | null;
  }
  | {
    kind: 'recent_action';
    action: ObservationAction;
    outcome: 'success' | 'failure';
    targetKind: ObservationTargetKind;
    targetId: string | null;
  }
  | { kind: 'own_item'; itemId: string }
  | {
    kind: 'own_goal';
    goalType: 'craft' | 'research' | 'extraction' | 'apex';
    progress: 'started' | 'progressed' | 'completed';
  }
);

export type ActorMemoryEntry = ActorObservation & { key: string };

export interface ActorKnowledgeMemory {
  ownerId: string;
  capacity: number;
  evictions: number;
  entries: ActorMemoryEntry[];
}

export interface RecalledKnowledge<T extends ActorMemoryEntry = ActorMemoryEntry> {
  provenance: 'LAST_KNOWN_MEMORY';
  originalProvenance: ObservationProvenance;
  observedAt: number;
  value: T;
}

export type StrategicIntentType =
  | 'gear_up'
  | 'seek_material'
  | 'explore_unknown'
  | 'avoid_threat'
  | 'hunt_known_target'
  | 'contest_apex'
  | 'pursue_extraction'
  | 'pursue_research'
  | 'recover';

export type StrategicIntentReason =
  | 'GEAR_GROWTH'
  | 'MISSING_RAW_MATERIAL'
  | 'UNKNOWN_SOURCE'
  | 'RECENT_HIGH_THREAT'
  | 'KNOWN_TARGET'
  | 'APEX_PUBLIC_AND_READY'
  | 'APEX_PUBLIC_NOT_READY'
  | 'FORMAL_EXTRACTION_GOAL'
  | 'FORMAL_RESEARCH_GOAL'
  | 'LOW_HP'
  | 'LOW_STAMINA';

export interface StrategicIntent {
  type: StrategicIntentType;
  reason: StrategicIntentReason;
  targetId: string | null;
  committedAt: number;
  reevaluateAt: number;
}

export type StrategicIntentLifecycle =
  | 'COMMIT'
  | 'PRESERVE'
  | 'REEVALUATE'
  | 'COMPLETE'
  | 'INVALIDATE';
