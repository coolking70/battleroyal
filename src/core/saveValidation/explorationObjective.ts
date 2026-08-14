import { tryGetItem } from '../../data/items';
import { LANDMARKS, tryGetLandmarkDef } from '../../data/landmarks';

interface ObjectiveGraph {
  landmarks: Set<string>;
  prerequisites: Set<string>;
  items: Set<string>;
  sourcesByItem: Map<string, Set<string>>;
}

function knownItem(itemId: unknown): boolean {
  return typeof itemId === 'string' && Boolean(tryGetItem(itemId));
}

function staticObjectiveGraph(targetId: string): ObjectiveGraph {
  const graph: ObjectiveGraph = {
    landmarks: new Set(),
    prerequisites: new Set(),
    items: new Set(),
    sourcesByItem: new Map(),
  };
  const visiting = new Set<string>();
  const addItem = (itemId: string): void => {
    graph.items.add(itemId);
    const sources = LANDMARKS.filter((landmark) => landmark.initialLoot.some((entry) => entry.itemId === itemId));
    graph.sourcesByItem.set(itemId, new Set(sources.map((source) => source.id)));
  };
  const visit = (landmarkId: string): void => {
    if (visiting.has(landmarkId)) return;
    const def = tryGetLandmarkDef(landmarkId);
    if (!def) return;
    graph.landmarks.add(landmarkId);
    visiting.add(landmarkId);
    for (const requirement of def.access?.prerequisites ?? []) {
      if (requirement.kind === 'item') addItem(requirement.itemId);
      else {
        graph.prerequisites.add(requirement.landmarkId);
        visit(requirement.landmarkId);
      }
    }
    const interaction = def.interaction;
    if (interaction?.requiredItemId) addItem(interaction.requiredItemId);
    if (interaction?.requiredLandmarkId) {
      graph.prerequisites.add(interaction.requiredLandmarkId);
      visit(interaction.requiredLandmarkId);
    }
    visiting.delete(landmarkId);
  };
  visit(targetId);
  return graph;
}

function failSemanticObjective(id: string, message: string, fail: (message: string) => void): void {
  fail(`角色 ${id} 的 explorationObjective${message}`);
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
  if (requiredItemId !== null && !knownItem(requiredItemId)) {
    fail(`角色 ${id} 的 explorationObjective.requiredItemId 未知`);
  }
  const prerequisiteLandmarkId = value.prerequisiteLandmarkId;
  if (prerequisiteLandmarkId !== null
    && (typeof prerequisiteLandmarkId !== 'string' || !tryGetLandmarkDef(prerequisiteLandmarkId))) {
    fail(`角色 ${id} 的 explorationObjective.prerequisiteLandmarkId 未知`);
  }
  if (typeof value.reason !== 'string' || value.reason.length === 0) fail(`角色 ${id} 的 explorationObjective.reason 非法`);
  const committedAt = value.committedAt;
  if (typeof committedAt !== 'number' || !Number.isFinite(committedAt) || !Number.isInteger(committedAt)
    || committedAt < 0 || typeof stateTime !== 'number' || committedAt > stateTime) {
    fail(`角色 ${id} 的 explorationObjective.committedAt 非法`);
  }

  const targetId = value.targetLandmarkId;
  const nextId = value.nextLandmarkId;
  if (typeof targetId !== 'string' || !tryGetLandmarkDef(targetId)
    || typeof nextId !== 'string' || !tryGetLandmarkDef(nextId)) return;
  const target = tryGetLandmarkDef(targetId)!;
  if (!target.access && !target.interaction?.requiresRepair && !target.interaction?.requiresUnlock
    && !target.interaction?.requiredLandmarkId) {
    failSemanticObjective(id, ' 的 targetLandmarkId 没有公开访问语义', fail);
    return;
  }
  const graph = staticObjectiveGraph(targetId);
  const allowedNext = new Set([...graph.landmarks, ...[...graph.sourcesByItem.values()].flatMap((ids) => [...ids])]);
  if (!allowedNext.has(nextId)) failSemanticObjective(id, '.nextLandmarkId 与目标访问链无关', fail);
  if (requiredItemId !== null) {
    if (typeof requiredItemId !== 'string' || !graph.items.has(requiredItemId)) {
      failSemanticObjective(id, '.requiredItemId 不是目标访问链所需物品', fail);
    } else if (value.phase === 'obtain_item'
      && !graph.sourcesByItem.get(requiredItemId)?.has(nextId)) {
      failSemanticObjective(id, '.nextLandmarkId 不是该物品的静态公开来源', fail);
    }
  }
  if (prerequisiteLandmarkId !== null
    && (typeof prerequisiteLandmarkId !== 'string' || !graph.prerequisites.has(prerequisiteLandmarkId))) {
    failSemanticObjective(id, '.prerequisiteLandmarkId 不属于目标访问链', fail);
  }
  if (value.phase === 'obtain_item' && (typeof requiredItemId !== 'string' || requiredItemId === '')) {
    failSemanticObjective(id, '.phase=obtain_item 必须绑定 requiredItemId', fail);
  }
  if (value.phase === 'complete_prerequisite'
    && (typeof prerequisiteLandmarkId !== 'string' || !graph.prerequisites.has(prerequisiteLandmarkId))) {
    failSemanticObjective(id, '.phase=complete_prerequisite 必须绑定 landmark_state 前置', fail);
  }
  if (value.phase === 'reach_target' && (requiredItemId !== null || prerequisiteLandmarkId !== null)) {
    failSemanticObjective(id, '.phase=reach_target 不应携带未完成前置', fail);
  }
}
