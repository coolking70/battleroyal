# Phase 4O Human Playtest Handoff

Status: `NEEDS-HUMAN-PLAYTEST`

Automated tests and browser smoke checks are not a substitute for this visual
gate. Before Phase 4O can be accepted, manually verify:

### Victory Paths

- the three cards distinguish last survivor, extraction, and research;
- each card shows understandable progress and the correct next actionable step;
- narrow/mobile layout keeps all cards and objective actions reachable.

### Extraction

- craft the beacon, reach station, and use `CALL_EXTRACTION`;
- the public broadcast identifies station/caller without exposing private inventory;
- countdown and ready state remain readable under combat pressure;
- leaving station cancels the call, returning permits a fresh call, and `EXTRACT`
  produces the correct route-specific result.

### Research

- Craft Guide points to research notes and Phase 4N wild material;
- research chain progress and missing materials are visible only to the player;
- crafting the package and submitting at lab produces the research result;
- final completion is public while intermediate research progress is not.

### Defeat by NPC objective

- an NPC extraction/research win shows the player lost while still alive;
- ResultScreen names the winning NPC and does not imply that a wild enemy won;
- the player is not incorrectly shown as killed when the loss was objective-based.

### Regression / presentation

- objective items, death loot, pickup, and inventory remain understandable;
- no new console errors or layout regressions appear at desktop and narrow sizes;
- ResultScreen distinguishes all three routes and remains legible on mobile.
