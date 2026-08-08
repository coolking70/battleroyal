# Phase 4A-1 Report — Live Provider Validation & Round A

## Final status

- Phase 4A-1 Infrastructure: **PASS**
- Agnes Live Provider: **PASS**
- Round A Technical Production: **PASS**
- Human Art Review: **PENDING**

The four Round A tasks were produced in strict order with `--concurrency 1`. Each first generation used `source=api`, `apiCalls=1`, and automatic validation passed. Scout was already produced by the preceding live confirmation and is reused as the first Round A live evidence; its independent cache verification used `apiCalls=0` and `cacheHits=1`.

| Task | Candidate hash | Actual size | MIME | Validation | Source | Review |
| --- | --- | ---: | --- | --- | --- | --- |
| `character/scout/portrait` | `14511e9a5fb98a79962cc31732cf92d30903a0613f6a3e7141dad4809fbaf625` | 864×1152 | image/png | passed | api | pending |
| `zone/school/background` | `0256c79e2c5a9e0ad48378e16e74849e7da3d0d864f056ab75697dc4043be1d1` | 1312×736 | image/png | passed | api | pending |
| `item/bandage/icon` | `fa8b8d8b6fc778c085592ab0d5e3a53d20002d6da8c99bc42cf9fbde388794bf` | 1024×1024 | image/png | passed | api | pending |
| `world_event/blackout/illustration` | `004497ade1bb934a4c80addfefcea9256327edcc1aa4edc067a8ec51dac0a78c` | 1312×736 | image/png | passed | api | pending |

Unique Round A tasks: 4. API-successful tasks: 4. Validation passed: 4. Selected review candidates: 4. Workspace candidates include two additional Scout cache-verification duplicates; this does not increase unique task coverage. Approved: 0. Rejected: 0. Published AI assets: 0.

`public/assets/manifest.json` and `art/approved-assets.json` were not changed by pending candidates. The existing Bandage SVG remains the runtime legacy asset. No approval or publish command was run.

## Review package

The four images and a human-review-only index/README are in `output/art-review/phase4a1-round-a/`:

- `scout-portrait.png`
- `school-background.png`
- `bandage-icon.png`
- `blackout-illustration.png`
- `index.json`
- `README.md`

The README leaves `Decision` and `Notes` blank. Automatic validation is intentionally separate from visual quality, consistency, composition, artifact, and UI-fit review.

## Regression and security

- 500-game Phase 4A-1 regression: requested 500 / actual 500, timeout 0, illegal state 0, hard limit 0, regression exit 0. Character balance is observation only.
- 625 tests passed; typecheck, build, save audit, dependency audit, offline doctor, manifest validation, browser secret scan, tracked repository secret scan, dry-run, and runtime audit passed.
- Remote GitHub Actions status will be recorded after push if available; no CI result is assumed or fabricated here.
