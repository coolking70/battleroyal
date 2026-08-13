import { afterEach, describe, expect, it } from 'vitest';
import { executeCommand } from '../src/core/gameEngine';
import { buildCraftPlan } from '../src/core/craftPlan';
import { performCraft } from '../src/core/crafting';
import { equipItem, getEquippedWeapon, countItem, createStack } from '../src/core/inventory';
import { refreshZoneOccupants } from '../src/core/gameState';
import { runNpcTurn } from '../src/core/npcAi';
import { useSkill, hasFieldCraftCharge } from '../src/core/skills';
import { SeededRandom } from '../src/core/random';
import { getItem, ITEMS, validateItemRegistry } from '../src/data/items';
import { getRecipeDepth, RECIPES, validateRecipeGraph } from '../src/data/recipes';
import { ZONES, getZoneDef } from '../src/data/zones';
import {
  createMemoryStorage,
  loadGame,
  saveGame,
  setStorage,
  validateSaveData,
} from '../src/core/saveLoad';
import { clearInventory, give, newGame, npcs, player } from './helpers';
import { runAutoGame } from '../tools/autoPlayer';
import type { Combatant, GameState } from '../src/core/types';

afterEach(() => setStorage(null));

function craft(state: GameState, actor: Combatant, recipeId: string): void {
  const result = performCraft(state, actor, recipeId);
  expect(result.ok, `${recipeId}: ${result.message}`).toBe(true);
}

function giveReinforcedPipeRaws(state: GameState, actor: Combatant): void {
  give(state, actor, 'scrap', 2);
  give(state, actor, 'iron');
  give(state, actor, 'wood', 2);
  give(state, actor, 'rope', 2);
}

function craftReinforcedPipe(state: GameState, actor: Combatant): void {
  craft(state, actor, 'r_metal_parts');
  craft(state, actor, 'r_processed_wood');
  craft(state, actor, 'r_rope_bundle');
  craft(state, actor, 'r_wooden_handle');
  craft(state, actor, 'r_reinforced_pipe');
}

describe('Phase 4M Test A/B — fixed registries and graph', () => {
  it('A: item registry reaches the roster target and validates every equipment tier', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(50);
    // Phase 4N extends the accepted Phase 4M registry with wild materials.
    expect(ITEMS.length).toBeLessThanOrEqual(80);
    expect(new Set(ITEMS.map((item) => item.id)).size).toBe(ITEMS.length);
    expect(validateItemRegistry()).toEqual([]);
    expect(ITEMS.filter((item) => item.craftTier === 'component').length).toBeGreaterThanOrEqual(15);
    expect(ITEMS.filter((item) => item.equipmentSlot === 'weapon').every((item) => (item.durability ?? 0) > 0)).toBe(true);
    expect(ITEMS.filter((item) => item.equipmentSlot === 'utility').length).toBeGreaterThanOrEqual(1);
  });

  it('B: recipe registry has no invalid graph edges and exposes depth', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(35);
    // Phase 4N adds a separate ten-recipe wild-drop branch.
    expect(RECIPES.length).toBeLessThanOrEqual(60);
    expect(new Set(RECIPES.map((recipe) => recipe.id)).size).toBe(RECIPES.length);
    expect(validateRecipeGraph()).toEqual([]);
    expect(getRecipeDepth('r_reinforced_pipe')).toBeGreaterThanOrEqual(3);
    expect(getRecipeDepth('r_composite_bow_upgrade')).toBeGreaterThanOrEqual(3);
    expect(getRecipeDepth('r_trauma_kit')).toBeGreaterThanOrEqual(3);
  });
});

describe('Phase 4M Test C–F — deep chains, guide gaps and conservation', () => {
  it('C: completes three depth-3-or-deeper routes through real craft operations', () => {
    const state = newGame('PHASE4M-DEEP-CHAINS');
    const actor = player(state);
    clearInventory(actor);

    give(state, actor, 'iron', 4);
    give(state, actor, 'stone');
    give(state, actor, 'wood', 2);
    give(state, actor, 'rope', 2);
    craft(state, actor, 'r_metal_plate');
    craft(state, actor, 'r_sharpened_metal');
    craft(state, actor, 'r_processed_wood');
    craft(state, actor, 'r_rope_bundle');
    craft(state, actor, 'r_wooden_handle');
    craft(state, actor, 'r_machete');
    expect(countItem(actor, 'machete')).toBe(1);

    clearInventory(actor);
    give(state, actor, 'wood', 2);
    give(state, actor, 'rope', 4);
    give(state, actor, 'glass');
    craft(state, actor, 'r_processed_wood');
    craft(state, actor, 'r_rope_bundle');
    craft(state, actor, 'r_bow_limb');
    craft(state, actor, 'r_rope_bundle');
    craft(state, actor, 'r_reinforced_bow');
    craft(state, actor, 'r_composite_bow_upgrade');
    expect(countItem(actor, 'composite_bow_upgrade')).toBe(1);

    clearInventory(actor);
    give(state, actor, 'cloth', 2);
    give(state, actor, 'herb', 2);
    give(state, actor, 'alcohol', 2);
    give(state, actor, 'glass', 2);
    craft(state, actor, 'r_cloth_roll');
    craft(state, actor, 'r_antiseptic');
    craft(state, actor, 'r_chemical_mix');
    craft(state, actor, 'r_antiseptic');
    craft(state, actor, 'r_chemical_mix');
    craft(state, actor, 'r_medical_kit_parts');
    craft(state, actor, 'r_trauma_kit');
    expect(countItem(actor, 'trauma_kit')).toBe(1);
  });

  it('D: raw-only inventory identifies a craftable missing intermediate', () => {
    const state = newGame('PHASE4M-MISSING-INTERMEDIATE');
    const actor = player(state);
    clearInventory(actor);
    give(state, actor, 'wood', 2);
    give(state, actor, 'rope', 2);
    give(state, actor, 'glass');
    const plan = buildCraftPlan(state, actor, 'r_composite_bow_upgrade')!;
    expect(plan.steps.some((step) => step.recipeId === 'r_processed_wood' && step.status === 'craftable')).toBe(true);
    expect(plan.steps.some((step) => step.recipeId === 'r_bow_limb' && step.status === 'blocked')).toBe(true);
    expect(plan.suggestedNextCraft?.recipeId).toBe('r_processed_wood');
    expect(plan.rawGaps.map((gap) => gap.itemId)).toEqual(['rope']);
  });

  it('E: a held intermediate is complete and is not planned again', () => {
    const state = newGame('PHASE4M-PARTIAL-CHAIN');
    const actor = player(state);
    clearInventory(actor);
    give(state, actor, 'bow_limb');
    give(state, actor, 'rope', 2);
    give(state, actor, 'glass');
    const plan = buildCraftPlan(state, actor, 'r_composite_bow_upgrade')!;
    expect(plan.steps.find((step) => step.recipeId === 'r_bow_limb')).toMatchObject({ status: 'complete', owned: 1 });
    expect(plan.steps.some((step) => step.recipeId === 'r_processed_wood')).toBe(false);
    expect(plan.suggestedNextCraft?.recipeId).toBe('r_rope_bundle');
  });

  it('F: full inventory rejects craft without changing any conserved field', () => {
    const state = newGame('PHASE4M-FULL-INVENTORY');
    const actor = player(state);
    clearInventory(actor);
    give(state, actor, 'iron', 3);
    for (const itemId of ['wood', 'stone', 'cloth', 'rope', 'glass', 'herb', 'alcohol']) give(state, actor, itemId);
    actor.stamina = 20;
    const before = JSON.stringify({ inventory: actor.inventory, stamina: actor.stamina, uidSeq: state.uidSeq });
    const result = performCraft(state, actor, 'r_metal_plate');
    expect(result.ok).toBe(false);
    expect(JSON.stringify({ inventory: actor.inventory, stamina: actor.stamina, uidSeq: state.uidSeq })).toBe(before);
  });
});

describe('Phase 4M Test G–J — equipment, NPC route and player route', () => {
  it('G: a crafted weapon and utility item use the formal equip paths', () => {
    const state = newGame('PHASE4M-EQUIPMENT');
    const actor = player(state);
    clearInventory(actor);
    giveReinforcedPipeRaws(state, actor);
    craftReinforcedPipe(state, actor);
    const weapon = actor.inventory.find((stack) => stack.itemId === 'reinforced_pipe')!;
    expect(equipItem(actor, weapon.uid).ok).toBe(true);
    expect(getEquippedWeapon(actor)?.uid).toBe(weapon.uid);

    clearInventory(actor);
    give(state, actor, 'cloth', 2);
    give(state, actor, 'rope', 2);
    give(state, actor, 'scrap');
    give(state, actor, 'glass');
    give(state, actor, 'battery');
    craft(state, actor, 'r_cloth_roll');
    craft(state, actor, 'r_rope_bundle');
    craft(state, actor, 'r_wire');
    craft(state, actor, 'r_circuit');
    craft(state, actor, 'r_field_kit');
    const utility = actor.inventory.find((stack) => stack.itemId === 'field_kit')!;
    expect(equipItem(actor, utility.uid).ok).toBe(true);
    expect(actor.equippedUtilityId).toBe(utility.uid);
  });

  it('H: NPC searches missing raw material, crafts the full route, and equips the final weapon', () => {
    const state = newGame('PHASE4M-NPC-MULTISTEP');
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    npc.personality = 'collector';
    npc.currentZoneId = 'residential';
    npc.stamina = 50;
    npc.maxStamina = 50;
    npc.plannedRecipeId = 'r_reinforced_pipe';
    npc.planCreatedAt = state.time;
    npc.planReason = 'Phase 4M deterministic route';
    npc.planRecommendedZoneId = 'residential';
    const zone = state.zones.residential!;
    zone.loot = [
      { itemId: 'rope', count: 4, rarity: 'normal' },
    ];
    zone.initialLootCount = 4;
    zone.remainingLootCount = 4;
    zone.supply = 1000;
    for (const other of Object.values(state.characters)) {
      if (other.id !== npc.id) other.currentZoneId = 'school';
    }
    // Historical Phase 4M route fixture isolates the later Phase 4N ecology.
    for (const wild of Object.values(state.wildEnemies)) {
      wild.status = 'defeated';
      wild.hp = 0;
      wild.dropResolved = true;
      wild.defeatedAtTime = state.time;
    }
    refreshZoneOccupants(state);

    const actions: string[] = [];
    const rng = SeededRandom.fromState(state.rngState);
    actions.push(runNpcTurn(state, npc, rng).kind);
    actions.push(runNpcTurn(state, npc, rng).kind);
    expect(actions).toEqual(['search', 'search']);
    give(state, npc, 'scrap', 2);
    give(state, npc, 'iron');
    give(state, npc, 'wood', 2);
    for (let i = 0; i < 16 && countItem(npc, 'reinforced_pipe') === 0; i += 1) {
      actions.push(runNpcTurn(state, npc, rng).kind);
    }
    expect(actions).toContain('craft');
    expect(countItem(npc, 'reinforced_pipe')).toBe(0);
    expect(getEquippedWeapon(npc)?.itemId, JSON.stringify({ actions, inventory: npc.inventory, equipment: npc.equipment, plan: npc.plannedRecipeId })).toBe('reinforced_pipe');
  });

  it('I: MOVE → SEARCH → PICKUP_GROUND → multi-step CRAFT → EQUIP uses real commands', () => {
    let state = newGame('PHASE4M-PLAYER-CLOSED-LOOP');
    let actor = player(state);
    clearInventory(actor);
    giveReinforcedPipeRaws(state, actor);
    actor.stamina = 50;
    actor.maxStamina = 50;
    const targetZone = getZoneDef(actor.currentZoneId).adjacent[0]!;
    const target = state.zones[targetZone]!;
    target.loot = [];
    target.initialLootCount = 0;
    target.remainingLootCount = 0;
    target.supply = 0;
    const ground = createStack(state, 'battery');
    ground.revealedTo = [actor.id];
    target.groundItems = [ground];
    for (const other of Object.values(state.characters)) {
      if (other.id !== actor.id) other.currentZoneId = ZONES.find((zone) => zone.id !== targetZone)?.id ?? 'school';
    }
    refreshZoneOccupants(state);

    let result = executeCommand(state, { type: 'MOVE', zoneId: targetZone });
    expect(result.ok).toBe(true);
    state = result.state;
    result = executeCommand(state, { type: 'SEARCH' });
    expect(result.ok).toBe(true);
    state = result.state;
    actor = player(state);
    result = executeCommand(state, { type: 'PICKUP_GROUND', uid: ground.uid });
    expect(result.ok).toBe(true);
    state = result.state;

    for (const recipeId of ['r_metal_parts', 'r_processed_wood', 'r_rope_bundle', 'r_wooden_handle', 'r_reinforced_pipe']) {
      result = executeCommand(state, { type: 'CRAFT', recipeId });
      expect(result.ok, `${recipeId}: ${result.message}`).toBe(true);
      state = result.state;
    }
    actor = player(state);
    const weapon = actor.inventory.find((stack) => stack.itemId === 'reinforced_pipe')!;
    result = executeCommand(state, { type: 'EQUIP', uid: weapon.uid });
    expect(result.ok).toBe(true);
    expect(getEquippedWeapon(player(result.state))?.itemId).toBe('reinforced_pipe');
  });

  it('J: melee, ranged, armor, utility and medical routes expose dependencies, raw gaps, sources and next steps', () => {
    const targets = ['r_reinforced_pipe', 'r_composite_bow_upgrade', 'r_heavy_armor', 'r_field_kit', 'r_trauma_kit'];
    for (const targetRecipeId of targets) {
      const state = newGame(`PHASE4M-GUIDE-${targetRecipeId}`);
      const actor = player(state);
      clearInventory(actor);
      const plan = buildCraftPlan(state, actor, targetRecipeId)!;
      expect(plan.depth).toBeGreaterThanOrEqual(2);
      expect(plan.steps.length).toBeGreaterThanOrEqual(2);
      expect(plan.rawGaps.length).toBeGreaterThan(0);
      expect(plan.rawGaps.every((gap) => gap.sourceZoneIds.length > 0)).toBe(true);
      expect(plan.suggestedMoveZoneId).not.toBeNull();
      expect(plan.steps.some((step) => step.status === 'blocked')).toBe(true);
    }
  });
});

describe('Phase 4M Test K–N — save, conservation, zero stamina and determinism', () => {
  it('K: save/load preserves a complex Phase 4M state and deterministic continuation', () => {
    const storage = createMemoryStorage();
    setStorage(storage);
    const state = newGame('PHASE4M-SAVE-LOAD');
    const actor = player(state);
    clearInventory(actor);
    giveReinforcedPipeRaws(state, actor);
    craftReinforcedPipe(state, actor);
    const weapon = actor.inventory.find((stack) => stack.itemId === 'reinforced_pipe')!;
    expect(equipItem(actor, weapon.uid).ok).toBe(true);
    getEquippedWeapon(actor)!.durability = 7;
    state.craftGoalRecipeId = 'r_composite_bow_upgrade';
    state.craftGoalCompleted = false;
    state.zones.underground!.status = 'safe';
    state.zones.underground!.loot = [];
    state.zones.underground!.remainingLootCount = 0;
    state.zones.underground!.initialLootCount = 0;
    state.zones.underground!.supply = 0;
    actor.currentZoneId = 'underground';
    actor.skillCooldowns = { field_craft: 3 };
    for (const other of Object.values(state.characters)) {
      if (other.id !== actor.id) other.currentZoneId = 'school';
    }
    refreshZoneOccupants(state);

    expect(saveGame(state).ok).toBe(true);
    const loaded = loadGame();
    expect(loaded.ok, loaded.ok ? '' : loaded.error).toBe(true);
    if (!loaded.ok) return;
    expect(JSON.stringify(loaded.data.state)).toBe(JSON.stringify(state));
    expect(validateSaveData(loaded.data).ok).toBe(true);

    const direct = executeCommand(state, { type: 'SEARCH' });
    const resumed = executeCommand(loaded.data.state, { type: 'SEARCH' });
    expect(direct.ok).toBe(resumed.ok);
    expect(JSON.stringify(direct.state)).toBe(JSON.stringify(resumed.state));
  });

  it('L: successful and failed crafts conserve exact ingredient/output deltas', () => {
    const state = newGame('PHASE4M-CONSERVATION');
    const actor = player(state);
    clearInventory(actor);
    give(state, actor, 'iron', 2);
    const ironBefore = countItem(actor, 'iron');
    const platesBefore = countItem(actor, 'metal_plate');
    craft(state, actor, 'r_metal_plate');
    expect(countItem(actor, 'iron')).toBe(ironBefore - 2);
    expect(countItem(actor, 'metal_plate')).toBe(platesBefore + 1);

    const failedState = newGame('PHASE4M-CONSERVATION-FAIL');
    const failedActor = player(failedState);
    clearInventory(failedActor);
    give(failedState, failedActor, 'iron');
    const before = JSON.stringify({ inventory: failedActor.inventory, stamina: failedActor.stamina, uidSeq: failedState.uidSeq });
    expect(performCraft(failedState, failedActor, 'r_metal_plate').ok).toBe(false);
    expect(JSON.stringify({ inventory: failedActor.inventory, stamina: failedActor.stamina, uidSeq: failedState.uidSeq })).toBe(before);
  });

  it('M: zero stamina blocks ordinary craft, while Engineer field_craft only permits the formal charged craft', () => {
    const state = newGame('PHASE4M-ZERO-STAMINA');
    const actor = player(state);
    clearInventory(actor);
    give(state, actor, 'iron', 2);
    actor.stamina = 0;
    expect(performCraft(state, actor, 'r_metal_plate').ok).toBe(false);
    expect(countItem(actor, 'iron')).toBe(2);

    const engineerState = newGame('PHASE4M-ENGINEER-FREE');
    const engineer = player(engineerState);
    engineer.characterId = 'engineer';
    engineer.passiveId = 'tinkerer';
    clearInventory(engineer);
    give(engineerState, engineer, 'iron', 2);
    engineer.stamina = 2;
    const skill = useSkill(engineerState, engineer, 'field_craft', new SeededRandom('PHASE4M-SKILL'));
    expect(skill.ok).toBe(true);
    engineer.stamina = 0;
    expect(hasFieldCraftCharge(engineer)).toBe(true);
    expect(performCraft(engineerState, engineer, 'r_metal_plate').ok).toBe(true);
    expect(engineer.stamina).toBe(0);
    expect(hasFieldCraftCharge(engineer)).toBe(false);
  });

  it('N: identical seed, character and multi-stage commands produce identical state', () => {
    const run = (): string => {
      const state = newGame('PHASE4M-DETERMINISM', 'engineer');
      const actor = player(state);
      clearInventory(actor);
      giveReinforcedPipeRaws(state, actor);
      actor.stamina = 50;
      craftReinforcedPipe(state, actor);
      const weapon = actor.inventory.find((stack) => stack.itemId === 'reinforced_pipe')!;
      expect(equipItem(actor, weapon.uid).ok).toBe(true);
      return JSON.stringify(state);
    };
    expect(run()).toBe(run());
  });

  it('AutoPlayer representative build loop uses real craft/equip commands for component and final output', () => {
    const results = ['A', 'B', 'C', 'D'].map((suffix) => runAutoGame({
      seed: `PHASE4M-AUTO-${suffix}`,
      characterId: 'engineer',
      policy: 'collector',
      representativeBuildLoop: true,
      keepEventTrace: true,
    }));
    expect(results.every((result) => result.trustworthy)).toBe(true);
    expect(results.some((result) => (result.commandCounts.CRAFT ?? 0) > 0)).toBe(true);
    expect(results.every((result) => (result.commandCounts.DEBUG_GIVE_MATERIAL ?? 0) === 0)).toBe(true);
    const crafted = results.flatMap((result) => result.eventTrace ?? [])
      .filter((event) => event.type === 'ITEM_CRAFTED')
      .map((event) => String(event.metadata.outputItemId));
    expect(crafted.some((itemId) => getItem(itemId).craftTier === 'component')).toBe(true);
    expect(crafted.some((itemId) => Boolean(getItem(itemId).equipmentSlot))).toBe(true);
  });
});
