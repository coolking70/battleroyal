# Phase 4A-2.1 Report

## Outcome

Track A passed: Blackout v5 was approved, published, validated, and selected as an official runtime asset. The formal Manifest/provenance count is exactly four AI tasks: Scout, School, Bandage, and Blackout.

Published Manifest hash: `ad687fd5ff6172a7691e8e86bdbf05eea5b0b675edc5d251136b76d7852d74f7`.

Track B passed as a bounded technical experiment: Engineer Canary passed the hard contamination gate, then Fighter and Medic were generated. All three positive-only candidates are technical PASS and remain pending human review. No character candidate was approved or published.

Track C passed technically: Hospital, Medkit, and Rain each received one serial API call, passed technical validation, and remain pending. Visual observations are documented for human review; no automatic decision was made.

## API accounting

- Blackout: 0 API calls in this phase; formal approval/publish only.
- Positive-only Engineer/Fighter/Medic: 3 calls total, one candidate each.
- Hospital/Medkit/Rain: 3 calls total, one candidate each.
- Phase 4A-2.1 total: 6 API calls, 0 cache hits, no force, no retries.

## Formal assets

- Scout: published
- School: published
- Bandage: published
- Blackout v5: published
- New character and B1 non-character candidates: pending, not in Manifest

## Gates

- `npm ci`: PASS
- `npm run typecheck`: PASS
- `npm test`: PASS — 686/686
- `npm run build`: PASS
- `npm run audit:save`: PASS
- `npm run audit:deps`: PASS
- `npm run art:doctor -- --offline`: PASS
- `npm run art:validate`: PASS
- `npm run art:security:browser`: PASS
- `npm run art:security:repo`: PASS
- PHASE4A21 500-game regression: engine PASS, requested/actual 500/500; balance observation only
- `npm audit --omit=dev`: PASS — 0 vulnerabilities

## CI

Final CI will be queried after the Phase 4A-2.1 commit is pushed and the final HEAD will be recorded here if the remote returns a conclusion.
