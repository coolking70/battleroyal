# Phase 4B-0 UI Surface Inventory

Evidence labels: `CODE-VERIFIED` means the source confirms the claim;
`RUNTIME-VERIFIED` means the browser audit observed it; `HUMAN-PLAYTEST-NEEDED`
means qualitative play should still decide whether the proposed hierarchy
feels right.

| Surface / component | Purpose and primary information | Primary actions | Assets consumed | State dependencies | Responsive behavior | Known problem / importance |
| --- | --- | --- | --- | --- | --- | --- |
| `MenuScreen` | Start context, rules summary, seed and four character choices | Start, resume, random/default seed, select character, delete save | Character Portraits at 42×42 | Save status, seed, character definitions, version | Character grid auto-fits; menu remains centered | Good functional entry, still text/card-heavy; P1, `RUNTIME-VERIFIED` |
| `StatusBar` | Time, alive count, HP, Stamina, attack/defense, zone alert, current character | Quit | Current Portrait/Combat/Injured at 18×18 | HP ratio, encounter, zone status, next-zone countdown, guard/EXPOSED | Wraps; on phone consumes multiple rows | P0 values are present but compressed into a diagnostic-looking line; P0, `RUNTIME-VERIFIED` |
| `ZoneMap` | Six zones, adjacency, current zone, status, noise, fresh intel and ground-item count | Move to adjacent zone | Zone SVG/official images at 20×20 | Zone status, adjacency, noise, intel, pending/encounter lock | 232px desktop column; 200px ≤1080px; capped 340px ≤760px | List does not express topology; background art is thumbnail only; warning/restricted states rely on tags; P0/P1, `RUNTIME-VERIFIED` |
| Intelligence panel | Last-known public location information | None | None | `listIntel`, freshness/death | Capped 180px scroll | Correctly preserves information hiding, but competes with map; P2, `CODE-VERIFIED` |
| Central stage | Current Zone name/description, active event, pickup, encounter, presence, ground loot | Pickup, nearby attack/guard/flee, skill, close encounter | Zone image at 30×30; event icon at 30×30; enemy character at 42×56 | Current zone, active events, pending pickup, encounter, presence, ground items, skill | Central column; scroll container on desktop, clipped by mobile shell | Main visual area is mostly empty text/panels; Zone Background is not a scene; P0/P1, `RUNTIME-VERIFIED` |
| `EncounterPanel` | Enemy identity/character, HP descriptor/bar, weapon, flee chance, combat log and attack outcomes | Quick/normal/heavy attack, skill, guard, flee, continue | Enemy Combat/Injured at 42×56 | Encounter resolution, visible enemy fields, HP, stamina, weapon, Guard/EXPOSED, shared combat odds | Flex-wrap; player side is absent | Visually salient red panel, but no player-side portrait/combat state; P0, `RUNTIME-VERIFIED` |
| Presence section | Coarse local threat before encounter | Nearby attack, guard, flee | None | `zonePresence`, encounter lock, action-cost legality | Inline actions wrap | Properly avoids hidden NPC disclosure, but mixes exploration and encounter actions; P1, `CODE-VERIFIED` |
| `ActionBar` | Search/rest availability and generic turn-cost hint | Search, rest | None | Search legality, pending/encounter lock, zone status | Wraps at bottom; remains in document shell | Search is primary but only one button receives primary styling; feedback is toast + log; P1, `RUNTIME-VERIFIED` |
| `Inventory` | Equipment slots and eight inventory stacks | Use, equip, unequip, drop | Item Icons at 18×18 in inventory rows | Inventory, equipment, lock state, item category | Right column; becomes a stacked block on narrow screens | Equipment slots and ground/craft views have no item art; item icons are too small to carry identity; P1/P2, `RUNTIME-VERIFIED` |
| `CraftPanel` | Recipes, missing materials, cost, craft goal and search recommendations | Craft, set/cancel goal | No item images; names/category tags only | Recipe views, materials, goal, stamina, encounter/pickup lock | Right-column scroll; 420px cap at ≤1080px | Technically informative but reads like a debug list; P2, `RUNTIME-VERIFIED` |
| `EventLog` | Filtered history for combat/items/zones/world/death/actions | Filter, self-only | No event illustrations | Event stream, player actor ID | Right-column tab and scroll | History is separated from immediate feedback, but hidden behind a tab; P3/P2, `RUNTIME-VERIFIED` |
| World event banner | Persistent active event effect, duration and scope | None | Official event icon at 30×30 | `activeWorldEvents`; duration > 0 | Central stage stack | Good persistent pattern, but instant events have no banner and all persistent events share one small treatment; P0/P1, `CODE-VERIFIED` |
| `PendingPickupPanel` | Full-inventory decision | Replace/drop or abandon | Text-only item name | `pendingPickup`, inventory lock | Central stage, grid wraps | Correct blocking feedback; item identity could be more visual; P1, `CODE-VERIFIED` |
| `DebugPanel` | Development diagnostics and save/rule audits | Collapse, copy/export, validate, weaken NPC | Debug asset source/Manifest metadata | URL `?debug=1`, full GameState | Fixed 320px overlay, full-width on phone | Correctly opt-in but can occlude gameplay; must remain development-only; P3, `CODE-VERIFIED` |
| `ResultScreen` | Outcome, rank, metrics, final equipment, timeline | Restart same seed, return menu | No formal art | End status, rank, events, inventory/equipment | Single 720px column; scroll page | Complete data but no strong visual closure or character/Zone imagery; P3, `CODE-VERIFIED` |

## Surface-level conclusion

The current prototype has broad functional coverage but distributes P0/P1
information across many similarly weighted bordered boxes. The main shell should
be rebalanced around one Zone scene, one survival/status cluster, and one clear
action cluster before polishing secondary tabs.
