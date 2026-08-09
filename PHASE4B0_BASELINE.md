# Phase 4B-0 Baseline

## Frozen repository state

| Field | Value |
| --- | --- |
| Branch | `agent/phase4-art-pipeline` |
| HEAD | `521f8756a364b38ebd91b18b97d4a5dac3aea4fa` |
| Package version | `0.3.2` |
| `GAME_VERSION` | `0.3.2` |
| Previous test baseline | 57 files / 1236 tests |
| Phase 4A state | Base art production complete; provenance content integrity PASS |
| Image API calls in this phase | 0 |

The working tree contains two pre-existing user-owned modifications in
`reports/save-validation-audit.json` and `reports/save-validation-audit.md`.
They are not part of this phase.

## Formal art baseline

| Asset family | Coverage | Runtime note |
| --- | ---: | --- |
| Character Portrait | 4 / 4 | Menu card and 18px status icon |
| Character Injured | 4 / 4 | Presentation resolver at HP ≤ 35%; status icon only in current UI |
| Character Combat | 4 / 4 | Enemy encounter thumbnail; player remains a status icon |
| Zone Background | 6 / 6 | Loaded from Manifest but rendered as 20px map icon / 30px stage icon |
| Item Icon | 12 / 12 | Inventory row only, 18px; craft/equipment/ground views use text |
| World Event | 5 / 6 | Five official illustrations; Rain remains documented runtime fallback |
| Formal AI assets | 35 | Must remain byte-for-byte unchanged |

Manifest has no AI `warning` or `restricted` Zone variants. `rain` has the
documented fallback exception. Phase 4B-0 does not alter either condition.

## Current UI component map

The real surface is a React/CSS prototype, not a canvas game:

- `MenuScreen`: start/resume, seed, four-character selection and Portrait cards.
- `GameScreen`: three-column shell; `StatusBar`, `ZoneMap`, intelligence list,
  central Zone stage, event banners, pickup/encounter/presence/ground sections,
  tabbed `Inventory`/`CraftPanel`/`EventLog`, and `ActionBar`.
- `EncounterPanel`: enemy art, enemy HP/descriptor/weapon, combat log, attack
  styles, Guard, Flee and character skill controls.
- `DebugPanel`: URL `?debug=1` development overlay with runtime, asset, save,
  NPC and rule diagnostics.
- `ResultScreen`: outcome, metrics, equipment/inventory, ranking and timeline.

## Runtime evidence captured

The browser audit used the real Vite app at 1280×720 and 390×844. Evidence is
in `output/phase4b0-browser-runtime/` (ignored development evidence):

- `01-gameplay-initial.png`: initial exploration shell.
- `02-after-search.png`: item result, inventory change and toast.
- `03-encounter.png`: active encounter, enemy Combat art and combat controls.
- `04-craft-tab.png` / `05-log-tab.png`: secondary tab surfaces.
- `06-mobile.png`: mobile clipping/stacking evidence.
- `runtime.json`: `render_game_to_text`, button states, text snapshots and errors.

Runtime observation is limited to the deterministic default seed path. Event
variant visibility, warning/restricted states and final result remain
code-verified or human-playtest-needed unless explicitly marked otherwise in
the Phase 4B-0 reports.
