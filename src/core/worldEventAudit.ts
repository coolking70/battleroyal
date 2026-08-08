/**
 * 世界事件不变量审计（Phase 3A Step 7）。
 *
 * 世界事件系统是「环境修正型」的，红线要求它**绝不**直接改写角色血量 / 库存 /
 * 区域地面物资，也不瞬移角色。本文件提供 `auditWorldEventInvariants(state)`
 * 纯函数，对存档与运行中的状态做一遍**结构性**校验，守下列不变量：
 *
 *  1. `activeWorldEvents` 是数组，且每个实例字段自洽（id/eventId/scope/zoneId/
 *     startedAtTime/remaining/label/description）；
 *  2. 范围自洽：全局事件 `zoneId === null`；区域事件 `zoneId` 必须是合法区域；
 *  3. 同事件不叠加：active 列表里 `eventId` 唯一；
 *  4. 并发上限：`activeWorldEvents.length <= GAME_CONFIG.maxConcurrentWorldEvents`；
 *  5. `worldEventHistory` 中每条记录 `endedAtTime >= startedAtTime`、zoneId 合法；
 *  6. `nextWorldEventTime` 是有限非负数字；
 *  7. 修正值无 NaN/Infinity 污染：对任意区域调用 `worldModifiersAt` 所有数值字段
 *     均为有限数（乘数 > 0），布尔字段为 boolean。
 *
 * 注意：红线「不写实体状态」的**编译期**防护在 `worldEvents.ts` 里（不 import
 * `zoneLoot`/`vitals`/`inventory`），这里只做**运行时**结构性审计。行为层
 * （「跑一遍 runWorldEvents 后血量/库存不变」）由 `tests/worldEventInvariants.test.ts`
 * 以快照比对方式覆盖。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import type { GameState, WorldEventId, WorldEventScope } from './types';
import { WORLD_EVENT_IDS, worldModifiersAt } from './worldEvents';

export interface WorldEventInvariantReport {
  ok: boolean;
  problems: string[];
}

/** WorldEventState 允许出现的字段集合（越界即视为被篡改） */
const ALLOWED_ACTIVE_KEYS = new Set([
  'id',
  'eventId',
  'scope',
  'zoneId',
  'startedAtTime',
  'remaining',
  'label',
  'description',
]);

/** WorldEventRecord 允许出现的字段集合 */
const ALLOWED_RECORD_KEYS = new Set([
  'id',
  'eventId',
  'zoneId',
  'startedAtTime',
  'endedAtTime',
]);

const EVENT_ID_SET = new Set<string>(WORLD_EVENT_IDS);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function extraKeys(obj: Record<string, unknown>, allowed: Set<string>): string[] {
  return Object.keys(obj).filter((k) => !allowed.has(k));
}

/**
 * 审计整局状态的世界事件不变量。
 *
 * @returns `{ ok: true }` 表示所有不变量成立；否则 `problems` 列出违例说明。
 */
export function auditWorldEventInvariants(state: GameState): WorldEventInvariantReport {
  const problems: string[] = [];

  /* --- 0. 字段存在性兜底（缺字段也记一笔，便于定位损坏存档）--- */
  if (!Array.isArray(state.activeWorldEvents)) {
    problems.push('activeWorldEvents 不是数组');
  }
  if (!Array.isArray(state.worldEventHistory)) {
    problems.push('worldEventHistory 不是数组');
  }
  if (!isFiniteNumber(state.nextWorldEventTime) || state.nextWorldEventTime < 0) {
    problems.push(`nextWorldEventTime 非法（${String(state.nextWorldEventTime)}）`);
  }

  /* --- 1. active 实例结构自洽 --- */
  const active = Array.isArray(state.activeWorldEvents) ? state.activeWorldEvents : [];
  const seenActiveIds = new Set<string>();
  const seenActiveEventIds = new Set<string>();
  for (const ev of active) {
    const tag = `世界事件实例 ${String(ev?.id ?? '<空id>')}`;

    if (!isPlainObject(ev)) {
      problems.push('activeWorldEvents 中存在非对象元素');
      continue;
    }
    const extra = extraKeys(ev as Record<string, unknown>, ALLOWED_ACTIVE_KEYS);
    if (extra.length > 0) {
      problems.push(`${tag} 含有非预期字段：${extra.join(', ')}`);
    }

    const eventId = ev?.eventId as WorldEventId | undefined;
    if (!eventId || !EVENT_ID_SET.has(eventId)) {
      problems.push(`${tag} 的 eventId 非法（${String(eventId)}）`);
    }

    const scope = ev?.scope as WorldEventScope | undefined;
    if (scope !== 'global' && scope !== 'zone') {
      problems.push(`${tag} 的 scope 非法（${String(scope)}）`);
    }

    /* 范围 ↔ zoneId 自洽 */
    if (scope === 'global') {
      if (ev?.zoneId !== null && ev?.zoneId !== undefined) {
        problems.push(`${tag} 是全局事件却携带 zoneId（${String(ev?.zoneId)}）`);
      }
    } else if (scope === 'zone') {
      if (typeof ev?.zoneId !== 'string' || !(ev.zoneId in state.zones)) {
        problems.push(`${tag} 是区域事件却指向非法区域（${String(ev?.zoneId)}）`);
      }
    }

    if (!isPositiveInt(ev?.remaining)) {
      problems.push(`${tag} 的 remaining 非法（${String(ev?.remaining)}）`);
    }

    if (!isFiniteNumber(ev?.startedAtTime) || (ev?.startedAtTime as number) < 0) {
      problems.push(`${tag} 的 startedAtTime 非法（${String(ev?.startedAtTime)}）`);
    } else if ((ev?.startedAtTime as number) > state.time) {
      problems.push(`${tag} 的 startedAtTime（${ev?.startedAtTime}）晚于当前时间（${state.time}）`);
    }

    if (typeof ev?.label !== 'string' || ev.label.length === 0) {
      problems.push(`${tag} 的 label 非法`);
    }
    if (typeof ev?.description !== 'string' || ev.description.length === 0) {
      problems.push(`${tag} 的 description 非法`);
    }

    const id = ev?.id as string | undefined;
    if (typeof id !== 'string' || id.length === 0) {
      problems.push('activeWorldEvents 中存在空 id 实例');
    } else if (seenActiveIds.has(id)) {
      problems.push(`activeWorldEvents 实例 id 重复（${id}）`);
    } else {
      seenActiveIds.add(id);
    }

    /* 同事件不叠加 */
    if (eventId && EVENT_ID_SET.has(eventId)) {
      if (seenActiveEventIds.has(eventId)) {
        problems.push(`同一种世界事件重复生效（${eventId}）`);
      } else {
        seenActiveEventIds.add(eventId);
      }
    }
  }

  /* --- 4. 并发上限 --- */
  if (active.length > GAME_CONFIG.maxConcurrentWorldEvents) {
    problems.push(
      `生效中的世界事件数量（${active.length}）超过并发上限（${GAME_CONFIG.maxConcurrentWorldEvents}）`,
    );
  }

  /* --- 5. history 记录自洽 --- */
  const history = Array.isArray(state.worldEventHistory) ? state.worldEventHistory : [];
  for (const rec of history) {
    const tag = `世界事件历史 ${String(rec?.id ?? '<空id>')}`;
    if (!isPlainObject(rec)) {
      problems.push('worldEventHistory 中存在非对象元素');
      continue;
    }
    const extra = extraKeys(rec as Record<string, unknown>, ALLOWED_RECORD_KEYS);
    if (extra.length > 0) {
      problems.push(`${tag} 含有非预期字段：${extra.join(', ')}`);
    }
    const eventId = rec?.eventId as WorldEventId | undefined;
    if (!eventId || !EVENT_ID_SET.has(eventId)) {
      problems.push(`${tag} 的 eventId 非法（${String(eventId)}）`);
    }
    if (typeof rec?.zoneId !== 'string' && rec?.zoneId !== null) {
      problems.push(`${tag} 的 zoneId 非法（${String(rec?.zoneId)}）`);
    } else if (typeof rec?.zoneId === 'string' && !(rec.zoneId in state.zones)) {
      problems.push(`${tag} 指向非法区域（${rec.zoneId}）`);
    }
    const start = rec?.startedAtTime as number | undefined;
    const end = rec?.endedAtTime as number | undefined;
    if (!isFiniteNumber(start) || start < 0) {
      problems.push(`${tag} 的 startedAtTime 非法（${String(start)}）`);
    }
    if (!isFiniteNumber(end)) {
      problems.push(`${tag} 的 endedAtTime 非法（${String(end)}）`);
    } else if (isFiniteNumber(start) && end < start) {
      problems.push(`${tag} 的 endedAtTime（${end}）早于 startedAtTime（${start}）`);
    }
    if (typeof rec?.id !== 'string' || rec.id.length === 0) {
      problems.push('worldEventHistory 中存在空 id 记录');
    }
  }

  /* --- 7. 修正值无 NaN/Infinity 污染（Phase 3A-1 新字段集） --- */
  const zonesToCheck = [null, ...Object.keys(state.zones)];
  for (const zid of zonesToCheck) {
    const m = worldModifiersAt(state, zid);
    const where = zid === null ? '全局（zoneId=null）' : `区域 ${zid}`;
    const multChecks: Array<[string, number]> = [
      ['rangedHitMultiplier', m.rangedHitMultiplier],
      ['searchEnemyMult', m.searchEnemyMult],
      ['searchNothingMult', m.searchNothingMult],
      ['healMultiplier', m.healMultiplier],
      ['searchNoiseMultiplier', m.searchNoiseMultiplier],
    ];
    for (const [name, val] of multChecks) {
      if (!isFiniteNumber(val) || val <= 0) {
        problems.push(`${where} 的修正值 ${name} 非法（${String(val)}）`);
      }
    }
    if (!isFiniteNumber(m.moveCostBonus)) {
      problems.push(`${where} 的修正值 moveCostBonus 非法（${String(m.moveCostBonus)}）`);
    }
    if (typeof m.noiseDecayBlocked !== 'boolean') {
      problems.push(`${where} 的修正值 noiseDecayBlocked 不是布尔`);
    }
  }

  return { ok: problems.length === 0, problems };
}

/** 防御性判断：仅接受普通对象（非 null / 数组 / 原始值） */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
