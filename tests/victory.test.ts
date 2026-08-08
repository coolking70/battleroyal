import { describe, expect, it } from 'vitest';
import { killCharacter } from '../src/core/combat';
import { executeCommand } from '../src/core/gameEngine';
import { getZoneDef } from '../src/data/zones';
import { newGame, npcs, player } from './helpers';

describe('胜负判定', () => {
  it('玩家是唯一存活者时判定胜利', () => {
    const state = newGame();
    const p = player(state);
    for (const npc of npcs(state)) {
      killCharacter(state, npc, p.id, '测试');
    }
    // 用一个不推进时间的自由行动触发胜负检查
    const res = executeCommand(state, { type: 'CLOSE_ENCOUNTER' });
    expect(res.state.status).toBe('won');
    expect(res.state.endedAtTime).toBe(res.state.time);
    expect(
      res.state.events.some(
        (e) => e.type === 'GAME_ENDED' && e.metadata.result === 'won',
      ),
    ).toBe(true);
  });

  it('玩家死亡时判定失败', () => {
    const state = newGame();
    const p = player(state);
    killCharacter(state, p, null, '测试');
    const res = executeCommand(state, { type: 'CLOSE_ENCOUNTER' });
    expect(res.ok).toBe(false);
    expect(res.state.status).toBe('lost');
    expect(
      res.state.events.some(
        (e) => e.type === 'GAME_ENDED' && e.metadata.result === 'lost',
      ),
    ).toBe(true);
  });

  it('对局结束后不能继续执行普通行动', () => {
    const state = newGame();
    const p = player(state);
    for (const npc of npcs(state)) killCharacter(state, npc, p.id, '测试');
    const won = executeCommand(state, { type: 'CLOSE_ENCOUNTER' }).state;
    expect(won.status).toBe('won');

    const target = getZoneDef(player(won).currentZoneId).adjacent[0]!;
    for (const cmd of [
      { type: 'MOVE', zoneId: target } as const,
      { type: 'SEARCH' } as const,
      { type: 'REST' } as const,
    ]) {
      const res = executeCommand(won, cmd);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('结束');
      expect(res.state.time).toBe(won.time);
    }
  });

  it('对局一定能结束：连续推进时间后必定分出胜负', () => {
    // 禁区每 6 个时间单位收缩一次，禁区伤害 20/回合，因此对局必然收敛
    for (const seed of ['BR-END-1', 'BR-END-2', 'BR-END-3', 'BR-DEMO-001']) {
      let state = newGame(seed);
      let guard = 0;
      while (state.status === 'playing' && guard < 400) {
        state = executeCommand(state, { type: 'DEBUG_ADVANCE_TIME' }).state;
        guard += 1;
      }
      expect(state.status).not.toBe('playing');
      expect(guard).toBeLessThan(400);
    }
  });

  it('相同种子 + 相同行动序列产生相同结果', () => {
    const run = (): { status: string; time: number; events: number } => {
      let state = newGame('BR-REPLAY');
      for (let i = 0; i < 40 && state.status === 'playing'; i++) {
        state = executeCommand(state, { type: 'DEBUG_ADVANCE_TIME' }).state;
      }
      return { status: state.status, time: state.time, events: state.events.length };
    };
    expect(run()).toEqual(run());
  });
});
