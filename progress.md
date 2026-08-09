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
