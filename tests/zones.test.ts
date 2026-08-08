import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../src/core/random';
import {
  announceWarning,
  applyZoneDamage,
  promoteWarnings,
  restrictedZoneIds,
  safeZoneIds,
  updateRestrictedZones,
} from '../src/core/restrictedZones';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { ZONE_IDS } from '../src/data/zones';
import { newGame, player } from './helpers';

describe('禁区', () => {
  it('预警区会在预警时长结束后变成正式禁区', () => {
    const state = newGame();
    const rng = new SeededRandom('zone-1');
    state.time = GAME_CONFIG.firstZoneEventTime;

    expect(announceWarning(state, rng)).toBe(true);
    const warned = ZONE_IDS.find((id) => state.zones[id]!.status === 'warning')!;
    expect(warned).toBeTruthy();
    expect(state.zones[warned]!.warningAtTime).toBe(state.time);

    // 预警未到期
    state.time += GAME_CONFIG.zoneWarningDuration - 1;
    promoteWarnings(state);
    expect(state.zones[warned]!.status).toBe('warning');

    // 预警到期
    state.time += 1;
    promoteWarnings(state);
    expect(state.zones[warned]!.status).toBe('restricted');
    expect(state.events.some((e) => e.type === 'ZONE_RESTRICTED')).toBe(true);
  });

  it('停留在禁区的角色每个时间单位受到 20 点伤害', () => {
    const state = newGame();
    const p = player(state);
    const zone = state.zones[p.currentZoneId]!;
    zone.status = 'restricted';
    zone.restrictedAtTime = state.time;

    const before = p.hp;
    applyZoneDamage(state);
    expect(before - p.hp).toBe(GAME_CONFIG.zoneDamagePerTick);
    expect(state.events.some((e) => e.type === 'ZONE_DAMAGE')).toBe(true);
  });

  it('禁区伤害可以致死', () => {
    const state = newGame();
    const p = player(state);
    state.zones[p.currentZoneId]!.status = 'restricted';
    p.hp = 5;
    applyZoneDamage(state);
    expect(p.alive).toBe(false);
    expect(p.hp).toBe(0);
  });

  it('不会一次性封锁全部区域，始终至少保留 1 个安全区', () => {
    const state = newGame();
    const rng = new SeededRandom('zone-lock');
    for (let i = 0; i < 30; i++) {
      state.time += 1;
      updateRestrictedZones(state, rng);
      expect(safeZoneIds(state).length).toBeGreaterThanOrEqual(
        GAME_CONFIG.minSafeZones,
      );
    }
    expect(restrictedZoneIds(state).length).toBeLessThan(ZONE_IDS.length);
  });

  it('禁区公布节奏符合配置：第 8 个时间单位首次公布，之后每 6 个单位一次', () => {
    const state = newGame();
    const rng = new SeededRandom('zone-schedule');
    const announcedAt: number[] = [];
    let lastWarningCount = 0;

    for (let t = 1; t <= 26; t++) {
      state.time = t;
      updateRestrictedZones(state, rng);
      const count = ZONE_IDS.filter(
        (id) => state.zones[id]!.status !== 'safe',
      ).length;
      if (count > lastWarningCount) {
        announcedAt.push(t);
        lastWarningCount = count;
      }
    }

    expect(announcedAt[0]).toBe(GAME_CONFIG.firstZoneEventTime);
    if (announcedAt.length > 1) {
      expect(announcedAt[1]! - announcedAt[0]!).toBe(GAME_CONFIG.zoneEventInterval);
    }
  });

  it('相同种子下禁区顺序可复现', () => {
    const run = (): string[] => {
      const state = newGame('BR-ZONE-REPRO');
      const rng = new SeededRandom(state.rngState, true);
      for (let t = 1; t <= 24; t++) {
        state.time = t;
        updateRestrictedZones(state, rng);
      }
      return ZONE_IDS.filter((id) => state.zones[id]!.status !== 'safe');
    };
    expect(run()).toEqual(run());
  });
});
