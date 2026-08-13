import { describe, expect, it } from 'vitest';
import { executeCommand } from '../src/core/gameEngine';
import { auditItemIntegrity } from '../src/core/itemIntegrity';
import { searchLandmark } from '../src/core/landmarkSearch';
import { currentWorldSourcesForActor, currentWorldSourcesForItem } from '../src/core/worldSources';
import { refreshNpcPlanRecommendation } from '../src/core/npcGoalPlan';
import { runNpcTurn } from '../src/core/npcAi';
import { SeededRandom } from '../src/core/random';
import { addItem, countItem, createStack } from '../src/core/inventory';
import { canSearchLandmark } from '../src/core/landmarks';
import { getCharacterSkills } from '../src/core/skills';
import { createMemoryStorage, loadGame, saveGame, setStorage } from '../src/core/saveLoad';
import { isEventVisibleToPlayer } from '../src/ui/components/EventLog';
import { newGame, npcs, player } from './helpers';

function noWilds(state: ReturnType<typeof newGame>): void {
  for (const zone of Object.values(state.zones)) zone.wildEnemyIds = [];
  for (const wild of Object.values(state.wildEnemies)) {
    wild.status = 'defeated';
    wild.hp = 0;
  }
}

function fatalRiskSeed(): string {
  for (let index = 0; index < 10_000; index += 1) {
    const seed = `PHASE4Q-AF-FATAL-${index}`;
    const state = newGame(seed);
    const rng = SeededRandom.fromState(state.rngState);
    rng.pickWeighted([{ value: 0, weight: 1 }]);
    if (rng.chance(0.35)) return seed;
  }
  throw new Error('没有找到致命风险的确定性种子');
}

describe('Phase 4Q-AF 设施、信息边界、风险与 NPC 验收修复', () => {
  it('AF-1 locked secure storage accepts only its unlock interaction', () => {
    const state = newGame('PHASE4Q-AF-UNLOCK');
    const actor = player(state);
    actor.currentZoneId = 'warehouse';
    addItem(actor, createStack(state, 'field_kit'));
    const runtime = state.landmarks.warehouse_secure_storage!;
    expect(runtime.locked).toBe(true);
    expect(canSearchLandmark(state, actor.id, runtime.landmarkId).ok).toBe(false);
    const rejected = executeCommand(state, { type: 'SEARCH_LANDMARK', landmarkId: runtime.landmarkId });
    expect(rejected.ok).toBe(false);
    const unlocked = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: runtime.landmarkId, interactionId: 'open_secure_storage' });
    expect(unlocked.ok).toBe(true);
    expect(unlocked.state.landmarks.warehouse_secure_storage!.locked).toBe(false);
    expect(unlocked.state.landmarks.warehouse_secure_storage!.activated).toBe(true);
    const searched = executeCommand(unlocked.state, { type: 'SEARCH_LANDMARK', landmarkId: runtime.landmarkId });
    expect(searched.ok).toBe(true);
  });

  it('AF-2 unlock consumes exactly one field kit, one charge, stamina, time, and events', () => {
    const state = newGame('PHASE4Q-AF-UNLOCK-COST');
    const actor = player(state);
    actor.currentZoneId = 'warehouse';
    addItem(actor, createStack(state, 'field_kit'));
    const beforeTime = state.time;
    const beforeStamina = actor.stamina;
    const beforeKitCount = countItem(actor, 'field_kit');
    const result = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'warehouse_secure_storage', interactionId: 'open_secure_storage' });
    expect(result.ok).toBe(true);
    const nextActor = player(result.state);
    const runtime = result.state.landmarks.warehouse_secure_storage!;
    expect(countItem(nextActor, 'field_kit')).toBe(Math.max(0, beforeKitCount - 1));
    expect(runtime.charges).toBe(0);
    expect(nextActor.stamina).toBeLessThan(beforeStamina);
    expect(result.state.time).toBe(beforeTime + 1);
    expect(result.state.events.some((event) => event.type === 'FACILITY_USED' && event.metadata.interactionId === 'open_secure_storage')).toBe(true);
    expect(result.state.events.some((event) => event.type === 'FACILITY_ACTIVATED' && event.metadata.landmarkId === 'warehouse_secure_storage')).toBe(true);
    expect(auditItemIntegrity(result.state).ok).toBe(true);
  });

  it('AF-3 missing field kit rejects without mutation', () => {
    const state = newGame('PHASE4Q-AF-UNLOCK-REJECT');
    const actor = player(state);
    actor.currentZoneId = 'warehouse';
    actor.inventory = actor.inventory.filter((stack) => stack.itemId !== 'field_kit');
    const snapshot = JSON.stringify({ time: state.time, stamina: actor.stamina, runtime: state.landmarks.warehouse_secure_storage, events: state.events, inventory: actor.inventory });
    const result = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'warehouse_secure_storage', interactionId: 'open_secure_storage' });
    expect(result.ok).toBe(false);
    expect(JSON.stringify({ time: state.time, stamina: actor.stamina, runtime: state.landmarks.warehouse_secure_storage, events: state.events, inventory: actor.inventory })).toBe(snapshot);
    const engineerState = newGame('PHASE4Q-AF-UNLOCK-ENGINEER-REJECT', 'engineer');
    const engineer = player(engineerState);
    engineer.currentZoneId = 'warehouse';
    expect(executeCommand(engineerState, { type: 'INTERACT_LANDMARK', landmarkId: 'warehouse_secure_storage', interactionId: 'open_secure_storage' }).ok).toBe(false);
  });

  it('AF-4 save/load preserves secure-storage unlock state', () => {
    const storage = createMemoryStorage();
    setStorage(storage);
    try {
      const state = newGame('PHASE4Q-AF-UNLOCK-SAVE');
      const actor = player(state);
      actor.currentZoneId = 'warehouse';
      addItem(actor, createStack(state, 'field_kit'));
      const unlocked = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'warehouse_secure_storage', interactionId: 'open_secure_storage' }).state;
      expect(saveGame(unlocked).ok).toBe(true);
      const loaded = loadGame();
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.data.state.landmarks.warehouse_secure_storage!.locked).toBe(false);
        expect(loaded.data.state.landmarks.warehouse_secure_storage!.activated).toBe(true);
      }
    } finally {
      setStorage(null);
    }
  });

  it('AF-5 remote depletion, lock, disabled, loot, and last-use state do not alter public sources', () => {
    const state = newGame('PHASE4Q-AF-REMOTE-HIDDEN');
    const before = JSON.stringify(currentWorldSourcesForItem(state, 'battery'));
    const runtime = state.landmarks.commercial_electronics_shop!;
    runtime.loot = [];
    runtime.remainingSearches = 0;
    runtime.exhausted = true;
    runtime.locked = true;
    runtime.disabled = true;
    runtime.lastUsedAt = 77;
    expect(JSON.stringify(currentWorldSourcesForItem(state, 'battery'))).toBe(before);
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'hospital';
    expect(currentWorldSourcesForActor(state, npc, 'battery').find((source) => source.kind === 'landmark_loot')?.landmarkIds).toContain('commercial_electronics_shop');
  });

  it('AF-6 the same hidden state changes only after the actor arrives locally', () => {
    const state = newGame('PHASE4Q-AF-LOCAL-HIDDEN');
    const npc = npcs(state)[0]!;
    const runtime = state.landmarks.commercial_electronics_shop!;
    runtime.loot = [];
    runtime.remainingSearches = 0;
    runtime.exhausted = true;
    npc.currentZoneId = 'hospital';
    expect(currentWorldSourcesForActor(state, npc, 'battery').find((source) => source.kind === 'landmark_loot')?.landmarkIds).toContain('commercial_electronics_shop');
    npc.currentZoneId = 'commercial';
    expect(currentWorldSourcesForActor(state, npc, 'battery').find((source) => source.kind === 'landmark_loot')?.landmarkIds).not.toContain('commercial_electronics_shop');
  });

  it('AF-7 lethal landmark risk leaves the candidate hidden and grants no reward', () => {
    const state = newGame(fatalRiskSeed());
    const actor = player(state);
    actor.currentZoneId = 'park';
    actor.hp = 1;
    noWilds(state);
    const runtime = state.landmarks.park_greenhouse!;
    runtime.loot = [createStack(state, 'herb')];
    runtime.remainingSearches = 1;
    runtime.maxSearches = 1;
    runtime.exhausted = false;
    const uid = runtime.loot[0]!.uid;
    const result = searchLandmark(state, actor, 'park_greenhouse', SeededRandom.fromState(state.rngState));
    expect(result.ok).toBe(true);
    expect(actor.alive).toBe(false);
    expect(state.landmarks.park_greenhouse!.loot.map((stack) => stack.uid)).toEqual([uid]);
    expect(state.events.some((event) => event.type === 'LANDMARK_SEARCHED' && event.metadata.outcome === 'fatal_risk')).toBe(true);
    expect(state.events.some((event) => event.type === 'ITEM_FOUND' && event.metadata.landmarkId === 'park_greenhouse')).toBe(false);
    expect(state.events.some((event) => event.type === 'ITEM_PICKED' && event.metadata.landmarkId === 'park_greenhouse')).toBe(false);
    expect(state.pendingPickup).toBeNull();
    expect(auditItemIntegrity(state).ok).toBe(true);
  });

  it('AF-8 fatal risk preserves finite-item conservation and does not double-resolve death', () => {
    const state = newGame(fatalRiskSeed());
    const actor = player(state);
    actor.currentZoneId = 'park';
    actor.hp = 1;
    noWilds(state);
    const runtime = state.landmarks.park_greenhouse!;
    runtime.loot = [createStack(state, 'herb')];
    runtime.remainingSearches = 1;
    runtime.maxSearches = 1;
    runtime.exhausted = false;
    searchLandmark(state, actor, 'park_greenhouse', SeededRandom.fromState(state.rngState));
    expect(state.events.filter((event) => event.type === 'CHARACTER_DIED' && event.targetId === actor.id)).toHaveLength(1);
    expect(state.stats.landmarkItemsRecovered).toBe(0);
    expect(state.landmarks.park_greenhouse!.loot).toHaveLength(1);
    expect(auditItemIntegrity(state).problems).toEqual([]);
  });

  it('AF-9 LANDMARK_EXHAUSTED is actor-scoped and never a remote public broadcast', () => {
    const state = newGame('PHASE4Q-AF-EVENT-BOUNDARY');
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'school';
    noWilds(state);
    const runtime = state.landmarks.school_gym!;
    runtime.loot = [createStack(state, 'cloth')];
    runtime.remainingSearches = 1;
    runtime.maxSearches = 1;
    runtime.exhausted = false;
    searchLandmark(state, npc, runtime.landmarkId, new SeededRandom('PHASE4Q-AF-EVENT-BOUNDARY-RNG'));
    const event = state.events.find((candidate) => candidate.type === 'LANDMARK_EXHAUSTED');
    expect(event?.actorId).toBe(npc.id);
    expect(isEventVisibleToPlayer(event!, state.playerId)).toBe(false);
    expect(isEventVisibleToPlayer(event!, npc.id)).toBe(true);
  });

  it('AF-10 NPC recommendation ignores the player craft goal', () => {
    const a = newGame('PHASE4Q-AF-NPC-GOAL-SCOPE');
    const b = newGame('PHASE4Q-AF-NPC-GOAL-SCOPE');
    const npcA = npcs(a)[0]!;
    const npcB = npcs(b)[0]!;
    npcA.currentZoneId = npcB.currentZoneId = 'school';
    npcA.plannedRecipeId = npcB.plannedRecipeId = 'r_circuit';
    b.craftGoalRecipeId = 'r_research_package';
    refreshNpcPlanRecommendation(a, npcA);
    refreshNpcPlanRecommendation(b, npcB);
    expect(npcA.planRecommendedLandmarkId).toBe(npcB.planRecommendedLandmarkId);
    expect(npcA.planRecommendedZoneId).toBe(npcB.planRecommendedZoneId);
  });

  it('AF-11 NPC production refreshes a stale local recommendation without remote probing', () => {
    const state = newGame('PHASE4Q-AF-NPC-STALE-REFRESH');
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'hospital';
    npc.plannedRecipeId = 'r_circuit';
    npc.planCreatedAt = state.time;
    refreshNpcPlanRecommendation(state, npc);
    const remoteRecommendation = npc.planRecommendedLandmarkId;
    expect(remoteRecommendation).not.toBeNull();
    const remote = state.landmarks[remoteRecommendation!];
    remote.loot = [];
    remote.remainingSearches = 0;
    remote.exhausted = true;
    runNpcTurn(state, npc, new SeededRandom('PHASE4Q-AF-NPC-STALE-REMOTE'));
    expect(npc.planRecommendedLandmarkId).toBe(remoteRecommendation);
    npc.currentZoneId = remote.zoneId;
    runNpcTurn(state, npc, new SeededRandom('PHASE4Q-AF-NPC-STALE-LOCAL'));
    expect(npc.planRecommendedLandmarkId).not.toBe(remoteRecommendation);
  });

  it('AF-12 runNpcTurn autonomously performs MOVE → SEARCH → acquire → craft on a real landmark route', () => {
    const state = newGame('PHASE4Q-AF-NPC-AUTONOMOUS');
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'hospital';
    npc.plannedRecipeId = 'r_circuit';
    npc.planCreatedAt = state.time;
    npc.planReason = 'Phase 4Q-AF deterministic landmark route';
    npc.planProgress = 0;
    npc.planNoProgressTurns = 0;
    npc.stamina = npc.maxStamina = 100;
    npc.skillCooldowns = Object.fromEntries(getCharacterSkills(npc.characterId).map((skillId) => [skillId, 99]));
    npc.inventory = npc.inventory.filter((stack) => stack.itemId !== 'battery');
    addItem(npc, createStack(state, 'wire'));
    for (const character of Object.values(state.characters)) {
      if (character.id !== npc.id) character.currentZoneId = 'warehouse';
    }
    noWilds(state);
    state.zones.hospital!.loot = [];
    state.zones.hospital!.objectiveLoot = [];
    state.zones.hospital!.initialLootCount = 0;
    state.zones.hospital!.remainingLootCount = 0;
    state.zones.hospital!.supply = 0;
    const target = state.landmarks.commercial_electronics_shop!;
    target.loot = target.loot.filter((stack) => stack.itemId === 'battery');
    target.remainingSearches = target.loot.length;
    target.maxSearches = target.loot.length;
    target.exhausted = false;
    const startZone = npc.currentZoneId;
    for (let turn = 0; turn < 100 && !state.events.some((event) => event.type === 'ITEM_CRAFTED' && event.actorId === npc.id && event.metadata.recipeId === 'r_circuit'); turn += 1) {
      runNpcTurn(state, npc, new SeededRandom(`PHASE4Q-AF-NPC-AUTONOMOUS-${turn}`));
    }
    const events = state.events;
    const moveIndex = events.findIndex((event) => event.type === 'CHARACTER_MOVED' && event.actorId === npc.id);
    const searchIndex = events.findIndex((event) => event.type === 'LANDMARK_SEARCHED' && event.actorId === npc.id && event.metadata.outcome === 'item');
    const craftIndex = events.findIndex((event) => event.type === 'ITEM_CRAFTED' && event.actorId === npc.id && event.metadata.recipeId === 'r_circuit');
    expect(startZone).toBe('hospital');
    expect(npc.currentZoneId).toBe('commercial');
    expect(moveIndex).toBeGreaterThanOrEqual(0);
    expect(searchIndex).toBeGreaterThan(moveIndex);
    expect(craftIndex).toBeGreaterThan(searchIndex);
    expect(countItem(npc, 'circuit')).toBeGreaterThan(0);
  });

  it('AF-13 remote hidden exhaustion falls back to a local alternate landmark after arrival', () => {
    const state = newGame('PHASE4Q-AF-NPC-FALLBACK');
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'lab';
    npc.plannedRecipeId = 'r_bandage';
    npc.planCreatedAt = state.time;
    npc.planReason = 'Phase 4Q-AF hidden exhaustion fallback';
    npc.planProgress = 0;
    npc.planNoProgressTurns = 0;
    npc.stamina = npc.maxStamina = 100;
    npc.skillCooldowns = Object.fromEntries(getCharacterSkills(npc.characterId).map((skillId) => [skillId, 99]));
    npc.inventory = npc.inventory.filter((stack) => stack.itemId !== 'herb' && stack.itemId !== 'bandage');
    addItem(npc, createStack(state, 'cloth'));
    for (const character of Object.values(state.characters)) {
      if (character.id !== npc.id) character.currentZoneId = 'warehouse';
    }
    noWilds(state);
    state.zones.lab!.loot = [];
    state.zones.lab!.objectiveLoot = [];
    state.zones.lab!.initialLootCount = 0;
    state.zones.lab!.remainingLootCount = 0;
    state.zones.lab!.supply = 0;
    const primary = state.landmarks.forest_deep_grove!;
    primary.loot = [];
    primary.remainingSearches = 0;
    primary.exhausted = true;
    // Seed the public/static route choice only. The post-arrival replacement
    // must still be selected by runNpcTurn from local runtime state.
    npc.planRecommendedZoneId = 'forest';
    npc.planRecommendedLandmarkId = 'forest_deep_grove';
    npc.planNoProgressTurns = -100;
    expect(npc.planRecommendedLandmarkId).toBe('forest_deep_grove');

    for (let turn = 0; turn < 120 && !state.events.some((event) => event.type === 'ITEM_CRAFTED' && event.actorId === npc.id && event.metadata.recipeId === 'r_bandage'); turn += 1) {
      runNpcTurn(state, npc, new SeededRandom(`PHASE4Q-AF-NPC-FALLBACK-${turn}`));
    }

    const events = state.events;
    expect(events.some((event) => event.type === 'CHARACTER_MOVED' && event.actorId === npc.id && event.zoneId === 'forest')).toBe(true);
    expect(events.some((event) => event.type === 'LANDMARK_SEARCHED' && event.actorId === npc.id && event.metadata.landmarkId === 'forest_deep_grove')).toBe(false);
    expect(events.some((event) => event.type === 'LANDMARK_SEARCHED' && event.actorId === npc.id && event.metadata.landmarkId === 'forest_ranger_cabin')).toBe(true);
    expect(events.some((event) => event.type === 'ITEM_CRAFTED' && event.actorId === npc.id && event.metadata.recipeId === 'r_bandage')).toBe(true);
    expect(countItem(npc, 'bandage')).toBeGreaterThan(0);
  });
});
