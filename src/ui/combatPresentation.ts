import type { CharacterVisualState } from './characterVisualState';

/** Presentation-only metadata for the encounter shell. Combat rules remain in src/core. */
export interface CombatPresentationMeta {
  label: string;
  icon: string;
  description: string;
}

export type CombatActionGroup = 'attack' | 'response';

export const COMBAT_MODE_META: CombatPresentationMeta = {
  label: '遭遇战进行中',
  icon: '⚔',
  description: '探索行动已锁定；先处理当前对手。',
};

export const COMBAT_RESOLVED_META: CombatPresentationMeta = {
  label: '遭遇已结束',
  icon: '✓',
  description: '确认结果后返回下一步探索行动。',
};

export const COMBAT_VISUAL_STATE_META: Record<CharacterVisualState, CombatPresentationMeta> = {
  portrait: {
    label: '常态',
    icon: '◎',
    description: '返回探索状态。',
  },
  combat: {
    label: '交战姿态',
    icon: '⚔',
    description: '已进入当前遭遇。',
  },
  injured: {
    label: '负伤姿态',
    icon: '✚',
    description: '生命状态恶化，继续行动需谨慎。',
  },
};

export const COMBAT_ACTION_GROUP_META: Record<CombatActionGroup, CombatPresentationMeta> = {
  attack: {
    label: '主要攻击',
    icon: '↗',
    description: '三档攻击保持命中率与体力成本常驻可见。',
  },
  response: {
    label: '次级行动',
    icon: '◈',
    description: '侦察、防御、技能与脱离。',
  },
};

export const COMBAT_STATUS_META = {
  guard: { label: '防御中', icon: '▣' },
  exposed: { label: '露出破绽', icon: '!' },
  skillReady: { label: '技能就绪', icon: '✦' },
  skillCooldown: { label: '技能冷却', icon: '◷' },
} as const;

export function combatModeMeta(resolved: boolean): CombatPresentationMeta {
  return resolved ? COMBAT_RESOLVED_META : COMBAT_MODE_META;
}

export function combatVisualStateMeta(state: CharacterVisualState): CombatPresentationMeta {
  return COMBAT_VISUAL_STATE_META[state];
}
