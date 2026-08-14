import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { buildCraftPlan } from '../src/core/craftPlan';
import { runNpcTurn } from '../src/core/npcAi';
import { addItem, countItem, createStack } from '../src/core/inventory';
import { SeededRandom } from '../src/core/random';
import type { Combatant, GameState } from '../src/core/types';
import { clearInventory, newGame, npcs } from './helpers';

function noWilds(state: GameState): void {
  for (const zone of Object.values(state.zones)) zone.wildEnemyIds = [];
  for (const wild of Object.values(state.wildEnemies)) {
    wild.status = 'defeated';
    wild.hp = 0;
  }
}

function emptyZone(state: GameState, zoneId: string): void {
  const zone = state.zones[zoneId]!;
  zone.loot = [];
  zone.objectiveLoot = [];
  zone.initialLootCount = 0;
  zone.remainingLootCount = 0;
  zone.supply = 0;
}

function configureRouteLandmark(state: GameState, exhausted = false): void {
  const target = state.landmarks.construction_tool_container!;
  target.loot = exhausted ? [] : [createStack(state, 'rope')];
  target.remainingSearches = exhausted ? 0 : 1;
  target.maxSearches = 1;
  target.exhausted = exhausted;
  target.locked = false;
  target.disabled = false;
}

function ordinaryFreshFixture(seed: string, origin = 'warehouse'): { state: GameState; npc: Combatant } {
  const state = newGame(seed);
  const npc = npcs(state)[0]!;
  clearInventory(npc);
  npc.personality = 'aggressive';
  npc.currentZoneId = origin;
  npc.planCreatedAt = null;
  npc.plannedRecipeId = null;
  npc.planRecommendedZoneId = null;
  npc.planRecommendedLandmarkId = null;
  npc.planNoProgressTurns = 0;
  npc.planProgress = 0;
  npc.stamina = npc.maxStamina = 100;
  addItem(npc, createStack(state, 'processed_wood'));
  addItem(npc, createStack(state, 'rope_bundle'));
  addItem(npc, createStack(state, 'glass'));
  for (const character of Object.values(state.characters)) {
    if (character.id !== npc.id) character.currentZoneId = 'school';
  }
  noWilds(state);
  emptyZone(state, origin);
  for (const landmark of Object.values(state.landmarks)) {
    if (landmark.zoneId !== origin) continue;
    landmark.loot = [];
    landmark.remainingSearches = 0;
    landmark.exhausted = true;
  }
  configureRouteLandmark(state);
  return { state, npc };
}

function runFreshOrdinaryRoute(seed: string): GameState {
  const { state, npc } = ordinaryFreshFixture(seed);
  expect(npc.plannedRecipeId).toBeNull();
  expect(npc.planRecommendedLandmarkId).toBeNull();

  runNpcTurn(state, npc, new SeededRandom(`${seed}:turn:0`));
  expect(npc.plannedRecipeId).toBe('r_composite_bow_upgrade');
  expect(npc.planRecommendedLandmarkId).toBe('construction_tool_container');
  expect(npc.planRecommendedZoneId).toBe('construction');
  const plan = buildCraftPlan(state, npc, npc.plannedRecipeId!);
  expect(plan?.rawGaps.some((gap) => gap.itemId === 'rope' && gap.sourceLandmarkIds.includes('construction_tool_container'))).toBe(true);

  for (let turn = 1; turn < 180 && !npc.equipment.some((stack) => stack.itemId === 'composite_bow_upgrade'); turn += 1) {
    runNpcTurn(state, npc, new SeededRandom(`${seed}:turn:${turn}`));
  }
  expect(state.events.some((event) => event.type === 'CHARACTER_MOVED' && event.actorId === npc.id && event.zoneId === 'construction')).toBe(true);
  expect(npc.equipment.some((stack) => stack.itemId === 'composite_bow_upgrade')).toBe(true);
  return state;
}

function routeEvents(state: GameState, npcId: string): Array<{ type: string; zoneId: string | null; metadata: Record<string, unknown> }> {
  return state.events
    .filter((event) => event.actorId === npcId && ['CHARACTER_MOVED', 'LANDMARK_SEARCHED', 'ITEM_FOUND', 'ITEM_PICKED', 'ITEM_CRAFTED', 'ITEM_EQUIPPED'].includes(event.type))
    .map((event) => ({ type: event.type, zoneId: event.zoneId, metadata: event.metadata }));
}

describe('Phase 4Q-AF2 NPC landmark plan integration', () => {
  it('AF2-1 creates a landmark recommendation in the fresh production plan path', () => {
    const { state, npc } = ordinaryFreshFixture('PHASE4Q-AF2-FRESH-PLAN');
    expect(npc.plannedRecipeId).toBeNull();
    expect(npc.planRecommendedLandmarkId).toBeNull();

    runNpcTurn(state, npc, new SeededRandom('PHASE4Q-AF2-FRESH-PLAN:turn:0'));

    expect(npc.plannedRecipeId).toBe('r_composite_bow_upgrade');
    expect(npc.planCreatedAt).toBe(state.time);
    expect(npc.planRecommendedLandmarkId).toBe('construction_tool_container');
    expect(npc.planRecommendedZoneId).toBe('construction');
    const plan = buildCraftPlan(state, npc, npc.plannedRecipeId!);
    expect(plan?.rawGaps.some((gap) => gap.itemId === 'rope' && gap.sourceLandmarkIds.includes('construction_tool_container'))).toBe(true);
  });

  it('AF2-2 completes fresh plan → MOVE → SEARCH → PICKUP → CRAFT → EQUIP through runNpcTurn only', () => {
    const { state, npc } = ordinaryFreshFixture('PHASE4Q-AF2-FRESH-ROUTE');
    const startZone = npc.currentZoneId;
    const initialPlan = { plannedRecipeId: npc.plannedRecipeId, landmarkId: npc.planRecommendedLandmarkId };
    runNpcTurn(state, npc, new SeededRandom('PHASE4Q-AF2-FRESH-ROUTE:turn:0'));
    expect(initialPlan).toEqual({ plannedRecipeId: null, landmarkId: null });

    for (let turn = 1; turn < 180 && !npc.equipment.some((stack) => stack.itemId === 'composite_bow_upgrade'); turn += 1) {
      runNpcTurn(state, npc, new SeededRandom(`PHASE4Q-AF2-FRESH-ROUTE:turn:${turn}`));
    }

    const events = state.events;
    const moveIndex = events.findIndex((event) => event.type === 'CHARACTER_MOVED' && event.actorId === npc.id);
    const foundIndex = events.findIndex((event) => event.type === 'ITEM_FOUND' && event.actorId === npc.id && event.metadata.itemId === 'rope');
    const pickedIndex = events.findIndex((event) => event.type === 'ITEM_PICKED' && event.actorId === npc.id && event.metadata.itemId === 'rope');
    const searchedIndex = events.findIndex((event) => event.type === 'LANDMARK_SEARCHED' && event.actorId === npc.id && event.metadata.landmarkId === 'construction_tool_container');
    const craftIndex = events.findIndex((event) => event.type === 'ITEM_CRAFTED' && event.actorId === npc.id && event.metadata.recipeId === 'r_composite_bow_upgrade');
    const equipIndex = events.findIndex((event) => event.type === 'ITEM_EQUIPPED' && event.actorId === npc.id && event.metadata.itemId === 'composite_bow_upgrade');
    expect(startZone).toBe('warehouse');
    expect(events.some((event) => event.type === 'CHARACTER_MOVED' && event.actorId === npc.id && event.zoneId === 'construction')).toBe(true);
    expect(moveIndex).toBeGreaterThanOrEqual(0);
    expect(foundIndex).toBeGreaterThan(moveIndex);
    expect(pickedIndex).toBeGreaterThan(foundIndex);
    expect(searchedIndex).toBeGreaterThan(pickedIndex);
    expect(craftIndex).toBeGreaterThan(searchedIndex);
    expect(equipIndex).toBeGreaterThan(craftIndex);
    expect(countItem(npc, 'composite_bow_upgrade')).toBe(0);
    expect(npc.equipment.some((stack) => stack.itemId === 'composite_bow_upgrade')).toBe(true);
    expect(events.some((event) => event.type.startsWith('DEBUG_'))).toBe(false);
  });

  it('AF2-3 replays the fresh production route deterministically', () => {
    const first = runFreshOrdinaryRoute('PHASE4Q-AF2-DETERMINISTIC');
    const second = runFreshOrdinaryRoute('PHASE4Q-AF2-DETERMINISTIC');
    const firstNpc = npcs(first)[0]!;
    const secondNpc = npcs(second)[0]!;
    expect(secondNpc.plannedRecipeId).toBe(firstNpc.plannedRecipeId);
    expect(secondNpc.planRecommendedLandmarkId).toBe(firstNpc.planRecommendedLandmarkId);
    expect(secondNpc.planRecommendedZoneId).toBe(firstNpc.planRecommendedZoneId);
    expect(routeEvents(second, secondNpc.id)).toEqual(routeEvents(first, firstNpc.id));
    expect(secondNpc.inventory).toEqual(firstNpc.inventory);
    expect(secondNpc.equipment).toEqual(firstNpc.equipment);
  });

  it('AF2-4 commits a new landmark recommendation during formal TTL replan', () => {
    const { state, npc } = ordinaryFreshFixture('PHASE4Q-AF2-REPLAN');
    npc.plannedRecipeId = 'r_stick';
    npc.planCreatedAt = state.time - GAME_CONFIG.npcPlanTtl - 1;
    npc.planRecommendedZoneId = 'forest';
    npc.planRecommendedLandmarkId = 'forest_deep_grove';
    npc.planReason = '旧路线';

    runNpcTurn(state, npc, new SeededRandom('PHASE4Q-AF2-REPLAN:turn:0'));

    expect(npc.plannedRecipeId).toBe('r_composite_bow_upgrade');
    expect(npc.planCreatedAt).toBe(state.time);
    expect(npc.planRecommendedLandmarkId).toBe('construction_tool_container');
    expect(npc.planRecommendedZoneId).toBe('construction');
    expect(npc.planRecommendedLandmarkId).not.toBe('forest_deep_grove');
  });

  it('AF2-5 permits a legitimate null landmark route without per-turn recomputation', () => {
    const state = newGame('PHASE4Q-AF2-NULL-APEX');
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    npc.personality = 'cautious';
    npc.hp = npc.maxHp;
    addItem(npc, createStack(state, 'reinforced_servo'));
    npc.planRecommendedLandmarkId = null;
    expect(npc.plannedRecipeId).toBeNull();

    runNpcTurn(state, npc, new SeededRandom('PHASE4Q-AF2-NULL-APEX:turn:0'));
    expect(npc.plannedRecipeId).toBe('r_aegis_plate');
    expect(npc.planRecommendedLandmarkId).toBeNull();
    const committed = {
      plannedRecipeId: npc.plannedRecipeId,
      planCreatedAt: npc.planCreatedAt,
      planRecommendedZoneId: npc.planRecommendedZoneId,
      planRecommendedLandmarkId: npc.planRecommendedLandmarkId,
      lastReplanReason: npc.lastReplanReason,
    };

    runNpcTurn(state, npc, new SeededRandom('PHASE4Q-AF2-NULL-APEX:turn:1'));
    expect({
      plannedRecipeId: npc.plannedRecipeId,
      planCreatedAt: npc.planCreatedAt,
      planRecommendedZoneId: npc.planRecommendedZoneId,
      planRecommendedLandmarkId: npc.planRecommendedLandmarkId,
      lastReplanReason: npc.lastReplanReason,
    }).toEqual(committed);
  });

  it('AF2-6 keeps the Phase 4P Apex route free of landmark injection', () => {
    const state = newGame('PHASE4Q-AF2-APEX-PROTECTION');
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    npc.personality = 'cautious';
    addItem(npc, createStack(state, 'reinforced_servo'));
    runNpcTurn(state, npc, new SeededRandom('PHASE4Q-AF2-APEX-PROTECTION:turn:0'));
    expect(npc.plannedRecipeId).toBe('r_aegis_plate');
    expect(npc.planRecommendedLandmarkId).toBeNull();
  });

  it('AF2-7 gives identical fresh recommendations before arrival despite remote hidden state', () => {
    const normal = ordinaryFreshFixture('PHASE4Q-AF2-REMOTE-NORMAL', 'school');
    const hidden = ordinaryFreshFixture('PHASE4Q-AF2-REMOTE-HIDDEN', 'school');
    configureRouteLandmark(hidden.state, true);

    runNpcTurn(normal.state, normal.npc, new SeededRandom('PHASE4Q-AF2-REMOTE:turn:0'));
    runNpcTurn(hidden.state, hidden.npc, new SeededRandom('PHASE4Q-AF2-REMOTE:turn:0'));

    expect(normal.npc.currentZoneId).not.toBe('construction');
    expect(hidden.npc.currentZoneId).not.toBe('construction');
    expect(hidden.npc.plannedRecipeId).toBe(normal.npc.plannedRecipeId);
    expect(hidden.npc.planRecommendedLandmarkId).toBe(normal.npc.planRecommendedLandmarkId);
    expect(hidden.npc.planRecommendedZoneId).toBe(normal.npc.planRecommendedZoneId);
  });

  it('AF2-8 keeps a fresh NPC plan isolated from the player craft goal', () => {
    const withoutPlayerGoal = ordinaryFreshFixture('PHASE4Q-AF2-PLAYER-GOAL-A', 'school');
    const withPlayerGoal = ordinaryFreshFixture('PHASE4Q-AF2-PLAYER-GOAL-B', 'school');
    withPlayerGoal.state.craftGoalRecipeId = 'r_research_package';

    runNpcTurn(withoutPlayerGoal.state, withoutPlayerGoal.npc, new SeededRandom('PHASE4Q-AF2-PLAYER-GOAL:turn:0'));
    runNpcTurn(withPlayerGoal.state, withPlayerGoal.npc, new SeededRandom('PHASE4Q-AF2-PLAYER-GOAL:turn:0'));

    expect(withPlayerGoal.npc.plannedRecipeId).toBe(withoutPlayerGoal.npc.plannedRecipeId);
    expect(withPlayerGoal.npc.planRecommendedLandmarkId).toBe(withoutPlayerGoal.npc.planRecommendedLandmarkId);
    expect(withPlayerGoal.npc.planRecommendedZoneId).toBe(withoutPlayerGoal.npc.planRecommendedZoneId);
  });
});
