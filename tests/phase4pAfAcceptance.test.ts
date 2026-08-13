import { describe, expect, it } from 'vitest';
import { getZoneDef, ZONE_IDS } from '../src/data/zones';
import { getWildEnemy } from '../src/data/wildEnemies';
import { refreshZoneOccupants } from '../src/core/gameState';
import { processApexSpawns } from '../src/core/apexSchedule';
import { validateSaveData } from '../src/core/saveLoad';
import { guardActor } from '../src/core/actorCombatActions';
import { computeSearchWeights, getActorCraftGoalRecipeId, wildSearchTargetWeight } from '../src/core/search';
import { searchActor } from '../src/core/actorActions';
import { resolveWildTurn } from '../src/core/wildCombat';
import { runNpcTurn } from '../src/core/npcAi';
import { buildCraftPlan } from '../src/core/craftPlan';
import { countItem, createStack, addItem, getEquippedArmor } from '../src/core/inventory';
import { moveActor } from '../src/core/actorActions';
import { SeededRandom } from '../src/core/random';
import type { Combatant, GameEvent, GameState, WildEnemyInstance } from '../src/core/types';
import { newGame, npcs, player } from './helpers';

function saveOf(state: GameState): Record<string, unknown> {
  return { version: state.version, savedAt: 1, seed: state.seed, time: state.time, rngState: state.rngState, state: structuredClone(state) };
}

function spawnApex(state: GameState, defId: string): WildEnemyInstance {
  const entry = state.apexSchedule.find((candidate) => candidate.defId === defId)!;
  entry.scheduledAt = 0;
  state.time = 0;
  processApexSpawns(state);
  const uid = entry.uid;
  if (!uid) throw new Error(`Apex ${defId} did not spawn`);
  return state.wildEnemies[uid]!;
}

function isolateApex(state: GameState, enemy: WildEnemyInstance): void {
  const otherZone = ZONE_IDS.find((zoneId) => zoneId !== enemy.zoneId)!;
  for (const zone of Object.values(state.zones)) {
    zone.aliveCharacterIds = [];
    zone.wildEnemyIds = [];
  }
  for (const character of Object.values(state.characters)) character.currentZoneId = otherZone;
  for (const candidate of Object.values(state.wildEnemies)) {
    if (candidate.uid === enemy.uid) {
      state.zones[enemy.zoneId]!.wildEnemyIds.push(candidate.uid);
      continue;
    }
    candidate.zoneId = otherZone;
    candidate.status = 'defeated';
    candidate.hp = 0;
    candidate.guarding = false;
    candidate.pendingIntent = null;
    candidate.statusEffects = [];
    candidate.dropResolved = true;
    candidate.defeatedAtTime = state.time;
    state.zones[otherZone]!.wildEnemyIds.push(candidate.uid);
  }
  const zone = state.zones[enemy.zoneId]!;
  zone.loot = [];
  zone.objectiveLoot = [];
  zone.initialLootCount = 0;
  zone.remainingLootCount = 0;
  zone.supply = 0;
  refreshZoneOccupants(state);
}

function firstEnemyRng(state: GameState, actor: Combatant): SeededRandom {
  const weights = computeSearchWeights(state, actor);
  const share = weights.enemy / (weights.find + weights.enemy + weights.nothing);
  for (let i = 0; i < 10_000; i += 1) {
    const seed = `PHASE4P-AF-SEARCH-${i}`;
    const probe = new SeededRandom(seed);
    if (probe.next() < share) return new SeededRandom(seed);
  }
  throw new Error('Unable to create deterministic SEARCH encounter roll');
}

describe('Phase 4P-AF acceptance invariants', () => {
  it('delays a due Apex when all legal zones are restricted, then spawns after reopening one', () => {
    const state = newGame('PHASE4P-AF-SPAWN-DELAY');
    const entry = state.apexSchedule.find((candidate) => candidate.defId === 'prototype_aegis')!;
    entry.scheduledAt = 0;
    for (const zoneId of getWildEnemy(entry.defId).eligibleZones ?? []) state.zones[zoneId]!.status = 'restricted';
    processApexSpawns(state);
    expect(entry).toMatchObject({ spawned: false, spawnedAt: null, uid: null, zoneId: null });
    expect(state.stats.apexSpawnedCount).toBe(0);
    expect(state.events.some((event) => event.type === 'APEX_SPAWNED')).toBe(false);

    state.zones.factory!.status = 'safe';
    processApexSpawns(state);
    expect(entry.spawned).toBe(true);
    expect(entry.zoneId).toBe('factory');
    expect(state.stats.apexSpawnedCount).toBe(1);
    expect(state.events.filter((event) => event.type === 'APEX_SPAWNED')).toHaveLength(1);
  });

  it('keeps eligible-zone choice deterministic across delayed save/load continuation', () => {
    const delayed = newGame('PHASE4P-AF-DELAY-SAVE');
    const entry = delayed.apexSchedule.find((candidate) => candidate.defId === 'prototype_aegis')!;
    entry.scheduledAt = 0;
    for (const zoneId of getWildEnemy(entry.defId).eligibleZones ?? []) delayed.zones[zoneId]!.status = 'restricted';
    processApexSpawns(delayed);
    expect(validateSaveData(saveOf(delayed)).ok).toBe(true);

    const a = structuredClone(delayed);
    const b = JSON.parse(JSON.stringify(delayed)) as GameState;
    a.zones.station!.status = 'safe';
    b.zones.station!.status = 'safe';
    processApexSpawns(a);
    processApexSpawns(b);
    expect(b).toEqual(a);
    expect(a.apexSchedule.find((candidate) => candidate.defId === 'prototype_aegis')?.zoneId).toBe('station');
  });

  it('validates Apex schedule zones against the definition while allowing later restriction', () => {
    const state = newGame('PHASE4P-AF-APEX-SAVE-ZONE');
    const enemy = spawnApex(state, 'prototype_aegis');
    const entry = state.apexSchedule.find((candidate) => candidate.defId === 'prototype_aegis')!;
    state.zones[entry.zoneId!]!.status = 'restricted';
    expect(validateSaveData(saveOf(state)).ok).toBe(true);

    const corrupt = structuredClone(state);
    const corruptEntry = corrupt.apexSchedule.find((candidate) => candidate.defId === 'prototype_aegis')!;
    const oldZone = corruptEntry.zoneId!;
    corruptEntry.zoneId = 'forest';
    corrupt.wildEnemies[enemy.uid]!.zoneId = 'forest';
    corrupt.zones[oldZone]!.wildEnemyIds = corrupt.zones[oldZone]!.wildEnemyIds.filter((uid) => uid !== enemy.uid);
    corrupt.zones.forest!.wildEnemyIds.push(enemy.uid);
    expect(validateSaveData(saveOf(corrupt)).ok).toBe(false);
  });

  it('rejects wrong-definition and defeated-state pendingIntent corruption', () => {
    const common = newGame('PHASE4P-AF-PENDING-COMMON');
    const commonEnemy = Object.values(common.wildEnemies).find((candidate) => getWildEnemy(candidate.defId).specialAbilityId === 'none')!;
    commonEnemy.pendingIntent = 'overcharge';
    expect(validateSaveData(saveOf(common)).ok).toBe(false);

    const apex = newGame('PHASE4P-AF-PENDING-APEX');
    const apexEnemy = spawnApex(apex, 'prototype_aegis');
    apexEnemy.pendingIntent = 'massive_charge';
    expect(validateSaveData(saveOf(apex)).ok).toBe(false);
    apexEnemy.pendingIntent = 'shield_cycle';
    expect(validateSaveData(saveOf(apex)).ok).toBe(true);
    apexEnemy.status = 'defeated';
    apexEnemy.hp = 0;
    apexEnemy.dropResolved = true;
    apexEnemy.defeatedAtTime = apex.time;
    expect(validateSaveData(saveOf(apex)).ok).toBe(false);
  });

  it('clears an impossible runtime telegraph instead of freezing special resolution', () => {
    const state = newGame('PHASE4P-AF-RUNTIME-MISMATCH');
    const enemy = spawnApex(state, 'prototype_aegis');
    const actor = player(state);
    actor.currentZoneId = enemy.zoneId;
    enemy.guarding = true;
    enemy.abilityCharges = 0;
    enemy.pendingIntent = 'massive_charge';
    resolveWildTurn(state, actor, enemy, new SeededRandom('PHASE4P-AF-RUNTIME-RNG'));
    expect(enemy.pendingIntent).toBeNull();
  });

  it('proves formal GUARD uses shared incoming-damage reduction for a pending special', () => {
    const make = (): { state: GameState; enemy: WildEnemyInstance } => {
      const state = newGame('PHASE4P-AF-GUARD-AB');
      const enemy = spawnApex(state, 'subject_07');
      isolateApex(state, enemy);
      const actor = player(state);
      actor.currentZoneId = enemy.zoneId;
      actor.hp = actor.maxHp = 1000;
      actor.defense = 0;
      actor.speed = 1;
      enemy.pendingIntent = 'toxic_burst';
      state.encounter = { targetKind: 'wild', enemyId: enemy.uid, zoneId: enemy.zoneId, startedAtTime: state.time, log: [], resolved: false };
      refreshZoneOccupants(state);
      return { state, enemy };
    };
    const unguarded = make();
    const guarded = make();
    const rawRng = new SeededRandom('PHASE4P-AF-GUARD-ROLL');
    const guardedRng = new SeededRandom('PHASE4P-AF-GUARD-ROLL');
    const raw = resolveWildTurn(unguarded.state, player(unguarded.state), unguarded.enemy, rawRng);
    expect(raw.ok).toBe(true);
    expect(guardActor(guarded.state, player(guarded.state)).ok).toBe(true);
    const reduced = resolveWildTurn(guarded.state, player(guarded.state), guarded.enemy, guardedRng);
    expect(reduced.ok).toBe(true);
    const rawEvent = [...unguarded.state.events].reverse().find((event) => event.type === 'WILD_ATTACK' && event.metadata.specialAbility === 'toxic_burst')!;
    const reducedEvent = [...guarded.state.events].reverse().find((event) => event.type === 'WILD_ATTACK' && event.metadata.specialAbility === 'toxic_burst')!;
    expect(reducedEvent.metadata.guarded).toBe(true);
    expect(reducedEvent.metadata.guardPrevented).toBeGreaterThan(0);
    expect(Number(reducedEvent.metadata.damage)).toBeLessThan(Number(rawEvent.metadata.damage));
    expect(guarded.enemy.pendingIntent).toBeNull();
    expect(player(guarded.state).stamina).toBe(player(unguarded.state).stamina - 2);
  });

  it('keeps NPC SEARCH weighting actor-scoped and completes Apex → loot → craft → equip', () => {
    const run = (seed: string): GameState => {
      const state = newGame(seed, 'fighter');
      const enemy = spawnApex(state, 'prototype_aegis');
      isolateApex(state, enemy);
      const npc = npcs(state)[0]!;
      const actor = player(state);
      const targetZone = enemy.zoneId;
      const origin = getZoneDef(targetZone).adjacent[0]!;
      npc.currentZoneId = origin;
      actor.currentZoneId = ZONE_IDS.find((zoneId) => zoneId !== origin && zoneId !== targetZone)!;
      npc.plannedRecipeId = 'r_aegis_plate';
      npc.planCreatedAt = state.time;
      npc.planReason = 'Phase4P-AF NPC route fixture';
      npc.planRecommendedZoneId = targetZone;
      npc.planProgress = 0;
      npc.planNoProgressTurns = 0;
      npc.attack = 1000;
      npc.defense = 100;
      npc.hp = npc.maxHp = 1000;
      npc.stamina = npc.maxStamina = 1000;
      addItem(npc, createStack(state, 'iron', 2));
      addItem(npc, createStack(state, 'scrap', 2));
      state.craftGoalRecipeId = 'r_reinforced_pipe';
      refreshZoneOccupants(state);

      expect(getActorCraftGoalRecipeId(state, npc)).toBe('r_aegis_plate');
      expect(wildSearchTargetWeight(state, npc, enemy)).toBe(0.25);
      npc.plannedRecipeId = null;
      expect(wildSearchTargetWeight(state, npc, enemy)).toBe(0);
      state.craftGoalRecipeId = 'r_aegis_plate';
      npc.plannedRecipeId = 'r_aegis_plate';
      expect(wildSearchTargetWeight(state, npc, enemy)).toBe(0.25);
      expect(buildCraftPlan(state, npc, 'r_aegis_plate')?.rawGaps.some((gap) => gap.itemId === 'aegis_core' && gap.sourceZoneIds.includes(targetZone))).toBe(true);

      expect(moveActor(state, npc, targetZone).ok).toBe(true);
      const search = searchActor(state, npc, firstEnemyRng(state, npc));
      expect(search.outcome).toMatchObject({ kind: 'enemy', targetKind: 'wild', enemyId: enemy.uid });
      expect(state.events.some((event) => event.type === 'WILD_ENCOUNTER_STARTED' && event.actorId === npc.id && event.metadata.wildUid === enemy.uid)).toBe(true);

      for (let turn = 0; turn < 180 && enemy.status === 'alive'; turn += 1) {
        runNpcTurn(state, npc, new SeededRandom(`${seed}:npc:${turn}`));
      }
      for (let turn = 0; turn < 180 && !getEquippedArmor(npc)?.itemId; turn += 1) {
        runNpcTurn(state, npc, new SeededRandom(`${seed}:loot:${turn}`));
      }
      expect(enemy.status).toBe('defeated');
      expect(state.events.filter((event) => event.type === 'WILD_DEFEATED' && event.actorId === npc.id)).toHaveLength(1);
      expect(state.events.filter((event) => event.type === 'WILD_DROP_CREATED' && event.metadata.itemId === 'aegis_core')).toHaveLength(1);
      expect(state.stats.signaturePickups).toBe(1);
      expect(countItem(npc, 'aegis_core')).toBe(0);
      expect(countItem(npc, 'aegis_plate') + (getEquippedArmor(npc)?.itemId === 'aegis_plate' ? 1 : 0)).toBe(1);
      expect(state.stats.signatureCrafts).toBe(1);
      expect(state.events.some((event) => event.type === 'ITEM_CRAFTED' && event.actorId === npc.id && event.metadata.recipeId === 'r_servo_housing')).toBe(true);
      expect(state.events.some((event) => event.type === 'ITEM_CRAFTED' && event.actorId === npc.id && event.metadata.recipeId === 'r_composite_chassis')).toBe(true);
      expect(state.events.some((event) => event.type === 'ITEM_CRAFTED' && event.actorId === npc.id && event.metadata.recipeId === 'r_aegis_plate')).toBe(true);
      expect(getEquippedArmor(npc)?.itemId).toBe('aegis_plate');
      expect(state.deathOrder).toEqual([]);
      expect(state.victory.winnerId).toBeNull();
      expect(state.events.some((event) => event.message.includes('调试：给予材料'))).toBe(false);
      return state;
    };

    const a = run('PHASE4P-AF-NPC-ROUTE');
    const b = run('PHASE4P-AF-NPC-ROUTE');
    expect(b).toEqual(a);
  });
});

describe('Phase 4P-AF simulator semantics', () => {
  it('uses Apex tier only for bossKillsByType while wildKillByType keeps all Wild kills', async () => {
    const { countWildEvents } = await import('../tools/autoPlayer');
    const event = (wildDefId: string, tier: string): GameEvent => ({
      id: wildDefId + tier,
      type: 'WILD_DEFEATED',
      time: 1,
      actorId: 'npc-1',
      targetId: null,
      zoneId: 'factory',
      message: wildDefId,
      importance: 'major',
      metadata: { wildUid: `w-${wildDefId}-${tier}`, wildDefId, tier },
    });
    const events = [event('feral_dog', 'common'), event('riot_control_unit', 'elite'), event('prototype_aegis', 'apex'), event('prototype_aegis', 'apex'), event('subject_07', 'apex')];
    expect(countWildEvents(events, 'WILD_DEFEATED', 'wildDefId', (candidate) => candidate.metadata.tier === 'apex')).toEqual({ prototype_aegis: 2, subject_07: 1 });
    expect(countWildEvents(events, 'WILD_DEFEATED', 'wildDefId')).toEqual({ feral_dog: 1, riot_control_unit: 1, prototype_aegis: 2, subject_07: 1 });
  });
});
