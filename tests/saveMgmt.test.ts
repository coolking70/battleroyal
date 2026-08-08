import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GAME_VERSION, LEGACY_SAVE_KEYS, SAVE_KEY } from '../src/data/gameConfig';
import {
  clearLegacySaves,
  clearSave,
  createMemoryStorage,
  findLegacySaves,
  hasAnySave,
  loadGame,
  saveGame,
  setStorage,
  validateSaveData,
  type StorageLike,
} from '../src/core/saveLoad';
import { newGame } from './helpers';
import type { GameState } from '../src/core/types';

let storage: StorageLike;

beforeEach(() => {
  storage = createMemoryStorage();
  setStorage(storage);
});

afterEach(() => {
  setStorage(null);
});

describe('存档管理（Step 7）', () => {
  it('clearSave 会删除 v2 存档', () => {
    saveGame(newGame());
    expect(hasAnySave()).toBe(true);
    clearSave();
    expect(hasAnySave()).toBe(false);
  });

  it('能发现并删除旧版本（0.1.0）存档，不做静默迁移', () => {
    // 写入一份伪造的旧版本存档
    storage.setItem(
      LEGACY_SAVE_KEYS[0]!,
      JSON.stringify({ version: '0.1.0', state: {} }),
    );
    const found = findLegacySaves();
    expect(found.length).toBe(1);
    expect(found[0]!.version).toBe('0.1.0');

    const removed = clearLegacySaves();
    expect(removed).toBe(1);
    expect(findLegacySaves().length).toBe(0);
  });

  it('损坏的存档（无法解析）会被拒绝并暴露错误', () => {
    storage.setItem(SAVE_KEY, '{ this is not json');
    const res = loadGame();
    expect(res.ok).toBe(false);
    expect(res.error).toContain('损坏');
    expect(hasAnySave()).toBe(true);
  });
});

describe('存档深度校验（Step 7）', () => {
  function wrap(state: GameState): unknown {
    // Phase 2A-1：顶层 SaveData 契约（version / savedAt / seed / time / rngState / state）
    return {
      version: GAME_VERSION,
      savedAt: Date.now(),
      seed: state.seed,
      time: state.time,
      rngState: state.rngState,
      state,
    };
  }

  it('拒绝「血量为 0 的活人」', () => {
    const s = newGame();
    const id = s.playerId;
    s.characters[id]!.hp = 0;
    s.characters[id]!.alive = true;
    const report = validateSaveData(wrap(s));
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes('血量为 0 的活人'))).toBe(true);
  });

  it('拒绝越界的生命值', () => {
    const s = newGame();
    const id = s.playerId;
    s.characters[id]!.hp = s.characters[id]!.maxHp + 50;
    const report = validateSaveData(wrap(s));
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes('hp 越界'))).toBe(true);
  });

  it('拒绝持有未知物品', () => {
    const s = newGame();
    s.characters[s.playerId]!.inventory.push({
      uid: 'x1',
      itemId: 'does_not_exist',
      count: 1,
    });
    const report = validateSaveData(wrap(s));
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes('未知物品'))).toBe(true);
  });

  it('合法存档通过校验', () => {
    const s = newGame();
    const report = validateSaveData(wrap(s));
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
  });
});
