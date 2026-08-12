import { describe, expect, it, afterEach } from 'vitest';
import { CHARACTERS, getCharacterDef } from '../src/data/characters';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { applyZoneDamage } from '../src/core/restrictedZones';
import { executeCommand } from '../src/core/gameEngine';
import { getLegalPlayerCommands } from '../src/core/legalActions';
import { createGame, getPlayer } from '../src/core/gameState';
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
});

describe('Phase 4L NPC, progression, and save/load contract', () => {
  it('lets NPCs choose and execute each new role skill through the shared path', () => {
    for (const characterId of NEW_ROLES) {
      const state = newGame('scout');
      const npc = npcs(state)[0]!;
      installRole(npc, characterId);
      if (characterId === 'survivor') {
        npc.stamina = Math.floor(npc.maxStamina * 0.2);
        expect(npcSurvivalSkill(state, npc)).toBe('second_wind');
        cast(state, npc, 'second_wind');
      } else if (characterId === 'scavenger') {
        expect(npcSurvivalSkill(state, npc)).toBe('scavenge_focus');
        cast(state, npc, 'scavenge_focus');
      } else if (characterId === 'hunter') {
        npc.knownEnemies = [];
        expect(npcSurvivalSkill(state, npc)).toBe('track_target');
        cast(state, npc, 'track_target');
      } else {
        expect(npcCombatSkill(npc)).toBe('prepare_ambush');
        cast(state, npc, 'prepare_ambush');
      }
    }
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
