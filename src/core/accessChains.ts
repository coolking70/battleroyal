import { getItem } from '../data/items';
import { LANDMARKS, tryGetLandmarkDef } from '../data/landmarks';
import { getZoneDef } from '../data/zones';
import { countItem } from './inventory';
import { currentWorldSourcesForActor } from './worldSources';
import type {
  AccessRequirement,
  Combatant,
  ExplorationObjective,
  ExplorationObjectivePhase,
  GameState,
  LandmarkDef,
} from './types';
import { pushEvent } from './events';

export type AccessStepAction = 'search' | 'interact';

export interface AccessStep {
  ok: boolean;
  nextLandmarkId: string;
  action: AccessStepAction | null;
  interactionId: string | null;
  targetLandmarkId: string;
  phase: ExplorationObjectivePhase;
  requiredItemId: string | null;
  prerequisiteLandmarkId: string | null;
  zoneId: string | null;
  reason: string;
}

interface WalkContext {
  pendingItemId: string | null;
  prerequisiteLandmarkId: string | null;
  requiredState: 'discovered' | 'repaired' | 'activated' | null;
}

function stateRequirementSatisfied(state: GameState, requirement: AccessRequirement): boolean {
  if (requirement.kind === 'item') return false;
  const runtime = state.landmarks[requirement.landmarkId];
  if (!runtime) return false;
  return requirement.state === 'discovered'
    ? runtime.discovered
    : requirement.state === 'repaired'
      ? runtime.repaired
      : runtime.activated;
}

export function accessRequirementSatisfied(
  state: GameState,
  actor: Combatant,
  requirement: AccessRequirement,
): boolean {
  if (requirement.kind === 'item') {
    return countItem(actor, requirement.itemId) >= (requirement.count ?? 1);
  }
  return stateRequirementSatisfied(state, requirement);
}

function interactionRequirements(def: LandmarkDef): AccessRequirement[] {
  const interaction = def.interaction;
  const requirements: AccessRequirement[] = [...(def.access?.prerequisites ?? [])];
  if (!interaction) return requirements;
  if (interaction.requiredItemId) {
    requirements.push({
      kind: 'item',
      itemId: interaction.requiredItemId,
      count: interaction.requiredItemCount ?? 1,
      consume: interaction.requiredItemConsumes !== false,
    });
  }
  if (interaction.requiredLandmarkId) {
    requirements.push({ kind: 'landmark_state', landmarkId: interaction.requiredLandmarkId, state: 'repaired' });
  }
  return requirements;
}

export function missingAccessRequirements(
  state: GameState,
  actor: Combatant,
  def: LandmarkDef,
): AccessRequirement[] {
  return interactionRequirements(def).filter((requirement) => {
    if (requirement.kind === 'landmark_state' && def.interaction?.requiredLandmarkId === requirement.landmarkId) {
      const prerequisiteDef = tryGetLandmarkDef(requirement.landmarkId);
      if (prerequisiteDef && prerequisiteDef.zoneId !== actor.currentZoneId) return true;
      const runtime = state.landmarks[requirement.landmarkId];
      return !(runtime?.repaired || runtime?.activated);
    }
    if (requirement.kind === 'landmark_state') {
      const prerequisite = tryGetLandmarkDef(requirement.landmarkId);
      // Remote runtime is not probed; the public relation stays known and is
      // confirmed only after the actor reaches that local prerequisite.
      if (prerequisite && prerequisite.zoneId !== actor.currentZoneId) return true;
    }
    return !accessRequirementSatisfied(state, actor, requirement);
  });
}

export function accessRequirementReason(
  state: GameState,
  actor: Combatant,
  def: LandmarkDef,
): string | null {
  const missing = missingAccessRequirements(state, actor, def)[0];
  if (!missing) return null;
  if (missing.kind === 'item') return `缺少${getItem(missing.itemId).name}。`;
  const prerequisite = tryGetLandmarkDef(missing.landmarkId);
  return `需要先完成${prerequisite?.name ?? missing.landmarkId}的${missing.state}前置。`;
}

function distance(from: string, to: string): number {
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  let depth = 0;
  while (frontier.length > 0) {
    depth += 1;
    const next: string[] = [];
    for (const zoneId of frontier) {
      for (const adjacent of getZoneDef(zoneId).adjacent) {
        if (seen.has(adjacent)) continue;
        if (adjacent === to) return depth;
        seen.add(adjacent);
        next.push(adjacent);
      }
    }
    frontier = next;
  }
  return Number.POSITIVE_INFINITY;
}

function itemSourceCandidates(state: GameState, actor: Combatant, itemId: string, excludeId: string): string[] {
  const source = currentWorldSourcesForActor(state, actor, itemId).find((candidate) => candidate.kind === 'landmark_loot');
  if (!source || source.kind !== 'landmark_loot') return [];
  return source.landmarkIds
    .filter((id) => id !== excludeId && Boolean(tryGetLandmarkDef(id)))
    .sort((a, b) => {
      const aDef = tryGetLandmarkDef(a)!;
      const bDef = tryGetLandmarkDef(b)!;
      return distance(actor.currentZoneId, aDef.zoneId) - distance(actor.currentZoneId, bDef.zoneId) || a.localeCompare(b);
    });
}

function blockedStep(targetLandmarkId: string, reason: string): AccessStep {
  return {
    ok: false,
    nextLandmarkId: targetLandmarkId,
    action: null,
    interactionId: null,
    targetLandmarkId,
    phase: 'reach_target',
    requiredItemId: null,
    prerequisiteLandmarkId: null,
    zoneId: null,
    reason,
  };
}

function walkAccessStep(
  state: GameState,
  actor: Combatant,
  landmarkId: string,
  targetLandmarkId: string,
  context: WalkContext,
  visited: Set<string>,
): AccessStep {
  const def = tryGetLandmarkDef(landmarkId);
  const runtime = state.landmarks[landmarkId];
  if (!def || !runtime) return blockedStep(targetLandmarkId, '访问链引用了不存在的地标。');
  if (visited.has(landmarkId)) return blockedStep(targetLandmarkId, '访问链存在循环依赖。');
  if (runtime.exhausted && landmarkId === targetLandmarkId && def.zoneId === actor.currentZoneId) {
    return blockedStep(targetLandmarkId, `${def.name}的有限资源已经耗尽。`);
  }
  if (runtime.exhausted && landmarkId !== targetLandmarkId && def.zoneId === actor.currentZoneId) {
    return blockedStep(targetLandmarkId, `${def.name}的公开前置来源已经耗尽。`);
  }

  const nextVisited = new Set(visited).add(landmarkId);
  const missing = missingAccessRequirements(state, actor, def);
  const requirement = missing[0];
  if (requirement?.kind === 'landmark_state') {
    return walkAccessStep(
      state,
      actor,
      requirement.landmarkId,
      targetLandmarkId,
      { ...context, prerequisiteLandmarkId: requirement.landmarkId, requiredState: requirement.state },
      nextVisited,
    );
  }
  if (requirement?.kind === 'item') {
    const sources = itemSourceCandidates(state, actor, requirement.itemId, landmarkId);
    for (const sourceId of sources) {
      const sourceStep = walkAccessStep(
        state,
        actor,
        sourceId,
        targetLandmarkId,
        { ...context, pendingItemId: requirement.itemId },
        nextVisited,
      );
      if (sourceStep.ok) return sourceStep;
    }
    return blockedStep(targetLandmarkId, `缺少${getItem(requirement.itemId).name}，且没有可用的公开地标来源。`);
  }

  const mustCompleteState = context.requiredState !== null
    && (def.zoneId !== actor.currentZoneId
      || !stateRequirementSatisfied(state, { kind: 'landmark_state', landmarkId, state: context.requiredState }));
  if (mustCompleteState && context.requiredState === 'discovered'
    && !runtime.locked && !runtime.disabled && def.searchable) {
    return {
      ok: true,
      nextLandmarkId: landmarkId,
      action: 'search',
      interactionId: null,
      targetLandmarkId,
      phase: 'complete_prerequisite',
      requiredItemId: context.pendingItemId,
      prerequisiteLandmarkId: context.prerequisiteLandmarkId,
      zoneId: def.zoneId,
      reason: `先搜索${def.name}，完成局部访问前置。`,
    };
  }
  if (runtime.locked || runtime.disabled || mustCompleteState) {
    const interaction = def.interaction;
    const canResolve = Boolean(interaction && (mustCompleteState ||
      (runtime.locked && interaction.requiresUnlock) ||
      (runtime.disabled && interaction.requiresRepair)
    ));
    if (!canResolve) return blockedStep(targetLandmarkId, def.access?.hint ?? `${def.name}仍不可访问。`);
    return {
      ok: true,
      nextLandmarkId: landmarkId,
      action: 'interact',
      interactionId: interaction!.id,
      targetLandmarkId,
      phase: context.pendingItemId ? 'obtain_item' : context.prerequisiteLandmarkId ? 'complete_prerequisite' : 'reach_target',
      requiredItemId: context.pendingItemId,
      prerequisiteLandmarkId: context.prerequisiteLandmarkId,
      zoneId: def.zoneId,
      reason: runtime.disabled ? `修复${def.name}以继续访问链。` : `使用${def.name}以完成局部解锁。`,
    };
  }

  if (!def.searchable) return blockedStep(targetLandmarkId, `${def.name}没有可执行的访问动作。`);
  return {
    ok: true,
    nextLandmarkId: landmarkId,
    action: 'search',
    interactionId: null,
    targetLandmarkId,
    phase: context.pendingItemId ? 'obtain_item' : context.prerequisiteLandmarkId ? 'complete_prerequisite' : 'reach_target',
    requiredItemId: context.pendingItemId,
    prerequisiteLandmarkId: context.prerequisiteLandmarkId,
    zoneId: def.zoneId,
    reason: landmarkId === targetLandmarkId ? `继续搜索${def.name}。` : `先搜索${def.name}，完成局部访问前置。`,
  };
}

/** Resolve one deterministic legal step without reading remote runtime state. */
export function resolveAccessStep(state: GameState, actor: Combatant, targetLandmarkId: string): AccessStep {
  return walkAccessStep(state, actor, targetLandmarkId, targetLandmarkId, {
    pendingItemId: null,
    prerequisiteLandmarkId: null,
    requiredState: null,
  }, new Set());
}

export function nextZoneToward(from: string, to: string): string | null {
  if (from === to) return null;
  const seen = new Set([from]);
  const queue: Array<{ zoneId: string; first: string }> = [];
  for (const adjacent of getZoneDef(from).adjacent.slice().sort()) queue.push({ zoneId: adjacent, first: adjacent });
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.zoneId === to) return current.first;
    if (seen.has(current.zoneId)) continue;
    seen.add(current.zoneId);
    for (const adjacent of getZoneDef(current.zoneId).adjacent.slice().sort()) {
      if (!seen.has(adjacent)) queue.push({ zoneId: adjacent, first: current.first });
    }
  }
  return null;
}

export function syncNpcExplorationObjective(
  state: GameState,
  actor: Combatant,
  targetLandmarkId: string | null,
): ExplorationObjective | null {
  if (!targetLandmarkId) {
    actor.explorationObjective = null;
    return null;
  }
  const targetDef = tryGetLandmarkDef(targetLandmarkId);
  const gated = Boolean(targetDef?.access || (targetDef?.interaction && (
    targetDef.interaction.requiresRepair || targetDef.interaction.requiresUnlock || targetDef.interaction.requiredLandmarkId
  )));
  if (!gated) {
    actor.explorationObjective = null;
    return null;
  }
  const step = resolveAccessStep(state, actor, targetLandmarkId);
  // Once an NPC has committed to a chain, a temporarily unavailable remote
  // route must remain a persisted objective. Replacing it with a fresh search
  // every turn would leak hidden remote state into planning and cause churn.
  const previous = actor.explorationObjective;
  if (!step.ok && previous?.targetLandmarkId === targetLandmarkId) return previous;
  const next = step.ok ? step.nextLandmarkId : targetLandmarkId;
  if (previous && previous.targetLandmarkId === targetLandmarkId && previous.nextLandmarkId === next
    && previous.phase === step.phase && previous.requiredItemId === step.requiredItemId
    && previous.prerequisiteLandmarkId === step.prerequisiteLandmarkId) return previous;
  const objective: ExplorationObjective = {
    targetLandmarkId,
    nextLandmarkId: next,
    phase: step.phase,
    requiredItemId: step.requiredItemId,
    prerequisiteLandmarkId: step.prerequisiteLandmarkId,
    reason: step.reason,
    committedAt: previous?.targetLandmarkId === targetLandmarkId ? previous.committedAt : state.time,
  };
  actor.explorationObjective = objective;
  return objective;
}

/** A completed landmark-state prerequisite emits one deterministic local event. */
export function applyAccessTransitions(state: GameState, actorId: string | null, triggerLandmarkId: string): void {
  if (state.status !== 'playing') return;
  const trigger = state.landmarks[triggerLandmarkId];
  if (!trigger) return;
  for (const def of LANDMARKS) {
    const access = def.access;
    const runtime = state.landmarks[def.id];
    if (!access || !runtime || !runtime.locked) continue;
    const relationOnly = access.prerequisites.every((requirement) => requirement.kind === 'landmark_state');
    if (!relationOnly) continue;
    const satisfied = access.prerequisites.every((requirement) => stateRequirementSatisfied(state, requirement));
    if (!satisfied) continue;
    runtime.locked = false;
    pushEvent(state, {
      type: 'LANDMARK_UNLOCKED',
      actorId,
      zoneId: def.zoneId,
      message: `${def.name}的局部通路已开放。`,
      metadata: { landmarkId: def.id, triggerLandmarkId },
    });
  }
}

export function publicAccessHint(def: LandmarkDef): string | null {
  if (def.access?.hint) return def.access.hint;
  const interaction = def.interaction;
  if (interaction?.requiredItemId && (interaction.requiresRepair || interaction.requiresUnlock)) {
    return `需要${getItem(interaction.requiredItemId).name}才能完成前置操作。`;
  }
  return null;
}
