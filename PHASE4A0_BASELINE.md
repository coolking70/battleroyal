# Phase 4A-0 Baseline

- Branch: `agent/phase4-art-pipeline`
- Baseline commit: `b2435e2b490350233c0a9cf43c04975df04cc987`
- Phase 3: PASS.
- Phase 4 offline infrastructure: basic PASS.
- Phase 4 provider integration: FAIL; the previous Agnes attempt returned HTTP 401 invalid token.
- Phase 4 art production: 0 candidates, not started.
- Current full suite baseline: 584 tests.
- Core is frozen for this phase; only `tools/art/**`, `art/**`, `reports/phase4*`, `public/assets/**`, small visual runtime interfaces, tests, CI, and Phase 4 documentation may change.

## Blocking findings

- `P4A0-API-01`: Agnes request body is not aligned with the current minimal provider contract.
- `P4A0-API-02`: the real provider has only returned 401, so the success path has never been verified.
- `P4A0-META-01`: candidate metadata records requested dimensions, not actual image dimensions.
- `P4A0-VAL-01`: validator checks aspect ratio but not minimum/maximum actual resolution.
- `P4A0-REVIEW-01`: one task can have multiple active approved candidates.
- `P4A0-PUBLISH-01`: publish cannot fully restore the old assets tree if the second rename fails.
- `P4A0-PROV-01`: approved candidate provenance is ignored and not committed.
- `P4A0-REPORT-01`: dry-run overwrites the real provider generation report.
- `P4A0-SEC-01`: browser secret scan is correctly scoped, but its report wording overclaims whole-repository coverage.
- `P4A0-CLI-01`: generation has no validated concurrency option.
- `P4A0-ROUND-A`: real Round A generation produced 0 images.

## Required outcome

Infrastructure can be marked PASS only after all offline contracts, cache/review/publish tests, and security checks pass. Overall Phase 4A-0 still requires a successful real Agnes Scout portrait smoke followed by the remaining three Round A tasks, each with automatic validation PASS and `reviewStatus=pending`. If the credential remains invalid, the final report must say `infrastructure PASS / provider execution BLOCKED BY CREDENTIAL`.
