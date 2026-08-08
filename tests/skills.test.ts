/**
 * 四角色签名技能测试（Phase 3A Step 4 重写）。
 *
 * Phase 3 的版本只验证「回了多少血、伤害涨了多少」，那套断言在新设计下
 * 已经没有意义 —— 现在四个技能强化的是四条**战略维度**，
 * 因此每个技能都按「它到底改变了哪条规则」来验：
 *
 * - 战场侦察  → playerIntel / knownEnemies 里多了人
 * - 肾上腺素  → 攻击体力变便宜 + 自己变脆 + 次数用尽即失效
 * - 野外工造  → 合成体力成本变 0，且只在成功合成时扣充能
 * - 紧急处置  → 治疗类消耗品效果变强 + 清除持续掉血
 */

import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { getZoneDef } from '../src/data/zones';
import { attackStaminaCostFor, getActionStaminaCost } from '../src/core/actionCosts';
import { resolveAttack } from '../src/core/combat';
import { healMultiplierOf } from '../src/core/consumables';
import { createGame } from '../src/core/gameState';
import { executeCommand } from '../src/core/gameEngine';
import { getLegalPlayerCommands } from '../src/core/legalActions';
import { SeededRandom } from '../src/core/random';
import {
  ADRENALINE_ID,
  FIELD_CRAFT_ID,
  MEDICAL_FOCUS_ID,
  SKILLS,
  canUseSkill,
  consumeFieldCraftCharge,
  getCharacterSkill,
  hasFieldCraftCharge,
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

function anyEnemy(state: GameState) {
  const id = state.turnOrder.find((x) => x !== state.playerId)!;
  return state.characters[id]!;
}

describe('四角色技能 · 定义与归属', () => {
  it('每个角色恰好拥有一枚签名技能，且四枚技能覆盖四条战略维度', () => {
    expect(getCharacterSkill('scout')).toBe('scout_recon');
    expect(getCharacterSkill('fighter')).toBe('adrenaline');
    expect(getCharacterSkill('engineer')).toBe('field_craft');
    expect(getCharacterSkill('medic')).toBe('emergency_treatment');

    const dimensions = (Object.keys(SKILLS) as SkillId[]).map((id) => SKILLS[id].dimension);
    expect(new Set(dimensions).size).toBe(4);
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
    expect(canUseSkill(p, 'emergency_treatment').ok).toBe(false);
    p.stamina = p.maxStamina;
    expect(canUseSkill(p, 'emergency_treatment').ok).toBe(true);
  });

  it('角色没有的技能不可释放', () => {
    const state = newGame('medic');
    const p = playerOf(state);
    expect(canUseSkill(p, 'adrenaline').ok).toBe(false);
    const res = useSkill(state, p, 'adrenaline', new SeededRandom('r'));
    expect(res.ok).toBe(false);
  });

  it('释放后置冷却，且期间不可再次释放', () => {
    const state = newGame('medic');
    const p = playerOf(state);
    p.hp = 50;
    const res = useSkill(state, p, 'emergency_treatment', new SeededRandom('r'));
    expect(res.ok).toBe(true);
    expect(p.skillCooldowns['emergency_treatment']).toBe(
      SKILLS.emergency_treatment.cooldown,
    );
    expect(isSkillReady(p, 'emergency_treatment')).toBe(false);
    expect(canUseSkill(p, 'emergency_treatment').ok).toBe(false);
  });
});

describe('侦察员 · 战场侦察（信息）', () => {
  it('查明当前区域与相邻区域里活着的对手', () => {
    const state = newGame('scout');
    const p = playerOf(state);
    const enemy = anyEnemy(state);

    // 把一个对手放到相邻区域，确保侦察半径确实覆盖到
    const adjacent = getZoneDef(p.currentZoneId).adjacent[0]!;
    const from = state.zones[enemy.currentZoneId]!;
    from.aliveCharacterIds = from.aliveCharacterIds.filter((id) => id !== enemy.id);
    enemy.currentZoneId = adjacent;
    state.zones[adjacent]!.aliveCharacterIds.push(enemy.id);

    expect(state.playerIntel[enemy.id]).toBeUndefined();
    const res = useSkill(state, p, 'scout_recon', new SeededRandom('r'));
    expect(res.ok).toBe(true);
    expect(res.revealed).toBeGreaterThan(0);
    expect(state.playerIntel[enemy.id]).toBeDefined();
    expect(state.playerIntel[enemy.id]!.zoneId).toBe(adjacent);
  });

  it('NPC 使用时写入 knownEnemies 而不是玩家情报面板', () => {
    const state = newGame('fighter');
    const npc = anyEnemy(state);
    npc.characterId = 'scout';
    const player = playerOf(state);
    // 把玩家挪到 NPC 所在区域
    const oldZone = state.zones[player.currentZoneId]!;
    oldZone.aliveCharacterIds = oldZone.aliveCharacterIds.filter((id) => id !== player.id);
    player.currentZoneId = npc.currentZoneId;
    state.zones[npc.currentZoneId]!.aliveCharacterIds.push(player.id);

    const before = Object.keys(state.playerIntel).length;
    const res = useSkill(state, npc, 'scout_recon', new SeededRandom('r'));
    expect(res.ok).toBe(true);
    expect(npc.knownEnemies).toContain(player.id);
    // NPC 的侦察不该往玩家的情报面板里塞东西
    expect(Object.keys(state.playerIntel).length).toBe(before);
  });
});

describe('斗士 · 肾上腺素（战斗节奏）', () => {
  it('攻击体力成本下降，但有下限 1', () => {
    const state = newGame('fighter');
    const p = playerOf(state);
    const baseHeavy = attackStaminaCostFor(p, 'heavy');
    const baseQuick = attackStaminaCostFor(p, 'quick');

    useSkill(state, p, 'adrenaline', new SeededRandom('r'));
    expect(attackStaminaCostFor(p, 'heavy')).toBe(baseHeavy - 1);
    // quick 基础只要 1 点，打折后不能变成 0（免费攻击会破坏体力经济）
    expect(attackStaminaCostFor(p, 'quick')).toBe(Math.max(1, baseQuick - 1));
  });

  it('状态期间自身受到的战斗伤害提高', () => {
    const hit = (withSkill: boolean): number => {
      const state = newGame('fighter');
      const defender = playerOf(state);
      const attacker = anyEnemy(state);
      attacker.attack = 40;
      defender.defense = 2;
      defender.maxHp = 100000;
      defender.hp = defender.maxHp;
      defender.guarding = false;
      if (withSkill) useSkill(state, defender, 'adrenaline', new SeededRandom('r'));

      const rng = new SeededRandom('frenzy-compare');
      for (let i = 0; i < 200; i++) {
        attacker.stamina = attacker.maxStamina;
        const before = defender.hp;
        const res = resolveAttack(state, attacker, defender, rng, 'normal');
        if (res.hit) return before - defender.hp;
      }
      throw new Error('没有命中样本');
    };
    const plain = hit(false);
    const frenzied = hit(true);
    expect(frenzied).toBeGreaterThan(plain);
  });

  it('攻击次数用尽后状态自动消失', () => {
    const state = newGame('fighter');
    const p = playerOf(state);
    const enemy = anyEnemy(state);
    useSkill(state, p, 'adrenaline', new SeededRandom('r'));
    expect(p.statusEffects.some((e) => e.id === ADRENALINE_ID)).toBe(true);

    const rng = new SeededRandom('charges');
    for (let i = 0; i < GAME_CONFIG.skillAdrenalineAttacks; i++) {
      p.stamina = p.maxStamina;
      enemy.hp = enemy.maxHp;
      resolveAttack(state, p, enemy, rng, 'normal');
    }
    expect(p.statusEffects.some((e) => e.id === ADRENALINE_ID)).toBe(false);
    expect(state.events.some((e) => e.metadata?.statusId === ADRENALINE_ID)).toBe(true);
  });
});

describe('工程师 · 野外工造（合成）', () => {
  it('状态期间合成体力成本为 0', () => {
    const state = newGame('engineer');
    const p = playerOf(state);
    const base = getActionStaminaCost(p, 'CRAFT');
    expect(base).toBeGreaterThan(0);

    useSkill(state, p, 'field_craft', new SeededRandom('r'));
    expect(hasFieldCraftCharge(p)).toBe(true);
    expect(getActionStaminaCost(p, 'CRAFT')).toBe(0);
  });

  it('充能按次消耗，用尽后成本恢复', () => {
    const state = newGame('engineer');
    const p = playerOf(state);
    useSkill(state, p, 'field_craft', new SeededRandom('r'));

    for (let i = 0; i < GAME_CONFIG.skillFieldCraftCharges; i++) {
      expect(hasFieldCraftCharge(p)).toBe(true);
      consumeFieldCraftCharge(state, p);
    }
    expect(hasFieldCraftCharge(p)).toBe(false);
    expect(p.statusEffects.some((e) => e.id === FIELD_CRAFT_ID)).toBe(false);
    expect(getActionStaminaCost(p, 'CRAFT')).toBeGreaterThan(0);
  });
});

describe('医学生 · 紧急处置（消耗品经济）', () => {
  it('状态期间治疗类消耗品效果提升', () => {
    const state = newGame('medic');
    const p = playerOf(state);
    p.hp = 40;
    const before = healMultiplierOf(p);

    useSkill(state, p, 'emergency_treatment', new SeededRandom('r'));
    expect(p.statusEffects.some((e) => e.id === MEDICAL_FOCUS_ID)).toBe(true);
    expect(healMultiplierOf(p)).toBeCloseTo(
      before * GAME_CONFIG.skillTreatmentConsumableMult,
      5,
    );
  });

  it('施放时止血：清除所有持续掉血状态并回复少量生命', () => {
    const state = newGame('medic');
    const p = playerOf(state);
    p.hp = 40;
    p.statusEffects.push({
      id: 'test_bleed',
      remaining: 5,
      hpPerTick: -5,
      label: '流血',
    });

    const res = useSkill(state, p, 'emergency_treatment', new SeededRandom('r'));
    expect(res.ok).toBe(true);
    expect(res.hpHealed).toBeGreaterThan(0);
    expect(p.statusEffects.some((e) => e.hpPerTick < 0)).toBe(false);
  });
});

describe('四角色技能 · 命令集成', () => {
  it('USE_SKILL 命令释放并推进时间、写入事件', () => {
    const state = newGame('medic');
    const p = playerOf(state);
    p.hp = 40;
    const t0 = state.time;
    const r = executeCommand(state, { type: 'USE_SKILL', skillId: 'emergency_treatment' });
    expect(r.ok).toBe(true);
    expect(r.state.time).toBe(t0 + 1);
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
