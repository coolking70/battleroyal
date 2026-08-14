# Handoff to Auditor — Phase 4R-AF1

## Status

- Status: **READY FOR INDEPENDENT RE-AUDIT**
- Human status: **NEEDS-HUMAN-PLAYTEST**
- Repository: `coolking70/battleroyal`
- Branch: `agent/phase4r-access-chains-exploration`
- PR: [#25](https://github.com/coolking70/battleroyal/pull/25)
- PR state: **OPEN / DRAFT / UNMERGED**
- Base main: `43199fa173db0faa751bb9b8ffe213be6bcfac22`
- Previous rejected head: `26f2e46ac38ac4015fb1ea5b7e3c8589c77bc0ac`
- Final AF1 head: recorded after the AF1 commit is created

## Root causes closed

1. Remote access resolution previously observed hidden landmark runtime state.
2. The NPC maintenance restore could resurrect an objective after a formal
   recipe/Apex replacement.
3. Objective saves checked IDs but not graph/phase semantics.
4. Engineer's historical repair-tool bypass was missing from the shared
   requirement path.

## Production fix surface

- `src/core/accessChains.ts`: local authoritative runtime boundary, static
  remote resolver, actor-scoped item/source handling, central Engineer repair
  compatibility.
- `src/core/npcObjectiveLifecycle.ts`: COMMIT/PRESERVE/ADVANCE/COMPLETE/
  INVALIDATE boundary for ordinary maintenance versus formal replacement.
- `src/core/npcAi.ts`: narrow lifecycle integration; formal Apex replacement
  is not restored.
- `src/core/saveValidation/explorationObjective.ts`: static access graph,
  source provenance, and phase-semantic save validation.
- `tests/phase4rAf1Acceptance.test.ts`: AF1-1 through AF1-9 acceptance suite.

## Acceptance matrix

| Test | Result |
| --- | --- |
| AF1-1 remote Lab disabled/repaired equivalence | PASS |
| AF1-2 remote Factory locked/unlocked equivalence | PASS |
| AF1-3 remote charges equivalence; local charge authority | PASS |
| AF1-4 remote lastUsedAt/private event equivalence | PASS |
| AF1-5 retained remote exhaustion isolation | PASS |
| AF1-6 access objective invalidated by formal Apex goal replacement | PASS |
| AF1-7 ordinary refresh preserves committed target/commit time | PASS |
| AF1-8 semantically unrelated objective save rejected | PASS |
| AF1-9 Engineer legacy repair compatibility and unlock boundary | PASS |

## Verification

- Full suite: **117 files / 1,693 tests PASS**.
- Typecheck: PASS.
- Build: PASS; only the existing Vite chunk-size advisory remains.
- Save audit: **109/109** malformed rejected; **0** construction failures.
- Dependency audit: **119 files**, R1/R2/R3/R4 = **0**, max core/data file =
  **500 lines**.
- Art doctor, manifest validation, Phase 4A audit, browser/repository secret
  scans: PASS.
- Art generate dry-run: **36 tasks / 0 API calls / 0 bytes**.
- `npm audit --omit=dev`: **0 vulnerabilities**.

## Regression

Required command:

```text
npm run simulate -- --games 500 --seed-prefix PHASE4R-AF1 --regression --output reports/phase4r-af1-regression.json
```

Result: **500/500**, trustworthy **100%**, regression and engine-health PASS;
all hard counters are zero: timeout, illegalState, hardLimitReached,
terminalWithoutWinner, invalidVictoryTuple, duplicateApexSpawn,
invalidApexSpawnZone. Balance ratio 2.77 and zero-win `trapper` are recorded
as observations only.

## Exact-head CI

- Final AF1 head: recorded after the AF1 commit is created.
- Exact-head CI: recorded after pushing that head; the PR must remain Draft and
  unmerged.

## Human-only playtest

Automated evidence does not replace the visible playtest. Verify Factory,
Residential, Underground, Laboratory, NPC route/fallback behavior, zero
stamina, terminal freeze, remote hidden-state non-disclosure, and Engineer
repair versus unlock semantics using `PHASE4R_HUMAN_PLAYTEST.md`.

## Known observations

- Balance is observation-only; no tuning was performed.
- Old-save migration remains deferred until pre-release save-format
  stabilization.
- Art generation was dry-run only; no provider call, PNG generation, or
  manifest promotion occurred.
