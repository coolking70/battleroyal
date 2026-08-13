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
- [x] Phase4M-AF: consolidate all runtime route state onto `buildCraftPlan`.
- [x] Add one utility equipment slot and save/equip/UI/NPC support.
- [x] Preserve atomic crafting, Engineer `field_craft` charge semantics and
  weapon durability bounds.
- [x] Complete Phase4M A–N tests, Phase4M-AF acceptance tests, 8×5 matrix and
  500-game regression evidence.
- [x] Complete automated browser evidence; human playtest remains open.

## Acceptance Fix

### Planner consolidation

`src/core/craftPlan.ts` is now the only runtime authority for current-state
craft routing. It computes structural route quantities, current inventory
allocation, raw gaps, `nextStep`, `suggestedNextCraft`, direct craftability and
final craftability. The previous UI-side runtime recursion in
`craftPathPresentation.ts` (`OUTPUT_RECIPE_MAP`, `recipeDepth`,
`buildCraftTreeSteps`, and the inventory/event completion walk) was removed.
`craftGuide.ts` no longer maintains a second missing-raw traversal.

UI components consume `craftPathSummary()`, which is now a presentation adapter
over `buildCraftPlan()`. Codex retains only static dependency/source lookups for
the public graph; all current route status and quantities come from the plan.
NPC and AutoPlayer continue to consume `buildCraftPlan()` directly.

### Shared dependency multiplicity

`r_war_axe` structurally requires `metal_plate ×2`: one through
`sharpened_metal`, and one through `reinforced_frame`. The plan keeps structural
quantity separate from current ownership. After one plate is crafted and
consumed by `r_sharpened_metal`, current `metal_plate` ownership is zero and the
plan reports `required: 2, missing: 1`; it does not accept the historical craft
event as completion. The remaining route recommends `r_metal_plate` before the
second branch continues.

The new `tests/phase4mAcceptanceFix.test.tsx` covers core multiplicity,
consumption/reappearance, presentation quantity (`metal_plate ×2`), and the
static Codex selector. React keys remain path/recipe-instance-safe without
deduplicating the requirement count.

### Current-state completion semantics

`ITEM_CRAFTED(outputItemId)` history is retained for telemetry and progress
feedback only. It is not authoritative evidence that a current dependency is
satisfied. Completion is based on current inventory/equipped target state and
the actual route allocation in `buildCraftPlan()`.

### Raw-ready vs craft-ready

The plan and UI now distinguish:

- `rawReady`: all raw leaves are currently held;
- `suggestedNextCraft` / `nextStep`: the next intermediate that can advance or
  is first incomplete in the route;
- `finalCraftable`: the final recipe's direct ingredients, stamina, output room
  and playing-state checks are all currently legal.

Thus a raw-complete `r_composite_bow_upgrade` route reports “原料齐全” and a
next intermediate, not “可直接合成”; only `finalCraftable` produces the direct
craft message. `CraftGoalBar`, Craft Panel, Codex, `describeCraftGoal()` and
AutoPlayer route selection all use this unified state.

### NPC and AutoPlayer

The acceptance suite now runs a deterministic NPC `war_axe` deep route through
real multi-step CRAFT turns and formal EQUIP, with no mid-route item injection.
The representative AutoPlayer regression remains command-closed-loop:
`SET_CRAFT_GOAL → MOVE/SEARCH → CRAFT → EQUIP`, with
`DEBUG_GIVE_MATERIAL = 0`, component and final `ITEM_CRAFTED` evidence.

### Engineer field craft and utility validation

`field_craft` remains one formal charge for one successful free craft. The AF
regression proves a failed craft preserves the charge, a successful craft
consumes it, the following intermediate craft resumes its positive cost, and
zero stamina cannot chain another free craft. `validateItemRegistry()` now
rejects utility `searchFindMult` values that are NaN, infinite, zero or
negative; `field_kit`'s value is unchanged.

### Deferred

Save backward compatibility: **DEFERRED UNTIL PRE-RELEASE SAVE FORMAT
STABILIZATION**. No reinforced_handle migration or GAME_VERSION migration was
added.

Balance: **BALANCE OBSERVATION ONLY — BALANCE DEFERRED**. No gameplay values
were changed to affect the regression ratio.

## Verification Record

This report is intentionally kept separate from historical Phase 3, 4K and 4L
reports. Final gate commands and machine-readable reports will be appended only
after the full Phase4M implementation and regression run complete.

### Automated gates — 2026-08-13

- `npm run typecheck`: PASS.
- `npm test -- --run`: PASS — 93 files / 1535 tests.
- `npm run build`: PASS.
- `npm run audit:save`: PASS — 102 malformed cases rejected, 102 control cases accepted.
- `npm run audit:deps`: PASS — core/data max file 500 lines; R1/R2/R3/R4 = 0.
- `npm run art:doctor -- --offline`: PASS.
- `npm run art:validate`: PASS.
- `npm run art:audit:phase4a`: PASS.
- `npm run art:security:browser`: PASS.
- `npm run art:security:repo`: PASS.
- `npm audit --omit=dev`: PASS — 0 vulnerabilities.
- Required Phase4M-AF regression command completed with requested = actual = 500,
  trustworthy = 500 / 100%, timeout = 0, illegalState = 0, deadlock = 0,
  livelock = 0, stalled = 0, empty legal set = 0, hard-limit = 0 and crash = 0.
  Wins = 67, losses = 433, win rate = 13.4%, character-balance ratio = 2.40.
  Balance remains observation only; the engine/CI regression gate is PASS as
  specified by the phase.

Machine-readable regression evidence: `reports/phase4m-regression.json` and
`reports/phase4m-regression.md`.

### Human gate

`PHASE4M_HUMAN_PLAYTEST.md` remains `NEEDS-HUMAN-PLAYTEST` until a human
confirms the interaction and readability checklist.
