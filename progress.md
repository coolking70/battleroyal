Original prompt: 完成附件《区域式大逃杀网页游戏——Phase 3A-2 开发提示词》要求的 Pre-Phase4 Final Closure。

## Phase 3A-2 progress

- Baseline commit: `bf6c73fe6bbd65dc84083c6cf9a2595805496315`
- Current baseline: `combat.ts` 398 lines; `npm run audit:deps` PASS, so the historical combat line-count blocker is already closed.
- Baseline tests: 527 tests collected; UI smoke tests fail under the current jsdom configuration because `localStorage` has no origin-backed implementation.
- Baseline 100-game simulation ran but is too small for final balance/event gates; final 3000-game simulation remains required.

## Completed

- NPC survival skills now precede low-stamina REST; charged `field_craft` takes the next legal CRAFT even at zero stamina.
- `reconInitiative` is consumed after exactly one target NPC `runNpcTurn()` opportunity, including non-attack actions.
- Bootstrap now loads and validates `/assets/manifest.json`; failure is non-fatal.
- `VisualImage` implements official → bundled SVG → emoji fallback and is wired into character, zone, event, and item UI.
- Added closure tests and reached 546 passing tests.
- Final evidence: 3000 games PASS, runtime npm audit PASS, dev audit has the known Vite/esbuild/Vitest vulnerabilities recorded honestly.
- Final artifacts: `PHASE3A2_REPORT.md`, `PHASE3A2_AUDIT_FIXES.md`, `reports/phase3a2-command-results.txt`, `reports/phase3a2-final-balance.*`, and `reports/phase3a2-scripted-playthroughs.md`.

## TODO / handoff

- Remote GitHub Actions green status was not independently available; workflow configuration is recorded in the final report.
- Phase 4 AI art generation and asset production remain intentionally out of scope.

## Phase 4 progress (2026-08-08)

- Original Phase 4 prompt: build a secure, repeatable AI art task → prompt → hash → cache → candidate → validation → human review → publish → manifest pipeline, without exposing the provider key to the browser.
- Phase 3A-2 was fast-forwarded into local `main`; branch `agent/phase4-art-pipeline` was created from `9dbdc85c0fbef3ee66250860f836c0ac94abca28`.
- Fixed Medic stale DoT trigger, VisualImage cross-resource stage reset, and Phase 3A-2 report commit wording.
- Added 32 task definitions, style profiles, four character design sheets, API adapter, structured retry/error handling, SHA-256 cache, candidate validator, review CLI, atomic approved-only publisher, art-version metadata, doctor/list/prompt/generate/validate/security commands, CI offline checks, and runtime source/hash debug information.
- Added Phase 4 tests; current full suite is 42 files / 584 tests.
- Round A real generation was attempted once for `character/scout/portrait` with the locally injected user-provided credential. The provider returned HTTP 401 invalid token; the remaining three calls were intentionally not made. Candidates and approvals remain 0.

### Phase 4 handoff

- Provide a valid/active provider credential before rerunning Round A. Do not commit it; run the four tasks individually through `npm run art:generate -- --task ...`.
- Review each generated candidate manually. Only then run `art:approve` and `art:publish`.
- Keep `generated != approved`; technical pipeline PASS and art-production PASS are separate states.

## Phase 4A-0 progress (2026-08-08)

- Read the Phase 4A-0 prompt and recorded the pre-change baseline in `PHASE4A0_BASELINE.md`: 584 tests, core frozen, previous Agnes Scout attempt blocked by HTTP 401 invalid token.
- Split the Agnes provider adapter, implemented the minimal request body (`model`, `prompt`, `size`, `ratio`, `return_base64`), internal negative-prompt hashing, actual-byte dimension inspection, category resolution floors, cache integrity checks, review supersede, provenance, atomic publish rollback, idempotence, report separation, bounded concurrency, and tracked-repository secret scan.
- Added `PHASE4_PROVIDER_SPEC.md`, `PHASE4_REVIEW_AND_PUBLISH_SPEC.md`, `PHASE4A0_AUDIT_FIXES.md`, `PHASE4A0_REPORT.md`, and Phase 4A-0 reports.
- Verification: 610 tests PASS, typecheck PASS, build PASS, save/dependency audits PASS, offline doctor PASS, published manifest validation PASS, browser/repository secret scans PASS, dry-run 32 tasks / 0 API calls PASS.
- Browser regression smoke rendered menu and gameplay screenshots with the fallback art path; `render_game_to_text` reported `mode=playing`, Scout in Hospital, time 0, and no console-error artifact.
- Real provider execution remains blocked by the known 401 credential result. No candidate, approval, or AI asset publication was created.

## Phase 4A-1 progress (2026-08-08)

- Reconciled the live Scout state from the preceding confirmation: one API-origin pending candidate plus cache-verification duplicates; reused the API-origin candidate instead of consuming another live call for the same task.
- Added `.env.example`-aware repository secret scanning, provider error redaction, reverse Manifest→provenance checks with the legacy bandage SVG allowlist, `--regression` simulation mode, actual-byte MIME normalization, and `art:review-export -- --round A`.
- Reached 625 passing tests. Offline evidence is in `reports/phase4a1-command-results.txt`; the 500-game regression reports engine health PASS with character balance observation only.
- Live Round A succeeded in order: Scout (existing live evidence), School, Bandage, Blackout. Four unique tasks have API-origin candidates with validation PASS and reviewStatus=pending. Cache verification reports `apiCalls=0`.
- Review package exported to `output/art-review/phase4a1-round-a/`; decisions and notes remain blank. `art/approved-assets.json` remains empty and the formal Manifest was not changed.
- Remote GitHub Actions run `31265918529` completed with `verify` PASS; Draft PR #2 remains open and unmerged.

## Phase 4A-1.1 progress (2026-08-09)

- Rebuilt prompt architecture as v2: content-free Render Style, category-isolated styles, character-only design sheets, explicit hard constraints, separate category negatives, and versioned prompt reports.
- Added 18 structural prompt/review-export tests; full suite reached 643 tests PASS.
- Strict Round A v2 executed once per task in order: Scout, School, Bandage, Blackout. All four were API-origin, `apiCalls=1`, `cacheHits=0`, automatic validation PASS, and review pending.
- Exported `output/art-review/phase4a11-round-a2/` with exact report-selected candidate hashes, `-v2` filenames, blank Decision/Notes, and v1 issue reminders. v1 candidates and review package remain preserved.
- No asset was approved or published; the formal Manifest and `art/approved-assets.json` remain unchanged. Round B is waiting for human review.
- GitHub Actions run `31267622557` completed with `verify` PASS; Draft PR #2 remains open and unmerged.

## Phase 4A-1.2 progress (2026-08-09)

- Targeted Scout and Blackout only: Scout task revision 2 now uses an unarmed civilian observer identity with visible empty hands/back/shoulders; Blackout task revision 2 now uses a fully indoor commercial corridor immediately after a power failure.
- Added targeted positive-semantic and hard-constraint compliance tests; full suite reached 652 tests PASS. Review export now accepts explicit `--output` and `--suffix` values.
- Strict Round A3 completed in order with exactly two API calls: Scout v3 then Blackout v3. Both are new hashes, `source=api`, `apiCalls=1`, `cacheHits=0`, automatic validation PASS, review pending.
- Exported `output/art-review/phase4a12-round-a3/` with exact report-selected candidates, `-v3` filenames, human checklists, and blank Decision/Notes. Bandage/School, Round B, approval, publish, and Manifest changes were not performed.
- Final implementation commit `add4b83` was pushed and GitHub Actions run `31268805389` completed with `verify` PASS; the Draft PR remains open.

## Phase 4A-1.3 progress (2026-08-09)

- Frozen Prompt Architecture v2 and reframed only the provider-facing Scout identity as `civilian urban observer`; internal task ID remains unchanged and is excluded from the provider prompt body.
- Locked Blackout to a windowless underground commercial corridor with explicit dark-light, black-screen, off-indicator, no-window, and sparse-red-emergency-lamp constraints.
- Added A4 semantic/provider-prompt tests; full suite reached 657 tests PASS. Bandage and School remained frozen.
- Strict Round A4 completed Scout v4 then Blackout v4 with exactly two API calls. Both are new hashes, `source=api`, `apiCalls=1`, `cacheHits=0`, automatic validation PASS, review pending.
- Exported `output/art-review/phase4a13-round-a4/` with exact report-selected candidates, `-v4` filenames, human checklists, and blank Decision/Notes. Round B, approval, publish, and Manifest changes were not performed.
- Final implementation commit `4a39c69` was pushed and GitHub Actions run `31270069170` completed with `verify` PASS; the Draft PR remains open.

## Phase 4A-4.3 progress (2026-08-09)

- Baseline was `ebff421` with 28 formal AI assets. Track A approved and published the exact Fighter, Engineer and Medic Injured candidates, reaching 31 formal assets; all four Injured variants are official.
- Added the isolated `character/scout/combat` canary path with descriptor-locked text-only dynamic-equipment-neutral prompting, forbidden combat/equipment token auditing, exact-one-call enforcement and no auto-approval/publish behavior.
- One real Scout Combat API call succeeded: candidate/content hash `80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1`, actual 864×1152 PNG, validation PASS, review pending. The candidate is exported for human review and is not in the formal Manifest. The review package records the objective binocular observation for human judgment; no reroll occurred.
- Full suite reached 1162 tests PASS. Typecheck, build, save/dependency/art/Manifest/secret audits, 500-game regression and production dependency audit passed. Browser smoke rendered menu and gameplay without a browser console-error artifact.
- Next action is human review of Scout Combat. Only an explicit approval followed by publish may promote it; no other Combat or Rain generation is authorized by this phase.

## Phase 4A-4.3.1 progress (2026-08-09)

- Baseline `232d9c0` had 31 formal AI assets and the previous Scout Combat candidate `80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1` pending. It was formally rejected for the human-confirmed duplicated binocular prop.
- Revised only `character/scout/combat` from revision 2 to 3 using a positive single-prop Object State Transition: one pair, the same pair, one neck strap, raised near the face, chest beneath it clear. Added contract/audit/provider-payload/hash-change tests; no other Combat prompt was changed.
- Completed the API-before gate: 1167 tests PASS, typecheck/build/save/dependency/art/Manifest/security audits PASS, 500-game regression PASS, production dependency audit 0 vulnerabilities.
- Generated exactly once with the new prompt: new hash `752052e828e7708ebc010457bb9eca11e718a7ec91e18e63dd8b133ad11f6159`, API=1, cache=0, validation PASS, review pending. Visual review found the duplicate binocular prop remained; this is recorded as Art Strategy FAIL / Technical Execution PASS, with no reroll and no publication.
- Review package: `output/art-review/phase4a431-scout-combat/`. If rejected again, do not generate Scout Combat v3/v4; use posture-only recovery and wait for the next explicit phase.

## Phase 4A-4.3.2 progress (2026-08-09)

- Baseline `c0e878e` had 31 formal AI assets. Scout Combat v1 `80109ee0…` and v2 `752052e8…` were both human-rejected for duplicated binoculars; v2 was formally rejected at phase start and both candidates remain preserved.
- Abandoned signature-prop position transitions after 2/2 failures. Revised Scout Combat to revision 4 with `postureOnly=true`, `signaturePropMode=static` and `handsEmpty=true`; the provider prompt keeps one binocular pair static at the chest and expresses action through posture only.
- Offline gates passed: 1168 tests, typecheck/build/save/dependency/art/Manifest/security audits, 500-game regression and production dependency audit.
- Generated exactly once: candidate `7d6a0e3f19a49a379627cb4f99effb12140355d92d53fde74f934c0f27ec7e01`, API=1, cache=0, validation PASS, review pending. Visual review found static binoculars, empty separated hands and clear alert posture; no duplicate prop observed. No approval, publication or remaining Combat generation performed.
- Review package: `output/art-review/phase4a432-scout-combat/`. Await human review; if this strategy later fails, stop text-only Combat tuning and consider Phase 4A-4.3R simplification.

## Phase 4A-4.5 progress (2026-08-09)

- Approved exactly the human-selected Fighter, Engineer and Medic Combat candidates and published them idempotently; final formal Manifest/provenance count is 35.
- Added the read-only closure audit and reports for Manifest coverage, provenance, candidate hygiene and runtime usage. All four audit dimensions PASS; Rain remains fallback-only under the provider exception.
- Added the derived character visual-state resolver and wired real StatusBar, DebugPanel and visible EncounterPanel consumers. No state is persisted and hidden NPC state is not exposed.
- Full verification: 56 test files / 1211 tests PASS, typecheck/build PASS, offline/security/dependency gates PASS, production npm audit 0 vulnerabilities, and 500-game `PHASE4A45` regression PASS under the existing observation-only balance policy.
- Browser smoke rendered the real gameplay UI, reported `mode=playing`, time 0 and no console-error artifact. Screenshot evidence is in `output/phase4a45-browser/`.
- Final reports: `PHASE4A45_REPORT.md`, `PHASE4A45_AUDIT_FIXES.md`, `reports/phase4a45-command-results.txt` and the four machine-readable audit reports.
- Remaining handoff: commit and push this closure; keep the pre-existing `reports/save-validation-audit.json` and `.md` user changes unstaged.

## Phase 4A-4.5.1 progress (2026-08-09)

- Corrected hash semantics: `generationInputHash`/`promptHash` is canonical generation input, `contentHash` is exact image bytes, and `candidateHash` remains an immutable Candidate ID.
- Added bytes-aware cache, approval, publisher staging, Manifest validation and Phase 4A audit checks. A valid same-size replacement now deterministically fails validation/audit.
- Migrated the local 54-Candidate store with a complete preflight and atomic apply: approved 35, pending 10, rejected 9; 0 IDs/statuses/image files/Manifest paths changed; 35/35 Candidate/public byte matches; provider calls 0.
- Migration dry-run and apply are idempotent and return `NO CHANGES` after the first apply. Public formal asset tree aggregate remains `24831019d5fbbecc004d7a8a77ba5b2e3796f5f69b8bdd1d2aca6aea8af7bfa5`.
- Added 25 meaningful hash/migration/tamper/audit tests. Final local suite before commit: 57 files / 1236 tests PASS; typecheck/build, bytes audit, security scans, 500-game PHASE4A451 regression and production npm audit all PASS.
- CI now runs the provenance content integrity audit; a clean-checkout simulation without ignored local Candidates passed the published-only CI gate. No Phase 4B or image generation was performed.

## Phase 4B-0 progress (2026-08-09)

- Read the Phase 4B-0 planning/audit prompt at the start of the phase. Baseline HEAD is `521f8756a364b38ebd91b18b97d4a5dac3aea4fa`, branch `agent/phase4-art-pipeline`, package/GAME_VERSION `0.3.2`, and the previous full suite baseline is 57 files / 1236 tests.
- Confirmed the task is planning and audit only: no Phase 4B-1 implementation, no image API calls, no changes to `src/core/**`, `src/data/**`, or `public/assets/**`.
- Code inventory found the current three-column prototype: top StatusBar, list-based ZoneMap, central stage, tabbed Inventory/Craft/Log, bottom ActionBar, optional URL `?debug=1` DebugPanel, and text-heavy ResultScreen.
- Browser runtime verification used the real Vite app at desktop and phone widths. Menu, gameplay, search feedback, item pickup, tab switching, active encounter, character combat art, toast, and mobile layout were captured. No browser console errors occurred. The mobile screenshot shows the vertical clipping risk caused by the fixed-height/overflow-hidden shell; `document.body.scrollWidth` remained equal to the 390px viewport.
- Audit conclusion: recommend a Hybrid Zone Presentation for Phase 4B-1, with the current Zone Background promoted to the main gameplay visual and a compact translucent map/navigation layer retained for movement. Do not generate warning/restricted AI variants; use CSS state layers plus icon/label/pattern.
- Phase 4B-0 documents and machine-readable reports are being prepared. The next phase target is frozen as one theme only: `Main Gameplay Visual Shell & Zone Visual Hierarchy`.

## Phase 4B-1 progress (2026-08-09)

- Implemented the frozen Main Gameplay Visual Shell scope only: the current Zone background is now a `VisualImage`-backed central Hero with readable zone name, description, status label, icon and CSS state layer.
- Converted the six-zone list into a compact two-column navigation layer while preserving all six zones, adjacency, movement availability, noise, intel and drop information. Rebuilt StatusBar as P0 survival metrics and ActionBar as the P1 next-action cluster.
- Added presentation-only SAFE / WARNING / RESTRICTED metadata and cues. WARNING and RESTRICTED use CSS stripes/diagonal edge treatment; no image API was called and no formal asset/core/data files changed.
- Added four focused UI tests. Full suite is now 58 files / 1240 tests PASS. Typecheck, build, save/dependency/art/provenance/security audits, 500-game `PHASE4B1` regression and production npm audit all PASS.
- Browser evidence is in `output/phase4b1-browser/`: desktop SAFE/WARNING/RESTRICTED/encounter states and 390×844 SAFE plus encounter-action reachability. Final mobile run measured `scrollWidth=390`, stage client height 960px versus 195px baseline, and escape-button reachability after board scroll with no browser errors.
- Added `PHASE4B1_REPORT.md` with evidence grading, before/after measurements, gate results and scope declaration. No 4B-2 through 4B-6 work was performed.

## Phase 4B-2 progress (2026-08-09)

- User-authorized scope: Encounter & Combat Feedback only, based on `PHASE4B0_COMBAT_UX_SPEC.md`, UX-003 and UX-004.
- Frozen: `src/core/**`, `src/data/**`, `public/assets/**/*.png`, `art/approved-assets.json`, combat formulas, RNG, save schema and 4B-1 shell semantics.
- Added presentation-only combat metadata plus a balanced Player / feedback-and-actions / Enemy encounter composition. Existing `VisualImage` fallback behavior and the existing Portrait / Combat / Injured resolver remain the only visual-state sources.
- Added persistent icon + text cues for Combat/Injured/Portrait, Guard, EXPOSED and skill readiness; enemy health remains descriptor/bar-only with no exact HP digits. Added active/resolved entry/exit markers and immediate last-result feedback.
- Added 6 focused UI regression tests, including resolved Portrait state and enemy exact-HP boundary, plus a clean production-preview Playwright evidence test. The final browser run covers 1280×720, 1024×720, 390×844 healthy/injured/Guard/EXPOSED/resolved states with zero console/page errors.
- Final verification: 59 test files / 1246 tests PASS; typecheck/build, save/dependency/art/provenance/security gates, 500-game `PHASE4B2` regression and `npm audit --omit=dev` all PASS. Mobile encounter height is 559.7px versus ~505px baseline, with no horizontal overflow and all six combat buttons reachable. No core/data/formula/RNG/save/assets/manifest changes were made.
- Added `PHASE4B2_REPORT.md`. No 4B-3 through 4B-6 implementation occurred.

## Phase 4B-3 progress (2026-08-09)

- Fixed the Phase 4B-2 CI blocker first in isolated commit `8bc09bc`: declared
  `@playwright/test`, added the reproducible preview config, ran the clean-install
  typecheck path, and pushed. GitHub Actions run `31314784246` completed with `verify`
  PASS before Phase 4B-3 implementation began.
- Added presentation-only item and search metadata modules. Search now has consistent
  in-place item, empty, and encounter feedback derived from existing structured player
  events; environment-only events cannot overwrite a search result.
- Added official `VisualImage` item visuals to inventory rows, equipment slots,
  crafting output/materials, pending pickup/replacement choices, and ground drops.
  Craft missing materials and public blocking reasons are rendered explicitly.
- Reworked only the desktop secondary rail so planning and history are visible
  together. Mobile remains stacked and scrollable; no Phase 4B-5 drawer/bottom-sheet
  redesign was performed.
- Added focused UI coverage and a clean production-preview browser evidence spec.
  Final browser evidence covers 1280×720 and 390×844 with zero console/page errors,
  390px document width, item/empty/pending/craft/equipment/planning-history states.
- Added `PHASE4B3_REPORT.md`. Formal PNGs, art manifest/Candidates, `src/core/**`,
  `src/data/**`, rules, save schema, and package/GAME_VERSION remain unchanged.

## Phase 4B-3 P0 log privacy fix (2026-08-09)

- Before entering Phase 4B-4, fixed the default EventLog visibility boundary in the
  UI layer only. NPC `NPC_ACTION`, search/pickup/movement, and other NPC-only events
  are excluded; player actions, player-participating combat, own environment damage,
  and public broadcasts remain visible. DebugPanel still receives the complete state.
- Added unit regression coverage for NPC search/plan/pickup leakage, material
  percentages, player combat/self damage, public broadcasts, and unchanged debug input.
- Added a clean production-preview Playwright evidence spec for the default desktop
  log. No Phase 4B-4 UX code, core/data rule, event schema, asset, or manifest change
  is included in this P0 patch.

## Phase 4B-4 progress (2026-08-09)

- After the independent P0 commit `e1745e4` reached CI run `31317531844` PASS,
  implemented the World Events & Restricted Zone presentation scope only.
- Added `worldEventPresentation.ts` and `WorldEventFeedback.tsx`: persistent events
  now sort by presentation severity and urgency, expose scope and remaining-time
  labels, and carry icon/label/pattern cues. `emergency_broadcast` is shown as a
  short non-blocking live announcement for 4.5 seconds while its historical log
  event remains intact.
- Extended the existing Zone presentation without changing its rules: warning
  countdown distinguishes near/imminent states; restricted surfaces show the
  current public damage-per-turn; the StatusBar emits a player-only immediate
  hazard source/damage cue for the current time unit.
- Added UI tests for severity/scope/remaining time, instant announcement auto-hide,
  warning/restricted non-color cues, and player-only hazard feedback. Added clean
  production-preview browser evidence with a valid save fixture containing two
  simultaneously active public events. Natural scheduler overlap was not claimed:
  current event interval rules are longer than event durations.
- Current verification chunk: 62 test files / 1259 tests PASS, typecheck/build PASS,
  and Phase 4B-4 browser evidence has 0 console/page errors at 1280×720 and 390×844.
- Remaining before handoff: final all-browser regression run, report, commit/push,
  and final CI confirmation. No core/data/rules/assets/Manifest changes are planned.

## Phase 4B-6 progress (2026-08-09)

- Implemented the final polish/accessibility scope only: global focus-visible
  treatment, reduced-motion safeguards, accessible action/disabled context,
  removal of hover-only `title` explanations, DebugPanel separation from the
  action rail, and a ResultScreen visual closure using existing Zone/player
  assets through `VisualImage`.
- Removed the redundant PlanningDrawer `日志` tab because the persistent
  history panel already owns that surface. Added focus-to-close, Escape close,
  and focus return to the drawer trigger.
- Added Phase 4B-6 UI regressions, including ResultScreen official-asset
  rendering and the default NPC event information boundary. Final local suite:
  64 files / 1266 tests PASS.
- Added clean production-preview evidence for 1280×720, 1024×768, 768×1024,
  844×390 and 390×844 exploration/encounter/planning states, keyboard drawer
  behavior, Debug isolation, reduced motion and zero console/page errors.
- Clean `npm ci`, typecheck/build, save/dependency/art/provenance/security
  gates, 500-game `PHASE4B6` regression and production `npm audit --omit=dev`
  all PASS. Formal 35-image tree, Manifest/Candidates, core/data, rules,
  version and Save schema remain unchanged.
- Added `PHASE4B6_REPORT.md`, `PHASE4B_CLOSURE_REPORT.md`,
  `reports/phase4b-final-ux-debt.json`, `PHASE4B_PR_DESCRIPTION.md` and the
  Phase 4C candidate list. Human real-device/screen-reader review remains
  explicitly classified as `HUMAN-PLAYTEST-NEEDED`.

## Phase 4C-1 progress (2026-08-10)

- Started `codex/phase4c1-synthesis-weapons` from `main` merge `bf6e810`.
- Expanded the data layer from 23 to 29 items and 11 to 17 recipes. Added
  intermediate weapon components and five cross-zone high-tier paths; every
  rare pool now contains at least one weapon and hospital has a stick fallback
  in both base and rare pools.
- Added the presentation-only `craftPathPresentation.ts` and CraftPanel guidance
  for “weapons mainly come from crafting”, intermediate steps, raw material
  gaps, static source zones, and expected emoji fallback for new no-art items.
- Confirmed the existing NPC `findUpgradeRecipe` can complete the chain without
  touching `src/core/**`; added item-integrity, deterministic-RNG fixture,
  information-boundary, NPC-chain, fallback, and browser evidence coverage.
- Local suite is 65 files / 1272 tests PASS. Clean production preview evidence
  covers 1280×720 and 390×844 with zero console/page errors. The required 500
  game regression and 200-game craft reachability observation are recorded in
  `reports/phase4c1-balance.*` and `reports/phase4c1-craft-reachability.json`.

## Phase 4C-2 Step 1 progress (2026-08-10)

- Moved hospital `stick` out of `basePool` while retaining it in `rarePool`,
  restoring the hospital direct-weapon estimate below the forest baseline.
- Corrected the CraftPanel recommendation label to distinguish static source
  coverage from the existing publicly visible runtime supply band.
- Step 1 targeted tests and typecheck pass; the production preview/client run
  shows a playable hospital start with no console errors. The small fix is
  ready for its isolated commit before the main 4C-2 work.
## Phase 4C-2 progress (2026-08-10)

- Completed the isolated first fix in commit `3e6bebc`: hospital `stick` remains only in `rarePool`, and the CraftPanel source label now distinguishes static source coverage from the public runtime supply band.
- Added a data-layer recipe visibility seam with all 17 current recipes explicitly `visible`; no hidden/unlock behavior or core changes were introduced.
- Added pure presentation logic for automatic weapon-goal suggestions, persistent dependency-step status, current subgoal progression, and the player-only latest craft feedback.
- Added the PlanningDrawer `图鉴` tab and a full dependency-tree codex with static material source zones, item summaries, missing-material display, and VisualImage fallback for new items.
- Added unit/UI coverage and a clean production Playwright evidence spec. Targeted tests, typecheck, production build, runtime client smoke, and the new browser evidence pass; browser evidence records zero console/page errors.
- Updating the fixed Phase 3A-1 observation seed from `STAT-11` to `STAT-1` preserves the research-anomaly assertion after the required hospital pool change altered the deterministic loot/RNG stream.

## Phase 4C-3 progress (2026-08-10)

- Implemented the minimal core fix for the zero-stamina deadlock: when every adjacent zone is restricted, FLEE now succeeds as a stationary disengagement and records a successful `no_exit` escape event, so the pursuit branch is not entered.
- Made GUARD free only at exactly 0 stamina; a character with 1 stamina still needs the configured 2-point cost. This uses the existing shared action-cost path, with no new state field or passive recovery.
- Updated EncounterPanel’s zero/partial-stamina guidance and flee accessibility text, and added focused player/NPC symmetry and last-safe-zone regression tests. Targeted suite: 4 files / 45 tests PASS.
- Ran the required develop-web-game Playwright client against the current UI after the change; the production-style exploration shell rendered with no reported console/page errors. The Phase 4C-3 implementation is included in the pushed baseline; its focused evidence and report remain available for the handoff.

## Phase 4C-4 progress (2026-08-10)

- Started the core-loop diagnosis before considering any economy adjustment. No
  gameplay rules, values, `src/core/**`, `src/data/**`, assets, manifests,
  version, or Save schema were changed.
- Extended the deterministic auto-player diagnostics with optional full event
  traces, first-weapon/death-equipment inputs, and zero-stamina emergency-action
  counters. Added `tools/observeCoreLoopDiagnosis.ts` for a reproducible
  character × policy × seed matrix, with health checks separated from
  win-rate/balance observations.
- Added two regression tests proving diagnostic mode is non-invasive and its
  counters/snapshots remain within the formal command/event output.
- Typecheck, the Phase 4C-3 targeted suite (18 tests), and the new Phase 4C-4
  diagnostic suite (2 tests) pass. The required browser smoke and multi-seed
  diagnosis plus clean-preview evidence are next.
- Completed the 400-game core-loop matrix: requested=actual 400, healthy 400,
  timeout/deadlock/illegal/hard-limit 0. First-weapon acquisition was 40.0%
  (93 craft / 67 pickup among 160 weapon games), player high-tier completion
  was 8.0%, and combat caused 313 of 383 player deaths. The report records that
  the auto-player does not issue EQUIP, so carried-item and equipped-item
  observations are kept separate.
- Added `PHASE4C4_REPORT.md` and a clean production-preview evidence spec;
  1280×720 exploration/crafting and 390×844 zero-stamina encounter snapshots
  pass with zero console/page errors. Economy tuning is deferred pending a
  representative goal-adoption/equip loop and human playtest.
- Final gates pass after clean `npm ci`: 68 files / 1283 tests, typecheck/build,
  save/dependency/art/provenance/security audits, 500-game health regression,
  production `npm audit --omit=dev` (0 vulnerabilities), and the final clean
  preview evidence. Remaining handoff is intentional commit/push and CI check;
  real-device/AT playtest items stay classified as HUMAN-PLAYTEST-NEEDED.

## Phase 4C-5 progress (2026-08-10)

- Added the presentation-only equipment handoff layer. Search and craft result
  cards now expose the player's own “装备 / 立即装备” action and preserve a
  visible “已装备” result after the parent dispatches the formal `EQUIP`
  command. Inventory equipment candidates now choose the strongest item in the
  player's own slot rather than the first stack.
- Added regression coverage for search/craft handoff callbacks, strongest
  candidate selection, result lifecycle after `ITEM_EQUIPPED`, and a
  representative command-channel build loop. No component directly mutates
  equipment state.
- Added an optional representative diagnostic mode to `tools/autoPlayer.ts` and
  `tools/observeCoreLoopDiagnosis.ts`. Across two 400-game matrices, both had
  requested=actual 400 and healthy 400; the representative mode set a goal in
  400/400 games and produced player equipment events in 100/400 games. Its lower
  weapon rate is recorded as strategy-calibration evidence, not a balance verdict.
- Added `PHASE4C5_REPORT.md`, clean production-preview evidence for 1280×720 and
  390×844, and `reports/phase4c5-balance.json` plus the two diagnosis reports.
  Final local suite is 69 files / 1287 tests; typecheck/build, clean `npm ci`,
  save/dependency/art/provenance/security gates, 500-game health regression,
  production `npm audit --omit=dev`, and browser evidence all pass with zero
  console/page errors. Human touch/screen-reader/long-session validation remains
  HUMAN-PLAYTEST-NEEDED.

## Phase 4C-6 progress (2026-08-10)

- Audited the Phase 4C-5 representative route and found a real guidance defect:
  core recommendations only inspected direct recipe ingredients, so a target
  such as 野外长矛 recommended the unsearchable intermediate 加固握把 instead of
  its public raw materials.
- Fixed the read-only route guide in `src/core/craftGuide.ts` to expand visible
  recipe dependencies to raw materials while consuming the player's own held
  intermediates first. It still never reads `zone.loot`; hidden recipe seams are
  not recursively exposed.
- Stabilized the optional representative diagnostic policy: it retains a route
  target, searches after arrival, and rotates only after two no-yield searches.
  This removes residential/factory oscillation without changing gameplay rules.
- Same-seed paired observation (`PHASE4C5-REP`) improved goal completion from
  13/400 to 140/400, first-weapon acquisition from 59/400 to 315/400, and player
  equipment-event games from 100/400 to 341/400; both runs were 400/400 healthy.
- Added nested-route unit and information-boundary regressions plus clean
  production-preview evidence for 1280×720 and 390×844. Screenshots visibly
  show raw-material gaps, public source zones and the current subgoal; preview
  console/page errors are 0. Phase 4C-6 report, gates, commit, push and CI
  confirmation are complete; CI run `31331617407` is green.

## Phase 4C-7 progress (2026-08-10)

- Added `tools/observeRoutePlaytest.ts`, an explicitly labelled
  `SEMI_AUTOMATED_ROUTE_OBSERVATION`. It records only player milestones through
  the existing representative command loop: target adoption, raw material found
  vs picked, dependency craft, high-tier weapon, equipment, encounter, goal
  completion and player death cause/time.
- Added two regression tests for deterministic health, player-only data scope and
  the explicit `NOT_PERFORMED` human-playtest marker. `HUMAN_PLAYTEST_CHECKLIST.md`
  remains untouched and blank.
- Full 20-route observation is complete: requested=actual 20, trustworthy 20/20;
  target adoption 20, raw-material observation 20, dependency craft 15, weapon
  obtained 19, equipment 19, first encounter 18 and target completion 9.
  These are diagnostic observations, not win-rate or economy gates.
- Current finding: the formal route is executable and supply is observed in all
  20 routes, so no loot/prescription/combat tuning is justified by this sample.
  The remaining 8 routes classified as `weapon-not-converted` need human review
  to distinguish target choice, encounter pressure and route comprehension.
- Final local gates are green: clean `npm ci`, 70 files / 1292 tests, typecheck,
  build, save/dependency/art/security audits, 500-game engine health regression,
  production dependency audit and clean production-preview evidence. The
  generated historical audit timestamps were restored and the pre-existing save
  audit edits remain unstaged. Final GitHub Actions CI run `31332418477` is also green.
- Next handoff: complete a real human playtest using a copied checklist before
  considering any local economy adjustment; do not treat this semi-automated
  report as human evidence.
