# Phase 4P — Elite PvE, Named Apex Threats & Unique Loot

## 1. Executive Summary

Phase 4P extends the existing finite Phase 4N Wild system with three threat
tiers: `common`, `elite`, and `apex`. Elite threats are finite deterministic
instances. Named Apex threats are scheduled public world arrivals, unique per
match, persistent after self-flee, and permanently defeated after canonical
Wild death. They remain Wild entities rather than contestants: they have no
profession, stamina, EXP, inventory, ranking, victory eligibility, or victory
type.

This report begins with the required architecture audit. Implementation will
reuse the existing Wild registry, `WildEnemyInstance`, search/discovery path,
canonical combat adapter, ground-drop ownership, craft planner, NPC action
system, and terminal tick boundary. New higher-tier values remain provisional;
balance is observation only.

## 2. Base / Git

- Phase 4O accepted head: `2f9ddacbde5ba4aab17ad2791a9ef028cfa21f8d`
- Phase 4O normal merge commit: `7e0c94c0f0a327bd6c78f5e0b5cb60adfb788b84`
- Phase 4P base SHA: `7e0c94c0f0a327bd6c78f5e0b5cb60adfb788b84`
- Branch: `agent/phase4p-elite-pve-unique-loot`
- Save compatibility: `DEFERRED UNTIL PRE-RELEASE SAVE FORMAT STABILIZATION`
- Balance policy: `BALANCE OBSERVATION ONLY — BALANCE DEFERRED`

## 3. PvE Architecture Audit

1. `WildEnemyDef` contains the Phase 4N fields plus `tier` (`common | elite |
   apex`), `specialAbilityId`, optional `eligibleZones`, and optional
   `signatureDropItemId`. The original fields are `id`, `name`, `description`,
   `maxHp`, `attack`, `defense`, `speed`, `encounterWeight`, `behavior`,
   `threat`, `dropCategory`, `dropTableId`, `abilityId`, `fallbackEmoji`, and
   `fallbackColor`.
2. `WildEnemyInstance` persists `uid`, `defId`, `zoneId`, `hp`, `status`,
   `guarding`, `abilityCharges`, `statusEffects`, persisted `pendingIntent`,
   `dropResolved`, and `defeatedAtTime`.
3. Ordinary finite Wild populations are initialized once by
   `initializeWildPopulations()` in `src/core/wildPopulation.ts`, called from
   `createGame()` in `src/core/gameState.ts`.
4. `livingWildEnemiesInZone()` reads only the zone's persisted
   `wildEnemyIds`, then filters instances whose status is `alive` and whose
   stored zone matches.
5. `defeatWild()` in `src/core/wildCombat.ts` is the canonical death path. It
   sets status/HP/guard/status effects/death time, increments Wild-only stats,
   and calls `createWildDrops()`, which is protected by `dropResolved`.
6. Wild self-flee is `wildFlees()`. It clears transient guard/status state,
   resolves the encounter, and preserves the same UID, zone, HP, ability
   charges, and alive status for later SEARCH discovery.
7. Player and NPC Wild attacks use `attackWildActor()` and the existing
   `combat`, `combatRound`, `vitals`, action-cost, guard, and flee helpers. No
   second boss combat engine exists.
8. Player Wild response runs once per time-advancing command in
   `advanceActiveWildEncounter()`. NPC response runs through `resolveWildTurn`
   from the formal NPC action path.
9. NPCs discover Wild through their own SEARCH action. `npcDecide` derives
   known Wild targets from relevant `WILD_ENCOUNTER_STARTED` events rather than
   scanning the entire live registry for a hidden target.
10. NPC Wild fight/flee choice is deterministic and based on target threat,
    actor state, personality, and current action context; low health can lead
    to flee or guard rather than unconditional attack.
11. AutoPlayer uses the same craft goal, `buildCraftPlan`, world source,
    movement, SEARCH, combat, ground pickup, CRAFT, and EQUIP commands. Phase
    4N's representative route proves real Wild-material acquisition without
    material injection.
12. `src/core/worldSources.ts` exposes static `zone_loot` and `wild_drop`
    provenance. It reads definitions and common ecology, not live HP, UID,
    drop rolls, or encounter state.
13. The current map exposes zone identity, adjacency, status, supply/noise and
    static ecology presentation. It does not expose exact hidden Wild HP or
    live registry state.
14. `EncounterHero` shows exact Wild HP only after a formal encounter and
    presents threat, behavior, drop category, and fallback visual information.
15. Persisted Wild status effects are the finite instance's `enraged`,
    `evasive`, and `armored` entries. Character DoT effects remain on the
    contestant status-effect model and are not copied into contestants for
    Wild entities.
16. `src/core/saveValidation/wild.ts`, together with structure, reference,
    number, and consistency validation, checks Wild IDs, zone membership,
    unique UIDs, status/HP, ability charges, status effects, encounters,
    events, and Wild metrics.
17. Before Phase 4P there was no tier, Apex schedule, or persisted telegraph.
    Phase 4P adds those fields without changing existing `threat` values or
    common `abilityId` semantics. Special-move definitions are data-only in
    `src/data/wildApexAbilities.ts`; execution remains in `wildCombat.ts`.
18. The world-event scheduler is in `src/core/worldEvents.ts`, driven by
    `state.nextWorldEventTime` and processed from `advanceTime()`.
19. Phase progression is in `src/core/phase.ts`, driven by `state.time`, live
    contestants, finite loot ratio, and configured phase thresholds.
20. `advanceTime()` first rejects non-playing states and, after the NPC loop,
    immediately returns on a terminal state while clearing transient engagement
    state. This Phase 4O-AF2 boundary must also guard Apex scheduling.
21. Item conservation includes character inventory/equipment, zone loot,
    ground drops, pending pickup, and exact UID accounting. Wild drops enter
    the ground only and are consumed through ordinary pickup/craft flows.
22. NPC `autoLoot()` accesses ground items through the existing ownership and
    capacity rules, then records Wild-material pickups through the common stats
    path.
23. Wild kills increment `stats.wildKills` and global Wild metrics. They do not
    modify contestant PvP kills, contestant alive count, death order, winner,
    VictoryType, or ranking.
24. Simulator metrics now include historical encounter/kill/flee counts, elite
    encounters/kills, Apex spawned/encountered/killed/fled, signature
    drops/pickups/crafts, `bossKillsByType`, Wild damage/player deaths/drops,
    pickups/crafts, type/zone distributions, and craft-goal attempts/completions.
25. Near-redline modules are `saveValidation/numbers.ts` (499 lines),
    `saveValidation/references.ts` (497), `npcDecide.ts` (483),
    `gameEngine.ts` (476), and `commandHandlers.ts` (470). New Phase 4P code
    must live in focused `pve`/`apex` modules and keep every core/data file at
    or below 500 lines.

## 4. Audit Conclusion

The existing architecture is sufficient for a second Wild threat layer. The
safe extension points are the Wild definition/instance types and registry,
finite population initialization, SEARCH candidate selection, canonical Wild
combat, world-source provenance, save validation, and presentation projections.
Phase 4P will not add `GameState.characters` entries, a boss combat engine, a
free boss command, a new victory condition, direct material injection, or
production PNG changes.

## 5. Implementation Status

Architecture audit complete. Threat tiers, finite elite content, deterministic
one-time Apex scheduling, public lifecycle events, telegraph state, unique
ground drops, higher-tier recipes, NPC/AutoPlayer closure, UI projections,
focused tests, simulator metrics, and Phase 4P regression evidence are now
implemented in this working branch. The human acceptance gate remains open.

## 6. Phase 4P implementation evidence

### Registry and finite lifecycle

- `src/data/wildEnemies.ts` keeps the ten common compatibility export and adds
  six finite elite definitions plus `prototype_aegis`, `subject_07`, and
  `iron_tusk` as the three one-shot named Apex definitions.
- `src/core/wildPopulation.ts` creates the historical common population and a
  bounded deterministic elite population. There is no respawn path.
- `src/core/apexSchedule.ts` creates one schedule entry per named Apex,
  chooses a stable eligible-zone/fallback result, persists the spawn UID and
  zone, and returns immediately when the match is terminal. Reprocessing a
  spawned entry is idempotent.
- `APEX_SPAWNED` metadata is limited to `wildDefId`, `tier`, and `zoneId`; the
  user-facing message contains only the public name and zone name. UID, HP,
  status, pending intent, and drop details are absent.

### Combat, drops, and crafting

- Every player/NPC Wild action still reaches `attackWildActor`,
  `resolveWildTurn`, `wildFlees`, or `defeatWild`. The persisted
  `pendingIntent` is the telegraph/resolve boundary for data-driven special
  moves; `GUARD`, FLEE, action costs, vitals, and zero-stamina redlines are
  shared with the existing engine.
- Named Apex tables guarantee exactly one non-stackable signature material;
  `dropResolved` remains the exact-once guard. Signature drops enter ordinary
  ground ownership and are counted only when picked up or consumed by a
  formal craft.
- `src/data/phase4pItems.ts` contains nine higher-tier raw materials, seven
  components, and six final equipment outputs. `phase4pRecipes.ts` contains
  thirteen connected routes; all six final routes have depth at least 3.
  `worldSourcesForItem`, Craft Guide, NPC AutoLoot, and existing crafting and
  equip flows use the same registry.

### Acceptance tests and reports

`tests/phase4pEliteApex.test.ts` covers registry cardinality, schedule
save-before/after, idempotence, public info boundaries, SEARCH discovery,
telegraph persistence, GUARD/FLEE and zero stamina, exact-one signature drop,
PvP/victory isolation, craft graph/source conservation, and the formal
AutoPlayer route. The 500-game command required by this phase generated:

`npm run simulate -- --games 500 --seed-prefix PHASE4P --regression --output reports/phase4p-regression.json`

The resulting report records requested=actual=500, trustworthy=100%, and zero
timeout, illegal-state, deadlock, livelock, stall, empty legal set, hard-limit,
terminal-without-winner, invalid-victory-tuple, and duplicate-Apex-spawn
failures. Balance is explicitly observation-only in regression mode.

Additional gates:

- `npm run typecheck`: PASS.
- `npm run build`: PASS (Vite emitted only the existing large-chunk warning).
- `npm run audit:save`: PASS, 102/102 malformed saves rejected.
- `npm run audit:deps`: PASS, zero layering/redline violations.
- `npm run art:doctor -- --offline`, `art:validate`, `art:audit:phase4a`, and
  `art:security`: PASS.
- `npm audit --omit=dev --offline`: 0 vulnerabilities. The networked audit was
  not run because the restricted environment disallows sending dependency
  metadata to the external registry.
- Playwright smoke: PASS for menu → new game; rendered state and gameplay
  screenshot were inspected in `output/web-game/` with no new console error.
- Phase 4P focused suite: 7/7 PASS. After updating stale Phase 4M registry
  ceilings and selecting a deterministic Phase 4J-1 random route fixture, the
  full suite passes: 1,593/1,593 tests across 102 files. No Phase 4P test or
  legacy acceptance test fails.
- The implementation head `9fc8c4a499f20cfeb090d833bdf0475d086b3abf` passed
  GitHub Actions CI run #120; the subsequent report-only head is tracked by
  CI run #121. The PR remains open, Draft, and unmerged.

## 7. Human gate

Human status is exactly `NEEDS-HUMAN-PLAYTEST`. See
`PHASE4P_HUMAN_PLAYTEST.md`; no automated or agent-only evidence marks this
phase accepted.

## 8. Phase 4P-AF Acceptance Fix

This section records the independent acceptance-fix pass without replacing the
Phase 4P architecture audit above.

1. Audited input head: `54db0cbaa1924fc88fd447c34c9e0d7e4eb92ca0`.
2. Final AF head: `af90003178a813cf6af280472ff2fc4caa9de0a3`; the subsequent
   documentation-only closeout head is verified below against its exact
   branch-head CI run.
3. Blocker A root cause: `chooseSpawnZone()` fell back to unrelated open map
   zones when every eligible zone was restricted.
4. Strict semantics: due Apex entries choose deterministically from their own
   open `eligibleZones`; no eligible open zone means no mutation, no instance,
   no UID, no stat increment, and no `APEX_SPAWNED` event. The due entry is
   retried on later ticks.
5. Delayed spawn behavior: reopening an eligible zone releases the unchanged
   due entry; repeated processing remains one-shot and same-UID.
6. Save/load determinism: delayed continuation from structured save/load
   state produces the same schedule, instance, event, and stat state.
7. Apex save-zone validation: spawned entries require an existing zone in the
   definition's `eligibleZones`; a later zone restriction remains valid state.
8. Blocker B root cause: Wild save validation accepted any globally legal
   `pendingIntent`, even when it could never resolve for that enemy definition.
9. Per-definition invariant: `specialAbilityId === 'none'` requires null;
   otherwise only null or that definition's own special id is accepted.
   Defeated Wild instances always require null.
10. Corruption evidence: the expanded save audit covers non-eligible Apex
    zone, wrong-definition telegraphs, common telegraphs, defeated telegraphs,
    duplicate Apex UID, schedule/instance definition mismatch, and
    schedule/instance zone mismatch.
11. Blocker C root cause: NPC planning reconstructed only static zone pools,
    losing Wild/Apex raw provenance and reading the shared player goal in the
    shared SEARCH path.
12. Authoritative source planning: NPC raw gaps now use `buildCraftPlan()`'s
    `worldSources`, `sourceZoneIds`, and `sourceEnemyIds`; restricted status is
    evaluated against static public sources instead of erasing provenance.
13. Actor-scoped SEARCH: player SEARCH uses `state.craftGoalRecipeId`; NPC
    SEARCH uses only `actor.plannedRecipeId`. NPC high-tier weighting is not
    inherited from the player's unrelated or Phase 4P goal.
14. NPC information boundary: NPC route planning uses own inventory/plan,
    own `WILD_ENCOUNTER_STARTED`, public Apex definition/zone, and static
    source data. It does not scan remote UID/HP, hidden drops, or player state.
15. NPC route evidence: deterministic test route performs formal MOVE and
    SEARCH, discovers `prototype_aegis` as the NPC actor, defeats it through
    canonical Wild combat, auto-loots the real `aegis_core`, executes
    intermediate recipes plus `r_aegis_plate`, and equips `aegis_plate`.
16. Telegraph→GUARD evidence: a deterministic A/B test resolves the same
    `toxic_burst` pending intent with and without formal `guardActor()`;
    guarded damage is lower, guard is consumed, metadata records prevention,
    and pending intent becomes null. Zero-stamina FLEE/GUARD semantics remain.
17. `bossKillsByType`: simulator aggregation now filters
    `WILD_DEFEATED.metadata.tier === 'apex'`; `wildKillByType` remains all Wild.
18. Item/drop conservation: signature material is still created exactly once
    by canonical defeat, remains ground-owned until ordinary pickup, and is
    never injected by a debug command.
19. Tests: new AF focused coverage is in
    `tests/phase4pAfAcceptance.test.ts`; original Phase 4P tests remain. The
    final full suite is 103 test files / 1,608 tests, all passing.
20. Save audit: `npm run audit:save` passed with 109/109 malformed cases
    rejected, the normal control accepted, and 0 construction failures.
21. Dependency audit: `npm run audit:deps` scanned 105 files and passed;
    the maximum core/data file is 500 lines and R1/R2/R3/R4 are zero.
22. 500-game regression: the exact command passed the engine-health gate with
    requested=actual=500, trustworthyRate=100%, and all health counters zero,
    including `invalidApexSpawnZone=0`. The full observations are recorded
    below.
23. Balance policy: elite/Apex encounter, kill, flee, signature, victory, and
    boss-distribution numbers remain observation-only; no tuning was made.
24. Old-save migration remains deferred until pre-release save-format
    stabilization. Human status remains exactly `NEEDS-HUMAN-PLAYTEST`.

### Phase 4P-AF validation closeout

- Final local gates: `npm run typecheck` PASS; `npm test` PASS (103 files /
  1,608 tests); `npm run build` PASS with only the existing Vite large-chunk
  warning; `npm run audit:save` PASS (109/109 malformed saves rejected,
  control accepted, 0 construction failures); and `npm run audit:deps` PASS
  (105 files, max 500 lines, R1/R2/R3/R4 all zero).
- Art gates: `art:doctor -- --offline`, `art:validate`,
  `art:audit:phase4a`, `art:security:browser`, and `art:security:repo` all
  PASS. No `public/assets/**/*.png` file, approved PNG, or art manifest entry
  changed in this AF pass.
- Dependency gate: networked `npm audit --omit=dev` was attempted but the
  environment returned `ENOTFOUND registry.npmjs.org`; the required offline
  fallback `npm audit --omit=dev --offline` passed with 0 vulnerabilities.
- Browser smoke: the real Vite app reached menu → new game; the rendered
  state was `mode=playing`, `time=0`, and the gameplay screenshot was
  inspected with no new browser console error.
- Regression command:
  `npm run simulate -- --games 500 --seed-prefix PHASE4P-AF --regression --output reports/phase4p-regression.json`
  passed with `requestedTotalGames=500`, `actualTotalGames=500`,
  `trustworthyRate=100%`, `regressionGate=true`, and
  `invalidApexSpawnZone=0`. Health counters were all zero:
  timeout, illegalState, hardLimitReached, terminalWithoutWinner,
  invalidVictoryTuple, duplicateApexSpawn, and invalidApexSpawnZone.
- Regression PVE observations: `encounters=7789`, `kills=1725`,
  `flees=6746`, `playerDeaths=68`, `groundDrops=2805`, `pickups=3154`,
  `crafts=109`; `eliteEncounters=123`, `eliteKills=0`;
  `apexSpawned=342`, `apexEncounters=3`, `apexKills=0`, `apexFlees=0`;
  `signatureDrops=0`, `signaturePickups=0`, `signatureCrafts=0`,
  `bossKillsByType={}`. These are balance observations only.
- Final implementation head: `af90003178a813cf6af280472ff2fc4caa9de0a3`;
  its GitHub Actions CI run #123 (`31704949792`) completed with `success`.
  Documentation closeout head `5c1370ac3a63d193a25da4143eb2ea971dcf7a8e`
  passed its exact GitHub Actions CI run #124 (`31705310383`) with
  `completed/success`. PR #23 remains Draft and unmerged. Human status
  remains exactly `NEEDS-HUMAN-PLAYTEST`.

## 9. Phase 4P-AF2 — Actor-Scoped Search & NPC Apex Hunt Closure

This section records the AF2 acceptance-fix pass against audited input head
`321e3d33249b71d32279acf15688f51583888555`. PR #23 remains open, Draft, based
on `main`, and unmerged; no Phase 4Q work, content expansion, balance tuning,
or save migration was added.

### Blockers and fixes

1. Shared SEARCH previously let NPC research weighting read the player's
   `state.craftGoalRecipeId`. `rollItemId()` now resolves the craft goal through
   `getActorCraftGoalRecipeId()`: player SEARCH reads the player goal, while NPC
   SEARCH reads only that actor's `plannedRecipeId`. The acceptance suite covers
   both research-bias directions and high-tier weighting isolation.
2. Static Wild provenance was still being treated as a live Apex source. The
   new current-source helpers preserve static `worldSourcesForItem()` for
   provenance/Craft Guide output while runtime planning uses current state:
   unspawned Apex entries expose eligible open zones; spawned living Apex
   entries expose only their public scheduled zone; restricted spawned zones
   expose no route; defeated Apex entries expose no future source. Common and
   Elite source semantics remain unchanged. A spawned restricted-zone case is
   covered explicitly.
3. NPC planning could abandon an exhausted current zone or replan before
   completing its own named hunt. `npcWildHunt` now recognizes current Wild/Apex
   sources, forces SEARCH only for the actor's own current source, moves toward
   an adjacent public Apex source when needed, and preserves the route after a
   personally completed Apex defeat so pickup/craft/equip can finish. The
   integration route uses `runNpcTurn` as its only route driver after fixture
   setup; it does not inject encounters, drops, signatures, or actions.

### Acceptance evidence

- The autonomous fixture proves production NPC `MOVE → SEARCH → Wild encounter
  → canonical defeat → ground pickup → multi-stage craft → EQUIP`, with the
  exact-once `aegis_core` signature path and no remaining plan gaps.
- `defeatWild()` now emits `WILD_DEFEATED` before `WILD_DROP_CREATED`, preserving
  the required event order. Signature creation, pickup, craft consumption, and
  final equipment are each asserted once.
- NPC planning observes only its own plan/inventory and own encounter evidence,
  plus public Apex name/zone and static source data. It does not inspect remote
  UID/HP, hidden drops, or the player's goal/state.
- `tests/phase4pAf2Acceptance.test.ts` adds 6 tests. The combined focused
  Phase 4P suites pass 21/21; the full suite passes 104 files / 1,614 tests.
- Deterministic replay compares the autonomous route's event trace, stats,
  inventory, equipment, and terminal state exactly.

### Required gates

- `npm run typecheck`, `npm test`, and `npm run build`: PASS. Build retains only
  the existing Vite large-chunk warning.
- `npm run audit:save`: PASS — malformed saves 109/109 rejected, control
  accepted, construction failures 0.
- `npm run audit:deps`: PASS — 106 files scanned, maximum core/data file
  `src/core/npcDecide.ts` at 500 lines, R1/R2/R3/R4 violations 0.
- `npm run art:doctor -- --offline`, `npm run art:validate`,
  `npm run art:audit:phase4a`, `npm run art:security:browser` (242 files), and
  `npm run art:security:repo` (969 tracked files): PASS.
- Networked `npm audit --omit=dev` was attempted and returned
  `getaddrinfo ENOTFOUND registry.npmjs.org`; offline fallback
  `npm audit --omit=dev --offline` passed with 0 vulnerabilities.
- Browser smoke reached menu → new game; the rendered state was
  `mode=playing`, `time=0`, with no browser error artifacts, and the gameplay
  screenshot was visually inspected.
- Exact regression command:
  `npm run simulate -- --games 500 --seed-prefix PHASE4P-AF2 --regression --output reports/phase4p-regression.json`
  produced requested=actual=500, trustworthyRate=100%, `regressionGate=true`,
  and `engineHealthy=true`. Outcome counts were won=21, lost=414, draw=65,
  timeout=0. Health counters were all 0, including duplicate Apex spawns and
  invalid Apex spawn zones. PVE observations were encounters=7,692,
  eliteEncounters=130, apexSpawned=346, apexEncounters=8, kills=1,820,
  flees=6,327, playerDeaths=55, groundDrops=2,934, pickups=3,289, crafts=143;
  eliteKills/apexKills/apexFlees/signatureDrops/signaturePickups/signatureCrafts
  were all 0 in this observation run.
- Balance remains observation-only; no balance tuning was made. Old-save
  migration remains deferred until pre-release save-format stabilization.
- `public/assets/**/*.png` and approved art manifests are unchanged relative to
  the audited input head. Human status remains exactly
  `NEEDS-HUMAN-PLAYTEST`.

Implementation commit `7294022f02a6f685e3fbab68d99d0bae45250c5a` passed exact-head
GitHub Actions CI run #126 (`31710812342`) with `completed/success`. The
documentation closeout commit and its exact-head CI are recorded in the final
handoff after this report update is pushed.

## 10. Phase 4P-AF3 — Public Apex Defeat Lifecycle & Information-Boundary Closure

This section records AF3 against audited input head
`c98829e6fca0711ddbf8b22a81c6cf1aa0b139f9`. PR #23 remains open, Draft, based
on `main`, and unmerged. No Phase 4Q work, new content, balance tuning, or old
save migration was added.

### Blocker and public lifecycle contract

- Root cause: `currentWorldSourcesForItem()` / `apexSourceZones()` previously
  used remote `wildEnemies[uid].status` and hidden `WILD_DEFEATED` events to
  decide that a named Apex was defeated. A remote NPC could therefore lose a
  future source without receiving public evidence.
- Added `APEX_DEFEATED` as the minimal public lifecycle event for `tier=apex`.
  Its metadata is exactly `{ wildDefId, tier: 'apex', zoneId }`; actorId is
  null, and it contains no UID, HP, damage, pending intent, ability charges,
  inventory, loot, or ground-item identity.
- Canonical Apex order is `WILD_DEFEATED → APEX_DEFEATED →
  WILD_DROP_CREATED`. The existing `WILD_DEFEATED` event remains combat-local;
  Common and Elite defeats never emit `APEX_DEFEATED`.
- Runtime source semantics now depend only on public lifecycle evidence:
  unspawned Apex → eligible open zones; spawned but publicly unresolved Apex →
  actual public spawn zone; restricted spawn zone → no current route;
  `APEX_DEFEATED` → no future source. Static `worldSourcesForItem()` remains
  provenance-only and unchanged in meaning.

### Planner, UI, and validation evidence

- NPC planning paths no longer read remote Apex status, UID state, hidden
  `WILD_DEFEATED`, ground items, or other actors' inventories. They may use
  the NPC's own plan/inventory and public `APEX_SPAWNED` / `APEX_DEFEATED`
  lifecycle facts.
- The AF2 autonomous fixture no longer assigns `planRecommendedZoneId`
  directly; it calls the production `refreshNpcPlanRecommendation()` helper
  during setup, then drives the route with `runNpcTurn()` only.
- Default EventLog includes `APEX_DEFEATED` but continues to hide remote
  `WILD_DEFEATED`; the public message names only the threat and public zone.
- Current-schema save validation accepts `APEX_DEFEATED` and checks Apex
  definition, spawned schedule, matching public zone, defeated instance
  consistency, exact public metadata, and absence of hidden fields. Historical
  save migration remains deferred.
- `tests/phase4pAf3Acceptance.test.ts` contains 6 tests: hidden runtime status,
  hidden `WILD_DEFEATED`, public source closure, canonical exact-once lifecycle
  and drop order, Common/Elite non-broadcasting, and EventLog projection.
  The four Phase 4P focused suites pass 27/27; the additional EventLog test
  suite also passes 3/3.

### AF3 gates

- Full suite: 105 files / 1,620 tests PASS. Typecheck, build, save audit,
  dependency audit, Art validation, browser/repository security scans, browser
  smoke, and both production dependency audits pass.
- Save audit: 109/109 malformed cases rejected, control accepted, construction
  failures 0.
- Dependency audit: 107 files scanned; maximum core/data file is
  `src/core/npcDecide.ts` at 500 lines; R1/R2/R3/R4 are all 0.
- Art/security: offline doctor 36 tasks PASS; published manifest and Phase 4A
  audit PASS; browser scan 243 files PASS; repository scan 971 tracked files
  PASS. No production PNG or art manifest bytes changed relative to the audited
  input head.
- Networked `npm audit --omit=dev` and offline fallback both report 0
  vulnerabilities.
- Exact regression command:
  `npm run simulate -- --games 500 --seed-prefix PHASE4P-AF3 --regression --output reports/phase4p-regression.json`
  passed with requested=actual=500, trustworthyRate=100%,
  `regressionGate=true`, and `engineHealthy=true`. Outcome counts were 21 won,
  416 lost, 63 draw, 0 timeout. All hard health counters were 0, including
  duplicate Apex spawn and invalid Apex spawn zone. PVE observations were
  encounters=7,560, eliteEncounters=160, apexSpawned=340, apexEncounters=12,
  kills=1,758, flees=5,959, playerDeaths=46, groundDrops=2,856,
  pickups=3,220, crafts=112; Apex kills and signature crafts were 0 in this
  observation run. Balance remains observation-only.

Implementation commit `24818beab36103f38c02ad100c4e56fac1f3f437` passed exact-head
GitHub Actions CI run #128 (`31736842842`) with `completed/success`. The
documentation closeout head and its exact-head CI are recorded after pushing
the docs-only commit.
