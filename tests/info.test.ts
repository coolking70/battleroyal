import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '../src/data/gameConfig';
import {
  addNoise,
  decayNoise,
  INTEL_FRESH_WINDOW,
  listIntel,
  noiseLevelOf,
  NOISE_LABEL,
  PRESENCE_TEXT,
  recordIntel,
  refreshPlayerSight,
  zonePresence,
} from '../src/core/info';
import { refreshZoneOccupants } from '../src/core/gameState';
import { newGame, npcs, player } from './helpers';
import type { GameState } from '../src/core/types';

describe('噪音（信息不完全）', () => {
  it('噪音分档符合阈值', () => {
    const state = newGame();
    const z = Object.values(state.zones)[0]!;
    z.noiseLevel = 0;
    expect(noiseLevelOf(z)).toBe('quiet');
    z.noiseLevel = GAME_CONFIG.noiseActiveThreshold;
    expect(noiseLevelOf(z)).toBe('active');
    z.noiseLevel = GAME_CONFIG.noiseLoudThreshold;
    expect(noiseLevelOf(z)).toBe('loud');
    expect(NOISE_LABEL.quiet).toBe('安静');
  });

  it('制造噪音会累加，衰减会回落', () => {
    const state = newGame();
    const z = Object.values(state.zones)[0]!;
    z.noiseLevel = 0;
    addNoise(state, z.id, 'search');
    expect(z.noiseLevel).toBe(GAME_CONFIG.noiseFromSearch);
    const before = z.noiseLevel;
    decayNoise(state);
    expect(z.noiseLevel).toBe(Math.max(0, before - GAME_CONFIG.noiseDecayPerTick));
  });
});

describe('最后已知位置情报', () => {
  it('记录与刷新视野会写入情报，并带保鲜标记', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    recordIntel(state, npc.id, npc.currentZoneId, 'broadcast');
    let intel = listIntel(state);
    const entry = intel.find((i) => i.characterId === npc.id);
    expect(entry).toBeDefined();
    expect(entry!.fresh).toBe(true);
    expect(entry!.dead).toBe(false);

    // 时间推过保鲜窗后变陈旧
    state.time += INTEL_FRESH_WINDOW + 1;
    intel = listIntel(state);
    expect(intel.find((i) => i.characterId === npc.id)!.fresh).toBe(false);
  });

  it('只有遭遇中的同区域角色才会被刷新为「亲眼所见」', () => {
    const state = newGame();
    const p = player(state);
    const npc = npcs(state)[0]!;
    npc.currentZoneId = p.currentZoneId;
    npc.alive = true;
    refreshZoneOccupants(state);

    // 无遭遇时，共处同区域不应泄露身份（2A-E）
    refreshPlayerSight(state);
    expect(listIntel(state).find((i) => i.characterId === npc.id)).toBeUndefined();

    // 进入遭遇后，该对手被识别并记录
    state.encounter = {
      enemyId: npc.id,
      zoneId: npc.currentZoneId,
      startedAtTime: state.time,
      log: [],
      resolved: false,
    };
    refreshPlayerSight(state);
    const entry = listIntel(state).find((i) => i.characterId === npc.id);
    expect(entry).toBeDefined();
    expect(entry!.zoneId).toBe(p.currentZoneId);
    expect(entry!.source).toBe('sight');
  });
});

describe('同区域人员存在感（Phase 2A-1 信息隐藏）', () => {
  function bothInSameZone(state: GameState): void {
    const p = player(state);
    const npc = npcs(state)[0]!;
    npc.currentZoneId = p.currentZoneId;
    npc.alive = true;
    refreshZoneOccupants(state);
  }

  it('区域内只有玩家时为 none', () => {
    const state = newGame();
    expect(zonePresence(state)).toBe('none');
  });

  it('同区域有其他角色时给出非 none 的存在感，且不泄露身份或人数', () => {
    const state = newGame();
    bothInSameZone(state);
    const level = zonePresence(state);
    expect(level).not.toBe('none');
    // 提示文本只描述"有人活动"，绝不出现姓名 / 精确人数
    const text = PRESENCE_TEXT[level];
    expect(text).not.toMatch(/n\d|灰隼|铁砂|夜枭/);
    expect(text).not.toMatch(/\d+\s*人/);
  });

  it('噪音越高存在感分档越强（模糊分档，仍不泄露人数）', () => {
    const state = newGame();
    bothInSameZone(state);
    const zone = state.zones[player(state).currentZoneId]!;
    zone.noiseLevel = GAME_CONFIG.noiseLoudThreshold;
    const level = zonePresence(state);
    expect(['active', 'many']).toContain(level);
    expect(PRESENCE_TEXT[level]).not.toMatch(/\d+\s*人/);
  });
});
