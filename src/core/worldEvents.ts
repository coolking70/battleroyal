/**
 * 世界事件系统（Phase 3A-1 严格回归规格）。
 *
 * ## 事件一览（数值与 WORLD_EVENT_DESIGN.md 逐字一致）
 *
 * | id | 范围 | 持续 | 效果 |
 * | --- | --- | ---: | --- |
 * | `blackout` 停电 | 全局 | 6 | 搜索遭遇敌人权重 ×0.8、空手权重 ×1.1（搜索变得不可靠，不碰战斗命中） |
 * | `rain` 连绵阴雨 | 全局 | 6 | 移动体力 +1（走 actionCosts）、远程武器命中 ×0.9（近战/逃跑不受影响） |
 * | `emergency_broadcast` 紧急广播 | 全局 | 即时 | 只公布「最近噪音最高的区域」之一，绝不公开身份/人数 |
 * | `medical_alert` 医疗警报 | 医院 | 5 | 医院内治疗类消耗品最终治疗量 ×1.2 |
 * | `research_anomaly` 研究异常 | 研究所 | 4 | 每时间单位对仍在 lab 的存活角色造成 3 点环境伤害（走 applyDamage） |
 * | `citywide_unrest` 全域骚动 | 全局 | 3 | 噪音停止自然衰减；搜索产生的噪音 ×1.5 |
 *
 * ## 世界事件红线（RULE-WE-01 ~ 08）
 *
 * 事件**允许**造成环境伤害（研究异常），但必须走统一入口：
 * - RULE-WE-01 不得直接 `actor.hp -= x`
 * - RULE-WE-02 不得直接 `actor.alive = false`
 * - RULE-WE-03 不得直接修改 `currentZoneId`
 * - RULE-WE-04 不得增加隐藏 `zone.loot`
 * - RULE-WE-05 不得创建未登记物品 UID
 * - RULE-WE-06 环境伤害必须走 `applyDamage`（本文件通过 `worldEventTick.ts` 完成）
 * - RULE-WE-07 移动成本必须走 `actionCosts`
 * - RULE-WE-08 信息事件不得读取隐藏人物信息（广播只读公开噪音）
 *
 * 说明：本文件刻意不 import `vitals`（避免 vitals→info→worldEvents 循环依赖），
 * 环境伤害放在 `worldEventTick.ts`，由 gameEngine 每时间单位调用 —— 效果上
 * 仍然走 `applyDamage` 唯一入口，行为层测试保证致死/死亡流程正确。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { getZoneDef } from '../data/zones';
import { pushEvent } from './events';
import type {
  GameState,
  WorldEventId,
  WorldEventRecord,
  WorldEventScope,
  WorldEventState,
} from './types';
import type { SeededRandom } from './random';

/* ------------------------------------------------------------------ */
/* 定义表                                                              */
/* ------------------------------------------------------------------ */

export interface WorldEventDef {
  id: WorldEventId;
  label: string;
  scope: WorldEventScope;
  /** 持续时间（0 = 即时事件，不进入 active 列表） */
  duration: number;
  weight: number;
  /** 展示用简述（UI 横幅 / 日志） */
  description: string;
  /** 固定生效区域（scope=zone 时必填；如医院/研究所） */
  fixedZoneId?: string;
}

/** 6 种世界事件的静态定义（顺序即 UI 图例顺序） */
export const WORLD_EVENT_DEFS: Record<WorldEventId, WorldEventDef> = {
  blackout: {
    id: 'blackout',
    label: '停电',
    scope: 'global',
    duration: GAME_CONFIG.blackoutDuration,
    weight: GAME_CONFIG.worldEventWeights.blackout,
    description: `全城供电中断：搜索更不可靠（遭遇 ×0.8、空手 ×1.1），但不影响战斗命中。`,
  },
  rain: {
    id: 'rain',
    label: '连绵阴雨',
    scope: 'global',
    duration: GAME_CONFIG.rainDuration,
    weight: GAME_CONFIG.worldEventWeights.rain,
    description: `全城降雨：移动体力 +1，远程武器命中率 ×${GAME_CONFIG.rainRangedHitMult}。`,
  },
  emergency_broadcast: {
    id: 'emergency_broadcast',
    label: '紧急广播',
    scope: 'global',
    duration: 0,
    weight: GAME_CONFIG.worldEventWeights.emergency_broadcast,
    description: '监控只公布「最近活动最频繁的区域」之一，不涉及任何人。',
  },
  medical_alert: {
    id: 'medical_alert',
    label: '医疗警报',
    scope: 'zone',
    fixedZoneId: 'hospital',
    duration: GAME_CONFIG.medicalAlertDuration,
    weight: GAME_CONFIG.worldEventWeights.medical_alert,
    description: `医院医疗资源优先调度：在医院使用治疗类消耗品效果 +${Math.round(
      (GAME_CONFIG.medicalAlertHealMult - 1) * 100,
    )}%。`,
  },
  research_anomaly: {
    id: 'research_anomaly',
    label: '研究异常',
    scope: 'zone',
    fixedZoneId: GAME_CONFIG.researchAnomalyZoneId,
    duration: GAME_CONFIG.researchAnomalyDuration,
    weight: GAME_CONFIG.worldEventWeights.research_anomaly,
    description: `研究所实验设施失控：每时间单位对仍在内的人造成 ${GAME_CONFIG.researchAnomalyDamagePerTick} 点环境伤害。`,
  },
  citywide_unrest: {
    id: 'citywide_unrest',
    label: '全域骚动',
    scope: 'global',
    duration: GAME_CONFIG.unrestDuration,
    weight: GAME_CONFIG.worldEventWeights.citywide_unrest,
    description: `全城骚动：区域噪音停止自然衰减，搜索产生的噪音 ×${GAME_CONFIG.unrestSearchNoiseMult}。`,
  },
};

/** 全部世界事件 id（稳定顺序，供统计与 UI 遍历） */
export const WORLD_EVENT_IDS: WorldEventId[] = [
  'blackout',
  'rain',
  'emergency_broadcast',
  'medical_alert',
  'research_anomaly',
  'citywide_unrest',
];

/* ------------------------------------------------------------------ */
/* 修正值                                                              */
/* ------------------------------------------------------------------ */

/**
 * 世界事件对各系统判定的修正值汇总。
 *
 * 所有字段都是「中性值 = 无事件」：乘数为 1、加成为 0、布尔为 false。
 * 各系统只需无条件乘/加，无需判断事件是否存在。
 */
export interface WorldEventModifiers {
  /** 远程武器命中率乘数（rain ×0.9；近战不受影响） */
  rangedHitMultiplier: number;
  /** 移动体力成本加成（rain +1，走 actionCosts） */
  moveCostBonus: number;
  /** 搜索「遭遇敌人」权重乘数（blackout ×0.8） */
  searchEnemyMult: number;
  /** 搜索「空手」权重乘数（blackout ×1.1） */
  searchNothingMult: number;
  /** 治疗类消耗品最终治疗量倍率（medical_alert ×1.2，仅医院生效） */
  healMultiplier: number;
  /** 噪音是否停止自然衰减（unrest） */
  noiseDecayBlocked: boolean;
  /** 搜索产生的噪音乘数（unrest ×1.5） */
  searchNoiseMultiplier: number;
}

/** 无任何世界事件时的中性修正值 */
export const NEUTRAL_WORLD_MODIFIERS: WorldEventModifiers = {
  rangedHitMultiplier: 1,
  moveCostBonus: 0,
  searchEnemyMult: 1,
  searchNothingMult: 1,
  healMultiplier: 1,
  noiseDecayBlocked: false,
  searchNoiseMultiplier: 1,
};

/**
 * 计算某区域当前受到的世界事件修正。
 *
 * **纯函数，无副作用** —— 可被 core 与 UI 任意频次调用。
 * 全局事件对所有区域生效；区域事件只对 `zoneId` 匹配的区域生效。
 *
 * @param zoneId 目标区域；传 null 时只统计全局事件
 */
export function worldModifiersAt(
  state: GameState,
  zoneId: string | null,
): WorldEventModifiers {
  const active = activeWorldEvents(state);
  if (active.length === 0) return { ...NEUTRAL_WORLD_MODIFIERS };

  const m: WorldEventModifiers = { ...NEUTRAL_WORLD_MODIFIERS };
  for (const ev of active) {
    // 区域事件只影响它自己的区域
    if (ev.scope === 'zone' && ev.zoneId !== zoneId) continue;
    applyModifier(m, ev.eventId);
  }
  return m;
}

/** 把单个事件的修正叠加到累计对象上（乘数相乘、加成相加、布尔取或） */
function applyModifier(m: WorldEventModifiers, id: WorldEventId): void {
  switch (id) {
    case 'blackout':
      m.searchEnemyMult *= GAME_CONFIG.blackoutSearchEnemyMult;
      m.searchNothingMult *= GAME_CONFIG.blackoutSearchNothingMult;
      break;
    case 'rain':
      m.moveCostBonus += GAME_CONFIG.rainMoveCostBonus;
      m.rangedHitMultiplier *= GAME_CONFIG.rainRangedHitMult;
      break;
    case 'emergency_broadcast':
      // 即时事件：不进入 active，无持续修正
      break;
    case 'medical_alert':
      m.healMultiplier *= GAME_CONFIG.medicalAlertHealMult;
      break;
    case 'research_anomaly':
      // 每 tick 伤害在 worldEventTick.ts 处理，这里无修正值
      break;
    case 'citywide_unrest':
      m.noiseDecayBlocked = true;
      m.searchNoiseMultiplier *= GAME_CONFIG.unrestSearchNoiseMult;
      break;
  }
}

/* ------------------------------------------------------------------ */
/* 状态访问                                                            */
/* ------------------------------------------------------------------ */

/** 防御性兜底：确保 state 上的世界事件字段结构完整 */
function ensureWorldEventFields(state: GameState): void {
  if (!Array.isArray(state.activeWorldEvents)) state.activeWorldEvents = [];
  if (!Array.isArray(state.worldEventHistory)) state.worldEventHistory = [];
  if (typeof state.nextWorldEventTime !== 'number') {
    state.nextWorldEventTime = GAME_CONFIG.firstWorldEventTime;
  }
}

/** 当前生效中的世界事件（只读视图，UI 横幅直接用） */
export function activeWorldEvents(state: GameState): WorldEventState[] {
  ensureWorldEventFields(state);
  return state.activeWorldEvents;
}

/** 某种世界事件当前是否生效（可选限定区域） */
export function hasWorldEvent(
  state: GameState,
  eventId: WorldEventId,
  zoneId?: string,
): boolean {
  return activeWorldEvents(state).some((e) => {
    if (e.eventId !== eventId) return false;
    if (e.scope === 'global') return true;
    return zoneId === undefined || e.zoneId === zoneId;
  });
}

/* ------------------------------------------------------------------ */
/* 调度                                                                */
/* ------------------------------------------------------------------ */

/**
 * 推进 1 个时间单位时调用：先衰减既有事件，再按调度触发新事件。
 *
 * 说明：研究异常的每 tick 环境伤害由 gameEngine 另行调用
 * `applyWorldEventTickDamage`（见 worldEventTick.ts），这里不处理实体伤害。
 */
export function runWorldEvents(state: GameState, rng: SeededRandom): void {
  ensureWorldEventFields(state);
  if (!GAME_CONFIG.worldEventsEnabled) return;

  expireWorldEvents(state);

  if (state.time >= state.nextWorldEventTime) {
    tryTriggerWorldEvent(state, rng);
    state.nextWorldEventTime =
      state.time +
      rng.int(GAME_CONFIG.worldEventIntervalMin, GAME_CONFIG.worldEventIntervalMax);
  }
}

/** 衰减 remaining，把归零的事件移入 history 并广播结束 */
function expireWorldEvents(state: GameState): void {
  const survivors: WorldEventState[] = [];
  for (const ev of state.activeWorldEvents) {
    const next: WorldEventState = { ...ev, remaining: ev.remaining - 1 };
    if (next.remaining > 0) {
      survivors.push(next);
      continue;
    }
    const record: WorldEventRecord = {
      id: next.id,
      eventId: next.eventId,
      zoneId: next.zoneId,
      startedAtTime: next.startedAtTime,
      endedAtTime: state.time,
    };
    state.worldEventHistory.push(record);
    pushEvent(state, {
      type: 'WORLD_EVENT_ENDED',
      actorId: null,
      zoneId: next.zoneId ?? undefined,
      message: `${next.label}结束了${next.zoneId ? `（${getZoneDef(next.zoneId).name}）` : ''}。`,
      metadata: {
        worldEventId: next.eventId,
        zoneId: next.zoneId,
        duration: state.time - next.startedAtTime,
      },
    });
  }
  state.activeWorldEvents = survivors;
}

/** 加权随机选一种「当前未生效」的事件；全都在生效中时返回 null */
function pickWorldEventId(state: GameState, rng: SeededRandom): WorldEventId | null {
  // 同一种事件不叠加：已在生效中的候选直接排除，
  // 这样修正值最多只由 maxConcurrentWorldEvents 种不同事件相乘。
  const running = new Set(state.activeWorldEvents.map((e) => e.eventId));
  const pool = WORLD_EVENT_IDS.filter((id) => !running.has(id));
  if (pool.length === 0) return null;

  const total = pool.reduce((s, id) => s + WORLD_EVENT_DEFS[id].weight, 0);
  if (total <= 0) return null;

  let roll = rng.next() * total;
  for (const id of pool) {
    roll -= WORLD_EVENT_DEFS[id].weight;
    if (roll < 0) return id;
  }
  return pool[pool.length - 1] ?? null;
}

/** 触发一次世界事件（受并发上限与去重限制，可能什么都不做） */
function tryTriggerWorldEvent(state: GameState, rng: SeededRandom): void {
  const eventId = pickWorldEventId(state, rng);
  if (!eventId) return;

  const def = WORLD_EVENT_DEFS[eventId];
  const zoneId =
    def.scope === 'zone' ? resolveZoneIdFor(def) : null;

  // 即时事件（紧急广播）：不进入 active，当场结算并广播
  if (def.duration === 0) {
    triggerInstantBroadcast(state, eventId, def);
    return;
  }

  if (state.activeWorldEvents.length >= GAME_CONFIG.maxConcurrentWorldEvents) return;
  if (def.scope === 'zone' && !zoneId) return;

  const instance: WorldEventState = {
    id: `we${state.eventSeq}`,
    eventId,
    scope: def.scope,
    zoneId,
    startedAtTime: state.time,
    remaining: def.duration,
    label: def.label,
    description: def.description,
  };
  state.activeWorldEvents.push(instance);
  state.eventSeq += 1;

  pushEvent(state, {
    type: 'WORLD_EVENT',
    actorId: null,
    zoneId: zoneId ?? undefined,
    message: buildAnnouncement(def, zoneId),
    metadata: {
      worldEventId: eventId,
      scope: def.scope,
      zoneId,
      duration: def.duration,
    },
  });
}

/** 区域事件的落点：优先固定区域（医院/研究所），否则在未被禁区吞掉的区域中随机 */
function resolveZoneIdFor(def: WorldEventDef): string | null {
  if (def.fixedZoneId) return def.fixedZoneId;
  return null;
}

/**
 * 从公开噪音数据中选择「最近噪音最高」的区域（纯函数，供广播与测试使用）。
 * 只读 `noiseLevel`（公开数据），绝不读取角色身份/人数。
 */
export function pickBroadcastZone(state: GameState): string | null {
  const candidates = Object.values(state.zones)
    .filter((z) => z.noiseLevel >= GAME_CONFIG.noiseActiveThreshold)
    .sort((a, b) => b.noiseLevel - a.noiseLevel);
  return candidates[0]?.id ?? null;
}

/**
 * 即时广播：从**公开噪音数据**中选择最近噪音最高的区域之一广播。
 * 绝不读取 aliveCharacterIds / 身份 / 人数。
 */
function triggerInstantBroadcast(
  state: GameState,
  eventId: WorldEventId,
  def: WorldEventDef,
): void {
  const topZoneId = pickBroadcastZone(state);
  const topZone = topZoneId ? state.zones[topZoneId] : null;

  const message = topZone
    ? `监控发现「${getZoneDef(topZone.id).name}」近期活动频繁。`
    : '监控暂未发现明显集中活动。';

  // 记录 history（即时事件 start=end=当前时间），供统计与回放
  state.worldEventHistory.push({
    id: `we${state.eventSeq}`,
    eventId,
    zoneId: topZone?.id ?? null,
    startedAtTime: state.time,
    endedAtTime: state.time,
  });
  state.eventSeq += 1;

  pushEvent(state, {
    type: 'WORLD_EVENT',
    actorId: null,
    zoneId: topZone?.id ?? undefined,
    message,
    metadata: {
      worldEventId: eventId,
      scope: def.scope,
      zoneId: topZone?.id ?? null,
      duration: 0,
      instant: true,
      broadcastZoneId: topZone?.id ?? null,
    },
  });
}

function buildAnnouncement(
  def: WorldEventDef,
  zoneId: string | null,
): string {
  const where = zoneId ? `「${getZoneDef(zoneId).name}」` : '全城';
  return `【${def.label}】${where}：${def.description}持续 ${def.duration} 个时间单位。`;
}
