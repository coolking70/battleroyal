import { currentWorldSourcesForItem } from './worldSources';
import { canSearchLandmark, landmarkState } from './landmarks';
import { buildCraftPlan } from './craftPlan';
import type { Combatant, GameState, Recipe } from './types';

/** Selects only the NPC's own current raw gaps; no player goal or remote loot is read. */
export function recommendedLandmarkForRecipe(state: GameState, npc: Combatant, recipe: Recipe): string | null {
  const plan = buildCraftPlan(state, npc, recipe.id);
  const candidates: Array<{ id: string; score: number }> = [];
  for (const gap of plan?.rawGaps.filter((entry) => entry.missing > 0) ?? []) {
    for (const source of currentWorldSourcesForItem(state, gap.itemId)) {
      if (source.kind !== 'landmark_loot') continue;
      for (const landmarkId of source.landmarkIds) {
        const runtime = landmarkState(state, landmarkId);
        if (!runtime || !canSearchLandmark(state, npc.id, landmarkId).ok) continue;
        candidates.push({ id: landmarkId, score: gap.missing * 10 + (runtime.zoneId === npc.currentZoneId ? 8 : 0) });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return candidates[0]?.id ?? null;
}

export function refreshLandmarkRecommendation(state: GameState, npc: Combatant, recipe: Recipe | null): void {
  npc.planRecommendedLandmarkId = recipe ? recommendedLandmarkForRecipe(state, npc, recipe) : null;
  if (npc.planRecommendedLandmarkId) npc.planRecommendedZoneId = state.landmarks[npc.planRecommendedLandmarkId]?.zoneId ?? npc.planRecommendedZoneId;
}
