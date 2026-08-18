/**
 * 存档校验 · 结构层（第一层）。
 *
 * Phase 2A-1 扩充：在原有「对象长得对不对」的基础上，补上顶层 SaveData 的
 * **完整契约**与**冗余一致性**校验：
 * - version / savedAt / seed / time / rngState 五项顶层字段各自必须合法；
 * - 顶层与 `state` 内同名字段必须完全一致（seed / time / rngState / version）。
 * 任何不一致直接拒绝——这是存档深度校验的第一道闸。
 */

import { GAME_VERSION } from '../../data/gameConfig';
import { ZONE_IDS } from '../../data/zones';
import { isFiniteNumber, isRecord, ZONE_ID_SET, type ValidationContext } from './types';

/**
 * 判断是否为「合法的 uint32 整数状态」：有限、整数、非负且不超过 2^32-1。
 * RNG 状态由 `SeededRandom.getState()` 的 `>>> 0` 保证恒为此形态。
 */
function isRngState(v: unknown): boolean {
  return (
    isFiniteNumber(v) &&
    Number.isInteger(v) &&
    (v as number) >= 0 &&
    (v as number) <= 0xffffffff
  );
}

/** 提取结构层所需的字符 / 区域表与 id 集合，供后续层复用 */
export function buildContext(raw: unknown, errors: string[]): ValidationContext | null {
  const fail = (msg: string): void => {
    errors.push(msg);
  };

  if (!isRecord(raw)) {
    fail('存档不是一个对象');
    return null;
  }

  /* --- 顶层字段契约 --- */
  if (typeof raw.version !== 'string' || raw.version.length === 0) {
    fail('version 必须是当前支持的版本字符串');
    return null;
  }
  if (raw.version !== GAME_VERSION) {
    fail(`版本不受支持（${String(raw.version)}，当前 ${GAME_VERSION}）`);
    return null;
  }
  if (!isFiniteNumber(raw.savedAt) || (raw.savedAt as number) <= 0) {
    fail('savedAt 必须是有限正数（时间戳）');
  }
  if (typeof raw.seed !== 'string' || raw.seed.length === 0) {
    fail('seed 必须是非空字符串');
  }
  if (!isFiniteNumber(raw.time) || !Number.isInteger(raw.time) || (raw.time as number) < 0) {
    fail('time 必须是非负整数');
  }
  if (!isRngState(raw.rngState)) {
    fail('rngState 必须是合法的有限非负整数');
  }

  const state = raw.state;
  if (!isRecord(state)) {
    fail('缺少 state 字段');
    return null;
  }

  /* --- 顶层 ↔ state 冗余一致性 --- */
  if (state.version !== raw.version) {
    fail('state.version 与顶层 version 不一致');
  }
  if (state.seed !== raw.seed) {
    fail('state.seed 与顶层 seed 不一致');
  }
  if (state.time !== raw.time) {
    fail('state.time 与顶层 time 不一致');
  }
  if (state.rngState !== raw.rngState) {
    fail('state.rngState 与顶层 rngState 不一致');
  }

  /* --- state 基础结构 --- */
  if (typeof state.seed !== 'string' || state.seed.length === 0) fail('state.seed 类型错误');
  if (!isRngState(state.rngState)) fail('state.rngState 类型错误');
  if (typeof state.playerId !== 'string') fail('state.playerId 类型错误');
  if (!Array.isArray(state.turnOrder)) fail('state.turnOrder 类型错误');
  if (!Array.isArray(state.events)) fail('state.events 类型错误');
  if (!Array.isArray(state.deathOrder)) fail('state.deathOrder 类型错误');
  if (!isRecord(state.characters)) fail('state.characters 类型错误');
  if (!isRecord(state.wildEnemies)) fail('state.wildEnemies 类型错误');
  if (!isRecord(state.zones)) fail('state.zones 类型错误');
  if (!isRecord(state.landmarks)) fail('state.landmarks 类型错误');
  if (!isRecord(state.victory)) fail('state.victory 类型错误');
  if (!Object.prototype.hasOwnProperty.call(state, 'activeExtraction')) {
    fail('state.activeExtraction 缺少当前版本字段');
  }
  if (!Object.prototype.hasOwnProperty.call(state, 'incidents')) {
    fail('state.incidents 缺少当前版本字段');
  } else if (!isRecord(state.incidents)) {
    fail('state.incidents 类型错误');
  }

  const status = state.status;
  if (status !== 'playing' && status !== 'won' && status !== 'lost' && status !== 'draw') {
    fail(`state.status 非法：${String(status)}`);
  }

  const characters = state.characters as Record<string, unknown>;
  const zones = state.zones as Record<string, unknown>;
  const expectedZoneIds = new Set(ZONE_IDS);
  for (const zoneId of ZONE_IDS) {
    if (!Object.prototype.hasOwnProperty.call(zones, zoneId)) {
      fail(`缺少当前版本区域：${zoneId}`);
    }
  }
  for (const zoneId of Object.keys(zones)) {
    if (!expectedZoneIds.has(zoneId)) {
      fail(`存档包含未知区域：${zoneId}`);
    }
  }
  const ctx: ValidationContext = {
    raw,
    state,
    characters,
    zones,
    charIds: new Set(Object.keys(characters)),
    zoneIds: ZONE_ID_SET,
    errors,
    fail,
  };
  return ctx;
}
