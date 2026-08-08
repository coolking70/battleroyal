import { describe, expect, it } from 'vitest';
import { executeCommand } from '../src/core/gameEngine';
import { performSearch } from '../src/core/search';
import { SeededRandom } from '../src/core/random';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { newGame, player } from './helpers';

describe('搜索', () => {
  it('搜索消耗 5 点体力', () => {
    const state = newGame();
    const before = player(state).stamina;
    const res = executeCommand(state, { type: 'SEARCH' });
    expect(res.ok).toBe(true);
    expect(player(res.state).stamina).toBe(before - GAME_CONFIG.searchStaminaCost);
  });

  it('搜索会增加区域搜索次数并推进时间', () => {
    const state = newGame();
    const p = player(state);
    const zoneId = p.currentZoneId;
    const before = state.zones[zoneId]!.searchCount;

    const res = executeCommand(state, { type: 'SEARCH' });
    expect(res.state.zones[zoneId]!.searchCount).toBeGreaterThan(before);
    expect(player(res.state).stats.searches).toBe(1);
    expect(res.state.time).toBe(state.time + 1);
  });

  it('体力不足时不能搜索', () => {
    const state = newGame();
    player(state).stamina = GAME_CONFIG.searchStaminaCost - 1;

    const res = executeCommand(state, { type: 'SEARCH' });
    expect(res.ok).toBe(false);
    expect(res.message).toContain('体力不足');
    expect(res.state.time).toBe(state.time);
  });

  // 第二阶段变更：supply 从「永不归零的衰减系数」改为「真实剩余物资比例」。
  // 原断言 `supply >= supplyFloor` 已随 supplyFloor 一同删除，详见 AUDIT_FIXES.md。
  it('区域物资单调递减，且始终落在 [0,1] 区间', () => {
    const state = newGame();
    const p = player(state);
    const rng = new SeededRandom(state.rngState, true);
    const zone = state.zones[p.currentZoneId]!;

    expect(zone.initialLootCount).toBeGreaterThan(0);
    expect(zone.supply).toBeCloseTo(1, 6);

    let last = zone.supply;
    for (let i = 0; i < 40; i++) {
      p.stamina = p.maxStamina;
      performSearch(state, p, rng);
      expect(zone.supply).toBeLessThanOrEqual(last + 1e-9);
      expect(zone.supply).toBeGreaterThanOrEqual(0);
      last = zone.supply;
    }
    expect(zone.searchCount).toBe(40);
    // 剩余比例必须与库存件数严格一致
    expect(zone.remainingLootCount).toBe(
      zone.loot.reduce((sum, e) => sum + e.count, 0),
    );
    expect(zone.supply).toBeCloseTo(
      zone.remainingLootCount / zone.initialLootCount,
      6,
    );
  });

  it('搜索会产生结构化事件', () => {
    const state = newGame();
    const res = executeCommand(state, { type: 'SEARCH' });
    expect(res.state.events.some((e) => e.type === 'SEARCH_STARTED')).toBe(true);
  });

  it('相同种子下的搜索序列可复现', () => {
    const runOnce = (): string[] => {
      const state = newGame('BR-REPRO-1');
      const p = player(state);
      const rng = new SeededRandom(state.rngState, true);
      const out: string[] = [];
      for (let i = 0; i < 15; i++) {
        p.stamina = p.maxStamina;
        out.push(performSearch(state, p, rng).kind);
      }
      return out;
    };
    expect(runOnce()).toEqual(runOnce());
  });
});
