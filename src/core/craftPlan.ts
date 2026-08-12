import { getItem } from '../data/items';
import { RECIPES, getRecipeDepth, recipeForOutput, tryGetRecipe } from '../data/recipes';
import { ZONES, getZoneDef } from '../data/zones';
import { hasRoomForOutput } from './crafting';
import { countItem } from './inventory';
import type { Combatant, GameState, RecipeIngredient } from './types';

export type CraftPlanStepStatus = 'complete' | 'craftable' | 'blocked';

export interface CraftPlanStep {
  recipeId: string;
  outputItemId: string;
  name: string;
  depth: number;
  required: number;
  owned: number;
  missingDirect: RecipeIngredient[];
  status: CraftPlanStepStatus;
}

export interface CraftPlanRawGap {
  itemId: string;
  required: number;
  held: number;
  missing: number;
  sourceZoneIds: string[];
}

export interface CraftPlan {
  targetRecipeId: string;
  targetItemId: string;
  targetName: string;
  depth: number;
  steps: CraftPlanStep[];
  rawGaps: CraftPlanRawGap[];
  suggestedNextCraft: CraftPlanStep | null;
  suggestedMoveZoneId: string | null;
}

const RECIPE_BY_OUTPUT = new Map(RECIPES.map((recipe) => [recipe.outputItemId, recipe]));

function sourceZonesFor(itemId: string, state: GameState): string[] {
  return ZONES
    .filter((zone) => {
      if (!zone.basePool.includes(itemId) && !zone.rarePool.includes(itemId)) return false;
      return state.zones[zone.id]?.status !== 'restricted';
    })
    .map((zone) => zone.id);
}

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
  const raw = new Map<string, CraftPlanRawGap>();
  const steps = new Map<string, CraftPlanStep>();

  const visitItem = (itemId: string, requested: number, seen: Set<string>): void => {
    const held = takeAvailable(available, itemId, requested);
    const missing = requested - held;
    const child = RECIPE_BY_OUTPUT.get(itemId) ?? recipeForOutput(itemId);
    if (missing <= 0) {
      if (child) {
        const item = getItem(itemId);
        steps.set(child.id, {
          recipeId: child.id,
          outputItemId: child.outputItemId,
          name: item.name,
          depth: getRecipeDepth(child.id),
          required: requested,
          owned: countItem(actor, itemId),
          missingDirect: [],
          status: 'complete',
        });
      }
      return;
    }
    const item = getItem(itemId);
    if (!child || seen.has(child.id)) {
      const existing = raw.get(itemId) ?? {
        itemId,
        required: 0,
        held: 0,
        missing: 0,
        sourceZoneIds: sourceZonesFor(itemId, state),
      };
      existing.required += requested;
      existing.held += held;
      existing.missing += missing;
      raw.set(itemId, existing);
      return;
    }

    const batches = Math.ceil(missing / child.outputCount);
    const nextSeen = new Set(seen).add(child.id);
    for (const ingredient of child.ingredients) visitItem(ingredient.itemId, ingredient.count * batches, nextSeen);
    const owned = countItem(actor, itemId);
    const directMissing = child.ingredients
      .map((ingredient) => ({ itemId: ingredient.itemId, count: Math.max(0, ingredient.count * batches - countItem(actor, ingredient.itemId)) }))
      .filter((ingredient) => ingredient.count > 0);
    const status: CraftPlanStepStatus = owned >= child.outputCount * batches
      ? 'complete'
      : directMissing.length === 0 && hasRoomForOutput(actor, child)
        ? 'craftable'
        : 'blocked';
    const previous = steps.get(child.id);
    steps.set(child.id, {
      recipeId: child.id,
      outputItemId: child.outputItemId,
      name: item.name,
      depth: getRecipeDepth(child.id),
      required: (previous?.required ?? 0) + batches * child.outputCount,
      owned,
      missingDirect: directMissing,
      status,
    });
  };

  visitItem(target.outputItemId, target.outputCount, new Set());
  const orderedSteps = [...steps.values()].sort((a, b) => a.depth - b.depth || a.recipeId.localeCompare(b.recipeId));
  const rawGaps = [...raw.values()].sort((a, b) => a.itemId.localeCompare(b.itemId));
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
    rawGaps,
    suggestedNextCraft,
    suggestedMoveZoneId: sourceZones[0] ?? null,
  };
}
