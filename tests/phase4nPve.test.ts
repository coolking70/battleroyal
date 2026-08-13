import { describe, expect, it } from 'vitest';
import { attackWildActor, resolveWildTurn } from '../src/core/wildCombat';
import { refreshZoneOccupants, aliveCharacters } from '../src/core/gameState';
import { getLegalPlayerCommands } from '../src/core/legalActions';
import { executeCommand } from '../src/core/gameEngine';
import { canAccessGroundItem } from '../src/core/legalActions';
import { createStack, equipItem } from '../src/core/inventory';
import { SeededRandom } from '../src/core/random';
import { validateSaveData } from '../src/core/saveLoad';
import { getWildEnemy } from '../src/data/wildEnemies';
import type { GameState, WildEnemyInstance } from '../src/core/types';
import { newGame, npcs, player } from './helpers';

function localEncounter(state: GameState, defId?: string): WildEnemyInstance {
  const actor = player(state);
  const enemy = Object.values(state.wildEnemies).find((candidate) => !defId || candidate.defId === defId)!;
  actor.currentZoneId = enemy.zoneId;
  refreshZoneOccupants(state);
  state.encounter = { targetKind: 'wild', enemyId: enemy.uid, zoneId: enemy.zoneId, startedAtTime: state.time, log: [], resolved: false };
  return enemy;
}

function saveOf(state: GameState): Record<string, unknown> {
  return { version: state.version, savedAt: Date.now(), seed: state.seed, time: state.time, rngState: state.rngState, state: structuredClone(state) };
}

describe('Phase 4N PvE combat and drops', () => {
  it('defeats wild separately, wears the real weapon, and creates owned ground drops exactly once', () => {
    const state = newGame('PHASE4N-KILL-DROP', 'fighter');
    const actor = player(state);
    const enemy = localEncounter(state);
    actor.attack = 100;
    actor.stamina = actor.maxStamina = 100;
    const weapon = createStack(state, 'stick');
    actor.inventory.push(weapon);
    expect(equipItem(actor, weapon.uid).ok).toBe(true);
    const equipped = actor.equipment[0]!;
    const durabilityBefore = equipped.durability!;
    enemy.hp = 1;
    const pvpKills = actor.kills;
    const deathOrder = [...state.deathOrder];
    const aliveBefore = aliveCharacters(state).length;
    const zone = state.zones[enemy.zoneId]!;
    const groundBefore = zone.groundItems.length;
    const rng = new SeededRandom('PHASE4N-KILL-DROP-RNG');
    let result = attackWildActor(state, actor, enemy.uid, rng);
    for (let i = 0; i < 8 && enemy.status === 'alive'; i += 1) result = attackWildActor(state, actor, enemy.uid, rng);
    expect(result.ok).toBe(true);
    expect(enemy.status).toBe('defeated');
    expect(actor.kills).toBe(pvpKills);
    expect(actor.stats.wildKills).toBe(1);
    expect(state.deathOrder).toEqual(deathOrder);
    expect(aliveCharacters(state)).toHaveLength(aliveBefore);
    expect(equipped.durability).toBeLessThan(durabilityBefore);
    const drops = zone.groundItems.slice(groundBefore);
    expect(drops.length).toBeGreaterThan(0);
    expect(drops.every((stack) => stack.droppedBy === actor.id && stack.revealedTo?.length === 0)).toBe(true);
    expect(drops.every((stack) => canAccessGroundItem(actor, stack))).toBe(true);
    expect(drops.every((stack) => !canAccessGroundItem(npcs(state)[0]!, stack))).toBe(true);
    expect(actor.inventory.some((stack) => drops.some((drop) => drop.uid === stack.uid))).toBe(false);
    const countAfter = zone.groundItems.length;
    expect(attackWildActor(state, actor, enemy.uid, rng).ok).toBe(false);
    expect(zone.groundItems).toHaveLength(countAfter);
  });

  it('wild attacks can apply bounded poison without creating a wild profession or EXP actor', () => {
    const state = newGame('PHASE4N-VENOM');
    const actor = player(state);
    const enemy = localEncounter(state, 'venom_snake');
    actor.hp = actor.maxHp = 500;
    const rng = new SeededRandom('PHASE4N-VENOM-RNG');
    for (let i = 0; i < 12 && !actor.statusEffects.some((effect) => effect.id === 'wild_poison'); i += 1) {
      resolveWildTurn(state, actor, enemy, rng);
    }
    const poison = actor.statusEffects.find((effect) => effect.id === 'wild_poison');
    expect(poison).toMatchObject({ remaining: 2, hpPerTick: -2 });
    expect(state.characters[enemy.uid]).toBeUndefined();
    expect(Object.values(state.characters).some((candidate) => candidate.characterId.startsWith('wild:'))).toBe(false);
  });

  it('keeps zero-stamina wild encounters escapable and command-legal', () => {
    const state = newGame('PHASE4N-ZERO-STAMINA');
    localEncounter(state);
    player(state).stamina = 0;
    const legal = getLegalPlayerCommands(state).map((entry) => entry.command.type);
    expect(legal).toContain('GUARD');
    expect(legal).toContain('FLEE');
    expect(executeCommand(state, { type: 'FLEE' }).ok).toBe(true);
  });
});

describe('Phase 4N current-schema save integrity', () => {
  it('round-trips a mid-wild-combat state and continues deterministically', () => {
    const state = newGame('PHASE4N-SAVE-CONTINUE');
    const enemy = localEncounter(state);
    enemy.hp = Math.max(1, getWildEnemy(enemy.defId).maxHp - 5);
    enemy.guarding = true;
    enemy.statusEffects = [{ id: 'evasive', remaining: 2 }];
    expect(validateSaveData(saveOf(state)).ok).toBe(true);
    const loaded = JSON.parse(JSON.stringify(state)) as GameState;
    const command = { type: 'ATTACK', targetId: enemy.uid, style: 'quick' } as const;
    expect(executeCommand(state, command)).toEqual(executeCommand(loaded, command));
  });

  it.each([
    ['unknown def', (_s: GameState, e: WildEnemyInstance) => { e.defId = 'unknown_wild'; }],
    ['duplicate uid', (s: GameState, e: WildEnemyInstance) => { s.zones[Object.keys(s.zones).find((id) => id !== e.zoneId)!]!.wildEnemyIds.push(e.uid); }],
    ['hp over max', (_s: GameState, e: WildEnemyInstance) => { e.hp = getWildEnemy(e.defId).maxHp + 1; }],
    ['hp below zero', (_s: GameState, e: WildEnemyInstance) => { e.hp = -1; }],
    ['zone mismatch', (_s: GameState, e: WildEnemyInstance) => { e.zoneId = e.zoneId === 'school' ? 'hospital' : 'school'; }],
    ['unknown encounter uid', (s: GameState) => { s.encounter!.enemyId = 'w99999'; }],
    ['dead active encounter', (_s: GameState, e: WildEnemyInstance) => { e.status = 'defeated'; e.hp = 0; e.defeatedAtTime = 0; e.dropResolved = true; }],
    ['invalid status duration', (_s: GameState, e: WildEnemyInstance) => { e.statusEffects = [{ id: 'armored', remaining: 0 }]; }],
    ['missing discriminator', (s: GameState) => { delete s.encounter!.targetKind; }],
  ])('rejects %s corruption', (_name, mutate) => {
    const state = newGame(`PHASE4N-CORRUPT-${_name}`);
    const enemy = localEncounter(state);
    mutate(state, enemy);
    expect(validateSaveData(saveOf(state)).ok).toBe(false);
  });
});
