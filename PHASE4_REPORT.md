# Phase 4 Report — AI Art Pipeline

## Scope and result

Phase 4 technical pipeline is complete on `agent/phase4-art-pipeline`. It supports stable task definitions, audited prompt construction, SHA-256 content hashes, cache hits, provider retries, base64/URL response handling, candidate metadata, automatic validation, explicit review, approved-only atomic publish, runtime Manifest loading, and browser fallback.

The technical pipeline is **PASS**. The first real Round A call is **blocked by provider authentication**: the supplied credential was sent once to the configured Agnes endpoint using Bearer authentication, and the service returned `401` / `无效的令牌`. Because authentication failures are non-retryable, the remaining three Round A calls were not attempted. No candidate was produced, no image was approved, and the formal Manifest was not changed.

## Baseline and preflight

- Starting commit: `9dbdc85c0fbef3ee66250860f836c0ac94abca28`.
- Phase 3A-2 was fast-forwarded into local `main`; work continued on `agent/phase4-art-pipeline`.
- Medic NPC no longer uses bleeding/DoT alone to trigger `emergency_treatment`.
- `VisualImage` resets its fallback stage when the visual resource changes.
- `PHASE3A2_REPORT.md` records the actual final commit.
- 32 stable tasks are defined: 8 character variants, 6 zones, 12 item icons, 6 world events.

## Security

- `tools/art/apiClient.ts` is Node-only and reads only `process.env.IMAGE_API_KEY`.
- No `VITE_IMAGE_API_KEY` is used.
- The key is absent from `src/`, `public/`, `dist/`, cache, candidate metadata, reports, and Git-tracked files.
- CI runs `art:security`, `art:doctor --offline`, `art:validate`, and a full dry-run without a key.
- Runtime image failures only use fallback; the browser never calls the provider.

## Validation evidence

- `npm run typecheck`: PASS.
- `npm test`: 42 files, 584 tests PASS.
- `npm run build`: PASS; Vite bundle remains separate from public image assets.
- `npm run audit:save`: PASS.
- `npm run audit:deps`: PASS.
- `npm run art:doctor -- --offline`: PASS.
- `npm run art:validate`: PASS.
- `npm run art:security`: PASS.
- `npm run art:generate -- --dry-run`: PASS; 32 planned tasks, 0 API calls.
- `npm run simulate -- --games 500 --seed-prefix PHASE4`: PASS; no engine exception gates were reported.
- Browser smoke: menu and gameplay screenshots rendered with no console error artifact; official/fallback UI remained visible.

## Review boundary

The production state remains deliberately conservative:

```text
generated assets: 0
human-approved assets: 0
published AI assets: 0
```

Once a valid provider key is available, run the four Round A tasks individually. Review each candidate visually, then use `art:approve` and `art:publish` only for explicitly selected candidates. Until then the existing SVG/emoji fallback remains the official runtime path.
