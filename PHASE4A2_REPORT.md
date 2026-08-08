# Phase 4A-2 Report

## Outcome

Formal Round A closure is complete for exactly three assets: Scout portrait, School background, and Bandage icon. Blackout v4 was rejected with the required human-review reason and is not in the Manifest. Blackout v5 was generated once, remains pending, and is not published.

Controlled Round B1 was stopped after the first three serial character calls because all three showed clear gun/rifle or tactical/military contamination. Hospital, Medkit, and Rain were not called. No B1 asset was approved or published.

## Formal publish evidence

- Approved candidate hashes: Scout `2cad771df6a1017996e2aa3ef3f1dabc03b0fcb9756c3a005ed86006128093fd`, School `c475891838381390cf9e837cbf3745971c3e834d95650e5ec98ed8bb29e053c7`, Bandage `3e4d2edadc1b0cd8e2664be2224e1effa663c8fc01d61a170e5f7e4b6c9a09bb`.
- Published Manifest hash: `1a9d9d04fd1274190eb4a1b851644b2d3690c5d5e3e6ecbddf796304aab016a1`.
- `art:validate`: PASS.
- Second `art:publish`: `NO CHANGES`.
- Manifest/provenance closure: exactly three AI slots; Blackout absent.

## Generation evidence

- Blackout v5: one API call, technical validation passed, visual review pending; the image visibly retains green indicator lights and a visible ceiling, so no automatic approval was applied.
- B1 Fighter, Engineer, Medic: one serial API call each, technical validation passed, visual checks reached the stop threshold.
- B1 Hospital, Medkit, Rain: not called by the stop rule.
- Total live calls: 4. No `--force` was used and no retry occurred.

## Local gates

| Gate | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 671/671 |
| `npm run build` | PASS |
| `npm run audit:save` | PASS |
| `npm run audit:deps` | PASS |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:security:browser` | PASS |
| `npm run art:security:repo` | PASS |
| `npm run simulate -- --games 500 --seed-prefix PHASE4A2 --regression` | PASS — 500/500 |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |

## CI

Implementation commit `d0c62833e26d98d9db7a7ac92001443d3466c2c5` passed GitHub Actions run `31272434720` (`verify: success`). The run covered typecheck, 671 unit tests, build, save/dependency audits, offline art doctor/manifest validation, both secret scans, art dry run, and the CI quick simulation.

This report-only follow-up records that conclusion; the final handoff also re-checks the resulting remote HEAD.
