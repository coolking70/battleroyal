# Phase 4A-4.5.1 Report

## Baseline and final state

- Baseline HEAD: `ed707c342dc5013a469068f26855748900725336`
- Formal assets: 35 before / 35 after
- Candidate records: 54 before / 54 after
- Statuses: approved 35, pending 10, rejected 9
- Candidate IDs changed: 0
- Review statuses changed: 0
- Public image bytes changed: 0/35
- Manifest paths changed: 0
- API calls: 0

## Hash integrity

- `promptHash`: canonical generation-input SHA-256, preserved for all 54 Candidates.
- `contentHash`: exact raw image-byte SHA-256, recomputed for all 54 Candidates.
- `candidateHash`: immutable Candidate ID, retained without renaming.
- Approved provenance updated: 35/35.
- Candidate bytes checked: 35/35 formal sources.
- Public bytes checked: 35/35 formal assets.
- Candidate/public byte matches: 35/35.
- Prompt hash matches: 35/35.
- Content hash matches: 35/35.

## Tamper coverage

The new 25-test integrity suite covers:

- valid same-size public replacement → detected and `art:validate` fails;
- valid same-size Candidate replacement → approval/publish/audit fails;
- provenance `contentHash` mutation → validation fails;
- provenance `promptHash` mutation → validation fails;
- Candidate/public divergence → validation fails;
- independent Candidate ID → passes when the rest of the chain is intact;
- generation, cache-hit and duplicate-Candidate semantics;
- migration dry-run, preflight failure, status preservation, no partial write and zero provider calls.

## Verification

- Tests: 25 new integrity tests pass; full suite is **57 files, 1236/1236 tests PASS** after the final audit-tamper additions.
- `art:validate`: PASS.
- `art:audit:phase4a`: PASS with bytes-aware provenance report.
- 500-game regression: **500 requested / 500 actual**, engine regression PASS, timeout/deadlock/illegal/hard-limit counts 0 under the regression gate; role balance PASS in this run.
- `npm audit --omit=dev`: **0 vulnerabilities**.

## Verdict

**PHASE 4A-4.5.1 = PASS**

**PROVENANCE CONTENT INTEGRITY = PASS**

The Base Art track is ready for Phase 4B-0 only after the final local/CI gate is green. Final command evidence is in [`reports/phase4a451-command-results.txt`](reports/phase4a451-command-results.txt).
