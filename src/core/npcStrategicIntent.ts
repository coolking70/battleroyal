import { buildCraftPlan } from './craftPlan';
import { armorDefenseOf, weaponAttackOf } from './inventory';
import { currentWorldSourcesForActor } from './worldSources';
import { latestPublicApex, recentHighThreat, THREAT_MEMORY_FRESH_TURNS } from './npcKnowledge';
import { latestKnownActiveIncident } from './incidentVisibility';
import { tryGetIncidentDef } from '../data/incidents';
import type {
  ActorMemoryEntry,
  Combatant,
  GameState,
  StrategicIntent,
  StrategicIntentLifecycle,
  StrategicIntentReason,
  StrategicIntentType,
} from './types';

export const STRATEGIC_INTENT_REPLAN_CADENCE = 6;

export interface DesiredIntent {
  type: StrategicIntentType;
  reason: StrategicIntentReason;
  targetId: string | null;
}

export interface StrategicIntentMaintenance {
  lifecycle: StrategicIntentLifecycle;
  intent: StrategicIntent | null;
}

function latestActiveApex(actor: Combatant): Extract<ActorMemoryEntry, { kind: 'apex_public' }> | null {
  const latestByDef = new Map<string, Extract<ActorMemoryEntry, { kind: 'apex_public' }>>();
  for (const entry of actor.knowledgeMemory.entries) {
    if (entry.kind !== 'apex_public') continue;
    const previous = latestByDef.get(entry.wildDefId);
    if (!previous || entry.observedAt >= previous.observedAt) latestByDef.set(entry.wildDefId, entry);
  }
  return [...latestByDef.values()]
    .filter((entry) => entry.lifecycle === 'spawned')
    .sort((a, b) => b.observedAt - a.observedAt || a.wildDefId.localeCompare(b.wildDefId))[0] ?? null;
}

function readyForApex(actor: Combatant): boolean {
  return actor.hp / actor.maxHp >= 0.65
    && weaponAttackOf(actor) >= 8
    && (armorDefenseOf(actor) >= 5 || actor.level >= 3);
}

function recentHuntTarget(actor: Combatant, now: number): Extract<ActorMemoryEntry, { kind: 'actor_sighting' }> | null {
  return actor.knowledgeMemory.entries
    .filter((entry): entry is Extract<ActorMemoryEntry, { kind: 'actor_sighting' }> =>
      entry.kind === 'actor_sighting' && entry.threat !== 'unknown'
      && now - entry.observedAt <= THREAT_MEMORY_FRESH_TURNS)
    .sort((a, b) => b.observedAt - a.observedAt || a.subjectActorId.localeCompare(b.subjectActorId))[0] ?? null;
}

function recentlyFledFrom(actor: Combatant, sighting: Extract<ActorMemoryEntry, { kind: 'actor_sighting' }>, now: number): boolean {
  return actor.knowledgeMemory.entries.some((entry) => entry.kind === 'recent_action'
    && entry.action === 'FLEE' && entry.targetKind === 'actor'
    && entry.targetId === sighting.subjectActorId
    && entry.observedAt >= sighting.observedAt && now - entry.observedAt <= THREAT_MEMORY_FRESH_TURNS);
}

/** A known active incident is a coarse opportunity preference, filtered by personality. */
function incidentDesiredIntent(actor: Combatant): DesiredIntent | null {
  const latest = latestKnownActiveIncident(actor);
  if (!latest) return null;
  const def = tryGetIncidentDef(latest.incidentId);
  if (!def) return null;
  // Personality preference is a coarse gate only (deterministic; no tuning).
  const preference = def.personalityPreference?.[actor.personality] ?? 1;
  if (preference < 0.5) return null;
  return { type: 'respond_to_incident', reason: 'KNOWN_INCIDENT_OPPORTUNITY', targetId: def.zoneId };
}

export function deriveStrategicIntent(state: GameState, actor: Combatant): DesiredIntent | null {
  if (state.status !== 'playing' || actor.isPlayer || !actor.alive) return null;
  const hpRatio = actor.hp / actor.maxHp;
  const staminaRatio = actor.stamina / actor.maxStamina;
  if (hpRatio <= 0.28) return { type: 'recover', reason: 'LOW_HP', targetId: null };
  if (staminaRatio <= 0.2) return { type: 'recover', reason: 'LOW_STAMINA', targetId: null };

  if (actor.victoryGoal === 'research') {
    return { type: 'pursue_research', reason: 'FORMAL_RESEARCH_GOAL', targetId: null };
  }
  if (actor.victoryGoal === 'extraction') {
    return { type: 'pursue_extraction', reason: 'FORMAL_EXTRACTION_GOAL', targetId: null };
  }

  const apex = latestActiveApex(actor);
  if (apex) {
    return readyForApex(actor)
      ? { type: 'contest_apex', reason: 'APEX_PUBLIC_AND_READY', targetId: apex.wildDefId }
      : { type: 'gear_up', reason: 'APEX_PUBLIC_NOT_READY', targetId: null };
  }

  const threat = recentHighThreat(actor, state.time);
  if (threat && actor.personality === 'cautious' && recentlyFledFrom(actor, threat, state.time)) {
    return { type: 'avoid_threat', reason: 'RECENT_HIGH_THREAT', targetId: threat.zoneId };
  }
  const hunt = recentHuntTarget(actor, state.time);
  if (hunt && actor.personality === 'aggressive') {
    return { type: 'hunt_known_target', reason: 'KNOWN_TARGET', targetId: hunt.subjectActorId };
  }

  // Phase 4T: a known incident is a coarse opportunity below formal goals and
  // threat/hunt priorities, but above the generic gear-up/explore fallback.
  const incident = incidentDesiredIntent(actor);
  if (incident) return incident;

  const plan = actor.plannedRecipeId ? buildCraftPlan(state, actor, actor.plannedRecipeId) : null;
  const gap = plan?.rawGaps
    .filter((candidate) => candidate.missing > 0)
    .sort((a, b) => b.missing - a.missing || a.itemId.localeCompare(b.itemId))[0];
  if (gap) {
    const knownSources = currentWorldSourcesForActor(state, actor, gap.itemId);
    return {
      type: 'seek_material',
      reason: knownSources.length > 0 ? 'MISSING_RAW_MATERIAL' : 'UNKNOWN_SOURCE',
      targetId: gap.itemId,
    };
  }
  if (!plan && actor.personality === 'collector') {
    return { type: 'explore_unknown', reason: 'UNKNOWN_SOURCE', targetId: null };
  }
  return { type: 'gear_up', reason: 'GEAR_GROWTH', targetId: null };
}

function sameIntent(current: StrategicIntent, desired: DesiredIntent): boolean {
  return current.type === desired.type && current.targetId === desired.targetId;
}

function completed(current: StrategicIntent, desired: DesiredIntent): boolean {
  if (current.type === 'recover' && desired.type !== 'recover') return true;
  if (current.type === 'seek_material' && (desired.type !== 'seek_material' || desired.targetId !== current.targetId)) return true;
  if (current.type === 'contest_apex' && desired.type !== 'contest_apex') return true;
  if (current.type === 'hunt_known_target' && desired.type !== 'hunt_known_target') return true;
  if (current.type === 'respond_to_incident' && desired.type !== 'respond_to_incident') return true;
  return false;
}

function commitIntent(state: GameState, actor: Combatant, desired: DesiredIntent): StrategicIntent {
  const intent: StrategicIntent = {
    ...desired,
    committedAt: state.time,
    reevaluateAt: state.time + STRATEGIC_INTENT_REPLAN_CADENCE,
  };
  actor.strategicIntent = intent;
  state.stats.strategicIntentCommits = (state.stats.strategicIntentCommits ?? 0) + 1;
  if (intent.type === 'avoid_threat') {
    state.stats.threatAvoidanceIntents = (state.stats.threatAvoidanceIntents ?? 0) + 1;
  }
  if (intent.type === 'contest_apex') {
    state.stats.apexContestIntents = (state.stats.apexContestIntents ?? 0) + 1;
  }
  if (intent.type === 'respond_to_incident') {
    state.stats.incidentIntentCommits = (state.stats.incidentIntentCommits ?? 0) + 1;
  }
  return intent;
}

export function maintainStrategicIntent(state: GameState, actor: Combatant): StrategicIntentMaintenance {
  if (state.status !== 'playing' || actor.isPlayer || !actor.alive) {
    return { lifecycle: 'PRESERVE', intent: actor.strategicIntent };
  }
  const desired = deriveStrategicIntent(state, actor);
  if (!desired) return { lifecycle: 'PRESERVE', intent: actor.strategicIntent };
  const current = actor.strategicIntent;
  if (!current) return { lifecycle: 'COMMIT', intent: commitIntent(state, actor, desired) };

  if (sameIntent(current, desired)) {
    state.stats.strategicIntentPreserves = (state.stats.strategicIntentPreserves ?? 0) + 1;
    if (current.type === 'respond_to_incident') {
      state.stats.incidentIntentPreserves = (state.stats.incidentIntentPreserves ?? 0) + 1;
    }
    if (state.time >= current.reevaluateAt) {
      current.reason = desired.reason;
      current.reevaluateAt = state.time + STRATEGIC_INTENT_REPLAN_CADENCE;
      state.stats.strategicIntentReevaluations = (state.stats.strategicIntentReevaluations ?? 0) + 1;
      return { lifecycle: 'REEVALUATE', intent: current };
    }
    return { lifecycle: 'PRESERVE', intent: current };
  }

  const lifecycle: StrategicIntentLifecycle = completed(current, desired) ? 'COMPLETE' : 'INVALIDATE';
  if (lifecycle === 'COMPLETE') {
    state.stats.strategicIntentCompletions = (state.stats.strategicIntentCompletions ?? 0) + 1;
  } else {
    state.stats.strategicIntentInvalidations = (state.stats.strategicIntentInvalidations ?? 0) + 1;
  }
  return { lifecycle, intent: commitIntent(state, actor, desired) };
}

/** Planner context only: this never returns an action or mutates GameState. */
export function strategicZonePreference(actor: Combatant, zoneId: string): number {
  if (actor.personality === 'cautious' && actor.strategicIntent?.type === 'avoid_threat'
    && actor.strategicIntent.targetId === zoneId) return 0.05;
  if (actor.strategicIntent?.type === 'respond_to_incident'
    && actor.strategicIntent.targetId === zoneId) return 5;
  return 1;
}

/** Debug/tests may query the newest public fact without touching live Apex runtime. */
export function latestApexKnowledge(actor: Combatant): ReturnType<typeof latestPublicApex> {
  return latestPublicApex(actor);
}
