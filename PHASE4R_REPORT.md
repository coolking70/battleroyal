# Phase 4R — Local Access Chains & Dynamic Exploration Objectives

## 1. Handoff status

- Status: **READY FOR INDEPENDENT AUDIT**
- Human status: **NEEDS-HUMAN-PLAYTEST**
- Base SHA: `43199fa173db0faa751bb9b8ffe213be6bcfac22` (Phase 4Q merged main)
- Branch: `agent/phase4r-access-chains-exploration`
- Draft PR: [#25](https://github.com/coolking70/battleroyal/pull/25)
- Merge status: **OPEN / DRAFT / UNMERGED**
- Balance policy: **BALANCE OBSERVATION ONLY — BALANCE DEFERRED**
- Old-save migration: **DEFERRED UNTIL PRE-RELEASE SAVE FORMAT STABILIZATION**

This phase extends the Phase 4Q Landmark, Facility, source-projection, formal
action, NPC planning, and save-validation architecture. It does not add zones,
does not add a parallel quest system, and does not change production PNGs.

## 2. Data-driven access model

`LandmarkAccessDef` and `AccessRequirement` express item/tool and
landmark-state prerequisites. `FacilityInteractionDef` now carries an exact
required quantity and an explicit consume/non-consume rule. Runtime access is
resolved centrally by `src/core/accessChains.ts`; no landmark-specific unlock
forest was added to the action handlers.

The resolver produces one deterministic next formal step (`SEARCH_LANDMARK` or
`INTERACT_LANDMARK`), a prerequisite phase, a public reason, and the next zone
along a stable BFS route. Relation-only prerequisites emit one
`LANDMARK_UNLOCKED` event when the connected runtime state becomes satisfied.
The transition is finite, replayable, and persisted in the landmark runtime.

## 3. Four playable local chains

| Chain | Dependency | Formal route | Result |
| --- | --- | --- | --- |
| Factory | facility activation → landmark state | `INTERACT_LANDMARK factory_machine_shop` → `LANDMARK_UNLOCKED` → `SEARCH_LANDMARK factory_assembly_line` | finite metal/wire/iron source opens |
| Residential | search/discovery → landmark state | `SEARCH_LANDMARK residential_basement_storage` → unlock → `SEARCH_LANDMARK residential_apartment_block` | apartment source opens |
| Underground | consumable repair material | exact wire quantity → `INTERACT_LANDMARK underground_service_room` → unlock → search sealed passage | one wire unit consumed; passage opens |
| Laboratory | non-consumable tool prerequisite | field kit retained → `INTERACT_LANDMARK lab_analysis_terminal` → repair → search terminal | analysis source opens without consuming the tool |

The existing underground service-room → sealed-passage relation is retained,
but now uses the shared access model and transition event.

## 4. NPC and information-boundary behavior

- `ExplorationObjective` is a small persisted actor-scoped objective containing
  target, next landmark, phase, item/prerequisite references, reason, and
  commit time.
- Explicit access-chain commitments survive unrelated recipe-plan refreshes;
  ordinary turns do not replan merely because a recommendation is null.
- NPC decisions use `runNpcTurn()` and the existing actor action path for MOVE,
  SEARCH, INTERACT, CRAFT, PICKUP, and EQUIP. Apex/Wild decisions remain ahead
  of generic access objectives.
- Remote hidden depletion, loot length, charges, lock/disabled runtime, and
  last-use state are not probed. The NPC can use static public topology and
  coarse public hints; local runtime is consulted only on arrival.
- A blocked remote route remains a legal persisted objective with REST/MOVE
  fallback, rather than causing per-turn planner churn.

## 5. Conservation, red lines, and validation

- Consumable requirements consume exact quantities from the original UID stack;
  non-consumable tools retain the same UID and count.
- Facility and search interactions retain positive stamina/time costs and reject
  zero-stamina benefit actions without mutation.
- Terminal states reject further search, interaction, unlock, repair, activate,
  and objective mutations without advancing time.
- Current-schema saves validate access-state prerequisites, unlock event
  metadata, all objective references and phases, timestamps, and impossible
  unlocked states. Save migration remains deferred.
- No `Math.random()` was introduced; deterministic routes use existing seeded
  state and stable ordering.

## 6. Verification evidence

- `npm ci`: PASS; 126 packages installed, 0 vulnerabilities.
- `npm run typecheck`: PASS.
- `npm test`: PASS — 116 test files / 1,684 tests.
- Phase 4R focused suite: PASS — 12/12 tests in
  `tests/phase4rAccessChains.test.ts`.
- Phase 4Q/AF focused compatibility set: PASS — 55/55 tests in the run with
  Phase 4R (including facilities, save validation, NPC landmarks, AF, AF2,
  and AF3 suites).
- `npm run build`: PASS; only the existing Vite large-chunk advisory remains.
- `npm run audit:save`: PASS — 109/109 malformed cases rejected, 0
  construction failures, normal control accepted.
- `npm run audit:deps`: PASS — 118 files, R1=0, R2=0, R3=0, R4=0; maximum
  core/data file is 500 lines.
- `npm run art:doctor -- --offline`: PASS.
- `npm run art:validate`: PASS.
- `npm run art:audit:phase4a`: PASS.
- Browser and repository secret scans: PASS — 255 browser files and 1,002
  tracked files scanned.
- `npm run art:generate -- --dry-run`: PASS — 36 tasks, 0 API calls, 0 bytes.
- `npm audit --omit=dev`: PASS — 0 vulnerabilities.

### 500-game regression

Command:

```text
npm run simulate -- --games 500 --seed-prefix PHASE4R --regression --output reports/phase4r-regression.json
```

Evidence: `reports/phase4r-regression.json` and
`reports/phase4r-regression.md`.

- requestedTotalGames = 500; actualTotalGames = 500
- trustworthy rate = 100.0%
- regression gate = PASS; engine health = PASS
- timeout = 0; illegalState = 0; hardLimitReached = 0
- terminalWithoutWinner = 0; invalidVictoryTuple = 0
- duplicateApexSpawn = 0; invalidApexSpawnZone = 0
- Character balance ratio is 4.33 with zero-win observation roles
  `fighter` and `hunter`; this remains observation-only and does not fail the
  regression gate.

## 8. GitHub exact-head evidence

- Implementation commit: `70cb9ce4fc678424b5bb16698df764ec174b874a`
  (`feat: add local access chains and exploration objectives`).
- Exact implementation-head CI: run `31802981564` / job `94775105902`
  (GitHub Actions #140), completed with `success`.
- A documentation-only closeout commit follows this report update. Its own
  exact-head CI will be checked before handoff; no merge or ready-for-review
  transition will be performed.

## 9. Audit boundary

This branch is intentionally not merged and is not declared accepted. The
remaining human gate is the manual playtest checklist in
`PHASE4R_HUMAN_PLAYTEST.md`. Independent Auditor review decides acceptance.
