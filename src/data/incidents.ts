import type { IncidentDefinition } from '../core/types';
import { tryGetItem } from './items';
import { tryGetLandmarkDef } from './landmarks';
import { tryGetZoneDef } from './zones';

/**
 * Phase 4T — static incident definitions.
 *
 * This registry is content only: it never reads GameState. Exact finite
 * rewards are instantiated into the per-match runtime at activation through
 * the shared `createStack` path, and per-match schedules are resolved from the
 * game seed (see `src/core/incidents.ts`).
 *
 * Four archetypes cover the required substrate:
 *   A. Temporary opportunity (finite reward pool)          — factory_salvage
 *   B. Temporary facility opportunity (overlay charges)   — hospital_emergency
 *   C. Incident changes local access (temporary unlock)   — underground_maintenance
 *   D. Risk / reward (public broadcast, local specifics)  — lab_containment
 */
export const INCIDENT_DEFINITIONS: readonly IncidentDefinition[] = [
  {
    id: 'factory_salvage',
    title: '机修车间紧急抢救',
    description: '一台故障设备留下了有限的可拆零件，但只有抵达现场的人才知道。',
    zoneId: 'factory',
    visibility: 'LOCAL_DISCOVERY',
    category: 'opportunity',
    scheduleMin: 30,
    scheduleMax: 70,
    duration: 15,
    publicResolution: false,
    effect: { kind: 'reward_pool', itemIds: ['iron', 'wire'], countPerItem: 1 },
    publicFact: '',
    actionLabel: '抢救设备零件',
    personalityPreference: { collector: 1.4, opportunist: 1.2, cautious: 0.7 },
  },
  {
    id: 'hospital_emergency',
    title: '医院急诊窗口',
    description: '医院广播紧急求助：手术室进入临时急诊窗口，可以多处理几次伤口。',
    zoneId: 'hospital',
    visibility: 'PUBLIC_BROADCAST',
    category: 'opportunity',
    scheduleMin: 25,
    scheduleMax: 60,
    duration: 12,
    publicResolution: true,
    effect: { kind: 'facility_overlay', landmarkId: 'hospital_operating_room', overlayCharges: 2, interactionId: 'treat_wounds', healAmount: 22 },
    publicFact: '医院进入紧急急诊窗口，手术室可提供有限治疗。',
    actionLabel: '使用急诊手术室',
    personalityPreference: { cautious: 1.3, collector: 1.1, aggressive: 0.8 },
  },
  {
    id: 'underground_maintenance',
    title: '地下维护窗口',
    description: '地下通道的一段维护作业临时开放了一条封闭通路，只有到场的人能利用。',
    zoneId: 'underground',
    visibility: 'LOCAL_DISCOVERY',
    category: 'local_state_change',
    scheduleMin: 35,
    scheduleMax: 75,
    duration: 14,
    publicResolution: false,
    effect: { kind: 'access_override', landmarkId: 'underground_sealed_passage', searchable: true },
    publicFact: '',
    actionLabel: '进入维护通路',
    personalityPreference: { opportunist: 1.3, aggressive: 1.2, cautious: 0.6 },
  },
  {
    id: 'lab_containment',
    title: '研究所封堵失败',
    description: '广播称研究所出现封堵异常；但具体风险与残留物资只有到场才能确认。',
    zoneId: 'lab',
    visibility: 'PUBLIC_BROADCAST',
    category: 'risk_reward',
    scheduleMin: 40,
    scheduleMax: 85,
    duration: 12,
    publicResolution: true,
    effect: { kind: 'reward_with_hazard', itemIds: ['chemical_mix', 'battery_pack'], countPerItem: 1, hazardDamage: 6 },
    publicFact: '研究所出现封堵异常，现场存在风险与有限物资。',
    actionLabel: '搜寻封锁区残留',
    personalityPreference: { aggressive: 1.3, opportunist: 1.2, cautious: 0.4 },
  },
];

const BY_ID = new Map(INCIDENT_DEFINITIONS.map((definition) => [definition.id, definition]));

export function getIncidentDef(id: string): IncidentDefinition {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`未知 incident id: ${id}`);
  return def;
}

export function tryGetIncidentDef(id: string): IncidentDefinition | null {
  return BY_ID.get(id) ?? null;
}

export const INCIDENT_IDS: string[] = INCIDENT_DEFINITIONS.map((definition) => definition.id);

/** Static registry self-check; fails at module load on bad references. */
function validateIncidentRegistry(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const def of INCIDENT_DEFINITIONS) {
    if (seen.has(def.id)) errors.push(`重复 incident id：${def.id}`);
    seen.add(def.id);
    if (!tryGetZoneDef(def.zoneId)) errors.push(`incident ${def.id} 引用未知区域 ${def.zoneId}`);
    if (!Number.isInteger(def.scheduleMin) || !Number.isInteger(def.scheduleMax)
      || def.scheduleMin < 1 || def.scheduleMax < def.scheduleMin) {
      errors.push(`incident ${def.id} 的调度窗口非法`);
    }
    if (!Number.isInteger(def.duration) || def.duration <= 0) errors.push(`incident ${def.id} 的 duration 非法`);
    if (def.visibility !== 'PUBLIC_BROADCAST' && def.visibility !== 'LOCAL_DISCOVERY') {
      errors.push(`incident ${def.id} 的 visibility 非法`);
    }
    const effect = def.effect;
    if (effect.kind === 'reward_pool' || effect.kind === 'reward_with_hazard') {
      if (effect.itemIds.length === 0) errors.push(`incident ${def.id} 的奖励池为空`);
      for (const itemId of effect.itemIds) if (!tryGetItem(itemId)) errors.push(`incident ${def.id} 引用了未知奖励物品 ${itemId}`);
      if (!Number.isInteger(effect.countPerItem) || effect.countPerItem <= 0) errors.push(`incident ${def.id} 的奖励数量非法`);
    }
    if (effect.kind === 'facility_overlay') {
      if (!tryGetLandmarkDef(effect.landmarkId)) errors.push(`incident ${def.id} 引用了未知设施 ${effect.landmarkId}`);
      if (!Number.isInteger(effect.overlayCharges) || effect.overlayCharges <= 0) errors.push(`incident ${def.id} 的 overlayCharges 非法`);
    }
    if (effect.kind === 'access_override') {
      if (!tryGetLandmarkDef(effect.landmarkId)) errors.push(`incident ${def.id} 引用了未知地标 ${effect.landmarkId}`);
    }
  }
  return errors;
}

const REGISTRY_ERRORS = validateIncidentRegistry();
if (REGISTRY_ERRORS.length > 0) throw new Error(REGISTRY_ERRORS.join('；'));
