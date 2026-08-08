import { GAME_VERSION, LEGACY_SAVE_KEYS, SAVE_KEY } from '../data/gameConfig';
import type { GameState } from './types';

/**
 * 存档读写与存储抽象。
 *
 * ⚠️ Phase 2A Step 8 起，`validateSaveData` / `isValidSaveData` 的**实现**已迁移到
 * `./saveValidation`（structure / numbers / references / consistency 四层），
 * 这里只做**类型与函数转发**，保证旧调用方（`loadGame`、各测试、UI）零改动。
 */

import { validateSaveData } from './saveValidation';

export { validateSaveData, type ValidationReport } from './saveValidation';

// 旧签名兼容：isValidSaveData 在 saveLoad 历史上返回 `value is SaveData` 断言，
// 这里保留该谓词类型以免破坏既有收窄用法。
export function isValidSaveData(value: unknown): value is SaveData {
  // 复用转发过来的实现，仅改变断言目标类型
  return validateSaveData(value).ok;
}

export interface SaveData {
  /** 游戏版本 */
  version: string;
  /** 存档写入时的时间戳（仅供展示，不参与任何核心逻辑） */
  savedAt: number;
  seed: string;
  time: number;
  /** 随机数生成器状态（同时也存在于 state 中，这里冗余一份便于校验） */
  rngState: number;
  /** 完整游戏状态，含事件日志 */
  state: GameState;
}

/* ------------------------------------------------------------------ */
/* 存储抽象（便于在 Node 测试环境下注入 stub）                           */
/* ------------------------------------------------------------------ */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let injectedStorage: StorageLike | null = null;

/** 测试用：注入一个内存存储 */
export function setStorage(storage: StorageLike | null): void {
  injectedStorage = storage;
}

function getStorage(): StorageLike | null {
  if (injectedStorage) return injectedStorage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // 隐私模式等场景下访问 localStorage 会抛错
    return null;
  }
  return null;
}

/** 一个纯内存的 StorageLike 实现，测试与降级时使用 */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/* ------------------------------------------------------------------ */
/* 读写                                                                */
/* ------------------------------------------------------------------ */

export interface SaveResult {
  ok: boolean;
  error: string | null;
}

export function saveGame(state: GameState): SaveResult {
  const storage = getStorage();
  if (!storage) return { ok: false, error: '当前环境不支持本地存档。' };
  try {
    const data: SaveData = {
      version: GAME_VERSION,
      savedAt: Date.now(),
      seed: state.seed,
      time: state.time,
      rngState: state.rngState,
      state,
    };
    const json = JSON.stringify(data);
    storage.setItem(SAVE_KEY, json);
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error: `写入存档失败：${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export type LoadResult =
  | { ok: true; data: SaveData; error: null }
  | { ok: false; data: null; error: string };

/**
 * 读取存档。
 * 任何解析错误 / 结构不完整都会被捕获并转成可读错误，绝不抛出到界面层。
 */
export function loadGame(): LoadResult {
  const storage = getStorage();
  if (!storage) return { ok: false, data: null, error: '当前环境不支持本地存档。' };

  let raw: string | null = null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: `读取存档失败：${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!raw) return { ok: false, data: null, error: '没有找到存档。' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, data: null, error: '存档内容已损坏（无法解析）。' };
  }

  const report = validateSaveData(parsed);
  if (!report.ok) {
    return {
      ok: false,
      data: null,
      error: `存档校验未通过：${report.errors[0] ?? '结构不完整'}`,
    };
  }
  const data = parsed as SaveData;
  if (data.version !== GAME_VERSION) {
    return {
      ok: false,
      data: null,
      error: `存档版本不匹配（存档 ${data.version}，当前 ${GAME_VERSION}）。`,
    };
  }
  return { ok: true, data, error: null };
}

export function clearSave(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // 忽略：清档失败不影响游戏继续
  }
}

/** 是否存在一份「未结束」的存档 */
export function hasResumableSave(): boolean {
  const res = loadGame();
  return res.ok && res.data.state.status === 'playing';
}

/** 当前 key 下是否存在任何内容（哪怕已损坏） */
export function hasAnySave(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    return storage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* 旧版本存档（不做静默迁移）                                            */
/* ------------------------------------------------------------------ */

export interface LegacySaveInfo {
  key: string;
  version: string | null;
}

/**
 * 检测遗留的旧版本存档。
 *
 * 第二阶段刻意**不做自动迁移**：0.1.0 的存档缺少有限物资、阶段、情报等字段，
 * 强行迁移只会产生一个"看起来能跑但规则半新半旧"的对局。
 * 这里只负责发现它们，由界面提示玩家手动删除。
 */
export function findLegacySaves(): LegacySaveInfo[] {
  const storage = getStorage();
  if (!storage) return [];
  const found: LegacySaveInfo[] = [];
  for (const key of LEGACY_SAVE_KEYS) {
    let raw: string | null = null;
    try {
      raw = storage.getItem(key);
    } catch {
      continue;
    }
    if (!raw) continue;
    let version: string | null = null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed) && typeof parsed.version === 'string') {
        version = parsed.version;
      }
    } catch {
      version = null;
    }
    found.push({ key, version });
  }
  return found;
}

/** 删除全部旧版本存档，返回删除数量 */
export function clearLegacySaves(): number {
  const storage = getStorage();
  if (!storage) return 0;
  let n = 0;
  for (const info of findLegacySaves()) {
    try {
      storage.removeItem(info.key);
      n += 1;
    } catch {
      // 忽略单个失败
    }
  }
  return n;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
