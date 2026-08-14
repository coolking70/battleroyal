import { describe, expect, it } from 'vitest';
import { advanceTime, checkGameEnd, executeCommand } from '../src/core/gameEngine';
import { killCharacter } from '../src/core/combat';
import { addItem, countItem, createStack } from '../src/core/inventory';
import { refreshZoneOccupants } from '../src/core/gameState';
import { buildFinalRanking } from '../src/core/resultRanking';
import { validateSaveData } from '../src/core/saveLoad';
import { SeededRandom } from '../src/core/random';
import { chooseNpcGoal, planNpcGoal } from '../src/core/npcDecide';
import { runNpcTurn } from '../src/core/npcAi';
import {
  declareVictory,
  performObjectiveAction,
  syncActiveExtraction,
} from '../src/core/victory';
import { runAutoGame, seedObjectiveRouteWorldFixture } from '../tools/autoPlayer';
import { initZoneLoot } from '../src/core/zoneLoot';
import { newGame, npcs, player } from './helpers';

function saveOf(state: ReturnType<typeof newGame>): Record<string, unknown> {
  return {
    version: state.version,
    savedAt: Date.now(),
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state: structuredClone(state),
  };
}

describe('Phase 4O-AF victory semantics and alternative-route closure', () => {
  it('does not terminate the match when the player is eliminated with multiple NPCs alive', () => {
    const state = newGame('PHASE4O-AF-PLAYER-ELIMINATED');
    killCharacter(state, player(state), null, '测试淘汰');
    checkGameEnd(state);

    expect(state.status).toBe('playing');
    expect(state.victory).toEqual({ winnerId: null, type: null, declaredAtTime: null });
    expect(state.events.some((event) => event.type === 'GAME_ENDED')).toBe(false);

    const rng = SeededRandom.fromState(state.rngState);
    for (let tick = 0; tick < 220 && state.status === 'playing'; tick += 1) {
      advanceTime(state, rng);
    }
    expect(state.status).not.toBe('playing');
    if (state.status === 'draw') {
      expect(state.victory).toEqual({ winnerId: null, type: null, declaredAtTime: null });
    } else {
      expect(state.victory.winnerId).not.toBeNull();
      expect(state.victory.type).not.toBeNull();
      expect(state.victory.declaredAtTime).not.toBeNull();
    }
  });

  it('lets an NPC research winner finish after player elimination', () => {
    const state = newGame('PHASE4O-AF-NPC-RESEARCH-AFTER-DEATH');
    const npc = npcs(state)[0]!;
    killCharacter(state, player(state), null, '测试淘汰');
    npc.currentZoneId = 'lab';
    npc.victoryGoal = 'research';
    npc.stamina = npc.maxStamina;
    addItem(npc, createStack(state, 'research_package', 1));
    refreshZoneOccupants(state);
    checkGameEnd(state);

    expect(state.status).toBe('playing');
    expect(runNpcTurn(state, npc, new SeededRandom('PHASE4O-AF-NPC-RESEARCH-AFTER-DEATH-RNG')).kind)
      .toBe('submit_research');
    expect(state.status).toBe('lost');
    expect(state.victory).toMatchObject({ winnerId: npc.id, type: 'research' });
    expect(player(state).alive).toBe(false);
  });

  it('freezes the terminal tick after an NPC research victory', () => {
    const state = newGame('PHASE4O-AF2-NPC-RESEARCH-TICK-FREEZE');
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'lab';
    npc.victoryGoal = 'research';
    npc.victoryGoalMode = 'explicit';
    npc.hp = 1;
    npc.stamina = npc.maxStamina;
    npc.statusEffects.push({
      id: 'wild_poison',
      remaining: 2,
      hpPerTick: -2,
      label: '验收致死持续伤害',
    });
    addItem(npc, createStack(state, 'research_package', 1));
    refreshZoneOccupants(state);
    const waterBefore = countItem(npc, 'water');
    const eventsBefore = state.events.length;

    advanceTime(state, new SeededRandom('PHASE4O-AF2-NPC-RESEARCH-TICK-FREEZE-RNG'));

    const terminalEvents = state.events.slice(eventsBefore);
    expect(state.status).toBe('lost');
    expect(state.time).toBe(1);
    expect(state.victory).toMatchObject({ winnerId: npc.id, type: 'research' });
    expect(npc.alive).toBe(true);
    expect(npc.hp).toBe(1);
    expect(npc.statusEffects).toEqual([
      expect.objectContaining({ id: 'wild_poison', remaining: 2 }),
    ]);
    expect(countItem(npc, 'research_package')).toBe(0);
    expect(countItem(npc, 'water')).toBe(waterBefore);
    expect(terminalEvents.map((event) => event.type)).toEqual([
      'RESEARCH_COMPLETED',
      'VICTORY_DECLARED',
      'GAME_ENDED',
    ]);
    expect(state.events.at(-1)?.type).toBe('GAME_ENDED');
    expect(validateSaveData(saveOf(state)).ok).toBe(true);
  });

  it('freezes the terminal tick after an NPC extraction victory', () => {
    const state = newGame('PHASE4O-AF2-NPC-EXTRACTION-TICK-FREEZE');
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'station';
    npc.victoryGoal = 'extraction';
    npc.victoryGoalMode = 'explicit';
    npc.hp = 1;
    npc.stamina = npc.maxStamina;
    npc.statusEffects.push({
      id: 'wild_poison',
      remaining: 2,
      hpPerTick: -2,
      label: '验收撤离致死持续伤害',
    });
    addItem(npc, createStack(state, 'extraction_beacon', 1));
    state.activeExtraction = {
      callerId: npc.id,
      zoneId: 'station',
      startedAtTime: -1,
      readyAtTime: 0,
      phase: 'ready',
    };
    refreshZoneOccupants(state);
    const waterBefore = countItem(npc, 'water');
    const eventsBefore = state.events.length;

    advanceTime(state, new SeededRandom('PHASE4O-AF2-NPC-EXTRACTION-TICK-FREEZE-RNG'));

    const terminalEvents = state.events.slice(eventsBefore);
    expect(state.status).toBe('lost');
    expect(state.victory).toMatchObject({ winnerId: npc.id, type: 'extraction' });
    expect(npc.alive).toBe(true);
    expect(npc.hp).toBe(1);
    expect(npc.statusEffects).toEqual([
      expect.objectContaining({ id: 'wild_poison', remaining: 2 }),
    ]);
    expect(countItem(npc, 'extraction_beacon')).toBe(0);
    expect(countItem(npc, 'water')).toBe(waterBefore);
    expect(terminalEvents.map((event) => event.type)).toEqual([
      'EXTRACTION_COMPLETED',
      'VICTORY_DECLARED',
      'GAME_ENDED',
    ]);
    expect(state.events.at(-1)?.type).toBe('GAME_ENDED');
    expect(validateSaveData(saveOf(state)).ok).toBe(true);
  });

  it('does not append player action cleanup after a terminal research command', () => {
    const state = newGame('PHASE4O-AF2-PLAYER-RESEARCH-TICK-FREEZE');
    const p = player(state);
    p.currentZoneId = 'lab';
    p.hp = 1;
    p.statusEffects.push({
      id: 'wild_poison',
      remaining: 2,
      hpPerTick: -2,
      label: '验收玩家致死持续伤害',
    });
    addItem(p, createStack(state, 'research_package', 1));
    refreshZoneOccupants(state);
    const eventsBefore = state.events.length;

    const result = executeCommand(
      state,
      { type: 'SUBMIT_RESEARCH' },
    );

    const terminalEvents = result.state.events.slice(eventsBefore);
    const resultPlayer = player(result.state);
    expect(result.ok).toBe(true);
    expect(result.state.status).toBe('won');
    expect(resultPlayer.alive).toBe(true);
    expect(resultPlayer.hp).toBe(1);
    expect(resultPlayer.statusEffects).toEqual([
      expect.objectContaining({ id: 'wild_poison', remaining: 2 }),
    ]);
    expect(terminalEvents.map((event) => event.type)).toEqual([
      'RESEARCH_COMPLETED',
      'VICTORY_DECLARED',
      'GAME_ENDED',
    ]);
    expect(result.state.events.at(-1)?.type).toBe('GAME_ENDED');
    expect(validateSaveData(saveOf(result.state)).ok).toBe(true);
  });

  it('declares last survivor only after the final NPC contest is resolved', () => {
    const state = newGame('PHASE4O-AF-LAST-SURVIVOR-AFTER-DEATH');
    const [winner, loser] = npcs(state);
    killCharacter(state, player(state), null, '测试淘汰');
    for (const npc of npcs(state).slice(2)) killCharacter(state, npc, winner!.id, '测试清场');
    checkGameEnd(state);
    expect(state.status).toBe('playing');
    expect(state.victory.winnerId).toBeNull();

    killCharacter(state, loser!, winner!.id, '测试最后击杀');
    checkGameEnd(state);
    expect(state.status).toBe('lost');
    expect(state.victory).toMatchObject({ winnerId: winner!.id, type: 'last_survivor' });
  });

  it('keeps an active extraction alive across player elimination', () => {
    const state = newGame('PHASE4O-AF-EXTRACTION-AFTER-DEATH');
    const npc = npcs(state)[0]!;
    npc.victoryGoal = 'extraction';
    npc.currentZoneId = 'station';
    npc.stamina = npc.maxStamina;
    addItem(npc, createStack(state, 'extraction_beacon', 1));
    refreshZoneOccupants(state);
    expect(runNpcTurn(state, npc, new SeededRandom('PHASE4O-AF-EXTRACTION-CALL')).kind)
      .toBe('call_extraction');

    killCharacter(state, player(state), null, '测试淘汰');
    checkGameEnd(state);
    expect(state.status).toBe('playing');
    expect(state.activeExtraction?.callerId).toBe(npc.id);
    state.time = state.activeExtraction!.readyAtTime;
    syncActiveExtraction(state);
    expect(runNpcTurn(state, npc, new SeededRandom('PHASE4O-AF-EXTRACTION-EXTRACT')).kind)
      .toBe('extract');
    expect(state.victory).toMatchObject({ winnerId: npc.id, type: 'extraction' });
  });

  it('accepts current-schema save/load state for dead player plus multiple live NPCs', () => {
    const state = newGame('PHASE4O-AF-SAVE-ELIMINATED');
    killCharacter(state, player(state), null, '测试淘汰');
    checkGameEnd(state);
    expect(state.status).toBe('playing');
    expect(validateSaveData(saveOf(state)).ok).toBe(true);
  });

  it('adopts objective craft goals before the final objective exists', () => {
    const state = newGame('PHASE4O-AF-NPC-GOAL-ADOPTION');
    const researchNpc = npcs(state)[0]!;
    researchNpc.victoryGoal = 'research';
    researchNpc.plannedRecipeId = null;
    expect(chooseNpcGoal(researchNpc)?.recipeId).toBe('r_research_package');
    planNpcGoal(state, researchNpc, new SeededRandom('PHASE4O-AF-NPC-GOAL-RESEARCH'));
    expect(researchNpc.plannedRecipeId).toBe('r_research_package');

    const extractionNpc = npcs(state)[1]!;
    extractionNpc.victoryGoal = 'extraction';
    extractionNpc.plannedRecipeId = null;
    expect(chooseNpcGoal(extractionNpc)?.recipeId).toBe('r_extraction_beacon');
    planNpcGoal(state, extractionNpc, new SeededRandom('PHASE4O-AF-NPC-GOAL-EXTRACTION'));
    expect(extractionNpc.plannedRecipeId).toBe('r_extraction_beacon');
  });

  it('runs an NPC research route from world PvE through pickup, craft and submit', () => {
    const state = newGame('PHASE4O-AF-NPC-OBJ-1');
    const npc = npcs(state)[0]!;
    seedObjectiveRouteWorldFixture(state, npc, 'research');
    npc.currentZoneId = 'lab';
    npc.victoryGoal = 'research';
    npc.victoryGoalMode = 'explicit';
    npc.attack = 100;
    npc.maxHp = 1000;
    npc.hp = 1000;
    npc.maxStamina = 100;
    npc.stamina = 100;

    // World fixture only: raw components are discoverable in zone loot and
    // research notes remain in the public objective loot pool.
    initZoneLoot(state.zones.lab!, [
      { itemId: 'chemical_mix', count: 1, rarity: 'rare' },
      { itemId: 'circuit', count: 1, rarity: 'rare' },
    ]);
    state.zones.lab!.objectiveLoot = [
      { itemId: 'research_notes', count: 2, rarity: 'rare' },
    ];
    state.nextZoneEventTime = 999999;
    for (const contestant of Object.values(state.characters)) {
      if (contestant.id === npc.id || contestant.isPlayer) continue;
      contestant.currentZoneId = 'warehouse';
      contestant.maxHp = 1000;
      contestant.hp = 1000;
      contestant.attack = 0;
      contestant.maxStamina = 100;
      contestant.stamina = 100;
    }
    refreshZoneOccupants(state);

    const initialInventory = npc.inventory.map((stack) => stack.itemId);
    expect(initialInventory).not.toEqual(
      expect.arrayContaining(['bio_resin', 'research_notes', 'anomaly_sample', 'stabilized_sample', 'research_package']),
    );

    const rng = SeededRandom.fromState(state.rngState);
    for (let tick = 0; tick < 90 && state.status === 'playing'; tick += 1) {
      advanceTime(state, rng);
    }

    const npcEvents = state.events.filter((event) => event.actorId === npc.id);
    expect(state.victory).toMatchObject({ winnerId: npc.id, type: 'research' });
    expect(npcEvents.some((event) => event.type === 'SEARCH_STARTED')).toBe(true);
    expect(npcEvents.some((event) => event.type === 'WILD_DEFEATED')).toBe(true);
    expect(npcEvents.some((event) => event.type === 'WILD_DROP_CREATED')).toBe(true);
    expect(npcEvents.some((event) => event.type === 'ITEM_PICKED')).toBe(true);
    expect(npcEvents.filter((event) => event.type === 'ITEM_CRAFTED').length).toBeGreaterThanOrEqual(3);
    expect(npcEvents.some((event) => event.type === 'RESEARCH_COMPLETED')).toBe(true);
  });

  it('runs AutoPlayer research through world PvE, pickup and formal crafting', () => {
    const fixture = newGame('PHASE4O-AF-R-14');
    seedObjectiveRouteWorldFixture(fixture, player(fixture), 'research');
    expect(player(fixture).inventory.map((stack) => stack.itemId)).not.toEqual(
      expect.arrayContaining(['research_notes', 'bio_resin', 'anomaly_sample', 'stabilized_sample', 'research_package']),
    );

    const result = runAutoGame({
      seed: 'PHASE4O-AF-R-14',
      characterId: 'scout',
      policy: 'cautious',
      victoryGoal: 'research',
      representativeBuildLoop: true,
      representativeRecipeId: 'r_research_package',
      keepEventTrace: true,
      maxSteps: 250,
    });
    const playerEvents = result.eventTrace?.filter((event) => event.actorId === 'p0') ?? [];
    expect(result.trustworthy).toBe(true);
    expect(result.winnerId).toBe('p0');
    expect(result.victoryType).toBe('research');
    expect(result.commandCounts.MOVE).toBeGreaterThanOrEqual(1);
    expect(result.commandCounts.SEARCH).toBeGreaterThanOrEqual(1);
    expect(result.commandCounts.ATTACK).toBeGreaterThanOrEqual(1);
    expect(result.commandCounts.PICKUP_GROUND).toBeGreaterThanOrEqual(1);
    expect(result.commandCounts.CRAFT).toBeGreaterThanOrEqual(3);
    expect(result.commandCounts.SUBMIT_RESEARCH).toBe(1);
    expect(result.commandCounts.DEBUG_GIVE_MATERIAL ?? 0).toBe(0);
    expect(playerEvents.some((event) => event.type === 'WILD_DEFEATED')).toBe(true);
    expect(playerEvents.some((event) => event.type === 'WILD_DROP_CREATED')).toBe(true);
    expect(playerEvents.some((event) => event.type === 'ITEM_PICKED')).toBe(true);
    expect(playerEvents.some((event) => event.type === 'RESEARCH_COMPLETED')).toBe(true);
  });

  it('runs AutoPlayer extraction from world raw materials through call and wait', () => {
    const fixture = newGame('PHASE4O-AF-EX-62');
    seedObjectiveRouteWorldFixture(fixture, player(fixture), 'extraction');
    expect(player(fixture).inventory.map((stack) => stack.itemId)).not.toEqual(
      expect.arrayContaining(['battery_pack', 'reinforced_frame', 'extraction_beacon']),
    );

    const result = runAutoGame({
      seed: 'AF3-EX-scout-cautious-14',
      characterId: 'scout',
      policy: 'cautious',
      victoryGoal: 'extraction',
      representativeBuildLoop: true,
      representativeRecipeId: 'r_extraction_beacon',
      maxSteps: 250,
    });
    expect(result.trustworthy).toBe(true);
    expect(result.winnerId).toBe('p0');
    expect(result.victoryType).toBe('extraction');
    expect(result.commandCounts.CRAFT).toBeGreaterThanOrEqual(2);
    expect(result.commandCounts.CALL_EXTRACTION).toBe(1);
    expect(result.commandCounts.EXTRACT).toBe(1);
    expect(result.commandCounts.DEBUG_GIVE_MATERIAL ?? 0).toBe(0);
  });

  it('uses winner-first ranking and keeps the first victory immutable', () => {
    const state = newGame('PHASE4O-AF-RANKING');
    const [winner, aggressive, collector] = npcs(state);
    winner!.kills = 0;
    aggressive!.kills = 10;
    collector!.kills = 5;
    expect(declareVictory(state, winner!.id, 'research')).toBe(true);
    expect(buildFinalRanking(state).slice(0, 3).map((character) => character.id)).toEqual([
      winner!.id,
      aggressive!.id,
      collector!.id,
    ]);
    expect(declareVictory(state, aggressive!.id, 'last_survivor')).toBe(false);
    expect(state.victory).toMatchObject({ winnerId: winner!.id, type: 'research' });
  });

  it('rolls back objective consumption and stamina if the winner latch rejects a submission', () => {
    const state = newGame('PHASE4O-AF-OBJECTIVE-ATOMICITY');
    const p = player(state);
    p.currentZoneId = 'lab';
    p.stamina = p.maxStamina;
    addItem(p, createStack(state, 'research_package', 1));
    state.victory.type = 'research';
    const staminaBefore = p.stamina;
    const result = performObjectiveAction(state, p, 'SUBMIT_RESEARCH');
    expect(result.ok).toBe(false);
    expect(p.stamina).toBe(staminaBefore);
    expect(countItem(p, 'research_package')).toBe(1);
    expect(state.events.some((event) => event.type === 'RESEARCH_COMPLETED')).toBe(false);
  });
});
