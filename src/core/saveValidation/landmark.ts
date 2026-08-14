import { LANDMARKS, tryGetLandmarkDef } from '../../data/landmarks';
import { validateStack } from './numbers';
import { isFiniteNumber, isRecord, type ValidationContext } from './types';

const LANDMARK_STAT_FIELDS = [
  'landmarkSearches', 'landmarkExhaustions', 'facilityUses', 'facilityActivations',
  'npcLandmarkSearches', 'landmarkWildEncounters', 'landmarkItemsRecovered',
] as const;

export function validateLandmarkState(ctx: ValidationContext): void {
  const { state, zones, characters, zoneIds, fail } = ctx;
  if (!isRecord(state.stats)) fail('state.stats 必须是对象');
  else for (const field of LANDMARK_STAT_FIELDS) {
    const value = state.stats[field];
    if (!isFiniteNumber(value) || value < 0) fail(`state.stats.${field} 必须为非负数`);
  }
  if (!isRecord(state.landmarks)) {
    fail('state.landmarks 必须是对象');
    return;
  }
  const runtime = state.landmarks as Record<string, unknown>;
  const expected = new Set(LANDMARKS.map((def) => def.id));
  for (const def of LANDMARKS) {
    const raw = runtime[def.id];
    if (!isRecord(raw)) {
      fail(`缺少地标运行时状态：${def.id}`);
      continue;
    }
    if (raw.landmarkId !== def.id) fail(`地标键 ${def.id} 与 landmarkId 不一致`);
    if (raw.zoneId !== def.zoneId || !zoneIds.has(String(raw.zoneId))) fail(`地标 ${def.id} 的 zoneId 错误`);
    if (!isRecord(zones[def.zoneId])) fail(`地标 ${def.id} 所属区域不存在`);
    for (const key of ['discovered', 'exhausted', 'disabled', 'repaired', 'activated', 'locked']) if (typeof raw[key] !== 'boolean') fail(`地标 ${def.id} 的 ${key} 必须为布尔值`);
    for (const key of ['remainingSearches', 'maxSearches', 'charges', 'maxCharges']) if (!isFiniteNumber(raw[key]) || !Number.isInteger(raw[key]) || (raw[key] as number) < 0) fail(`地标 ${def.id} 的 ${key} 必须为非负整数`);
    if (isFiniteNumber(raw.remainingSearches) && isFiniteNumber(raw.maxSearches) && raw.remainingSearches > raw.maxSearches) fail(`地标 ${def.id} remainingSearches 超过 maxSearches`);
    if (isFiniteNumber(raw.charges) && isFiniteNumber(raw.maxCharges) && raw.charges > raw.maxCharges) fail(`地标 ${def.id} charges 超过 maxCharges`);
    if (raw.exhausted === true && (raw.remainingSearches !== 0 || (Array.isArray(raw.loot) && raw.loot.length > 0))) fail(`地标 ${def.id} 标记 exhausted 但仍有资源`);
    if (raw.locked === true && raw.activated === true) fail(`地标 ${def.id} 不能同时 locked 与 activated`);
    if (raw.disabled === true && raw.repaired === true) fail(`地标 ${def.id} 不能同时 disabled 与 repaired`);
    if (raw.activated === true && raw.discovered !== true) fail(`地标 ${def.id} activated 但未 discovered`);
    const interaction = def.interaction;
    if (def.access && raw.locked === false) {
      for (const requirement of def.access.prerequisites) {
        if (requirement.kind !== 'landmark_state') continue;
        const prerequisite = runtime[requirement.landmarkId];
        if (!isRecord(prerequisite)) continue;
        const satisfied = requirement.state === 'discovered'
          ? prerequisite.discovered === true
          : requirement.state === 'repaired'
            ? prerequisite.repaired === true
            : prerequisite.activated === true;
        if (!satisfied) fail(`地标 ${def.id} 已解锁但前置 ${requirement.landmarkId}.${requirement.state} 未完成`);
      }
    }
    if (interaction) {
      if (raw.maxCharges !== interaction.maxCharges) fail(`设施 ${def.id} maxCharges 与定义不一致`);
      if (interaction.requiresRepair && raw.repaired === true && raw.disabled === true) fail(`设施 ${def.id} 修复状态矛盾`);
    } else if (raw.maxCharges !== 0 || raw.charges !== 0) fail(`普通地标 ${def.id} 不应有设施次数`);
    if (!Array.isArray(raw.loot)) fail(`地标 ${def.id} loot 类型错误`);
    else for (const stack of raw.loot) validateStack(ctx, stack, `地标 ${def.id} 的隐藏物资`);
    if (raw.lastUsedAt !== null && (!isFiniteNumber(raw.lastUsedAt) || !Number.isInteger(raw.lastUsedAt) || raw.lastUsedAt < 0 || (isFiniteNumber(state.time) && raw.lastUsedAt > state.time))) fail(`地标 ${def.id} lastUsedAt 非法`);
  }
  for (const id of Object.keys(runtime)) if (!expected.has(id)) fail(`存档包含未知地标：${id}`);

  for (const [id, raw] of Object.entries(characters)) {
    if (!isRecord(raw)) continue;
    const landmarkId = raw.planRecommendedLandmarkId;
    if (landmarkId !== null && landmarkId !== undefined) {
      const def = typeof landmarkId === 'string' ? tryGetLandmarkDef(landmarkId) : null;
      if (!def) fail(`角色 ${id} 推荐了未知地标（${String(landmarkId)}）`);
      else if (raw.planRecommendedZoneId !== def.zoneId) fail(`角色 ${id} 推荐地标与推荐区域不一致`);
    }
  }

  if (Array.isArray(state.events)) for (const event of state.events) {
    if (!isRecord(event) || !isRecord(event.metadata)) continue;
    const landmarkId = event.metadata.landmarkId;
    if (landmarkId === undefined) continue;
    const def = typeof landmarkId === 'string' ? tryGetLandmarkDef(landmarkId) : null;
    if (!def) fail(`事件 ${String(event.id)} 引用了未知地标（${String(landmarkId)}）`);
    else if (event.zoneId !== def.zoneId) fail(`事件 ${String(event.id)} 的 landmarkId 与 zoneId 不一致`);
    const interactionId = event.metadata.interactionId;
    if (interactionId !== undefined && event.type !== 'FACILITY_USED' && event.type !== 'FACILITY_ACTIVATED') fail(`事件 ${String(event.id)} 的 interactionId 用在非设施事件上`);
    if (interactionId !== undefined && (typeof interactionId !== 'string' || def?.interaction?.id !== interactionId)) fail(`事件 ${String(event.id)} 引用了错误设施交互`);
    if (event.type === 'LANDMARK_UNLOCKED') {
      if (!def?.access) fail(`事件 ${String(event.id)} 解锁了没有访问定义的地标`);
      const triggerId = event.metadata.triggerLandmarkId;
      const triggerDef = typeof triggerId === 'string' ? tryGetLandmarkDef(triggerId) : null;
      if (!triggerDef) fail(`事件 ${String(event.id)} 缺少合法解锁触发地标`);
      if (def?.access && typeof triggerId === 'string' && !def.access.prerequisites.some((requirement) => requirement.kind === 'landmark_state' && requirement.landmarkId === triggerId)) {
        fail(`事件 ${String(event.id)} 的触发地标不是该访问链前置`);
      }
    }
  }
}
