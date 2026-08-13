import { currentWorldSourcesForActor } from './worldSources';
import { canSearchLandmark } from './landmarks';
import { tryGetLandmarkDef } from '../data/landmarks';
import { buildCraftPlan } from './craftPlan';
import type { Combatant, GameState, Recipe } from './types';

/** Selects only the NPC's own current raw gaps; no player goal or remote loot is read. */
export function recommendedLandmarkForRecipe(state: GameState, npc: Combatant, recipe: Recipe): string | null {
  const plan = buildCraftPlan(state, npc, recipe.id);
  const candidates: Array<{ id: string; score: number }> = [];
  for (const gap of plan?.rawGaps.filter((entry) => entry.missing > 0) ?? []) {
    for (const source of currentWorldSourcesForActor(state, npc, gap.itemId)) {
      if (source.kind !== 'landmark_loot') continue;
      for (const landmarkId of source.landmarkIds) {
        const def = tryGetLandmarkDef(landmarkId);
        if (!def) continue;
        // Only local runtime is actor-visible. Remote candidates are public
        // potential sources and are not probed with canSearchLandmark.
        if (def.zoneId === npc.currentZoneId && !canSearchLandmark(state, npc.id, landmarkId).ok) continue;
        candidates.push({ id: landmarkId, score: gap.missing * 10 + (def.zoneId === npc.currentZoneId ? 8 : 0) });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return candidates[0]?.id ?? null;
}

export function refreshLandmarkRecommendation(state: GameState, npc: Combatant, recipe: Recipe | null): void {
  npc.planRecommendedLandmarkId = recipe ? recommendedLandmarkForRecipe(state, npc, recipe) : null;
  if (npc.planRecommendedLandmarkId) npc.planRecommendedZoneId = tryGetLandmarkDef(npc.planRecommendedLandmarkId)?.zoneId ?? npc.planRecommendedZoneId;
}
