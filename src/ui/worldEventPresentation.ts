import type { GameEvent, WorldEventId, WorldEventState } from '../core/types';

export type WorldEventSeverity = 'critical' | 'elevated' | 'ambient';

export interface WorldEventMeta {
  severity: WorldEventSeverity;
  severityLabel: string;
  icon: string;
  pattern: 'hazard' | 'signal' | 'soft';
  rank: number;
}

/** 展示分级只描述视觉权重，不改变事件效果、持续时间或触发规则。 */
export const WORLD_EVENT_META: Record<WorldEventId, WorldEventMeta> = {
  research_anomaly: {
    severity: 'critical',
    severityLabel: '直接威胁',
    icon: '☠',
    pattern: 'hazard',
    rank: 3,
  },
  emergency_broadcast: {
    severity: 'elevated',
    severityLabel: '紧急播报',
    icon: '!',
    pattern: 'signal',
    rank: 2,
  },
  blackout: {
    severity: 'elevated',
    severityLabel: '环境影响',
    icon: '◌',
    pattern: 'signal',
    rank: 2,
  },
  citywide_unrest: {
    severity: 'elevated',
    severityLabel: '环境影响',
    icon: '≈',
    pattern: 'signal',
    rank: 2,
  },
  rain: {
    severity: 'ambient',
    severityLabel: '环境影响',
    icon: '∿',
    pattern: 'soft',
    rank: 1,
  },
  medical_alert: {
    severity: 'ambient',
    severityLabel: '区域影响',
    icon: '+',
    pattern: 'soft',
    rank: 1,
  },
};

export function worldEventMeta(eventId: WorldEventId): WorldEventMeta {
  return WORLD_EVENT_META[eventId];
}

/** 稳定排序：直接威胁优先，其次逼近结束的事件，再按实例 id 稳定排序。 */
export function sortWorldEvents(events: WorldEventState[]): WorldEventState[] {
  return [...events].sort((a, b) => {
    const severityDelta = worldEventMeta(b.eventId).rank - worldEventMeta(a.eventId).rank;
    if (severityDelta !== 0) return severityDelta;
    const remainingDelta = a.remaining - b.remaining;
    if (remainingDelta !== 0) return remainingDelta;
    return a.id.localeCompare(b.id);
  });
}

export interface RemainingMeta {
  urgency: 'stable' | 'near' | 'imminent';
  label: string;
  icon: string;
}

export function worldEventRemainingMeta(remaining: number): RemainingMeta {
  if (remaining <= 1) {
    return { urgency: 'imminent', label: '即将结束', icon: '!' };
  }
  if (remaining <= 2) {
    return { urgency: 'near', label: '临近结束', icon: '·' };
  }
  return { urgency: 'stable', label: '持续中', icon: '↻' };
}

export function eventScopeLabel(scope: 'global' | 'zone', zoneName?: string): string {
  return scope === 'global' ? '全城' : zoneName ? `区域 · ${zoneName}` : '指定区域';
}

/** 只识别 core 已明确标记的即时世界事件，不猜测未来事件。 */
export function latestInstantWorldEvent(events: GameEvent[]): GameEvent | null {
  return [...events]
    .reverse()
    .find((event) => event.type === 'WORLD_EVENT' && event.metadata.instant === true) ?? null;
}
