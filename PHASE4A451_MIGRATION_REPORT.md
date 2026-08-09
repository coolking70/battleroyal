# Phase 4A-4.5.1 Migration Report

## First apply

The real local Candidate store was preflighted before any write and then migrated with:

```bash
npm run art:migrate:provenance-hashes -- --apply
```

Result:

- 54 Candidates inspected and valid.
- 54 content hashes recomputed from exact image bytes.
- 54 prompt hashes preserved.
- 35 approved provenance entries updated with the existing Candidate IDs, preserved `approvedAt`, preserved model/provider/public paths, and byte-derived `contentHash`.
- 0 Candidate IDs changed.
- 0 review statuses changed.
- 0 image files changed.
- 0 Manifest paths changed.
- 35/35 Candidate/public byte matches.
- 0 provider/API calls.

The machine-readable report is [`reports/phase4a451-migration.json`](reports/phase4a451-migration.json).

## Idempotence

After apply, the following commands both completed with `NO CHANGES`:

```bash
npm run art:migrate:provenance-hashes -- --dry-run
npm run art:migrate:provenance-hashes -- --apply
```

The final report records `totalCandidates=54`, `approved=35`, `pending=10`, `rejected=9`, `candidateIdsChanged=0`, `reviewStatusesChanged=0`, `publicCandidateHashMatches=35`, unchanged public asset tree hash, and `passed=true`.
