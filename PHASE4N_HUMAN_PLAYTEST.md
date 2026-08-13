# Phase 4N Human Playtest Handoff

Status: `NEEDS-HUMAN-PLAYTEST`

Automated tests verify the data and rules, but a human still needs to confirm that the visual hierarchy communicates the new PvE layer without exposing hidden ecology state.

## Checklist

- Start a new game and confirm the map lists static “常见威胁” names for zones without showing live counts or `wN` IDs.
- Search until a wild encounter appears; confirm the fallback emoji/color visual, enemy name, exact HP display, threat, behavior, and drop category are readable.
- Confirm the encounter does not show exact drop probabilities or individual future spawn information.
- Attack, guard, and flee; confirm the same action styles and durability behavior are understandable and that a wild kill does not change contestant alive count or victory state.
- After a kill, confirm the drop appears on the ground and only the owning player can pick it up. Confirm the default log shows the player’s relevant wild event but not a remote NPC’s wild activity.
- Set a public Phase 4N craft goal and follow the route. Confirm the guide names static common threats/zones, never live populations or drop rates.
- Confirm the final component/final craft can be equipped through the normal UI action.
- If using a saved mid-combat state, confirm reload resumes the same wild UID, HP, status, zone, and drop resolution state.

## Evidence to record

Record browser viewport, seed, action sequence, whether the wild target was visible only after local discovery, whether the drop ownership cue was clear, and any console/page error. Attach screenshots for one active wild encounter, one ground drop, and the final craft/equip state.

## Known handoff boundary

This document intentionally does not claim human visual approval. Pre-release compatibility for older saves is also intentionally deferred.
