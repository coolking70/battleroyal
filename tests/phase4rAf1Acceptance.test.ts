import { describe, expect, it } from 'vitest';
import { GAME_CONFIG, GAME_VERSION } from '../src/data/gameConfig';
import { tryGetRecipe } from '../src/data/recipes';
import { canUseFacility, interactFacility } from '../src/core/facilities';
import { pushEvent } from '../src/core/events';
import { refreshZoneOccupants } from '../src/core/gameState';
import { addItem, countItem, createStack } from '../src/core/inventory';
import { runNpcTurn } from '../src/core/npcAi';
import { decideNpcAccessAction } from '../src/core/npcAccessDecide';
import { applyNpcPlanRecommendations } from '../src/core/npcPlanRecommendation';
import { SeededRandom } from '../src/core/random';
import { validateSaveData } from '../src/core/saveValidation';
import { resolveAccessStep, syncNpcExplorationObjective } from '../src/core/accessChains';
import type { Combatant, GameState } from '../src/core/types';
import { clearInventory, newGame, npcs, player } from './helpers';

function quiet(state: GameState): void {
  for (const wild of Object.values(state.wildEnemies)) {
    wild.status = 'defeated';
    wild.hp = 0;
    wild.defeatedAtTime = state.time;
  }
  for (const character of Object.values(state.characters)) {
    if (!character.isPlayer) character.currentZoneId = 'school';
  }
  refreshZoneOccupants(state);
}

function saveOf(state: GameState): Record<string, unknown> {
  return { version: GAME_VERSION, savedAt: 1, seed: state.seed, time: state.time, rngState: state.rngState, state };
}

function remotePair(seed: string, targetId: string): { normal: GameState; hidden: GameState; normalNpc: Combatant; hiddenNpc: Combatant } {
  const normal = newGame(seed);
  const hidden = newGame(seed);
  quiet(normal);
  quiet(hidden);
  const normalNpc = npcs(normal)[0]!;
  const hiddenNpc = npcs(hidden)[0]!;
  normalNpc.currentZoneId = 'school';
  hiddenNpc.currentZoneId = 'school';
  addItem(normalNpc, createStack(normal, 'field_kit'));
  addItem(hiddenNpc, createStack(hidden, 'field_kit'));
  normalNpc.explorationObjective = syncNpcExplorationObjective(normal, normalNpc, targetId);
  hiddenNpc.explorationObjective = syncNpcExplorationObjective(hidden, hiddenNpc, targetId);
  return { normal, hidden, normalNpc, hiddenNpc };
}

function accessDecisionShape(state: GameState, npc: Combatant): unknown {
  const decision = decideNpcAccessAction(state, npc);
  if (!decision) return null;
  return {
    kind: decision.kind,
    zoneId: 'zoneId' in decision ? decision.zoneId : null,
    landmarkId: 'landmarkId' in decision ? decision.landmarkId : null,
    interactionId: 'interactionId' in decision ? decision.interactionId : null,
  };
}

describe('Phase 4R-AF1 remote information boundary and objective closure', () => {
  it('AF1-1 keeps remote Lab disabled/repaired variants equivalent, then diverges locally', () => {
    const pair = remotePair('PHASE4R-AF1-LAB-STATE', 'lab_analysis_terminal');
    pair.normal.landmarks.lab_analysis_terminal!.disabled = true;
    pair.normal.landmarks.lab_analysis_terminal!.repaired = false;
    pair.hidden.landmarks.lab_analysis_terminal!.disabled = false;
    pair.hidden.landmarks.lab_analysis_terminal!.repaired = true;
    expect(resolveAccessStep(pair.normal, pair.normalNpc, 'lab_analysis_terminal'))
      .toEqual(resolveAccessStep(pair.hidden, pair.hiddenNpc, 'lab_analysis_terminal'));
    expect(pair.normalNpc.explorationObjective).toEqual(pair.hiddenNpc.explorationObjective);
    expect(accessDecisionShape(pair.normal, pair.normalNpc)).toEqual(accessDecisionShape(pair.hidden, pair.hiddenNpc));

    const normalTurn = runNpcTurn(pair.normal, pair.normalNpc, new SeededRandom('PHASE4R-AF1-LAB-TURN'));
    const hiddenTurn = runNpcTurn(pair.hidden, pair.hiddenNpc, new SeededRandom('PHASE4R-AF1-LAB-TURN'));
    expect({ kind: normalTurn.kind, zoneId: normalTurn.zoneId, landmarkId: normalTurn.landmarkId, interactionId: normalTurn.interactionId })
      .toEqual({ kind: hiddenTurn.kind, zoneId: hiddenTurn.zoneId, landmarkId: hiddenTurn.landmarkId, interactionId: hiddenTurn.interactionId });

    pair.normalNpc.currentZoneId = 'lab';
    pair.hiddenNpc.currentZoneId = 'lab';
    addItem(pair.normalNpc, createStack(pair.normal, 'field_kit'));
    addItem(pair.hiddenNpc, createStack(pair.hidden, 'field_kit'));
    expect(resolveAccessStep(pair.normal, pair.normalNpc, 'lab_analysis_terminal').action).toBe('interact');
    expect(resolveAccessStep(pair.hidden, pair.hiddenNpc, 'lab_analysis_terminal').action).toBe('search');
  });

  it('AF1-2 keeps remote Factory locked/unlocked variants equivalent, then uses local lock state', () => {
    const pair = remotePair('PHASE4R-AF1-FACTORY-LOCK', 'factory_assembly_line');
    pair.normal.landmarks.factory_machine_shop!.activated = true;
    pair.hidden.landmarks.factory_machine_shop!.activated = true;
    pair.normal.landmarks.factory_assembly_line!.locked = true;
    pair.hidden.landmarks.factory_assembly_line!.locked = false;
    expect(resolveAccessStep(pair.normal, pair.normalNpc, 'factory_assembly_line'))
      .toEqual(resolveAccessStep(pair.hidden, pair.hiddenNpc, 'factory_assembly_line'));
    expect(accessDecisionShape(pair.normal, pair.normalNpc)).toEqual(accessDecisionShape(pair.hidden, pair.hiddenNpc));

    pair.normalNpc.currentZoneId = 'factory';
    pair.hiddenNpc.currentZoneId = 'factory';
    expect(resolveAccessStep(pair.normal, pair.normalNpc, 'factory_assembly_line').ok).toBe(false);
    expect(resolveAccessStep(pair.hidden, pair.hiddenNpc, 'factory_assembly_line').ok).toBe(true);
  });

  it('AF1-3 ignores remote charges but enforces charges after local arrival', () => {
    const pair = remotePair('PHASE4R-AF1-CHARGES', 'lab_analysis_terminal');
    for (const state of [pair.normal, pair.hidden]) {
      state.landmarks.lab_analysis_terminal!.disabled = false;
      state.landmarks.lab_analysis_terminal!.repaired = true;
    }
    pair.normal.landmarks.lab_analysis_terminal!.charges = 2;
    pair.hidden.landmarks.lab_analysis_terminal!.charges = 0;
    expect(resolveAccessStep(pair.normal, pair.normalNpc, 'lab_analysis_terminal'))
      .toEqual(resolveAccessStep(pair.hidden, pair.hiddenNpc, 'lab_analysis_terminal'));

    pair.normalNpc.currentZoneId = 'lab';
    pair.hiddenNpc.currentZoneId = 'lab';
    expect(canUseFacility(pair.normal, pair.normalNpc, 'lab_analysis_terminal', 'analyze').ok).toBe(true);
    expect(canUseFacility(pair.hidden, pair.hiddenNpc, 'lab_analysis_terminal', 'analyze').ok).toBe(false);
  });

  it('AF1-4 ignores remote lastUsedAt and private facility events', () => {
    const pair = remotePair('PHASE4R-AF1-EVENT-BOUNDARY', 'lab_analysis_terminal');
    pair.hidden.landmarks.lab_analysis_terminal!.lastUsedAt = 77;
    pushEvent(pair.hidden, {
      type: 'FACILITY_USED', actorId: pair.hiddenNpc.id, zoneId: 'lab', message: 'private runtime fixture',
      metadata: { landmarkId: 'lab_analysis_terminal', interactionId: 'analyze', remainingCharges: 1 },
    });
    expect(resolveAccessStep(pair.normal, pair.normalNpc, 'lab_analysis_terminal'))
      .toEqual(resolveAccessStep(pair.hidden, pair.hiddenNpc, 'lab_analysis_terminal'));
    expect(accessDecisionShape(pair.normal, pair.normalNpc)).toEqual(accessDecisionShape(pair.hidden, pair.hiddenNpc));
  });

  it('AF1-5 retains remote exhaustion isolation while preserving local exhaustion blocking', () => {
    const pair = remotePair('PHASE4R-AF1-EXHAUSTION', 'factory_assembly_line');
    const hiddenRuntime = pair.hidden.landmarks.factory_assembly_line!;
    hiddenRuntime.exhausted = true;
    hiddenRuntime.loot = [];
    hiddenRuntime.remainingSearches = 0;
    hiddenRuntime.locked = false;
    hiddenRuntime.disabled = false;
    hiddenRuntime.repaired = true;
    hiddenRuntime.charges = 0;
    hiddenRuntime.lastUsedAt = 88;
    expect(resolveAccessStep(pair.normal, pair.normalNpc, 'factory_assembly_line'))
      .toEqual(resolveAccessStep(pair.hidden, pair.hiddenNpc, 'factory_assembly_line'));
    pair.hiddenNpc.currentZoneId = 'factory';
    expect(resolveAccessStep(pair.hidden, pair.hiddenNpc, 'factory_assembly_line').ok).toBe(false);
  });

  it('AF1-6 clears an old access objective when the formal planner replaces it with Apex', () => {
    const state = newGame('PHASE4R-AF1-APEX-INVALIDATION');
    quiet(state);
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    npc.personality = 'cautious';
    npc.plannedRecipeId = 'r_reinforced_pipe';
    npc.planCreatedAt = 0;
    npc.planReason = 'ordinary access route';
    npc.explorationObjective = syncNpcExplorationObjective(state, npc, 'factory_assembly_line');
    expect(npc.explorationObjective).not.toBeNull();
    addItem(npc, createStack(state, 'reinforced_servo'));
    state.time = GAME_CONFIG.npcPlanTtl;
    runNpcTurn(state, npc, new SeededRandom('PHASE4R-AF1-APEX-INVALIDATION'));
    expect(npc.plannedRecipeId).toBe('r_aegis_plate');
    expect(npc.explorationObjective).toBeNull();
  });

  it('AF1-7 preserves the committed target and committedAt during ordinary refresh', () => {
    const state = newGame('PHASE4R-AF1-ORDINARY-PRESERVE');
    quiet(state);
    const npc = npcs(state)[0]!;
    npc.plannedRecipeId = 'r_reinforced_pipe';
    npc.planCreatedAt = state.time;
    npc.planReason = 'ordinary access route';
    applyNpcPlanRecommendations(state, npc, tryGetRecipe('r_reinforced_pipe'), true);
    npc.explorationObjective = syncNpcExplorationObjective(state, npc, 'factory_assembly_line');
    const committed = structuredClone(npc.explorationObjective);
    runNpcTurn(state, npc, new SeededRandom('PHASE4R-AF1-ORDINARY-PRESERVE'));
    expect(npc.explorationObjective).toEqual(committed);
  });

  it('AF1-8 rejects all-ID-valid but semantically unrelated objectives', () => {
    const valid = newGame('PHASE4R-AF1-SEMANTIC-VALID');
    quiet(valid);
    const validNpc = npcs(valid)[0]!;
    validNpc.explorationObjective = syncNpcExplorationObjective(valid, validNpc, 'factory_assembly_line');
    expect(validateSaveData(saveOf(valid)).ok).toBe(true);

    const unrelatedNext = newGame('PHASE4R-AF1-SEMANTIC-NEXT');
    const nextNpc = npcs(unrelatedNext)[0]!;
    nextNpc.explorationObjective = {
      targetLandmarkId: 'factory_assembly_line', nextLandmarkId: 'hospital_pharmacy', phase: 'reach_target',
      requiredItemId: null, prerequisiteLandmarkId: null, reason: 'unrelated', committedAt: 0,
    };
    expect(validateSaveData(saveOf(unrelatedNext)).ok).toBe(false);

    const unrelatedPrerequisite = newGame('PHASE4R-AF1-SEMANTIC-PREREQ');
    const prerequisiteNpc = npcs(unrelatedPrerequisite)[0]!;
    prerequisiteNpc.explorationObjective = {
      targetLandmarkId: 'factory_assembly_line', nextLandmarkId: 'factory_machine_shop', phase: 'complete_prerequisite',
      requiredItemId: null, prerequisiteLandmarkId: 'residential_basement_storage', reason: 'unrelated', committedAt: 0,
    };
    expect(validateSaveData(saveOf(unrelatedPrerequisite)).ok).toBe(false);

    const unrelatedItem = newGame('PHASE4R-AF1-SEMANTIC-ITEM');
    const itemNpc = npcs(unrelatedItem)[0]!;
    itemNpc.explorationObjective = {
      targetLandmarkId: 'lab_analysis_terminal', nextLandmarkId: 'lab_analysis_terminal', phase: 'reach_target',
      requiredItemId: 'battery', prerequisiteLandmarkId: null, reason: 'unrelated', committedAt: 0,
    };
    expect(validateSaveData(saveOf(unrelatedItem)).ok).toBe(false);
  });

  it('AF1-9 restores the legacy Engineer repair bypass without bypassing unlock tools', () => {
    const state = newGame('PHASE4R-AF1-ENGINEER', 'engineer');
    quiet(state);
    const engineer = player(state);
    engineer.currentZoneId = 'station';
    engineer.stamina = engineer.maxStamina;
    expect(countItem(engineer, 'battery')).toBe(0);
    expect(canUseFacility(state, engineer, 'station_control_room', 'restore_control').ok).toBe(true);
    expect(interactFacility(state, engineer, 'station_control_room', 'restore_control').ok).toBe(true);
    expect(state.landmarks.station_control_room!.disabled).toBe(false);
    expect(countItem(engineer, 'battery')).toBe(0);

    const ordinary = newGame('PHASE4R-AF1-ENGINEER-CONTROL', 'scout');
    quiet(ordinary);
    const scout = player(ordinary);
    scout.currentZoneId = 'station';
    expect(canUseFacility(ordinary, scout, 'station_control_room', 'restore_control').ok).toBe(false);

    const secure = newGame('PHASE4R-AF1-ENGINEER-UNLOCK', 'engineer');
    quiet(secure);
    const unlockEngineer = player(secure);
    unlockEngineer.currentZoneId = 'warehouse';
    expect(canUseFacility(secure, unlockEngineer, 'warehouse_secure_storage', 'open_secure_storage').ok).toBe(false);
  });
});
