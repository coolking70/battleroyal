import { canSearchLandmark } from './landmarks';
import { nextZoneToward, resolveAccessStep } from './accessChains';
import type { Combatant, GameState } from './types';

type AccessDecision =
  | { kind: 'rest'; reason: string }
  | { kind: 'move'; zoneId: string; reason: string }
  | { kind: 'search_landmark'; landmarkId: string; reason: string }
  | { kind: 'interact_landmark'; landmarkId: string; interactionId: string; reason: string };

/** Resolve the next committed local-access action without consulting generic AI weights. */
export function decideNpcAccessAction(state: GameState, npc: Combatant): AccessDecision | null {
  const objective = npc.explorationObjective;
  if (!objective) return null;

  const step = resolveAccessStep(state, npc, objective.targetLandmarkId);
  if (!step.ok) return { kind: 'rest', reason: `局部访问前置暂不可用：${step.reason}` };
  if (step.zoneId === npc.currentZoneId) {
    if (step.action === 'interact' && step.interactionId) {
      return {
        kind: 'interact_landmark',
        landmarkId: step.nextLandmarkId,
        interactionId: step.interactionId,
        reason: step.reason,
      };
    }
    if (step.action === 'search' && canSearchLandmark(state, npc.id, step.nextLandmarkId).ok) {
      return { kind: 'search_landmark', landmarkId: step.nextLandmarkId, reason: step.reason };
    }
    return { kind: 'rest', reason: `等待${step.nextLandmarkId}的局部访问状态稳定` };
  }
  if (step.zoneId) {
    const nextZone = nextZoneToward(npc.currentZoneId, step.zoneId);
    if (nextZone && state.zones[nextZone]?.status !== 'restricted') {
      return { kind: 'move', zoneId: nextZone, reason: `沿局部访问链前往${step.zoneId}` };
    }
  }
  return { kind: 'rest', reason: `局部访问目标暂不可达：${step.reason}` };
}
