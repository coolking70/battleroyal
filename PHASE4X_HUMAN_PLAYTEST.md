# Phase 4X Human Playtest

- Status: **NEEDS-HUMAN-PLAYTEST**
- Branch: `agent/phase4x-release-hardening`
- Automated tests, audits and the 3000-game matrices do **not** replace this
  visible-behavior review. Everything below is a Release-Candidate gate that
  only a human can close.

## Why these items are here

Phase 4X closed the automated gates: balance matrices, save/migration
regressions, the cross-phase release regression suite, scripted playthroughs
for all 8 characters, and the art/security audits. None of those can judge
readability, pacing, or whether an error message actually helps a player.

## Setup

Run `npm run dev`, play with several seeds and several characters. Record
seed, character, time and PASS/FAIL per item.

## Checklist

### A. Save / load UX (new in Phase 4X)

| # | Item | How to reproduce | PASS/FAIL |
|---|---|---|---|
| A1 | Saving and resuming mid-match keeps the run exactly where it was (zone, HP, inventory, encounter) | Save mid-encounter, reload the page, resume | |
| A2 | The old-version-save message is understandable and clearly says the save is NOT deleted | In devtools set `localStorage['zone-br.save.v3']` to a payload with `"version":"0.4.0"`, reload | |
| A3 | After that message, the player can still find and use a manual "clear save" path | Follow the UI from A2 | |
| A4 | A corrupted save produces a readable error, never a blank screen or a crash | Set the save key to `{ not json`, reload | |
| A5 | Finishing a match and then reloading never resurrects the finished run as "resumable" | Play to a loss, reload | |

### B. Balance feel (Phase 4X + 4X-AF1 changed character numbers)

The tuning is statistically justified (see `BALANCE_CHANGELOG.md`), but "does
it feel right" is a human judgement. Net changes vs. the pre-4X roster:

| 角色 | 改动 |
|---|---|
| 侦察员 scout | `maxHp` 95 → 104, `defense` 4 → 5 |
| 斗士 fighter | `perception` 4 → 6, `speed` 5 → 6, `maxStamina` 100 → 105, 逃跑惩罚 10% → 5% |
| 工程师 engineer | `defense` 5 → 6 |
| 医学生 medic | `defense` 3 → 4 |
| 生存专家 survivor | `maxStamina` 115 → 110 |
| 拾荒者 scavenger | `defense` 4 → 5, `maxHp` 98 → 100 |
| 猎人 hunter | `defense` 4 → 5 |
| 陷阱师 trapper | `defense` 8 → 7, `maxHp` 102 → 100, 反击加成 0.20 → 0.15 |

| # | Item | PASS/FAIL |
|---|---|---|
| B1 | 陷阱师 still reads as the tankiest character (defense 7, still highest) despite the HP and counter-bonus trims | |
| B2 | 生存专家 still feels like the endurance character after `maxStamina 115 → 110` | |
| B3 | 猎人 / 拾荒者 / 侦察员 feel less like they evaporate, without feeling tanky | |
| B4 | 斗士 still reads as the slow bruiser, not a scout — and the halved flee penalty does not make it feel slippery | |
| B5 | 工程师 still reads as a crafter, not a frontliner | |
| B6 | 医学生 still reads as "防御很薄" at defense 4 (still the roster's lowest) | |
| B7 | The corrected passive descriptions match what the player observes: 斗士 +1 dmg / −5% flee, 侦察员 empty-search to 40%, 医学生 +60% healing | |

### C. Release-candidate first impressions

| # | Item | PASS/FAIL |
|---|---|---|
| C1 | A first-time player can start and finish a match without external explanation | |
| C2 | No console errors on a cold load with an empty `localStorage` | |
| C3 | No console errors on a cold load with an existing valid save | |
| C4 | Text is not truncated or overlapping at 375px, 768px and 1280px widths | |
| C5 | The Phase 4W LLM panel is OFF by default and the game is unaffected while OFF | |
| C6 | With the LLM panel enabled but the API key left blank, play is completely normal and the network tab shows **zero** outgoing requests | |

## Known automated-only coverage

These were verified by tests, NOT by a human:

- terminal-state freeze after save/load (`tests/phase4xSaveMigration.test.ts` X-S12)
- the full save support matrix (X-S1…X-S16)
- cross-phase closure (`tests/phase4xReleaseRegression.test.ts` R0…R12b)
- 24 scripted playthroughs covering all 8 characters
