# Phase 4A-4.3.2 Baseline

- Branch: `agent/phase4-art-pipeline`
- HEAD: `c0e878e45b3330baaaeb89cb4b2309ac7e7dc073`
- Tests at baseline: `1167`
- Formal AI assets: `31`

## Scout formal state

- Portrait: official
- Injured: official
- Combat: `null`

## Historical Scout Combat candidates

Candidate hashes were read from the candidate metadata, `art:list` and the Phase 4A-4.3/4.3.1 reports:

- Combat v1: `80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1` — human rejected; duplicated binocular prop.
- Combat v2: `752052e828e7708ebc010457bb9eca11e718a7ec91e18e63dd8b133ad11f6159` — pending at phase start; human rejected; duplicated binocular prop persisted despite the single-prop state-transition prompt.

The two failed candidates remain preserved in the candidate store. This phase formally closes v2 and abandons prop position transitions. The only permitted experiment is one posture-only Scout Combat canary with the binoculars static at the center of the chest and both hands empty.
