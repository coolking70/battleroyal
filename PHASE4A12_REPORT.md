# Phase 4A-1.2 Report

## Technical result

Targeted Round A3 completed in the required order with exactly two provider calls:

| Task | Previous v2 candidate | New v3 candidate | Actual resolution | Source | Validation | Review |
| --- | --- | --- | --- | --- | --- | --- |
| character/scout/portrait | `d47e96af060e6357e8d513ee79056b3b7f701c8add0332f8ae9d3b61bdaaee0a` | `1d3efddc1e422e9e5ba4fcb0353ffb6853aa6b9a6a094436b15d802ddbdeb19f` | 864×1152 | api | passed | pending |
| world_event/blackout/illustration | `48af21a453ef44f2103779f634851607eb3be1377d96b11bf5619043c97b664d` | `0e1536f4df281f25ba3d36648aff049bab3d51ed71607f80eb18a31ef82b690b` | 1312×736 | api | passed | pending |

Both new hashes differ from v2. Each task used `apiCalls=1` and `cacheHits=0`. The exact machine-readable evidence is `reports/phase4a12-round-a3-report.json`.

## Explicit scope state

- Bandage v2: not regenerated.
- School v2: not regenerated.
- Scout v3: new API candidate, validation passed, review pending.
- Blackout v3: new API candidate, validation passed, review pending.
- Round B: not executed.
- Approve: not executed.
- Publish: not executed.
- `art/approved-assets.json` remains empty and the formal Manifest remains unchanged.
- Round A v1 and v2 candidates remain preserved.

Technical generation is PASS. Human visual acceptance is still pending for Scout v3 and Blackout v3; this report makes no automated visual-quality claim. The final implementation commit `add4b83` was verified by GitHub Actions run `31268805389` with `verify` PASS.

## Verification

Local gates passed with 652 tests, build, save/dependency audits, art doctor, Manifest validation, secret scans, PHASE4A12 500-game regression, and runtime npm audit. Final CI status is recorded only after the final commit is pushed.
