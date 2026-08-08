import { beforeEach, describe, expect, it } from 'vitest';
import { executeCommand } from '../src/core/gameEngine';
import { SeededRandom } from '../src/core/random';
import {
  clearSave,
  createMemoryStorage,
  hasResumableSave,
  isValidSaveData,
  loadGame,
  saveGame,
  setStorage,
  type StorageLike,
} from '../src/core/saveLoad';
import { GAME_VERSION, SAVE_KEY } from '../src/data/gameConfig';
import { newGame, player } from './helpers';

let storage: StorageLike;

beforeEach(() => {
  storage = createMemoryStorage();
  setStorage(storage);
});

describe('本地存档', () => {
  it('保存后可以恢复主要状态', () => {
    let state = newGame();
    state = executeCommand(state, { type: 'SEARCH' }).state;
    state = executeCommand(state, { type: 'REST' }).state;

    expect(saveGame(state).ok).toBe(true);
    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const restored = loaded.data.state;
    expect(restored.seed).toBe(state.seed);
    expect(restored.time).toBe(state.time);
    expect(restored.status).toBe(state.status);
    expect(Object.keys(restored.characters)).toEqual(Object.keys(state.characters));
    expect(player(restored).hp).toBe(player(state).hp);
    expect(player(restored).stamina).toBe(player(state).stamina);
    expect(restored.events.length).toBe(state.events.length);
  });

  it('随机数状态可以恢复，后续序列一致', () => {
    let state = newGame();
    state = executeCommand(state, { type: 'SEARCH' }).state;
    saveGame(state);

    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.data.state.rngState).toBe(state.rngState);

    const a = SeededRandom.fromState(state.rngState);
    const b = SeededRandom.fromState(loaded.data.state.rngState);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('从存档继续游戏，行为与未存档时一致', () => {
    let state = newGame('BR-SAVE-REPLAY');
    for (let i = 0; i < 3; i++) {
      state = executeCommand(state, { type: 'DEBUG_ADVANCE_TIME' }).state;
    }
    saveGame(state);
    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const direct = executeCommand(state, { type: 'DEBUG_ADVANCE_TIME' }).state;
    const resumed = executeCommand(loaded.data.state, {
      type: 'DEBUG_ADVANCE_TIME',
    }).state;

    expect(resumed.time).toBe(direct.time);
    expect(resumed.rngState).toBe(direct.rngState);
    expect(resumed.events.length).toBe(direct.events.length);
  });

  it('损坏存档不会导致崩溃，只返回可读错误', () => {
    storage.setItem(SAVE_KEY, '{ this is not json');
    const res = loadGame();
    expect(res.ok).toBe(false);
    expect(res.error).toContain('损坏');
  });

  it('结构不完整的存档会被识别为无效', () => {
    storage.setItem(SAVE_KEY, JSON.stringify({ version: '0.1.0', seed: 'x' }));
    const res = loadGame();
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(isValidSaveData({ version: '0.1.0', seed: 'x' })).toBe(false);
  });

  it('版本不匹配的存档会被拒绝', () => {
    const state = newGame();
    saveGame(state);
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as Record<string, unknown>;
    raw.version = '0.0.1-old';
    storage.setItem(SAVE_KEY, JSON.stringify(raw));

    const res = loadGame();
    expect(res.ok).toBe(false);
    expect(res.error).toContain('版本');
  });

  it('Phase 3A-1：0.3.0 及更早存档被明确拒绝，不做迁移', () => {
    // Phase 3A-1 版本 0.3.1（技能/事件数值回归规格）；0.3.0 及更早存档
    // 里的旧技能语义 / 旧事件字段在新规则下没有对应，宁可拒绝不做迁移。
    expect(GAME_VERSION).toBe('0.3.1');

    const state = newGame();
    saveGame(state);
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as Record<string, unknown>;
    raw.version = '0.3.0';
    storage.setItem(SAVE_KEY, JSON.stringify(raw));

    const res = loadGame();
    expect(res.ok).toBe(false);
    expect(res.error).toContain('版本');
    // 拒绝 ≠ 静默清档：原始数据仍在，用户可以自己导出备份
    expect(storage.getItem(SAVE_KEY)).toBeTruthy();
  });

  it('可以删除存档', () => {
    saveGame(newGame());
    expect(hasResumableSave()).toBe(true);
    clearSave();
    expect(hasResumableSave()).toBe(false);
    expect(loadGame().ok).toBe(false);
  });

  it('已结束的对局不算作可继续存档', () => {
    const state = newGame();
    state.status = 'won';
    saveGame(state);
    expect(hasResumableSave()).toBe(false);
  });

  it('没有可用存储时不会抛异常', () => {
    setStorage(null);
    // node 环境下没有 localStorage，saveGame 应安全失败
    const res = saveGame(newGame());
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
