# Phase 4A-0 Report — Provider Compatibility & Publish Closure

## Result

The Phase 4A-0 infrastructure closure is **PASS** after the provider contract, metadata, validation, cache, review, publish, report, security, and CLI boundaries were implemented and tested. The real provider execution remains **BLOCKED BY CREDENTIAL**: the previously supplied Agnes credential returned HTTP 401 invalid token on the single Scout attempt. No further provider request was made, and no image was approved or published.

## Scope

Gameplay and core simulation code were frozen. Changes are limited to the art tools, provider adapter, cache/candidate metadata, review/publish pipeline, reports, docs, tests, CI, and the existing visual fallback interfaces.

## Acceptance evidence

- Baseline: 584 tests passed before Phase 4A-0 changes; baseline commit recorded in `PHASE4A0_BASELINE.md`.
- Phase 4A-0 target: at least 610 tests, including Agnes body fixtures, actual-resolution validation, cache integrity, review uniqueness, publish rollback/idempotence, and CLI/report boundaries.
- Agnes request body is contract-tested and excludes unsupported legacy fields.
- Provider attempt, dry-run, Round A, balance, and command results use separate report files.
- Browser and tracked-repository secret scans are separate CI commands.
- `art:generate` defaults to concurrency 1 and accepts only 1–2.
- `art:api-check` is offline configuration validation; `art:smoke` is the explicit one-task real call.

## Round A state

| Task | State |
|---|---|
| `character/scout/portrait` | attempted once; HTTP 401 credential block |
| `zone/school/background` | not attempted |
| `item/bandage/icon` | not attempted |
| `world_event/blackout/illustration` | not attempted |

Generated candidates: 0. Approved assets: 0. Published AI assets: 0. The existing SVG/emoji fallback remains the runtime path.

## Balance note

The required 500-game Phase 4A-0 balance run completed with engine and Phase 3A gates passing. The observed character balance ratio was recorded as a non-blocking observation in `reports/phase4a0-balance.*`; no gameplay tuning was introduced because core gameplay is frozen for this phase.

## Next operator action

Provide a valid Agnes credential through the local environment only, then run the Round A tasks individually. Visually review each pending candidate, approve selected candidates explicitly, and publish only after review.
