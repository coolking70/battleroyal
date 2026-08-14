import { tryGetItem } from '../../data/items';
import { tryGetLandmarkDef } from '../../data/landmarks';

function knownItem(itemId: unknown): boolean {
  return typeof itemId === 'string' && Boolean(tryGetItem(itemId));
}

export function validateExplorationObjective(
  id: string,
  character: Record<string, unknown>,
  stateTime: unknown,
  fail: (message: string) => void,
): void {
  if (!Object.prototype.hasOwnProperty.call(character, 'explorationObjective')) {
    fail(`角色 ${id} 缺少当前版本 explorationObjective 字段`);
    return;
  }
  const objective = character.explorationObjective;
  if (objective === null || objective === undefined) return;
  if (typeof objective !== 'object' || Array.isArray(objective)) {
    fail(`角色 ${id} 的 explorationObjective 必须是对象或 null`);
    return;
  }
  const value = objective as Record<string, unknown>;
  for (const field of ['targetLandmarkId', 'nextLandmarkId'] as const) {
    if (typeof value[field] !== 'string' || !tryGetLandmarkDef(value[field])) {
      fail(`角色 ${id} 的 explorationObjective.${field} 引用了未知地标`);
    }
  }
  if (value.phase !== 'obtain_item' && value.phase !== 'complete_prerequisite' && value.phase !== 'reach_target') {
    fail(`角色 ${id} 的 explorationObjective.phase 非法`);
  }
  const requiredItemId = value.requiredItemId;
  if (requiredItemId !== null && requiredItemId !== undefined && !knownItem(requiredItemId)) {
    fail(`角色 ${id} 的 explorationObjective.requiredItemId 未知`);
  }
  const prerequisiteLandmarkId = value.prerequisiteLandmarkId;
  if (prerequisiteLandmarkId !== null && prerequisiteLandmarkId !== undefined
    && (typeof prerequisiteLandmarkId !== 'string' || !tryGetLandmarkDef(prerequisiteLandmarkId))) {
    fail(`角色 ${id} 的 explorationObjective.prerequisiteLandmarkId 未知`);
  }
  if (typeof value.reason !== 'string' || value.reason.length === 0) fail(`角色 ${id} 的 explorationObjective.reason 非法`);
  const committedAt = value.committedAt;
  if (typeof committedAt !== 'number' || !Number.isFinite(committedAt) || !Number.isInteger(committedAt)
    || committedAt < 0 || typeof stateTime !== 'number' || committedAt > stateTime) {
    fail(`角色 ${id} 的 explorationObjective.committedAt 非法`);
  }
}
