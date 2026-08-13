import { getItem } from '../data/items';
import { RECIPES, getRecipeDepth, recipeForOutput, tryGetRecipe } from '../data/recipes';
import { getZoneDef } from '../data/zones';
import { canPayActionCost } from './actionCosts';
import { hasRoomForOutput } from './crafting';
import type { Combatant, GameState, RecipeIngredient } from './types';
import { worldSourcesForItem, type WorldSource } from './worldSources';

export type CraftPlanStepStatus = 'complete' | 'craftable' | 'blocked';

export interface CraftPlanStep {
  recipeId: string;
  outputItemId: string;
  name: string;
  depth: number;
  /** 当前目标路线需要的输出数量；shared dependency 会在这里累加。 */
  required: number;
  /** 从当前背包/目标装备中实际分配给这条路线的数量。 */
  owned: number;
  missing: number;
  /** 为满足 missing，至少还要执行多少次该配方。 */
  batchesRequired: number;
  directIngredients: RecipeIngredient[];
  missingDirect: RecipeIngredient[];
  status: CraftPlanStepStatus;
}

export interface CraftPlanRawGap {
  itemId: string;
  required: number;
  held: number;
  missing: number;
  sourceZoneIds: string[];
  sourceEnemyIds: string[];
  worldSources: WorldSource[];
}

export interface CraftPlan {
  targetRecipeId: string;
  targetItemId: string;
  targetName: string;
  depth: number;
  steps: CraftPlanStep[];
  targetStep: CraftPlanStep;
  /** 所有 raw leaf 是否已经在当前可用物品中；不代表最终配方可直接执行。 */
  rawReady: boolean;
  /** 目标配方本身当前是否是合法 CRAFT。 */
  finalCraftable: boolean;
  rawGaps: CraftPlanRawGap[];
  /** First incomplete route step, even when its raw inputs still need to be found. */
  nextStep: CraftPlanStep | null;
  suggestedNextCraft: CraftPlanStep | null;
  suggestedMoveZoneId: string | null;
}

const RECIPE_BY_OUTPUT = new Map(RECIPES.map((recipe) => [recipe.outputItemId, recipe]));

function zoneDistance(from: string, to: string): number {
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  let depth = 0;
  while (frontier.length > 0) {
    depth += 1;
    const next: string[] = [];
    for (const id of frontier) {
      for (const adjacent of getZoneDef(id).adjacent) {
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

function ownedInventory(actor: Combatant): Map<string, number> {
  const map = new Map<string, number>();
  for (const stack of actor.inventory) map.set(stack.itemId, (map.get(stack.itemId) ?? 0) + stack.count);
  return map;
}

function addOwnedEquipmentForTarget(
  available: Map<string, number>,
  actor: Combatant,
  targetItemId: string,
): void {
  // Equipped gear can satisfy the final goal, but is never made available to
  // dependency ingredients. This keeps planning honest without asking a
  // player to craft a second copy of an already equipped target.
  const equipped = actor.equipment
    .filter((stack) => stack.itemId === targetItemId)
    .reduce((sum, stack) => sum + stack.count, 0);
  if (equipped > 0) available.set(targetItemId, (available.get(targetItemId) ?? 0) + equipped);
}

function takeAvailable(available: Map<string, number>, itemId: string, requested: number): number {
  const held = Math.min(requested, available.get(itemId) ?? 0);
  if (held > 0) available.set(itemId, (available.get(itemId) ?? 0) - held);
  return held;
}

/**
 * Pure deterministic dependency planner. It consumes only the actor's inventory
 * view while planning; equipped items are intentionally not treated as craft
 * ingredients, so planning cannot silently consume gear.
 */
export function buildCraftPlan(
  state: GameState,
  actor: Combatant,
  targetRecipeId: string,
): CraftPlan | null {
  const target = tryGetRecipe(targetRecipeId);
  if (!target) return null;
  const available = ownedInventory(actor);
  addOwnedEquipmentForTarget(available, actor, target.outputItemId);
  const raw = new Map<string, CraftPlanRawGap>();
  const structuralRequirements = new Map<string, number>();
  const demands = new Map<string, {
    recipe: typeof target;
    required: number;
    owned: number;
    missing: number;
    batchesRequired: number;
  }>();

  const recordDemand = (
    recipe: typeof target,
    requested: number,
    held: number,
    missing: number,
  ): void => {
    const previous = demands.get(recipe.id);
    const batchesRequired = Math.ceil(missing / recipe.outputCount);
    demands.set(recipe.id, {
      recipe,
      required: (previous?.required ?? 0) + requested,
      owned: (previous?.owned ?? 0) + held,
      missing: (previous?.missing ?? 0) + missing,
      batchesRequired: (previous?.batchesRequired ?? 0) + batchesRequired,
    });
  };

  const addRawGap = (itemId: string, requested: number, held: number): void => {
    const missing = requested - held;
    if (missing <= 0) return;
    const worldSources = worldSourcesForItem(itemId, state);
    const existing = raw.get(itemId) ?? {
      itemId,
      required: 0,
      held: 0,
      missing: 0,
      sourceZoneIds: worldSources.flatMap((source) => source.zoneIds).filter((id, index, all) => all.indexOf(id) === index),
      sourceEnemyIds: worldSources.flatMap((source) => source.kind === 'wild_drop' ? source.enemyIds : []).filter((id, index, all) => all.indexOf(id) === index),
      worldSources,
    };
    existing.required += requested;
    existing.held += held;
    existing.missing += missing;
    raw.set(itemId, existing);
  };

  // Count the static route requirement independently from current inventory.
  // A held intermediate may suppress its raw expansion, but it must not erase
  // a shared component's total demand (war_axe therefore retains metal_plate×2
  // even while one plate is represented by an existing sharpened_metal).
  const collectStructuralRequirements = (
    itemId: string,
    requested: number,
    seen: Set<string>,
  ): void => {
    const child = RECIPE_BY_OUTPUT.get(itemId) ?? recipeForOutput(itemId);
    if (!child || seen.has(child.id)) return;
    structuralRequirements.set(
      child.id,
      (structuralRequirements.get(child.id) ?? 0) + requested,
    );
    const batches = Math.ceil(requested / child.outputCount);
    const nextSeen = new Set(seen).add(child.id);
    for (const ingredient of child.ingredients) {
      collectStructuralRequirements(ingredient.itemId, ingredient.count * batches, nextSeen);
    }
  };

  structuralRequirements.set(target.id, target.outputCount);
  for (const ingredient of target.ingredients) {
    collectStructuralRequirements(ingredient.itemId, ingredient.count, new Set([target.id]));
  }

  const visitItem = (itemId: string, requested: number, seen: Set<string>): void => {
    const held = takeAvailable(available, itemId, requested);
    const missing = requested - held;
    const child = RECIPE_BY_OUTPUT.get(itemId) ?? recipeForOutput(itemId);
    if (!child || seen.has(child.id)) {
      addRawGap(itemId, requested, held);
      return;
    }

    recordDemand(child, requested, held, missing);
    if (missing <= 0) return;

    const batches = Math.ceil(missing / child.outputCount);
    const nextSeen = new Set(seen).add(child.id);
    for (const ingredient of child.ingredients) visitItem(ingredient.itemId, ingredient.count * batches, nextSeen);
    // Virtual output is only for satisfying the parent route in this pure
    // calculation. It never mutates actor.inventory and never makes a
    // prerequisite appear directly craftable in the current state.
    available.set(itemId, (available.get(itemId) ?? 0) + batches * child.outputCount);
    takeAvailable(available, itemId, missing);
  };

  visitItem(target.outputItemId, target.outputCount, new Set());
  const orderedSteps = [...demands.values()]
    .map(({ recipe, required, owned, missing, batchesRequired }) => {
      const missingDirect = recipe.ingredients
        .map((ingredient) => ({
          itemId: ingredient.itemId,
          count: Math.max(0, ingredient.count * batchesRequired - (availableCount(actor, ingredient.itemId))),
        }))
        .filter((ingredient) => ingredient.count > 0);
      const directCraftable =
        state.status === 'playing' &&
        canPayActionCost(actor, 'CRAFT').ok &&
        hasRoomForOutput(actor, recipe);
      const status: CraftPlanStepStatus = missing <= 0
        ? 'complete'
        : directCraftable
          ? 'craftable'
          : 'blocked';
      return {
        recipeId: recipe.id,
        outputItemId: recipe.outputItemId,
        name: getItem(recipe.outputItemId).name,
        depth: getRecipeDepth(recipe.id),
        required: structuralRequirements.get(recipe.id) ?? required,
        owned,
        missing,
        batchesRequired,
        directIngredients: recipe.ingredients.map((ingredient) => ({ ...ingredient })),
        missingDirect,
        status,
      } satisfies CraftPlanStep;
    })
    // Array order is the deterministic dependency traversal order. Preserve
    // it for equal-depth siblings so shared requirements are handled in the
    // same branch order every time (war_axe reaches its second metal_plate
    // before unrelated metal_parts).
    .sort((a, b) => a.depth - b.depth);
  const targetStep = orderedSteps.find((step) => step.recipeId === target.id);
  if (!targetStep) return null;
  const rawGaps = [...raw.values()].sort((a, b) => a.itemId.localeCompare(b.itemId));
  const nextStep = orderedSteps.find((step) => step.status !== 'complete') ?? null;
  const suggestedNextCraft = orderedSteps.find((step) => step.status === 'craftable') ?? null;
  const sourceZones = rawGaps
    .filter((gap) => gap.missing > 0)
    .flatMap((gap) => gap.sourceZoneIds)
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .sort((a, b) => zoneDistance(actor.currentZoneId, a) - zoneDistance(actor.currentZoneId, b) || a.localeCompare(b));

  return {
    targetRecipeId,
    targetItemId: target.outputItemId,
    targetName: getItem(target.outputItemId).name,
    depth: getRecipeDepth(targetRecipeId),
    steps: orderedSteps,
    targetStep,
    rawReady: rawGaps.every((gap) => gap.missing <= 0),
    finalCraftable: targetStep.status === 'craftable',
    rawGaps,
    nextStep,
    suggestedNextCraft,
    suggestedMoveZoneId: sourceZones[0] ?? null,
  };
}

function availableCount(actor: Combatant, itemId: string): number {
  return actor.inventory
    .filter((stack) => stack.itemId === itemId)
    .reduce((sum, stack) => sum + stack.count, 0);
}
