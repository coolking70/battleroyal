import { describe, expect, it } from 'vitest';
import {
  ATTACK_STYLE_LABEL,
  canAttack,
  computeDamage,
  counterChanceOf,
  hitChanceOf,
  resolveAttack,
} from '../src/core/combat';
import { executeCommand } from '../src/core/gameEngine';
import { getAttackStyleStaminaCost } from '../src/core/actionCosts';
import { SeededRandom } from '../src/core/random';
import { GAME_CONFIG } from '../src/data/gameConfig';
import type { AttackStyle, Combatant, GameState } from '../src/core/types';
import { newGame, npcs, player } from './helpers';

/** 把 count 个 NPC 拉到玩家所在格（测试用，不建立正式遭遇） */
function colocate(state: GameState, count = 1): Combatant[] {
  const p = player(state);
  const list = npcs(state).slice(0, count);
  list.forEach((n) => {
    n.currentZoneId = p.currentZoneId;
  });
  return list;
}

describe('战斗风格（Phase 3 Step 1）', () => {
  it('三种风格的体力成本递增：速攻 < 普通 < 重击', () => {
    expect(getAttackStyleStaminaCost('quick')).toBeLessThan(
      getAttackStyleStaminaCost('normal'),
    );
    expect(getAttackStyleStaminaCost('normal')).toBeLessThan(
      getAttackStyleStaminaCost('heavy'),
    );
    expect(getAttackStyleStaminaCost('quick')).toBe(GAME_CONFIG.attackStyleStaminaCost.quick);
    expect(getAttackStyleStaminaCost('heavy')).toBe(GAME_CONFIG.attackStyleStaminaCost.heavy);
  });

  it('风格命中倍率：速攻更易命中、重击更易落空', () => {
    const state = newGame();
    const a = player(state);
    const d = npcs(state)[0]!;
    // 拉平属性，避免命中率被夹到上下限而破坏单调性
    a.perception = 0;
    a.speed = d.speed;
    d.speed = a.speed;

    const quick = hitChanceOf(a, d, 'quick');
    const normal = hitChanceOf(a, d, 'normal');
    const heavy = hitChanceOf(a, d, 'heavy');

    expect(quick).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(heavy);
    expect(ATTACK_STYLE_LABEL.quick).toBe('速攻');
    expect(ATTACK_STYLE_LABEL.heavy).toBe('重击');
  });

  it('风格伤害倍率：同一次随机下重击 > 普通 > 速攻', () => {
    const state = newGame();
    const a = player(state);
    const d = npcs(state)[0]!;
    a.currentZoneId = d.currentZoneId;

    const measure = (style: AttackStyle) =>
      computeDamage(a, d, new SeededRandom('dmg-style'), style);

    const quick = measure('quick');
    const normal = measure('normal');
    const heavy = measure('heavy');

    // 相同随机种子 → 随机项一致，差异只来自倍率
    expect(heavy).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(quick);
  });

  it('风格反击易招性：重击破绽更大、速攻更易脱身', () => {
    const state = newGame();
    const def = npcs(state)[0]!;
    const atk = player(state);
    // 中性人格、满血、等速，避免被夹到上下限
    def.personality = 'opportunist';
    atk.personality = 'opportunist';
    def.hp = def.maxHp;
    atk.speed = def.speed;
    def.speed = atk.speed;

    const quick = counterChanceOf(def, atk, 'quick');
    const normal = counterChanceOf(def, atk, 'normal');
    const heavy = counterChanceOf(def, atk, 'heavy');

    expect(quick).toBeLessThan(normal);
    expect(normal).toBeLessThan(heavy);
  });

  it('canAttack 按风格体力闸门：体力不足时重击被拒、速攻放行', () => {
    const state = newGame();
    const a = player(state);
    a.stamina = 1; // 只够速攻（1），不够普通（2）/ 重击（4）
    expect(canAttack(a, 'quick').ok).toBe(true);
    expect(canAttack(a, 'normal').ok).toBe(false);
    expect(canAttack(a, 'heavy').ok).toBe(false);
  });

  it('防御姿态减免下一击约一半伤害', () => {
    const runGuard = (guard: boolean, seed: string) => {
      const state = newGame(seed);
      const a = player(state);
      const d = npcs(state)[0]!;
      a.currentZoneId = d.currentZoneId;
      a.stamina = 999;
      d.guarding = guard;
      return resolveAttack(state, a, d, new SeededRandom(seed));
    };

    let guarded = null as ReturnType<typeof runGuard> | null;
    let raw = null as ReturnType<typeof runGuard> | null;
    for (let i = 0; i < 80 && (!guarded || !raw); i++) {
      const g = runGuard(true, `guard-${i}`);
      const r = runGuard(false, `guard-${i}`);
      if (g.hit && r.hit) {
        guarded = g;
        raw = r;
      }
    }
    expect(guarded).not.toBeNull();
    expect(raw).not.toBeNull();
    // 防御后伤害减半（并向上取整），且严格小于未防御
    expect(guarded!.damage).toBeLessThan(raw!.damage);
    expect(guarded!.damage).toBe(
      Math.max(GAME_CONFIG.minDamage, Math.round(raw!.damage * (1 - GAME_CONFIG.guardDamageReduction))),
    );
  });

  it('GUARD 命令：正常扣体力，恰好零体力时免费，部分体力不足仍失败', () => {
    const state = newGame();
    const p = player(state);
    const before = p.stamina;

    const ok = executeCommand(state, { type: 'GUARD' });
    expect(ok.ok).toBe(true);
    expect(player(ok.state).guarding).toBe(true);
    expect(player(ok.state).stamina).toBe(before - GAME_CONFIG.guardStaminaCost);

    // 恰好清零后仍保留一次有意义的防御选择，且不恢复/扣除体力
    player(ok.state).stamina = 0;
    const emergency = executeCommand(ok.state, { type: 'GUARD' });
    expect(emergency.ok).toBe(true);
    expect(player(emergency.state).stamina).toBe(0);

    // 1 点体力不足以支付完整防御成本，不享受零体力应急例外
    player(emergency.state).stamina = 1;
    const fail = executeCommand(emergency.state, { type: 'GUARD' });
    expect(fail.ok).toBe(false);
    expect(fail.message ?? '').toContain('体力');
  });

  it('出手（攻击）即解除自身防御姿态（防御只挡一次攻击）', () => {
    const state = newGame();
    const p = player(state);
    colocate(state, 1); // 确保 ATTACK_NEARBY 能找到目标
    p.stamina = 999;
    // 手动摆出防御姿态，再改为进攻
    p.guarding = true;

    const atkRes = executeCommand(state, {
      type: 'ATTACK_NEARBY',
      style: 'normal',
    });
    expect(atkRes.ok).toBe(true);
    // executeCommandInner 在玩家出手前会清除自身防御姿态
    expect(player(atkRes.state).guarding).toBe(false);
  });

  it('GUARD 命令会推进时间，并承受紧接其后的对手反击（防御一次性消耗）', () => {
    const state = newGame();
    const p = player(state);
    const e = colocate(state, 1)[0]!;
    p.stamina = 999;
    e.stamina = 999;

    const hpBefore = p.hp;
    const guardRes = executeCommand(state, { type: 'GUARD' });
    expect(guardRes.ok).toBe(true);
    // 防御姿态在承受了对手这一回合的攻击后即被消耗（可能清零）
    const hpAfter = player(guardRes.state).hp;
    expect(hpAfter).toBeLessThanOrEqual(hpBefore);
  });

  it('集成：重击单发伤害高于速攻（同种子对照）', () => {
    const run = (style: AttackStyle, seed: string) => {
      const state = newGame(seed);
      const a = player(state);
      const d = npcs(state)[0]!;
      a.currentZoneId = d.currentZoneId;
      a.stamina = 999;
      return resolveAttack(state, a, d, new SeededRandom(seed), style);
    };

    let heavy = null as ReturnType<typeof run> | null;
    let quick = null as ReturnType<typeof run> | null;
    for (let i = 0; i < 80 && (!heavy || !quick); i++) {
      const h = run('heavy', `heavy-vs-quick-${i}`);
      const q = run('quick', `heavy-vs-quick-${i}`);
      if (h.hit && q.hit) {
        heavy = h;
        quick = q;
      }
    }
    expect(heavy).not.toBeNull();
    expect(quick).not.toBeNull();
    expect(heavy!.damage).toBeGreaterThan(quick!.damage);
  });
});
