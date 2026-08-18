import { tryGetItem } from '../../data/items';
import { tryGetIncidentDef } from '../../data/incidents';
import { tryGetLandmarkDef } from '../../data/landmarks';
import { tryGetRecipe } from '../../data/recipes';
import { tryGetWildEnemy } from '../../data/wildEnemies';
import { ACTOR_MEMORY_CAPACITY } from '../npcKnowledge';
import { isRecord, type ValidationContext } from './types';

const PROVENANCE = new Set(['PUBLIC_EVENT', 'DIRECT_LOCAL', 'SELF_ACTION']);
const LANDMARK_STATE = new Set(['available', 'blocked', 'exhausted']);
const SOURCE_STATE = new Set(['available', 'unavailable', 'exhausted']);
const THREAT = new Set(['unknown', 'low', 'medium', 'high']);
const ACTIONS = new Set([
  'MOVE', 'SEARCH', 'SEARCH_LANDMARK', 'INTERACT_LANDMARK', 'RESOLVE_INCIDENT', 'ATTACK', 'FLEE',
  'CRAFT', 'PICKUP', 'EQUIP', 'EXTRACT', 'SUBMIT_RESEARCH', 'GUARD', 'REST',
]);
const TARGET_KINDS = new Set(['none', 'zone', 'landmark', 'actor', 'wild', 'recipe', 'item']);

const INTENT_REASONS: Record<string, Set<string>> = {
  gear_up: new Set(['GEAR_GROWTH', 'APEX_PUBLIC_NOT_READY']),
  seek_material: new Set(['MISSING_RAW_MATERIAL', 'UNKNOWN_SOURCE']),
  explore_unknown: new Set(['UNKNOWN_SOURCE']),
  avoid_threat: new Set(['RECENT_HIGH_THREAT']),
  hunt_known_target: new Set(['KNOWN_TARGET']),
  contest_apex: new Set(['APEX_PUBLIC_AND_READY']),
  pursue_extraction: new Set(['FORMAL_EXTRACTION_GOAL']),
  pursue_research: new Set(['FORMAL_RESEARCH_GOAL']),
  recover: new Set(['LOW_HP', 'LOW_STAMINA']),
  respond_to_incident: new Set(['KNOWN_INCIDENT_OPPORTUNITY']),
};

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const expected = new Set(allowed);
  return Object.keys(value).every((key) => expected.has(key)) && allowed.every((key) => Object.hasOwn(value, key));
}

function validTimestamp(value: unknown, now: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    && typeof now === 'number' && value <= now;
}

function expectedMemoryKey(entry: Record<string, unknown>): string | null {
  switch (entry.kind) {
    case 'zone_visit': return `zone:${String(entry.zoneId)}`;
    case 'landmark_state': return `landmark:${String(entry.landmarkId)}`;
    case 'source_status': return `source:${String(entry.itemId)}:${String(entry.landmarkId)}`;
    case 'actor_sighting': return `actor:${String(entry.subjectActorId)}`;
    case 'wild_seen': return `wild:${String(entry.wildDefId)}`;
    case 'apex_public': return `apex:${String(entry.wildDefId)}`;
    case 'public_match': return `public:${String(entry.eventType)}:${entry.subjectActorId ?? '-'}:${entry.zoneId ?? '-'}`;
    case 'recent_action': return `action:${String(entry.action)}:${String(entry.targetKind)}:${entry.targetId ?? '-'}`;
    case 'own_item': return `item:${String(entry.itemId)}`;
    case 'own_goal': return `goal:${String(entry.goalType)}`;
    case 'incident_observed': return `incident:${String(entry.incidentId)}`;
    default: return null;
  }
}

function validateActionTarget(
  ctx: ValidationContext,
  ownerId: string,
  entry: Record<string, unknown>,
): boolean {
  const { state, charIds, zoneIds } = ctx;
  const kind = entry.targetKind;
  const id = entry.targetId;
  if (kind === 'none') return id === null;
  if (typeof id !== 'string') return false;
  if (kind === 'zone') return zoneIds.has(id);
  if (kind === 'landmark') return Boolean(tryGetLandmarkDef(id));
  if (kind === 'actor') return charIds.has(id) && id !== ownerId;
  if (kind === 'wild') return isRecord(state.wildEnemies) && Object.hasOwn(state.wildEnemies, id);
  if (kind === 'recipe') return Boolean(tryGetRecipe(id));
  if (kind === 'item') return Boolean(tryGetItem(id));
  return false;
}

function actionTargetCompatible(entry: Record<string, unknown>): boolean {
  const action = entry.action;
  const kind = entry.targetKind;
  if (action === 'MOVE') return kind === 'zone';
  if (action === 'SEARCH' || action === 'EXTRACT' || action === 'SUBMIT_RESEARCH'
    || action === 'GUARD' || action === 'REST') return kind === 'none';
  if (action === 'SEARCH_LANDMARK' || action === 'INTERACT_LANDMARK') return kind === 'landmark';
  if (action === 'RESOLVE_INCIDENT') return kind === 'item';
  if (action === 'ATTACK' || action === 'FLEE') return kind === 'actor' || kind === 'wild';
  if (action === 'CRAFT') return kind === 'recipe';
  if (action === 'PICKUP' || action === 'EQUIP') return kind === 'item';
  return false;
}

function validateEntry(ctx: ValidationContext, ownerId: string, entry: Record<string, unknown>, index: number): void {
  const { state, charIds, zoneIds, fail } = ctx;
  const label = `角色 ${ownerId} 的 knowledgeMemory.entries[${index}]`;
  const base = ['key', 'kind', 'observedAt', 'provenance'];
  if (typeof entry.kind !== 'string' || typeof entry.key !== 'string') {
    fail(`${label} 缺少合法 kind/key`);
    return;
  }
  if (!validTimestamp(entry.observedAt, state.time)) fail(`${label}.observedAt 非法`);
  if (typeof entry.provenance !== 'string' || !PROVENANCE.has(entry.provenance)) {
    fail(`${label}.provenance 非法`);
  }
  const publicKind = entry.kind === 'apex_public' || entry.kind === 'public_match';
  // Public-only kinds (`apex_public`, `public_match`) must have a
  // PUBLIC_EVENT provenance. `incident_observed` accepts either PUBLIC_EVENT
  // (broadcast) or DIRECT_LOCAL (local discovery), so it is intentionally
  // excluded from this one-directional check; its provenance is validated
  // against the incident's visibility further down.
  if (publicKind && entry.provenance !== 'PUBLIC_EVENT') fail(`${label} 的 kind 与 provenance 不相容`);

  const badShape = (fields: string[]): void => {
    if (!exactKeys(entry, [...base, ...fields])) fail(`${label} 含有缺失、无关或隐藏 runtime snapshot 字段`);
  };

  switch (entry.kind) {
    case 'zone_visit':
      badShape(['zoneId']);
      if (typeof entry.zoneId !== 'string' || !zoneIds.has(entry.zoneId)) fail(`${label}.zoneId 非法`);
      break;
    case 'landmark_state':
      badShape(['landmarkId', 'state']);
      if (typeof entry.landmarkId !== 'string' || !tryGetLandmarkDef(entry.landmarkId)) fail(`${label}.landmarkId 非法`);
      if (typeof entry.state !== 'string' || !LANDMARK_STATE.has(entry.state)) fail(`${label}.state 非法`);
      break;
    case 'source_status': {
      badShape(['landmarkId', 'itemId', 'state']);
      const landmark = typeof entry.landmarkId === 'string' ? tryGetLandmarkDef(entry.landmarkId) : null;
      if (!landmark) fail(`${label}.landmarkId 非法`);
      if (typeof entry.itemId !== 'string' || !tryGetItem(entry.itemId)) fail(`${label}.itemId 非法`);
      if (landmark && typeof entry.itemId === 'string'
        && !landmark.initialLoot.some((candidate) => candidate.itemId === entry.itemId)) {
        fail(`${label} 的 landmark 并不是该 item 的公开 source`);
      }
      if (typeof entry.state !== 'string' || !SOURCE_STATE.has(entry.state)) fail(`${label}.state 非法`);
      break;
    }
    case 'actor_sighting':
      badShape(['subjectActorId', 'zoneId', 'threat']);
      if (typeof entry.subjectActorId !== 'string' || !charIds.has(entry.subjectActorId)
        || entry.subjectActorId === ownerId) fail(`${label}.subjectActorId 非法`);
      if (typeof entry.zoneId !== 'string' || !zoneIds.has(entry.zoneId)) fail(`${label}.zoneId 非法`);
      if (typeof entry.threat !== 'string' || !THREAT.has(entry.threat)) fail(`${label}.threat 非法`);
      break;
    case 'wild_seen': {
      badShape(['wildDefId', 'zoneId', 'tier']);
      const def = typeof entry.wildDefId === 'string' ? tryGetWildEnemy(entry.wildDefId) : null;
      if (!def) fail(`${label}.wildDefId 非法`);
      if (typeof entry.zoneId !== 'string' || !zoneIds.has(entry.zoneId)) fail(`${label}.zoneId 非法`);
      if (!def || entry.tier !== def.tier) fail(`${label}.tier 与 Wild 定义不一致`);
      break;
    }
    case 'apex_public': {
      badShape(['wildDefId', 'zoneId', 'lifecycle']);
      const def = typeof entry.wildDefId === 'string' ? tryGetWildEnemy(entry.wildDefId) : null;
      if (!def || def.tier !== 'apex') fail(`${label}.wildDefId 不是合法 Apex`);
      if (typeof entry.zoneId !== 'string' || !zoneIds.has(entry.zoneId)) fail(`${label}.zoneId 非法`);
      if (entry.lifecycle !== 'spawned' && entry.lifecycle !== 'defeated') fail(`${label}.lifecycle 非法`);
      break;
    }
    case 'public_match':
      badShape(['eventType', 'subjectActorId', 'zoneId']);
      if (!['CHARACTER_DIED', 'VICTORY_DECLARED', 'ZONE_RESTRICTED'].includes(String(entry.eventType))) {
        fail(`${label}.eventType 非法`);
      }
      if (entry.eventType === 'CHARACTER_DIED') {
        if (typeof entry.subjectActorId !== 'string' || !charIds.has(entry.subjectActorId)) fail(`${label}.subjectActorId 非法`);
      } else if (entry.subjectActorId !== null) fail(`${label} 不应携带 actor subject`);
      if (entry.zoneId !== null && (typeof entry.zoneId !== 'string' || !zoneIds.has(entry.zoneId))) fail(`${label}.zoneId 非法`);
      break;
    case 'recent_action':
      badShape(['action', 'outcome', 'targetKind', 'targetId']);
      if (typeof entry.action !== 'string' || !ACTIONS.has(entry.action)) fail(`${label}.action 非法`);
      if (entry.outcome !== 'success' && entry.outcome !== 'failure') fail(`${label}.outcome 非法`);
      if (typeof entry.targetKind !== 'string' || !TARGET_KINDS.has(entry.targetKind)
        || !validateActionTarget(ctx, ownerId, entry) || !actionTargetCompatible(entry)) {
        fail(`${label} 的 action/target 字段不相容`);
      }
      break;
    case 'own_item':
      badShape(['itemId']);
      if (typeof entry.itemId !== 'string' || !tryGetItem(entry.itemId)) fail(`${label}.itemId 非法`);
      break;
    case 'own_goal':
      badShape(['goalType', 'progress']);
      if (!['craft', 'research', 'extraction', 'apex'].includes(String(entry.goalType))) fail(`${label}.goalType 非法`);
      if (!['started', 'progressed', 'completed'].includes(String(entry.progress))) fail(`${label}.progress 非法`);
      break;
    case 'incident_observed': {
      badShape(['incidentId', 'zoneId', 'observedState']);
      if (typeof entry.incidentId !== 'string' || !tryGetIncidentDef(entry.incidentId)) fail(`${label}.incidentId 非法`);
      if (typeof entry.zoneId !== 'string' || !zoneIds.has(entry.zoneId)) fail(`${label}.zoneId 非法`);
      if (entry.observedState !== 'active' && entry.observedState !== 'resolved' && entry.observedState !== 'expired') {
        fail(`${label}.observedState 非法`);
      }
      const incidentDef = tryGetIncidentDef(String(entry.incidentId));
      if (incidentDef && entry.provenance === 'PUBLIC_EVENT' && incidentDef.visibility !== 'PUBLIC_BROADCAST') {
        fail(`${label} 的 PUBLIC_EVENT 记忆引用了 LOCAL_DISCOVERY 事件`);
      }
      // A PUBLIC_BROADCAST incident is legally learnable both through the
      // broadcast (PUBLIC_EVENT) and through physical presence (DIRECT_LOCAL),
      // so both provenances are valid for it. LOCAL_DISCOVERY incidents only
      // ever enter memory through DIRECT_LOCAL (checked above).
      if (incidentDef && entry.zoneId !== incidentDef.zoneId) {
        fail(`${label}.zoneId 与 incident 定义的 zone 不一致`);
      }
      break;
    }
    default:
      fail(`${label}.kind 非法`);
  }
  const expected = expectedMemoryKey(entry);
  if (expected === null || entry.key !== expected) fail(`${label}.key 与语义字段不一致`);
}

function validateStrategicIntent(ctx: ValidationContext, ownerId: string, character: Record<string, unknown>): void {
  const { state, charIds, zoneIds, fail } = ctx;
  if (!Object.hasOwn(character, 'strategicIntent')) {
    fail(`角色 ${ownerId} 缺少当前版本 strategicIntent 字段`);
    return;
  }
  const intent = character.strategicIntent;
  if (intent === null) return;
  if (!isRecord(intent) || !exactKeys(intent, ['type', 'reason', 'targetId', 'committedAt', 'reevaluateAt'])) {
    fail(`角色 ${ownerId} 的 strategicIntent 结构非法`);
    return;
  }
  if (character.isPlayer === true) fail(`玩家角色 ${ownerId} 不得保存 private strategicIntent`);
  if (typeof intent.type !== 'string' || !Object.hasOwn(INTENT_REASONS, intent.type)) {
    fail(`角色 ${ownerId} 的 strategicIntent.type 非法`);
    return;
  }
  if (typeof intent.reason !== 'string' || !INTENT_REASONS[intent.type]?.has(intent.reason)) {
    fail(`角色 ${ownerId} 的 strategicIntent.reason 与 type 不相容`);
  }
  if (!validTimestamp(intent.committedAt, state.time)) fail(`角色 ${ownerId} 的 strategicIntent.committedAt 非法`);
  if (typeof intent.reevaluateAt !== 'number' || !Number.isInteger(intent.reevaluateAt)
    || intent.reevaluateAt < Number(intent.committedAt)) fail(`角色 ${ownerId} 的 strategicIntent.reevaluateAt 非法`);

  const target = intent.targetId;
  if (intent.type === 'seek_material') {
    if (typeof target !== 'string' || !tryGetItem(target)) fail(`角色 ${ownerId} 的 seek_material target 非法`);
  } else if (intent.type === 'avoid_threat') {
    if (typeof target !== 'string' || !zoneIds.has(target)) fail(`角色 ${ownerId} 的 avoid_threat target 非法`);
  } else if (intent.type === 'hunt_known_target') {
    if (typeof target !== 'string' || !charIds.has(target) || target === ownerId) fail(`角色 ${ownerId} 的 hunt target 非法`);
  } else if (intent.type === 'contest_apex') {
    const def = typeof target === 'string' ? tryGetWildEnemy(target) : null;
    if (!def || def.tier !== 'apex') fail(`角色 ${ownerId} 的 contest_apex target 非法`);
    const schedule = Array.isArray(state.apexSchedule)
      ? state.apexSchedule.find((entry) => isRecord(entry) && entry.defId === target)
      : null;
    const publiclyDefeated = Array.isArray(state.events) && state.events.some((event) =>
      isRecord(event) && event.type === 'APEX_DEFEATED'
      && isRecord(event.metadata) && event.metadata.wildDefId === target,
    );
    if (!isRecord(schedule) || schedule.spawned !== true || publiclyDefeated) {
      fail(`角色 ${ownerId} 的 contest_apex target 不是当前合法公共 Apex`);
    }
  } else if (intent.type === 'explore_unknown') {
    if (target !== null && (typeof target !== 'string' || !zoneIds.has(target))) fail(`角色 ${ownerId} 的 explore target 非法`);
  } else if (intent.type === 'respond_to_incident') {
    if (typeof target !== 'string' || !zoneIds.has(target)) {
      fail(`角色 ${ownerId} 的 respond_to_incident target 非法`);
    } else {
      // The intent must be backed by the actor's OWN last-known memory of an
      // active incident in that zone. A stale active memory stays legal even
      // if the remote live runtime has already ended, so this check reads
      // only the actor's memory — never state.incidents.
      const memory = character.knowledgeMemory;
      const backed = isRecord(memory) && Array.isArray(memory.entries)
        && memory.entries.some((entry) => isRecord(entry)
          && entry.kind === 'incident_observed' && entry.observedState === 'active' && entry.zoneId === target);
      if (!backed) fail(`角色 ${ownerId} 的 respond_to_incident intent 缺少自身 active incident memory 支撑`);
    }
  } else if (target !== null) {
    fail(`角色 ${ownerId} 的 ${intent.type} 不得携带无关 target`);
  }
}

export function validateKnowledgeState(ctx: ValidationContext): void {
  const { characters, state, fail } = ctx;
  for (const [ownerId, raw] of Object.entries(characters)) {
    if (!isRecord(raw)) continue;
    const memory = raw.knowledgeMemory;
    if (!isRecord(memory) || !exactKeys(memory, ['ownerId', 'capacity', 'evictions', 'entries'])) {
      fail(`角色 ${ownerId} 的 knowledgeMemory 结构非法`);
      validateStrategicIntent(ctx, ownerId, raw);
      continue;
    }
    if (memory.ownerId !== ownerId) fail(`角色 ${ownerId} 的 knowledgeMemory owner 非法`);
    if (memory.capacity !== ACTOR_MEMORY_CAPACITY) fail(`角色 ${ownerId} 的 knowledgeMemory capacity 非法`);
    if (typeof memory.evictions !== 'number' || !Number.isInteger(memory.evictions) || memory.evictions < 0) {
      fail(`角色 ${ownerId} 的 knowledgeMemory evictions 非法`);
    }
    if (!Array.isArray(memory.entries)) {
      fail(`角色 ${ownerId} 的 knowledgeMemory.entries 非法`);
    } else {
      if (memory.entries.length > ACTOR_MEMORY_CAPACITY) fail(`角色 ${ownerId} 的 knowledgeMemory 超出容量上限`);
      const keys = new Set<string>();
      memory.entries.forEach((entry, index) => {
        if (!isRecord(entry)) {
          fail(`角色 ${ownerId} 的 knowledgeMemory.entries[${index}] 结构非法`);
          return;
        }
        validateEntry(ctx, ownerId, entry, index);
        if (typeof entry.key === 'string') {
          if (keys.has(entry.key)) fail(`角色 ${ownerId} 的 knowledgeMemory key 重复：${entry.key}`);
          keys.add(entry.key);
        }
      });
    }
    if (typeof state.time !== 'number') fail(`角色 ${ownerId} 无法验证 cognition timestamp`);
    validateStrategicIntent(ctx, ownerId, raw);
  }
}
