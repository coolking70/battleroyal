/**
 * EXPOSED（露出破绽）状态测试（Phase 3A Step 1 先写、Step 3 实现）。
 *
 * 设计意图：Heavy 在 Phase 3 里只有收益（高伤）没有风险，
 * EXPOSED 是给它配的那份风险 —— 挥空就把破绽卖给对手。
 *
 * 红线：
 *  - 只有 heavy **落空**才产生，quick / normal 落空都不产生；
 *  - 只影响**攻击类战斗伤害**，禁区 / 世界事件 / DoT / 终局衰竭都不吃这 20%；
 *  - 不可叠加，重复获得只刷新；
 *  - Heavy miss 本身不能「刚生成就被自己这次行动清掉」。
 */

import { describe, expect, it } from 'vitest';
import { resolveAttack } from '../src/core/combat';
import {
  EXPOSED_ID,
  applyExposed,
  exposedDamageMultiplier,
  hasExposed,
  noteOwnActionCompleted,
} from '../src/core/exposed';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { SeededRandom } from '../src/core/random';
import { applyDamage } from '../src/core/vitals';
import {
  createMemoryStorage,
  loadGame,
  saveGame,
  setStorage,
} from '../src/core/saveLoad';
import type { AttackStyle, Combatant, GameState } from '../src/core/types';
import { newGame, npcs, player } from './helpers';

/**
 * 反复出手直到出现一次指定风格的落空，返回落空后的状态。
 * 用确定性 RNG，不依赖运气。
 */
function attackUntilMiss(
  style: AttackStyle,
  seed = 'EXPOSED-MISS',
): { state: GameState; attacker: Combatant; defender: Combatant } {
  const state = newGame('EXPOSED-BASE', 'fighter');
  const attacker = player(state);
  const defender = npcs(state)[0]!;
  defender.maxHp = 100000;
  defender.hp = defender.maxHp;
  const rng = new SeededRandom(seed);

  for (let i = 0; i < 500; i++) {
    attacker.stamina = attacker.maxStamina;
    const res = resolveAttack(state, attacker, defender, rng, style);
    if (!res.hit) return { state, attacker, defender };
  }
  throw new Error(`${style} 在 500 次内没有落空，测试样本设计有问题`);
}

describe('EXPOSED 产生条件', () => {
  it('heavy 落空 → 攻击者获得 EXPOSED', () => {
    const { attacker } = attackUntilMiss('heavy');
    expect(hasExposed(attacker)).toBe(true);
  });

  it('quick 落空 → 不产生 EXPOSED', () => {
    const { attacker } = attackUntilMiss('quick');
    expect(hasExposed(attacker)).toBe(false);
  });

  it('normal 落空 → 不产生 EXPOSED', () => {
    const { attacker } = attackUntilMiss('normal');
    expect(hasExposed(attacker)).toBe(false);
  });

  it('heavy 命中 → 不产生 EXPOSED', () => {
    const state = newGame('EXPOSED-HIT', 'fighter');
    const attacker = player(state);
    const defender = npcs(state)[0]!;
    defender.maxHp = 100000;
    defender.hp = defender.maxHp;
    const rng = new SeededRandom('hit-only');

    for (let i = 0; i < 300; i++) {
      attacker.stamina = attacker.maxStamina;
      // 每次出手前清干净，只看「这一次命中」是否会错误地挂上 EXPOSED
      attacker.statusEffects = attacker.statusEffects.filter(
        (e) => e.id !== EXPOSED_ID,
      );
      const res = resolveAttack(state, attacker, defender, rng, 'heavy');
      if (res.hit) {
        expect(hasExposed(attacker), '命中不应产生 EXPOSED').toBe(false);
        return;
      }
    }
    throw new Error('样本内没有出现命中');
  });

  it('EXPOSED 事件被记录到日志', () => {
    const { state } = attackUntilMiss('heavy');
    // EXPOSED 不单独发事件，而是写进产生它的那条 ATTACK_MISSED 的 metadata：
    // 这样回放时「哪一次挥空造成了破绽」是一条记录而不是两条，模拟统计也好聚合。
    const evt = state.events.find(
      (e) => e.type === 'ATTACK_MISSED' && e.metadata?.exposed === true,
    );
    expect(evt, '应有一条能追溯 EXPOSED 的 ATTACK_MISSED 事件').toBeDefined();
  });
});

describe('EXPOSED 伤害修正', () => {
  it('EXPOSED 下受到战斗攻击伤害提升 20%', () => {
    // 同一组攻防、同一颗种子，只差 EXPOSED 的有无
    const runOnce = (withExposed: boolean): number => {
      const state = newGame('EXPOSED-DAMAGE', 'scout');
      const attacker = npcs(state)[0]!;
      const defender = player(state);
      // 关键：把基础伤害拉离 minDamage 下限。
      // 徒手 NPC 打有护甲的玩家只有 1 点伤害，1 × 1.2 取整后还是 1，
      // 20% 的加成会被取整整个吞掉，测出来就是「没生效」的假象。
      attacker.attack = 40;
      defender.defense = 2;
      defender.maxHp = 100000;
      defender.hp = defender.maxHp;
      defender.guarding = false;
      attacker.stamina = attacker.maxStamina;
      if (withExposed) applyExposed(state, defender);

      // 用一颗必定命中的 rng：把命中率推到上限并反复尝试
      const rng = new SeededRandom('dmg-compare');
      for (let i = 0; i < 200; i++) {
        attacker.stamina = attacker.maxStamina;
        const before = defender.hp;
        const res = resolveAttack(state, attacker, defender, rng, 'normal');
        if (res.hit) return before - defender.hp;
      }
      throw new Error('没有命中样本');
    };

    const plain = runOnce(false);
    const exposed = runOnce(true);
    expect(exposed).toBeGreaterThan(plain);
    // 允许取整误差
    const ratio = exposed / plain;
    expect(ratio).toBeGreaterThan(1.1);
    expect(ratio).toBeLessThan(1.35);
  });

  it('exposedDamageMultiplier 与配置一致', () => {
    const state = newGame('EXPOSED-MULT', 'scout');
    const p = player(state);
    expect(exposedDamageMultiplier(p)).toBe(1);
    applyExposed(state, p);
    expect(exposedDamageMultiplier(p)).toBe(GAME_CONFIG.exposedDamageMult);
  });

  it('EXPOSED 不影响非战斗伤害（禁区 / 世界事件 / 衰竭）', () => {
    const measure = (withExposed: boolean): number => {
      const state = newGame('EXPOSED-ENV', 'scout');
      const p = player(state);
      p.maxHp = 1000;
      p.hp = p.maxHp;
      if (withExposed) applyExposed(state, p);
      const before = p.hp;
      applyDamage(state, p, 20, null, '禁区侵蚀');
      return before - p.hp;
    };
    expect(measure(true)).toBe(measure(false));
    expect(measure(true)).toBe(20);
  });
});

describe('EXPOSED 生命周期', () => {
  it('不可叠加：连续 heavy miss 只刷新，不产生第二层', () => {
    const state = newGame('EXPOSED-STACK', 'fighter');
    const attacker = player(state);
    const defender = npcs(state)[0]!;
    defender.maxHp = 100000;
    defender.hp = defender.maxHp;
    const rng = new SeededRandom('stack');

    let misses = 0;
    for (let i = 0; i < 800 && misses < 3; i++) {
      attacker.stamina = attacker.maxStamina;
      const res = resolveAttack(state, attacker, defender, rng, 'heavy');
      if (!res.hit) misses += 1;
    }
    expect(misses, '需要至少 3 次落空才能验证叠加').toBeGreaterThanOrEqual(3);
    const layers = attacker.statusEffects.filter((e) => e.id === EXPOSED_ID);
    expect(layers.length).toBe(1);
  });

  it('条件A：受到成功的战斗伤害后立即移除', () => {
    const state = newGame('EXPOSED-CLEAR-A', 'scout');
    const defender = player(state);
    const attacker = npcs(state)[0]!;
    defender.maxHp = 100000;
    defender.hp = defender.maxHp;
    applyExposed(state, defender);
    expect(hasExposed(defender)).toBe(true);

    const rng = new SeededRandom('clear-a');
    for (let i = 0; i < 200; i++) {
      attacker.stamina = attacker.maxStamina;
      const res = resolveAttack(state, attacker, defender, rng, 'normal');
      if (res.hit) break;
    }
    expect(hasExposed(defender), '受击后应立即移除').toBe(false);
  });

  it('条件B：未受击时，自己完成下一次有效行动后移除', () => {
    const state = newGame('EXPOSED-CLEAR-B', 'scout');
    const p = player(state);
    applyExposed(state, p);
    expect(hasExposed(p)).toBe(true);

    // 产生 EXPOSED 的那一次行动（heavy miss 本身）不清除
    noteOwnActionCompleted(state, p);
    expect(hasExposed(p), 'heavy miss 本身不能立即生成又立即清除').toBe(true);

    // 下一次自己的有效行动完成后才移除
    noteOwnActionCompleted(state, p);
    expect(hasExposed(p)).toBe(false);
  });

  it('条件B 端到端：heavy miss 后再做一个动作，EXPOSED 消失', () => {
    const { state, attacker } = attackUntilMiss('heavy');
    expect(hasExposed(attacker)).toBe(true);
    noteOwnActionCompleted(state, attacker); // 对应 heavy miss 那次行动
    expect(hasExposed(attacker)).toBe(true);
    noteOwnActionCompleted(state, attacker); // 下一次行动
    expect(hasExposed(attacker)).toBe(false);
  });
});

describe('EXPOSED 存档', () => {
  it('可以序列化并原样恢复（且通过深度校验）', () => {
    setStorage(createMemoryStorage());
    const state = newGame('EXPOSED-SAVE', 'fighter');
    const p = player(state);
    applyExposed(state, p);
    expect(hasExposed(p)).toBe(true);

    expect(saveGame(state).ok).toBe(true);
    const loaded = loadGame();
    expect(loaded.ok, loaded.ok ? '' : loaded.error).toBe(true);
    if (!loaded.ok) return;
    const restored = loaded.data.state.characters[loaded.data.state.playerId]!;
    expect(hasExposed(restored)).toBe(true);
    expect(exposedDamageMultiplier(restored)).toBe(GAME_CONFIG.exposedDamageMult);
    setStorage(null);
  });
});
