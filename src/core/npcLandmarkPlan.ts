import { currentWorldSourcesForActor } from './worldSources';
import { canSearchLandmark } from './landmarks';
import { tryGetLandmarkDef } from '../data/landmarks';
import { recipeForOutput } from '../data/recipes';
import { buildCraftPlan } from './craftPlan';
import type { Combatant, GameState, Recipe } from './types';

function rawInputsForItem(itemId: string, seen = new Set<string>()): Set<string> {
  const recipe = recipeForOutput(itemId);
  if (!recipe || seen.has(recipe.id)) return new Set([itemId]);
  const nextSeen = new Set(seen).add(recipe.id);
  const rawInputs = new Set<string>();
  for (const ingredient of recipe.ingredients) {
    for (const rawInput of rawInputsForItem(ingredient.itemId, nextSeen)) rawInputs.add(rawInput);
  }
  return rawInputs;
}

/** Selects a deterministic Landmark from the supplied raw gaps. */
function selectLandmarkForRecipe(
  state: GameState,
  npc: Combatant,
  recipe: Recipe,
  sourceDriven: boolean,
): string | null {
  const plan = buildCraftPlan(state, npc, recipe.id);
  const candidates: Array<{ id: string; score: number }> = [];
  const rawGaps = plan?.rawGaps.filter((entry) => entry.missing > 0) ?? [];
  const targetGapIds = sourceDriven
    ? new Set(plan?.nextStep?.missingDirect.flatMap((entry) => [...rawInputsForItem(entry.itemId)]) ?? [])
    : new Set<string>();
  const nextRawGaps = rawGaps.filter((gap) => targetGapIds.has(gap.itemId));
  const targetGaps = sourceDriven ? nextRawGaps : rawGaps;
  const targetHasWildSource = targetGaps.some((gap) => currentWorldSourcesForActor(state, npc, gap.itemId)
    .some((source) => source.kind === 'wild_drop'));
  if (sourceDriven && targetHasWildSource) return null;
  for (const gap of targetGaps) {
    const currentSources = currentWorldSourcesForActor(state, npc, gap.itemId);
    for (const source of currentSources) {
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

/** Selects only the NPC's own current raw gaps; no player goal or remote loot is read. */
export function recommendedLandmarkForRecipe(state: GameState, npc: Combatant, recipe: Recipe): string | null {
  return selectLandmarkForRecipe(state, npc, recipe, false);
}

/** Source-driven production selection: target the next raw gap and defer to live Wild sources. */
export function sourceDrivenLandmarkForRecipe(state: GameState, npc: Combatant, recipe: Recipe): string | null {
  return selectLandmarkForRecipe(state, npc, recipe, true);
}

export function refreshLandmarkRecommendation(state: GameState, npc: Combatant, recipe: Recipe | null): void {
  npc.planRecommendedLandmarkId = recipe ? recommendedLandmarkForRecipe(state, npc, recipe) : null;
  if (npc.planRecommendedLandmarkId) npc.planRecommendedZoneId = tryGetLandmarkDef(npc.planRecommendedLandmarkId)?.zoneId ?? npc.planRecommendedZoneId;
}
