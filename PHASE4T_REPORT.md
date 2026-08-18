# Phase 4T — Localized Dynamic Incidents & Opportunity Windows

## 1. Scope

Phase 4T adds finite, per-match local incidents: a zone gets a temporary
opportunity or obstacle, actors learn about it only through legal information
(public broadcast or physical presence), they may respond through existing
formal actions, the world changes a bounded amount, and the incident ends
(resolved or expired) while the match continues.

It starts from base `61d3ad6ce1434e46454b94b102b871ee4577b084` (Phase 4S
merged main) and preserves the full Phase 4R/4S chain. No LLM, quest log,
dialogue, faction, reputation, narrative, balance tuning, production PNG,
package dependency, or old-save migration work is in scope.

## 2. Baseline

| Item | Baseline at `61d3ad6` |
| --- | --- |
| Full Vitest | 118 files / 1,719 tests PASS |
| Save audit | 119/119 malformed rejected, 0 construction failures |
| Dependency audit | 124 files, R1/R2/R3/R4 = 0, max core/data file 500 lines |
| Production PNG | 268 files, unchanged |
| package.json / lock | unchanged |

## 3. Incident architecture

```text
IncidentDefinition (static, data-driven, src/data/incidents.ts)
  → deterministic per-match schedule (seed-derived, src/core/incidents.ts)
  → IncidentRuntime lifecycle (SCHEDULED → ACTIVE → RESOLVED / EXPIRED)
  → visibility boundary (PUBLIC_BROADCAST | LOCAL_DISCOVERY)
  → actor-scoped incident_observed memory (Phase 4S ActorKnowledgeMemory)
  → thin respond_to_incident StrategicIntent preference
  → existing planner / formal actions (MOVE, SEARCH_LANDMARK,
    INTERACT_LANDMARK, RESOLVE_INCIDENT)
  → authoritative world mutation (finite reward / temporary overlay)
  → resolution / expiry
```

There is no `IncidentAI` and no incident-side execution path. The incident
layer only describes opportunities and applies bounded effects through the
shared action services; `decideNpcAction` + `runNpcTurn` still choose every
step.

## 4. Lifecycle

`SCHEDULED` → `ACTIVE` at the seed-resolved `scheduledAt`; `ACTIVE` →
`EXPIRED` at `expiresAt = startedAt + duration`; `ACTIVE` → `RESOLVED` when
the incident's own completion condition is met (reward pool fully claimed,
overlay charges fully consumed, or the access-window landmark exhausted).
Every transition is driven by `state.time` inside `tickIncidents`, which runs
from `advanceTime` only while `status === 'playing'`. No `Math.random()`,
`Date.now()`, or browser timer participates: the same seed plus the same
command sequence replays the same lifecycle (T-1).

Scheduling uses a dedicated derived RNG (`phase4t:schedule:<seed>`) so the
per-match schedule never perturbs the established loot/spawn RNG streams.
Different seeds produce different schedules within each definition's window,
which is the match-to-match variability this phase adds.

## 5. Visibility model

- `PUBLIC_BROADCAST` (`hospital_emergency`, `lab_containment`): activation,
  public resolution, and expiry emit `INCIDENT_ACTIVATED` /
  `INCIDENT_RESOLVED` / `INCIDENT_EXPIRED` and write a coarse
  `incident_observed` memory (`provenance: PUBLIC_EVENT`) to every alive
  actor. The broadcast carries only the coarse fact — incident id, zone,
  state. It never carries reward counts, overlay charges, hazard values,
  remaining uses, private progress, or another actor's inventory (T-4).
- `LOCAL_DISCOVERY` (`factory_salvage`, `underground_maintenance`): no
  global event and no auto-memory. An actor learns the incident only by
  being in the zone (`observeIncidentLocal` via `observeIncidentsInZone`,
  called from `moveActor` and the top of `runNpcTurn`), which records the
  authoritative local state at that moment (T-5).

The generic `pushEvent` → `observePublicGameEvent` hook deliberately has no
`INCIDENT_*` case, so a LOCAL incident can never leak through the global
event array into remote cognition (T-6).

## 6. Local vs public information boundary

Remote actors never read `state.incidents[id]`. Planning reads only the
actor's own bounded memory. T-2/T-3 prove that varying a remote LOCAL
incident's runtime (reward pool, claims, responses, contention counters,
overlay, access) leaves a remote actor's memory, intent, source view, and
decision byte-identical. T-4 proves the public broadcast is coarse. T-8
proves a stale `active` memory is corrected only by a legal local revisit
(`DIRECT_LOCAL` refresh) or a public resolution event.

## 7. Phase 4S memory integration

`incident_observed` is a new member of the existing `ActorObservation` union
with the stable key `incident:<incidentId>` and a bounded shape
(`incidentId`, `zoneId`, `observedState ∈ {active, resolved, expired}`,
`observedAt`, `provenance`). It uses the existing capacity-32 memory,
stable eviction, and re-observation replacement — no second memory system.
Queries (`incidentMemory`, `actorKnowsIncidentActive`,
`latestKnownActiveIncident`, `knownActiveIncidentForZone`) read only the
actor's own entries.

## 8. StrategicIntent integration

One thin intent was added: `respond_to_incident`
(`KNOWN_INCIDENT_OPPORTUNITY`, `targetId` = incident zone). It sits below
recovery, formal research/extraction goals, public Apex, threat avoidance,
and hunt, and above the generic gear-up/explore fallback, so formal
takeovers always win (T-12) and ordinary turns PRESERVE the same
`committedAt` (T-11). A personality preference gate (definition-level,
deterministic) only decides whether the actor is interested at all.

`strategicZonePreference` gives the incident zone a ×5 weight in MOVE
targeting — a preference, never a teleport. After legal resolution/expiry
refresh, the intent transitions COMPLETE/INVALIDATE and is never
maintenance-restored (T-11, T-12).

## 9. Phase 4R access-chain integration

The `underground_maintenance` incident temporarily overrides the
`underground_sealed_passage` base lock via `effectiveLandmarkLocked` — the
same landmark, the same `SEARCH_LANDMARK` action, the same finite base loot,
the same permanent exhaustion transition. No incident-specific teleport or
route exists; an actor still has to walk there through the normal zone graph
and the existing planner.

## 10. Temporary overlay vs permanent runtime

- `effectiveFacilityCharges` = base `runtime.charges` + ACTIVE
  `facility_overlay` overlay charges; `consumeFacilityCharge` spends the
  overlay first and only touches the permanent base runtime when no overlay
  remains. Expiry removes the overlay; it never "repairs" a facility that
  was legitimately drained, disabled, or repaired before (BLOCKER 7 guard).
- `effectiveLandmarkLocked` returns `false` only while an ACTIVE
  `access_override` covers the landmark; base `locked`/`disabled`/`repaired`
  runtime is untouched, and expiry simply stops overriding it.

## 11. Contention / reward integrity

Reward incidents create a finite `ItemStack[]` pool at activation through
the shared `createStack` path (real UIDs, exact counts). A claim takes the
lowest-UID stack and moves it through the official `addItem`/`canAccept`
inventory path; the pool is spliced, never cloned (T-9). A second actor
arriving after the pool is gone is rejected and counted as a contention
failure; the counter and `incidentDuplicateReward` stay 0 in regression.
Expiry discards unclaimed stacks (no duplicated leftovers, T-10) and
save/load round-trips a partially consumed pool exactly (T-13).

## 12. Save schema

`state.incidents: Record<string, IncidentRuntime>` is persisted with the
current schema. Old-save migration remains DEFERRED. The runtime is flat and
bounded: status, schedule/timestamps, resolver, four small counters, a
finite reward `ItemStack[]`, overlay charges, and the access flag. Semantic
validation lives in `src/core/saveValidation/incidents.ts` plus a new
`incident_observed` branch in `knowledge.ts`: exact key shapes, legal status
transitions, timestamp ordering, per-effect reward compatibility, no
claimable reward after RESOLVED/EXPIRED, real resolver actors, real
IncidentDefinition references, `observedAt <= state.time`, and provenance
compatible with the incident's visibility (a `PUBLIC_EVENT` memory for a
LOCAL_DISCOVERY incident is rejected).

## 13. Tests

- `tests/phase4tIncidents.test.ts` — T-1 through T-16: 16/16 PASS.
- `tests/phase4tUi.test.tsx` — 5 UI information-boundary tests PASS.
- Full Vitest: 120 files / 1,753 tests PASS.
- Phase 4S (S-1..S-15), Phase 4R (12), Phase 4R-AF1 (9), Phase 4Q AF/AF2/AF3,
  Phase 4P Apex, Phase 4O victory/terminal, Phase 4N PvE, zero-stamina,
  item integrity, determinism, and event-visibility suites all remain green.

## 14. Regression

```text
npm run simulate -- --games 500 --seed-prefix PHASE4T --regression --output reports/phase4t-regression.json
```

- requestedTotalGames = 500, actualTotalGames = 500, trustworthy 500/500
  (100%), regressionGate = PASS, engineHealthy = PASS.
- timeout, illegalState, hardLimitReached, terminalWithoutWinner,
  invalidVictoryTuple, duplicateApexSpawn, invalidApexSpawnZone: all 0.
- Incident correctness: duplicateIncidentReward = 0,
  illegalIncidentResolution = 0, postTerminalIncidentMutation = 0.
- Character balance stays OBSERVATION ONLY (ratio 4.33, no zero-win role);
  no tuning was performed.

## 15. Known observations

- The random matrix resolves/expired most incidents through expiry rather
  than autonomous NPC claims; `incidentResponses`/`incidentRewardsClaimed`
  are therefore small in the 500-game sample. The formal autonomous
  response chain is covered deterministically by T-7.
- `incidentLocalDiscoveries` is low in the random matrix because the two
  LOCAL incidents depend on an actor being in the right zone during the
  window; T-5/T-8 cover the path directly.
- Character balance ratio and zero-win observations are unchanged from
  Phase 4S and remain observation-only.
- Vite retains its pre-existing large-chunk advisory.

## 16. Deferred work

- LLM integration = DEFERRED
- human-like competition expansion = DEFERRED
- balance = OBSERVATION ONLY
- old save migration = DEFERRED
- Phase 4U = NOT STARTED
