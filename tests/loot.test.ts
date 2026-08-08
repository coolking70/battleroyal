/**
 * 第二阶段 · 第三步：有限物资系统。
 *
 * 核心不变量：
 * 1. 物资开局一次性生成，只减不增；
 * 2. 玩家与 NPC 共享同一份库存，先到先得；
 * 3. 搜空后该区域永远不再产出物品；
 * 4. 同种子生成的清单完全一致。
 */

import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { ZONE_IDS } from '../src/data/zones';
import { tryGetItem } from '../src/data/items';
import { refreshZoneOccupants } from '../src/core/gameState';
import { SeededRandom } from '../src/core/random';
import { performSearch } from '../src/core/search';
import {
  countLoot,
  globalLootRatio,
  isZoneExhausted,
  supplyStatusOf,
  takeLootItem,
} from '../src/core/zoneLoot';
import type { GameState } from '../src/core/types';
import { clearInventory, newGame, npcs, player } from './helpers';

const MAX_PER_ZONE = GAME_CONFIG.zoneLootNormalMax + GAME_CONFIG.zoneLootRareMax;
const MIN_PER_ZONE = GAME_CONFIG.zoneLootNormalMin + GAME_CONFIG.zoneLootRareMin;

/** 把所有 NPC 赶到一个与玩家无关的区域，避免搜索被"遭遇"抢占 */
function isolatePlayer(state: GameState): void {
  const p = player(state);
  const elsewhere = ZONE_IDS.find((id) => id !== p.currentZoneId) ?? 'forest';
  for (const npc of npcs(state)) npc.currentZoneId = elsewhere;
  refreshZoneOccupants(state);
}

describe('有限物资 · 生成', () => {
  it('每个区域开局都有落在配置区间内的物资', () => {
    const state = newGame();
    for (const zoneId of ZONE_IDS) {
      const zone = state.zones[zoneId]!;
      expect(zone.initialLootCount).toBeGreaterThanOrEqual(MIN_PER_ZONE);
      expect(zone.initialLootCount).toBeLessThanOrEqual(MAX_PER_ZONE);
      expect(zone.remainingLootCount).toBe(zone.initialLootCount);
      expect(countLoot(zone.loot)).toBe(zone.initialLootCount);
      expect(zone.supply).toBeCloseTo(1, 6);
    }
  });

  it('库存里的每一件物品都是真实存在的物品', () => {
    const state = newGame();
    for (const zoneId of ZONE_IDS) {
      for (const entry of state.zones[zoneId]!.loot) {
        expect(tryGetItem(entry.itemId)).not.toBeNull();
        expect(entry.count).toBeGreaterThan(0);
      }
    }
  });

  it('同种子生成的物资清单完全一致，不同种子则不同', () => {
    const a = newGame('BR-LOOT-1');
    const b = newGame('BR-LOOT-1');
    const c = newGame('BR-LOOT-2');

    const dump = (s: GameState) =>
      JSON.stringify(ZONE_IDS.map((id) => s.zones[id]!.loot));

    expect(dump(a)).toBe(dump(b));
    expect(dump(a)).not.toBe(dump(c));
  });
});

describe('有限物资 · 扣减', () => {
  it('每取走一件，剩余件数与比例同步下降', () => {
    const state = newGame();
    const rng = new SeededRandom(state.rngState, true);
    const zone = state.zones[ZONE_IDS[0]!]!;
    const initial = zone.initialLootCount;

    for (let i = 1; i <= 5; i++) {
      const taken = takeLootItem(zone, rng, false);
      expect(taken).not.toBeNull();
      expect(zone.remainingLootCount).toBe(initial - i);
      expect(zone.supply).toBeCloseTo((initial - i) / initial, 6);
    }
  });

  it('取空之后只会返回 null，永远不会凭空补充', () => {
    const state = newGame();
    const rng = new SeededRandom(state.rngState, true);
    const zone = state.zones[ZONE_IDS[0]!]!;

    let taken = 0;
    while (takeLootItem(zone, rng, false) !== null) {
      taken += 1;
      expect(taken).toBeLessThanOrEqual(MAX_PER_ZONE);
    }
    expect(taken).toBe(zone.initialLootCount);
    expect(isZoneExhausted(zone)).toBe(true);
    expect(zone.remainingLootCount).toBe(0);
    expect(zone.supply).toBe(0);

    for (let i = 0; i < 20; i++) {
      expect(takeLootItem(zone, rng, false)).toBeNull();
    }
  });
});

describe('有限物资 · 共享与搜空', () => {
  it('玩家与 NPC 共享同一份库存', () => {
    const state = newGame();
    const p = player(state);
    const rng = new SeededRandom(state.rngState, true);
    const zone = state.zones[p.currentZoneId]!;

    // 把一个 NPC 拉到玩家所在区域，让它也在这里搜
    const npc = npcs(state)[0]!;
    npc.currentZoneId = p.currentZoneId;
    refreshZoneOccupants(state);

    const before = zone.remainingLootCount;
    let consumed = 0;
    for (let i = 0; i < 10; i++) {
      npc.stamina = npc.maxStamina;
      clearInventory(npc);
      if (performSearch(state, npc, rng).kind === 'item') consumed += 1;
    }
    expect(zone.remainingLootCount).toBe(before - consumed);
    expect(consumed).toBeGreaterThan(0);
  });

  it('区域被搜空时会广播事件并计入全局统计', () => {
    const state = newGame();
    const p = player(state);
    isolatePlayer(state);
    const rng = new SeededRandom(state.rngState, true);
    const zone = state.zones[p.currentZoneId]!;

    for (let i = 0; i < 400 && !isZoneExhausted(zone); i++) {
      p.stamina = p.maxStamina;
      clearInventory(p);
      performSearch(state, p, rng);
    }

    expect(isZoneExhausted(zone)).toBe(true);
    expect(state.stats.zonesExhausted).toBe(1);
    const exhaustedEvents = state.events.filter((e) => e.type === 'ZONE_EXHAUSTED');
    expect(exhaustedEvents).toHaveLength(1);
    expect(exhaustedEvents[0]!.zoneId).toBe(zone.id);

    // 搜空之后继续搜，事件不会重复播报，也不会再产出物品
    for (let i = 0; i < 25; i++) {
      p.stamina = p.maxStamina;
      clearInventory(p);
      expect(performSearch(state, p, rng).kind).not.toBe('item');
    }
    expect(state.events.filter((e) => e.type === 'ZONE_EXHAUSTED')).toHaveLength(1);
    expect(zone.searchedEmptyCount).toBeGreaterThan(0);
  });
});

describe('有限物资 · 展示分档', () => {
  it('剩余比例映射到正确的模糊分档', () => {
    const state = newGame();
    const zone = state.zones[ZONE_IDS[0]!]!;

    expect(supplyStatusOf(zone)).toBe('rich');

    zone.remainingLootCount = Math.ceil(zone.initialLootCount * 0.45);
    zone.supply = zone.remainingLootCount / zone.initialLootCount;
    expect(supplyStatusOf(zone)).toBe('normal');

    zone.remainingLootCount = 1;
    zone.supply = 1 / zone.initialLootCount;
    expect(supplyStatusOf(zone)).toBe('scarce');

    zone.remainingLootCount = 0;
    zone.supply = 0;
    expect(supplyStatusOf(zone)).toBe('empty');
  });

  it('全场剩余物资比例随搜索单调下降', () => {
    const state = newGame();
    const p = player(state);
    isolatePlayer(state);
    const rng = new SeededRandom(state.rngState, true);

    let last = globalLootRatio(state);
    expect(last).toBeCloseTo(1, 6);

    for (let i = 0; i < 30; i++) {
      p.stamina = p.maxStamina;
      clearInventory(p);
      performSearch(state, p, rng);
      const now = globalLootRatio(state);
      expect(now).toBeLessThanOrEqual(last + 1e-9);
      last = now;
    }
    expect(last).toBeLessThan(1);
  });
});
