# Phase 4B-0 Zone Presentation Specification

## Compared layouts

| Option | Shape | Benefits | Risks / cost |
| --- | --- | --- | --- |
| A — Map-led | Large topology map; selected Zone Background as preview | Clear movement planning and adjacency | Underuses six scene assets; preserves board-game/debug tone |
| B — Scene-led | Zone Background dominates; small map handles movement | Highest art visibility and immersion | Movement topology can become secondary; more overlay work |
| C — Hybrid | Zone Background is the stage; translucent compact map/navigation overlays or docks beside it | Preserves planning while promoting the six official scenes; supports desktop and mobile | Requires careful contrast and responsive layering |

## Recommendation

# Phase 4B recommendation: C — Hybrid

Use the current Zone Background as the main gameplay scene, with a compact
semi-transparent map/navigation layer that keeps all six zones and current
adjacency available. The current Zone card can become a selected-zone preview
and movement surface rather than a permanent six-row wall.

Why: the project already owns six 1312×736 Zone Backgrounds, while the current
runtime spends them at 20×20/30×30. Hybrid gives those assets a meaningful
surface without removing the current information-complete map. It also limits
the first implementation to the shell and Zone presentation, rather than
mixing combat, inventory and mobile redesign into one change.

## Zone state treatment

| State | Visual layer | Non-color cues |
| --- | --- | --- |
| SAFE | Normal scene and neutral frame | `安全` label, shield/clear icon, no pattern |
| WARNING | Amber translucent edge/scanline overlay | `预警` label, warning icon, striped edge, countdown |
| RESTRICTED | Dark/red scene treatment and blocked-navigation frame | `禁区` label, hazard icon, diagonal pattern, damage-per-turn text |

Do not generate `warning` or `restricted` AI variants in 4B-0 or by default in
4B-1. Existing Background + CSS overlay + icon/label/pattern is sufficient and
keeps asset count and provenance stable. Revisit only after a human playtest
shows that the mixed treatment cannot be understood at phone size.

## Scope / risk

Scope is shell layout, Zone stage, navigation overlay and state treatment.
Out of scope are Core rules, movement cost, restricted-zone timing, new image
generation, and final mobile closure. Main risk is overlay contrast over dark
scene art; test at desktop and phone widths with text labels enabled.
