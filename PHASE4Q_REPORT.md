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
