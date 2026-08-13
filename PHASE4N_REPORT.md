# Phase 4N — PvE Wild Enemies & Drop Ecology

## Architecture Audit — 20 answers (first)

1. `Combatant` remains the player/NPC contestant model; wild enemies use `WildEnemyInstance` and a transient combat profile.
2. A wild enemy never enters `GameState.characters`; it is stored in `GameState.wildEnemies` and indexed by `ZoneState.wildEnemyIds`.
3. The canonical combat path still expects `Combatant`, so `wildCombatProfile()` adapts only the live wild instance for a round and never persists that adapter.
4. `EncounterState.targetKind` discriminates `contestant` and `wild`; all current production encounters write the discriminator.
5. Wild kills do not touch `aliveCharacters`, contestant victory, rank, or PvP kills.
6. Victory remains based only on `GameState.characters` alive contestants.
7. Wild drops are ground `ItemStack`s, never loser-inventory transfer.
8. Wild defeat does not call contestant death handling; player damage still uses canonical `applyDamage`, so player death remains authoritative.
9. Event projection hides remote wild events; player-participating combat and owned `WILD_DROP_CREATED` remain visible.
10. NPC PvE attacks are supported through `NpcDecision.targetKind` and the shared wild combat functions.
11. Wild FLEE uses the same action-cost/destination rules for a contestant and a local wild target, with the zero-stamina escape path preserved.
12. GUARD reuses the canonical action and incoming-damage adjustment; wild AI can also take a deterministic guard action.
13. quick / normal / heavy styles use the canonical attack preparation, hit chance, damage, and durability wear.
14. Wild status effects are data-driven and isolated; venom uses the validated `wild_poison` status, while enrage/evasive/armored are transient profile effects.
15. Player weapon durability wears on wild attacks exactly as on contestant attacks.
16. Wild enemies have no stamina resource.
17. Wild enemies have no inventory, profession, EXP, or contestant progression.
18. Drops are placed on the current zone ground with `droppedBy`, `revealedTo`, and `dropResolved` ownership/idempotence fields.
19. Population generation is deterministic from `phase4n:${seed}:${zoneId}`, independent per zone, finite at 1–4 instances, and has no respawn path.
20. Current-schema save/load stores populations, uid sequence, HP/status/zone/drop state, encounters, and events; unknown definitions, duplicate UIDs, invalid HP/status/zone references, and invalid encounter discriminators are rejected.

## 1. Executive Summary

Phase 4N adds a finite, deterministic urban PvE ecology with ten wild enemy definitions across all twelve zones, ground-only special drops, a multi-layer crafting branch, NPC awareness, AutoPlayer coverage, save validation, and player-facing information boundaries. No PNG or formal art asset was added.

## 2. Phase 4M Merge

The Phase 4M baseline was verified at merged PR #20, then local `main` was synchronized to merge SHA `bd7585e73184fedd874dce158074c993f6e4f71b`. Phase 4N work was done on `agent/phase4n-pve-wild-enemies`.

## 3. Architecture Audit

The answers above are the pre-implementation audit. The implementation follows the independent wild entity model in `src/core/types/wildTypes.ts`, `src/core/wildPopulation.ts`, and `src/core/wildCombat.ts`.

## 4. Wild Enemy Model

`WildEnemyDef` contains identity, threat, behavior, combat values, ability, fallback visual, drop table, and encounter weight. `WildEnemyInstance` contains only deterministic runtime state: UID, definition, zone, HP, status, ability charges, status effects, and drop resolution state.

## 5. Enemy Roster

The roster has 10 modern urban threats: feral dog, tusked boar, venom snake, rat swarm, carrion crow, security hound, patrol drone, maintenance bot, escaped subject, and resin stalker. It includes animal, mechanical, and experimental threat categories, with enrage, charge, venom, evasive, and armored abilities.

## 6. Zone Ecology

All 12 zones have static ecology tables. The map shows only the first two static common threats for each zone; it never shows live population counts, UIDs, or drop rates.

## 7. Population Model

Each zone receives 1–4 deterministic instances. UIDs are stable (`w0`, `w1`, …), no command creates a replacement, and defeated instances remain in the save as historical population state. A wild self-flee resolves only the current encounter and leaves the same alive instance in its zone. Same seed produces the same population; a different seed produces a different ecology assignment.

## 8. PvE Encounter

SEARCH weighs living wild targets alongside contestants and returns a discriminated encounter. The active target UI shows name, exact HP bar/value, threat, behavior, drop category, and the emoji/color fallback visual. Wild encounter start, attack, defeat, flee, and drop events are recorded with UID/definition metadata.

## 9. Combat Reuse

`combatRound.ts` centralizes attack preparation, stamina/adrenaline effects, weapon wear, and incoming guard/exposed/frenzy adjustment. Wild combat calls the canonical hit chance, damage, style, durability, and damage-application paths. Wild targets do not gain contestant EXP, inventory, or profession state.

## 10. Drop Ecology

Every wild kill resolves drops once onto the zone ground. Stacks record `droppedBy`; visibility is controlled by `revealedTo` and the existing ground-item access rules. The killer can pick up owned drops, other players cannot leak or directly receive them, and `dropResolved` blocks duplicate creation.

## 11. Wild Materials

Eight wild-only raw materials were added: animal hide, animal bone, venom gland, sinew, feral fang, mechanical core, optical sensor, and bio resin. All eight have drop-table sources and are excluded from starting materials.

## 12. Crafting Integration

Six intermediate components and four final outputs were added. There are 10 Phase 4N recipes, all eight raw materials are used, and final routes reach depth at least two. Existing Phase 4M recipes remain in the same registry and item conservation path.

## 13. Craft Guide

`WorldSource` now distinguishes `zone_loot` from `wild_drop`. Craft plans aggregate static source zones and enemy IDs; the guide and codex name common threats and zones but do not expose live populations, individual presence, or exact drop probabilities. Guidance remains a recommendation and does not promise that an enemy exists.

## 14. NPC

NPCs can discover wild targets, choose wild goals from current planner gaps, attack/guard/flee using the same rules, collect owned ground drops, and continue their normal craft planning. Remote NPC wild actions remain hidden from the default player event projection.

## 15. AutoPlayer

The representative route uses only legal formal commands and has a deterministic passing seed: `PHASE4N-ROUTE-hunter-2`. It covers `SET_CRAFT_GOAL → MOVE → SEARCH → ATTACK → PICKUP_GROUND → CRAFT → EQUIP`, with no illegal commands and a completed wild-material goal. `DEBUG_GIVE` remains zero.

## 16. Information Boundary

Wild encounter details are revealed only for the active/local target. The default log projects player-relevant wild combat and owned drop events, while remote NPC wild activity and remote drops remain hidden. Map and codex surfaces use static ecology/provenance only.

## 17. Save Current Schema

`GAME_VERSION` and package version are `0.5.0`; `SAVE_KEY` is `zone-br.save.v3`. Current saves include wild registry state, per-zone UID lists, `wildUidSeq`, encounter discriminator, wild references, status effects, drop flags, wild statistics, and wild events. Mid-combat save/continue is deterministic.

## 18. Tests

Full suite: 97 test files, 1556 tests passed. Phase 4N-focused tests cover registry/ecology, deterministic populations, combat/guard/flee/venom, exact-once drops and ownership, zero stamina, mid-combat continuation, corruption rejection, UI projection, map static threats, and AutoPlayer closure. TypeScript typecheck passed.

## 19. 500 Regression

Required command completed:

`npm run simulate -- --games 500 --seed-prefix PHASE4N --regression --output reports/phase4n-regression.json`

The run used 500 actual games, 40 role/strategy cells, 100% trustworthy games, zero timeout, zero illegal/deadlock/livelock/empty-legal-set cases, and zero hard-limit reaches. PvE observation totals were 7017 encounters, 1422 kills, 4255 wild flees, 2350 ground drops, 2437 pickups, and 92 wild crafts. The report records role balance as observation-only per the Phase 4N gate policy; its ratio was 7.58, while the engine-health regression gate passed.

## 20. Human Playtest

Automated UI coverage is green, but the human visual gate remains `NEEDS-HUMAN-PLAYTEST`. The handoff checklist is in `PHASE4N_HUMAN_PLAYTEST.md`; it asks a human to verify wild fallback visuals, encounter disclosure, local ground drop ownership, map static-threat wording, and the complete craft/equip route.

## 21. Deferred

Backward compatibility for pre-Phase4N saves is explicitly `DEFERRED UNTIL PRE-RELEASE`. `loadGame()` rejects older versions and does not call the historical migration helper, preserving old data instead of silently fabricating consumed wild populations. Phase 4N does not add new PNGs, a boss system, weather ecology, or Phase 4O work.

## Phase 4N-AF — Wild Self-Flee Ecology Fix

### Problem

The previous implementation treated a wild self-flee as `status=fled`. Because
`livingWildEnemiesInZone()` only returned `alive` instances, that historical
encounter event effectively permanently despawned the finite population entry.

### Fix

- Wild self-flee now resolves only the current encounter and keeps the same UID
  `alive` in the same zone.
- Persistent HP, `dropResolved`, and ability charges are retained; guarding and
  transient stance state are cleared.
- `WILD_FLED` remains a historical event with `direction: "wild"`; it no longer
  implies a permanent population lifecycle transition.
- Contestant FLEE remains a separate `direction: "contestant"` event and also
  leaves the wild instance alive.
- A later SEARCH can select the original UID again without respawn, replacement,
  re-roll, or HP reset.
- Only `status=defeated` calls `createWildDrops()`, preserving exact-once drops.
- `wildFleeCount` continues to count encounter disengagement events, not
  permanent population removals.

### Status model and save schema

`WildEnemyStatus` is now exactly `"alive" | "defeated"`. Current-schema
validation rejects `"fled"`; old-save migration remains
`DEFERRED UNTIL PRE-RELEASE`.

### Acceptance tests

`tests/phase4nAcceptanceFix.test.ts` covers:

- self-flee retaining alive status, UID, zone, HP, population membership, and
  ability charges;
- no drop on flee and unchanged contestant alive/death-order/kills state;
- same-UID re-encounter through production SEARCH;
- later defeat creating drops exactly once;
- contestant FLEE event direction and lifecycle separation;
- current-schema rejection of the removed `fled` status.

The existing zero-stamina FLEE/GUARD and victory-isolation regressions remain
green. No NPC closed-loop test was added in this narrow acceptance-fix pass;
existing Phase 4N production and AutoPlayer evidence remains unchanged.

### PHASE4N-AF regression

The required `PHASE4N-AF` run requested and completed 500 games, with 500/500
trustworthy games. Engine health passed: timeout=0, illegalState=0,
illegalCommand=0, deadlock=0, livelock=0, stall=0, emptyLegalSet=0, and
hardLimit=0. PvE observations were 7220 encounters, 1646 kills, 4796 flees,
2706 ground drops, and 103 wild crafts. The report's overall balance flag is
not a Phase 4N-AF gate: `BALANCE OBSERVATION ONLY — BALANCE DEFERRED`.

### AF gates

- Full suite: 98 files / 1560 tests passed.
- Typecheck and production build: PASS.
- Save audit: 102/102 corruption cases rejected; dependency audit R1=R2=R3=R4=0.
- Art doctor/validate/audit/security and production `npm audit --omit=dev`:
  PASS; production audit reports 0 vulnerabilities.
- Core/data largest file: `src/core/saveValidation/numbers.ts`, 478 lines.
- Human visual gate remains `NEEDS-HUMAN-PLAYTEST`.

## Gates and files

- `npm run typecheck`: PASS
- `npm test`: PASS, 97 files / 1556 tests
- `npm run audit:save`: PASS, 102/102 corruption cases rejected
- 500-game regression: engine-health PASS; balance is observation-only
- core/data source line cap: PASS; no `src/core` or `src/data` file exceeds 500 lines
- production art scope: no new PNG changes
- browser/human visual gate: automated menu/gameplay smoke PASS with screenshot and `render_game_to_text`; human gate remains NEEDS-HUMAN-PLAYTEST
