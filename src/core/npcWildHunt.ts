import { getWildEnemy } from '../data/wildEnemies';
import { canPayActionCost } from './actionCosts';
import { isZoneExhausted } from './zoneLoot';
import { buildCraftPlan, type CraftPlan } from './craftPlan';
import { currentWorldSourcesForItem } from './worldSources';
import type { Combatant, GameState } from './types';

/** 常规行动中的搜索权重，和 NPC 决策层共用同一份人格基线。 */
export const NPC_IDLE_WEIGHTS: Record<Combatant['personality'], { search: number; move: number; rest: number }> = {
  aggressive: { search: 40, move: 55, rest: 5 },
  cautious: { search: 55, move: 30, rest: 15 },
  collector: { search: 70, move: 18, rest: 2 },
  opportunist: { search: 45, move: 50, rest: 5 },
  random: { search: 35, move: 40, rest: 25 },
};

/** 已规划 NPC 是否在当前区域拥有一个当前公开 Wild/Apex 来源。 */
export function hasPlannedWildSourceHere(
  state: GameState,
  npc: Combatant,
  plan: CraftPlan | null,
): boolean {
  if (!npc.plannedRecipeId || !plan) return false;
  return plan.rawGaps.some((gap) => gap.missing > 0 && currentWorldSourcesForItem(state, gap.itemId).some((source) =>
    source.kind === 'wild_drop' && source.zoneIds.includes(npc.currentZoneId),
  ));
}

/** 当前 NPC 是否应继续走向其计划所需的公开 Apex 区域。 */
export function hasRecommendedApexSource(
  state: GameState,
  plan: CraftPlan | null,
  currentZoneId: string,
  recommendedZoneId: string | null,
): boolean {
  if (!recommendedZoneId || recommendedZoneId === currentZoneId || !plan) return false;
  return plan.rawGaps.some((gap) => gap.missing > 0 && currentWorldSourcesForItem(state, gap.itemId).some((source) =>
    source.kind === 'wild_drop' &&
    source.zoneIds.includes(recommendedZoneId) &&
    source.enemyIds.some((enemyId) => getWildEnemy(enemyId).tier === 'apex'),
  ));
}

/** Pure SEARCH weight projection shared by the decision path and acceptance tests. */
export function npcSearchWeight(
  state: GameState,
  npc: Combatant,
  plan: CraftPlan | null = npc.plannedRecipeId
    ? buildCraftPlan(state, npc, npc.plannedRecipeId)
    : null,
): number {
  const zone = state.zones[npc.currentZoneId];
  const canSearchNow = canPayActionCost(npc, 'SEARCH').ok;
  const zoneEmpty = zone ? isZoneExhausted(zone) : false;
  if (!canSearchNow || (zoneEmpty && !hasPlannedWildSourceHere(state, npc, plan))) return 0;
  let weight = NPC_IDLE_WEIGHTS[npc.personality].search * (0.35 + (zone?.supply ?? 1));
  if (npc.planRecommendedZoneId === npc.currentZoneId && state.zones[npc.currentZoneId]?.status !== 'restricted') {
    weight *= 1.8;
  }
  return weight;
}
