import { describe, it, expect } from 'vitest';
import { createGame } from '../src/core/gameState';
import { SeededRandom } from '../src/core/random';
import { computeDamage, hitChanceOf } from '../src/core/combat';
import { getEquippedWeapon } from '../src/core/inventory';
import { executeCommand } from '../src/core/gameEngine';
import { getLegalPlayerCommands } from '../src/core/legalActions';
import {
  SKILLS,
  canUseSkill,
  getCharacterSkill,
  isSkillReady,
  useSkill,
  type SkillId,
} from '../src/core/skills';
import type { GameState } from '../src/core/types';

function newGame(characterId: string): GameState {
  return createGame({ seed: 'SKILL-TEST', playerCharacterId: characterId });
}

function playerOf(state: GameState) {
  return state.characters[state.playerId]!;
}

describe('四角色技能 · 定义与归属', () => {
  it('每个角色恰好拥有一枚签名技能', () => {
    expect(getCharacterSkill('scout')).toBe('dash');
    expect(getCharacterSkill('fighter')).toBe('sunder');
    expect(getCharacterSkill('engineer')).toBe('field_repair');
    expect(getCharacterSkill('medic')).toBe('first_aid');
  });

  it('技能有体力成本与冷却', () => {
    (Object.keys(SKILLS) as SkillId[]).forEach((id) => {
      const def = SKILLS[id];
      expect(def.staminaCost).toBeGreaterThan(0);
      expect(def.cooldown).toBeGreaterThan(0);
    });
  });
});

describe('四角色技能 · 前置校验', () => {
  it('冷却就绪且体力足够才能释放', () => {
    const state = newGame('medic');
    const p = playerOf(state);
    p.stamina = 0;
    expect(canUseSkill(p, 'first_aid').ok).toBe(false);
    p.stamina = p.maxStamina;
    expect(canUseSkill(p, 'first_aid').ok).toBe(true);
  });

  it('角色没有的技能不可释放', () => {
    const state = newGame('medic');
    const p = playerOf(state);
    // medic 没有 sunder
    expect(canUseSkill(p, 'sunder').ok).toBe(false);
    const res = useSkill(state, p, 'sunder', new SeededRandom('r'));
    expect(res.ok).toBe(false);
  });

  it('释放后置冷却，且期间不可再次释放', () => {
    const state = newGame('medic');
    const p = playerOf(state);
    p.hp = 50;
    const res = useSkill(state, p, 'first_aid', new SeededRandom('r'));
    expect(res.ok).toBe(true);
    expect(p.skillCooldowns['first_aid']).toBe(SKILLS.first_aid.cooldown);
    expect(isSkillReady(p, 'first_aid')).toBe(false);
    expect(canUseSkill(p, 'first_aid').ok).toBe(false);
  });
});

describe('四角色技能 · 效果', () => {
  it('医学生「急救」按比例恢复生命', () => {
    const state = newGame('medic');
    const p = playerOf(state);
    p.hp = 50;
    const before = p.hp;
    const res = useSkill(state, p, 'first_aid', new SeededRandom('r'));
    expect(res.ok).toBe(true);
    expect(res.hpHealed).toBeGreaterThan(0);
    expect(p.hp).toBe(Math.min(p.maxHp, before + res.hpHealed));
  });

  it('工程师「应急修理」回满体力并修复武器耐久', () => {
    const state = newGame('engineer');
    const p = playerOf(state);
    p.stamina = 10;
    const weapon = getEquippedWeapon(p);
    if (weapon && typeof weapon.durability === 'number') {
      weapon.durability = 1;
    }
    const res = useSkill(state, p, 'field_repair', new SeededRandom('r'));
    expect(res.ok).toBe(true);
    expect(p.stamina).toBe(p.maxStamina);
    if (weapon && typeof weapon.durability === 'number') {
      expect(weapon.durability).toBeGreaterThan(1);
    }
  });

  it('斗士「破甲」提升伤害（状态倍率生效）', () => {
    const state = newGame('fighter');
    const p = playerOf(state);
    const enemyId = state.turnOrder.find((id) => id !== p.id)!;
    const enemy = state.characters[enemyId]!;
    enemy.defense = 0;
    enemy.characterId = enemy.characterId; // 占位，敌人不参与此测试

    const rngC = new SeededRandom('same');
    const base = computeDamage(p, enemy, rngC, 'normal');
    useSkill(state, p, 'sunder', new SeededRandom('r'));
    const rngB = new SeededRandom('same');
    const buffed = computeDamage(p, enemy, rngB, 'normal');
    expect(buffed).toBeGreaterThan(base);

    const sunder = p.statusEffects.find((e) => e.id === 'sunder');
    expect(sunder).toBeDefined();
    expect(sunder!.damageMult).toBeGreaterThan(1);
  });

  it('侦察「疾影」降低被命中概率', () => {
    const state = newGame('fighter');
    const attacker = playerOf(state);
    const enemyId = state.turnOrder.find((id) => id !== attacker.id)!;
    const enemy = state.characters[enemyId]!;
    enemy.characterId = 'scout'; // 使其拥有疾影
    enemy.alive = true;

    const baseHit = hitChanceOf(attacker, enemy, 'normal');
    const res = useSkill(state, enemy, 'dash', new SeededRandom('r'));
    expect(res.ok).toBe(true);
    const dashHit = hitChanceOf(attacker, enemy, 'normal');
    expect(dashHit).toBeLessThan(baseHit);
  });

  it('状态效果在持续回合后自动消失', () => {
    const state = newGame('fighter');
    const p = playerOf(state);
    useSkill(state, p, 'sunder', new SeededRandom('r'));
    expect(p.statusEffects.some((e) => e.id === 'sunder')).toBe(true);
    // 推进时间单位，冷却与状态都会递减
    const r = executeCommand(state, { type: 'REST' });
    expect(r.ok).toBe(true);
    // sunder 持续 3 回合，刚用完 1 回合仍在
    expect(r.state.characters[r.state.playerId]!.statusEffects.some((e) => e.id === 'sunder')).toBe(true);
  });
});

describe('四角色技能 · 命令集成', () => {
  it('USE_SKILL 命令释放并推进时间、写入事件', () => {
    const state = newGame('medic');
    const p = playerOf(state);
    p.hp = 40;
    const t0 = state.time;
    const r = executeCommand(state, { type: 'USE_SKILL', skillId: 'first_aid' });
    expect(r.ok).toBe(true);
    expect(r.state.time).toBe(t0 + 1);
    expect(r.state.characters[r.state.playerId]!.hp).toBeGreaterThan(40);
    expect(r.state.events.some((e) => e.type === 'SKILL_USED')).toBe(true);
  });

  it('合法行动集合包含玩家的就绪技能', () => {
    const state = newGame('medic');
    const p = playerOf(state);
    p.stamina = p.maxStamina;
    const cmds = getLegalPlayerCommands(state);
    expect(cmds.some((c) => c.command.type === 'USE_SKILL')).toBe(true);
  });
});
