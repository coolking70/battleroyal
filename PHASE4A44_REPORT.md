# Phase 4A-4.4 Report — Combat Batch and Scout Formalization

## Outcome

**Technical execution: PASS. Scout formalization: PASS. Fighter/Engineer/Medic review: pending human approval.**

Scout Combat v3 was approved from the recorded candidate metadata and published exactly once. The formal AI asset count moved from 31 to 32. The Fighter/Engineer/Medic batch then ran exactly once per task, in the required order, with three real Agnes calls, no cache hits, no retries and no rerolls. All three candidates are technically valid and remain pending; no batch candidate was approved or published.

## Scout Track A

| Field | Result |
| --- | --- |
| Candidate | `character/scout/combat` |
| Approved hash | `7d6a0e3f19a49a379627cb4f99effb12140355d92d53fde74f934c0f27ec7e01` |
| Previous rejected hashes | `80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1`, `752052e828e7708ebc010457bb9eca11e718a7ec91e18e63dd8b133ad11f6159` |
| Publication | one publish; second publish returned `NO CHANGES` |
| Runtime path | `/assets/characters/scout/combat.png` |
| Formal asset count | 31 → 32 |
| Manifest validation | PASS |

## Controlled batch

| Task | Candidate hash | Calls | Resolution | Review | Visual observation |
| --- | --- | ---: | --- | --- | --- |
| Fighter Combat | `e0add26bee2964f26a21df410662eed4500598b866b69eb53ab3b345980b2d7f` | 1 | 864×1152 PNG, validation PASS | pending | Matched glove pair and compact defensive guard read clearly. |
| Engineer Combat | `771016954288f55552af415eaf25071a66d7906a1cf8a998997b4d1310f4509e` | 1 | 864×1152 PNG, validation PASS | pending | Reactive balance, empty hand and tool belt read; secured wrench needs human confirmation. |
| Medic Combat | `46b13f1437678d9e0da8fe127513514fa965acb72a4b530e22e8d0feedad01c8` | 1 | 864×1152 PNG, validation PASS | pending | Cautious posture and green/off-white identity read; waist pouch is not clearly visible in the crop and needs explicit review. |

Policy: Descriptor-Locked + Text-Only + Positive-Only + Posture-Only + Dynamic-Equipment-Neutral. Fighter gloves are fixed wearable role costume. Engineer wrench and Medic pouch are static, secured props; hands remain empty. No automatic visual approval or reroll was performed.

## Verification

- Full test suite: 55 files, 1190/1190 PASS.
- `npm ci`, typecheck, production build: PASS.
- `art:doctor --offline`, `art:validate`, all three combat prompt audits: PASS.
- Dependency audit, browser/repository secret scans, `npm audit --omit=dev`: PASS; production audit reports 0 vulnerabilities.
- 500-game `PHASE4A44` simulation: actual 500, overall PASS.
- Existing `reports/save-validation-audit.json` and `.md` were preserved with their pre-existing content/timestamps and are not part of this phase commit.

Review package: `output/art-review/phase4a44-combat-batch/README.md`.
