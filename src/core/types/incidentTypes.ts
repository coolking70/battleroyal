import type { ItemStack } from './itemTypes';

/**
 * Phase 4T — Localized dynamic incidents.
 *
 * A `IncidentDefinition` is static, data-driven content: it describes the
 * rule for a local incident (where it happens, how actors learn about it,
 * what the finite opportunity/obstacle is, and how it ends).
 *
 * An `IncidentRuntime` is the per-match, persisted lifecycle state. It never
 * copies the whole definition; it holds only the bounded finite runtime
 * fields needed to drive a deterministic lifecycle. Remote actors must never
 * read `state.incidents[id]` to learn about a LOCAL_DISCOVERY incident.
 */

/** How the incident becomes known to actors. */
export type IncidentVisibility = 'PUBLIC_BROADCAST' | 'LOCAL_DISCOVERY';

/** Deterministic finite lifecycle. */
export type IncidentStatus = 'SCHEDULED' | 'ACTIVE' | 'RESOLVED' | 'EXPIRED';

/** Coarse classification used only for reporting / UI grouping. */
export type IncidentCategory =
  | 'opportunity'
  | 'obstacle'
  | 'local_state_change'
  | 'risk_reward';

/** The bounded effect an incident applies while ACTIVE. */
export type IncidentEffect =
  | { kind: 'reward_pool'; itemIds: string[]; countPerItem: number }
  | { kind: 'facility_overlay'; landmarkId: string; overlayCharges: number; interactionId: string; healAmount: number }
  | { kind: 'access_override'; landmarkId: string; searchable: boolean }
  | { kind: 'reward_with_hazard'; itemIds: string[]; countPerItem: number; hazardDamage: number };

export interface IncidentDefinition {
  id: string;
  title: string;
  description: string;
  zoneId: string;
  visibility: IncidentVisibility;
  category: IncidentCategory;
  /** Deterministic scheduling window: resolved per-match from the game seed. */
  scheduleMin: number;
  scheduleMax: number;
  /** Length of the ACTIVE window in time units. */
  duration: number;
  /** Whether a legal resolution is broadcast to every actor (PUBLIC_EVENT). */
  publicResolution: boolean;
  effect: IncidentEffect;
  /** Coarse public fact broadcast to every actor on activation when PUBLIC_BROADCAST. */
  publicFact: string;
  /** Human label for the local interaction that resolves/claims the incident. */
  actionLabel: string;
  /** Optional personality preference hints (deterministic; no balance tuning). */
  personalityPreference?: Partial<Record<'aggressive' | 'cautious' | 'collector' | 'opportunist' | 'random', number>>;
}

/**
 * Per-match, persisted lifecycle. Flat and bounded on purpose: every field is
 * either a scalar timestamp, a small counter, a boolean, or a finite reward
 * `ItemStack[]` (real UIDs created through the shared inventory path).
 */
export interface IncidentRuntime {
  incidentId: string;
  status: IncidentStatus;
  /** Resolved schedule (deterministic per seed, derived from the definition window). */
  scheduledAt: number;
  startedAt: number | null;
  expiresAt: number | null;
  resolvedAt: number | null;
  resolvedByActorId: string | null;
  /** True once the PUBLIC_BROADCAST activation event has been emitted this match. */
  publicBroadcastDone: boolean;
  /** Observation / response counters (diagnostic, not decision inputs). */
  localDiscoveries: number;
  responses: number;
  rewardClaimedCount: number;
  contentionFailures: number;
  /** Finite reward pool created at activation for reward effects. */
  reward: ItemStack[];
  /** Remaining overlay charges for facility_overlay effects. */
  overlayCharges: number;
  /** Temporary access unlock for access_override effects. */
  accessActive: boolean;
}

/** Coarse, actor-owned last-known memory shape for incidents. */
export type IncidentMemoryState = 'active' | 'resolved' | 'expired';
