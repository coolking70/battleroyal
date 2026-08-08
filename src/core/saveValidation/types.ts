/**
 * 存档校验 · 共享类型与基础工具。
 *
 * Phase 2A Step 8 把原先内联在 `saveLoad.ts` 的 `validateSaveData`
 * 拆成 6 个独立模块（types / structure / numbers / references / consistency / index），
 * 本文件是所有模块共享的「最小公共件」：
 * - `ValidationReport`：对外统一返回结构（与旧 `saveLoad.ValidationReport` 完全兼容）；
 * - 基础类型守卫 `isRecord` / `isFiniteNumber`；
 * - 区域 id 集合（引用层校验用）。
 */

import { ZONE_IDS } from '../../data/zones';

export interface ValidationReport {
  ok: boolean;
  errors: string[];
}

/** 合法事件类型全集（Phase 2A-1：事件必须落在枚举内） */
export const EVENT_TYPE_SET = new Set<string>([
  'GAME_STARTED',
  'CHARACTER_MOVED',
  'SEARCH_STARTED',
  'ITEM_FOUND',
  'ITEM_PICKED',
  'ITEM_DROPPED',
  'ITEM_USED',
  'ITEM_CRAFTED',
  'ITEM_EQUIPPED',
  'ENCOUNTER_STARTED',
  'ATTACK_HIT',
  'ATTACK_MISSED',
  'CHARACTER_ESCAPED',
  'CHARACTER_DIED',
  'ZONE_WARNING',
  'ZONE_RESTRICTED',
  'ZONE_DAMAGE',
  'ZONE_EXHAUSTED',
  'PHASE_CHANGED',
  'FINALE_DECAY',
  'CRAFT_GOAL_SET',
  'NPC_ACTION',
  'REST',
  'GAME_ENDED',
  'SKILL_USED',
  'DYNAMIC_EVENT',
]);

/** 合法事件重要度 */
export const EVENT_IMPORTANCE_SET = new Set<string>(['critical', 'major', 'minor']);

/** 合法物资稀有度 */
export const LOOT_RARITY_SET = new Set<string>(['normal', 'rare']);

/** 模块内部共享的上下文：一层校验往 errors 里塞错误，不中断后续检查 */
export interface ValidationContext {
  /** 顶层存档对象（未经过类型收窄） */
  raw: unknown;
  /** 经 isRecord 确认后的 state 字段 */
  state: Record<string, unknown>;
  /** 角色表 */
  characters: Record<string, unknown>;
  /** 区域表 */
  zones: Record<string, unknown>;
  /** 已知角色 id 集合（引用层去重 / 存在性检查用） */
  charIds: Set<string>;
  /** 区域 id 集合 */
  zoneIds: Set<string>;
  /** 错误累加器 */
  errors: string[];
  /** 追加一条错误 */
  fail(msg: string): void;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export const ZONE_ID_SET = new Set<string>(ZONE_IDS);

/** 从 errors 数组构造最终报告 */
export function toReport(errors: string[]): ValidationReport {
  return { ok: errors.length === 0, errors };
}
