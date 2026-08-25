/**
 * Phase 4X — save compatibility / migration closure.
 *
 * The support matrix this file pins down:
 *   SUPPORTED   current-version round trip (state validity + RNG continuity)
 *   SUPPORTED   same-version save missing the optional utility slot
 *   SUPPORTED   same-version save written against the historical six-zone map
 *   UNSUPPORTED any other GAME_VERSION — rejected, never silently reset,
 *               and the user's original bytes stay in storage
 *   REJECTED    malformed / dangling UID / invalid reference saves
 *
 * Everything goes through the single loader in src/core/saveLoad.ts; no test
 * here reimplements loading, validation or migration.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GAME_VERSION, SAVE_KEY } from '../src/data/gameConfig';
import {
  clearSave,
  createMemoryStorage,
  hasAnySave,
  loadGame,
  saveGame,
  setStorage,
  type StorageLike,
} from '../src/core/saveLoad';
import { getPlayer } from '../src/core/gameState';
import { migrateSameVersionSave } from '../src/core/saveMigration';
import { executeCommand } from '../src/core/gameEngine';
import { getLegalPlayerCommands } from '../src/core/legalActions';
import { LEGACY_ZONE_IDS, ZONE_IDS } from '../src/data/zones';
import { npcRoleplaySettings } from '../src/ui/npcLlm/roleplay';
import { AUTO_PLAYER_POLICIES, decideAutoPlayerCommand, runAutoGame } from '../tools/autoPlayer';
import { CHARACTERS } from '../src/data/characters';
import { newGame } from './helpers';
import { SeededRandom } from '../src/core/random';
import type { Command, GameState } from '../src/core/types';

let storage: StorageLike;

beforeEach(() => {
  storage = createMemoryStorage();
  setStorage(storage);
});

afterEach(() => {
  setStorage(null);
  npcRoleplaySettings.reset();
});

/**
 * `executeCommand` is IMMUTABLE: it clones and returns the next state. Every
 * driver must thread `result.state` forward — discarding it silently leaves
 * the fixture at turn 0 and makes the round-trip assertions vacuous.
 *
 * Decisions reuse the shared autoplay brain; the legal set stays the gate, and
 * a stall breaker keeps a repeated non-clock-advancing preference from
 * freezing the fixture at time 0.
 */
function advance(initial: GameState, turns: number, seed = 'P4X'): GameState {
  const rng = new SeededRandom(`${seed}::advance`);
  let state = initial;
  let lastTime = -1;
  let stall = 0;
  for (let index = 0; index < turns * 6 && state.status === 'playing'; index += 1) {
    if (state.time >= turns) break;
    const legal = getLegalPlayerCommands(state);
    if (legal.length === 0) break;
    const advancing = legal.filter((entry) => entry.advancesTime);
    if (state.time === lastTime) stall += 1;
    else { stall = 0; lastTime = state.time; }
    let command: Command;
    if (stall >= 4 && advancing.length > 0) {
      command = advancing[stall % advancing.length]!.command as Command;
    } else {
      const decision = decideAutoPlayerCommand(state, getPlayer(state), 'cautious', rng);
      const matched = decision.command
        ? legal.find((entry) => JSON.stringify(entry.command) === JSON.stringify(decision.command))
        : undefined;
      command = ((matched ?? advancing[0] ?? legal[0]!).command) as Command;
    }
    state = executeCommand(state, command).state;
  }
  return state;
}

/** Drive `steps` commands, returning both the script and the resulting state. */
function driveCapturing(initial: GameState, steps: number, seed: string): { state: GameState; script: Command[] } {
  const rng = new SeededRandom(`${seed}::advance`);
  const script: Command[] = [];
  let state = initial;
  let lastTime = -1;
  let stall = 0;
  for (let index = 0; index < steps && state.status === 'playing'; index += 1) {
    const legal = getLegalPlayerCommands(state);
    if (legal.length === 0) break;
    const advancing = legal.filter((entry) => entry.advancesTime);
    if (state.time === lastTime) stall += 1;
    else { stall = 0; lastTime = state.time; }
    let command: Command;
    if (stall >= 4 && advancing.length > 0) {
      command = advancing[stall % advancing.length]!.command as Command;
    } else {
      const decision = decideAutoPlayerCommand(state, getPlayer(state), 'cautious', rng);
      const matched = decision.command
        ? legal.find((entry) => JSON.stringify(entry.command) === JSON.stringify(decision.command))
        : undefined;
      command = ((matched ?? advancing[0] ?? legal[0]!).command) as Command;
    }
    script.push(command);
    state = executeCommand(state, command).state;
  }
  return { state, script };
}

/** One legal, clock-advancing command for the given state. */
function nextCommand(state: GameState): Command | null {
  const legal = getLegalPlayerCommands(state);
  if (legal.length === 0) return null;
  return ((legal.find((entry) => entry.advancesTime) ?? legal[0]!).command) as Command;
}

function storedSave(): Record<string, unknown> {
  return JSON.parse(storage.getItem(SAVE_KEY)!) as Record<string, unknown>;
}

function writeSave(data: unknown): void {
  storage.setItem(SAVE_KEY, JSON.stringify(data));
}

describe('Phase 4X — save / migration closure', () => {

  /* ---------------------------------------------------------------- */
  /* 1. current version round trip                                     */
  /* ---------------------------------------------------------------- */

  it('X-S1 current version: save → load → validate → continue, with RNG continuity', () => {
    const original = advance(newGame('P4X-S1'), 6, 'P4X-S1');
    // Guard against a vacuous fixture: the round trip must carry real history.
    expect(original.time).toBeGreaterThan(0);
    expect(original.events.length).toBeGreaterThan(1);
    expect(saveGame(original).ok).toBe(true);

    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    // The loaded state is the authoritative state, byte for byte.
    expect(JSON.stringify(loaded.data.state)).toBe(JSON.stringify(original));
    expect(loaded.data.version).toBe(GAME_VERSION);
    expect(loaded.data.rngState).toBe(original.rngState);

    // RNG continuity: the next command off the reloaded save must produce the
    // exact same result as the next command off the live state.
    const next = nextCommand(original)!;
    const liveResult = executeCommand(original, next);
    const reloadedResult = executeCommand(loaded.data.state, next);
    expect(reloadedResult.ok).toBe(liveResult.ok);
    // Identical continuation: same resulting state, same RNG, same trace.
    expect(JSON.stringify(reloadedResult.state)).toBe(JSON.stringify(liveResult.state));
    expect(reloadedResult.state.rngState).toBe(liveResult.state.rngState);
  });

  it('X-S2 a save/load cycle inserted mid-run does not perturb the run at all', () => {
    const driven = driveCapturing(newGame('P4X-S2'), 24, 'P4X-S2');
    const control = driven.state;
    const script = driven.script;
    expect(script.length).toBeGreaterThan(8);
    // Guard against a vacuous fixture.
    expect(control.time).toBeGreaterThan(0);
    expect(control.events.length).toBeGreaterThan(1);
    const through = newGame('P4X-S2');

    // Same script, but round-tripped through storage after every command.
    let current = through;
    for (const command of script) {
      current = executeCommand(current, command).state;
      expect(saveGame(current).ok).toBe(true);
      const reloaded = loadGame();
      expect(reloaded.ok).toBe(true);
      if (!reloaded.ok) return;
      current = reloaded.data.state;
    }
    expect(JSON.stringify(current)).toBe(JSON.stringify(control));
    expect(current.rngState).toBe(control.rngState);
    expect(current.events.length).toBe(control.events.length);
  });

  /* ---------------------------------------------------------------- */
  /* 2-3. supported same-version migrations                            */
  /* ---------------------------------------------------------------- */

  it('X-S3 migratable legacy field: absent equippedUtilityId → empty slot, load succeeds', () => {
    const state = advance(newGame('P4X-S3'), 4, 'P4X-S3');
    expect(saveGame(state).ok).toBe(true);
    const raw = storedSave();
    const characters = (raw.state as Record<string, unknown>).characters as Record<string, Record<string, unknown>>;
    // Simulate a save written before the optional utility slot existed.
    for (const character of Object.values(characters)) {
      delete character.equippedUtilityId;
    }
    writeSave(raw);

    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    for (const character of Object.values(loaded.data.state.characters)) {
      expect(character.equippedUtilityId).toBeNull();
    }
    // And the migrated save is playable through the formal pipeline.
    const command = nextCommand(loaded.data.state);
    expect(command).not.toBeNull();
    const continued = executeCommand(loaded.data.state, command!);
    expect(continued.ok).toBe(true);
    expect(continued.state.time).toBeGreaterThanOrEqual(loaded.data.state.time);
  });

  it('X-S4 migratable legacy map: the exact six-zone table is rebuilt to the full fixed map', () => {
    const state = newGame('P4X-S4');
    expect(saveGame(state).ok).toBe(true);
    const raw = storedSave();
    const zones = (raw.state as Record<string, unknown>).zones as Record<string, unknown>;
    const legacy = new Set<string>(LEGACY_ZONE_IDS);
    for (const zoneId of Object.keys(zones)) {
      if (!legacy.has(zoneId)) delete zones[zoneId];
    }
    expect(Object.keys(zones).length).toBe(LEGACY_ZONE_IDS.length);

    const migrated = migrateSameVersionSave(raw) as Record<string, unknown>;
    const migratedZones = (migrated.state as Record<string, unknown>).zones as Record<string, Record<string, unknown>>;
    // Every current zone exists again, and the rebuilt ones are initialised
    // (not empty shells) so the fixed map is complete.
    for (const zoneId of ZONE_IDS) {
      expect(migratedZones[zoneId]).toBeTruthy();
      expect(migratedZones[zoneId]!.id).toBe(zoneId);
      expect(Array.isArray(migratedZones[zoneId]!.loot)).toBe(true);
    }
  });

  it('X-S4b the zone rebuild refuses to "repair" a partially corrupted zone table', () => {
    const state = newGame('P4X-S4b');
    expect(saveGame(state).ok).toBe(true);
    const raw = storedSave();
    const zones = (raw.state as Record<string, unknown>).zones as Record<string, unknown>;
    // Not the exact historical map — just one zone missing. Rebuilding here
    // would invent a plausible-looking world, so migration must not fire and
    // validation must reject.
    delete zones[ZONE_IDS[0]!];
    const before = Object.keys(zones).length;
    const migrated = migrateSameVersionSave(raw) as Record<string, unknown>;
    expect(Object.keys((migrated.state as Record<string, unknown>).zones as object).length).toBe(before);
    writeSave(raw);
    expect(loadGame().ok).toBe(false);
    expect(hasAnySave()).toBe(true);
  });

  it('X-S5 migration is RNG-neutral: it never advances state.rngState or the next result', () => {
    const state = advance(newGame('P4X-S5'), 5, 'P4X-S5');
    const rngBefore = state.rngState;
    expect(saveGame(state).ok).toBe(true);
    const raw = storedSave();
    for (const character of Object.values((raw.state as Record<string, unknown>).characters as Record<string, Record<string, unknown>>)) {
      delete character.equippedUtilityId;
    }
    writeSave(raw);

    const migratedLoad = loadGame();
    expect(migratedLoad.ok).toBe(true);
    if (!migratedLoad.ok) return;
    expect(migratedLoad.data.state.rngState).toBe(rngBefore);
    // The next command off the migrated save matches the untouched live run.
    const next = nextCommand(state)!;
    const live = executeCommand(state, next).state;
    const afterMigration = executeCommand(migratedLoad.data.state, next).state;
    expect(afterMigration.rngState).toBe(live.rngState);
    expect(JSON.stringify(afterMigration.events)).toBe(JSON.stringify(live.events));
  });

  it('X-S6 a save needing no migration is returned untouched', () => {
    const state = advance(newGame('P4X-S6'), 3, 'P4X-S6');
    expect(saveGame(state).ok).toBe(true);
    const raw = storedSave();
    const before = JSON.stringify(raw);
    expect(JSON.stringify(migrateSameVersionSave(raw))).toBe(before);
  });

  /* ---------------------------------------------------------------- */
  /* 4. unsupported legacy: reject, preserve, never silently reset      */
  /* ---------------------------------------------------------------- */

  it('X-S7 unsupported legacy version: rejected, original bytes preserved, nothing auto-deleted', () => {
    const state = advance(newGame('P4X-S7'), 3, 'P4X-S7');
    expect(saveGame(state).ok).toBe(true);
    const raw = storedSave();
    // A pre-4N save: finite wild population consumption cannot be rebuilt.
    raw.version = '0.4.0';
    writeSave(raw);
    const preserved = storage.getItem(SAVE_KEY)!;

    const loaded = loadGame();
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    // The message must let the player recognise this as an old-version save.
    expect(loaded.error).toContain('0.4.0');
    expect(loaded.error).toContain(GAME_VERSION);
    expect(loaded.error).toContain('版本');
    // Preserved verbatim: no silent reset, no auto-delete.
    expect(storage.getItem(SAVE_KEY)).toBe(preserved);
    expect(hasAnySave()).toBe(true);
    // …and the player can still clear it manually.
    clearSave();
    expect(hasAnySave()).toBe(false);
  });

  it('X-S8 a rejected save is never silently migrated into a playable one', () => {
    const state = newGame('P4X-S8');
    expect(saveGame(state).ok).toBe(true);
    const raw = storedSave();
    raw.version = '0.3.0';
    writeSave(raw);
    expect(loadGame().ok).toBe(false);
    // The stored payload still declares the old version — untouched.
    expect(storedSave().version).toBe('0.3.0');
  });

  /* ---------------------------------------------------------------- */
  /* 5-7. rejection surface                                            */
  /* ---------------------------------------------------------------- */

  it('X-S9 malformed save is rejected without throwing and without deleting', () => {
    storage.setItem(SAVE_KEY, '{ not json at all');
    const loaded = loadGame();
    expect(loaded.ok).toBe(false);
    expect(hasAnySave()).toBe(true);
    expect(() => loadGame()).not.toThrow();
  });

  it('X-S10 dangling equipment UID is rejected', () => {
    const state = advance(newGame('P4X-S10'), 6, 'P4X-S10');
    expect(saveGame(state).ok).toBe(true);
    const raw = storedSave();
    const characters = (raw.state as Record<string, unknown>).characters as Record<string, Record<string, unknown>>;
    // A dangling reference in this schema means an equip slot pointing at a
    // uid that no equipment stack carries.
    const target = Object.values(characters)[0]!;
    target.equippedWeaponId = 'uid-does-not-exist-4x';
    writeSave(raw);
    const loaded = loadGame();
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error).toContain('uid-does-not-exist-4x');
    expect(hasAnySave()).toBe(true);
  });

  it('X-S11 invalid zone / character / encounter references are rejected', () => {
    const base = advance(newGame('P4X-S11'), 3, 'P4X-S11');

    // (a) invalid zone reference
    expect(saveGame(base).ok).toBe(true);
    const zoneBroken = storedSave();
    ((zoneBroken.state as Record<string, unknown>).characters as Record<string, Record<string, unknown>>)[
      (zoneBroken.state as Record<string, unknown>).playerId as string
    ]!.currentZoneId = 'no-such-zone-4x';
    writeSave(zoneBroken);
    expect(loadGame().ok).toBe(false);

    // (b) invalid character reference in turn order
    expect(saveGame(base).ok).toBe(true);
    const charBroken = storedSave();
    ((charBroken.state as Record<string, unknown>).turnOrder as string[]).push('no-such-character-4x');
    writeSave(charBroken);
    expect(loadGame().ok).toBe(false);

    // (c) invalid encounter reference
    expect(saveGame(base).ok).toBe(true);
    const encounterBroken = storedSave();
    (encounterBroken.state as Record<string, unknown>).encounter = {
      enemyId: 'no-such-enemy-4x',
      zoneId: 'no-such-zone-4x',
      startedAtTime: 0,
      log: [],
      resolved: false,
    };
    writeSave(encounterBroken);
    expect(loadGame().ok).toBe(false);
  });

  /* ---------------------------------------------------------------- */
  /* 8. terminal save                                                  */
  /* ---------------------------------------------------------------- */

  it('X-S12 a terminal game survives save/load and stays frozen', () => {
    // Reuse the existing autoplay harness rather than a second driver: it
    // reaches a terminal state purely through executeCommand.
    const run = runAutoGame({ seed: 'P4X-S12', characterId: 'scout', policy: 'cautious', keepFinalState: true });
    const state = run.finalState!;
    expect(state).toBeTruthy();
    expect(state.status).not.toBe('playing');
    expect(state.time).toBeGreaterThan(0);

    expect(saveGame(state).ok).toBe(true);
    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.data.state.status).toBe(state.status);

    // Terminal freeze still holds after a round trip: further commands are
    // refused and the authoritative state does not move.
    const frozen = JSON.stringify(loaded.data.state);
    for (const command of [{ type: 'SEARCH' }, { type: 'REST' }, { type: 'GUARD' }, { type: 'ATTACK_NEARBY' }] as Command[]) {
      const executed = executeCommand(loaded.data.state, command);
      expect(executed.ok).toBe(false);
      expect(JSON.stringify(executed.state)).toBe(frozen);
    }
    expect(JSON.stringify(loaded.data.state)).toBe(frozen);
  });

  /* ---------------------------------------------------------------- */
  /* 8b. Phase 4X blockers: engine-produced states must stay saveable   */
  /* ---------------------------------------------------------------- */

  it('X-S14 every terminal state the engine produces passes its own save validation', () => {
    // Regression for two real Phase 4X blockers that made late-game saves
    // unloadable:
    //   (a) a dead actor kept planRecommendedLandmarkId while its
    //       planRecommendedZoneId was nulled, breaking the plan-pair invariant;
    //   (b) the "exhausted implies empty" landmark invariant contradicted
    //       finite-item conservation, which requires an exhausted landmark to
    //       keep unrecovered stacks.
    let checked = 0;
    for (let index = 0; index < 24; index += 1) {
      const character = CHARACTERS[index % CHARACTERS.length]!.id;
      const policy = AUTO_PLAYER_POLICIES[index % AUTO_PLAYER_POLICIES.length]!;
      const run = runAutoGame({ seed: `P4X-S14-${index}`, characterId: character, policy, keepFinalState: true });
      const finalState = run.finalState;
      if (!finalState) continue;
      expect(finalState.status).not.toBe('playing');
      // At least one contestant is dead in a terminal match — that is the
      // condition that used to corrupt the save.
      expect(saveGame(finalState).ok).toBe(true);
      const loaded = loadGame();
      if (!loaded.ok) {
        throw new Error(`terminal save rejected (seed P4X-S14-${index}): ${loaded.error}`);
      }
      expect(loaded.data.state.status).toBe(finalState.status);
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(20);
  });

  it('X-S15 a dead actor carries no dangling plan recommendation', () => {
    const run = runAutoGame({ seed: 'P4X-S15', characterId: 'fighter', policy: 'aggressive', keepFinalState: true });
    const finalState = run.finalState!;
    const dead = Object.values(finalState.characters).filter((character) => !character.alive);
    expect(dead.length).toBeGreaterThan(0);
    for (const character of dead) {
      expect(character.planRecommendedLandmarkId).toBeNull();
      expect(character.planRecommendedZoneId).toBeNull();
      expect(character.explorationObjective).toBeNull();
    }
  });

  it('X-S16 an exhausted landmark may still hold unrecovered stacks (conservation)', () => {
    // The relaxed invariant: exhausted constrains the search budget only.
    const state = newGame('P4X-S16');
    const landmarkId = Object.keys(state.landmarks)[0]!;
    const runtime = state.landmarks[landmarkId]!;
    runtime.exhausted = true;
    runtime.remainingSearches = 0;
    // Leftover stacks are legal and must NOT fail validation.
    expect(saveGame(state).ok).toBe(true);
    expect(loadGame().ok).toBe(true);
    // …but a non-zero search budget on an exhausted landmark is still corrupt.
    runtime.remainingSearches = 1;
    expect(saveGame(state).ok).toBe(true);
    const broken = loadGame();
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.error).toContain('exhausted');
  });

  /* ---------------------------------------------------------------- */
  /* 9. LLM config / API key must never enter a save                   */
  /* ---------------------------------------------------------------- */

  it('X-S13 LLM roleplay config and API key never reach the save payload', () => {
    npcRoleplaySettings.set({
      enabled: true,
      endpoint: 'https://llm.example.test/v1',
      model: 'secret-model-4x',
      apiKey: 'sk-PHASE4X-MUST-NOT-PERSIST',
    });
    const state = advance(newGame('P4X-S13'), 5, 'P4X-S13');
    expect(saveGame(state).ok).toBe(true);
    const blob = storage.getItem(SAVE_KEY)!;
    for (const secret of ['sk-PHASE4X-MUST-NOT-PERSIST', 'secret-model-4x', 'llm.example.test', 'apiKey', 'npcRoleplay']) {
      expect(blob).not.toContain(secret);
    }
    // Events carry nothing either.
    expect(JSON.stringify(state.events)).not.toContain('sk-PHASE4X');
    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(JSON.stringify(loaded.data)).not.toContain('sk-PHASE4X');
  });
});
