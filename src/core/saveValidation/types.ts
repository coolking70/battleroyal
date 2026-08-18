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
import type { GameEventType } from '../types';

export interface ValidationReport {
  ok: boolean;
  errors: string[];
}

/**
 * 合法事件类型全集（Phase 2A-1：事件必须落在枚举内）。
 *
 * ── Phase 3A 审计修复 ──────────────────────────────────────────────
 * 这里原本是一份**手写的字符串数组**，与 `GameEventType` 联合类型各写一份。
 * 结果 Phase 3 Step 1 加入 `GUARD` 事件时漏了同步这份名单 —— 任何包含
 * 防御动作的存档在 `validateSave` 里都会被判「事件类型非法」而拒载，
 * 而单测恰好没覆盖到「先 GUARD 再存档」的顺序，于是一直没暴露。
 *
 * 现在改为先声明一个 `Record<GameEventType, true>`：**少一个键就编译不过**，
 * 从结构上杜绝名单与联合类型再次漂移。新增事件类型时 TS 会直接报错提醒。
 * ──────────────────────────────────────────────────────────────────
 */
const EVENT_TYPE_TABLE: Record<GameEventType, true> = {
  GAME_STARTED: true,
  CHARACTER_MOVED: true,
  SEARCH_STARTED: true,
  LANDMARK_SEARCHED: true,
  LANDMARK_EXHAUSTED: true,
  FACILITY_USED: true,
  FACILITY_ACTIVATED: true,
  LANDMARK_UNLOCKED: true,
  ITEM_FOUND: true,
  ITEM_PICKED: true,
  ITEM_DROPPED: true,
  ITEM_USED: true,
  ITEM_CRAFTED: true,
  ITEM_EQUIPPED: true,
  ENCOUNTER_STARTED: true,
  WILD_ENCOUNTER_STARTED: true,
  WILD_ATTACK: true,
  WILD_DEFEATED: true,
  WILD_FLED: true,
  WILD_DROP_CREATED: true,
  APEX_SPAWNED: true,
  APEX_DEFEATED: true,
  ATTACK_HIT: true,
  ATTACK_MISSED: true,
  CHARACTER_ESCAPED: true,
  CHARACTER_DIED: true,
  ZONE_WARNING: true,
  ZONE_RESTRICTED: true,
  ZONE_DAMAGE: true,
  ZONE_EXHAUSTED: true,
  PHASE_CHANGED: true,
  FINALE_DECAY: true,
  CRAFT_GOAL_SET: true,
  NPC_ACTION: true,
  REST: true,
  GUARD: true,
  SKILL_USED: true,
  STATUS_EXPIRED: true,
  WORLD_EVENT: true,
  WORLD_EVENT_ENDED: true,
  WORLD_EVENT_DAMAGE: true,
  VICTORY_DECLARED: true,
  EXTRACTION_CALLED: true,
  EXTRACTION_CANCELLED: true,
  EXTRACTION_READY: true,
  EXTRACTION_COMPLETED: true,
  RESEARCH_COMPLETED: true,
  GAME_ENDED: true,
  INCIDENT_ACTIVATED: true,
  INCIDENT_RESOLVED: true,
  INCIDENT_EXPIRED: true,
  INCIDENT_CLAIMED: true,
};

export const EVENT_TYPE_SET = new Set<string>(Object.keys(EVENT_TYPE_TABLE));

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
