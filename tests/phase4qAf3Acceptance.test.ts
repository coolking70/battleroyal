import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { tryGetRecipe } from '../src/data/recipes';
import { applyNpcPlanRecommendations } from '../src/core/npcPlanRecommendation';
import { buildCraftPlan } from '../src/core/craftPlan';
import { runNpcTurn } from '../src/core/npcAi';
import { addItem, countItem, createStack } from '../src/core/inventory';
import { SeededRandom } from '../src/core/random';
import type { Combatant, GameState } from '../src/core/types';
import { getCharacterSkills } from '../src/core/skills';
import { clearInventory, newGame, npcs } from './helpers';

function noWilds(state: GameState): void {
  for (const zone of Object.values(state.zones)) zone.wildEnemyIds = [];
  for (const wild of Object.values(state.wildEnemies)) {
    wild.status = 'defeated';
    wild.hp = 0;
  }
}

function nonExhaustedFreshFixture(seed: string): { state: GameState; npc: Combatant } {
  const state = newGame(seed);
  const npc = npcs(state)[0]!;
  clearInventory(npc);
  npc.personality = 'aggressive';
  npc.currentZoneId = 'warehouse';
  npc.plannedRecipeId = null;
  npc.planCreatedAt = null;
  npc.planRecommendedZoneId = null;
  npc.planRecommendedLandmarkId = null;
  npc.planNoProgressTurns = 0;
  npc.planProgress = 0;
  npc.stamina = npc.maxStamina = 100;
  npc.skillCooldowns = Object.fromEntries(getCharacterSkills(npc.characterId).map((skillId) => [skillId, 99]));
  addItem(npc, createStack(state, 'processed_wood'));
  addItem(npc, createStack(state, 'rope_bundle'));
  addItem(npc, createStack(state, 'glass'));
  for (const character of Object.values(state.characters)) {
    if (character.id !== npc.id) character.currentZoneId = 'school';
  }
  noWilds(state);

  // Keep the origin demonstrably active without allowing generic zone loot to
  // satisfy the rope gap before the targeted remote Landmark is reached.
  const origin = state.zones.warehouse!;
  origin.loot = [{ itemId: 'glass', count: 4, rarity: 'normal' }];
  origin.objectiveLoot = [];
  origin.initialLootCount = 4;
  origin.remainingLootCount = 4;
  origin.supply = 1;
  origin.searchedEmptyCount = 0;
  const local = state.landmarks.warehouse_loading_bay!;
  local.loot = [];
  local.remainingSearches = 0;
  local.exhausted = true;

  const target = state.landmarks.construction_tool_container!;
  target.loot = [createStack(state, 'rope', 2)];
  target.remainingSearches = 1;
  target.maxSearches = 1;
  target.exhausted = false;
  target.locked = false;
  target.disabled = false;
  return { state, npc };
}

function runNonExhaustedRoute(seed: string): GameState {
  const { state, npc } = nonExhaustedFreshFixture(seed);
  expect(state.zones.warehouse!.remainingLootCount).toBeGreaterThan(0);
  expect(npc.plannedRecipeId).toBeNull();
  expect(npc.planRecommendedLandmarkId).toBeNull();

  runNpcTurn(state, npc, new SeededRandom(`${seed}:turn:0`));
  expect(npc.plannedRecipeId).toBe('r_composite_bow_upgrade');
  expect(npc.planRecommendedLandmarkId).toBe('construction_tool_container');
  expect(npc.planRecommendedZoneId).toBe('construction');
  expect(state.zones.warehouse!.remainingLootCount).toBeGreaterThan(0);
  const plan = buildCraftPlan(state, npc, npc.plannedRecipeId!);
  expect(plan?.rawGaps.some((gap) => gap.itemId === 'rope' && gap.sourceLandmarkIds.includes('construction_tool_container'))).toBe(true);

  for (let turn = 1; turn < 220 && !npc.equipment.some((stack) => stack.itemId === 'composite_bow_upgrade'); turn += 1) {
    runNpcTurn(state, npc, new SeededRandom(`${seed}:turn:${turn}`));
  }

  const events = state.events;
  const moveIndex = events.findIndex((event) => event.type === 'CHARACTER_MOVED' && event.actorId === npc.id && event.zoneId === 'construction');
  const foundIndex = events.findIndex((event) => event.type === 'ITEM_FOUND' && event.actorId === npc.id && event.metadata.itemId === 'rope');
  const pickedIndex = events.findIndex((event) => event.type === 'ITEM_PICKED' && event.actorId === npc.id && event.metadata.itemId === 'rope');
  const searchedIndex = events.findIndex((event) => event.type === 'LANDMARK_SEARCHED' && event.actorId === npc.id && event.metadata.landmarkId === 'construction_tool_container');
  const craftIndex = events.findIndex((event) => event.type === 'ITEM_CRAFTED' && event.actorId === npc.id && event.metadata.recipeId === 'r_composite_bow_upgrade');
  const equipIndex = events.findIndex((event) => event.type === 'ITEM_EQUIPPED' && event.actorId === npc.id && event.metadata.itemId === 'composite_bow_upgrade');
  expect(npc.currentZoneId).toBe('construction');
  expect(moveIndex).toBeGreaterThanOrEqual(0);
  expect(foundIndex).toBeGreaterThan(moveIndex);
  expect(pickedIndex).toBeGreaterThan(foundIndex);
  expect(searchedIndex).toBeGreaterThan(pickedIndex);
  expect(craftIndex).toBeGreaterThan(searchedIndex);
  expect(equipIndex).toBeGreaterThan(craftIndex);
  expect(countItem(npc, 'composite_bow_upgrade')).toBe(0);
  expect(npc.equipment.some((stack) => stack.itemId === 'composite_bow_upgrade')).toBe(true);
  expect(events.some((event) => event.type.startsWith('DEBUG_'))).toBe(false);
  return state;
}

function planSnapshot(npc: Combatant): Record<string, string | null> {
  return {
    plannedRecipeId: npc.plannedRecipeId,
    planRecommendedLandmarkId: npc.planRecommendedLandmarkId,
    planRecommendedZoneId: npc.planRecommendedZoneId,
  };
}

describe('Phase 4Q-AF3 source-driven NPC Landmark planning', () => {
  it('AF3-1 creates a Landmark route from a fresh non-exhausted origin', () => {
    const { state, npc } = nonExhaustedFreshFixture('PHASE4Q-AF3-NON-EXHAUSTED-PLAN');
    expect(state.zones.warehouse!.remainingLootCount).toBeGreaterThan(0);

    runNpcTurn(state, npc, new SeededRandom('PHASE4Q-AF3-NON-EXHAUSTED-PLAN:turn:0'));

    expect(npc.plannedRecipeId).toBe('r_composite_bow_upgrade');
    expect(npc.planRecommendedLandmarkId).toBe('construction_tool_container');
    expect(npc.planRecommendedZoneId).toBe('construction');
    expect(state.zones.warehouse!.remainingLootCount).toBeGreaterThan(0);
  });

  it('AF3-2 gives equivalent source recommendations for exhausted and non-exhausted origins', () => {
    const available = nonExhaustedFreshFixture('PHASE4Q-AF3-EQUIVALENCE');
    const exhausted = nonExhaustedFreshFixture('PHASE4Q-AF3-EQUIVALENCE');
    const origin = exhausted.state.zones.warehouse!;
    origin.loot = [];
    origin.initialLootCount = 0;
    origin.remainingLootCount = 0;
    origin.supply = 0;

    runNpcTurn(available.state, available.npc, new SeededRandom('PHASE4Q-AF3-EQUIVALENCE:turn:0'));
    runNpcTurn(exhausted.state, exhausted.npc, new SeededRandom('PHASE4Q-AF3-EQUIVALENCE:turn:0'));

    expect(planSnapshot(available.npc)).toEqual(planSnapshot(exhausted.npc));
    expect(planSnapshot(available.npc)).toEqual({
      plannedRecipeId: 'r_composite_bow_upgrade',
      planRecommendedLandmarkId: 'construction_tool_container',
      planRecommendedZoneId: 'construction',
    });
  });

  it('AF3-3 completes a non-exhausted autonomous plan → Landmark route → craft → equip', () => {
    runNonExhaustedRoute('PHASE4Q-AF3-NON-EXHAUSTED-ROUTE');
  });

  it('AF3-4 commits a source-driven recommendation during TTL replan from a non-exhausted origin', () => {
    const { state, npc } = nonExhaustedFreshFixture('PHASE4Q-AF3-REPLAN');
    npc.plannedRecipeId = 'r_stick';
    npc.planCreatedAt = state.time - GAME_CONFIG.npcPlanTtl - 1;
    npc.planRecommendedZoneId = 'forest';
    npc.planRecommendedLandmarkId = 'forest_deep_grove';
    npc.planReason = '旧路线';

    runNpcTurn(state, npc, new SeededRandom('PHASE4Q-AF3-REPLAN:turn:0'));

    expect(npc.plannedRecipeId).toBe('r_composite_bow_upgrade');
    expect(npc.planRecommendedLandmarkId).toBe('construction_tool_container');
    expect(npc.planRecommendedZoneId).toBe('construction');
    expect(npc.planRecommendedLandmarkId).not.toBe('forest_deep_grove');
  });

  it('AF3-5 keeps remote hidden Landmark depletion out of fresh non-exhausted planning', () => {
    const normal = nonExhaustedFreshFixture('PHASE4Q-AF3-REMOTE-BOUNDARY');
    const hidden = nonExhaustedFreshFixture('PHASE4Q-AF3-REMOTE-BOUNDARY');
    const target = hidden.state.landmarks.construction_tool_container!;
    target.loot = [];
    target.remainingSearches = 0;
    target.exhausted = true;

    runNpcTurn(normal.state, normal.npc, new SeededRandom('PHASE4Q-AF3-REMOTE-BOUNDARY:turn:0'));
    runNpcTurn(hidden.state, hidden.npc, new SeededRandom('PHASE4Q-AF3-REMOTE-BOUNDARY:turn:0'));

    expect(normal.npc.currentZoneId).toBe('warehouse');
    expect(hidden.npc.currentZoneId).toBe('warehouse');
    expect(planSnapshot(hidden.npc)).toEqual(planSnapshot(normal.npc));
  });

  it('AF3-6 does not let an unrelated Wild gap suppress a Landmark target gap', () => {
    const state = newGame('PHASE4Q-AF3-MIXED-SOURCES');
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    npc.currentZoneId = 'warehouse';
    // The next raw target is rope (Landmark-backed); sinew is a later,
    // unrelated Wild gap in the same recipe.
    noWilds(state);
    const recipe = tryGetRecipe('r_reinforced_sinew')!;
    const plan = buildCraftPlan(state, npc, recipe.id)!;
    expect(plan.rawGaps.some((gap) => gap.itemId === 'sinew' && gap.worldSources.some((source) => source.kind === 'wild_drop'))).toBe(true);
    expect(plan.rawGaps.some((gap) => gap.itemId === 'rope' && gap.sourceLandmarkIds.length > 0)).toBe(true);

    applyNpcPlanRecommendations(state, npc, recipe);

    expect(npc.planRecommendedLandmarkId).not.toBeNull();
    expect(plan.rawGaps.find((gap) => gap.itemId === 'rope')?.sourceLandmarkIds).toContain(npc.planRecommendedLandmarkId);
    expect(npc.planRecommendedZoneId).not.toBeNull();
  });

  it('AF3-7 keeps a Phase 4P Apex recipe on its dedicated null-Landmark route', () => {
    const state = newGame('PHASE4Q-AF3-APEX');
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    npc.personality = 'cautious';
    addItem(npc, createStack(state, 'reinforced_servo'));

    runNpcTurn(state, npc, new SeededRandom('PHASE4Q-AF3-APEX:turn:0'));

    expect(npc.plannedRecipeId).toBe('r_aegis_plate');
    expect(npc.planRecommendedLandmarkId).toBeNull();
  });

  it('AF3-8 keeps a legitimate null route stable on the next ordinary turn', () => {
    const state = newGame('PHASE4Q-AF3-NULL');
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    npc.personality = 'cautious';
    addItem(npc, createStack(state, 'reinforced_servo'));

    runNpcTurn(state, npc, new SeededRandom('PHASE4Q-AF3-NULL:turn:0'));
    const committed = planSnapshot(npc);
    expect(npc.planRecommendedLandmarkId).toBeNull();
    runNpcTurn(state, npc, new SeededRandom('PHASE4Q-AF3-NULL:turn:1'));
    expect(planSnapshot(npc)).toEqual(committed);
  });
});
