/**
 * 第二阶段 · 第四步：阶段推进与终局收束。
 *
 * 第一阶段没有任何"必然结束"的保证，只要所有人苟着就能无限拖。
 * 本文件保证：
 * 1. 阶段只前进不回退；
 * 2. 三个终局触发条件各自都能生效；
 * 3. 终局衰竭伤害递增且有上限；
 * 4. 无论如何都不会超过 hardTimeLimit。
 */

import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { ZONE_IDS } from '../src/data/zones';
import { executeCommand } from '../src/core/gameEngine';
import { killCharacter } from '../src/core/vitals';
import {
  advancePhase,
  applyFinaleDecay,
  enforceTimeLimit,
  finaleDecayDamage,
  finaleTrigger,
} from '../src/core/phase';
import { zoneDamagePerTick } from '../src/core/restrictedZones';
import { syncSupplyRatio } from '../src/core/zoneLoot';
import type { GameState } from '../src/core/types';
import { newGame, npcs, player } from './helpers';

/** 把全场物资清空（模拟"没东西可搜了"） */
function drainAllLoot(state: GameState): void {
  for (const zoneId of ZONE_IDS) {
    const zone = state.zones[zoneId]!;
    zone.loot = [];
    syncSupplyRatio(zone);
  }
}

describe('阶段推进', () => {
  it('开局阶段为 opening，且每个角色的最远阶段同步记录', () => {
    const state = newGame();
    expect(state.phase).toBe('opening');
    expect(state.finaleStartedAt).toBeNull();
    expect(player(state).furthestPhase).toBe('opening');
  });

  it('时间到达 midgameStartTime 后进入中局', () => {
    const state = newGame();
    state.time = GAME_CONFIG.midgameStartTime;
    expect(advancePhase(state)).toBe(true);
    expect(state.phase).toBe('midgame');
    expect(
      state.events.some(
        (e) => e.type === 'PHASE_CHANGED' && e.metadata.phase === 'midgame',
      ),
    ).toBe(true);
  });

  it('阶段只前进不回退', () => {
    const state = newGame();
    state.time = GAME_CONFIG.finaleForcedTime;
    advancePhase(state);
    expect(state.phase).toBe('finale');

    // 即便把时间调回去，也不会退回中局
    state.time = 1;
    advancePhase(state);
    expect(state.phase).toBe('finale');
  });
});

describe('终局触发', () => {
  it('触发条件一：时间到达 finaleForcedTime', () => {
    const state = newGame();
    state.time = GAME_CONFIG.finaleForcedTime;
    expect(finaleTrigger(state)).toBe('time');
    advancePhase(state);
    expect(state.phase).toBe('finale');
    expect(state.finaleStartedAt).toBe(state.time);
  });

  it('触发条件二：存活人数降到阈值以下', () => {
    const state = newGame();
    const all = npcs(state);
    // 6 人开局，杀到只剩 2 人
    for (const npc of all.slice(0, 4)) killCharacter(state, npc, null, '测试');
    expect(finaleTrigger(state)).toBe('survivors');
    advancePhase(state);
    expect(state.phase).toBe('finale');
  });

  it('触发条件三：全场物资告罄', () => {
    const state = newGame();
    drainAllLoot(state);
    expect(finaleTrigger(state)).toBe('loot');
    advancePhase(state);
    expect(state.phase).toBe('finale');
    expect(
      state.events.some(
        (e) => e.type === 'PHASE_CHANGED' && e.metadata.trigger === 'loot',
      ),
    ).toBe(true);
  });

  it('未满足任何条件时不会进入终局', () => {
    const state = newGame();
    expect(finaleTrigger(state)).toBeNull();
    advancePhase(state);
    expect(state.phase).toBe('opening');
  });
});

describe('终局衰竭', () => {
  it('衰竭伤害随终局时长递增，并被上限夹住', () => {
    const state = newGame();
    state.phase = 'finale';
    state.finaleStartedAt = 10;

    state.time = 10;
    expect(finaleDecayDamage(state)).toBe(GAME_CONFIG.finaleDecayBase);

    state.time = 13;
    expect(finaleDecayDamage(state)).toBe(
      GAME_CONFIG.finaleDecayBase + 3 * GAME_CONFIG.finaleDecayGrowth,
    );

    state.time = 10_000;
    expect(finaleDecayDamage(state)).toBe(GAME_CONFIG.finaleDecayMax);
  });

  it('非终局阶段不产生任何衰竭伤害', () => {
    const state = newGame();
    const before = player(state).hp;
    applyFinaleDecay(state);
    expect(player(state).hp).toBe(before);
    expect(finaleDecayDamage(state)).toBe(0);
  });

  it('衰竭对所有存活者生效，无处可躲', () => {
    const state = newGame();
    state.phase = 'finale';
    state.finaleStartedAt = state.time;

    // 故意把所有人分散到不同区域，证明躲藏无效
    const everyone = [player(state), ...npcs(state)];
    everyone.forEach((c, i) => {
      c.currentZoneId = ZONE_IDS[i % ZONE_IDS.length]!;
    });
    const before = everyone.map((c) => c.hp);

    applyFinaleDecay(state);

    everyone.forEach((c, i) => {
      expect(c.hp).toBeLessThan(before[i]!);
    });
    expect(state.events.some((e) => e.type === 'FINALE_DECAY')).toBe(true);
  });

  it('终局阶段的禁区伤害被放大', () => {
    const state = newGame();
    expect(zoneDamagePerTick(state)).toBe(GAME_CONFIG.zoneDamagePerTick);
    state.phase = 'finale';
    expect(zoneDamagePerTick(state)).toBe(
      Math.round(
        GAME_CONFIG.zoneDamagePerTick * GAME_CONFIG.zoneDamageFinaleMultiplier,
      ),
    );
  });
});

describe('时间硬上限', () => {
  it('到达 hardTimeLimit 时强制结算并记录 endReason', () => {
    const state = newGame();
    state.time = GAME_CONFIG.hardTimeLimit;
    expect(enforceTimeLimit(state)).toBe(true);
    expect(state.status).not.toBe('playing');
    expect(state.endReason).toBe('time_limit');
    expect(state.endedAtTime).toBe(GAME_CONFIG.hardTimeLimit);
    expect(
      state.events.some(
        (e) => e.type === 'GAME_ENDED' && e.metadata.reason === 'time_limit',
      ),
    ).toBe(true);
  });

  it('到达硬上限一律判平局，不因血量高低改变（2A-D）', () => {
    // 玩家满血、其余 NPC 仅 1 血——按旧逻辑会判胜，新规则必须为平局
    const win = newGame();
    win.time = GAME_CONFIG.hardTimeLimit;
    for (const npc of npcs(win)) npc.hp = 1;
    player(win).hp = player(win).maxHp;
    enforceTimeLimit(win);
    expect(win.status).toBe('draw');
    expect(win.endReason).toBe('time_limit');
    const ended = win.events.find((e) => e.type === 'GAME_ENDED');
    expect(ended?.metadata.hardLimitReached).toBe(true);

    // 玩家仅 1 血——按旧逻辑会判负，新规则同样为平局
    const lose = newGame();
    lose.time = GAME_CONFIG.hardTimeLimit;
    player(lose).hp = 1;
    enforceTimeLimit(lose);
    expect(lose.status).toBe('draw');
  });

  it('多个种子的完整对局都在硬上限之内结束', () => {
    for (const seed of ['BR-FIN-1', 'BR-FIN-2', 'BR-FIN-3', 'BR-DEMO-001']) {
      let state = newGame(seed);
      let guard = 0;
      while (state.status === 'playing' && guard < GAME_CONFIG.hardTimeLimit + 10) {
        state = executeCommand(state, { type: 'DEBUG_ADVANCE_TIME' }).state;
        guard += 1;
      }
      expect(state.status).not.toBe('playing');
      expect(state.time).toBeLessThanOrEqual(GAME_CONFIG.hardTimeLimit);
      expect(state.endReason).not.toBeNull();
    }
  });

  it('对局在终局阶段收敛，不会长时间僵持', () => {
    let state = newGame('BR-FIN-CONVERGE');
    let guard = 0;
    while (state.status === 'playing' && guard < GAME_CONFIG.hardTimeLimit + 10) {
      state = executeCommand(state, { type: 'DEBUG_ADVANCE_TIME' }).state;
      guard += 1;
    }
    // 进入终局后，衰竭伤害每回合递增，收束时间必须远小于硬上限
    if (state.finaleStartedAt !== null) {
      expect(state.time - state.finaleStartedAt).toBeLessThan(40);
    }
    expect(state.status).not.toBe('playing');
  });
});
