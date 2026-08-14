# Phase 4S — Actor-Scoped Knowledge, Memory & Strategic Intent

## 1. Scope

Phase 4S adds deterministic NPC cognition without adding content, balance
tuning, or a second execution system. It starts from base
`24c4ca0801bfe56384345e41bdbc0d54fb9c2694` and preserves the Phase 4R chain:
public/static sources → recipe plan → exploration objective → access chain →
formal actor action → authoritative world transition.

No LLM, embedding, vector store, dialogue, faction, quest, zone, Apex, Wild,
equipment, production PNG, package dependency, or old-save migration work is in
scope.

## 2. Architecture

The production boundary is:

```text
real world state
  → legal public/local/self observation
  → actor-owned bounded last-known memory
  → structured StrategicIntent context
  → existing Phase 4R planner
  → legal actor action / command service
  → authoritative world mutation
```

`StrategicIntent` never emits a command and never grants items, stamina, time,
movement, unlocks, or search results. `runNpcTurn()` and existing shared actor
actions remain the only autonomous execution path.

## 3. Observation model

`knowledgeTypes.ts` defines a finite discriminated union covering zone visits,
coarse landmark/source state, actor sightings/threats, Wild sightings, public
Apex/match facts, recent self-actions, own items, and own goals. Every entry has
a stable key, integer `observedAt`, and provenance.

Writes occur only after formal self actions, direct current-zone observations,
or public events. They never copy GameState, arbitrary JSON, remote landmark
runtime, another actor's inventory/planner/objective/memory/intent, or exact
remote HP/stamina/equipment.

## 4. Memory model

Each actor owns `ActorKnowledgeMemory` with capacity 32. Re-observation replaces
the same semantic key. Overflow eviction is deterministic: oldest
`observedAt`, then stable kind, then stable key. Memory size is therefore
bounded and replay-stable.

Memory is last-known data, not a live selector. A remote runtime change cannot
refresh it. A local revisit or legal public event can. Confirmed source failures
affect only that actor for a 12-turn freshness window; after the window, the
static source can be considered again without erasing the historical
observation. Threat sightings use a conservative 10-turn freshness window.

## 5. Provenance boundary

Persisted observation provenance distinguishes `PUBLIC_EVENT`, `DIRECT_LOCAL`,
and `SELF_ACTION`. Planning helpers distinguish recalled last-known facts from
the unchanged static/public registry. Static topology and recipe/source
definitions remain public potential; an actor's recent coarse failure is a
private planning filter, not a global source deletion.

No confidence/probabilistic inference engine and no `Math.random()` path was
introduced.

## 6. StrategicIntent lifecycle

The structured intent vocabulary covers gear growth, material seeking,
exploration, threat avoidance, known-target hunting, public Apex contest,
extraction, research, and recovery. Fields are limited to type, stable reason
code, compatible coarse target, `committedAt`, and `reevaluateAt`.

Lifecycle outcomes are explicit:

- **COMMIT** creates an intent only when no intent exists or a meaningful
  strategic change occurs.
- **PRESERVE** keeps type, target, and `committedAt` across ordinary turns.
- **REEVALUATE** refreshes the reason/cadence without replacing a still-valid
  intent.
- **COMPLETE** records recovery/material/Apex/hunt completion before committing
  the next meaningful intent.
- **INVALIDATE** records formal replacement such as research, extraction, or
  public Apex takeover; the old intent is not restored.

The cadence is six turns. The 500-game commit ratio is 12.3% of observed NPC
intent-maintenance turns, well below per-turn churn.

## 7. Planner integration

Source failure memory filters only remote static source candidates for the
owning actor while local runtime remains authoritative. Cautious threat memory
provides only a zone preference multiplier after a formal actor FLEE. Existing
`buildCraftPlan`, source resolution, landmark recommendation, access chains,
exploration objectives, `npcDecide`, legal action checks, and shared action
services still choose and execute every step.

No parallel route planner, teleport, direct inventory injection, direct unlock,
or direct strategic command path exists.

## 8. Remote information isolation

S-2 varies remote exhaustion, loot, remaining searches, lock, disable, repair,
charges, activation, and `lastUsedAt` while asserting identical observation,
memory, intent, source resolution, and NPC decision. S-3/S-4 prove stale memory
and legal refresh. S-5 proves actor last-seen locations do not track remote
movement. S-7/S-8 prove source failure affects only its owner.

Normal player UI mounts no cognition inspector. The existing `?debug=1` panel
shows actor intent and bounded memory details for diagnosis only; cognition is
not added to normal EventLog output.

## 9. Save semantics

Current-schema saves persist actor memory and NPC intent. Validation requires
the correct owner, exact per-kind field shapes, valid integer timestamps not in
the future, real zone/landmark/actor/item/Wild/Apex references, static source
relationships, action/target compatibility, bounded capacity, unique stable
keys, type/reason/target compatibility, and a spawned, not-publicly-defeated
Apex for `contest_apex`.

Extra runtime-snapshot-like fields such as loot arrays, remaining searches,
charges, or `lastUsedAt` are rejected. The save audit accepts its normal control
and rejects 119/119 malformed cases with zero construction failures.

## 10. Tests

- Phase 4S S-1 through S-15: 15/15 PASS.
- Full Vitest: 118 files / 1,719 tests PASS.
- Phase 4R and AF1 suites remain green, including remote hidden-state pairs,
  formal objective replacement, stable ordinary refresh, semantic save
  validation, and Engineer repair compatibility.
- Phase 4O alternative victory/terminal, Phase 4P Apex, Phase 4Q landmarks and
  AF3 recommendations, Phase 4N Wild PvE, UID conservation, determinism, and
  zero-stamina suites pass in the full run.
- Browser smoke reached a live game; normal UI had no private inspector;
  debug-only cognition was visually inspected; `render_game_to_text` returned a
  valid playing state; no console/page error artifact was produced.

## 11. Regression

Command:

```text
npm run simulate -- --games 500 --seed-prefix PHASE4S --regression --output reports/phase4s-regression.json
```

Result: requested 500, actual 500, trustworthy 500/500 (100%),
`regressionGate=true`, `engineHealthy=true`. Timeout, illegal state, hard limit,
terminal without winner, invalid victory tuple, duplicate Apex spawn, invalid
Apex spawn zone, deadlock, stall/livelock, empty legal set, and illegal command
counters are all zero.

Cognition observations:

- memory observations 495,849; evictions 77,088 (15.5%);
- intent commit/preserve 18,763 / 133,804;
- reevaluate/complete/invalidate 15,845 / 9,737 / 6,526;
- remembered source failures 5,552;
- threat-avoidance commits 0 in this random matrix; deterministic S-12 covers
  the formal encounter → FLEE → remembered avoidance path;
- public Apex-contest intents 27.

## 12. Known observations

- Character balance is observation-only: Engineer has 0 wins in this sample and
  the highest/lowest-nonzero ratio is 4.33. No tuning was performed.
- The intentionally local/ignored art candidate store is absent on this clean
  machine. Exact local `art:validate` and Phase 4A audit therefore reported
  missing candidate metadata; their repository-provided `CI=true`
  published-byte mode passed manifest, provenance, candidate hygiene, and
  runtime usage. Art doctor, both secret scans, and dry-run generation passed.
- Vite retains its pre-existing large-chunk advisory.
- Human-visible behavior remains **NEEDS-HUMAN-PLAYTEST**.

## 13. Deferred work

- LLM integration = **DEFERRED**
- dynamic incidents = **DEFERRED TO LATER PHASE**
- human-like competition expansion = **DEFERRED**
- balance = **OBSERVATION ONLY**
- old save migration = **DEFERRED**
- Phase 4T = **NOT STARTED**
