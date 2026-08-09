# Phase 4B-0 Prototype UI Debt

These are evidence-backed findings, not a claim that every item has already
failed human play. `RUNTIME-VERIFIED` findings come from the real browser
captures in `output/phase4b0-browser-runtime/`; other findings are source audits.

| ID | Severity | Surface | Finding | Player impact | Evidence | Recommended phase |
| --- | --- | --- | --- | --- | --- | --- |
| UX-001 | UX-HIGH | `GameScreen` / Zone stage | Official Zone Background is rendered as a 30×30 `stage-zone-visual`, not a scene | Six-area identity and atmosphere are not carried by the largest art assets | CODE-VERIFIED + RUNTIME-VERIFIED | 4B-1 |
| UX-002 | UX-HIGH | `ZoneMap` | Six zones are a disabled/enabled list; adjacency topology is not spatially legible | Movement planning requires reading each row rather than seeing routes | CODE-VERIFIED + RUNTIME-VERIFIED | 4B-1 |
| UX-003 | UX-HIGH | `EncounterPanel` | Enemy art is 42×56 and the player has no encounter-side visual; player state remains in the top strip | Encounter has a clear red card but weak player-vs-enemy composition | CODE-VERIFIED + RUNTIME-VERIFIED | 4B-2 |
| UX-004 | UX-HIGH | Character visual state | Injured and player Combat states resolve to an 18×18 StatusBar image; differences can be imperceptible | State switching exists technically but may not teach the player that the state changed | CODE-VERIFIED + RUNTIME-VERIFIED | 4B-2 |
| UX-005 | UX-HIGH | Search / loot | Search result is primarily a toast plus inventory/log mutation; no focal result card or short transition | Found, empty and encounter outcomes are not equally distinct | CODE-VERIFIED + RUNTIME-VERIFIED | 4B-3 |
| UX-006 | UX-HIGH | World events | Persistent events use a 30×30 banner icon; instant `emergency_broadcast` has no active banner and therefore no event image | Important event can be consumed only as log text | CODE-VERIFIED | 4B-4 |
| UX-007 | UX-HIGH | Zone status | Warning/Restricted have text tags and a top alert, but no icon/pattern/scene treatment | Urgency is easy to miss when attention is in the central stage or tab panel | CODE-VERIFIED | 4B-4 |
| UX-008 | UX-MEDIUM | Action surfaces | Search/rest, move, skill, nearby combat actions and encounter actions are distributed across four areas | Players must scan the whole shell to find the next legal action | CODE-VERIFIED + RUNTIME-VERIFIED | 4B-1/4B-2 |
| UX-009 | UX-MEDIUM | Inventory / craft / ground | Item art appears only in 18px inventory rows; equipment slots, recipes and ground loot are text-only | Item category and identity are inconsistent across contexts | CODE-VERIFIED + RUNTIME-VERIFIED | 4B-3 |
| UX-010 | UX-MEDIUM | Right tabs | Inventory, Craft and Log are mutually hidden behind tabs | Planning information is available but not continuously visible | CODE-VERIFIED + RUNTIME-VERIFIED | 4B-3 |
| UX-011 | UX-MEDIUM | DebugPanel | Debug overlay is opt-in but fixed over the lower-right play area and can cover content | Development diagnostics can distort visual inspection and playtest screenshots | CODE-VERIFIED | 4B-6 |
| UX-012 | UX-HIGH | Mobile shell | `.game` hides overflow; board columns stack with max-height caps. The 390×844 encounter capture shows the map and stage clipped rather than naturally scrollable | Portrait players may not reach all zones, actions or encounter resolution controls | CODE-VERIFIED + RUNTIME-VERIFIED | 4B-5 |
| UX-013 | UX-MEDIUM | ResultScreen | Result is a dense metrics/table/timeline report without formal character, Zone or event art | Win/loss has information but limited emotional/visual closure | CODE-VERIFIED | 4B-6 |
| UX-014 | UX-LOW | Global CSS | Repeated borders, mono labels and small type create a laboratory/debugger tone | Does not block comprehension but reduces spatial hierarchy and atmosphere | CODE-VERIFIED + HUMAN-PLAYTEST-NEEDED | 4B-6 |
| UX-015 | UX-MEDIUM | Accessibility | No global `:focus-visible` treatment; disabled reasons often live only in `title` attributes | Keyboard and touch users may not understand focus or disabled causes | CODE-VERIFIED | 4B-6 |

## Priority interpretation

Only UX-012 is a directly observed mobile reachability risk. UX-001, UX-003,
UX-004 and UX-005 are visual comprehension risks observed in the screenshots.
UX-014 remains a style judgment and requires human playtest confirmation.
