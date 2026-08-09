# Phase 4A-4.2 Report

## Outcome

Scout Injured was approved using the exact user-approved candidate and published to the official runtime Manifest. Formal AI assets increased from 27 to 28. The Manifest now has `characters.scout.portrait` and `characters.scout.injured` as official; Fighter, Engineer and Medic injured slots remain null. All combat slots remain null. The five official World Events remain unchanged and Rain remains fallback-only with zero calls.

The remaining injured batch then generated exactly one candidate per role in the required order. All three returned valid 864×1152 PNGs. Every candidate remains pending and was exported for human review; no identity consistency claim, auto-approval, rejection or reroll was made.

## Candidates

| Task | Candidate hash | API calls | Cache | Validation | Review |
| --- | --- | ---: | ---: | --- | --- |
| Fighter Injured | `bdfbd88d5ad6b746586decb62227b5f4d92676dbded3ac16c624a1efc7d3e61e` | 1 | 0 | passed, 864×1152 PNG | pending |
| Engineer Injured | `a696243e0873e7e44e352c27721a25e6ff558b5027482beffe89ca95792352d5` | 1 | 0 | passed, 864×1152 PNG | pending |
| Medic Injured | `804ea57b335ffd9b0f8557d3ce81e72e8b6071038aa396c8a244b7f97c8d8154` | 1 | 0 | passed, 864×1152 PNG | pending |

## Technical gates

- Full tests: 1074/1074 passed.
- Typecheck and build: passed.
- Save-validation audit: 74/74 malformed cases rejected; 0 construction failures.
- Dependency audit, offline art doctor, published Manifest validation and browser/repository secret scans: passed.
- PHASE4A42 500-game regression: requested = actual = 500; timeout/deadlock/illegal/hard-limit gate passed.
- `npm audit --omit=dev`: 0 vulnerabilities.

Evidence: [baseline](PHASE4A42_BASELINE.md), [batch report](reports/phase4a42-injured-batch.json), [balance report](reports/phase4a42-balance.json), [command results](reports/phase4a42-command-results.txt), [review package](output/art-review/phase4a42-injured-batch/README.md).
