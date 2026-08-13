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

### Player eliminated before match ends

- let the player be eliminated while at least two NPC contestants remain;
- confirm the match does not immediately show `GAME_ENDED` or a `player_died`
  terminal reason;
- wait for the NPC/world resolution to finish and confirm ResultScreen shows
  the player’s actual death time/cause, the real winner, and the real victory
  route.

### Alternative ranking

- keep multiple contestants alive while an NPC or the player completes
  Research or Extraction;
- confirm the actual winner is rank #1 even with zero kills;
- confirm other contestants who remain alive are not displayed as dead.

### NPC objective race

- observe an NPC with a Research or Extraction goal before the final objective
  exists;
- confirm it searches, fights wild enemies when needed, picks up ground drops,
  crafts through intermediate steps, and only then submits/calls/extracts;
- confirm the NPC does not suddenly receive a beacon or research package, and
  that private research progress is not broadcast before completion.

### Terminal freeze

- arrange for an NPC with a Research or Extraction objective to have 1 HP and
  a pending lethal poison tick, then let it complete the route;
- confirm the winner remains alive, the player receives the correct terminal
  result, and no extra world/zone/status-effect tick occurs after completion;
- confirm the visible event/result state ends with `GAME_ENDED` and does not
  show a later NPC action or post-victory mutation;
- repeat with the player completing Research and confirm the same terminal
  event boundary and valid winner state.

### Regression / presentation

- objective items, death loot, pickup, and inventory remain understandable;
- no new console errors or layout regressions appear at desktop and narrow sizes;
- ResultScreen distinguishes all three routes and remains legible on mobile.
