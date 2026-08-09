# Phase 4B-0 Visual Feedback Catalog

| Event | Level | Planned feedback | Historical log |
| --- | ---: | --- | --- |
| Search start | 1 | Button busy/pressed state and short progress cue | No extra duplicate line |
| Item found | 2 | Icon + item card/toast, quantity and destination | Yes |
| Nothing found | 1 | Neutral result microfeedback | Yes |
| Encounter started | 3 | Stage focus shift, red/hazard frame and enemy/player layout | Yes |
| Item equipped | 2 | Equipment slot highlight and stat delta cue | Yes |
| Consumable used | 2 | HP/Stamina bar pulse and numeric change | Yes |
| Craft completed | 2 | Output icon/card and goal progress update | Yes |
| Move completed | 1 | Scene/Zone transition cue and current-location highlight | Yes |
| Hit | 2 | Target HP change and short impact state | Yes |
| Miss | 1 | Compact miss text/state | Yes |
| Heavy miss + EXPOSED | 2 | Strong EXPOSED state on actor and risk message | Yes |
| Guard triggered | 2 | Guard badge/pose for next-hit protection | Yes |
| Flee | 2 | Exit/escape result card; keep failure chase information | Yes |
| Skill activated | 2 | Skill badge, cost and cooldown state | Yes |
| World Event triggered | 3 for major persistent, 2 for other | Persistent banner/badge with scope/duration; no blanket modal | Yes |
| Zone warning | 3 | Scene overlay, icon, pattern, label and countdown | Yes |
| Zone restricted | 3 | Hazard overlay, icon/pattern, damage-per-turn and blocked-route cue | Yes |
| Damage over time | 2 | HP bar pulse and source label | Yes |
| Heal | 2 | HP bar recovery cue and source | Yes |
| Character injured state | 2 | Perceptible Injured art plus HP warning | Yes |
| Death | 3 | Clear defeat/death transition and result focus | Yes |
| Victory | 3 | Strong result verdict and character/Zone closure art | Yes |

Level 1 is microfeedback, Level 2 is a local panel/card state, and Level 3 is
a major announcement or focus shift. Frequent events must not all become full
modals. Sound, music and voice remain future work and are not part of 4B-0.
