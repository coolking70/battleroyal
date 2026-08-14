import { tryGetLandmarkDef } from '../data/landmarks';
import { PHASE4P_RECIPES } from '../data/phase4pRecipes';
import { tryGetRecipe } from '../data/recipes';
import { getItem } from '../data/items';
import { buildCraftPlan } from './craftPlan';
import { worldSourcesForItem } from './worldSources';
import type { Combatant, ExplorationObjective, GameState } from './types';

/** The objective may only point at a static gated landmark on the committed recipe route. */
export function objectiveBelongsToRecipe(
  state: GameState,
  actor: Combatant,
  objective: ExplorationObjective,
  recipeId: string,
): boolean {
  const target = tryGetLandmarkDef(objective.targetLandmarkId);
  const recipe = tryGetRecipe(recipeId);
  if (!target || !recipe || (!target.access && !target.interaction?.requiresRepair
    && !target.interaction?.requiresUnlock && !target.interaction?.requiredLandmarkId)) return false;
  const plan = buildCraftPlan(state, actor, recipeId);
  if (!plan) return false;
  return plan.rawGaps.some((gap) => gap.missing > 0
    && worldSourcesForItem(gap.itemId).some((source) =>
      source.kind === 'landmark_loot' && source.landmarkIds.includes(objective.targetLandmarkId)));
}

/** Preserve an ordinary maintenance refresh, but never restore a replaced formal goal. */
export function preserveExplorationObjectiveAfterPlan(
  state: GameState,
  actor: Combatant,
  previousRecipeId: string | null,
  previousObjective: ExplorationObjective | null,
): void {
  if (!previousObjective) return;
  if (!previousRecipeId) {
    const recipe = actor.plannedRecipeId ? tryGetRecipe(actor.plannedRecipeId) : null;
    const protectedGoal = Boolean(recipe && (PHASE4P_RECIPES.some((candidate) => candidate.id === recipe.id)
      || getItem(recipe.outputItemId).category === 'objective'));
    if (!protectedGoal) {
      actor.explorationObjective = previousObjective;
      actor.planRecommendedLandmarkId = previousObjective.nextLandmarkId;
    }
    return;
  }
  if (actor.plannedRecipeId !== previousRecipeId) return;
  if (!objectiveBelongsToRecipe(state, actor, previousObjective, previousRecipeId)) return;
  actor.explorationObjective = previousObjective;
  actor.planRecommendedLandmarkId = previousObjective.nextLandmarkId;
}
