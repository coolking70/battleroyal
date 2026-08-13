# Phase 4P Human Playtest

Status: `NEEDS-HUMAN-PLAYTEST`

The implementation and automated checks are complete for this branch, but the
human acceptance gate is intentionally still open.

## Required smoke route

1. Start a new game with a deterministic seed such as `PHASE4P-APEX-ROUTE`.
2. Confirm the map does not show exact hidden Wild HP, UID, or loot contents.
3. Advance to the public Apex broadcast and verify only the named threat and
   zone are announced.
4. SEARCH the announced zone. Confirm the Apex is discovered only through the
   search result and that the formal encounter shows exact HP only after
   discovery.
5. Observe a special-move telegraph, use GUARD, and continue with ATTACK or
   FLEE. Verify FLEE preserves the same Wild identity and zone rather than
   respawning or cloning it.
6. Defeat one named Apex, SEARCH/PICKUP_GROUND the signature material, craft a
   depth-3 route such as Aegis Plate, and EQUIP it through the normal commands.
7. Confirm the Apex kill does not change BR kills, alive contestants,
   deathOrder, victory type, or ranking.
8. Save during the telegraph and once after the drop. Reload both saves and
   verify deterministic continuation.

## Human checks

- [ ] Named Apex broadcast is understandable and does not leak hidden state.
- [ ] Elite and Apex visuals/fallbacks fit modern urban survival tone.
- [ ] Telegraph is readable without being a free damage preview.
- [ ] GUARD and FLEE communicate their action-cost/redline behavior.
- [ ] Ground signature loot is discoverable and craft guidance is clear.
- [ ] Long-route crafting and equipment handoff are understandable.
- [ ] When all eligible Apex zones are restricted, no out-of-zone Apex appears;
      reopening a legal zone produces the public broadcast.
- [ ] The public broadcast names the correct Apex zone without exposing UID/HP.
- [ ] Telegraph → GUARD feedback is readable and communicates the reduction.
- [ ] NPC/Apex event-log entries are understandable during the route.
- [ ] The desktop and mobile layouts remain usable through the route.
- [ ] Terminal victory freezes the tick with no post-terminal world mutation.
- [ ] No new approved PNG or art manifest entry is required for this phase.

Do not change this status to accepted until a human has completed the route.
