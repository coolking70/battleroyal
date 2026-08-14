import { getItem } from '../data/items';
import { PHASE4P_RECIPES } from '../data/phase4pRecipes';
import { getWildEnemy } from '../data/wildEnemies';
import { getZoneDef, ZONE_IDS } from '../data/zones';
import { buildCraftPlan } from './craftPlan';
import { sourceDrivenLandmarkForRecipe } from './npcLandmarkPlan';
import { currentWorldSourcesForActor } from './worldSources';
import { syncNpcExplorationObjective } from './accessChains';
import type { Combatant, GameState, Recipe } from './types';

const PHASE4P_RECIPE_IDS = new Set(PHASE4P_RECIPES.map((recipe) => recipe.id));

/** Normal zone route, derived from the selected recipe's current raw sources. */
export function recommendedZoneForRecipe(
  state: GameState,
  npc: Combatant,
  recipe: Recipe,
): string | null {
  const missing = buildCraftPlan(state, npc, recipe.id)?.rawGaps.filter((gap) => gap.missing > 0) ?? [];
  if (missing.length === 0) return null;

  let best: { zoneId: string; score: number } | null = null;
  for (const zoneId of ZONE_IDS) {
    const zone = state.zones[zoneId];
    if (!zone || zone.status === 'restricted') continue;
    const def = getZoneDef(zoneId);
    let score = 0;
    for (const gap of missing) {
      const currentSources = currentWorldSourcesForActor(state, npc, gap.itemId);
      if (currentSources.some((source) => source.kind !== 'landmark_loot' && source.zoneIds.includes(zoneId))) score += 11;
      if (currentSources.some((source) => source.kind === 'wild_drop' && source.enemyIds.some((enemyId) =>
        getWildEnemy(enemyId).tier === 'apex' && state.apexSchedule.some((entry) =>
          entry.spawned && entry.defId === enemyId && entry.zoneId === zoneId,
        ),
      ))) score += 8;
    }
    if (score === 0) continue;
    if (zone.status === 'warning') score -= 4;
    if (zoneId === npc.currentZoneId) score += 6;
    else if (def.adjacent.includes(npc.currentZoneId)) score += 3;
    if (!best || score > best.score) best = { zoneId, score };
  }
  return best?.zoneId ?? null;
}

/** Commit the selected recipe's normal route and, when applicable, one source-driven Landmark route. */
export function applyNpcPlanRecommendations(
  state: GameState,
  npc: Combatant,
  recipe: Recipe | null,
  preferAccessChain = false,
): void {
  const recommendedZoneId = recipe ? recommendedZoneForRecipe(state, npc, recipe) : null;
  npc.planRecommendedZoneId = recommendedZoneId;
  npc.planRecommendedLandmarkId = null;
  if (!recipe || PHASE4P_RECIPE_IDS.has(recipe.id) || getItem(recipe.outputItemId).category === 'objective') {
    syncNpcExplorationObjective(state, npc, null);
    return;
  }

  const landmarkId = sourceDrivenLandmarkForRecipe(state, npc, recipe, preferAccessChain);
  if (!landmarkId) {
    syncNpcExplorationObjective(state, npc, null);
    return;
  }
  const objective = syncNpcExplorationObjective(state, npc, landmarkId);
  npc.planRecommendedLandmarkId = objective?.nextLandmarkId ?? landmarkId;
  npc.planRecommendedZoneId = state.landmarks[npc.planRecommendedLandmarkId]?.zoneId
    ?? state.landmarks[landmarkId]?.zoneId
    ?? recommendedZoneId;
}
