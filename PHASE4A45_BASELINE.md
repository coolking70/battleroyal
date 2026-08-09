# Phase 4A-4.5 Baseline

- Branch: `agent/phase4-art-pipeline`
- Development-start HEAD: `1794fe6` (`Complete Phase 4A-4.4 combat asset pipeline`)
- Tests at baseline: `1190`
- Formal AI assets at baseline: `32`
- Approved provenance mappings at baseline: `32`
- Published Manifest slots at baseline: `32`
- Pending candidates at baseline: `10`
- Rejected candidates at baseline: `9`

## Base Art inventory at baseline

| Category | Required base slots | Official | Optional/fallback |
| --- | ---: | ---: | --- |
| Character Portrait | 4 | 4 | — |
| Character Injured | 4 | 4 | — |
| Character Combat | 4 | 1 | Fighter/Engineer/Medic approved pending publish |
| Zone Background | 6 | 6 | Warning 6 null; Restricted 6 null, future variants |
| Zone Warning | 0 | 0 | Optional future variant; not a base-art blocker |
| Zone Restricted | 0 | 0 | Optional future variant; not a base-art blocker |
| Item Icon | 12 current ArtTasks | 12 | — |
| World Event Illustration | 6 event IDs | 5 | Rain fallback-only; provider compatibility blocked |

## Candidate state

The three user-approved Combat candidates are present and technically validated. They were intentionally not approved at the baseline snapshot. Older pending and rejected candidates remain in local history and are not deleted; the baseline counts are read from the candidate metadata store.

## Frozen scope

No image API call is permitted in this phase. `src/core/**`, `src/data/**`, game rules, save schema, balance, Rain generation and future Zone variants remain frozen.
