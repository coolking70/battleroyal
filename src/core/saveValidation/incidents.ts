import { INCIDENT_IDS, tryGetIncidentDef } from '../../data/incidents';
import { tryGetItem } from '../../data/items';
import { isRecord, type ValidationContext } from './types';

const INCIDENT_STATUSES = new Set(['SCHEDULED', 'ACTIVE', 'RESOLVED', 'EXPIRED']);
const RUNTIME_KEYS = [
  'incidentId',
  'status',
  'scheduledAt',
  'startedAt',
  'expiresAt',
  'resolvedAt',
  'resolvedByActorId',
  'publicBroadcastDone',
  'localDiscoveries',
  'responses',
  'rewardClaimedCount',
  'contentionFailures',
  'reward',
  'overlayCharges',
  'accessActive',
];

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const expected = new Set(allowed);
  return Object.keys(value).every((key) => expected.has(key)) && allowed.every((key) => Object.hasOwn(value, key));
}

function validIntegerOrNull(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0);
}

function validateStack(ctx: ValidationContext, owner: string, index: number, stack: Record<string, unknown>): boolean {
  const label = `角色 ${owner} 的 incident memory[${index}] 的 reward stack`;
  if (!isRecord(stack) || !exactKeys(stack, ['uid', 'itemId', 'count'])) {
    ctx.fail(`${label} 含有缺失或无关字段`);
    return false;
  }
  if (typeof stack.uid !== 'string' || stack.uid.length === 0) {
    ctx.fail(`${label}.uid 非法`);
    return false;
  }
  if (typeof stack.itemId !== 'string' || !tryGetItem(stack.itemId)) {
    ctx.fail(`${label}.itemId 非法`);
    return false;
  }
  if (typeof stack.count !== 'number' || !Number.isInteger(stack.count) || stack.count <= 0) {
    ctx.fail(`${label}.count 非法`);
    return false;
  }
  return true;
}

function validateRuntime(ctx: ValidationContext, id: string, runtime: Record<string, unknown>): void {
  const def = tryGetIncidentDef(id);
  if (!def) {
    ctx.fail(`state.incidents.${id} 引用了未知 incident 定义`);
    return;
  }
  if (!exactKeys(runtime, RUNTIME_KEYS)) {
    ctx.fail(`state.incidents.${id} 含有关键字段缺失或隐藏 runtime snapshot 字段`);
  }
  if (runtime.incidentId !== id) {
    ctx.fail(`state.incidents.${id}.incidentId 与 key 不一致`);
  }
  if (typeof runtime.status !== 'string' || !INCIDENT_STATUSES.has(runtime.status)) {
    ctx.fail(`state.incidents.${id}.status 非法`);
  }
  if (typeof runtime.scheduledAt !== 'number' || !Number.isInteger(runtime.scheduledAt) || runtime.scheduledAt < 1) {
    ctx.fail(`state.incidents.${id}.scheduledAt 非法`);
  } else if (runtime.scheduledAt < def.scheduleMin || runtime.scheduledAt > def.scheduleMax) {
    ctx.fail(`state.incidents.${id}.scheduledAt 超出定义的调度窗口`);
  }
  if (!validIntegerOrNull(runtime.startedAt)) {
    ctx.fail(`state.incidents.${id}.startedAt 非法`);
  }
  if (!validIntegerOrNull(runtime.expiresAt)) {
    ctx.fail(`state.incidents.${id}.expiresAt 非法`);
  }
  if (!validIntegerOrNull(runtime.resolvedAt)) {
    ctx.fail(`state.incidents.${id}.resolvedAt 非法`);
  }
  if (typeof runtime.resolvedByActorId !== 'string' && runtime.resolvedByActorId !== null) {
    ctx.fail(`state.incidents.${id}.resolvedByActorId 非法`);
  }
  if (runtime.resolvedByActorId !== null && runtime.resolvedByActorId !== undefined
    && typeof runtime.resolvedByActorId === 'string' && !ctx.charIds.has(runtime.resolvedByActorId)) {
    ctx.fail(`state.incidents.${id}.resolvedByActorId 引用了不存在的角色`);
  }
  if (typeof runtime.publicBroadcastDone !== 'boolean') {
    ctx.fail(`state.incidents.${id}.publicBroadcastDone 非法`);
  }
  if (typeof runtime.localDiscoveries !== 'number' || !Number.isInteger(runtime.localDiscoveries) || runtime.localDiscoveries < 0) {
    ctx.fail(`state.incidents.${id}.localDiscoveries 非法`);
  }
  if (typeof runtime.responses !== 'number' || !Number.isInteger(runtime.responses) || runtime.responses < 0) {
    ctx.fail(`state.incidents.${id}.responses 非法`);
  }
  if (typeof runtime.rewardClaimedCount !== 'number' || !Number.isInteger(runtime.rewardClaimedCount) || runtime.rewardClaimedCount < 0) {
    ctx.fail(`state.incidents.${id}.rewardClaimedCount 非法`);
  }
  if (typeof runtime.contentionFailures !== 'number' || !Number.isInteger(runtime.contentionFailures) || runtime.contentionFailures < 0) {
    ctx.fail(`state.incidents.${id}.contentionFailures 非法`);
  }
  if (typeof runtime.overlayCharges !== 'number' || !Number.isInteger(runtime.overlayCharges) || runtime.overlayCharges < 0) {
    ctx.fail(`state.incidents.${id}.overlayCharges 非法`);
  }
  if (typeof runtime.accessActive !== 'boolean') {
    ctx.fail(`state.incidents.${id}.accessActive 非法`);
  }
  if (!Array.isArray(runtime.reward)) {
    ctx.fail(`state.incidents.${id}.reward 必须是有限 stack 数组`);
  } else {
    runtime.reward.forEach((stack, index) => {
      if (!isRecord(stack)) {
        ctx.fail(`state.incidents.${id}.reward[${index}] 结构非法`);
        return;
      }
      if (!validateStack(ctx, id, index, stack)) return;
    });
  }

  const status = runtime.status;
  const startedAt = runtime.startedAt;
  const expiresAt = runtime.expiresAt;
  const resolvedAt = runtime.resolvedAt;
  const reward = runtime.reward as unknown[] | undefined;
  const rewardClaimedCount = runtime.rewardClaimedCount as number;
  const overlayCharges = runtime.overlayCharges as number;

  if (status === 'SCHEDULED') {
    if (startedAt !== null || expiresAt !== null || resolvedAt !== null) {
      ctx.fail(`state.incidents.${id} 在 SCHEDULED 状态下不得携带 startedAt/expiresAt/resolvedAt`);
    }
    if (Array.isArray(reward) && reward.length > 0) {
      ctx.fail(`state.incidents.${id} 在 SCHEDULED 状态下不得持有 reward 池`);
    }
    if (Number(overlayCharges) !== 0) {
      ctx.fail(`state.incidents.${id} 在 SCHEDULED 状态下 overlayCharges 必须为 0`);
    }
    if (runtime.accessActive !== false) {
      ctx.fail(`state.incidents.${id} 在 SCHEDULED 状态下 accessActive 必须为 false`);
    }
  }
  if (status === 'ACTIVE') {
    if (typeof startedAt !== 'number' || startedAt > Number(ctx.state.time)) {
      ctx.fail(`state.incidents.${id} 在 ACTIVE 状态下 startedAt 必须为不晚于当前时间的整数`);
    }
    if (typeof expiresAt !== 'number' || expiresAt < Number(startedAt)) {
      ctx.fail(`state.incidents.${id} 在 ACTIVE 状态下 expiresAt 必须为不早于 startedAt 的整数`);
    }
    if (resolvedAt !== null) {
      ctx.fail(`state.incidents.${id} 在 ACTIVE 状态下不得携带 resolvedAt`);
    }
    if (Array.isArray(reward) && reward.length > 0) {
      reward.forEach((stack, index) => {
        if (!isRecord(stack)) return;
        const itemId = stack.itemId;
        if (typeof itemId !== 'string' || !def.effect.kind) return;
        if ((def.effect.kind === 'reward_pool' || def.effect.kind === 'reward_with_hazard')
          && !def.effect.itemIds.includes(itemId)) {
          ctx.fail(`state.incidents.${id}.reward[${index}] 的 itemId 与定义不匹配`);
        }
      });
    }
    if ((def.effect.kind === 'facility_overlay' || def.effect.kind === 'access_override')
      && Array.isArray(reward) && reward.length > 0) {
      ctx.fail(`state.incidents.${id} 在非奖励型效果下不得持有 reward 池`);
    }
    if (def.effect.kind === 'facility_overlay' && Number(overlayCharges) > def.effect.overlayCharges) {
      ctx.fail(`state.incidents.${id} overlayCharges 超过定义上限`);
    }
    // Effect-specific ACTIVE shape: each archetype carries exactly its own
    // payload and nothing else.
    if (def.effect.kind === 'reward_pool' || def.effect.kind === 'reward_with_hazard') {
      if (Array.isArray(reward) && reward.length === 0) {
        ctx.fail(`state.incidents.${id} 在 ACTIVE 奖励型状态下必须持有非空 reward 池`);
      }
      if (Number(overlayCharges) !== 0) {
        ctx.fail(`state.incidents.${id} 在奖励型状态下不得持有 overlayCharges`);
      }
      if (runtime.accessActive !== false) {
        ctx.fail(`state.incidents.${id} 在奖励型状态下 accessActive 必须为 false`);
      }
    } else if (def.effect.kind === 'facility_overlay') {
      if (Number(overlayCharges) < 1) {
        ctx.fail(`state.incidents.${id} 在 ACTIVE facility_overlay 状态下必须持有剩余 overlay 次数`);
      }
      if (runtime.accessActive !== false) {
        ctx.fail(`state.incidents.${id} 在 facility_overlay 状态下 accessActive 必须为 false`);
      }
    } else if (def.effect.kind === 'access_override') {
      if (runtime.accessActive !== true) {
        ctx.fail(`state.incidents.${id} 在 ACTIVE access_override 状态下 accessActive 必须为 true`);
      }
      if (Number(overlayCharges) !== 0) {
        ctx.fail(`state.incidents.${id} 在 access_override 状态下 overlayCharges 必须为 0`);
      }
    }
  }
  if (status === 'RESOLVED') {
    if (typeof resolvedAt !== 'number' || resolvedAt > Number(ctx.state.time)) {
      ctx.fail(`state.incidents.${id} 在 RESOLVED 状态下必须携带合法 resolvedAt`);
    }
    if (typeof startedAt !== 'number') {
      ctx.fail(`state.incidents.${id} 在 RESOLVED 状态下必须保留 startedAt`);
    }
    if (Array.isArray(reward) && reward.length > 0) {
      ctx.fail(`state.incidents.${id} 在 RESOLVED 状态下不得保留可领取 reward`);
    }
    if (Number(overlayCharges) !== 0) {
      ctx.fail(`state.incidents.${id} 在 RESOLVED 状态下 overlayCharges 必须为 0`);
    }
    if (runtime.accessActive !== false) {
      ctx.fail(`state.incidents.${id} 在 RESOLVED 状态下 accessActive 必须为 false`);
    }
    if (rewardClaimedCount <= 0 && (def.effect.kind === 'reward_pool' || def.effect.kind === 'reward_with_hazard')) {
      ctx.fail(`state.incidents.${id} RESOLVED 奖励型事件必须至少领过一次`);
    }
  }
  if (status === 'EXPIRED') {
    if (typeof expiresAt !== 'number' || expiresAt > Number(ctx.state.time)) {
      ctx.fail(`state.incidents.${id} 在 EXPIRED 状态下 expiresAt 必须为不晚于当前时间的整数`);
    }
    if (Array.isArray(reward) && reward.length > 0) {
      ctx.fail(`state.incidents.${id} 在 EXPIRED 状态下不得保留可领取 reward`);
    }
    if (Number(overlayCharges) !== 0) {
      ctx.fail(`state.incidents.${id} 在 EXPIRED 状态下 overlayCharges 必须为 0`);
    }
    if (runtime.accessActive !== false) {
      ctx.fail(`state.incidents.${id} 在 EXPIRED 状态下 accessActive 必须为 false`);
    }
    if (typeof runtime.startedAt !== 'number') {
      ctx.fail(`state.incidents.${id} 在 EXPIRED 状态下必须保留 startedAt`);
    }
    if (resolvedAt !== null) {
      ctx.fail(`state.incidents.${id} 在 EXPIRED 状态下不应携带 resolvedAt`);
    }
  }
}

export function validateIncidentState(ctx: ValidationContext): void {
  const incidents = ctx.state.incidents;
  if (!isRecord(incidents)) {
    return; // structure layer already failed
  }
  for (const id of Object.keys(incidents)) {
    if (!INCIDENT_IDS.includes(id)) {
      ctx.fail(`state.incidents 包含未知 incident id: ${id}`);
    }
    const runtime = incidents[id];
    if (!isRecord(runtime)) {
      ctx.fail(`state.incidents.${id} 结构非法`);
      continue;
    }
    validateRuntime(ctx, id, runtime);
  }
}
