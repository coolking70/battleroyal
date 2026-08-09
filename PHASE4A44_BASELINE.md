# Phase 4A-4.4 Baseline

- Branch: `agent/phase4-art-pipeline`
- HEAD: `1e82ef12c3360e0ba1e18c8f4dc2384bb416882b`
- Tests at baseline: `1168`
- Formal AI assets: `31`

## Formal Manifest state before Track A

- Scout Portrait: official
- Scout Injured: official
- Scout Combat: human approved, pending formal publication
- Fighter Portrait/Injured: official; Combat `null`
- Engineer Portrait/Injured: official; Combat `null`
- Medic Portrait/Injured: official; Combat `null`
- Zones: 6 official
- Items: 12 official
- World Events: 5 official; Rain provider compatibility blocked with fallback

## Scout Combat history

Candidate hashes were read from candidate metadata, `art:list` and the Phase 4A reports:

- v1: `80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1` — rejected for duplicated binoculars.
- v2: `752052e828e7708ebc010457bb9eca11e718a7ec91e18e63dd8b133ad11f6159` — rejected for duplicated binoculars.
- v3 posture-only: `7d6a0e3f19a49a379627cb4f99effb12140355d92d53fde74f934c0f27ec7e01` — human approved, pending formal publication at baseline.

The v3 hash was read from `reports/phase4a432-scout-combat-posture-only.json`; it was not guessed or substituted with a prompt hash.

## Frozen scope

Phase 3 core/data behavior remains frozen. This phase changes only art task definitions, art pipeline controls, generated candidates/reports, approved provenance and the published visual Manifest. No new provider, reference-image capability, gameplay mechanic or dynamic equipment binding is introduced.
