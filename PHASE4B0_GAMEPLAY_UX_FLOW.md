# Phase 4B-0 Gameplay UX Flow

This is an audit of the existing flow. It does not change Core rules or UI
behavior.

| Step | Player must know | Current UI provides | Missing / risk | Feedback strength |
| --- | --- | --- | --- | --- |
| Start / character selection | What each character is good at and what the run costs | Seed, rules paragraph, four cards with Portrait and stats/passive | Dense copy makes comparison slow; no clear recommended first decision | 2 / `RUNTIME-VERIFIED` |
| Enter area | Where I am and immediate danger | StatusBar current zone is text; ZoneMap highlights current row; stage title/description | No scene-scale Zone identity; current location competes with six-row list | 2 / `RUNTIME-VERIFIED` |
| Inspect map | Where I can go and why | Adjacent buttons, safe/warning/restricted tags, noise/intel | Topology is implicit in button states, not visually spatial | 1–2 / `RUNTIME-VERIFIED` |
| Search | Is search available, what does it cost, what is happening | Primary Search button, disabled reason/title, action hint | No distinct search-in-progress state; result depends on toast/log/inventory changes | 1–2 / `RUNTIME-VERIFIED` |
| Item found / nothing found | What changed and whether to use it | Toast, inventory row or empty text, event log | No focal result card; ground/pickup presentation is text-first | 2 / `RUNTIME-VERIFIED` |
| Equip / consume | What changed to my combat or survival state | Item row action, top attack/defense/HP/Stamina updates | Equipment slot lacks item icon and change emphasis | 1–2 / `CODE-VERIFIED` |
| Craft | What goal to pursue, which materials are missing, and cost | Craft tab, goal card, missing-material text, destination recommendations | Recipe list is technical and hidden behind tab; no upgrade/progress visual | 1–2 / `RUNTIME-VERIFIED` |
| Move | Destination, cost, legality and risk | Adjacent Zone buttons, title cost, bottom hint | No route visualization or transition; movement is a list click | 1 / `CODE-VERIFIED` |
| Encounter starts | That ordinary exploration has become a high-risk state | Red EncounterPanel, enemy image, log, disabled Search/Move, attack controls | Player side is not visually represented; stage remains structurally similar around it | 2 / `RUNTIME-VERIFIED` |
| Attack / guard / flee / skill | Choice tradeoff, cost, hit/flee chance, current statuses | Per-button cost/accuracy titles/text, Guard/EXPOSED tags, combat log | Many controls are equally sized; no central action posture or outcome emphasis | 2 / `RUNTIME-VERIFIED` |
| Enemy leaves or dies | Whether threat is resolved and what can resume | Encounter resolved state and Continue button; log | Resolution could be more visually final and return focus to next action | 1–2 / `CODE-VERIFIED` |
| World event | What changed, scope, duration, and whether it affects me now | Persistent banner with icon, scope, remaining turns; log | Instant broadcast has no banner/image; event treatment is uniform | 1–2 / `CODE-VERIFIED` |
| Zone warning / restricted | Which zone is unsafe, when, and what action is urgent | Map tag, top alert/countdown, restricted text | No icon/pattern/overlay on Zone image; current status is easy to miss in list | 1–2 / `CODE-VERIFIED` |
| Finale | Why normal exploration should stop and what survival priority changed | Phase/state/event/log data; same shell | No dedicated transition treatment in the main screen | 1 / `CODE-VERIFIED` |
| Victory / defeat | Outcome, cause, rank and what to learn | Verdict, metrics, rank table, timeline, restart/menu | Strong data closure but weak visual/asset closure | 2 / `CODE-VERIFIED` |

## Flow principle for Phase 4B

The next implementation should strengthen the visual transition between
exploration, danger, and resolution without changing what the Core exposes.
The UI may emphasize only values already legal in the current rule set: it must
not add hidden NPC HP, equipment, skills, or future actions.
