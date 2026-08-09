import type { ZoneStatus } from '../core/types';
import { ZONE_STATUS_LABEL } from '../utils/format';

/** Presentation-only state cues. Core zone rules remain the source of truth. */
export interface ZoneStatusMeta {
  label: string;
  icon: string;
  pattern: 'clear' | 'stripe' | 'diagonal';
  description: string;
}

export const ZONE_STATUS_META: Record<ZoneStatus, ZoneStatusMeta> = {
  safe: {
    label: ZONE_STATUS_LABEL.safe,
    icon: '◇',
    pattern: 'clear',
    description: '可停留，继续规划下一步行动。',
  },
  warning: {
    label: ZONE_STATUS_LABEL.warning,
    icon: '⚠',
    pattern: 'stripe',
    description: '即将封锁，优先规划撤离路线。',
  },
  restricted: {
    label: ZONE_STATUS_LABEL.restricted,
    icon: '✕',
    pattern: 'diagonal',
    description: '已封锁，停留会持续损失生命。',
  },
};

export function zoneStatusMeta(status: ZoneStatus | undefined): ZoneStatusMeta {
  return ZONE_STATUS_META[status ?? 'safe'];
}

export interface ZoneUrgencyMeta {
  urgency: 'stable' | 'near' | 'imminent';
  label: string;
  icon: string;
}

/** 由 core 已公布的 warningAtTime 映射为非颜色倒计时线索。 */
export function warningRemaining(
  warningAtTime: number | null | undefined,
  currentTime: number,
  duration: number,
): number | null {
  if (warningAtTime === null || warningAtTime === undefined) return null;
  return Math.max(0, duration - (currentTime - warningAtTime));
}

export function zoneUrgencyMeta(remaining: number | null): ZoneUrgencyMeta {
  if (remaining === null) return { urgency: 'stable', label: '按计划观察', icon: '◇' };
  if (remaining <= 1) return { urgency: 'imminent', label: '最后 1 回合', icon: '!' };
  return { urgency: 'near', label: '即将封锁', icon: '⚠' };
}

export interface PlayerHazardFeedback {
  eventId: string;
  source: '禁区侵蚀' | '研究异常';
  damage: number;
}

/** 只返回玩家本回合已发生的环境伤害，避免把远处 NPC 受伤展示出来。 */
export function latestPlayerHazardFeedback(
  events: Array<{
    id: string;
    type: string;
    actorId: string | null;
    time: number;
    metadata: Record<string, string | number | boolean | null>;
  }>,
  playerId: string,
  currentTime: number,
): PlayerHazardFeedback | null {
  const event = [...events]
    .reverse()
    .find(
      (candidate) =>
        candidate.actorId === playerId &&
        candidate.time === currentTime &&
        (candidate.type === 'ZONE_DAMAGE' || candidate.type === 'WORLD_EVENT_DAMAGE'),
    );
  if (!event || typeof event.metadata.damage !== 'number' || event.metadata.damage <= 0) return null;
  return {
    eventId: event.id,
    source: event.type === 'ZONE_DAMAGE' ? '禁区侵蚀' : '研究异常',
    damage: event.metadata.damage,
  };
}
