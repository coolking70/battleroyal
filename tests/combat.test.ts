import { describe, expect, it } from 'vitest';
import {
  applyDamage,
  computeDamage,
  killCharacter,
  resolveAttack,
} from '../src/core/combat';
import { executeCommand } from '../src/core/gameEngine';
import { equipItem } from '../src/core/inventory';
import { SeededRandom } from '../src/core/random';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { clearInventory, give, newGame, npcs, player } from './helpers';

describe('战斗', () => {
  it('命中至少造成 1 点伤害', () => {
    const state = newGame();
    const p = player(state);
    const enemy = npcs(state)[0]!;
    // 极端情况：攻击力压到 0，防御拉到 999
    p.attack = 0;
    enemy.defense = 999;

    const rng = new SeededRandom('dmg');
    for (let i = 0; i < 50; i++) {
      expect(computeDamage(p, enemy, rng)).toBeGreaterThanOrEqual(
        GAME_CONFIG.minDamage,
      );
    }
  });

  it('防御与防具能降低伤害', () => {
    const state = newGame();
    const p = player(state);
    const enemy = npcs(state)[0]!;
    p.attack = 30;
    enemy.defense = 0;
    clearInventory(enemy);

    // 固定 rng 状态，保证两次随机波动一致
    const seedState = new SeededRandom('armor-test').getState();
    const bare = computeDamage(p, enemy, SeededRandom.fromState(seedState));

    give(state, enemy, 'plate_armor');
    equipItem(enemy, enemy.inventory[0]!.uid);
    const armored = computeDamage(p, enemy, SeededRandom.fromState(seedState));

    expect(armored).toBeLessThan(bare);
    expect(bare - armored).toBe(7); // 铁板护甲 7 点防御
  });

  it('武器会提高伤害', () => {
    const state = newGame();
    const p = player(state);
    const enemy = npcs(state)[0]!;
    clearInventory(p);
    const seedState = new SeededRandom('weapon-test').getState();
    const bare = computeDamage(p, enemy, SeededRandom.fromState(seedState));

    give(state, p, 'iron_pipe');
    equipItem(p, p.inventory[0]!.uid);
    const armed = computeDamage(p, enemy, SeededRandom.fromState(seedState));
    expect(armed).toBeGreaterThan(bare);
  });

  it('生命归零后角色死亡，并在原地留下最多 3 件掉落', () => {
    const state = newGame();
    const enemy = npcs(state)[0]!;
    clearInventory(enemy);
    give(state, enemy, 'iron_pipe');
    give(state, enemy, 'plate_armor');
    equipItem(enemy, enemy.inventory.find((s) => s.itemId === 'iron_pipe')!.uid);
    equipItem(enemy, enemy.inventory.find((s) => s.itemId === 'plate_armor')!.uid);
    give(state, enemy, 'medkit');
    give(state, enemy, 'wood');
    give(state, enemy, 'stone');

    const zoneId = enemy.currentZoneId;
    const p = player(state);
    const res = applyDamage(state, enemy, 9999, p.id, '测试');

    expect(res.died).toBe(true);
    expect(enemy.alive).toBe(false);
    expect(enemy.hp).toBe(0);
    expect(enemy.killedBy).toBe(p.id);
    expect(p.kills).toBe(1);
    expect(state.zones[zoneId]!.groundItems.length).toBeLessThanOrEqual(
      GAME_CONFIG.maxCorpseDrops,
    );
    expect(state.zones[zoneId]!.groundItems.length).toBe(3);
    expect(state.events.some((e) => e.type === 'CHARACTER_DIED')).toBe(true);
  });

  it('死亡角色会被移出区域存活列表', () => {
    const state = newGame();
    const enemy = npcs(state)[0]!;
    const zoneId = enemy.currentZoneId;
    killCharacter(state, enemy, null, '测试');
    expect(state.zones[zoneId]!.aliveCharacterIds).not.toContain(enemy.id);
  });

  it('死亡角色不能攻击', () => {
    const state = newGame();
    const p = player(state);
    const enemy = npcs(state)[0]!;
    enemy.currentZoneId = p.currentZoneId;
    p.alive = false;
    p.hp = 0;

    const res = executeCommand(state, { type: 'ATTACK', targetId: enemy.id, style: 'normal' });
    expect(res.ok).toBe(false);
  });

  it('不能攻击不在同一区域的目标', () => {
    const state = newGame();
    const p = player(state);
    const enemy = npcs(state).find((n) => n.currentZoneId !== p.currentZoneId);
    if (!enemy) return; // 该种子下所有人同区域时跳过
    const res = executeCommand(state, { type: 'ATTACK', targetId: enemy.id, style: 'normal' });
    expect(res.ok).toBe(false);
    expect(res.message).toContain('不在当前区域');
  });

  it('攻击会消耗体力并写入命中/未命中事件', () => {
    const state = newGame();
    const p = player(state);
    const enemy = npcs(state)[0]!;
    enemy.currentZoneId = p.currentZoneId;
    const rng = new SeededRandom('attack-event');
    const before = p.stamina;

    resolveAttack(state, p, enemy, rng);
    expect(p.stamina).toBe(before - GAME_CONFIG.attackStaminaCost);
    expect(
      state.events.some(
        (e) => e.type === 'ATTACK_HIT' || e.type === 'ATTACK_MISSED',
      ),
    ).toBe(true);
  });

  it('逃跑成功后会移动到相邻的非禁区', () => {
    const state = newGame();
    const p = player(state);
    const enemy = npcs(state)[0]!;
    enemy.currentZoneId = p.currentZoneId;
    p.speed = 99; // 保证逃跑判定几乎必定成功
    enemy.speed = 1;
    const fromZone = p.currentZoneId;

    const res = executeCommand(state, { type: 'ATTACK', targetId: enemy.id, style: 'normal' });
    const fleeRes = executeCommand(res.state, { type: 'FLEE' });
    const after = player(fleeRes.state);
    if (fleeRes.state.events.some((e) => e.metadata.success === true)) {
      expect(after.currentZoneId).not.toBe(fromZone);
      expect(fleeRes.state.zones[after.currentZoneId]!.status).not.toBe('restricted');
    }
  });
});
