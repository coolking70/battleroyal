# Phase 4Q Report — Zone Landmarks, Facilities & Exploration Depth

1. PR number / URL: Draft PR #24 — https://github.com/coolking70/battleroyal/pull/24
2. PR status: Open, Draft, and unmerged.
3. Base SHA: `eeb0dce16827dca24fabdcea0f0f50a31001bffd`.
4. Branch: `agent/phase4q-zone-landmarks-facilities`.
5. Final implementation head SHA: `6e5fdba03fdc8564b4dfaa43971e37533a6de58f`.
6. Commits: `6e5fdba` — `feat: add Phase 4Q zone landmarks and facilities`; the later report-only closure commit does not change implementation files.
7. Landmark count: 24 static definitions.
8. Per-zone count: school 2; hospital 2; residential 2; factory 2; forest 2; lab 2; commercial 2; station 2; park 2; warehouse 2; construction 2; underground 2.
9. Facility count: 9 landmark definitions expose finite facility interactions.
10. Risk-bearing count: 18 definitions have non-zero risk damage or encounter chance at/above 0.25.
11. Synergy count: 4 explicit gameplay synergies are covered: Engineer facility cost reduction, Medic treatment bonus, Survivor field-prep stamina bonus, and service-room repair unlocking the sealed passage.
12. Runtime model: static `LandmarkDef` data is separate from persisted `LandmarkState`; runtime state includes landmarkId, zoneId, discovered, remainingSearches, maxSearches, charges, maxCharges, exhausted, disabled, repaired, activated, locked, lastUsedAt, and finite `ItemStack[]` loot.
13. Finite loot: `initializeLandmarks()` pre-generates real ItemStacks once per game; searches remove those exact stacks, and no search path creates infinite loot.
14. `SEARCH_LANDMARK`: formal targeted command with positive stamina/time cost, seeded weighted selection, finite depletion, Wild encounter risk, risk damage, pending-pickup handling, exhaustion events, and legal-action exposure.
15. Facility architecture: formal `INTERACT_LANDMARK` command with shared cost checks, requirements, charges, repair/unlock state, effect handlers, events, and actor-specific bounded modifiers.
16. Static source integration: `worldSourcesForItem()` exposes `landmark_loot` provenance with landmarkIds and zoneIds without reading runtime depletion.
17. Current depletion: `currentWorldSourcesForItem()` removes locked/disabled/exhausted/empty landmarks while preserving the static provenance list.
18. Craft Guide: CraftingCodex displays landmark names as public sources; it does not reveal hidden exact loot before a search.
19. NPC planning: `npcLandmarkPlan.ts` scores only the NPC’s own recipe gaps and current public sources, then stores a recommended landmark and route zone.
20. NPC route evidence: `tests/phase4qNpcLandmarks.test.ts` verifies `refreshNpcPlanRecommendation()` → `runNpcTurn()` → formal `search_landmark`, then recomputes a fallback after depletion.
21. NPC fallback: failed/stale landmark routing refreshes the recommendation; exhausted landmarks are excluded from current sources and are not selected again.
22. Player route: `tests/phase4qAutoPlayer.test.ts` verifies `SET_CRAFT_GOAL` plus MOVE → `SEARCH_LANDMARK` through the formal legal-command loop with no illegal commands.
23. Facility route: `tests/phase4qFacilities.test.ts` verifies operating-room treatment charges and service-room repair/unlock with a consumed wire and positive stamina cost.
24. Information boundary: `LandmarkPanel` renders only current-zone landmark names, coarse status, remaining searches, charges, and risk/requirement text; hidden exact loot is not previewed.
25. Apex regression: no Apex lifecycle or Wild population rule was changed; the Phase 4P-AF3 suites remain in the full run, and the Phase 4Q 500-game health counters report duplicate Apex spawns 0 and invalid Apex zones 0.
26. Save schema: current-schema saves require all 24 landmark runtime entries, validate identity/zone/state invariants, validate finite loot stacks, event landmark references, NPC recommendations, and landmark metrics.
27. Malformed cases: `tests/phase4qSaveValidation.test.ts` covers 12 malformed landmark cases plus a valid control; each malformed case is rejected.
28. Save audit exact: `npm run audit:save` reports 109/109 malformed cases rejected, 109/109 passed, 0 construction failures, and the normal control accepted.
29. Conservation: hidden landmark loot is included in UID/item/count integrity scans and save consistency checks; rejected/pending pickups retain the real ItemStack.
30. Determinism: same seed produces equal landmark runtime state and UID sequence; targeted search uses the game’s seeded RNG only.
31. Focused tests/counts: 7 Phase 4Q test files, 23 tests passed.
32. Full test file count: 112 files.
33. Full test count: 1,643 tests passed.
34. Dependency: `npm run audit:deps` passed; R1=0, R2=0, R3=0, R4=0.
35. Maximum file: audited core/data maximum is 500 lines (`src/core/commandHandlers.ts`); `src/core/npcDecide.ts` is below the 500-line threshold used by the audit.
36. R1–R4: all zero.
37. 500-game regression: requested 500, actual 500, trustworthy 500/500, timeout 0, `regressionGate=true`, engine health true, with terminalWithoutWinner=0, invalidVictoryTuple=0, duplicateApexSpawn=0, and invalidApexSpawnZone=0. The generated artifact is `reports/phase4q-regression.json`.
38. Metrics: persisted landmarkSearches, landmarkExhaustions, facilityUses, facilityActivations, npcLandmarkSearches, landmarkWildEncounters, and landmarkItemsRecovered are updated through the shared runtime paths.
39. Typecheck: `npm run typecheck` passed.
40. Build: `npm run build` passed.
41. Art/security: art doctor, art validate, Phase 4A art audit, browser security scan, repository security scan, and `npm audit --omit=dev` passed; doctor reports only the existing missing `IMAGE_API_KEY` warning for generation configuration.
42. PNG unchanged: no PNG or approved art manifest was modified by Phase 4Q.
43. Balance statement: the regression’s existing observation-only character balance ratio is 6.5 versus threshold 2.5; this is recorded as a balance observation and not used as a Phase 4Q implementation claim.
44. Save migration statement: old-save migration remains deferred; current-schema saves are validated strictly and new games initialize all landmark state.
45. Human status: `NEEDS-HUMAN-PLAYTEST`.
46. Exact-head CI: run `31743004163` / job `94590739100`, head `6e5fdba03fdc8564b4dfaa43971e37533a6de58f`, completed with `success`.
47. Known issues: human visual/balance review is still required; the normal regression matrix does not intentionally force the representative Phase 4Q landmark route, which is covered by focused formal-command tests instead.

Phase 4Q implementation complete and ready for independent acceptance review.

## Phase 4Q-AF — Facility Unlock, Landmark Risk & Information-Boundary Closure

1. Audited input head: `8c9f25c781ca4ade629efbfbcf23ff232d452939`.
2. Root cause A: locked facilities were rejected before their own `requiresUnlock` interaction could satisfy the unlock route.
3. Fix A: only an interaction whose definition has `requiresUnlock=true` may execute while its facility is locked; all other locked interactions remain rejected.
4. Canonical unlock evidence: `warehouse_secure_storage` starts locked; `open_secure_storage` with one `field_kit` succeeds, consumes one positive-cost action and one charge, sets `locked=false` and `activated=true`, emits facility events, advances time, and makes subsequent `SEARCH_LANDMARK` legal. Missing-tool rejection is mutation-free, including for Engineer.
5. Save/load evidence: the unlocked runtime, reduced charge, consumed prerequisite, activation, and legal follow-up state survive current-schema serialize/load unchanged.
6. Root cause B: the global current-source resolver exposed remote landmark runtime such as exhaustion, hidden loot length, lock, disabled state, and last use to NPC planning.
7. Source contract: static provenance is defined by `worldSourcesForItem()`; public/current sources preserve remote landmarks as potential sources and only apply public zone restrictions; `currentWorldSourcesForActor()` applies coarse runtime filtering only to landmarks in the actor's current zone.
8. NPC information boundary: remote `exhausted`, `remainingSearches`, `loot.length`, `locked`, `disabled`, and `lastUsedAt` no longer alter an NPC's recommendation. Arrival in the landmark zone permits local observation and bounded refresh/replan.
9. Craft Guide boundary: remote views retain landmark provenance/name as a potential source and do not expose exact loot or hidden remote runtime; current-zone panels may show coarse local state.
10. Root cause C: lethal landmark risk could resolve death and still continue the search reward/event path.
11. Fatal-risk semantics: risk resolves before removing the candidate stack; if it kills the actor, the search records `fatal_risk`, emits no item-found/pickup/reward event, leaves the candidate hidden in landmark loot, clears pending pickup, and finishes the search with actor attribution where applicable.
12. Item conservation evidence: the lethal test proves one death, no recovered item, no resurrected dead inventory, unchanged `pendingPickup`, exactly-once hidden candidate UID, and `auditItemIntegrity(state).ok === true`.
13. Event ordering evidence: the fatal search records the search outcome after canonical death resolution and before any possible recovery path; `LANDMARK_EXHAUSTED` is actor-scoped and is not a default global broadcast.
14. Autonomous NPC route 1: production `runNpcTurn()` performs cross-zone MOVE, local SEARCH_LANDMARK, acquisition, and canonical craft/use without manual move/search calls or debug grants.
15. Autonomous NPC route 2: a secretly exhausted remote primary remains a potential source until arrival; the NPC then observes local exhaustion, refreshes its stale recommendation, selects a local alternate, completes SEARCH → acquire → craft, and avoids a repeated rejected-action loop.
16. Focused AF tests: 13 tests in `tests/phase4qAfAcceptanceFix.test.ts` passed.
17. Total Phase 4Q focused suite: 8 files / 36 tests passed, including landmark registry, facilities, sources, NPC route, AutoPlayer, save validation, and UI information boundaries.
18. Full regression: 113 test files / 1,656 tests passed; zero-stamina, item-integrity, terminal-freeze, Phase 4P-AF3, determinism, and legal-action suites remain included.
19. Save audit: `npm run audit:save` passed with 109/109 malformed cases rejected, 109/109 passed, and 0 construction failures.
20. Dependency audit: `npm run audit:deps` passed with R1=0, R2=0, R3=0, R4=0; maximum core/data file remains `src/core/commandHandlers.ts` at 500 lines.
21. PHASE4Q-AF 500 regression: requested=500, actual=500, trustworthy=500/500 (100%), regression gate PASS, engine health PASS, and all timeout/illegal/deadlock/livelock/stall/empty-legal-set/hard-limit/terminal-without-winner/invalid-victory/duplicate-Apex/invalid-Apex-zone counters are 0. Artifact: `reports/phase4q-af-regression.json` and `.md`.
22. Typecheck/build: `npm run typecheck` and `npm run build` passed; the build emitted only the existing bundle-size advisory.
23. Art/security: offline art doctor, art validation, Phase 4A provenance audit, art generation dry-run, browser secret scan, and tracked repository secret scan passed.
24. Production dependency audit: `npm audit --omit=dev` passed with 0 vulnerabilities.
25. Balance: `BALANCE OBSERVATION ONLY — BALANCE DEFERRED`.
26. Save migration: `DEFERRED UNTIL PRE-RELEASE SAVE FORMAT STABILIZATION`.
27. Human status: `NEEDS-HUMAN-PLAYTEST`.
28. Implementation commits: `64072ef` (`fix: close Phase 4Q acceptance gaps`) and `bf40516` (`fix: preserve legacy npc planning cadence`); the documentation closeout commit is the final branch head reported in the handoff after its exact-head CI completes.
29. No Phase 4R content, new landmarks/facilities, balance tuning, old-save migration, PNG changes, or merge was performed.

Phase 4Q-AF implementation complete and ready for independent acceptance review.

## Phase 4Q-AF2 — NPC Landmark Plan Integration & Autonomous Route Closure

1. Audited input head: `2e9b6be188d6e78c7cfedc115cbb96569df22415`.
2. Blocker: a fresh or formally replanned NPC recipe stored `planRecommendedLandmarkId = null`, so production `runNpcTurn()` did not establish a Landmark route.
3. Why the old AF-12 was insufficient: its fixture manually called `refreshNpcPlanRecommendation()` before entering the NPC loop, proving a persisted/manual route rather than fresh production plan integration.
4. Production fix: `planNpcGoal()` now commits recipe, normal zone recommendation, and one deterministic Landmark recommendation together through a focused helper after the recipe is selected.
5. Legacy cadence guarantee: ordinary turns do not rebuild recommendations merely because `planRecommendedLandmarkId` is null; recommendation generation is tied to plan/replan commit, with the existing local-stale lifecycle retained separately.
6. Route boundary: a remote ordinary landmark is promoted only when the actor's selected current zone is exhausted and the craft plan has no Wild-drop raw gap; the existing zone route remains authoritative otherwise.
7. Recipe-selection isolation: the Landmark candidate is computed only after `chooseNpcGoal()` has committed the recipe and cannot alter personality scoring or RNG consumption.
8. Null semantics: zone-loot-only, Wild-drop, objective, and Phase 4P Apex routes may legitimately persist a null Landmark recommendation without per-turn repair.
9. Apex protection: Phase 4P recipes continue to use the dedicated public Wild/Apex source planner and retain `planRecommendedLandmarkId = null`.
10. Fresh lifecycle: the new AF2 fixture starts with `plannedRecipeId = null`, both recommendations null, no target-zone arrival, and no manual planner/action/debug helper; the first `runNpcTurn()` creates the recipe and coherent Landmark/zone recommendation.
11. Autonomous route: repeated production `runNpcTurn()` calls complete `MOVE → SEARCH_LANDMARK → ITEM_FOUND/ITEM_PICKED → CRAFT → EQUIP` for the fresh ordinary route.
12. Replan lifecycle: a TTL-expired old recipe is replaced by a new formal plan and its new recommendation; the stale old Landmark is removed.
13. Determinism: identical fresh fixtures and seeds produce identical recipe, Landmark, zone, event ordering, inventory, and equipment state.
14. Remote boundary: a hidden exhausted remote Landmark does not change fresh recommendation output before arrival; local runtime is only consulted when the actor is in that zone.
15. Player-goal isolation: changing `state.craftGoalRecipeId` does not change the NPC's fresh recipe, Landmark recommendation, or zone recommendation.
16. Existing stale fallback: the local exhausted/invalid recommendation refresh remains in `runNpcTurn()` and AF-13 continues to cover arrival-local alternate-source behavior.
17. Focused evidence: AF2 focused coverage is `tests/phase4qAf2Acceptance.test.ts` with 8/8 passing; the legacy AF focused file remains 13/13 passing.
18. Total Phase 4Q focused evidence: 11 files / 70 tests passed, including AF2, AF, Phase 4P Apex, NPC planning, source boundary, and AutoPlayer suites.
19. Full suite: 114 test files / 1,664 tests passed.
20. Save audit exact: `npm run audit:save` accepted the normal control and rejected 109/109 malformed cases with 0 construction failures.
21. Dependency audit: `npm run audit:deps` passed with R1=0, R2=0, R3=0, R4=0; maximum audited core/data file is `src/core/commandHandlers.ts` at 500 lines and `src/core/npcGoalPlan.ts` is 498 lines.
22. AF2 500-game regression: requestedTotalGames=500, actualTotalGames=500, trustworthyRate=100%, regressionGate=true, engineHealthy=true; timeout, illegalState, hardLimitReached, terminalWithoutWinner, invalidVictoryTuple, duplicateApexSpawn, and invalidApexSpawnZone are all 0. Artifact: `reports/phase4q-af2-regression.json` and `.md`.
23. Typecheck: `npm run typecheck` passed.
24. Build: `npm run build` passed with only the existing bundle-size advisory.
25. Art/security: offline art doctor, art validation, Phase 4A art audit, browser secret scan, tracked repository secret scan, and art generation dry-run passed.
26. Production dependency audit: `npm audit --omit=dev` found 0 vulnerabilities.
27. PNG/art scope: no production PNG, approved PNG, art manifest, or published asset was changed.
28. Balance: `BALANCE OBSERVATION ONLY — BALANCE DEFERRED`.
29. Save migration: `DEFERRED UNTIL PRE-RELEASE SAVE FORMAT STABILIZATION`.
30. Human status: `NEEDS-HUMAN-PLAYTEST`; implementation is ready for independent acceptance review and is not marked accepted.
31. Implementation commit: `ddfbef53b7d5ea321d9195fe4d3ccc14ba13c3fe` (`fix: integrate NPC landmark plans on commit`). Documentation closeout is the final follow-up commit on this same PR branch.
32. CI handoff: final exact-head GitHub Actions status will be checked after the documentation closeout push; no earlier CI run is reused as AF2 final evidence.
33. Known issues: the 500-game role balance ratio and zero-win role remain observation-only; independent human playtest is still required; no Phase 4R content, new landmarks/facilities, balance tuning, old-save migration, or merge was performed.

Phase 4Q-AF2 implementation complete and ready for independent acceptance review.

## Phase 4Q-AF3 — Source-Driven Landmark Recommendation Closure

1. Audited input head: `c97f177a4b146c361e5a9d876b8a68f1174b1ab6`; base SHA remains `eeb0dce16827dca24fabdcea0f0f50a31001bffd`.
2. Blocker root cause: AF2 used current-zone loot exhaustion as a legacy cadence proxy for Landmark promotion, so a non-exhausted NPC plan retained a null targeted source.
3. Fix: `currentZoneIsExhausted` is removed from Landmark eligibility. `src/core/npcPlanRecommendation.ts` now commits route facets from the selected recipe, while `src/core/npcLandmarkPlan.ts` resolves the next missing raw gap through actor-safe current public sources.
4. Source-driven policy: selected recipe → actual missing raw gap → public/current source projection; a Landmark is committed only for a missing target raw gap with a valid actor-safe Landmark source, and remote hidden runtime is never probed.
5. Special-route priority remains Phase 4P Apex/signature, objective-specific, Wild-authoritative target gap, ordinary Landmark targeted source, then generic zone source/fallback. Apex recipes and objective outputs retain dedicated/null Landmark semantics.
6. Mixed-source proof: an unrelated later Wild gap no longer globally suppresses a Landmark candidate for the current target gap; a Wild source on the selected target gap still owns that route.
7. Determinism/cadence: recommendation scoring and raw-gap expansion consume no RNG. Recipe selection remains the only planner RNG boundary for random personality.
8. Fresh non-exhausted evidence: AF3-1 starts with `plannedRecipeId=null`, a non-empty warehouse, `supply=1`, and an active local-landmark boundary; `runNpcTurn()` commits `r_composite_bow_upgrade`, `construction_tool_container`, and `construction` while the origin remains non-exhausted.
9. Exhausted/non-exhausted equivalence: AF3-2 changes only the origin's ordinary loot depletion and obtains the same recipe/Landmark/zone recommendation.
10. Autonomous evidence: AF3-3 uses only repeated `runNpcTurn()` calls and observes `CHARACTER_MOVED → ITEM_FOUND/ITEM_PICKED → LANDMARK_SEARCHED → ITEM_CRAFTED → ITEM_EQUIPPED`, with no DEBUG events.
11. TTL replan: AF3-4 replaces the stale `forest_deep_grove` recommendation from a non-exhausted origin with the newly committed construction Landmark route.
12. Information boundary: AF3-5 confirms remote hidden Landmark depletion does not alter the pre-arrival recommendation; local runtime remains actor-scoped.
13. Mixed-source and null evidence: AF3-6 covers Wild-plus-Landmark raw gaps; AF3-7 protects the Phase 4P Apex null route; AF3-8 keeps a legitimate null route stable on the next ordinary turn. Player craft-goal isolation remains covered by AF2-8.
14. Focused tests: AF3 `8/8`, legacy AF `13/13`, and AF2 `8/8`; the expanded Phase 4Q/P focused set is `12 files / 78 tests` when the existing Phase 4P and Landmark focused files are included.
15. Full-suite status at this implementation point: `115 files / 1,672 tests` executed; the AF3 route change exposes six legacy balance-sensitive AutoPlayer assertions that still assume the pre-AF3 exhaustion cadence. This is recorded as a known regression to resolve before acceptance; no balance numbers were tuned.
16. Save audit exact: `npm run audit:save` accepted the control and rejected `109/109` malformed cases with `0` construction failures.
17. Dependency audit: `115` files scanned; `R1=0`, `R2=0`, `R3=0`, `R4=0`; maximum core/data file remains `src/core/commandHandlers.ts` at `500` lines and `src/core/npcGoalPlan.ts` is `426` lines.
18. PHASE4Q-AF3 regression: requested `500`, actual `500`, trustworthy rate `100%`, regression gate PASS, engine health PASS; timeout, illegal state, hard limit, terminal-without-winner, invalid-victory-tuple, duplicate-Apex-spawn, and invalid-Apex-zone counters are all `0`. Artifact: `reports/phase4q-af3-regression.json` and `.md`.
19. Typecheck and build passed. Art doctor offline, art validation, Phase 4A art audit, browser/repository security scans, and dry-run generation passed. `npm audit --omit=dev` reports `0 vulnerabilities`.
20. No production PNG, approved art manifest, save schema, Landmark, Facility, or Phase 4R content changed. Balance remains `BALANCE OBSERVATION ONLY — BALANCE DEFERRED`; old-save migration remains `DEFERRED UNTIL PRE-RELEASE SAVE FORMAT STABILIZATION`.
21. Human status remains exactly `NEEDS-HUMAN-PLAYTEST`; this closeout is not an acceptance or merge.
