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
