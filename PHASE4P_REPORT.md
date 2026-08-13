# Phase 4P — Elite PvE, Named Apex Threats & Unique Loot

## 1. Executive Summary

Phase 4P extends the existing finite Phase 4N Wild system with three threat
tiers: `common`, `elite`, and `apex`. Elite threats are finite deterministic
instances. Named Apex threats are scheduled public world arrivals, unique per
match, persistent after self-flee, and permanently defeated after canonical
Wild death. They remain Wild entities rather than contestants: they have no
profession, stamina, EXP, inventory, ranking, victory eligibility, or victory
type.

This report begins with the required architecture audit. Implementation will
reuse the existing Wild registry, `WildEnemyInstance`, search/discovery path,
canonical combat adapter, ground-drop ownership, craft planner, NPC action
system, and terminal tick boundary. New higher-tier values remain provisional;
balance is observation only.

## 2. Base / Git

- Phase 4O accepted head: `2f9ddacbde5ba4aab17ad2791a9ef028cfa21f8d`
- Phase 4O normal merge commit: `7e0c94c0f0a327bd6c78f5e0b5cb60adfb788b84`
- Phase 4P base SHA: `7e0c94c0f0a327bd6c78f5e0b5cb60adfb788b84`
- Branch: `agent/phase4p-elite-pve-unique-loot`
- Save compatibility: `DEFERRED UNTIL PRE-RELEASE SAVE FORMAT STABILIZATION`
- Balance policy: `BALANCE OBSERVATION ONLY — BALANCE DEFERRED`

## 3. PvE Architecture Audit

1. `WildEnemyDef` contains the Phase 4N fields plus `tier` (`common | elite |
   apex`), `specialAbilityId`, optional `eligibleZones`, and optional
   `signatureDropItemId`. The original fields are `id`, `name`, `description`,
   `maxHp`, `attack`, `defense`, `speed`, `encounterWeight`, `behavior`,
   `threat`, `dropCategory`, `dropTableId`, `abilityId`, `fallbackEmoji`, and
   `fallbackColor`.
2. `WildEnemyInstance` persists `uid`, `defId`, `zoneId`, `hp`, `status`,
   `guarding`, `abilityCharges`, `statusEffects`, persisted `pendingIntent`,
   `dropResolved`, and `defeatedAtTime`.
3. Ordinary finite Wild populations are initialized once by
   `initializeWildPopulations()` in `src/core/wildPopulation.ts`, called from
   `createGame()` in `src/core/gameState.ts`.
4. `livingWildEnemiesInZone()` reads only the zone's persisted
   `wildEnemyIds`, then filters instances whose status is `alive` and whose
   stored zone matches.
5. `defeatWild()` in `src/core/wildCombat.ts` is the canonical death path. It
   sets status/HP/guard/status effects/death time, increments Wild-only stats,
   and calls `createWildDrops()`, which is protected by `dropResolved`.
6. Wild self-flee is `wildFlees()`. It clears transient guard/status state,
   resolves the encounter, and preserves the same UID, zone, HP, ability
   charges, and alive status for later SEARCH discovery.
7. Player and NPC Wild attacks use `attackWildActor()` and the existing
   `combat`, `combatRound`, `vitals`, action-cost, guard, and flee helpers. No
   second boss combat engine exists.
8. Player Wild response runs once per time-advancing command in
   `advanceActiveWildEncounter()`. NPC response runs through `resolveWildTurn`
   from the formal NPC action path.
9. NPCs discover Wild through their own SEARCH action. `npcDecide` derives
   known Wild targets from relevant `WILD_ENCOUNTER_STARTED` events rather than
   scanning the entire live registry for a hidden target.
10. NPC Wild fight/flee choice is deterministic and based on target threat,
    actor state, personality, and current action context; low health can lead
    to flee or guard rather than unconditional attack.
11. AutoPlayer uses the same craft goal, `buildCraftPlan`, world source,
    movement, SEARCH, combat, ground pickup, CRAFT, and EQUIP commands. Phase
    4N's representative route proves real Wild-material acquisition without
    material injection.
12. `src/core/worldSources.ts` exposes static `zone_loot` and `wild_drop`
    provenance. It reads definitions and common ecology, not live HP, UID,
    drop rolls, or encounter state.
13. The current map exposes zone identity, adjacency, status, supply/noise and
    static ecology presentation. It does not expose exact hidden Wild HP or
    live registry state.
14. `EncounterHero` shows exact Wild HP only after a formal encounter and
    presents threat, behavior, drop category, and fallback visual information.
15. Persisted Wild status effects are the finite instance's `enraged`,
    `evasive`, and `armored` entries. Character DoT effects remain on the
    contestant status-effect model and are not copied into contestants for
    Wild entities.
16. `src/core/saveValidation/wild.ts`, together with structure, reference,
    number, and consistency validation, checks Wild IDs, zone membership,
    unique UIDs, status/HP, ability charges, status effects, encounters,
    events, and Wild metrics.
17. Before Phase 4P there was no tier, Apex schedule, or persisted telegraph.
    Phase 4P adds those fields without changing existing `threat` values or
    common `abilityId` semantics. Special-move definitions are data-only in
    `src/data/wildApexAbilities.ts`; execution remains in `wildCombat.ts`.
18. The world-event scheduler is in `src/core/worldEvents.ts`, driven by
    `state.nextWorldEventTime` and processed from `advanceTime()`.
19. Phase progression is in `src/core/phase.ts`, driven by `state.time`, live
    contestants, finite loot ratio, and configured phase thresholds.
20. `advanceTime()` first rejects non-playing states and, after the NPC loop,
    immediately returns on a terminal state while clearing transient engagement
    state. This Phase 4O-AF2 boundary must also guard Apex scheduling.
21. Item conservation includes character inventory/equipment, zone loot,
    ground drops, pending pickup, and exact UID accounting. Wild drops enter
    the ground only and are consumed through ordinary pickup/craft flows.
22. NPC `autoLoot()` accesses ground items through the existing ownership and
    capacity rules, then records Wild-material pickups through the common stats
    path.
23. Wild kills increment `stats.wildKills` and global Wild metrics. They do not
    modify contestant PvP kills, contestant alive count, death order, winner,
    VictoryType, or ranking.
24. Simulator metrics now include historical encounter/kill/flee counts, elite
    encounters/kills, Apex spawned/encountered/killed/fled, signature
    drops/pickups/crafts, `bossKillsByType`, Wild damage/player deaths/drops,
    pickups/crafts, type/zone distributions, and craft-goal attempts/completions.
25. Near-redline modules are `saveValidation/numbers.ts` (499 lines),
    `saveValidation/references.ts` (497), `npcDecide.ts` (483),
    `gameEngine.ts` (476), and `commandHandlers.ts` (470). New Phase 4P code
    must live in focused `pve`/`apex` modules and keep every core/data file at
    or below 500 lines.

## 4. Audit Conclusion

The existing architecture is sufficient for a second Wild threat layer. The
safe extension points are the Wild definition/instance types and registry,
finite population initialization, SEARCH candidate selection, canonical Wild
combat, world-source provenance, save validation, and presentation projections.
Phase 4P will not add `GameState.characters` entries, a boss combat engine, a
free boss command, a new victory condition, direct material injection, or
production PNG changes.

## 5. Implementation Status

Architecture audit complete. Threat tiers, finite elite content, deterministic
one-time Apex scheduling, public lifecycle events, telegraph state, unique
ground drops, higher-tier recipes, NPC/AutoPlayer closure, UI projections,
focused tests, simulator metrics, and Phase 4P regression evidence are now
implemented in this working branch. The human acceptance gate remains open.

## 6. Phase 4P implementation evidence

### Registry and finite lifecycle

- `src/data/wildEnemies.ts` keeps the ten common compatibility export and adds
  six finite elite definitions plus `prototype_aegis`, `subject_07`, and
  `iron_tusk` as the three one-shot named Apex definitions.
- `src/core/wildPopulation.ts` creates the historical common population and a
  bounded deterministic elite population. There is no respawn path.
- `src/core/apexSchedule.ts` creates one schedule entry per named Apex,
  chooses a stable eligible-zone/fallback result, persists the spawn UID and
  zone, and returns immediately when the match is terminal. Reprocessing a
  spawned entry is idempotent.
- `APEX_SPAWNED` metadata is limited to `wildDefId`, `tier`, and `zoneId`; the
  user-facing message contains only the public name and zone name. UID, HP,
  status, pending intent, and drop details are absent.

### Combat, drops, and crafting

- Every player/NPC Wild action still reaches `attackWildActor`,
  `resolveWildTurn`, `wildFlees`, or `defeatWild`. The persisted
  `pendingIntent` is the telegraph/resolve boundary for data-driven special
  moves; `GUARD`, FLEE, action costs, vitals, and zero-stamina redlines are
  shared with the existing engine.
- Named Apex tables guarantee exactly one non-stackable signature material;
  `dropResolved` remains the exact-once guard. Signature drops enter ordinary
  ground ownership and are counted only when picked up or consumed by a
  formal craft.
- `src/data/phase4pItems.ts` contains nine higher-tier raw materials, seven
  components, and six final equipment outputs. `phase4pRecipes.ts` contains
  thirteen connected routes; all six final routes have depth at least 3.
  `worldSourcesForItem`, Craft Guide, NPC AutoLoot, and existing crafting and
  equip flows use the same registry.

### Acceptance tests and reports

`tests/phase4pEliteApex.test.ts` covers registry cardinality, schedule
save-before/after, idempotence, public info boundaries, SEARCH discovery,
telegraph persistence, GUARD/FLEE and zero stamina, exact-one signature drop,
PvP/victory isolation, craft graph/source conservation, and the formal
AutoPlayer route. The 500-game command required by this phase generated:

`npm run simulate -- --games 500 --seed-prefix PHASE4P --regression --output reports/phase4p-regression.json`

The resulting report records requested=actual=500, trustworthy=100%, and zero
timeout, illegal-state, deadlock, livelock, stall, empty legal set, hard-limit,
terminal-without-winner, invalid-victory-tuple, and duplicate-Apex-spawn
failures. Balance is explicitly observation-only in regression mode.

Additional gates:

- `npm run typecheck`: PASS.
- `npm run build`: PASS (Vite emitted only the existing large-chunk warning).
- `npm run audit:save`: PASS, 102/102 malformed saves rejected.
- `npm run audit:deps`: PASS, zero layering/redline violations.
- `npm run art:doctor -- --offline`, `art:validate`, `art:audit:phase4a`, and
  `art:security`: PASS.
- `npm audit --omit=dev --offline`: 0 vulnerabilities. The networked audit was
  not run because the restricted environment disallows sending dependency
  metadata to the external registry.
- Playwright smoke: PASS for menu → new game; rendered state and gameplay
  screenshot were inspected in `output/web-game/` with no new console error.
- Phase 4P focused suite: 7/7 PASS. After updating stale Phase 4M registry
  ceilings and selecting a deterministic Phase 4J-1 random route fixture, the
  full suite passes: 1,593/1,593 tests across 102 files. No Phase 4P test or
  legacy acceptance test fails.
- The implementation head `9fc8c4a499f20cfeb090d833bdf0475d086b3abf` passed
  GitHub Actions CI run #120; the subsequent report-only head is tracked by
  CI run #121. The PR remains open, Draft, and unmerged.

## 7. Human gate

Human status is exactly `NEEDS-HUMAN-PLAYTEST`. See
`PHASE4P_HUMAN_PLAYTEST.md`; no automated or agent-only evidence marks this
phase accepted.
