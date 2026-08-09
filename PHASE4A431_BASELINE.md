# Phase 4A-4.3.1 Baseline

- Branch: `agent/phase4-art-pipeline`
- HEAD: `232d9c0d0ce05bf6232ac9191fcb525fdafd9e39`
- Tests at baseline: `1162`
- Formal AI assets: `31`

## Scout state

- Portrait: official
- Injured: official
- Combat: `null`

## Previous Scout Combat candidate

- Candidate hash: `80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1`
- Source: `api`
- Automatic validation: passed
- Review state before this phase: pending
- Human decision: **REJECT**
- Human rejection reason: duplicated binocular prop; one pair is raised near the face while another remains on the chest.

This hash was read from `reports/phase4a43-scout-combat-canary.json`, the candidate metadata and `npm run art:list`; it was not inferred from the phase prompt.

Phase 4A-4.3.1 preserves the 31 formal assets and keeps every Combat Manifest slot null. Only the Scout Combat task may be regenerated, once, after the semantic single-prop revision.
