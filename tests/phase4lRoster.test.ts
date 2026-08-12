import { describe, expect, it, afterEach } from 'vitest';
import { CHARACTERS, getCharacterDef } from '../src/data/characters';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { applyZoneDamage } from '../src/core/restrictedZones';
import { executeCommand } from '../src/core/gameEngine';
import { getLegalPlayerCommands } from '../src/core/legalActions';
import { createGame, getPlayer, NPC_CHARACTER_POOL, refreshZoneOccupants } from '../src/core/gameState';
import { performRest } from '../src/core/consumables';
import { SeededRandom } from '../src/core/random';
import {
  canUseSkill,
  getCharacterSkills,
  SKILLS,
  useSkill,
  type SkillId,
} from '../src/core/skills';
import { createMemoryStorage, loadGame, saveGame, setStorage } from '../src/core/saveLoad';
import { SAVE_KEY } from '../src/data/gameConfig';
import { addItem, createStack, equipItem } from '../src/core/inventory';
import { experienceToNextLevel, gainExperience } from '../src/core/progression';
import { useSkillActor } from '../src/core/actorActions';
import type { Command } from '../src/core/types';
import { npcCombatSkill, npcSurvivalSkill } from '../src/core/npcSkillDecide';
import type { Combatant, GameState } from '../src/core/types';
import { runAutoGame } from '../tools/autoPlayer';

const NEW_ROLES = ['survivor', 'scavenger', 'hunter', 'trapper'] as const;

function newGame(characterId: string): GameState {
  return createGame({ seed: `PHASE4L-${characterId}`, playerCharacterId: characterId });
}

function npcs(state: GameState): Combatant[] {
  return state.turnOrder
    .map((id) => state.characters[id])
    .filter((actor): actor is Combatant => Boolean(actor) && !actor.isPlayer);
}

function cast(state: GameState, actor: Combatant, skillId: SkillId): void {
  expect(canUseSkill(actor, skillId).ok, `技能 ${skillId} 应可释放`).toBe(true);
  expect(useSkill(state, actor, skillId, new SeededRandom(`cast-${skillId}`)).ok).toBe(true);
}

function installRole(actor: Combatant, characterId: string): void {
  const def = getCharacterDef(characterId);
  actor.characterId = def.id;
  actor.maxHp = def.maxHp;
  actor.hp = def.maxHp;
  actor.maxStamina = def.maxStamina;
  actor.stamina = def.maxStamina;
  actor.attack = def.attack;
  actor.defense = def.defense;
  actor.perception = def.perception;
  actor.speed = def.speed;
  actor.crafting = def.crafting;
  actor.medical = def.medical;
  actor.passiveId = def.passiveId;
  actor.level = 3;
  actor.exp = 0;
  actor.statusEffects = [];
  actor.skillCooldowns = {};
  actor.guarding = false;
}

function itemCount(state: GameState): number {
  let total = 0;
  for (const zone of Object.values(state.zones)) {
    total += zone.remainingLootCount;
    total += zone.groundItems.reduce((sum, stack) => sum + stack.count, 0);
  }
  for (const actor of Object.values(state.characters)) {
    total += actor.inventory.reduce((sum, stack) => sum + stack.count, 0);
    total += actor.equipment.reduce((sum, stack) => sum + stack.count, 0);
  }
  return total;
}

function npcProfessionSequence(state: GameState): string[] {
  return npcs(state).map((npc) => npc.characterId);
}

afterEach(() => setStorage(null));

describe('Phase 4L roster registry and gameplay contract', () => {
  it('has eight data-driven playable roles with two distinct skills each', () => {
    expect(CHARACTERS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(CHARACTERS.map((character) => character.id)).size).toBe(CHARACTERS.length);
    for (const character of CHARACTERS) {
      expect(character.description.length).toBeGreaterThan(10);
      expect(character.passiveDescription.length).toBeGreaterThan(5);
      expect(getCharacterSkills(character.id)).toHaveLength(2);
      for (const skillId of getCharacterSkills(character.id)) {
        expect(SKILLS[skillId].characterId).toBe(character.id);
        expect(SKILLS[skillId].staminaCost).toBeGreaterThan(0);
        expect(SKILLS[skillId].cooldown).toBeGreaterThan(0);
      }
    }
  });

  it('starts every new role with its registered stats, passive, and primary skill', () => {
    for (const characterId of NEW_ROLES) {
      const state = newGame(characterId);
      const player = getPlayer(state);
      const def = getCharacterDef(characterId);
      expect(player.characterId).toBe(characterId);
      expect(player.passiveId).toBe(def.passiveId);
      expect(player.maxHp).toBe(def.maxHp);
      expect(player.maxStamina).toBe(def.maxStamina);
      expect(getCharacterSkills(characterId)[0]).toBeTruthy();
      expect(getLegalPlayerCommands(state).some((entry) => entry.command.type === 'USE_SKILL')).toBe(true);
    }
  });

  it('enforces positive skill cost, cooldown, effect, and Lv.3 unlock for all new roles', () => {
    for (const characterId of NEW_ROLES) {
      const state = newGame(characterId);
      const player = getPlayer(state);
      const [primary, secondary] = getCharacterSkills(characterId);
      expect(SKILLS[primary!].staminaCost).toBeGreaterThan(0);
      cast(state, player, primary!);
      expect(player.skillCooldowns[primary!]).toBe(SKILLS[primary!].cooldown);
      expect(canUseSkill(player, secondary!).ok).toBe(false);
      player.level = 3;
      player.skillCooldowns = {};
      player.stamina = player.maxStamina;
      expect(canUseSkill(player, secondary!).ok).toBe(true);
      cast(state, player, secondary!);
      expect(player.skillCooldowns[secondary!]).toBe(SKILLS[secondary!].cooldown);
    }
  });

  it('keeps each new role behavior-specific and preserves information/item boundaries', () => {
    const survivor = newGame('survivor');
    const survivorPlayer = getPlayer(survivor);
    survivorPlayer.stamina = 0;
    const restGain = performRest(survivor, survivorPlayer);
    expect(restGain).toBe(GAME_CONFIG.restStaminaGain + GAME_CONFIG.enduringRestBonus);
    const survivorZone = survivor.zones[survivorPlayer.currentZoneId]!;
    survivorZone.status = 'restricted';
    survivorPlayer.hp = survivorPlayer.maxHp;
    applyZoneDamage(survivor);
    expect(survivorPlayer.hp).toBe(survivorPlayer.maxHp - Math.round(GAME_CONFIG.zoneDamagePerTick * GAME_CONFIG.enduringZoneDamageMult));

    const scavenger = newGame('scavenger');
    const scavengerPlayer = getPlayer(scavenger);
    const beforeItems = itemCount(scavenger);
    cast(scavenger, scavengerPlayer, 'scavenge_focus');
    expect(itemCount(scavenger)).toBe(beforeItems);

    const hunter = newGame('hunter');
    const hunterPlayer = getPlayer(hunter);
    const beforeIntel = JSON.stringify(hunter.playerIntel);
    cast(hunter, hunterPlayer, 'track_target');
    expect(JSON.stringify(hunter.playerIntel)).toBe(beforeIntel);
    expect(hunter.events.at(-1)?.message).not.toContain('aliveCharacterIds');
    expect(hunter.events.at(-1)?.metadata).not.toHaveProperty('targetIds');

    const trapper = newGame('trapper');
    const trapperPlayer = getPlayer(trapper);
    cast(trapper, trapperPlayer, 'prepare_ambush');
    expect(trapperPlayer.guarding).toBe(true);
    expect(trapperPlayer.statusEffects.some((effect) => effect.id === 'trapper_setup')).toBe(true);
  });

  it('keeps zero-stamina escape and rest fallbacks for every new role', () => {
    for (const characterId of NEW_ROLES) {
      const state = newGame(characterId);
      const player = getPlayer(state);
      player.stamina = 0;
      expect(getLegalPlayerCommands(state).some((entry) => entry.command.type === 'REST')).toBe(true);
      expect(getLegalPlayerCommands(state).some((entry) => entry.command.type === 'USE_SKILL')).toBe(false);

      const enemy = npcs(state)[0]!;
      enemy.currentZoneId = player.currentZoneId;
      state.encounter = {
        enemyId: enemy.id,
        zoneId: player.currentZoneId,
        startedAtTime: state.time,
        log: [],
        resolved: false,
        reconInitiative: false,
      };
      expect(getLegalPlayerCommands(state).some((entry) => entry.command.type === 'FLEE')).toBe(true);
    }
  });

  it('uses the full current CHARACTERS pool for every player profession and stays deterministic', () => {
    expect(NPC_CHARACTER_POOL).toBe(CHARACTERS);
    const expected = new Set(CHARACTERS.map((character) => character.id));
    for (const playerCharacterId of ['scout', 'survivor']) {
      const covered = new Set<string>();
      for (let i = 0; i < 512; i++) {
        const seed = `PHASE4L-NPC-POOL-${playerCharacterId}-${i}`;
        const first = createGame({ seed, playerCharacterId });
        const second = createGame({ seed, playerCharacterId });
        const firstSequence = npcProfessionSequence(first);
        expect(npcProfessionSequence(second)).toEqual(firstSequence);
        firstSequence.forEach((id) => covered.add(id));
      }
      expect(covered).toEqual(expected);
    }
  });
});

describe('Phase 4L NPC, progression, and save/load contract', () => {
  it('covers NPC primary skill decisions and shared execution', () => {
    for (const characterId of NEW_ROLES) {
      const state = newGame('scout');
      const npc = npcs(state)[0]!;
      installRole(npc, characterId);
      if (characterId === 'survivor') {
        npc.stamina = Math.floor(npc.maxStamina * 0.2);
        expect(npcSurvivalSkill(state, npc)).toBe('second_wind');
        const before = npc.stamina;
        expect(useSkillActor(state, npc, 'second_wind', new SeededRandom('npc-second-wind')).ok).toBe(true);
        expect(npc.stamina).toBeGreaterThan(before);
      } else if (characterId === 'scavenger') {
        expect(npcSurvivalSkill(state, npc)).toBe('scavenge_focus');
        expect(useSkillActor(state, npc, 'scavenge_focus', new SeededRandom('npc-scavenge-focus')).ok).toBe(true);
      } else if (characterId === 'hunter') {
        npc.knownEnemies = [];
        expect(npcSurvivalSkill(state, npc)).toBe('track_target');
        expect(useSkillActor(state, npc, 'track_target', new SeededRandom('npc-track-target')).ok).toBe(true);
      } else {
        expect(npcCombatSkill(npc)).toBe('prepare_ambush');
        expect(useSkillActor(state, npc, 'prepare_ambush', new SeededRandom('npc-prepare-ambush')).ok).toBe(true);
      }
      const primary = getCharacterSkills(characterId)[0]!;
      expect(npc.skillCooldowns[primary]).toBe(SKILLS[primary].cooldown);
    }
  });

  it('covers NPC secondary skill decisions and shared execution', () => {
    const cases: Array<{ characterId: typeof NEW_ROLES[number]; skillId: SkillId; decide: (state: GameState, npc: Combatant) => SkillId | null; setup: (state: GameState, npc: Combatant) => void }> = [
      {
        characterId: 'survivor',
        skillId: 'camp_routine',
        decide: npcSurvivalSkill,
        setup: (_state, npc) => { npc.stamina = Math.floor(npc.maxStamina * 0.5); },
      },
      {
        characterId: 'scavenger',
        skillId: 'sort_rare',
        decide: npcSurvivalSkill,
        setup: (_state, npc) => { npc.skillCooldowns.scavenge_focus = 1; },
      },
      {
        characterId: 'hunter',
        skillId: 'steady_aim',
        decide: (_state, npc) => npcCombatSkill(npc),
        setup: (_state, npc) => {
          npc.skillCooldowns.track_target = 1;
          npc.knownEnemies = ['p0'];
        },
      },
      {
        characterId: 'trapper',
        skillId: 'escape_plan',
        decide: npcSurvivalSkill,
        setup: (_state, npc) => { npc.hp = Math.floor(npc.maxHp * 0.6); },
      },
    ];

    for (const testCase of cases) {
      const state = newGame('scout');
      const npc = npcs(state)[0]!;
      installRole(npc, testCase.characterId);
      testCase.setup(state, npc);
      expect(testCase.decide(state, npc), testCase.skillId).toBe(testCase.skillId);
      const result = useSkillActor(state, npc, testCase.skillId, new SeededRandom(`npc-${testCase.skillId}`));
      expect(result.ok, testCase.skillId).toBe(true);
      expect(npc.skillCooldowns[testCase.skillId]).toBe(SKILLS[testCase.skillId].cooldown);
      if (testCase.skillId !== 'second_wind') {
        const statusId = testCase.skillId === 'camp_routine' ? 'survivor_camp' : testCase.skillId;
        expect(npc.statusEffects.some((effect) => effect.id === statusId)).toBe(true);
      }
    }
  });

  it.each(NEW_ROLES)('%s reaches Lv.3 through formal progression and keeps secondary legal at max level', (characterId) => {
    const state = newGame(characterId);
    const player = getPlayer(state);
    const [primary, secondary] = getCharacterSkills(characterId);
    expect(player.level).toBe(1);
    expect(canUseSkill(player, primary!).ok).toBe(true);
    expect(canUseSkill(player, secondary!).ok).toBe(false);
    gainExperience(player, experienceToNextLevel(1));
    expect(player.level).toBe(2);
    expect(canUseSkill(player, secondary!).ok).toBe(false);
    gainExperience(player, experienceToNextLevel(2));
    expect(player.level).toBe(3);
    expect(canUseSkill(player, secondary!).ok).toBe(true);
    for (let level = 3; level < GAME_CONFIG.maxLevel; level++) {
      gainExperience(player, experienceToNextLevel(level));
    }
    expect(player.level).toBe(GAME_CONFIG.maxLevel);
    expect(player.exp).toBe(0);
    expect(canUseSkill(player, secondary!).ok).toBe(true);
    expect(gainExperience(player, 99).gained).toBe(0);
    expect(player.exp).toBe(0);
  });

  it('keeps the old four roles on the same progression and skill unlock contract', () => {
    for (const characterId of ['scout', 'fighter', 'engineer', 'medic']) {
      const state = newGame(characterId);
      const player = getPlayer(state);
      const [primary, secondary] = getCharacterSkills(characterId);
      gainExperience(player, experienceToNextLevel(1));
      gainExperience(player, experienceToNextLevel(2));
      expect(player.level).toBe(3);
      expect(canUseSkill(player, primary!).ok).toBe(true);
      expect(canUseSkill(player, secondary!).ok).toBe(true);
    }
  });

  it.each([
    ['scavenger', 'scavenge_focus', 'searchMaterialBias', 999],
    ['scavenger', 'scavenge_focus', 'searchFindMult', -1],
    ['hunter', 'steady_aim', 'rangedHitChanceMult', 100],
    ['trapper', 'escape_plan', 'fleeChanceBonus', -5],
    ['survivor', 'camp_routine', 'restStaminaBonus', 999],
    ['trapper', 'prepare_ambush', 'counterChanceBonus', NaN],
  ] as const)('rejects corrupted Phase 4L status field %s.%s', (characterId, skillId, field, value) => {
    const state = newGame(characterId);
    const player = getPlayer(state);
    player.level = 3;
    cast(state, player, skillId as SkillId);
    const effect = player.statusEffects[0]! as unknown as Record<string, unknown>;
    effect[field] = value;
    setStorage(createMemoryStorage());
    expect(saveGame(state).ok).toBe(true);
    const loaded = loadGame();
    expect(loaded.ok).toBe(false);
    expect(loaded.error).toContain(field);
    const statusId = skillId === 'prepare_ambush' ? 'trapper_setup' : skillId === 'camp_routine' ? 'survivor_camp' : skillId;
    expect(loaded.error).toContain(statusId);
  });

  it('rejects an over-duration and unknown Phase 4L-like status on load', () => {
    const storage = createMemoryStorage();
    const state = newGame('scavenger');
    const player = getPlayer(state);
    player.level = 3;
    cast(state, player, 'scavenge_focus');
    setStorage(storage);
    expect(saveGame(state).ok).toBe(true);
    const overDuration = JSON.parse(storage.getItem(SAVE_KEY)!) as { state: GameState };
    overDuration.state.characters[overDuration.state.playerId]!.statusEffects[0]!.remaining =
      GAME_CONFIG.skillScavengeFocusDuration + 1;
    storage.setItem(SAVE_KEY, JSON.stringify(overDuration));
    const rejectedDuration = loadGame();
    expect(rejectedDuration.ok).toBe(false);
    expect(rejectedDuration.error).toContain('scavenge_focus');
    expect(rejectedDuration.error).toContain('remaining');

    const unknownState = newGame('scavenger');
    const unknownPlayer = getPlayer(unknownState);
    unknownPlayer.level = 3;
    cast(unknownState, unknownPlayer, 'scavenge_focus');
    expect(saveGame(unknownState).ok).toBe(true);
    const unknown = JSON.parse(storage.getItem(SAVE_KEY)!) as { state: GameState };
    unknown.state.characters[unknown.state.playerId]!.statusEffects[0]!.id = 'phase4l_unknown';
    storage.setItem(SAVE_KEY, JSON.stringify(unknown));
    const rejectedUnknown = loadGame();
    expect(rejectedUnknown.ok).toBe(false);
    expect(rejectedUnknown.error).toContain('phase4l_unknown');
  });

  it('persists new-role skill cooldowns and status effects through save/load', () => {
    setStorage(createMemoryStorage());
    const state = newGame('trapper');
    const player = getPlayer(state);
    player.level = 3;
    cast(state, player, 'escape_plan');
    expect(saveGame(state).ok).toBe(true);
    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const restored = getPlayer(loaded.data.state);
    expect(restored.characterId).toBe('trapper');
    expect(restored.skillCooldowns.escape_plan).toBe(GAME_CONFIG.skillEscapePlanCooldown);
    expect(restored.statusEffects.some((effect) => effect.id === 'escape_plan')).toBe(true);
  });

  it.each([
    ['scavenger', 'scavenge_focus', { type: 'SEARCH' } as Command],
    ['survivor', 'camp_routine', { type: 'REST' } as Command],
    ['hunter', 'steady_aim', { type: 'REST' } as Command],
  ] as const)('round-trips complex %s state and continues the same deterministic command', (characterId, skillId, command) => {
    const state = newGame(characterId);
    const player = getPlayer(state);
    player.level = 3;
    player.exp = 1;
    player.currentZoneId = 'underground';
    player.stamina = characterId === 'survivor' ? 60 : player.maxStamina;
    for (const npc of npcs(state)) npc.currentZoneId = 'school';
    refreshZoneOccupants(state);
    addItem(player, createStack(state, 'battery'));
    const weapon = createStack(state, 'simple_bow');
    addItem(player, weapon);
    expect(equipItem(player, weapon.uid).ok).toBe(true);
    if (characterId === 'hunter') player.knownEnemies = [npcs(state)[0]!.id];
    cast(state, player, skillId);
    const before = structuredClone(state);
    setStorage(createMemoryStorage());
    expect(saveGame(state).ok).toBe(true);
    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.data.state).toEqual(before);

    const direct = executeCommand(structuredClone(before), command);
    const resumed = executeCommand(loaded.data.state, command);
    expect(resumed.ok).toBe(direct.ok);
    expect(resumed.state.rngState).toBe(direct.state.rngState);
    expect(resumed.state.time).toBe(direct.state.time);
    expect(resumed.state.characters).toEqual(direct.state.characters);
    expect(resumed.state.events.at(-1)).toEqual(direct.state.events.at(-1));
  });

  it('supports all new roles in deterministic AutoPlayer runs without illegal actions or deadlocks', () => {
    for (const characterId of NEW_ROLES) {
      const result = runAutoGame({
        seed: `PHASE4L-AUTO-${characterId}`,
        characterId,
        policy: 'cautious',
        maxSteps: 900,
      });
      expect(result.illegalCommands, characterId).toHaveLength(0);
      expect(result.deadlock, characterId).toBeNull();
      expect(result.emptyLegalSet, characterId).toBe(false);
      expect(result.stalled, characterId).toBe(false);
    }
  });

  it('executes a new-role skill through the player command and advances progression time', () => {
    const state = newGame('survivor');
    const beforeTime = state.time;
    const result = executeCommand(state, { type: 'USE_SKILL', skillId: 'second_wind' });
    expect(result.ok).toBe(true);
    expect(result.state.time).toBe(beforeTime + 1);
    expect(result.state.events.some((event) => event.type === 'SKILL_USED')).toBe(true);
  });
});
