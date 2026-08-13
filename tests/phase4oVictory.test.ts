import { describe, expect, it } from 'vitest';
import { executeCommand } from '../src/core/gameEngine';
import { getLegalPlayerCommands } from '../src/core/legalActions';
import { performCraft } from '../src/core/crafting';
import { refreshZoneOccupants } from '../src/core/gameState';
import { runNpcTurn } from '../src/core/npcAi';
import { SeededRandom } from '../src/core/random';
import { syncActiveExtraction } from '../src/core/victory';
import { countItem, addItem, createStack } from '../src/core/inventory';
import { validateSaveData } from '../src/core/saveLoad';
import { getRecipeDepth, getRecipe } from '../src/data/recipes';
import { EXTRACTION_DELAY, VICTORY_CONDITIONS } from '../src/data/victoryConditions';
import { ITEMS } from '../src/data/items';
import { PHASE4O_RESEARCH_RAW_IDS } from '../src/data/phase4oItems';
import { ZONES } from '../src/data/zones';
import { newGame, give, player, npcs } from './helpers';

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

function placeAt(state: ReturnType<typeof newGame>, zoneId: string): void {
  player(state).currentZoneId = zoneId;
  refreshZoneOccupants(state);
}

describe('Phase 4O unified victory framework', () => {
  it('registers exactly three routes and a deep research chain', () => {
    expect(VICTORY_CONDITIONS.map((route) => route.type)).toEqual([
      'last_survivor',
      'extraction',
      'research',
    ]);
    expect(getRecipeDepth('r_research_package')).toBeGreaterThanOrEqual(3);
    expect(getRecipe('r_research_package')?.ingredients.map((entry) => entry.itemId)).toEqual([
      'stabilized_sample',
      'research_notes',
      'circuit',
    ]);
    expect(PHASE4O_RESEARCH_RAW_IDS).toEqual(['research_notes']);
    expect(ZONES.filter((zone) => zone.objectivePool?.includes('research_notes')).map((zone) => zone.id))
      .toEqual(['hospital', 'lab']);
    expect(ITEMS.filter((item) => item.category === 'objective').map((item) => item.id))
      .toEqual(['extraction_beacon', 'research_package']);
  });

  it('uses the extraction chain, keeps the beacon through the public delay, then consumes exactly one', () => {
    const state = newGame('PHASE4O-EXTRACTION-CHAIN');
    const p = player(state);
    p.stamina = p.maxStamina;
    give(state, p, 'battery_pack');
    give(state, p, 'reinforced_frame');
    expect(performCraft(state, p, 'r_extraction_beacon').ok).toBe(true);
    expect(countItem(p, 'extraction_beacon')).toBe(1);
    placeAt(state, 'station');

    const called = executeCommand(state, { type: 'CALL_EXTRACTION' });
    expect(called.ok).toBe(true);
    expect(called.state.activeExtraction?.phase).toBe('called');
    expect(countItem(player(called.state), 'extraction_beacon')).toBe(1);
    expect(called.state.victory.winnerId).toBeNull();
    expect(called.state.events.some((event) => event.type === 'EXTRACTION_CALLED')).toBe(true);

    const readyState = called.state;
    readyState.time = readyState.activeExtraction!.readyAtTime;
    syncActiveExtraction(readyState);
    expect(readyState.activeExtraction?.phase).toBe('ready');
    expect(readyState.status).toBe('playing');
    expect(readyState.events.some((event) => event.type === 'EXTRACTION_READY')).toBe(true);

    const extracted = executeCommand(readyState, { type: 'EXTRACT' });
    expect(extracted.ok).toBe(true);
    expect(extracted.state.status).toBe('won');
    expect(extracted.state.endReason).toBe('extraction');
    expect(extracted.state.victory).toMatchObject({ winnerId: extracted.state.playerId, type: 'extraction' });
    expect(countItem(player(extracted.state), 'extraction_beacon')).toBe(0);
    expect(extracted.state.events.some((event) => event.type === 'EXTRACTION_COMPLETED')).toBe(true);
  });

  it('cancels an extraction call when the caller leaves before the window is ready', () => {
    const state = newGame('PHASE4O-EXTRACTION-CANCEL');
    const p = player(state);
    p.stamina = p.maxStamina;
    give(state, p, 'extraction_beacon');
    placeAt(state, 'station');
    const called = executeCommand(state, { type: 'CALL_EXTRACTION' });
    expect(called.ok).toBe(true);
    const moved = called.state;
    placeAt(moved, 'lab');
    const cancelled = executeCommand(moved, { type: 'REST' });
    expect(cancelled.state.activeExtraction).toBeNull();
    expect(cancelled.state.events.some((event) => event.type === 'EXTRACTION_CANCELLED')).toBe(true);
    expect(cancelled.state.victory.winnerId).toBeNull();
  });

  it('submits a multi-step research package and records a route-specific victory', () => {
    const state = newGame('PHASE4O-RESEARCH-CHAIN');
    const p = player(state);
    p.stamina = p.maxStamina;
    give(state, p, 'bio_resin');
    give(state, p, 'research_notes', 2);
    give(state, p, 'chemical_mix');
    give(state, p, 'circuit');
    expect(performCraft(state, p, 'r_anomaly_sample').ok).toBe(true);
    expect(performCraft(state, p, 'r_stabilized_sample').ok).toBe(true);
    expect(performCraft(state, p, 'r_research_package').ok).toBe(true);
    expect(countItem(p, 'research_package')).toBe(1);
    placeAt(state, 'lab');

    const submitted = executeCommand(state, { type: 'SUBMIT_RESEARCH' });
    expect(submitted.ok).toBe(true);
    expect(submitted.state.status).toBe('won');
    expect(submitted.state.endReason).toBe('research');
    expect(submitted.state.victory.type).toBe('research');
    expect(countItem(player(submitted.state), 'research_package')).toBe(0);
    expect(submitted.state.events.some((event) => event.type === 'RESEARCH_COMPLETED')).toBe(true);
  });

  it('lets an eligible NPC win an alternative route while the player is still alive', () => {
    const state = newGame('PHASE4O-NPC-RESEARCH');
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'lab';
    npc.stamina = npc.maxStamina;
    addItem(npc, createStack(state, 'research_package', 1));
    refreshZoneOccupants(state);

    const decision = runNpcTurn(state, npc, new SeededRandom('PHASE4O-NPC-RESEARCH-RNG'));
    expect(decision.kind).toBe('submit_research');
    expect(state.status).toBe('lost');
    expect(state.playerId in state.characters).toBe(true);
    expect(player(state).alive).toBe(true);
    expect(state.victory).toMatchObject({ winnerId: npc.id, type: 'research' });
    expect(state.endReason).toBe('research');
  });

  it('lets an NPC complete the deterministic extraction call/wait/extract loop', () => {
    const state = newGame('PHASE4O-NPC-EXTRACTION');
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'station';
    npc.victoryGoal = 'extraction';
    npc.stamina = npc.maxStamina;
    addItem(npc, createStack(state, 'extraction_beacon', 1));
    refreshZoneOccupants(state);

    const called = runNpcTurn(state, npc, new SeededRandom('PHASE4O-NPC-EXTRACTION-CALL'));
    expect(called.kind).toBe('call_extraction');
    expect(state.activeExtraction?.callerId).toBe(npc.id);
    state.time = state.activeExtraction!.readyAtTime;
    syncActiveExtraction(state);
    const extracted = runNpcTurn(state, npc, new SeededRandom('PHASE4O-NPC-EXTRACTION-EXTRACT'));
    expect(extracted.kind).toBe('extract');
    expect(state.status).toBe('lost');
    expect(state.victory).toMatchObject({ winnerId: npc.id, type: 'extraction' });
    expect(player(state).alive).toBe(true);
  });

  it('keeps legalActions and execution aligned, including positive stamina gates', () => {
    const state = newGame('PHASE4O-LEGAL');
    const p = player(state);
    give(state, p, 'extraction_beacon');
    placeAt(state, 'station');
    p.stamina = 0;
    expect(getLegalPlayerCommands(state).some((action) => action.command.type === 'CALL_EXTRACTION')).toBe(false);
    const rejected = executeCommand(state, { type: 'CALL_EXTRACTION' });
    expect(rejected.ok).toBe(false);
    expect(rejected.state.time).toBe(state.time);
    expect(EXTRACTION_DELAY).toBeGreaterThan(0);
  });

  it('rejects corrupted victory and active extraction saves', () => {
    const state = newGame('PHASE4O-SAVE');
    const invalidWinner = saveOf(state) as any;
    invalidWinner.state.victory.winnerId = 'wild-ghost';
    invalidWinner.state.victory.type = 'research';
    invalidWinner.state.victory.declaredAtTime = 0;
    expect(validateSaveData(invalidWinner).ok).toBe(false);

    const invalidExtraction = saveOf(state) as any;
    invalidExtraction.state.activeExtraction = {
      callerId: state.playerId,
      zoneId: 'lab',
      startedAtTime: 1,
      readyAtTime: 2,
      phase: 'ready',
    };
    expect(validateSaveData(invalidExtraction).ok).toBe(false);
  });
});
