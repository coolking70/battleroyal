# Phase 4A-4.3.1 Report — Scout Combat Single-Prop Closure

## Technical result

**Technical Execution: PASS. Art Strategy Result: FAIL.**

The old candidate was correctly rejected, the Scout Combat task was revised from 2 to 3, the single-prop semantic contract passed, all offline gates passed, exactly one real API call was made, the new candidate was technically valid, and the process stopped at human review without reroll or publication.

## Baseline and formal assets

- Baseline HEAD: `232d9c0d0ce05bf6232ac9191fcb525fdafd9e39`
- Formal AI assets: 31 at baseline and 31 after this phase.
- Scout Portrait: official.
- Scout Injured: official.
- Scout Combat Manifest slot: `null`.
- Fighter/Engineer/Medic Combat Manifest slots: `null`.
- Rain remained untouched with zero calls and runtime fallback preserved.

## Candidate lifecycle

| Stage | Hash / result |
| --- | --- |
| Old candidate | `80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1`, formally rejected |
| Old review reason | duplicated binocular prop |
| Previous prompt hash | `80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1` |
| New prompt/candidate/content hash | `752052e828e7708ebc010457bb9eca11e718a7ec91e18e63dd8b133ad11f6159` |
| API calls | 1 |
| Cache hits / retries / rerolls | 0 / 0 / 0 |
| Actual image | PNG, 864×1152 |
| Automatic validation | PASS |
| Review | pending |
| Formal publication | not published |

The new provider prompt passed single-prop, dynamic-equipment, injured-state, negative-prompt, internal-ID and provider-payload audits. Visual inspection nevertheless found two binocular pairs again: one raised near the face and one complete pair on the chest. This observation is recorded for the human reviewer; it caused no automatic state transition.

## Gate result

- `npm ci`: exit 0; npm reported development dependency advisories, handled separately by the production audit.
- Typecheck: PASS.
- Full tests: 1167/1167 PASS.
- Build: PASS.
- Save audit: 74/74 PASS.
- Dependency audit: PASS.
- Offline art doctor: PASS.
- Published Manifest validation: PASS.
- Browser and repository secret scans: PASS.
- 500-game PHASE4A431 regression: actual 500; timeout/deadlock/illegal/hardlimit 0; overall regression PASS.
- `npm audit --omit=dev`: 0 vulnerabilities.

## Review handoff

The review package is at `output/art-review/phase4a431-scout-combat/`. Decision and Notes are blank. Do not approve or publish this candidate based on technical validation alone. If the user rejects it again for the duplicate prop, do not continue with another Scout Combat reroll; use the posture-only recovery strategy described in the Single-Prop Strategy document.
