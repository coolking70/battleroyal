# Phase 4M — Equipment & Crafting 2.0

## Scope

Phase 4M expands the fixed item roster and turns crafting into a validated,
multi-stage dependency graph. The phase does not add PvE, Phase 4N/P or new
professions. Existing Phase 4L profession behavior remains the base contract.

Base branch: `main` at `dddc9b359f0e28880b17d4446e0da6cb73935b3a`
Phase 4L metadata correction commit: `efe89a2`
Working branch: `agent/phase4m-equipment-crafting-2`

## Equipment & Crafting Architecture Audit

The pre-Phase4M audit found the existing model was intentionally small: 29
items, 17 recipes, `weapon`/`armor` equipment slots, `melee`/`ranged`
weapon types, and an existing three-step stick/handle/spear recipe chain. The
following answers record the seam decisions used by this phase.

1. **Current item categories:** before this phase: `material`, `weapon`,
   `armor`, `consumable`; after this phase: those plus `component` and
   `utility`.
2. **Equipment slots:** before this phase: one weapon slot and one armor slot;
   after this phase: those plus one utility slot. There is still no duplicate
   slot system.
3. **Weapon families:** Phase 4M formalizes fixed families: `blunt`, `blade`,
   `heavy`, `bow`, `improvised_ranged`, and `electric_special`.
4. **Melee/ranged differences:** the existing `weaponType` remains the formal
   combat distinction; `weaponFamily` adds deterministic family identity. No
   ammunition system is introduced.
5. **Armor slots:** armor remains a single slot, with fixed `light`, `medium`,
   and `heavy` `armorClass` values.
6. **Utility equipment:** there was no prior utility concept. Phase 4M adds a
   single `utility` slot and the fixed `field_kit` search modifier.
7. **Durability:** durability is currently a weapon-only runtime field. Armor
   and utility remain fixed non-durability equipment in this phase.
8. **Recipe output reuse:** yes. A recipe output may be another recipe's
   ingredient; this is the source of truth for intermediate components.
9. **Recursive craft guide:** the presentation guide already traversed nested
   dependencies; Phase 4M adds the pure core `buildCraftPlan` API with stable
   depth ordering, raw gaps and next-step selection.
10. **NPC multi-layer planning:** the old planner was effectively one-step for
    material routing. Phase 4M derives missing raw materials from the same
    recursive plan and routes NPCs through intermediate recipes.
11. **AutoPlayer intermediates:** the AutoPlayer now consumes the real plan,
    executes craft/move/search/equip commands, and does not inject items for
    acceptance.
12. **Zone loot assumptions:** zone loot is now primarily raw material, with a
    small number of rare component drops. Final equipment is crafted rather
    than placed in zone rare pools.
13. **Save validation:** validation resolves item IDs through the registry,
    validates component/final equipment references and utility slot identity,
    and keeps old same-version saves loadable by backfilling a null utility
    field.
14. **UI recipe depth:** the UI was already capable of showing a dependency
    path, but its data assumptions are now backed by the graph validator and
    component/utility presentation metadata.
15. **Raw-only hard-coding:** no Phase4M graph rule assumes every ingredient is
    raw. Raw leaves, component outputs, final outputs, cycles, consumers and
    reachability are validated centrally in `src/data/recipes.ts`.
16. **Conservation:** a successful craft consumes exactly the declared
    ingredients and creates exactly the declared output. Failed crafts preserve
    inventory, stamina, UID sequencing and field-craft charges. Equipment
    handoff moves one instance between inventory/equipment; it does not copy.
17. **Multi-layer craft goal:** `plannedRecipeId`/`craftGoalRecipeId` may point
    to a final recipe; the planner resolves component and raw dependencies
    recursively.
18. **Inventory limit impact:** output admission is simulated after ingredient
    consumption, so a craft can use the slot freed by its inputs while still
    rejecting a genuinely full output transaction.
19. **Counts:** the Phase4M registry target is 50–60 items and 35–45 recipes;
    the implementation currently contains 57 items and 45 recipes, including
    16 new components and 12 new final recipes.
20. **Historical fixed-count tests:** the Phase 4C synthesis test and related
    zone assumptions were identified as hard-coded. They are updated to assert
    graph/roster contracts and preserve the legacy recipe-chain semantics.

## Implementation Status

- [x] Fixed `craftTier` (`raw` / `component` / `final`) and stable snake_case IDs.
- [x] Add 28 fixed Phase4M item definitions; no rarity, affixes, sockets,
  procedural stats or ammo.
- [x] Add 28 fixed Phase4M recipes; total registry is 57 items / 45 recipes.
- [x] Validate unique IDs, references, duplicate ingredients/outputs, cycles,
  raw leaves, component consumers and deterministic recipe depth.
- [x] Add recursive `buildCraftPlan(state, actor, targetRecipeId)`.
- [x] Add one utility equipment slot and save/equip/UI/NPC support.
- [x] Preserve atomic crafting, Engineer `field_craft` charge semantics and
  weapon durability bounds.
- [x] Complete Phase4M A–N tests, 8×5 matrix and 500-game regression evidence.
- [ ] Complete browser evidence, human-playtest handoff, push and Draft PR.

## Verification Record

This report is intentionally kept separate from historical Phase 3, 4K and 4L
reports. Final gate commands and machine-readable reports will be appended only
after the full Phase4M implementation and regression run complete.

### Automated gates — 2026-08-13

- `npm run typecheck`: PASS.
- `npm test -- --run`: PASS — 92 files / 1524 tests.
- `npm run build`: PASS.
- `npm run audit:save`: PASS — 102 malformed cases rejected, 102 control cases accepted.
- `npm run audit:deps`: PASS — core/data max file 500 lines; R1/R2/R3/R4 = 0.
- `npm run art:doctor -- --offline`: PASS.
- `npm run art:validate`: PASS.
- `npm run art:audit:phase4a`: PASS.
- `npm run art:security:browser`: PASS.
- `npm run art:security:repo`: PASS.
- `npm audit --omit=dev`: PASS — 0 vulnerabilities.
- Required regression command completed with requested = actual = 500,
  trustworthy = 500 / 100%, timeout = 0, illegalState = 0, deadlock = 0,
  livelock = 0, stalled = 0, empty legal set = 0, hard-limit = 0 and crash = 0.
  The historical character-balance ratio remains an observation (`10.15`),
  while the engine/CI regression gate is PASS as specified by the phase.

Machine-readable regression evidence: `reports/phase4m-regression.json` and
`reports/phase4m-regression.md`.

### Human gate

`PHASE4M_HUMAN_PLAYTEST.md` remains `NEEDS-HUMAN-PLAYTEST` until a human
confirms the interaction and readability checklist.
