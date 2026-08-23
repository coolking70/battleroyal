import { buildCraftPlan } from './craftPlan';
import { armorDefenseOf, weaponAttackOf } from './inventory';
import { currentWorldSourcesForActor } from './worldSources';
import { latestPublicApex, recentHighThreat, THREAT_MEMORY_FRESH_TURNS } from './npcKnowledge';
import { latestKnownActiveIncident } from './incidentVisibility';
import { tryGetIncidentDef } from '../data/incidents';
import { getZoneDistance } from './craftGuide';
import type {
  ActorMemoryEntry,
  Combatant,
  GameState,
  Personality,
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

/* ------------------------------------------------------------------ */
/* Phase 4U — human-like competition                                   */
/* ------------------------------------------------------------------ */

/** Pursue stale last-known information only within a bounded multi-hop radius. */
const HUNT_MAX_ZONE_DISTANCE = 4;
/** Give up a hunt after this many turns without a re-sighting. */
const HUNT_PURSUIT_TTL_TURNS = 8;

type SightingEntry = Extract<ActorMemoryEntry, { kind: 'actor_sighting' }>;

/** Personality-shaped preference over coarse remembered threat levels. */
const HUNT_THREAT_PREFERENCE: Record<Personality, Record<'low' | 'medium' | 'high', number>> = {
  aggressive: { low: 0.55, medium: 0.85, high: 1.0 },
  opportunist: { low: 1.0, medium: 0.7, high: 0.15 },
  cautious: { low: 0.8, medium: 0.3, high: 0 },
  collector: { low: 0.6, medium: 0.25, high: 0 },
  random: { low: 0.6, medium: 0.6, high: 0.6 },
};

const HUNT_THRESHOLD: Record<Personality, number> = {
  aggressive: 0.35,
  opportunist: 0.5,
  cautious: 0.72,
  collector: 0.78,
  random: 0.5,
};

/** Deterministic pseudo-jitter for the random personality (seeded by ids/time). */
function huntJitter(actor: Combatant, subjectId: string, now: number): number {
  let hash = 0;
  const source = `${actor.id}:${subjectId}:${now}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 1000;
  }
  return (hash % 21 - 10) / 100; // -0.10 .. +0.10
}

/** Own-state combat readiness (never the target's live runtime). */
function huntReadiness(actor: Combatant): number {
  const hp = Math.min(1, actor.hp / actor.maxHp);
  const stamina = Math.min(1, actor.stamina / actor.maxStamina);
  const weapon = Math.min(1, weaponAttackOf(actor) / 12);
  return hp * 0.5 + stamina * 0.2 + weapon * 0.3;
}

function targetKnownDead(actor: Combatant, subjectId: string): boolean {
  return actor.knowledgeMemory.entries.some((entry) =>
    entry.kind === 'public_match' && entry.eventType === 'CHARACTER_DIED' && entry.subjectActorId === subjectId);
}

/**
 * Deterministic last-known hunt scoring: freshness, topology distance to the
 * STALE last-known zone, coarse remembered threat, own readiness and
 * personality. A sighting at the actor's own zone is not a pursuit (local
 * combat handles it), and unreachable/too-stale targets are not pursued.
 */
function scoreHuntSighting(
  actor: Combatant,
  sighting: SightingEntry,
  now: number,
): number | null {
  if (sighting.threat === 'unknown') return null;
  if (targetKnownDead(actor, sighting.subjectActorId)) return null;
  const distance = getZoneDistance(actor.currentZoneId, sighting.zoneId);
  if (distance === 0) return null; // already at the last-known zone
  if (!Number.isFinite(distance) || distance > HUNT_MAX_ZONE_DISTANCE) return null;
  const freshness = 1 - (now - sighting.observedAt) / THREAT_MEMORY_FRESH_TURNS;
  const proximity = 1 - (distance - 1) / HUNT_MAX_ZONE_DISTANCE;
  const threatPreference = HUNT_THREAT_PREFERENCE[actor.personality][sighting.threat];
  if (threatPreference <= 0) return null;
  let score = freshness * 0.35 + proximity * 0.25 + threatPreference * 0.2 + huntReadiness(actor) * 0.2;
  if (actor.personality === 'random') score += huntJitter(actor, sighting.subjectActorId, now);
  return score;
}

/** Best deterministic hunt candidate from the actor's own sighting memory. */
function chooseHuntTarget(actor: Combatant, now: number): SightingEntry | null {
  const threshold = HUNT_THRESHOLD[actor.personality];
  let best: SightingEntry | null = null;
  let bestScore = threshold;
  for (const entry of actor.knowledgeMemory.entries) {
    if (entry.kind !== 'actor_sighting') continue;
    if (now - entry.observedAt > THREAT_MEMORY_FRESH_TURNS) continue;
    // Human-like damping: whoever just beat this actor and made it flee is
    // not re-pursued for a while, regardless of personality.
    if (recentlyFledFrom(actor, entry, now)) continue;
    const score = scoreHuntSighting(actor, entry, now);
    if (score !== null && (score > bestScore
      || (score === bestScore && best !== null && entry.subjectActorId.localeCompare(best.subjectActorId) < 0))) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

/** The strongest coarse threat this actor remembers (recently) in a zone. */
function rememberedThreatAtZone(actor: Combatant, zoneId: string, now: number): 'low' | 'medium' | 'high' | null {
  let strongest: 'low' | 'medium' | 'high' | null = null;
  for (const entry of actor.knowledgeMemory.entries) {
    if (entry.kind !== 'actor_sighting' || entry.zoneId !== zoneId) continue;
    if (entry.threat === 'unknown' || now - entry.observedAt > THREAT_MEMORY_FRESH_TURNS) continue;
    if (entry.threat === 'high') return 'high';
    if (entry.threat === 'medium' || strongest === null) strongest = entry.threat;
  }
  return strongest;
}

/** Does the actor yield a remembered opportunity because of a remembered threat? */
function yieldsOpportunityToThreat(
  actor: Combatant,
  zoneId: string,
  highValueResource: boolean,
  now: number,
): boolean {
  const threat = rememberedThreatAtZone(actor, zoneId, now);
  if (threat !== 'high') return false;
  if (actor.personality === 'cautious') return true;
  // Collectors contest only for high-value finite resources; a mere overlay /
  // access window is not worth a remembered high threat.
  if (actor.personality === 'collector') return !highValueResource;
  return false;
}

function recentlyFledFrom(actor: Combatant, sighting: Extract<ActorMemoryEntry, { kind: 'actor_sighting' }>, now: number): boolean {
  return actor.knowledgeMemory.entries.some((entry) => entry.kind === 'recent_action'
    && entry.action === 'FLEE' && entry.targetKind === 'actor'
    && entry.targetId === sighting.subjectActorId
    && entry.observedAt >= sighting.observedAt && now - entry.observedAt <= THREAT_MEMORY_FRESH_TURNS);
}

/** A known active incident is a coarse opportunity preference, filtered by personality. */
function incidentDesiredIntent(state: GameState, actor: Combatant): DesiredIntent | null {
  const latest = latestKnownActiveIncident(actor);
  if (!latest) return null;
  const def = tryGetIncidentDef(latest.incidentId);
  if (!def) return null;
  // Personality preference is a coarse gate only (deterministic; no tuning).
  const preference = def.personalityPreference?.[actor.personality] ?? 1;
  if (preference < 0.5) return null;
  // Competition gating: a remembered high threat at the opportunity zone may
  // make the actor yield (cautious always; collector unless the reward is a
  // finite high-value pool). Decision uses only the actor's own memory.
  const highValue = def.effect.kind === 'reward_pool' || def.effect.kind === 'reward_with_hazard';
  if (yieldsOpportunityToThreat(actor, def.zoneId, highValue, state.time)) return null;
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
    // Competition gating: a cautious NPC yields the Apex opportunity when it
    // remembers a high threat there (own memory only, never live runtime).
    const yieldsApex = yieldsOpportunityToThreat(actor, apex.zoneId, false, state.time);
    if (readyForApex(actor) && !yieldsApex) {
      return { type: 'contest_apex', reason: 'APEX_PUBLIC_AND_READY', targetId: apex.wildDefId };
    }
    return { type: 'gear_up', reason: 'APEX_PUBLIC_NOT_READY', targetId: null };
  }

  const threat = recentHighThreat(actor, state.time);
  if (threat && actor.personality === 'cautious' && recentlyFledFrom(actor, threat, state.time)) {
    return { type: 'avoid_threat', reason: 'RECENT_HIGH_THREAT', targetId: threat.zoneId };
  }
  // Phase 4U: deterministic last-known hunt for every personality (scores
  // decide who actually pursues; aggressive/opportunist naturally qualify most).
  const hunt = chooseHuntTarget(actor, state.time);
  if (hunt) {
    return { type: 'hunt_known_target', reason: 'KNOWN_TARGET', targetId: hunt.subjectActorId };
  }

  // Phase 4T: a known incident is a coarse opportunity below formal goals and
  // threat/hunt priorities, but above the generic gear-up/explore fallback.
  const incident = incidentDesiredIntent(state, actor);
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

  // Phase 4U: pursuit TTL — a hunt that has not re-sighted its target within a
  // bounded window is given up even if the stale score still qualifies
  // (human-like: you stop chasing a ghost). The stale sighting is consciously
  // discarded with the intent, so the next derivation cannot instantly
  // re-commit the same pursuit.
  if (current.type === 'hunt_known_target' && desired.type === 'hunt_known_target'
    && current.targetId === desired.targetId
    && state.time - current.committedAt > HUNT_PURSUIT_TTL_TURNS) {
    actor.knowledgeMemory.entries = actor.knowledgeMemory.entries
      .filter((entry) => !(entry.kind === 'actor_sighting' && entry.subjectActorId === current.targetId));
    state.stats.strategicIntentCompletions = (state.stats.strategicIntentCompletions ?? 0) + 1;
    actor.strategicIntent = null;
    return { lifecycle: 'COMPLETE', intent: null };
  }

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
