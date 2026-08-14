import { GAME_CONFIG } from '../data/gameConfig';
import type {
  EventImportance,
  EventMetadata,
  GameEvent,
  GameEventType,
  GameState,
} from './types';
import { observePublicGameEvent } from './npcKnowledge';

export interface PushEventInput {
  type: GameEventType;
  message: string;
  actorId?: string | null;
  targetId?: string | null;
  zoneId?: string | null;
  /** 不传时按事件类型取默认分级 */
  importance?: EventImportance;
  metadata?: EventMetadata;
}

/**
 * 事件类型的默认重要度。
 *
 * 分级的唯一用途是**控制存档体积**：长局会产生上千条"某某搜索了一下"，
 * 这些 `minor` 事件超过保留额度后会从最旧的开始丢弃，
 * 而死亡、阶段切换、对局结束这类 `critical` 事件永远不裁剪。
 */
const DEFAULT_IMPORTANCE: Record<GameEventType, EventImportance> = {
  GAME_STARTED: 'critical',
  GAME_ENDED: 'critical',
  CHARACTER_DIED: 'critical',
  PHASE_CHANGED: 'critical',

  ZONE_WARNING: 'major',
  ZONE_RESTRICTED: 'major',
  ZONE_EXHAUSTED: 'major',
  ATTACK_HIT: 'major',
  ENCOUNTER_STARTED: 'major',
  ITEM_CRAFTED: 'major',
  CRAFT_GOAL_SET: 'major',
  FINALE_DECAY: 'major',
  CHARACTER_ESCAPED: 'major',
  WILD_ENCOUNTER_STARTED: 'major',
  WILD_DEFEATED: 'major',
  WILD_FLED: 'major',
  APEX_SPAWNED: 'major',
  APEX_DEFEATED: 'critical',

  ATTACK_MISSED: 'minor',
  CHARACTER_MOVED: 'minor',
  SEARCH_STARTED: 'minor',
  LANDMARK_SEARCHED: 'minor',
  LANDMARK_EXHAUSTED: 'major',
  FACILITY_USED: 'minor',
  FACILITY_ACTIVATED: 'major',
  LANDMARK_UNLOCKED: 'major',
  ITEM_FOUND: 'minor',
  ITEM_PICKED: 'minor',
  ITEM_DROPPED: 'minor',
  ITEM_USED: 'minor',
  ITEM_EQUIPPED: 'minor',
  ZONE_DAMAGE: 'minor',
  NPC_ACTION: 'minor',
  REST: 'minor',
  GUARD: 'minor',
  SKILL_USED: 'minor',
  WILD_ATTACK: 'minor',
  WILD_DROP_CREATED: 'minor',

  /* Phase 3A */
  // 状态解除属于战斗噪音，长局里量大，归 minor 以免挤占存档额度
  STATUS_EXPIRED: 'minor',
  // 世界事件会改变全场规则，玩家必须看得见 —— 与禁区同级
  WORLD_EVENT: 'major',
  // 事件结束同样影响决策（「雨停了，可以放心重击了」），但重要性略低于开始
  WORLD_EVENT_ENDED: 'minor',
  WORLD_EVENT_DAMAGE: 'minor',
  VICTORY_DECLARED: 'critical',
  EXTRACTION_CALLED: 'major',
  EXTRACTION_CANCELLED: 'major',
  EXTRACTION_READY: 'major',
  EXTRACTION_COMPLETED: 'critical',
  RESEARCH_COMPLETED: 'critical',
};

/**
 * 向游戏状态追加一条结构化事件。
 * 事件 id 由自增序号生成，保证同种子同流程下完全一致（不使用时间戳 / 随机数）。
 *
 * 注意：核心判断绝不能依赖 message 文本，message 只用于界面展示。
 */
export function pushEvent(state: GameState, input: PushEventInput): GameEvent {
  const event: GameEvent = {
    id: `e${state.eventSeq}`,
    type: input.type,
    time: state.time,
    actorId: input.actorId ?? null,
    targetId: input.targetId ?? null,
    zoneId: input.zoneId ?? null,
    message: input.message,
    importance: input.importance ?? DEFAULT_IMPORTANCE[input.type] ?? 'minor',
    metadata: input.metadata ?? {},
  };
  state.eventSeq += 1;
  state.events.push(event);

  state.eventCounters.total += 1;
  state.eventCounters.byType[event.type] =
    (state.eventCounters.byType[event.type] ?? 0) + 1;

  observePublicGameEvent(state, event);

  pruneEvents(state);
  return event;
}

/**
 * 事件日志体积控制。
 *
 * 两级裁剪：
 * 1. `minor` 事件超过 `minorEventRetention` 时，从最旧的 minor 开始丢弃；
 * 2. 总量仍超过 `eventHardLimit` 时，再从最旧的非 critical 事件开始丢弃。
 *
 * 被丢弃的事件计入 `eventCounters.archived`，统计不丢。
 */
export function pruneEvents(state: GameState): void {
  const { minorEventRetention, eventHardLimit } = GAME_CONFIG;

  let minorCount = 0;
  for (const e of state.events) if (e.importance === 'minor') minorCount += 1;

  if (minorCount > minorEventRetention) {
    let toDrop = minorCount - minorEventRetention;
    const kept: GameEvent[] = [];
    for (const e of state.events) {
      if (toDrop > 0 && e.importance === 'minor') {
        toDrop -= 1;
        state.eventCounters.archived += 1;
        continue;
      }
      kept.push(e);
    }
    state.events = kept;
  }

  if (state.events.length > eventHardLimit) {
    let toDrop = state.events.length - eventHardLimit;
    const kept: GameEvent[] = [];
    for (const e of state.events) {
      if (toDrop > 0 && e.importance !== 'critical') {
        toDrop -= 1;
        state.eventCounters.archived += 1;
        continue;
      }
      kept.push(e);
    }
    state.events = kept;
  }
}

/** 取最近 n 条事件（按时间正序返回） */
export function recentEvents(state: GameState, n: number): GameEvent[] {
  if (state.events.length <= n) return state.events.slice();
  return state.events.slice(state.events.length - n);
}

/** 按最低重要度过滤后再取最近 n 条 */
export function recentEventsByImportance(
  state: GameState,
  n: number,
  min: EventImportance,
): GameEvent[] {
  const rank: Record<EventImportance, number> = { minor: 0, major: 1, critical: 2 };
  const filtered = state.events.filter((e) => rank[e.importance] >= rank[min]);
  return filtered.length <= n ? filtered : filtered.slice(filtered.length - n);
}

/**
 * NPC 可见的「公开击杀信息」。
 * NPC AI 只允许读取这一类公开信息，不能读取玩家背包等隐藏数据。
 */
export function publicKillEvents(state: GameState): GameEvent[] {
  return state.events.filter((e) => e.type === 'CHARACTER_DIED');
}

/** 结算页用：对局关键时间线（只保留 critical 与 major） */
export function keyTimeline(state: GameState, limit = 30): GameEvent[] {
  const key = state.events.filter((e) => e.importance !== 'minor');
  return key.length <= limit ? key : key.slice(key.length - limit);
}
