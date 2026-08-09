# Phase 4A-4.3.2 Report — Scout Combat Posture-Only Closure

## Outcome

**Technical Execution: PASS. Art Review: pending human approval.**

The v2 candidate was correctly rejected, the failed prop-transition strategy was frozen, and Scout Combat revision 4 implemented posture-only presentation. All offline gates passed. Exactly one real API call produced a technically valid candidate. The candidate remains pending and unpublished.

## Baseline and formal asset state

- Baseline HEAD: `c0e878e45b3330baaaeb89cb4b2309ac7e7dc073`
- Formal AI assets: 31 before and after this phase.
- Scout Portrait: official.
- Scout Injured: official.
- Scout Combat Manifest slot: `null`.
- Fighter/Engineer/Medic Combat slots: `null`.
- Rain and all non-Scout art tasks: zero calls.

Historical candidates remain preserved:

- v1: `80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1` — rejected for duplicated binoculars.
- v2: `752052e828e7708ebc010457bb9eca11e718a7ec91e18e63dd8b133ad11f6159` — rejected for duplicated binoculars despite single-prop transition prompting.

## New canary

| Field | Result |
| --- | --- |
| Task | `character/scout/combat` |
| Revision | 4 |
| Strategy | descriptor-locked-text-only-dynamic-equipment-neutral-posture-only |
| New candidate/content/prompt hash | `7d6a0e3f19a49a379627cb4f99effb12140355d92d53fde74f934c0f27ec7e01` |
| Previous prompt hash | `752052e828e7708ebc010457bb9eca11e718a7ec91e18e63dd8b133ad11f6159` |
| API calls | 1 |
| Cache hits / retries / rerolls | 0 / 0 / 0 |
| Actual image | PNG, 864×1152 |
| Automatic validation | PASS |
| Posture-only contract | PASS |
| Static signature prop contract | PASS |
| Hands-empty contract | PASS |
| Review | pending |
| Publication | not published |

Visual observation: one compact binocular pair remains static at the center of the chest; both hands are visibly empty and separated from it. The Scout identity, outfit, side pouch and active threat-response posture remain readable. No duplicate binocular prop, fixed weapon or military/tactical contamination was observed. Human approval is still required.

## Verification gates

- `npm ci`: exit 0; development advisories reported separately.
- Full tests: 1168/1168 PASS.
- Typecheck and build: PASS.
- Save audit: 74/74 PASS.
- Dependency audit, offline doctor and Manifest validation: PASS.
- Browser/repository secret scans: PASS.
- 500-game PHASE4A432 regression: actual 500, timeout/deadlock/illegal/hardlimit 0, overall PASS.
- `npm audit --omit=dev`: 0 vulnerabilities.

## Handoff

Review package: `output/art-review/phase4a432-scout-combat/`. The only open decision is human review of whether posture alone sufficiently communicates Scout Combat. No approval, publication or remaining Combat batch is implied.
