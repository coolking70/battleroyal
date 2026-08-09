# Phase 4A-0 Audit Fixes

- P4A0-API-01/02: split the Agnes adapter from the generic client and use the minimal verified request body.
- P4A0-META: record requested dimensions/ratio and actual byte-derived dimensions/MIME type.
- P4A0-VAL: enforce real dimensions, category floors, 8192px maximum, alpha, and ±5% ratio tolerance.
- P4A0-CACHE: cache hits now re-read and validate image bytes and metadata; missing, corrupt, or mismatched entries miss safely.
- P4A0-REVIEW: add `superseded` and enforce one active approval per task.
- P4A0-PUBLISH: add committed provenance, duplicate-approval rejection, staged validation, rollback, and idempotence.
- P4A0-REPORT: separate dry-run, provider-attempt, Round A, balance, and command-result reports.
- P4A0-SEC: retain browser boundary scanning and add tracked-repository secret scanning.
- P4A0-CLI: bound concurrency to 1–2, keep `art:api-check` offline, and make `art:smoke` the one-task provider call.
- P4A0-ROUND-A: stop after Scout authentication failure; no automatic approval or publish was performed.
