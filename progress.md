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
