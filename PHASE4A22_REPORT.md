# Phase 4A-2.2 Report

## Completed

- Approved and published Fighter, Engineer and Medic using the exact Phase 4A-2.1 positive-only candidate hashes.
- Formal AI asset count is 7: Scout, Fighter, Engineer, Medic, School, Bandage and Blackout.
- Hospital, Medkit and Rain legacy candidates were formally rejected with the specified human-review reasons.
- Added `environment-positive-only` for Hospital/Rain and `item-positive-only-unmarked` for Medkit.
- Real provider order was Hospital → Medkit → Rain, concurrency 1, three API calls, zero cache hits.
- Hospital and Medkit each returned one validated pending candidate.
- No recovery candidate was auto-approved or published.
- Full test suite: 742/742. CI-facing build and offline audits passed before the provider calls.

## External-provider exception

Agnes rejected the one Rain request with `Unable to generate this content. Please modify your prompt and try again.` before returning an image. The phase budget forbids an automatic fourth call or prompt-stacking reroll, so Rain has no candidate and this phase does not claim the full technical PASS definition.

## Formal Manifest

The Manifest and provenance remain at exactly seven approved AI mappings. Hospital, Medkit and Rain are absent/null and remain on runtime fallback chains.

## Next human action

Review the Hospital and Medkit candidates. A future phase may decide how to handle the Rain provider rejection under a new explicit API budget; this phase does not make that decision or call the provider again.
