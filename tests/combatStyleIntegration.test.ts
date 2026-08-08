/**
 * 攻击风格「真实结算」集成测试（Phase 3A Step 1）。
 *
 * 背景：`hitChanceOf()` 单元测试早就绿了，但 `resolveAttack()` 内部漏传了 style，
 * 于是 UI 显示 60%、核心实际按 75% 掷骰。单测风格公式是不够的 ——
 * **必须在大样本下验证真实结算路径**，这才是这组测试存在的意义。
 *
 * 三条断言线：
 *  1. 实测命中率排序 quick > normal > heavy（允许统计误差）
 *  2. 理论概率 vs 实测概率偏差 <= 5 个百分点
 *  3. ATTACK_HIT / ATTACK_MISSED 事件 metadata 必须记录 style 与 chance
 */

import { describe, expect, it } from 'vitest';
import { hitChanceOf, resolveAttack } from '../src/core/combat';
import { SeededRandom } from '../src/core/random';
import type { AttackStyle, Combatant, GameState } from '../src/core/types';
import { newGame, npcs, player } from './helpers';

/** 单个风格的实测采样结果 */
interface StyleSample {
  style: AttackStyle;
  attempts: number;
  hits: number;
  /** 实测命中率 */
  actualRate: number;
  /** 理论命中率（hitChanceOf） */
  theoreticalRate: number;
  /** 命中时的平均伤害 */
  avgDamage: number;
}

/**
 * 在固定种子下反复调用 `resolveAttack`，统计真实命中率。
 *
 * 每次采样前把双方状态复位到同一基准（满血、满体力、无状态、无防御姿态、
 * 武器耐久拉满），确保样本之间彼此独立 —— 否则体力耗尽会让后续攻击全部失败，
 * 统计出来的是「体力曲线」而不是「命中率」。
 */
function sampleStyle(style: AttackStyle, attempts: number): StyleSample {
  const state: GameState = newGame('STYLE-INTEGRATION', 'scout');
  const attacker = player(state);
  const defender = npcs(state)[0]!;
  const rng = new SeededRandom(`style-${style}`);

  // 采样前先固定双方属性，让理论概率是一个恒定值
  attacker.perception = 10;
  attacker.speed = 10;
  attacker.attack = 12;
  defender.speed = 8;
  defender.defense = 2;
  defender.maxHp = 100000;

  const theoreticalRate = hitChanceOf(attacker, defender, style);

  let hits = 0;
  let damageSum = 0;
  for (let i = 0; i < attempts; i++) {
    // 复位：保证每次采样条件完全一致
    attacker.stamina = attacker.maxStamina;
    attacker.guarding = false;
    attacker.statusEffects = [];
    defender.hp = defender.maxHp;
    defender.guarding = false;
    defender.statusEffects = [];
    // 武器耐久不能耗尽，否则中途换成空手会改变伤害基准
    for (const st of defender.equipment) st.durability = 9999;
    for (const st of attacker.equipment) st.durability = 9999;

    const res = resolveAttack(state, attacker, defender, rng, style);
    if (res.hit) {
      hits += 1;
      damageSum += res.damage;
    }
  }

  return {
    style,
    attempts,
    hits,
    actualRate: hits / attempts,
    theoreticalRate,
    avgDamage: hits > 0 ? damageSum / hits : 0,
  };
}

describe('攻击风格真实结算（resolveAttack 集成）', () => {
  const ATTEMPTS = 3000;

  // 三种风格各采样一次，供多个用例复用（避免重复跑 9000 次结算）
  const quick = sampleStyle('quick', ATTEMPTS);
  const normal = sampleStyle('normal', ATTEMPTS);
  const heavy = sampleStyle('heavy', ATTEMPTS);

  it('测试1：实测命中率 quick > normal > heavy', () => {
    // 这三个数字来自真实 resolveAttack 掷骰，不是 hitChanceOf 公式
    expect(quick.actualRate).toBeGreaterThan(normal.actualRate);
    expect(normal.actualRate).toBeGreaterThan(heavy.actualRate);
  });

  it('测试1b：风格之间的实测差距足够显著（不是噪声）', () => {
    // attackStyleHitMult 是 1.15 / 1.0 / 0.8，差距应远大于 3000 样本的统计噪声
    expect(quick.actualRate - normal.actualRate).toBeGreaterThan(0.02);
    expect(normal.actualRate - heavy.actualRate).toBeGreaterThan(0.05);
  });

  it('测试2：理论概率与实测概率偏差不超过 5 个百分点', () => {
    for (const s of [quick, normal, heavy]) {
      const deviation = Math.abs(s.actualRate - s.theoreticalRate);
      expect(
        deviation,
        `${s.style}：理论 ${(s.theoreticalRate * 100).toFixed(1)}% / ` +
          `实测 ${(s.actualRate * 100).toFixed(1)}%，偏差 ${(deviation * 100).toFixed(1)}pp`,
      ).toBeLessThanOrEqual(0.05);
    }
  });

  it('测试2b：heavy 平均伤害高于 normal，normal 高于 quick', () => {
    expect(heavy.avgDamage).toBeGreaterThan(normal.avgDamage);
    expect(normal.avgDamage).toBeGreaterThan(quick.avgDamage);
  });

  it('测试3：ATTACK_HIT 与 ATTACK_MISSED 都记录 style 与 chance', () => {
    const state = newGame('STYLE-METADATA', 'fighter');
    const attacker = player(state);
    const defender = npcs(state)[0]!;
    defender.maxHp = 100000;
    defender.hp = defender.maxHp;
    const rng = new SeededRandom('metadata-probe');

    // 反复出手，直到同时收集到命中与落空两种事件
    for (let i = 0; i < 400; i++) {
      attacker.stamina = attacker.maxStamina;
      defender.hp = defender.maxHp;
      resolveAttack(state, attacker, defender, rng, 'heavy');
    }

    const hitEvents = state.events.filter((e) => e.type === 'ATTACK_HIT');
    const missEvents = state.events.filter((e) => e.type === 'ATTACK_MISSED');
    expect(hitEvents.length, '样本中应至少出现一次命中').toBeGreaterThan(0);
    expect(missEvents.length, '样本中应至少出现一次落空').toBeGreaterThan(0);

    for (const e of [...hitEvents, ...missEvents]) {
      expect(e.metadata?.style, `事件 ${e.type} 缺少 style`).toBe('heavy');
      expect(
        typeof e.metadata?.chance,
        `事件 ${e.type} 缺少 chance`,
      ).toBe('number');
    }
  });

  it('测试3b：metadata.chance 与 hitChanceOf 一致（UI 可信）', () => {
    const state = newGame('STYLE-CHANCE-MATCH', 'scout');
    const attacker = player(state);
    const defender = npcs(state)[0]!;
    defender.maxHp = 100000;
    defender.hp = defender.maxHp;
    const rng = new SeededRandom('chance-match');

    for (const style of ['quick', 'normal', 'heavy'] as const) {
      attacker.stamina = attacker.maxStamina;
      defender.hp = defender.maxHp;
      const expected = Math.round(hitChanceOf(attacker, defender, style) * 100);
      const before = state.events.length;
      resolveAttack(state, attacker, defender, rng, style);
      const produced = state.events
        .slice(before)
        .find((e) => e.type === 'ATTACK_HIT' || e.type === 'ATTACK_MISSED');
      expect(produced, `${style} 应产生攻击事件`).toBeDefined();
      expect(produced!.metadata?.chance, `${style} 的 chance 应等于 hitChanceOf`).toBe(
        expected,
      );
    }
  });

  it('回归护栏：resolveAttack 不得退回「忽略 style」的行为', () => {
    // 若有人再次把 hitChanceOf(a,b,style) 写回 hitChanceOf(a,b)，
    // quick 与 heavy 的实测命中率会收敛到同一个值，此断言立刻失败。
    const gap = quick.actualRate - heavy.actualRate;
    expect(
      gap,
      `quick(${(quick.actualRate * 100).toFixed(1)}%) 与 ` +
        `heavy(${(heavy.actualRate * 100).toFixed(1)}%) 命中率几乎相同，` +
        `说明 style 没有真正进入掷骰`,
    ).toBeGreaterThan(0.08);
  });
});

describe('攻击风格确定性', () => {
  it('同种子同风格序列可完全复现', () => {
    const run = (): number[] => {
      const state = newGame('STYLE-DETERMINISM', 'scout');
      const attacker = player(state);
      const defender = npcs(state)[0]!;
      defender.maxHp = 100000;
      defender.hp = defender.maxHp;
      const rng = new SeededRandom('determinism');
      const out: number[] = [];
      for (let i = 0; i < 50; i++) {
        attacker.stamina = attacker.maxStamina;
        defender.hp = defender.maxHp;
        const styles: AttackStyle[] = ['quick', 'normal', 'heavy'];
        const style = styles[i % 3]!;
        const r = resolveAttack(state, attacker, defender, rng, style);
        out.push(r.hit ? r.damage : -1);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });
});

/** 供其它测试与报告工具复用的采样器 */
export type { Combatant };
