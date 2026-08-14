# Phase 4Q Human Playtest

Status: `NEEDS-HUMAN-PLAYTEST`

## Scope

- Begin a fresh game and visit multiple zones across the 12-zone map.
- Confirm each zone shows at least two named landmarks and that the panel exposes only coarse status, search counts, and facility charges.
- Use `SEARCH_LANDMARK` in a current zone, verify the positive stamina/time cost, and search the same landmark until it becomes exhausted.
- Use at least two facilities, including one healing or preparation facility and one repair/unlock facility. Confirm required tools and finite charges are consumed.
- Verify a searched landmark can trigger a Wild encounter, and that fleeing/resolving the encounter returns to exploration without respawning or replenishing landmark loot.
- Compare the Craft Guide static source list with the current source list after depleting a landmark; exact hidden item contents should remain absent before search.
- Exercise the underground service-room → sealed-passage dependency and the hospital operating-room finite treatment charges.
- Reach a terminal outcome, then attempt another search/facility action and confirm the state, time, and inventory do not change.

## Evidence to record

- Browser/device and viewport.
- Seed and character used.
- Zones visited, landmark searches, facilities used, and any Wild encounters.
- Screenshots of the current-zone landmark panel before and after depletion.
- Any visual, copy, accessibility, balance, or information-boundary issue.

This status intentionally remains `NEEDS-HUMAN-PLAYTEST` until an independent human review is completed.

## Phase 4Q-AF acceptance additions

- [ ] Locked facility clearly explains the required tool and unlock interaction.
- [ ] After unlocking secure storage, a subsequent search is available.
- [ ] Remote landmark depletion is not magically revealed to an actor outside the zone.
- [ ] Arriving at an exhausted landmark gives clear feedback and allows the player/NPC to choose another source.
- [ ] A lethal landmark hazard never shows a dead character successfully receiving loot or a pickup.
- [ ] NPCs visibly make use of landmark-driven resource routes during ordinary matches rather than only in scripted fixtures.

Status remains exactly `NEEDS-HUMAN-PLAYTEST` pending independent review.
