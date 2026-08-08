import { describe, expect, it } from 'vitest';
import { executeCommand } from '../src/core/gameEngine';
import { getZoneDef } from '../src/data/zones';
import { newGame, player } from './helpers';

describe('移动', () => {
  it('可以移动到相邻区域', () => {
    const state = newGame();
    const p = player(state);
    const target = getZoneDef(p.currentZoneId).adjacent[0]!;

    const res = executeCommand(state, { type: 'MOVE', zoneId: target });
    expect(res.ok).toBe(true);
    expect(player(res.state).currentZoneId).toBe(target);
  });

  it('不能移动到不相邻的区域', () => {
    const state = newGame();
    const p = player(state);
    const def = getZoneDef(p.currentZoneId);
    const nonAdjacent = ['school', 'hospital', 'residential', 'factory', 'forest', 'lab'].find(
      (id) => id !== p.currentZoneId && !def.adjacent.includes(id),
    )!;

    const res = executeCommand(state, { type: 'MOVE', zoneId: nonAdjacent });
    expect(res.ok).toBe(false);
    expect(res.message).toContain('相邻');
    expect(player(res.state).currentZoneId).toBe(p.currentZoneId);
  });

  it('不能移动到不存在的区域', () => {
    const state = newGame();
    const res = executeCommand(state, { type: 'MOVE', zoneId: 'atlantis' });
    expect(res.ok).toBe(false);
    expect(res.message).toContain('不存在');
  });

  it('不能原地移动', () => {
    const state = newGame();
    const p = player(state);
    const res = executeCommand(state, { type: 'MOVE', zoneId: p.currentZoneId });
    expect(res.ok).toBe(false);
  });

  it('死亡角色不能移动', () => {
    const state = newGame();
    const p = player(state);
    p.alive = false;
    p.hp = 0;
    const target = getZoneDef(p.currentZoneId).adjacent[0]!;

    const res = executeCommand(state, { type: 'MOVE', zoneId: target });
    expect(res.ok).toBe(false);
    expect(player(res.state).currentZoneId).toBe(p.currentZoneId);
  });

  it('移动会推进时间并记录事件', () => {
    const state = newGame();
    const p = player(state);
    const target = getZoneDef(p.currentZoneId).adjacent[0]!;
    const res = executeCommand(state, { type: 'MOVE', zoneId: target });

    expect(res.state.time).toBe(state.time + 1);
    expect(res.state.events.some((e) => e.type === 'CHARACTER_MOVED')).toBe(true);
    expect(res.state.stats.moves).toBeGreaterThanOrEqual(1);
  });

  it('执行命令不会修改传入的原状态', () => {
    const state = newGame();
    const before = JSON.stringify(state);
    const target = getZoneDef(player(state).currentZoneId).adjacent[0]!;
    executeCommand(state, { type: 'MOVE', zoneId: target });
    expect(JSON.stringify(state)).toBe(before);
  });
});
