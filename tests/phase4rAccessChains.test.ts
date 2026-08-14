import { describe, expect, it } from 'vitest';
import { executeCommand } from '../src/core/gameEngine';
import { applyNpcPlanRecommendations } from '../src/core/npcPlanRecommendation';
import { resolveAccessStep, syncNpcExplorationObjective } from '../src/core/accessChains';
import { addItem, countItem, createStack } from '../src/core/inventory';
import { runNpcTurn } from '../src/core/npcAi';
import { SeededRandom } from '../src/core/random';
import { validateSaveData } from '../src/core/saveValidation';
import { createMemoryStorage, loadGame, saveGame, setStorage } from '../src/core/saveLoad';
import { getCharacterSkills } from '../src/core/skills';
import { tryGetRecipe } from '../src/data/recipes';
import { GAME_VERSION } from '../src/data/gameConfig';
import { newGame, npcs, player, clearInventory } from './helpers';
import type { GameState } from '../src/core/types';

function quiet(state: GameState): void {
  for (const wild of Object.values(state.wildEnemies)) {
    wild.status = 'defeated';
    wild.hp = 0;
    wild.defeatedAtTime = state.time;
  }
  for (const character of Object.values(state.characters)) {
    if (!character.isPlayer) character.currentZoneId = 'school';
  }
}

function saveOf(state: GameState): Record<string, unknown> {
  return { version: GAME_VERSION, savedAt: 1, seed: state.seed, time: state.time, rngState: state.rngState, state };
}

describe('Phase 4R local access chains', () => {
  it('R-1 completes four data-driven chains through formal actions', () => {
    let state = newGame('PHASE4R-PLAYER-FACTORY');
    quiet(state);
    player(state).currentZoneId = 'factory';
    let result = executeCommand(state, { type: 'SEARCH_LANDMARK', landmarkId: 'factory_assembly_line' });
    expect(result.ok).toBe(false);
    result = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'factory_machine_shop', interactionId: 'use_workbench' });
    expect(result.ok).toBe(true);
    expect(result.state.landmarks.factory_assembly_line!.locked).toBe(false);
    result = executeCommand(result.state, { type: 'SEARCH_LANDMARK', landmarkId: 'factory_assembly_line' });
    expect(result.ok).toBe(true);

    state = newGame('PHASE4R-PLAYER-RESIDENTIAL');
    quiet(state);
    player(state).currentZoneId = 'residential';
    result = executeCommand(state, { type: 'SEARCH_LANDMARK', landmarkId: 'residential_basement_storage' });
    expect(result.ok).toBe(true);
    expect(result.state.landmarks.residential_apartment_block!.locked).toBe(false);
    result = executeCommand(result.state, { type: 'SEARCH_LANDMARK', landmarkId: 'residential_apartment_block' });
    expect(result.ok).toBe(true);

    state = newGame('PHASE4R-PLAYER-UNDERGROUND');
    quiet(state);
    const undergroundActor = player(state);
    undergroundActor.currentZoneId = 'underground';
    addItem(undergroundActor, createStack(state, 'wire', 2));
    result = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'underground_service_room', interactionId: 'service_system' });
    expect(result.ok).toBe(true);
    expect(result.state.landmarks.underground_sealed_passage!.locked).toBe(false);
    result = executeCommand(result.state, { type: 'SEARCH_LANDMARK', landmarkId: 'underground_sealed_passage' });
    expect(result.ok).toBe(true);

    state = newGame('PHASE4R-PLAYER-LAB');
    quiet(state);
    const labActor = player(state);
    labActor.currentZoneId = 'lab';
    const tool = createStack(state, 'field_kit');
    addItem(labActor, tool);
    result = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'lab_analysis_terminal', interactionId: 'analyze' });
    expect(result.ok).toBe(true);
    expect(result.state.landmarks.lab_analysis_terminal!.repaired).toBe(true);
    result = executeCommand(result.state, { type: 'SEARCH_LANDMARK', landmarkId: 'lab_analysis_terminal' });
    expect(result.ok).toBe(true);
  });

  it('R-2 rejects an unmet requirement without cost or state mutation', () => {
    const state = newGame('PHASE4R-REQUIREMENT-LEGALITY');
    quiet(state);
    const actor = player(state);
    actor.currentZoneId = 'lab';
    actor.stamina = actor.maxStamina;
    const before = JSON.stringify({ time: state.time, stamina: actor.stamina, runtime: state.landmarks.lab_analysis_terminal, inventory: actor.inventory });
    const result = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'lab_analysis_terminal', interactionId: 'analyze' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('野外工具包');
    expect(JSON.stringify({ time: state.time, stamina: actor.stamina, runtime: state.landmarks.lab_analysis_terminal, inventory: actor.inventory })).toBe(before);
  });

  it('R-3 consumes exactly one UID-bearing stack quantity for a repair', () => {
    const state = newGame('PHASE4R-CONSUMABLE');
    quiet(state);
    const actor = player(state);
    actor.currentZoneId = 'underground';
    const wire = createStack(state, 'wire', 2);
    addItem(actor, wire);
    const result = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'underground_service_room', interactionId: 'service_system' });
    expect(result.ok).toBe(true);
    const remaining = player(result.state).inventory.find((stack) => stack.itemId === 'wire');
    expect(remaining?.uid).toBe(wire.uid);
    expect(remaining?.count).toBe(1);
    expect(countItem(player(result.state), 'wire')).toBe(1);
    expect(result.state.landmarks.underground_sealed_passage!.locked).toBe(false);
  });

  it('R-4 retains a non-consumable access tool UID after repair', () => {
    const state = newGame('PHASE4R-NON-CONSUMABLE');
    quiet(state);
    const actor = player(state);
    actor.currentZoneId = 'lab';
    const tool = createStack(state, 'field_kit');
    addItem(actor, tool);
    const result = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'lab_analysis_terminal', interactionId: 'analyze' });
    expect(result.ok).toBe(true);
    const retained = player(result.state).inventory.find((stack) => stack.uid === tool.uid);
    expect(retained).toEqual(expect.objectContaining({ uid: tool.uid, itemId: 'field_kit', count: 1 }));
  });

  it('R-5 emits a deterministic local unlock event and round-trips it', () => {
    const state = newGame('PHASE4R-DYNAMIC-SAVE');
    quiet(state);
    player(state).currentZoneId = 'factory';
    const activated = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'factory_machine_shop', interactionId: 'use_workbench' }).state;
    const unlocks = activated.events.filter((event) => event.type === 'LANDMARK_UNLOCKED');
    expect(unlocks).toHaveLength(1);
    expect(unlocks[0]!.metadata).toEqual({ landmarkId: 'factory_assembly_line', triggerLandmarkId: 'factory_machine_shop' });
    expect(validateSaveData(saveOf(activated)).ok).toBe(true);
    const storage = createMemoryStorage();
    setStorage(storage);
    try {
      expect(saveGame(activated).ok).toBe(true);
      const loaded = loadGame();
      expect(loaded.ok).toBe(true);
      if (loaded.ok) expect(loaded.data.state.landmarks.factory_assembly_line!.locked).toBe(false);
    } finally {
      setStorage(null);
    }
  });

  it('R-6 does not read remote hidden depletion until local arrival', () => {
    const normal = newGame('PHASE4R-REMOTE-NORMAL');
    const hidden = newGame('PHASE4R-REMOTE-HIDDEN');
    quiet(normal);
    quiet(hidden);
    const normalNpc = npcs(normal)[0]!;
    const hiddenNpc = npcs(hidden)[0]!;
    normalNpc.currentZoneId = 'school';
    hiddenNpc.currentZoneId = 'school';
    const hiddenRuntime = hidden.landmarks.factory_assembly_line!;
    hiddenRuntime.exhausted = true;
    hiddenRuntime.loot = [];
    hiddenRuntime.remainingSearches = 0;
    expect(resolveAccessStep(normal, normalNpc, 'factory_assembly_line')).toEqual(resolveAccessStep(hidden, hiddenNpc, 'factory_assembly_line'));
    hiddenNpc.currentZoneId = 'factory';
    const localHidden = resolveAccessStep(hidden, hiddenNpc, 'factory_assembly_line');
    expect(localHidden.ok).toBe(false);
    expect(localHidden.reason).toContain('耗尽');
  });

  it('R-7 preserves a completed prerequisite without re-consuming on save/load', () => {
    const state = newGame('PHASE4R-MID-CHAIN-SAVE');
    quiet(state);
    player(state).currentZoneId = 'factory';
    const mid = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'factory_machine_shop', interactionId: 'use_workbench' }).state;
    const eventCount = mid.events.length;
    const raw = saveOf(mid);
    expect(validateSaveData(raw).ok).toBe(true);
    const loaded = structuredClone(raw) as typeof raw;
    const loadedState = (loaded.state as GameState);
    expect(loadedState.landmarks.factory_machine_shop!.charges).toBe(0);
    expect(loadedState.landmarks.factory_assembly_line!.locked).toBe(false);
    expect(loadedState.events.length).toBe(eventCount);
    expect(countItem(player(loadedState), 'wire')).toBe(countItem(player(mid), 'wire'));
  });

  it('R-8 rejects impossible access and objective save states', () => {
    const invalidAccess = saveOf(newGame('PHASE4R-MALFORMED-ACCESS')) as any;
    invalidAccess.state.landmarks.factory_assembly_line.locked = false;
    expect(validateSaveData(invalidAccess).ok).toBe(false);

    const invalidObjective = saveOf(newGame('PHASE4R-MALFORMED-OBJECTIVE')) as any;
    const npc = Object.values(invalidObjective.state.characters).find((candidate: any) => !candidate.isPlayer) as any;
    npc.explorationObjective = {
      targetLandmarkId: 'factory_assembly_line', nextLandmarkId: 'not_a_landmark', phase: 'reach_target',
      requiredItemId: null, prerequisiteLandmarkId: null, reason: '坏目标', committedAt: 0,
    };
    expect(validateSaveData(invalidObjective).ok).toBe(false);
  });

  it('R-9 autonomously runs MOVE → INTERACT → UNLOCK → SEARCH → CRAFT', () => {
    const state = newGame('PHASE4R-NPC-AUTONOMOUS');
    quiet(state);
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'school';
    npc.stamina = npc.maxStamina = 100;
    npc.plannedRecipeId = 'r_reinforced_pipe';
    npc.planCreatedAt = state.time;
    npc.planReason = 'Phase 4R explicit access goal';
    npc.planProgress = 0;
    npc.planNoProgressTurns = 0;
    npc.planRecommendedZoneId = null;
    npc.planRecommendedLandmarkId = null;
    npc.explorationObjective = null;
    npc.skillCooldowns = Object.fromEntries(getCharacterSkills(npc.characterId).map((skillId) => [skillId, 99]));
    clearInventory(npc);
    addItem(npc, createStack(state, 'wooden_handle'));
    for (const character of Object.values(state.characters)) if (character.id !== npc.id) character.currentZoneId = 'lab';
    for (const zoneId of ['forest', 'commercial', 'station', 'park', 'warehouse', 'construction', 'underground']) state.zones[zoneId]!.status = 'restricted';
    for (const landmark of Object.values(state.landmarks)) {
      if (landmark.landmarkId === 'factory_machine_shop' || landmark.landmarkId === 'factory_assembly_line') continue;
      landmark.loot = [];
      landmark.remainingSearches = 0;
      landmark.exhausted = true;
    }
    const target = state.landmarks.factory_assembly_line!;
    target.loot = [createStack(state, 'metal_parts')];
    target.remainingSearches = 1;
    target.maxSearches = 1;
    target.exhausted = false;

    for (let turn = 0; turn < 12 && !state.events.some((event) => event.type === 'ITEM_CRAFTED' && event.actorId === npc.id && event.metadata.recipeId === 'r_reinforced_pipe'); turn += 1) {
      runNpcTurn(state, npc, new SeededRandom(`PHASE4R-NPC-AUTONOMOUS:${turn}`));
    }
    const routeEvents = state.events.filter((event) => event.actorId === npc.id);
    expect(routeEvents.some((event) => event.type === 'FACILITY_USED' && event.metadata.landmarkId === 'factory_machine_shop')).toBe(true);
    expect(routeEvents.some((event) => event.type === 'LANDMARK_UNLOCKED' && event.metadata.landmarkId === 'factory_assembly_line')).toBe(true);
    expect(routeEvents.some((event) => event.type === 'LANDMARK_SEARCHED' && event.metadata.landmarkId === 'factory_assembly_line')).toBe(true);
    expect(routeEvents.some((event) => event.type === 'ITEM_CRAFTED' && event.metadata.recipeId === 'r_reinforced_pipe')).toBe(true);
    expect(routeEvents.some((event) => event.type.startsWith('DEBUG_'))).toBe(false);
  });

  it('R-10 keeps an unavailable access route on a legal fallback without per-turn replanning', () => {
    const state = newGame('PHASE4R-NPC-FALLBACK');
    quiet(state);
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'school';
    for (const character of Object.values(state.characters)) if (character.id !== npc.id) character.currentZoneId = 'lab';
    npc.explorationObjective = syncNpcExplorationObjective(state, npc, 'factory_assembly_line');
    state.zones.residential!.status = 'safe';
    state.zones.factory!.status = 'restricted';
    const before = JSON.stringify(npc.explorationObjective);
    const decisions = [0, 1, 2].map((turn) => runNpcTurn(state, npc, new SeededRandom(`PHASE4R-NPC-FALLBACK:${turn}`)));
    expect(decisions.every((decision) => decision.kind === 'rest' || decision.kind === 'move')).toBe(true);
    expect(JSON.stringify(npc.explorationObjective)).toBe(before);
    expect(state.events.filter((event) => event.type === 'NPC_ACTION' && event.metadata.rejected === true)).toHaveLength(0);
  });

  it('R-11 keeps ordinary source-driven crafting and Apex routes separate', () => {
    const state = newGame('PHASE4R-PROTECTION');
    quiet(state);
    const npc = npcs(state)[0]!;
    npc.plannedRecipeId = 'r_aegis_plate';
    npc.planCreatedAt = state.time;
    npc.planReason = 'Apex route';
    applyNpcPlanRecommendations(state, npc, tryGetRecipe('r_aegis_plate'));
    expect(npc.planRecommendedLandmarkId).toBeNull();
    expect(npc.explorationObjective).toBeNull();
  });

  it('R-12 blocks zero-stamina benefit and all terminal access mutations', () => {
    const state = newGame('PHASE4R-RED-LINES');
    quiet(state);
    const actor = player(state);
    actor.currentZoneId = 'lab';
    addItem(actor, createStack(state, 'field_kit'));
    actor.stamina = 0;
    const before = JSON.stringify({ time: state.time, stamina: actor.stamina, runtime: state.landmarks.lab_analysis_terminal, inventory: actor.inventory });
    const noStamina = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'lab_analysis_terminal', interactionId: 'analyze' });
    expect(noStamina.ok).toBe(false);
    expect(JSON.stringify({ time: state.time, stamina: actor.stamina, runtime: state.landmarks.lab_analysis_terminal, inventory: actor.inventory })).toBe(before);

    const terminal = newGame('PHASE4R-TERMINAL');
    const terminalRuntime = structuredClone(terminal.landmarks.factory_assembly_line);
    terminal.status = 'won';
    const terminalResult = executeCommand(terminal, { type: 'INTERACT_LANDMARK', landmarkId: 'factory_machine_shop', interactionId: 'use_workbench' });
    expect(terminalResult.ok).toBe(false);
    expect(terminalResult.state.landmarks.factory_assembly_line).toEqual(terminalRuntime);
    expect(terminalResult.state.time).toBe(terminal.time);
  });
});
