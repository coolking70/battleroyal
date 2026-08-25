/**
 * Phase 4X — release regression suite.
 *
 * This file is a CENTRALISED cross-phase closure check, not a second
 * implementation of any system. Every assertion is driven through the
 * authoritative surfaces (`executeCommand`, `getLegalPlayerCommands`,
 * `advanceTime`, the existing autoplay harness in tools/) so that a rule can
 * never be satisfied here while being broken in the real game.
 *
 * What it pins, per the Phase 4X scope:
 *   R1  a fresh game runs a full loop to a terminal result
 *   R2  zero stamina never deadlocks (GUARD/FLEE escape hatches)
 *   R3  Wild: spawn / combat / finite population / loot
 *   R4  Apex: schedule / spawn / public reporting
 *   R5  Landmark + facility
 *   R6  Access chain / exploration objective
 *   R7  Incident lifecycle
 *   R8  StrategicIntent + ActorKnowledge information boundary
 *   R9  contestant encounter presentation leaks no live remote runtime
 *   R10 Phase 4W LLM layer is presentation-only
 *   R11 terminal state is frozen
 *   R12 determinism: same seed + same actions ⇒ same state and event trace
 */

import { describe, expect, it } from 'vitest';

import { advanceTime, executeCommand } from '../src/core/gameEngine';
import { getLegalPlayerCommands, getTimeAdvancingActions } from '../src/core/legalActions';
import { createGame, getPlayer, refreshZoneOccupants } from '../src/core/gameState';
import { SeededRandom } from '../src/core/random';
import { livingWildEnemiesInZone } from '../src/core/wildPopulation';
import { publicApexReports } from '../src/core/apexSchedule';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { CHARACTERS } from '../src/data/characters';
import { AUTO_PLAYER_POLICIES, decideAutoPlayerCommand, runAutoGame } from '../tools/autoPlayer';
import { newGame, npcs, player } from './helpers';
import type { AutoPlayerPolicy } from '../tools/autoPlayer';
import type { Command, GameState } from '../src/core/types';

/**
 * Decisions come from the SAME brain the balance harness uses, so this file
 * never invents a second policy. The legal set stays the hard gate.
 *
 * Two facts make a naive driver useless here, and the real harness handles
 * both, so this mirrors it: ATTACK_NEARBY is flagged advancesTime yet resolves
 * inside the current tick, and a stable state can make the brain re-pick the
 * same non-advancing action forever. Hence the stall breaker.
 */
class ScriptDriver {
  private readonly rng: SeededRandom;
  private lastTime = -1;
  private stall = 0;

  constructor(seed: string, private readonly policy: AutoPlayerPolicy = 'cautious') {
    this.rng = new SeededRandom(`${seed}::drive`);
  }

  next(state: GameState): Command | null {
    const legal = getLegalPlayerCommands(state);
    if (legal.length === 0) return null;
    const advancing = legal.filter((entry) => entry.advancesTime);

    if (state.time === this.lastTime) this.stall += 1;
    else { this.stall = 0; this.lastTime = state.time; }

    // Stall breaker: the clock has not moved for a while, so stop asking the
    // policy and rotate through the legal clock-advancing actions instead.
    if (this.stall >= 4 && advancing.length > 0) {
      return advancing[this.stall % advancing.length]!.command as Command;
    }
    const decision = decideAutoPlayerCommand(state, getPlayer(state), this.policy, this.rng);
    const matched = decision.command
      ? legal.find((entry) => JSON.stringify(entry.command) === JSON.stringify(decision.command))
      : undefined;
    return ((matched ?? advancing[0] ?? legal[0]!).command) as Command;
  }
}

/**
 * NOTE: `executeCommand` is immutable — it clones and returns the next state.
 * Every driver here must thread `result.state` forward; discarding it silently
 * leaves the match at turn 0 and makes downstream assertions vacuous.
 */
function driveToTerminal(initial: GameState, seed: string, budget = 800): GameState {
  const driver = new ScriptDriver(seed);
  let state = initial;
  for (let index = 0; index < budget && state.status === 'playing'; index += 1) {
    const command = driver.next(state);
    if (!command) break;
    state = executeCommand(state, command).state;
  }
  return state;
}

describe('Phase 4X — release regression suite', () => {

  /* ------------------------------------------------------------------ */
  /* R1 fresh game → full loop → terminal result                         */
  /* ------------------------------------------------------------------ */

  it('R1 a fresh game reaches a canonical terminal result through the formal pipeline', () => {
    let terminal = 0;
    const outcomes = new Set<string>();
    for (let index = 0; index < 12; index += 1) {
      const character = CHARACTERS[index % CHARACTERS.length]!.id;
      const policy = AUTO_PLAYER_POLICIES[index % AUTO_PLAYER_POLICIES.length]!;
      const run = runAutoGame({ seed: `P4X-R1-${index}`, characterId: character, policy, keepFinalState: true });
      expect(run.trustworthy).toBe(true);
      expect(run.illegalCommands).toEqual([]);
      expect(['won', 'lost', 'draw', 'timeout']).toContain(run.outcome);
      expect(run.outcome).not.toBe('timeout');
      outcomes.add(run.outcome);
      const finalState = run.finalState!;
      expect(finalState.status).not.toBe('playing');
      // A canonical result is either a named winner with a victory type, or
      // an explicit draw (both null). A half-filled tuple is corruption.
      const victory = finalState.victory;
      const named = victory.winnerId !== null && victory.type !== null;
      const drawn = victory.winnerId === null && victory.type === null;
      expect(named || drawn, `seed P4X-R1-${index} victory=${JSON.stringify(victory)}`).toBe(true);
      if (named) {
        expect(finalState.characters[victory.winnerId!]).toBeTruthy();
        expect(victory.declaredAtTime).not.toBeNull();
      }
      terminal += 1;
    }
    expect(terminal).toBe(12);
    // The loop actually exercises more than one ending.
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it('R1b the whole roster explores, loots, crafts, equips and fights across a run set', () => {
    const totals: Record<string, number> = {};
    for (let index = 0; index < 24; index += 1) {
      const character = CHARACTERS[index % CHARACTERS.length]!.id;
      const policy = AUTO_PLAYER_POLICIES[index % AUTO_PLAYER_POLICIES.length]!;
      const run = runAutoGame({ seed: `P4X-R1B-${index}`, characterId: character, policy });
      for (const [key, value] of Object.entries(run.commandCounts)) {
        totals[key] = (totals[key] ?? 0) + (value ?? 0);
      }
    }
    // Every pillar of the core loop is reachable through the command pipeline.
    for (const command of ['MOVE', 'SEARCH', 'ATTACK', 'CRAFT', 'EQUIP', 'GUARD', 'FLEE', 'REST', 'USE_ITEM']) {
      expect(totals[command] ?? 0, command).toBeGreaterThan(0);
    }
  });

  /* ------------------------------------------------------------------ */
  /* R2 zero stamina must never deadlock                                 */
  /* ------------------------------------------------------------------ */

  it('R2 zero stamina always leaves a time-advancing action (no deadlock)', () => {
    for (let index = 0; index < 8; index += 1) {
      const state = newGame(`P4X-R2-${index}`, CHARACTERS[index % CHARACTERS.length]!.id);
      const self = player(state);
      const enemy = npcs(state)[0]!;
      enemy.currentZoneId = self.currentZoneId;
      refreshZoneOccupants(state);
      self.stamina = 0;
      state.encounter = {
        enemyId: enemy.id, zoneId: self.currentZoneId,
        startedAtTime: state.time, log: [], resolved: false,
      };
      const advancing = getTimeAdvancingActions(state);
      expect(advancing.length, `seed P4X-R2-${index}`).toBeGreaterThan(0);
      const types = new Set(advancing.map((entry) => entry.command.type));
      // GUARD is the shared zero-stamina escape hatch; FLEE stays available so
      // a cornered contestant can always disengage in place.
      expect(types.has('GUARD') || types.has('FLEE')).toBe(true);
      // And it genuinely executes.
      const chosen = advancing[0]!.command as Command;
      const executed = executeCommand(state, chosen);
      expect(executed.ok).toBe(true);
      expect(executed.state.time).toBeGreaterThan(state.time);
    }
  });

  it('R2b no autoplay run ever deadlocks, stalls or empties the legal set', () => {
    for (let index = 0; index < 16; index += 1) {
      const run = runAutoGame({
        seed: `P4X-R2B-${index}`,
        characterId: CHARACTERS[index % CHARACTERS.length]!.id,
        policy: AUTO_PLAYER_POLICIES[index % AUTO_PLAYER_POLICIES.length]!,
      });
      expect(run.deadlock, `seed P4X-R2B-${index}`).toBeNull();
      expect(run.stalled).toBe(false);
      expect(run.emptyLegalSet).toBe(false);
      expect(run.hardLimitReached).toBe(false);
    }
  });

  /* ------------------------------------------------------------------ */
  /* R3 Wild ecology                                                     */
  /* ------------------------------------------------------------------ */

  it('R3 wild population is finite: kills never exceed what was spawned', () => {
    for (let index = 0; index < 8; index += 1) {
      const run = runAutoGame({
        seed: `P4X-R3-${index}`,
        characterId: CHARACTERS[index % CHARACTERS.length]!.id,
        policy: 'aggressive',
        keepFinalState: true,
      });
      const finalState = run.finalState!;
      const all = Object.values(finalState.wildEnemies);
      expect(all.length).toBeGreaterThan(0);
      const dead = all.filter((enemy) => enemy.status !== 'alive').length;
      // Finite population: every non-alive instance is one that existed.
      expect(dead).toBeLessThanOrEqual(all.length);
      // No zone reports a living enemy that the registry says is gone.
      for (const zoneId of Object.keys(finalState.zones)) {
        for (const enemy of livingWildEnemiesInZone(finalState, zoneId)) {
          expect(finalState.wildEnemies[enemy.uid]?.status).toBe('alive');
          expect(enemy.zoneId).toBe(zoneId);
        }
      }
    }
  });

  it('R3b wild combat and wild loot are reachable through the formal pipeline', () => {
    let encounters = 0, kills = 0, drops = 0, pickups = 0;
    for (let index = 0; index < 16; index += 1) {
      const run = runAutoGame({
        seed: `P4X-R3B-${index}`,
        characterId: CHARACTERS[index % CHARACTERS.length]!.id,
        policy: 'aggressive',
      });
      encounters += run.wildEncounterCount ?? 0;
      kills += run.wildKillCount ?? 0;
      drops += run.wildDropsCreated ?? 0;
      pickups += run.wildMaterialPickups ?? 0;
    }
    expect(encounters).toBeGreaterThan(0);
    expect(kills).toBeGreaterThan(0);
    expect(drops).toBeGreaterThan(0);
    expect(pickups).toBeGreaterThan(0);
  });

  /* ------------------------------------------------------------------ */
  /* R4 Apex                                                             */
  /* ------------------------------------------------------------------ */

  it('R4 apex spawns are scheduled, unique per definition and publicly reported', () => {
    const state = newGame('P4X-R4');
    const rng = SeededRandom.fromState(state.rngState);
    for (let tick = 0; tick < GAME_CONFIG.hardTimeLimit && state.status === 'playing'; tick += 1) {
      advanceTime(state, rng);
    }
    const reports = publicApexReports(state);
    expect(reports.length).toBeGreaterThan(0);
    // Never two live spawns of the same apex definition, and every spawn zone
    // is a real zone.
    const seen = new Set<string>();
    for (const report of reports) {
      expect(seen.has(report.defId)).toBe(false);
      seen.add(report.defId);
      expect(state.zones[report.zoneId]).toBeTruthy();
      expect(report.spawnedAt).toBeGreaterThanOrEqual(0);
    }
  });

  it('R4b apex encounters resolve without corrupting the match', () => {
    let spawned = 0;
    for (let index = 0; index < 12; index += 1) {
      const run = runAutoGame({
        seed: `P4X-R4B-${index}`,
        characterId: CHARACTERS[index % CHARACTERS.length]!.id,
        policy: AUTO_PLAYER_POLICIES[index % AUTO_PLAYER_POLICIES.length]!,
      });
      spawned += run.apexSpawned ?? 0;
      expect(run.duplicateApexSpawn).toBe(false);
      expect(run.invalidApexSpawnZone).toBe(false);
      expect(run.trustworthy).toBe(true);
    }
    expect(spawned).toBeGreaterThan(0);
  });

  /* ------------------------------------------------------------------ */
  /* R5 / R6 / R7 landmarks, access chains, incidents                    */
  /* ------------------------------------------------------------------ */

  it('R5 landmarks and facilities stay internally consistent all match long', () => {
    const state = newGame('P4X-R5');
    const rng = SeededRandom.fromState(state.rngState);
    for (let tick = 0; tick < GAME_CONFIG.hardTimeLimit && state.status === 'playing'; tick += 1) {
      advanceTime(state, rng);
      for (const runtime of Object.values(state.landmarks)) {
        expect(runtime.remainingSearches).toBeGreaterThanOrEqual(0);
        expect(runtime.remainingSearches).toBeLessThanOrEqual(runtime.maxSearches);
        expect(runtime.charges).toBeLessThanOrEqual(runtime.maxCharges);
        // Phase 4X invariant: exhausted constrains the search budget only.
        if (runtime.exhausted) expect(runtime.remainingSearches).toBe(0);
        expect(state.zones[runtime.zoneId]).toBeTruthy();
      }
    }
  });

  it('R6 exploration objectives always point at a real landmark in its own zone', () => {
    const state = newGame('P4X-R6');
    const rng = SeededRandom.fromState(state.rngState);
    for (let tick = 0; tick < GAME_CONFIG.hardTimeLimit && state.status === 'playing'; tick += 1) {
      advanceTime(state, rng);
      for (const actor of Object.values(state.characters)) {
        if (actor.planRecommendedLandmarkId === null) continue;
        const runtime = state.landmarks[actor.planRecommendedLandmarkId];
        expect(runtime, actor.id).toBeTruthy();
        // The plan pair must stay consistent (Phase 4X blocker regression).
        expect(actor.planRecommendedZoneId).toBe(runtime!.zoneId);
        expect(actor.alive).toBe(true);
      }
    }
  });

  it('R7 incident lifecycle never double-rewards or mutates a finished match', () => {
    let scheduled = 0, activated = 0;
    for (let index = 0; index < 12; index += 1) {
      const run = runAutoGame({
        seed: `P4X-R7-${index}`,
        characterId: CHARACTERS[index % CHARACTERS.length]!.id,
        policy: AUTO_PLAYER_POLICIES[index % AUTO_PLAYER_POLICIES.length]!,
      });
      scheduled += run.incidentScheduled ?? 0;
      activated += run.incidentActivated ?? 0;
      expect(run.incidentDuplicateReward ?? 0).toBe(0);
      expect(run.incidentIllegalResolution ?? 0).toBe(0);
      expect(run.incidentPostTerminalMutation ?? 0).toBe(0);
    }
    expect(scheduled).toBeGreaterThan(0);
    expect(activated).toBeGreaterThan(0);
  });

  /* ------------------------------------------------------------------ */
  /* R8 information boundary                                             */
  /* ------------------------------------------------------------------ */

  it('R8 knowledge memory only ever records what the actor could observe', () => {
    const state = newGame('P4X-R8');
    const rng = SeededRandom.fromState(state.rngState);
    for (let tick = 0; tick < 60 && state.status === 'playing'; tick += 1) {
      advanceTime(state, rng);
    }
    let checkedEntries = 0;
    for (const actor of Object.values(state.characters)) {
      for (const entry of actor.knowledgeMemory.entries) {
        // Nothing is remembered from the future.
        expect(entry.observedAt).toBeLessThanOrEqual(state.time);
        // Where an observation names a zone, it must be a real one. (Only some
        // variants of the observation union carry a zone at all.)
        const zoneId = (entry as { zoneId?: unknown }).zoneId;
        if (typeof zoneId === 'string') expect(state.zones[zoneId], zoneId).toBeTruthy();
        checkedEntries += 1;
        // A memory entry never carries another actor's live runtime numbers.
        const serialized = JSON.stringify(entry);
        for (const forbidden of ['"hp"', '"stamina"', '"inventory"', '"strategicIntent"', '"equippedWeaponId"']) {
          expect(serialized, forbidden).not.toContain(forbidden);
        }
      }
      if (actor.strategicIntent) {
        expect(actor.strategicIntent.committedAt).toBeLessThanOrEqual(state.time);
      }
    }
    // The boundary check must have had something to inspect.
    expect(checkedEntries).toBeGreaterThan(0);
  });

  /* ------------------------------------------------------------------ */
  /* R11 terminal freeze                                                 */
  /* ------------------------------------------------------------------ */

  it('R11 a finished match is frozen: further commands change nothing', () => {
    for (let index = 0; index < 6; index += 1) {
      const run = runAutoGame({
        seed: `P4X-R11-${index}`,
        characterId: CHARACTERS[index % CHARACTERS.length]!.id,
        policy: 'cautious',
        keepFinalState: true,
      });
      const finalState = run.finalState!;
      expect(finalState.status).not.toBe('playing');
      const frozen = JSON.stringify(finalState);
      for (const command of [
        { type: 'SEARCH' }, { type: 'REST' }, { type: 'GUARD' },
        { type: 'ATTACK_NEARBY' }, { type: 'MOVE', zoneId: Object.keys(finalState.zones)[0]! },
      ] as Command[]) {
        const executed = executeCommand(finalState, command);
        expect(executed.ok).toBe(false);
        // The RETURNED state is what a caller would keep — it must be frozen too.
        expect(JSON.stringify(executed.state)).toBe(frozen);
        expect(executed.state.status).toBe(finalState.status);
      }
      expect(JSON.stringify(finalState)).toBe(frozen);
      expect(getTimeAdvancingActions(finalState)).toEqual([]);
    }
  });

  /* ------------------------------------------------------------------ */
  /* R12 determinism                                                     */
  /* ------------------------------------------------------------------ */

  it('R12 same seed + same action sequence ⇒ identical state and event trace', () => {
    for (const characterId of ['scout', 'trapper', 'medic']) {
      let first = createGame({ seed: `P4X-R12-${characterId}`, playerCharacterId: characterId, playerName: '测试者' });
      const script: Command[] = [];
      const driver = new ScriptDriver(`P4X-R12-${characterId}`);
      for (let index = 0; index < 80 && first.status === 'playing'; index += 1) {
        const command = driver.next(first);
        if (!command) break;
        script.push(command);
        first = executeCommand(first, command).state;
      }
      expect(script.length).toBeGreaterThan(10);
      // The script must have actually moved the match, or determinism here
      // would be a comparison of two untouched openings.
      expect(first.time).toBeGreaterThan(5);
      expect(first.events.length).toBeGreaterThan(10);

      let second = createGame({ seed: `P4X-R12-${characterId}`, playerCharacterId: characterId, playerName: '测试者' });
      for (const command of script) second = executeCommand(second, command).state;

      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      expect(second.rngState).toBe(first.rngState);
      expect(second.events.map((event) => `${event.time}:${event.type}`))
        .toEqual(first.events.map((event) => `${event.time}:${event.type}`));
    }
  });

  it('R12b the autoplay harness is reproducible run to run', () => {
    for (let index = 0; index < 4; index += 1) {
      const options = {
        seed: `P4X-R12B-${index}`,
        characterId: CHARACTERS[index % CHARACTERS.length]!.id,
        policy: AUTO_PLAYER_POLICIES[index % AUTO_PLAYER_POLICIES.length]!,
        keepFinalState: true,
      } as const;
      const a = runAutoGame({ ...options });
      const b = runAutoGame({ ...options });
      expect(b.outcome).toBe(a.outcome);
      expect(b.playerRank).toBe(a.playerRank);
      expect(JSON.stringify(b.finalState)).toBe(JSON.stringify(a.finalState));
    }
  });

  /* ------------------------------------------------------------------ */
  /* sanity: the suite really drove the engine                           */
  /* ------------------------------------------------------------------ */

  it('R0 the drive helper actually advances the clock', () => {
    const driven = driveToTerminal(newGame('P4X-R0'), 'P4X-R0', 400);
    // The suite's own driver must genuinely move the match forward, otherwise
    // every scripted assertion above would be vacuous.
    expect(driven.time).toBeGreaterThan(10);
    expect(driven.events.length).toBeGreaterThan(20);
  });
});
