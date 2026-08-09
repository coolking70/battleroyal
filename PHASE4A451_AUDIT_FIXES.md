# Phase 4A-4.5.1 Audit Fixes

## HASH-01 — `contentHash` was actually a prompt-input hash

- Root cause: `contentHash(built)` hashed `JSON.stringify(promptHashInput(built))`.
- Files changed: `tools/art/hash.ts`, `tools/art/cache.ts`, generator/batch/CLI imports.
- Fix: renamed the generation-input operation to `generationInputHash`; cache keys remain prompt hashes.
- Tests: canonical prompt hash and cache-key tests.
- Result: PASS.

## HASH-02 — Candidate `contentHash` equaled `promptHash`

- Root cause: Candidate metadata assigned both fields from the same value.
- Files changed: `tools/art/generator.ts`, `tools/art/types.ts` contract usage.
- Fix: Candidate `contentHash` is `sha256Bytes(result.bytes)`; `promptHash` is the generation-input hash; `hash` remains the immutable Candidate ID.
- Tests: generation, cache, duplicate-candidate and Candidate ID independence tests.
- Result: PASS.

## HASH-03 — Approved provenance lacked real image-byte binding

- Root cause: publish copied metadata hashes without checking Candidate bytes.
- Files changed: `tools/art/provenanceHashMigration.ts`, `tools/art/publisher.ts`.
- Fix: preflight migration recomputed all 54 Candidates and updated the 35 approved provenance entries without changing IDs, statuses or approval times.
- Tests: migration preflight/apply/idempotence and complete-chain tests.
- Result: PASS.

## HASH-04 — Public replacement could evade the old audit

- Root cause: old audit checked existence/validation but not exact public bytes.
- Files changed: `tools/art/publisher.ts`, `tools/art/phase4a45Audit.ts`.
- Fix: `art:validate` and the Phase 4A audit compare Candidate bytes, Candidate contentHash, provenance contentHash and public bytes.
- Tests: valid same-size public replacement tamper test.
- Result: PASS; replacement is deterministically rejected.

## HASH-05 — `art:validate` lacked the complete Candidate → public chain

- Root cause: validation stopped at Manifest → provenance path checks.
- Files changed: `tools/art/publisher.ts`, CLI script wiring and audit reports.
- Fix: checks now include path, Candidate ID, promptHash, contentHash, review/validation status, Candidate bytes and public bytes.
- Tests: Candidate tamper, provenance contentHash tamper, provenance promptHash tamper and Candidate/public divergence tests.
- Result: PASS.

## HASH-06 — Historical Candidates needed lossless migration

- Root cause: 54 local historical metadata records used the old field semantics.
- Files changed: `tools/art/provenanceHashMigration.ts`, migration command/report/docs.
- Fix: default dry-run, complete preflight, atomic metadata/provenance writes, legal legacy promptHash recovery only, no Candidate rename/deletion/status change, and idempotent apply.
- Tests: read-only default, missing-image no-partial-write, status preservation and no-provider-call tests; real store migration completed.
- Result: PASS.
