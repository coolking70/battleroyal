import { useEffect, useRef, useState } from 'react';
import type { GameEvent, GameEventType } from '../../core/types';
import { cx } from '../../utils/format';

interface EventLogProps {
  events: GameEvent[];
  playerId: string;
}

/**
 * 默认日志的可见性边界。
 *
 * NPC_ACTION 及其搜索/拾取/移动等事件只属于调试信息；即使 message 被
 * 改写，也不能通过默认日志泄露 NPC 位置、物资或 planner reason。公开的
 * 禁区、阶段、世界事件和死亡广播仍然对所有玩家可见。这里只做展示层
 * 过滤，不改变 core 事件、结算或存档内容；DebugPanel 继续读取完整 state。
 */
const PUBLIC_EVENT_TYPES = new Set<GameEventType>([
  'GAME_STARTED',
  'CHARACTER_DIED',
  'ZONE_WARNING',
  'ZONE_RESTRICTED',
  'ZONE_EXHAUSTED',
  'PHASE_CHANGED',
  'FINALE_DECAY',
  'WORLD_EVENT',
  'WORLD_EVENT_ENDED',
  'GAME_ENDED',
  'VICTORY_DECLARED',
  'EXTRACTION_CALLED',
  'EXTRACTION_CANCELLED',
  'EXTRACTION_READY',
  'EXTRACTION_COMPLETED',
  'RESEARCH_COMPLETED',
  'APEX_SPAWNED',
]);

const PLAYER_ACTION_TYPES = new Set<GameEventType>([
  'CHARACTER_MOVED',
  'SEARCH_STARTED',
  'ITEM_FOUND',
  'ITEM_PICKED',
  'ITEM_DROPPED',
  'ITEM_USED',
  'ITEM_CRAFTED',
  'ITEM_EQUIPPED',
  'CRAFT_GOAL_SET',
  'REST',
  'GUARD',
  'SKILL_USED',
  'ZONE_DAMAGE',
  'WORLD_EVENT_DAMAGE',
]);

const PLAYER_COMBAT_TYPES = new Set<GameEventType>([
  'ENCOUNTER_STARTED',
  'ATTACK_HIT',
  'ATTACK_MISSED',
  'CHARACTER_ESCAPED',
  'STATUS_EXPIRED',
  'WILD_ENCOUNTER_STARTED',
  'WILD_ATTACK',
  'WILD_DEFEATED',
  'WILD_FLED',
]);

/** Pure UI boundary predicate; complete events remain available to DebugPanel. */
export function isEventVisibleToPlayer(event: GameEvent, playerId: string): boolean {
  if (PUBLIC_EVENT_TYPES.has(event.type)) return true;
  if (PLAYER_ACTION_TYPES.has(event.type)) return event.actorId === playerId;
  if (PLAYER_COMBAT_TYPES.has(event.type)) {
    return event.actorId === playerId || event.targetId === playerId;
  }
  if (event.type === 'WILD_DROP_CREATED') return event.actorId === playerId;
  return false;
}

export function visibleEventsForPlayer(events: GameEvent[], playerId: string): GameEvent[] {
  return events.filter((event) => isEventVisibleToPlayer(event, playerId));
}

/** 日志过滤分类 */
type LogFilter = 'all' | 'combat' | 'item' | 'zone' | 'world' | 'death' | 'other';

const FILTER_LABEL: Record<LogFilter, string> = {
  all: '全部',
  combat: '战斗',
  item: '物品',
  zone: '环境',
  world: '世界事件',
  death: '死亡',
  other: '行动',
};

/** 事件类型 -> 着色分类（沿用旧逻辑，扩充世界事件） */
function kindOf(type: GameEventType): string {
  switch (type) {
    case 'ATTACK_HIT':
    case 'ATTACK_MISSED':
    case 'WILD_ATTACK':
    case 'WILD_DEFEATED':
    case 'WILD_FLED':
    case 'APEX_SPAWNED':
      return 'k-attack';
    case 'CHARACTER_DIED':
    case 'GAME_ENDED':
    case 'VICTORY_DECLARED':
    case 'EXTRACTION_COMPLETED':
    case 'RESEARCH_COMPLETED':
      return 'k-death';
    case 'EXTRACTION_CALLED':
    case 'EXTRACTION_CANCELLED':
    case 'EXTRACTION_READY':
      return 'k-zone';
    case 'ZONE_WARNING':
    case 'ZONE_RESTRICTED':
    case 'ZONE_DAMAGE':
      return 'k-zone';
    case 'ITEM_FOUND':
    case 'ITEM_CRAFTED':
    case 'ITEM_PICKED':
    case 'ITEM_USED':
    case 'ITEM_EQUIPPED':
    case 'WILD_DROP_CREATED':
      return 'k-item';
    case 'WORLD_EVENT':
    case 'WORLD_EVENT_ENDED':
      return 'k-world';
    default:
      return '';
  }
}

/** 事件类型 -> 过滤分类（Phase 3A Step 12 日志过滤） */
function filterOf(type: GameEventType): LogFilter {
  switch (type) {
    case 'ATTACK_HIT':
    case 'ATTACK_MISSED':
    case 'ENCOUNTER_STARTED':
    case 'CHARACTER_ESCAPED':
    case 'GUARD':
    case 'SKILL_USED':
    case 'STATUS_EXPIRED':
    case 'WILD_ENCOUNTER_STARTED':
    case 'WILD_ATTACK':
    case 'WILD_DEFEATED':
    case 'WILD_FLED':
    case 'APEX_SPAWNED':
      return 'combat';
    case 'ITEM_FOUND':
    case 'ITEM_CRAFTED':
    case 'ITEM_PICKED':
    case 'ITEM_DROPPED':
    case 'ITEM_USED':
    case 'ITEM_EQUIPPED':
    case 'WILD_DROP_CREATED':
      return 'item';
    case 'ZONE_WARNING':
    case 'ZONE_RESTRICTED':
    case 'ZONE_DAMAGE':
    case 'ZONE_EXHAUSTED':
    case 'PHASE_CHANGED':
    case 'FINALE_DECAY':
      return 'zone';
    case 'WORLD_EVENT':
    case 'WORLD_EVENT_ENDED':
      return 'world';
    case 'CHARACTER_DIED':
    case 'GAME_ENDED':
      return 'death';
    default:
      return 'other';
  }
}

/** 右栏日志：自动滚到底部，支持分类过滤 + 只看自己（Phase 3A Step 12） */
export function EventLog({ events, playerId }: EventLogProps): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<LogFilter>('all');
  const [selfOnly, setSelfOnly] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events, filter, selfOnly]);

  const visible = visibleEventsForPlayer(events, playerId).filter((e) => {
    if (selfOnly && e.actorId !== playerId) return false;
    if (filter === 'all') return true;
    return filterOf(e.type) === filter;
  });

  return (
    <div className="log-wrap">
      <div className="log-filters">
        {(['all', 'combat', 'item', 'zone', 'world', 'death', 'other'] as LogFilter[]).map(
          (f) => (
            <button
              key={f}
              className={cx('log-filter', filter === f && 'active')}
              onClick={() => setFilter(f)}
            >
              {FILTER_LABEL[f]}
            </button>
          ),
        )}
        <label className="log-self-toggle">
          <input
            type="checkbox"
            checked={selfOnly}
            onChange={(e) => setSelfOnly(e.target.checked)}
          />
          只看自己
        </label>
      </div>
      {visible.length === 0 ? (
        <div className="empty">暂无记录。</div>
      ) : (
        <div className="log-list scroll" ref={boxRef}>
          {visible.map((e) => (
            <div
              key={e.id}
              className={cx('log-line', kindOf(e.type), e.actorId === playerId && 'k-self')}
            >
              <span className="t">{e.time}</span>
              <span className="m">{e.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
