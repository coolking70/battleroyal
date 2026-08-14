import { afterEach, describe, expect, it } from 'vitest';
import { APEX_WILD_ENEMY_IDS, getWildEnemy } from '../src/data/wildEnemies';
import { LANDMARKS, landmarksForZone } from '../src/data/landmarks';
import { getCharacterSkills } from '../src/core/skills';
import { createGame, refreshZoneOccupants } from '../src/core/gameState';
import { addItem, createStack, equipItem } from '../src/core/inventory';
import { moveActor, searchLandmarkActor } from '../src/core/actorActions';
import { nextZoneToward, resolveAccessStep, syncNpcExplorationObjective } from '../src/core/accessChains';
import { runNpcTurn } from '../src/core/npcAi';
import { decideNpcAction } from '../src/core/npcDecide';
import { recommendedLandmarkForRecipe } from '../src/core/npcLandmarkPlan';
import { tryGetRecipe } from '../src/data/recipes';
import { currentWorldSourcesForActor } from '../src/core/worldSources';
import {
  observeActorSighting,
  observeLocalLandmark,
  observeZoneVisit,
} from '../src/core/npcKnowledge';
import {
  maintainStrategicIntent,
  strategicZonePreference,
} from '../src/core/npcStrategicIntent';
import { pushEvent } from '../src/core/events';
import { processApexSpawns } from '../src/core/apexSchedule';
import { SeededRandom } from '../src/core/random';
import {
  createMemoryStorage,
  loadGame,
  saveGame,
  setStorage,
  validateSaveData,
} from '../src/core/saveLoad';
import { declareVictory } from '../src/core/victory';
import type { Combatant, GameState } from '../src/core/types';

function npcOf(state: GameState, index = 0): Combatant {
  return Object.values(state.characters).filter((actor) => !actor.isPlayer)[index]!;
}

function saveData(state: GameState) {
  return {
    version: state.version,
    savedAt: 1,
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state,
  };
}

function clearLocalNoise(state: GameState): void {
  state.wildEnemies = {};
  for (const zone of Object.values(state.zones)) {
    zone.wildEnemyIds = [];
    zone.groundItems = [];
  }
}

function isolateActor(state: GameState, actor: Combatant, zoneId: string): void {
  actor.currentZoneId = zoneId;
  const otherZones = ['school', 'hospital', 'lab', 'forest', 'residential'];
  let index = 0;
  for (const other of Object.values(state.characters)) {
    if (other.id === actor.id) continue;
    other.currentZoneId = otherZones[index % otherZones.length]!;
    index += 1;
  }
  refreshZoneOccupants(state);
}

function moveFormallyTo(state: GameState, actor: Combatant, targetZoneId: string): void {
  actor.maxStamina = Math.max(actor.maxStamina, 999);
  actor.stamina = actor.maxStamina;
  let guard = 0;
  while (actor.currentZoneId !== targetZoneId && guard < 24) {
    const next = nextZoneToward(actor.currentZoneId, targetZoneId);
    expect(next).not.toBeNull();
    expect(moveActor(state, actor, next!).ok).toBe(true);
    guard += 1;
  }
  expect(actor.currentZoneId).toBe(targetZoneId);
}

function readyForApex(state: GameState, actor: Combatant): void {
  for (const itemId of ['reinforced_pipe', 'reinforced_armor']) {
    const stack = createStack(state, itemId, 1);
    addItem(actor, stack);
    expect(equipItem(actor, stack.uid).ok).toBe(true);
  }
}

function publishApexKnowledge(state: GameState): string {
  const wildDefId = APEX_WILD_ENEMY_IDS[0]!;
  const zoneId = getWildEnemy(wildDefId).eligibleZones![0]!;
  pushEvent(state, {
    type: 'APEX_SPAWNED',
    zoneId,
    message: 'test public Apex lifecycle',
    metadata: { wildDefId, tier: 'apex', zoneId },
  });
  return wildDefId;
}

function sourceFailureFixture(seed: string): { state: GameState; actor: Combatant; observer: Combatant } {
  const state = createGame({ seed, playerCharacterId: 'scout' });
  clearLocalNoise(state);
  const actor = npcOf(state, 0);
  const observer = npcOf(state, 1);
  isolateActor(state, actor, 'factory');
  observer.currentZoneId = 'school';
  refreshZoneOccupants(state);
  actor.inventory = [];
  actor.equipment = [];
  actor.equippedWeaponId = null;
  actor.equippedArmorId = null;
  actor.equippedUtilityId = null;
  actor.stamina = actor.maxStamina = 99;
  actor.victoryGoal = 'last_survivor';
  actor.victoryGoalMode = 'explicit';
  actor.plannedRecipeId = 'r_reinforced_pipe';
  actor.planCreatedAt = state.time;
  actor.planReason = 'Phase 4S source failure fixture';
  actor.planRecommendedZoneId = 'factory';
  actor.planRecommendedLandmarkId = 'factory_machine_shop';
  actor.planProgress = 0;
  actor.planNoProgressTurns = 0;
  actor.explorationObjective = null;
  const source = state.landmarks.factory_machine_shop!;
  source.discovered = true;
  source.activated = true;
  source.remainingSearches = 1;
  source.exhausted = false;
  const alternate = state.landmarks.factory_assembly_line!;
  alternate.locked = false;
  return { state, actor, observer };
}

afterEach(() => setStorage(null));

describe('Phase 4S actor-scoped knowledge and strategic intent', () => {
  it('S-1 records Landmark runtime only after real local arrival and action', () => {
    const state = createGame({ seed: 'PHASE4S-S1', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const actor = npcOf(state);
    const target = LANDMARKS.find((landmark) => landmark.zoneId !== actor.currentZoneId && !landmark.access)!;

    expect(observeLocalLandmark(state, actor, target.id)).toEqual([]);
    expect(actor.knowledgeMemory.entries.some((entry) => entry.kind === 'landmark_state' && entry.landmarkId === target.id)).toBe(false);

    moveFormallyTo(state, actor, target.zoneId);
    const result = searchLandmarkActor(state, actor, target.id, new SeededRandom('PHASE4S-S1-SEARCH'));
    expect(result.ok).toBe(true);
    expect(actor.knowledgeMemory.entries.some((entry) => entry.kind === 'landmark_state' && entry.landmarkId === target.id)).toBe(true);
  });

  it('S-2 keeps remote hidden runtime variants equivalent across cognition and planning', () => {
    const normal = createGame({ seed: 'PHASE4S-S2', playerCharacterId: 'scout' });
    clearLocalNoise(normal);
    const normalNpc = npcOf(normal);
    isolateActor(normal, normalNpc, 'school');
    normalNpc.victoryGoal = 'last_survivor';
    normalNpc.victoryGoalMode = 'explicit';
    normalNpc.plannedRecipeId = 'r_reinforced_pipe';
    normalNpc.planCreatedAt = 0;
    normalNpc.planReason = 'remote equivalence';
    const hidden = structuredClone(normal);
    const hiddenNpc = hidden.characters[normalNpc.id]!;
    const runtime = hidden.landmarks.factory_assembly_line!;
    runtime.exhausted = true;
    runtime.remainingSearches = 0;
    runtime.loot = [];
    runtime.locked = false;
    runtime.disabled = true;
    runtime.repaired = true;
    runtime.charges = 0;
    runtime.lastUsedAt = 0;

    expect(observeLocalLandmark(normal, normalNpc, runtime.landmarkId)).toEqual([]);
    expect(observeLocalLandmark(hidden, hiddenNpc, runtime.landmarkId)).toEqual([]);
    expect(normalNpc.knowledgeMemory).toEqual(hiddenNpc.knowledgeMemory);
    expect(maintainStrategicIntent(normal, normalNpc)).toEqual(maintainStrategicIntent(hidden, hiddenNpc));
    expect(resolveAccessStep(normal, normalNpc, runtime.landmarkId)).toEqual(resolveAccessStep(hidden, hiddenNpc, runtime.landmarkId));
    const recipe = tryGetRecipe('r_reinforced_pipe')!;
    expect(recommendedLandmarkForRecipe(normal, normalNpc, recipe)).toBe(recommendedLandmarkForRecipe(hidden, hiddenNpc, recipe));
    expect(decideNpcAction(normal, normalNpc, new SeededRandom('PHASE4S-S2-DECIDE')))
      .toEqual(decideNpcAction(hidden, hiddenNpc, new SeededRandom('PHASE4S-S2-DECIDE')));
  });

  it('S-3 preserves stale last-known Landmark state after leaving', () => {
    const state = createGame({ seed: 'PHASE4S-S3', playerCharacterId: 'scout' });
    const actor = npcOf(state);
    isolateActor(state, actor, 'hospital');
    observeLocalLandmark(state, actor, 'hospital_pharmacy');
    const before = structuredClone(actor.knowledgeMemory.entries.find((entry) => entry.key === 'landmark:hospital_pharmacy'));
    moveFormallyTo(state, actor, 'school');
    state.time += 1;
    const runtime = state.landmarks.hospital_pharmacy!;
    runtime.loot = [];
    runtime.remainingSearches = 0;
    runtime.exhausted = true;
    expect(actor.knowledgeMemory.entries.find((entry) => entry.key === 'landmark:hospital_pharmacy')).toEqual(before);
  });

  it('S-4 refreshes stale memory only on a legal local revisit observation', () => {
    const state = createGame({ seed: 'PHASE4S-S4', playerCharacterId: 'scout' });
    const actor = npcOf(state);
    isolateActor(state, actor, 'hospital');
    observeLocalLandmark(state, actor, 'hospital_pharmacy');
    const before = actor.knowledgeMemory.entries.find((entry) => entry.key === 'landmark:hospital_pharmacy')!;
    moveFormallyTo(state, actor, 'school');
    state.time += 2;
    const runtime = state.landmarks.hospital_pharmacy!;
    runtime.loot = [];
    runtime.remainingSearches = 0;
    runtime.exhausted = true;
    moveFormallyTo(state, actor, 'hospital');
    expect(actor.knowledgeMemory.entries.find((entry) => entry.key === 'landmark:hospital_pharmacy')!.observedAt).toBe(before.observedAt);
    observeLocalLandmark(state, actor, 'hospital_pharmacy', 'DIRECT_LOCAL');
    const refreshed = actor.knowledgeMemory.entries.find((entry) => entry.key === 'landmark:hospital_pharmacy')!;
    expect(refreshed).toMatchObject({ state: 'exhausted', observedAt: state.time });
  });

  it('S-5 remembers an actor last seen in Hospital without remote tracking', () => {
    const state = createGame({ seed: 'PHASE4S-S5', playerCharacterId: 'scout' });
    const observer = npcOf(state, 0);
    const subject = npcOf(state, 1);
    observer.currentZoneId = subject.currentZoneId = 'hospital';
    refreshZoneOccupants(state);
    observeActorSighting(state, observer, subject);
    const sighting = structuredClone(observer.knowledgeMemory.entries.find((entry) => entry.key === `actor:${subject.id}`));
    moveFormallyTo(state, subject, 'factory');
    state.time += 1;
    expect(observer.knowledgeMemory.entries.find((entry) => entry.key === `actor:${subject.id}`)).toEqual(sighting);
    expect(sighting).toMatchObject({ zoneId: 'hospital', observedAt: 0 });
  });

  it('S-6 enforces bounded deterministic memory with stable eviction', () => {
    const build = (seed: string) => {
      const state = createGame({ seed, playerCharacterId: 'scout' });
      clearLocalNoise(state);
      const actor = npcOf(state);
      actor.maxStamina = actor.stamina = 999;
      for (const zoneId of Object.keys(state.zones).sort()) {
        moveFormallyTo(state, actor, zoneId);
        observeZoneVisit(state, actor);
        for (const landmark of landmarksForZone(zoneId)) observeLocalLandmark(state, actor, landmark.id, 'DIRECT_LOCAL');
      }
      return actor.knowledgeMemory;
    };
    const first = build('PHASE4S-S6');
    const second = build('PHASE4S-S6');
    expect(first.entries).toHaveLength(first.capacity);
    expect(first.evictions).toBeGreaterThan(0);
    expect(first).toEqual(second);
  });

  it('S-7 autonomously reroutes after confirming a source failure', () => {
    const { state, actor } = sourceFailureFixture('PHASE4S-S7');
    const first = runNpcTurn(state, actor, new SeededRandom('PHASE4S-S7-FIRST'));
    expect(first).toMatchObject({ kind: 'search_landmark', landmarkId: 'factory_machine_shop' });
    expect(actor.knowledgeMemory.entries).toContainEqual(expect.objectContaining({
      kind: 'source_status', landmarkId: 'factory_machine_shop', state: 'exhausted',
    }));

    const second = runNpcTurn(state, actor, new SeededRandom('PHASE4S-S7-SECOND'));
    expect(actor.planRecommendedLandmarkId).not.toBe('factory_machine_shop');
    expect(second.kind).toMatch(/^(search|search_landmark|move)$/);
    expect(second.kind === 'search_landmark' ? second.landmarkId : null).not.toBe('factory_machine_shop');
  });

  it('S-8 keeps source memory actor-private', () => {
    const { state, actor, observer } = sourceFailureFixture('PHASE4S-S8');
    runNpcTurn(state, actor, new SeededRandom('PHASE4S-S8-FIRST'));
    moveFormallyTo(state, actor, 'warehouse');
    expect(actor.knowledgeMemory.entries.some((entry) => entry.kind === 'source_status'
      && entry.landmarkId === 'factory_machine_shop' && entry.state === 'exhausted')).toBe(true);
    expect(observer.knowledgeMemory.entries.some((entry) => entry.kind === 'source_status'
      && entry.landmarkId === 'factory_machine_shop')).toBe(false);
    const actorSources = currentWorldSourcesForActor(state, actor, 'iron');
    const observerSources = currentWorldSourcesForActor(state, observer, 'iron');
    expect(actorSources.some((source) => source.kind === 'landmark_loot' && source.landmarkIds.includes('factory_machine_shop'))).toBe(false);
    expect(observerSources.some((source) => source.kind === 'landmark_loot' && source.landmarkIds.includes('factory_machine_shop'))).toBe(true);
  });

  it('S-9 preserves a stable strategic intent and committedAt across ordinary turns', () => {
    const state = createGame({ seed: 'PHASE4S-S9', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const actor = npcOf(state);
    isolateActor(state, actor, 'school');
    actor.victoryGoal = 'research';
    actor.victoryGoalMode = 'explicit';
    runNpcTurn(state, actor, new SeededRandom('PHASE4S-S9-0'));
    const committedAt = actor.strategicIntent!.committedAt;
    for (let turn = 1; turn <= 3; turn += 1) {
      state.time += 1;
      runNpcTurn(state, actor, new SeededRandom(`PHASE4S-S9-${turn}`));
      expect(actor.strategicIntent).toMatchObject({ type: 'pursue_research', committedAt });
    }
  });

  it('S-10 invalidates an ordinary intent on formal public Apex replacement without restoring it', () => {
    const state = createGame({ seed: 'PHASE4S-S10', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const actor = npcOf(state);
    isolateActor(state, actor, 'school');
    actor.victoryGoal = 'last_survivor';
    actor.victoryGoalMode = 'explicit';
    readyForApex(state, actor);
    runNpcTurn(state, actor, new SeededRandom('PHASE4S-S10-BEFORE'));
    const ordinaryCommittedAt = actor.strategicIntent!.committedAt;
    expect(actor.strategicIntent!.type).not.toBe('contest_apex');
    const apexId = publishApexKnowledge(state);
    state.time += 1;
    runNpcTurn(state, actor, new SeededRandom('PHASE4S-S10-APEX'));
    expect(actor.strategicIntent).toMatchObject({ type: 'contest_apex', targetId: apexId, committedAt: state.time });
    expect(actor.strategicIntent!.committedAt).not.toBe(ordinaryCommittedAt);
    state.time += 1;
    runNpcTurn(state, actor, new SeededRandom('PHASE4S-S10-PRESERVE'));
    expect(actor.strategicIntent).toMatchObject({ type: 'contest_apex', targetId: apexId, committedAt: state.time - 1 });
  });

  it('S-11 diverges on public Apex only from each actor own readiness', () => {
    const state = createGame({ seed: 'PHASE4S-S11', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const weak = npcOf(state, 0);
    const strong = npcOf(state, 1);
    weak.victoryGoal = strong.victoryGoal = 'last_survivor';
    weak.victoryGoalMode = strong.victoryGoalMode = 'explicit';
    readyForApex(state, strong);
    const apexId = publishApexKnowledge(state);
    runNpcTurn(state, weak, new SeededRandom('PHASE4S-S11-WEAK'));
    runNpcTurn(state, strong, new SeededRandom('PHASE4S-S11-STRONG'));
    expect(weak.strategicIntent).toMatchObject({ type: 'gear_up', reason: 'APEX_PUBLIC_NOT_READY', targetId: null });
    expect(strong.strategicIntent).toMatchObject({ type: 'contest_apex', reason: 'APEX_PUBLIC_AND_READY', targetId: apexId });
  });

  it('S-12 applies cautious threat memory without tracking the enemy remote move', () => {
    const state = createGame({ seed: 'PHASE4S-S12', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const cautious = npcOf(state, 0);
    const threat = npcOf(state, 1);
    cautious.personality = 'cautious';
    cautious.victoryGoal = 'last_survivor';
    cautious.victoryGoalMode = 'explicit';
    cautious.currentZoneId = threat.currentZoneId = 'hospital';
    cautious.attack = cautious.defense = 1;
    threat.attack = threat.defense = 50;
    cautious.inventory = [];
    cautious.skillCooldowns = Object.fromEntries(getCharacterSkills(cautious.characterId).map((id) => [id, 99]));
    for (const other of Object.values(state.characters)) if (other.id !== cautious.id && other.id !== threat.id) other.currentZoneId = 'lab';
    refreshZoneOccupants(state);

    const decision = runNpcTurn(state, cautious, new SeededRandom('PHASE4S-S12-FLEE'));
    expect(decision.kind).toBe('flee_combat');
    const remembered = structuredClone(cautious.knowledgeMemory.entries.find((entry) => entry.key === `actor:${threat.id}`));
    moveFormallyTo(state, threat, 'factory');
    state.time += 1;
    runNpcTurn(state, cautious, new SeededRandom('PHASE4S-S12-AVOID'));
    expect(cautious.strategicIntent).toMatchObject({ type: 'avoid_threat', reason: 'RECENT_HIGH_THREAT', targetId: 'hospital' });
    expect(strategicZonePreference(cautious, 'hospital')).toBe(0.05);
    expect(cautious.knowledgeMemory.entries.find((entry) => entry.key === `actor:${threat.id}`)).toEqual(remembered);
    expect(remembered).toMatchObject({ zoneId: 'hospital', threat: 'high' });
  });

  it('S-13 round-trips memory, public Apex, intent and Phase 4R objective', () => {
    const state = createGame({ seed: 'PHASE4S-S13', playerCharacterId: 'scout' });
    clearLocalNoise(state);
    const actor = npcOf(state, 0);
    const subject = npcOf(state, 1);
    isolateActor(state, actor, 'factory');
    subject.currentZoneId = 'factory';
    refreshZoneOccupants(state);
    actor.victoryGoal = 'last_survivor';
    actor.victoryGoalMode = 'explicit';
    actor.plannedRecipeId = 'r_reinforced_pipe';
    actor.planCreatedAt = state.time;
    actor.planReason = 'roundtrip route';
    actor.planRecommendedZoneId = 'factory';
    actor.planRecommendedLandmarkId = 'factory_assembly_line';
    actor.explorationObjective = syncNpcExplorationObjective(state, actor, 'factory_assembly_line');
    actor.planRecommendedLandmarkId = actor.explorationObjective!.nextLandmarkId;
    observeActorSighting(state, actor, subject);

    const entry = state.apexSchedule.sort((a, b) => a.scheduledAt - b.scheduledAt)[0]!;
    state.time = entry.scheduledAt;
    processApexSpawns(state);
    const machine = state.landmarks.factory_machine_shop!;
    state.zones.factory!.groundItems.push(...machine.loot.splice(0));
    machine.remainingSearches = 0;
    machine.exhausted = true;
    machine.discovered = true;
    machine.lastUsedAt = state.time;
    observeLocalLandmark(state, actor, 'factory_machine_shop');
    maintainStrategicIntent(state, actor);

    expect(validateSaveData(saveData(state)).ok).toBe(true);
    const storage = createMemoryStorage();
    setStorage(storage);
    expect(saveGame(state).ok).toBe(true);
    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const restored = loaded.data.state.characters[actor.id]!;
    expect(restored.knowledgeMemory).toEqual(actor.knowledgeMemory);
    expect(restored.strategicIntent).toEqual(actor.strategicIntent);
    expect(restored.explorationObjective).toEqual(actor.explorationObjective);
  });

  it('S-14 rejects malformed semantic cognition saves, not only unknown IDs', () => {
    const state = createGame({ seed: 'PHASE4S-S14', playerCharacterId: 'scout' });
    const actor = npcOf(state, 0);
    const subject = npcOf(state, 1);
    actor.currentZoneId = subject.currentZoneId;
    refreshZoneOccupants(state);
    const localLandmark = landmarksForZone(actor.currentZoneId)[0]!;
    observeLocalLandmark(state, actor, localLandmark.id);
    observeActorSighting(state, actor, subject);
    actor.victoryGoal = 'research';
    actor.victoryGoalMode = 'explicit';
    maintainStrategicIntent(state, actor);
    expect(validateSaveData(saveData(state)).ok).toBe(true);

    const corruptions: Array<(copy: ReturnType<typeof saveData>) => void> = [
      (copy) => {
        const source = copy.state.characters[actor.id]!.knowledgeMemory.entries.find((item) => item.kind === 'source_status')! as any;
        source.itemId = 'energy_drink'; source.key = `source:energy_drink:${source.landmarkId}`;
      },
      (copy) => {
        const sighting = copy.state.characters[actor.id]!.knowledgeMemory.entries.find((item) => item.kind === 'actor_sighting')! as any;
        sighting.subjectActorId = 'ghost'; sighting.key = 'actor:ghost';
      },
      (copy) => { copy.state.characters[actor.id]!.knowledgeMemory.entries[0]!.observedAt = copy.state.time + 1; },
      (copy) => { copy.state.characters[actor.id]!.strategicIntent!.committedAt = copy.state.time + 1; },
      (copy) => {
        copy.state.characters[actor.id]!.strategicIntent = {
          type: 'seek_material', reason: 'MISSING_RAW_MATERIAL', targetId: 'hospital',
          committedAt: 0, reevaluateAt: 6,
        };
      },
      (copy) => {
        copy.state.characters[actor.id]!.strategicIntent = {
          type: 'contest_apex', reason: 'APEX_PUBLIC_AND_READY', targetId: 'stray_dog',
          committedAt: 0, reevaluateAt: 6,
        };
      },
      (copy) => {
        copy.state.characters[actor.id]!.strategicIntent = {
          type: 'contest_apex', reason: 'APEX_PUBLIC_AND_READY', targetId: copy.state.apexSchedule[0]!.defId,
          committedAt: 0, reevaluateAt: 6,
        };
      },
      (copy) => {
        const memory = copy.state.characters[actor.id]!.knowledgeMemory;
        while (memory.entries.length <= memory.capacity) memory.entries.push(structuredClone(memory.entries[0]!));
      },
      (copy) => {
        const entry = copy.state.characters[actor.id]!.knowledgeMemory.entries[0] as any;
        entry.remainingSearches = 2;
      },
      (copy) => {
        const memory = copy.state.characters[actor.id]!.knowledgeMemory;
        memory.entries.push({
          key: 'action:MOVE:none:-', kind: 'recent_action', observedAt: 0,
          provenance: 'SELF_ACTION', action: 'MOVE', outcome: 'success', targetKind: 'none', targetId: null,
        } as any);
      },
    ];

    for (const corrupt of corruptions) {
      const copy = structuredClone(saveData(state));
      corrupt(copy);
      expect(validateSaveData(copy).ok).toBe(false);
    }
  });

  it('S-15 freezes cognition after terminal and gives zero-stamina maintenance no benefit', () => {
    const state = createGame({ seed: 'PHASE4S-S15', playerCharacterId: 'scout' });
    const actor = npcOf(state);
    actor.victoryGoal = 'last_survivor';
    actor.victoryGoalMode = 'explicit';
    actor.stamina = 0;
    const benefitBefore = { hp: actor.hp, stamina: actor.stamina, inventory: structuredClone(actor.inventory), time: state.time };
    maintainStrategicIntent(state, actor);
    expect({ hp: actor.hp, stamina: actor.stamina, inventory: actor.inventory, time: state.time }).toEqual(benefitBefore);

    declareVictory(state, state.playerId, 'last_survivor');
    const frozen = structuredClone({ memory: actor.knowledgeMemory, intent: actor.strategicIntent, objective: actor.explorationObjective });
    observeZoneVisit(state, actor);
    maintainStrategicIntent(state, actor);
    expect(runNpcTurn(state, actor, new SeededRandom('PHASE4S-S15-TERMINAL')).kind).toBe('idle');
    expect({ memory: actor.knowledgeMemory, intent: actor.strategicIntent, objective: actor.explorationObjective }).toEqual(frozen);
  });
});
