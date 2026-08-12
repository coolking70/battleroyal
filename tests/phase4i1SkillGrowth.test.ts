import { describe, expect, it } from 'vitest';

import { createGame, refreshZoneOccupants } from '../src/core/gameState';
import { advanceTime } from '../src/core/gameEngine';
import { computeDamage, hitChanceIn } from '../src/core/combat';
import { npcCombatSkill } from '../src/core/npcSkillDecide';
import { SeededRandom } from '../src/core/random';
import { useSkill, canUseSkill, getCharacterSkills, isSkillUnlocked } from '../src/core/skills';
import { getLegalPlayerCommands } from '../src/core/legalActions';
import { validateSaveData } from '../src/core/saveLoad';
import { GAME_CONFIG, GAME_VERSION } from '../src/data/gameConfig';
import type { Combatant, GameState } from '../src/core/types';

function newGame(characterId: string): GameState {
  return createGame({ seed: `PHASE4I1-${characterId}`, playerCharacterId: characterId });
}

function playerOf(state: GameState): Combatant {
  return state.characters[state.playerId]!;
}

function saveOf(state: GameState): Record<string, unknown> {
  return {
    version: GAME_VERSION,
    savedAt: 1,
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state: structuredClone(state),
  };
}

describe('Phase 4I-1 第二技能：等级推导与效果', () => {
  it('四角色都有主/副技能，主技能兼容查询仍只返回第一项', () => {
    expect(getCharacterSkills('scout')).toEqual(['scout_recon', 'scout_smoke']);
    expect(getCharacterSkills('fighter')).toEqual(['adrenaline', 'fighter_focus']);
    expect(getCharacterSkills('engineer')).toEqual(['field_craft', 'engineer_reinforce']);
    expect(getCharacterSkills('medic')).toEqual(['emergency_treatment', 'medic_regen']);
  });

  it('Lv.3 前第二技能可见但不可用，达到 Lv.3 后由 level 推导解锁', () => {
    const state = newGame('fighter');
    const player = playerOf(state);
    player.level = GAME_CONFIG.skillSecondaryUnlockLevel - 1;
    player.stamina = player.maxStamina;
    expect(isSkillUnlocked(player, 'fighter_focus')).toBe(false);
    expect(canUseSkill(player, 'fighter_focus')).toMatchObject({
      ok: false,
      reason: `等级不足：达到 Lv.${GAME_CONFIG.skillSecondaryUnlockLevel} 后解锁。`,
    });
    expect(player.skillCooldowns.fighter_focus).toBeUndefined();

    player.level = GAME_CONFIG.skillSecondaryUnlockLevel;
    expect(isSkillUnlocked(player, 'fighter_focus')).toBe(true);
    expect(canUseSkill(player, 'fighter_focus').ok).toBe(true);
  });

  it('四个第二技能各自使用既有状态字段，并写入各自冷却', () => {
    const cases = [
      {
        characterId: 'scout',
        skillId: 'scout_smoke' as const,
        statusId: 'scout_smoke',
        cooldown: GAME_CONFIG.skillScoutSmokeCooldown,
        staminaCost: GAME_CONFIG.skillScoutSmokeStaminaCost,
        check: (actor: Combatant) => {
          const effect = actor.statusEffects.find((item) => item.id === 'scout_smoke');
          expect(effect?.evasionHitMult).toBe(GAME_CONFIG.skillScoutSmokeEvasionMult);
          expect(effect?.remaining).toBe(GAME_CONFIG.skillScoutSmokeDuration);
        },
      },
      {
        characterId: 'fighter',
        skillId: 'fighter_focus' as const,
        statusId: 'fighter_focus',
        cooldown: GAME_CONFIG.skillFighterFocusCooldown,
        staminaCost: GAME_CONFIG.skillFighterFocusStaminaCost,
        check: (actor: Combatant) => {
          const effect = actor.statusEffects.find((item) => item.id === 'fighter_focus');
          expect(effect?.hitChanceMult).toBe(GAME_CONFIG.skillFighterFocusHitChanceMult);
          expect(effect?.remaining).toBe(GAME_CONFIG.skillFighterFocusDuration);
        },
      },
      {
        characterId: 'engineer',
        skillId: 'engineer_reinforce' as const,
        statusId: 'engineer_reinforce',
        cooldown: GAME_CONFIG.skillEngineerReinforceCooldown,
        staminaCost: GAME_CONFIG.skillEngineerReinforceStaminaCost,
        check: (actor: Combatant) => {
          const effect = actor.statusEffects.find((item) => item.id === 'engineer_reinforce');
          expect(effect?.defenseBonus).toBe(GAME_CONFIG.skillEngineerReinforceDefenseBonus);
          expect(effect?.remaining).toBe(GAME_CONFIG.skillEngineerReinforceDuration);
        },
      },
      {
        characterId: 'medic',
        skillId: 'medic_regen' as const,
        statusId: 'medic_regen',
        cooldown: GAME_CONFIG.skillMedicRegenCooldown,
        staminaCost: GAME_CONFIG.skillMedicRegenStaminaCost,
        check: (actor: Combatant) => {
          const effect = actor.statusEffects.find((item) => item.id === 'medic_regen');
          expect(effect?.hpPerTick).toBe(GAME_CONFIG.skillMedicRegenHpPerTick);
          expect(effect?.remaining).toBe(GAME_CONFIG.skillMedicRegenDuration);
        },
      },
    ];

    for (const item of cases) {
      const state = newGame(item.characterId);
      const player = playerOf(state);
      player.level = GAME_CONFIG.skillSecondaryUnlockLevel;
      player.stamina = player.maxStamina;
      const beforeStamina = player.stamina;
      const result = useSkill(state, player, item.skillId, new SeededRandom(11));
      expect(result.ok).toBe(true);
      expect(player.skillCooldowns[item.skillId]).toBe(item.cooldown);
      expect(player.stamina).toBe(beforeStamina - item.staminaCost);
      expect(player.statusEffects.some((effect) => effect.id === item.statusId)).toBe(true);
      item.check(player);
    }
  });

  it('四个第二技能实际影响战斗或时间结算，并按时间递减冷却', () => {
    const duel = (characterId: string): { state: GameState; player: Combatant; enemy: Combatant } => {
      const state = newGame(characterId);
      const player = playerOf(state);
      const enemy = Object.values(state.characters).find((character) => !character.isPlayer && character.alive)!;
      player.currentZoneId = 'residential';
      enemy.currentZoneId = player.currentZoneId;
      refreshZoneOccupants(state);
      player.level = GAME_CONFIG.skillSecondaryUnlockLevel;
      player.stamina = player.maxStamina;
      return { state, player, enemy };
    };
    const isolatePlayerForTimeTick = (state: GameState): void => {
      for (const character of Object.values(state.characters)) {
        if (!character.isPlayer) {
          character.currentZoneId = 'school';
          character.stamina = 0;
        }
      }
      refreshZoneOccupants(state);
    };

    {
      const { state, player, enemy } = duel('scout');
      const before = hitChanceIn(state, enemy, player);
      useSkill(state, player, 'scout_smoke', new SeededRandom(21));
      expect(hitChanceIn(state, enemy, player)).toBeLessThan(before);
      isolatePlayerForTimeTick(state);
      advanceTime(state, new SeededRandom(22));
      expect(player.skillCooldowns.scout_smoke).toBe(GAME_CONFIG.skillScoutSmokeCooldown - 1);
    }

    {
      const { state, player, enemy } = duel('fighter');
      const before = hitChanceIn(state, player, enemy);
      useSkill(state, player, 'fighter_focus', new SeededRandom(23));
      expect(hitChanceIn(state, player, enemy)).toBeGreaterThan(before);
      isolatePlayerForTimeTick(state);
      advanceTime(state, new SeededRandom(24));
      expect(player.skillCooldowns.fighter_focus).toBe(GAME_CONFIG.skillFighterFocusCooldown - 1);
    }

    {
      const { state, player, enemy } = duel('engineer');
      const before = computeDamage(enemy, player, new SeededRandom(25));
      useSkill(state, player, 'engineer_reinforce', new SeededRandom(26));
      expect(computeDamage(enemy, player, new SeededRandom(25))).toBeLessThan(before);
      isolatePlayerForTimeTick(state);
      advanceTime(state, new SeededRandom(27));
      expect(player.skillCooldowns.engineer_reinforce).toBe(GAME_CONFIG.skillEngineerReinforceCooldown - 1);
    }

    {
      const { state, player } = duel('medic');
      player.hp = player.maxHp - GAME_CONFIG.skillMedicRegenHpPerTick;
      const beforeHp = player.hp;
      useSkill(state, player, 'medic_regen', new SeededRandom(28));
      isolatePlayerForTimeTick(state);
      advanceTime(state, new SeededRandom(29));
      expect(player.hp).toBe(beforeHp + GAME_CONFIG.skillMedicRegenHpPerTick);
      expect(player.skillCooldowns.medic_regen).toBe(GAME_CONFIG.skillMedicRegenCooldown - 1);
    }
  });

  it('第二技能在零体力时不可用且不产生免费效果', () => {
    const state = newGame('fighter');
    const player = playerOf(state);
    player.level = GAME_CONFIG.skillSecondaryUnlockLevel;
    player.stamina = 0;
    const before = structuredClone({ cooldowns: player.skillCooldowns, statuses: player.statusEffects });
    expect(canUseSkill(player, 'fighter_focus')).toMatchObject({ ok: false });
    const result = useSkill(state, player, 'fighter_focus', new SeededRandom(12));
    expect(result.ok).toBe(false);
    expect(player.stamina).toBe(0);
    expect(player.skillCooldowns).toEqual(before.cooldowns);
    expect(player.statusEffects).toEqual(before.statuses);
  });

  it('合法行动只枚举已解锁且可支付的技能，并保留既有 USE_SKILL 通道', () => {
    const state = newGame('fighter');
    const player = playerOf(state);
    player.stamina = player.maxStamina;
    player.level = GAME_CONFIG.skillSecondaryUnlockLevel - 1;
    let skillIds = getLegalPlayerCommands(state)
      .map((item) => item.command)
      .filter((command): command is Extract<typeof command, { type: 'USE_SKILL' }> => command.type === 'USE_SKILL')
      .map((command) => command.skillId);
    expect(skillIds).toEqual(['adrenaline']);

    player.level = GAME_CONFIG.skillSecondaryUnlockLevel;
    skillIds = getLegalPlayerCommands(state)
      .map((item) => item.command)
      .filter((command): command is Extract<typeof command, { type: 'USE_SKILL' }> => command.type === 'USE_SKILL')
      .map((command) => command.skillId);
    expect(skillIds).toEqual(['adrenaline', 'fighter_focus']);
  });

  it('NPC 达到 Lv.3 后实际选择并释放第二技能', () => {
    const state = newGame('scout');
    const npc = Object.values(state.characters).find(
      (character) => !character.isPlayer && character.characterId === 'fighter',
    )!;
    npc.level = GAME_CONFIG.skillSecondaryUnlockLevel;
    npc.stamina = npc.maxStamina;
    npc.skillCooldowns = {};

    const selected = npcCombatSkill(npc);
    expect(selected).toBe('fighter_focus');
    const result = useSkill(state, npc, selected!, new SeededRandom(13));
    expect(result.ok).toBe(true);
    expect(npc.statusEffects.some((effect) => effect.id === 'fighter_focus')).toBe(true);
    expect(npc.skillCooldowns.fighter_focus).toBe(GAME_CONFIG.skillFighterFocusCooldown);
  });

  it('同一种子与同一技能操作序列不引入新的随机差异', () => {
    const run = (): unknown => {
      const state = newGame('fighter');
      const player = playerOf(state);
      player.level = GAME_CONFIG.skillSecondaryUnlockLevel;
      player.stamina = player.maxStamina;
      useSkill(state, player, 'fighter_focus', new SeededRandom(77));
      return {
        stamina: player.stamina,
        cooldowns: player.skillCooldowns,
        statuses: player.statusEffects,
        rngState: state.rngState,
      };
    };
    expect(run()).toEqual(run());
  });
});

describe('Phase 4I-1 新技能状态的存档校验', () => {
  it('合法第二技能状态可保存，解锁状态不需要额外字段', () => {
    const state = newGame('medic');
    const player = playerOf(state);
    player.level = GAME_CONFIG.skillSecondaryUnlockLevel;
    player.statusEffects.push({
      id: 'medic_regen',
      remaining: GAME_CONFIG.skillMedicRegenDuration,
      hpPerTick: GAME_CONFIG.skillMedicRegenHpPerTick,
      label: '持续止血',
    });
    expect(validateSaveData(saveOf(state)).ok).toBe(true);
  });

  it('拒绝第二技能状态的类型错误、越界和错误引用字段', () => {
    const invalid = [
      { remaining: '3' },
      { remaining: GAME_CONFIG.skillMedicRegenDuration + 1 },
      { hpPerTick: -1 },
      { hpPerTick: GAME_CONFIG.skillMedicRegenHpPerTick, id: 'not_a_skill' },
    ];
    for (const change of invalid) {
      const state = newGame('medic');
      const player = playerOf(state);
      player.level = GAME_CONFIG.skillSecondaryUnlockLevel;
      player.statusEffects.push({
        id: 'medic_regen',
        remaining: GAME_CONFIG.skillMedicRegenDuration,
        hpPerTick: GAME_CONFIG.skillMedicRegenHpPerTick,
        label: '持续止血',
        ...change,
      } as never);
      expect(validateSaveData(saveOf(state)).ok).toBe(false);
    }
  });
});
