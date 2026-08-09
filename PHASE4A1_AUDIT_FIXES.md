# Phase 4A-1 Audit Fixes

- P4A1-SEC-01: tracked repository scanning now includes `.env.example`; empty `IMAGE_API_KEY=` is allowed, non-empty `IMAGE_API_KEY`/`VITE_IMAGE_API_KEY` assignments fail, and environment references are not false positives.
- P4A1-REDACT-01: provider error messages redact the configured key before the 300-character limit is applied.
- P4A1-PROV-01: published Manifest AI slots now require reverse provenance, while the explicit legacy bandage SVG remains exempt; unknown provenance task ids fail.
- P4A1-REG-01: `simulate --regression` checks requested/actual games and engine health only; formal and CI verdicts remain unchanged.
- P4A1-MIME-01: cache and candidate extensions use MIME detected from image bytes when provider-declared MIME disagrees.
- P4A1-REVIEW-01: `art:review-export -- --round A` copies only passed/pending candidates, emits an index and human-review README, and never changes review status.
