import { describe, expect, it } from 'vitest';
import { aliveCharacters, refreshZoneOccupants } from '../src/core/gameState';
import { fleeChanceIn } from '../src/core/combat';
import { computeSearchWeights, performSearch } from '../src/core/search';
import { SeededRandom } from '../src/core/random';
import { validateSaveData } from '../src/core/saveLoad';
import {
  attackWildActor,
  fleeWildEncounter,
  resolveWildTurn,
  wildCombatProfile,
} from '../src/core/wildCombat';
import { livingWildEnemiesInZone } from '../src/core/wildPopulation';
import { syncSupplyRatio } from '../src/core/zoneLoot';
import { getWildEnemy } from '../src/data/wildEnemies';
import type { GameState, WildEnemyInstance } from '../src/core/types';
import { newGame, npcs, player } from './helpers';

function saveOf(state: GameState): Record<string, unknown> {
  return { version: state.version, savedAt: Date.now(), seed: state.seed, time: state.time, rngState: state.rngState, state: structuredClone(state) };
}

function randomForFirstRoll(label: string, predicate: (roll: number) => boolean): SeededRandom {
  for (let index = 0; index < 10_000; index += 1) {
    const seed = `${label}-${index}`;
    const probe = new SeededRandom(seed);
    if (predicate(probe.next())) return new SeededRandom(seed);
  }
  throw new Error(`Unable to find deterministic RNG fixture for ${label}`);
}

function gameWithWild(
  predicate: (enemy: WildEnemyInstance) => boolean,
): { state: GameState; enemy: WildEnemyInstance } {
  for (let index = 0; index < 1_000; index += 1) {
    const state = newGame(`PHASE4N-AF-FIXTURE-${index}`);
    const enemy = Object.values(state.wildEnemies).find(predicate);
    if (enemy) return { state, enemy };
  }
  throw new Error('Unable to find deterministic wild fixture');
}

function isolateWildEncounter(state: GameState, enemy: WildEnemyInstance): void {
  const actor = player(state);
  actor.currentZoneId = enemy.zoneId;
  const otherZone = Object.keys(state.zones).find((zoneId) => zoneId !== enemy.zoneId)!;
  for (const npc of npcs(state)) npc.currentZoneId = otherZone;

  const zone = state.zones[enemy.zoneId]!;
  // Leave exactly one living local wild target, while keeping the formal
  // population index and all production search logic intact.
  for (const uid of zone.wildEnemyIds) {
    const local = state.wildEnemies[uid];
    if (!local || local.uid === enemy.uid) continue;
    local.status = 'defeated';
    local.hp = 0;
    local.guarding = false;
    local.statusEffects = [];
    local.dropResolved = true;
    local.defeatedAtTime = state.time;
  }
  zone.loot = [];
  syncSupplyRatio(zone);
  refreshZoneOccupants(state);
  state.encounter = {
    targetKind: 'wild',
    enemyId: enemy.uid,
    zoneId: enemy.zoneId,
    startedAtTime: state.time,
    log: [],
    resolved: false,
  };
}

function searchRngForWild(state: GameState): SeededRandom {
  const actor = player(state);
  const zone = state.zones[actor.currentZoneId]!;
  const originalSearchCount = zone.searchCount;
  zone.searchCount += 1;
  const weights = computeSearchWeights(state, actor);
  zone.searchCount = originalSearchCount;
  const wildShare = weights.enemy / (weights.find + weights.enemy + weights.nothing);
  if (!(wildShare > 0)) throw new Error('Search fixture has no wild encounter weight');
  return randomForFirstRoll('PHASE4N-AF-SEARCH-WILD', (roll) => roll < wildShare);
}

describe('Phase 4N-AF wild self-flee ecology', () => {
  it('keeps the same alive UID, HP, zone and population slot after self-flee', () => {
    const { state, enemy } = gameWithWild((candidate) => getWildEnemy(candidate.defId).behavior === 'skittish');
    isolateWildEncounter(state, enemy);
    const actor = player(state);
    const zone = state.zones[enemy.zoneId]!;
    const hpBeforeFlee = Math.max(1, Math.floor(getWildEnemy(enemy.defId).maxHp * 0.4));
    const chargesBeforeFlee = enemy.abilityCharges;
    const populationIds = [...zone.wildEnemyIds];
    const groundBefore = zone.groundItems.length;
    const aliveBefore = aliveCharacters(state).map((character) => character.id);
    const deathOrderBefore = [...state.deathOrder];
    const killsBefore = actor.kills;
    const statusBefore = state.status;
    const endReasonBefore = state.endReason;
    enemy.hp = hpBeforeFlee;
    enemy.guarding = true;
    enemy.statusEffects = [{ id: 'evasive', remaining: 1 }];

    const result = resolveWildTurn(
      state,
      actor,
      enemy,
      randomForFirstRoll('PHASE4N-AF-SELF-FLEE', (roll) => roll < 0.45),
    );

    expect(result).toMatchObject({ ok: true, escaped: true });
    expect(enemy.status).toBe('alive');
    expect(populationIds).toContain(enemy.uid);
    expect(enemy.zoneId).toBe(actor.currentZoneId);
    expect(enemy.hp).toBe(hpBeforeFlee);
    expect(enemy.abilityCharges).toBe(chargesBeforeFlee);
    expect(enemy.guarding).toBe(false);
    expect(enemy.statusEffects).toEqual([]);
    expect(enemy.dropResolved).toBe(false);
    expect(zone.wildEnemyIds).toEqual(populationIds);
    expect(livingWildEnemiesInZone(state, zone.id).map((wild) => wild.uid)).toContain(enemy.uid);
    expect(zone.groundItems).toHaveLength(groundBefore);
    expect(aliveCharacters(state).map((character) => character.id)).toEqual(aliveBefore);
    expect(state.deathOrder).toEqual(deathOrderBefore);
    expect(actor.kills).toBe(killsBefore);
    expect(state.status).toBe(statusBefore);
    expect(state.endReason).toBe(endReasonBefore);
    expect(state.encounter?.resolved).toBe(true);

    const event = [...state.events].reverse().find((candidate) => candidate.type === 'WILD_FLED');
    expect(event).toMatchObject({
      type: 'WILD_FLED',
      zoneId: enemy.zoneId,
      metadata: { wildUid: enemy.uid, direction: 'wild' },
    });
    expect(event?.message).not.toContain('逃离了这片区域');
  });

  it('can find the same UID again, retain HP, and resolve drops only on later defeat', () => {
    const { state, enemy } = gameWithWild((candidate) => getWildEnemy(candidate.defId).behavior === 'skittish');
    isolateWildEncounter(state, enemy);
    const actor = player(state);
    const zone = state.zones[enemy.zoneId]!;
    const hpBeforeFlee = Math.max(1, Math.floor(getWildEnemy(enemy.defId).maxHp * 0.4));
    enemy.hp = hpBeforeFlee;

    expect(resolveWildTurn(state, actor, enemy, randomForFirstRoll('PHASE4N-AF-REENC-FLEE', (roll) => roll < 0.45))).toMatchObject({ escaped: true });
    expect(enemy.status).toBe('alive');
    expect(enemy.dropResolved).toBe(false);
    state.encounter = null;

    const outcome = performSearch(state, actor, searchRngForWild(state));
    expect(outcome).toMatchObject({ kind: 'enemy', targetKind: 'wild', enemyId: enemy.uid });
    expect(livingWildEnemiesInZone(state, zone.id).some((wild) => wild.uid === enemy.uid)).toBe(true);
    expect(enemy.hp).toBe(hpBeforeFlee);
    expect(enemy.abilityCharges).toBeGreaterThanOrEqual(0);

    state.encounter = {
      targetKind: 'wild',
      enemyId: enemy.uid,
      zoneId: enemy.zoneId,
      startedAtTime: state.time,
      log: [],
      resolved: false,
    };
    actor.attack = 100;
    actor.maxStamina = 1_000;
    actor.stamina = actor.maxStamina;
    const groundBeforeDefeat = zone.groundItems.length;
    const attackRng = new SeededRandom('PHASE4N-AF-LATER-DEFEAT');
    let defeatResult = attackWildActor(state, actor, enemy.uid, attackRng);
    for (let attempt = 0; attempt < 64 && enemy.status === 'alive'; attempt += 1) {
      defeatResult = attackWildActor(state, actor, enemy.uid, attackRng);
    }

    expect(defeatResult.ok).toBe(true);
    expect(enemy.status).toBe('defeated');
    expect(enemy.dropResolved).toBe(true);
    expect(zone.groundItems.length).toBeGreaterThan(groundBeforeDefeat);
    const groundAfterDefeat = zone.groundItems.length;
    expect(attackWildActor(state, actor, enemy.uid, attackRng).ok).toBe(false);
    expect(zone.groundItems).toHaveLength(groundAfterDefeat);
  });

  it('keeps contestant FLEE separate from wild self-flee lifecycle', () => {
    const { state, enemy } = gameWithWild(() => true);
    isolateWildEncounter(state, enemy);
    const actor = player(state);
    const result = fleeWildEncounter(
      state,
      actor,
      enemy,
      randomForFirstRoll('PHASE4N-AF-CONTESTANT-FLEE', (roll) => roll < fleeChanceIn(state, actor, wildCombatProfile(enemy))),
    );

    expect(result).toMatchObject({ ok: true, escaped: true });
    expect(enemy.status).toBe('alive');
    expect(state.encounter?.resolved).toBe(true);
    const event = [...state.events].reverse().find((candidate) => candidate.type === 'WILD_FLED');
    expect(event?.metadata).toMatchObject({ wildUid: enemy.uid, direction: 'contestant' });
  });

  it('rejects the removed fled status in current-schema saves', () => {
    const state = newGame('PHASE4N-AF-STATUS-SCHEMA');
    const enemy = Object.values(state.wildEnemies)[0]!;
    const save = saveOf(state);
    const savedState = save.state as GameState;
    (savedState.wildEnemies[enemy.uid] as unknown as { status: string }).status = 'fled';
    expect(validateSaveData(save).ok).toBe(false);
  });
});
