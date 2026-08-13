import { describe, expect, it } from 'vitest';
import { createGame, refreshZoneOccupants } from '../src/core/gameState';
import { processApexSpawns } from '../src/core/apexSchedule';
import { attackWildActor, resolveWildTurn, startWildEncounter, wildFlees } from '../src/core/wildCombat';
import { SeededRandom } from '../src/core/random';
import { getItem } from '../src/data/items';
import { APEX_WILD_ENEMY_IDS, ALL_WILD_ENEMIES, ELITE_WILD_ENEMY_IDS, validateWildRegistries } from '../src/data/wildEnemies';
import { PHASE4P_SIGNATURE_IDS, PHASE4P_WILD_MATERIAL_IDS } from '../src/data/phase4pItems';
import { PHASE4P_RECIPES } from '../src/data/phase4pRecipes';
import { getRecipeDepth, validateRecipeGraph } from '../src/data/recipes';
import { worldSourcesForItem } from '../src/core/worldSources';
import { validateSaveData } from '../src/core/saveLoad';
import { isEventVisibleToPlayer } from '../src/ui/components/EventLog';
import { runPhase4PAutoRoute } from '../tools/phase4pAutoPlayer';
import type { GameState } from '../src/core/types';

function saveOf(state: GameState): Record<string, unknown> {
  return { version: state.version, savedAt: Date.now(), seed: state.seed, time: state.time, rngState: state.rngState, state: structuredClone(state) };
}

function spawnedApex(state: GameState): { state: GameState; uid: string } {
  const entry = state.apexSchedule[0]!;
  state.time = entry.scheduledAt;
  processApexSpawns(state);
  if (!entry.uid) throw new Error('test Apex did not spawn');
  return { state, uid: entry.uid };
}

describe('Phase 4P elite and named Apex registry', () => {
  it('keeps a finite tiered registry with six elite and three named Apex definitions', () => {
    expect(validateWildRegistries()).toEqual([]);
    expect(ELITE_WILD_ENEMY_IDS).toHaveLength(6);
    expect(APEX_WILD_ENEMY_IDS).toHaveLength(3);
    expect(ALL_WILD_ENEMIES.filter((def) => def.tier === 'elite')).toHaveLength(6);
    expect(ALL_WILD_ENEMIES.filter((def) => def.tier === 'apex')).toHaveLength(3);
    expect(new Set(PHASE4P_WILD_MATERIAL_IDS).size).toBeGreaterThanOrEqual(9);
    expect(PHASE4P_WILD_MATERIAL_IDS.every((id) => getItem(id).craftTier === 'raw')).toBe(true);
  });

  it('creates a deterministic saveable schedule before and after one-shot spawning', () => {
    const a = createGame({ seed: 'PHASE4P-SCHEDULE', playerCharacterId: 'scout' });
    const b = createGame({ seed: 'PHASE4P-SCHEDULE', playerCharacterId: 'scout' });
    expect(a.apexSchedule).toEqual(b.apexSchedule);
    expect(a.apexSchedule.every((entry) => !entry.spawned && entry.uid === null)).toBe(true);
    expect(validateSaveData(saveOf(a)).ok).toBe(true);
    const spawned = spawnedApex(a);
    expect(a.stats.apexSpawnedCount).toBe(1);
    const event = a.events.find((candidate) => candidate.type === 'APEX_SPAWNED');
    expect(event?.metadata).not.toHaveProperty('wildUid');
    expect(event?.metadata).not.toHaveProperty('hp');
    expect(event?.metadata).toMatchObject({ tier: 'apex', zoneId: a.apexSchedule[0]!.zoneId });
    const before = structuredClone(a);
    processApexSpawns(a);
    expect(a).toEqual(before);
    expect(validateSaveData(saveOf(a)).ok).toBe(true);
    expect(a.wildEnemies[spawned.uid]!.defId).toBe(a.apexSchedule[0]!.defId);
  });

  it('uses SEARCH to discover Apex and keeps special telegraph intent persisted', () => {
    const state = createGame({ seed: 'PHASE4P-TELEGRAPH', playerCharacterId: 'fighter' });
    const { uid } = spawnedApex(state);
    const enemy = state.wildEnemies[uid]!;
    const player = state.characters[state.playerId]!;
    player.currentZoneId = enemy.zoneId;
    player.hp = player.maxHp = 1000;
    player.stamina = player.maxStamina = 1000;
    refreshZoneOccupants(state);
    startWildEncounter(state, player, enemy);
    const rng = new SeededRandom('PHASE4P-TELEGRAPH-RNG');
    for (let i = 0; i < 12 && enemy.pendingIntent === null; i += 1) resolveWildTurn(state, player, enemy, rng);
    expect(enemy.pendingIntent).not.toBeNull();
    expect(validateSaveData(saveOf(state)).ok).toBe(true);
    const intent = enemy.pendingIntent;
    resolveWildTurn(state, player, enemy, rng);
    expect(enemy.pendingIntent).toBe(null);
    expect(state.events.some((event) => event.type === 'WILD_ATTACK' && event.metadata.action === 'telegraph')).toBe(true);
    expect(intent).not.toBeNull();
  });

  it('keeps GUARD and zero-stamina flee semantics in the canonical Wild combat path', () => {
    const state = createGame({ seed: 'PHASE4P-FLEE', playerCharacterId: 'scout' });
    const { uid } = spawnedApex(state);
    const enemy = state.wildEnemies[uid]!;
    const player = state.characters[state.playerId]!;
    player.currentZoneId = enemy.zoneId;
    player.stamina = 0;
    refreshZoneOccupants(state);
    startWildEncounter(state, player, enemy);
    enemy.pendingIntent = null;
    const before = { uid: enemy.uid, zoneId: enemy.zoneId, hp: enemy.hp, charges: enemy.abilityCharges };
    const result = wildFlees(state, player, enemy);
    expect(result.ok).toBe(true);
    expect(enemy).toMatchObject({ uid: before.uid, zoneId: before.zoneId, hp: before.hp, abilityCharges: before.charges, status: 'alive' });
    expect(state.stats.apexFleeCount).toBe(1);
    expect(player.stamina).toBe(0);
  });

  it('defeats through attackWildActor and creates one guaranteed signature ground drop', () => {
    const state = createGame({ seed: 'PHASE4P-SIGNATURE', playerCharacterId: 'fighter' });
    const { uid } = spawnedApex(state);
    const enemy = state.wildEnemies[uid]!;
    const player = state.characters[state.playerId]!;
    player.currentZoneId = enemy.zoneId;
    player.attack = 1000;
    player.stamina = player.maxStamina = 1000;
    enemy.hp = 1;
    refreshZoneOccupants(state);
    startWildEncounter(state, player, enemy);
    const rng = new SeededRandom('PHASE4P-KILL');
    let result = attackWildActor(state, player, uid, rng);
    for (let i = 0; i < 8 && enemy.status === 'alive'; i += 1) result = attackWildActor(state, player, uid, rng);
    expect(result.enemyDefeated).toBe(true);
    const signature = state.zones[enemy.zoneId]!.groundItems.filter((stack) => (PHASE4P_SIGNATURE_IDS as readonly string[]).includes(stack.itemId));
    expect(signature).toHaveLength(1);
    expect(state.stats.signatureDrops).toBe(1);
    expect(player.kills).toBe(0);
    expect(state.deathOrder).toEqual([]);
    expect(validateSaveData(saveOf(state)).ok).toBe(true);
  });

  it('keeps Phase4P craft graph, sources, and three deep final routes connected', () => {
    expect(PHASE4P_RECIPES).toHaveLength(13);
    expect(validateRecipeGraph()).toEqual([]);
    const finals = ['r_aegis_plate', 'r_adaptive_bio_suit', 'r_tuskbreaker', 'r_apex_carbine', 'r_riot_shell', 'r_targeting_rig'];
    expect(finals.every((recipeId) => getRecipeDepth(recipeId) >= 3)).toBe(true);
    for (const itemId of PHASE4P_WILD_MATERIAL_IDS) expect(worldSourcesForItem(itemId).some((source) => source.kind === 'wild_drop')).toBe(true);
  });

  it('keeps the public-information boundary and completes the formal AutoPlayer route without debug material', () => {
    const route = runPhase4PAutoRoute();
    expect(route.illegalCommands).toEqual([]);
    expect(route.route).toEqual(expect.arrayContaining(['SET_CRAFT_GOAL', 'MOVE', 'SEARCH', 'GUARD', 'ATTACK', 'PICKUP_GROUND', 'CRAFT', 'EQUIP']));
    expect(route.state.characters[route.state.playerId]!.equipment.some((stack) => stack.itemId === 'aegis_plate')).toBe(true);
    expect(route.state.stats.signaturePickups).toBe(1);
    expect(route.commandTypes).not.toContain('DEBUG_GIVE_MATERIAL');
    const apexEvent = route.state.events.find((event) => event.type === 'APEX_SPAWNED')!;
    expect(isEventVisibleToPlayer(apexEvent, route.state.playerId)).toBe(true);
    expect(apexEvent.metadata).not.toHaveProperty('wildUid');
  });
});
