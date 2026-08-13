import { describe, expect, it } from 'vitest';
import { getZoneDef, ZONE_IDS } from '../src/data/zones';
import { refreshZoneOccupants } from '../src/core/gameState';
import { processApexSpawns } from '../src/core/apexSchedule';
import { attackWildActor, startWildEncounter } from '../src/core/wildCombat';
import {
  computeSearchWeights,
  getActorCraftGoalRecipeId,
  rollItemId,
  wildSearchTargetWeight,
} from '../src/core/search';
import { currentSourceZonesForItem, currentWorldSourcesForItem } from '../src/core/worldSources';
import { buildCraftPlan } from '../src/core/craftPlan';
import { hasPlannedWildSourceHere, npcSearchWeight } from '../src/core/npcDecide';
import { runNpcTurn } from '../src/core/npcAi';
import { addItem, countItem, createStack, getEquippedArmor } from '../src/core/inventory';
import { SeededRandom } from '../src/core/random';
import type { Combatant, GameEvent, GameState, WildEnemyInstance } from '../src/core/types';
import { newGame, npcs, player } from './helpers';

function spawnApex(state: GameState, defId: string): WildEnemyInstance {
  const entry = state.apexSchedule.find((candidate) => candidate.defId === defId)!;
  entry.scheduledAt = 0;
  state.time = 0;
  processApexSpawns(state);
  if (!entry.uid) throw new Error(`Apex ${defId} did not spawn`);
  return state.wildEnemies[entry.uid]!;
}

function exhaust(state: GameState, zoneId: string): void {
  const zone = state.zones[zoneId]!;
  zone.loot = [];
  zone.objectiveLoot = [];
  zone.initialLootCount = 0;
  zone.remainingLootCount = 0;
  zone.supply = 0;
}

function researchRollSeed(): string {
  for (let index = 0; index < 10_000; index += 1) {
    const rng = new SeededRandom(`PHASE4P-AF2-RESEARCH-${index}`);
    if (rng.chance(0.45)) return `PHASE4P-AF2-RESEARCH-${index}`;
  }
  throw new Error('no deterministic research roll seed');
}

function researchFixture(): { state: GameState; npc: Combatant } {
  const state = newGame('PHASE4P-AF2-RESEARCH');
  const npc = npcs(state)[0]!;
  npc.currentZoneId = 'hospital';
  npc.plannedRecipeId = 'r_reinforced_pipe';
  state.zones.hospital!.objectiveLoot = [{ itemId: 'research_notes', count: 1, rarity: 'rare' }];
  state.zones.hospital!.loot = [{ itemId: 'iron', count: 1, rarity: 'normal' }];
  state.zones.hospital!.initialLootCount = 1;
  state.zones.hospital!.remainingLootCount = 1;
  state.zones.hospital!.supply = 1;
  return { state, npc };
}

describe('Phase 4P-AF2 actor-scoped SEARCH and live Apex sources', () => {
  it('keeps research objective bias on the searching actor only', () => {
    const seed = researchRollSeed();
    const withoutPlayerGoal = researchFixture();
    const withPlayerGoal = researchFixture();
    withPlayerGoal.state.craftGoalRecipeId = 'r_research_package';

    const first = rollItemId(withoutPlayerGoal.state, withoutPlayerGoal.npc, new SeededRandom(seed));
    const second = rollItemId(withPlayerGoal.state, withPlayerGoal.npc, new SeededRandom(seed));
    expect(first?.itemId).toBe('iron');
    expect(second?.itemId).toBe('iron');

    const npcResearch = researchFixture();
    npcResearch.npc.plannedRecipeId = 'r_research_package';
    npcResearch.state.craftGoalRecipeId = 'r_reinforced_pipe';
    expect(rollItemId(npcResearch.state, npcResearch.npc, new SeededRandom(seed))?.itemId).toBe('research_notes');
  });

  it('keeps high-tier Wild weighting isolated in both directions', () => {
    const npcState = newGame('PHASE4P-AF2-SCOPE-NPC');
    const npc = npcs(npcState)[0]!;
    const enemy = spawnApex(npcState, 'prototype_aegis');
    npc.plannedRecipeId = 'r_reinforced_pipe';
    npcState.craftGoalRecipeId = null;
    const npcWithoutPlayerGoal = wildSearchTargetWeight(npcState, npc, enemy);
    npcState.craftGoalRecipeId = 'r_aegis_plate';
    const npcWithPlayerGoal = wildSearchTargetWeight(npcState, npc, enemy);
    expect(npcWithoutPlayerGoal).toBe(npcWithPlayerGoal);

    const playerState = newGame('PHASE4P-AF2-SCOPE-PLAYER');
    const actor = player(playerState);
    const playerEnemy = spawnApex(playerState, 'prototype_aegis');
    playerState.craftGoalRecipeId = 'r_aegis_plate';
    const beforeNpcPlan = wildSearchTargetWeight(playerState, actor, playerEnemy);
    npcs(playerState)[0]!.plannedRecipeId = 'r_aegis_plate';
    const afterNpcPlan = wildSearchTargetWeight(playerState, actor, playerEnemy);
    expect(afterNpcPlan).toBe(beforeNpcPlan);
    expect(getActorCraftGoalRecipeId(playerState, actor)).toBe('r_aegis_plate');
    expect(computeSearchWeights(playerState, actor).enemy).toBeGreaterThan(0);
  });

  it('collapses a unique Apex source from potential zones to its public zone and then none', () => {
    const state = newGame('PHASE4P-AF2-SOURCES');
    const before = currentSourceZonesForItem(state, 'aegis_core');
    expect(before).toEqual(['factory', 'station', 'warehouse']);

    spawnApex(state, 'prototype_aegis');
    const entry = state.apexSchedule.find((candidate) => candidate.defId === 'prototype_aegis')!;
    expect(currentSourceZonesForItem(state, 'aegis_core')).toEqual([entry.zoneId]);
    expect(buildCraftPlan(state, npcs(state)[0]!, 'r_aegis_plate')?.rawGaps
      .find((gap) => gap.itemId === 'aegis_core')?.sourceZoneIds)
      .toEqual(['factory', 'station', 'warehouse']);

    state.zones[entry.zoneId!]!.status = 'restricted';
    expect(currentSourceZonesForItem(state, 'aegis_core')).toEqual([]);
    expect(currentWorldSourcesForItem(state, 'aegis_core').some((source) => source.zoneIds.includes('factory'))).toBe(false);

    const sourceBeforeDefeat = currentWorldSourcesForItem(state, 'reinforced_servo')
      .find((source) => source.kind === 'wild_drop');
    expect(sourceBeforeDefeat?.enemyIds).toContain('armored_repair_bot');
    expect(sourceBeforeDefeat?.enemyIds).not.toContain('prototype_aegis');

    const fresh = newGame('PHASE4P-AF2-DEFEAT-SOURCE');
    const defeated = spawnApex(fresh, 'prototype_aegis');
    const hunter = player(fresh);
    hunter.currentZoneId = defeated.zoneId;
    hunter.attack = 1000;
    hunter.stamina = hunter.maxStamina = 1000;
    refreshZoneOccupants(fresh);
    startWildEncounter(fresh, hunter, defeated);
    expect(attackWildActor(fresh, hunter, defeated.uid, new SeededRandom('PHASE4P-AF2-DEFEAT'))
      .enemyDefeated).toBe(true);
    expect(currentSourceZonesForItem(fresh, 'aegis_core')).toEqual([]);
  });

  it('only re-enables SEARCH in an exhausted zone for the NPC own current Wild source', () => {
    const state = newGame('PHASE4P-AF2-EMPTY-SEARCH');
    const enemy = spawnApex(state, 'prototype_aegis');
    const npc = npcs(state)[0]!;
    npc.plannedRecipeId = 'r_aegis_plate';
    npc.planRecommendedZoneId = enemy.zoneId;
    npc.currentZoneId = enemy.zoneId;
    exhaust(state, enemy.zoneId);
    const plan = buildCraftPlan(state, npc, 'r_aegis_plate');
    expect(hasPlannedWildSourceHere(state, npc, plan)).toBe(true);
    expect(npcSearchWeight(state, npc, plan)).toBeGreaterThan(0);

    const ordinary = structuredClone(state);
    const ordinaryNpc = ordinary.characters[npc.id]!;
    ordinaryNpc.plannedRecipeId = null;
    ordinaryNpc.planRecommendedZoneId = null;
    expect(npcSearchWeight(ordinary, ordinaryNpc, null)).toBe(0);

    const elsewhere = structuredClone(state);
    const elsewhereNpc = elsewhere.characters[npc.id]!;
    elsewhereNpc.currentZoneId = getZoneDef(enemy.zoneId).adjacent[0]!;
    exhaust(elsewhere, elsewhereNpc.currentZoneId);
    addItem(elsewhereNpc, createStack(elsewhere, 'composite_chassis', 1));
    addItem(elsewhereNpc, createStack(elsewhere, 'plate_armor', 1));
    const elsewherePlan = buildCraftPlan(elsewhere, elsewhereNpc, 'r_aegis_plate');
    expect(hasPlannedWildSourceHere(elsewhere, elsewhereNpc, elsewherePlan)).toBe(false);
    expect(npcSearchWeight(elsewhere, elsewhereNpc, elsewherePlan)).toBe(0);

    state.craftGoalRecipeId = 'r_research_package';
    expect(npcSearchWeight(state, npc, plan)).toBeGreaterThan(0);
  });
});

function autonomousFixture(seed: string): { state: GameState; npc: Combatant; apex: WildEnemyInstance } {
  const state = newGame(seed, 'fighter');
  const apex = spawnApex(state, 'prototype_aegis');
  const targetZone = apex.zoneId;
  const origin = getZoneDef(targetZone).adjacent[0]!;
  const npc = npcs(state)[0]!;
  npc.personality = 'collector';
  npc.currentZoneId = origin;
  npc.plannedRecipeId = 'r_aegis_plate';
  npc.planCreatedAt = state.time;
  npc.planReason = 'Phase4P-AF2 autonomous Apex hunt';
  npc.planRecommendedZoneId = targetZone;
  npc.planProgress = 0;
  npc.planNoProgressTurns = 0;
  npc.attack = 1000;
  npc.defense = 100;
  npc.hp = npc.maxHp = 1000;
  npc.stamina = npc.maxStamina = 1000;
  addItem(npc, createStack(state, 'iron', 2));
  addItem(npc, createStack(state, 'scrap', 2));
  state.craftGoalRecipeId = 'r_research_package';

  const remoteZone = ZONE_IDS.find((zoneId) => zoneId !== targetZone && zoneId !== origin)!;
  for (const character of Object.values(state.characters)) {
    if (character.id !== npc.id) character.currentZoneId = remoteZone;
  }
  for (const zone of Object.values(state.zones)) zone.wildEnemyIds = [];
  for (const wild of Object.values(state.wildEnemies)) {
    if (wild.uid === apex.uid) continue;
    wild.status = 'defeated';
    wild.hp = 0;
    wild.guarding = false;
    wild.pendingIntent = null;
    wild.statusEffects = [];
    wild.dropResolved = true;
    wild.defeatedAtTime = state.time;
  }
  state.zones[targetZone]!.wildEnemyIds = [apex.uid];
  exhaust(state, targetZone);
  exhaust(state, origin);
  for (const zoneId of ZONE_IDS) {
    if (zoneId !== targetZone && zoneId !== origin) state.zones[zoneId]!.status = 'restricted';
  }
  refreshZoneOccupants(state);
  return { state, npc, apex };
}

function runAutonomous(seed: string): GameState {
  const { state, npc, apex } = autonomousFixture(seed);
  const initialZone = npc.currentZoneId;
  for (let turn = 0; turn < 300 && !npc.equipment.some((stack) => stack.itemId === 'aegis_plate'); turn += 1) {
    runNpcTurn(state, npc, new SeededRandom(`${seed}:npc-turn:${turn}`));
  }
  expect(initialZone).not.toBe(apex.zoneId);
  expect(npc.currentZoneId).toBe(apex.zoneId);
  expect(npc.equipment.some((stack) => stack.itemId === 'aegis_plate')).toBe(true);
  return state;
}

describe('Phase 4P-AF2 autonomous NPC Apex route', () => {
  it('uses runNpcTurn only for MOVE → SEARCH → defeat → pickup → craft → equip', () => {
    const state = runAutonomous('PHASE4P-AF2-NPC-ROUTE');
    const npc = Object.values(state.characters).find((character) => !character.isPlayer && character.plannedRecipeId === 'r_aegis_plate')!;
    const events = state.events;
    const indexOf = (type: string, predicate: (event: GameEvent) => boolean = () => true): number =>
      events.findIndex((event) => event.type === type && predicate(event));
    const spawnIndex = indexOf('APEX_SPAWNED');
    const moveIndex = indexOf('CHARACTER_MOVED', (event) => event.actorId === npc.id);
    const searchIndex = indexOf('SEARCH_STARTED', (event) => event.actorId === npc.id && event.metadata.empty !== true);
    const encounterIndex = indexOf('WILD_ENCOUNTER_STARTED', (event) => event.actorId === npc.id && event.metadata.wildDefId === 'prototype_aegis');
    const defeatIndex = indexOf('WILD_DEFEATED', (event) => event.actorId === npc.id && event.metadata.wildDefId === 'prototype_aegis');
    const dropIndex = indexOf('WILD_DROP_CREATED', (event) => event.metadata.itemId === 'aegis_core');
    const pickupIndex = indexOf('ITEM_PICKED', (event) => event.actorId === npc.id && event.metadata.itemId === 'aegis_core');
    const craftIndex = indexOf('ITEM_CRAFTED', (event) => event.actorId === npc.id && event.metadata.recipeId === 'r_aegis_plate');
    const equipIndex = indexOf('ITEM_EQUIPPED', (event) => event.actorId === npc.id && event.metadata.itemId === 'aegis_plate');
    expect(spawnIndex).toBeGreaterThanOrEqual(0);
    expect(moveIndex).toBeGreaterThan(spawnIndex);
    expect(searchIndex).toBeGreaterThan(moveIndex);
    expect(encounterIndex).toBeGreaterThan(searchIndex);
    expect(defeatIndex).toBeGreaterThan(encounterIndex);
    expect(dropIndex).toBeGreaterThan(defeatIndex);
    expect(pickupIndex).toBeGreaterThan(dropIndex);
    expect(craftIndex).toBeGreaterThan(pickupIndex);
    expect(equipIndex).toBeGreaterThan(craftIndex);
    expect(events.filter((event) => event.type === 'WILD_DEFEATED' && event.metadata.wildDefId === 'prototype_aegis')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'WILD_DROP_CREATED' && event.metadata.itemId === 'aegis_core')).toHaveLength(1);
    expect(state.stats.signaturePickups).toBe(1);
    expect(countItem(npc, 'aegis_core')).toBe(0);
    expect(getEquippedArmor(npc)?.itemId).toBe('aegis_plate');
    expect(state.deathOrder).toEqual([]);
    expect(state.victory).toEqual({ winnerId: null, type: null, declaredAtTime: null });
    expect(events.some((event) => event.type.startsWith('DEBUG_'))).toBe(false);
  });

  it('replays the autonomous route deterministically', () => {
    const a = runAutonomous('PHASE4P-AF2-NPC-DETERMINISM');
    const b = runAutonomous('PHASE4P-AF2-NPC-DETERMINISM');
    expect(b.events).toEqual(a.events);
    expect(b.stats).toEqual(a.stats);
    expect(b.characters[b.turnOrder.find((id) => !b.characters[id]!.isPlayer)!]!.equipment)
      .toEqual(a.characters[a.turnOrder.find((id) => !a.characters[id]!.isPlayer)!]!.equipment);
  });
});
