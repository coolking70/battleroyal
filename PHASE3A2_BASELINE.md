# Phase 3A-2 Baseline

Generated from the actual working tree before Phase 3A-2 changes.

| Item | Baseline evidence |
| --- | --- |
| Commit | `bf6c73fe6bbd65dc84083c6cf9a2595805496315` (`feat(phase3a1): 规格符合性最终闭环 v0.3.1`) |
| Test count | 527 tests collected; 520 passed and 7 UI smoke tests failed because the jsdom test environment had no origin-backed `localStorage` |
| `src/core/combat.ts` | 398 lines |
| `npm run audit:deps` | PASS; R1=0, R2=0, R3=0, R4=0; exit 0 |
| Engineer NPC `field_craft` | Low-stamina REST branch runs before `npcSurvivalSkill`; the intended `stamina=2` opportunity is unreachable |
| Scout `reconInitiative` | Cleared only in the `attack` branch; non-attack first NPC actions can leave it alive |
| Manifest runtime | `public/assets/manifest.json` exists and `setAssetManifest()` exists, but `src/main.tsx` did not fetch it during bootstrap |
| UI official visuals | Components mostly consume emoji or direct visual fields; no shared image error-state component existed |

The historical Phase 3A-1 reports are retained. This baseline records current executable facts and is superseded by `PHASE3A2_REPORT.md` after final verification.
