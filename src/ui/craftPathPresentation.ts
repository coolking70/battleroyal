import type { Combatant, GameState, Recipe } from '../core/types';
import { getItem } from '../data/items';
import { RECIPES, tryGetRecipe } from '../data/recipes';
import { ZONES } from '../data/zones';

/** 合成路线中的原始材料；来源只读取静态公开物资池，不读取 zone.loot。 */
export interface RawCraftMaterial {
  itemId: string;
  required: number;
  held: number;
  missing: number;
  sourceZoneIds: string[];
}

/** 一个需要先完成的中间部件步骤。 */
export interface IntermediateCraftStep {
  recipeId: string;
  outputItemId: string;
  name: string;
  depth: number;
}

export interface CraftPathSummary {
  /** 目标配方的静态树深度；基础材料直出为 1。 */
  depth: number;
  rawMaterials: RawCraftMaterial[];
  intermediateSteps: IntermediateCraftStep[];
}

const OUTPUT_RECIPE_MAP = new Map(
  RECIPES.map((recipe) => [recipe.outputItemId, recipe]),
);

function staticSourceZones(itemId: string, state: GameState): string[] {
  return ZONES
    .filter((zone) => {
      const isStaticSource = zone.basePool.includes(itemId) || zone.rarePool.includes(itemId);
      return isStaticSource && state.zones[zone.id]?.status !== 'restricted';
    })
    .map((zone) => zone.id);
}

function recipeDepth(recipe: Recipe, seen = new Set<string>()): number {
  if (seen.has(recipe.id)) return 1;
  const nextSeen = new Set(seen).add(recipe.id);
  return 1 + Math.max(
    0,
    ...recipe.ingredients.map((ingredient) => {
      const child = OUTPUT_RECIPE_MAP.get(ingredient.itemId);
      return child ? recipeDepth(child, nextSeen) : 0;
    }),
  );
}

/**
 * 将目标配方展开为“先做哪些中间部件、原始材料可去哪找”。
 * 这是纯展示层计算：只使用玩家自己的背包、静态配方和公开区域池，
 * 绝不读取当前区域剩余库存、未发现掉落或其他角色数据。
 */
export function craftPathSummary(
  recipeId: string,
  state: GameState,
  player: Combatant,
): CraftPathSummary | null {
  const target = tryGetRecipe(recipeId);
  if (!target) return null;

  const available = new Map<string, number>();
  for (const stack of player.inventory) {
    available.set(stack.itemId, (available.get(stack.itemId) ?? 0) + stack.count);
  }

  const raw = new Map<string, RawCraftMaterial>();
  const intermediate = new Map<string, IntermediateCraftStep>();

  const visitItem = (
    itemId: string,
    requested: number,
    depth: number,
    visiting: Set<string>,
  ): void => {
    const held = Math.min(requested, available.get(itemId) ?? 0);
    if (held > 0) available.set(itemId, (available.get(itemId) ?? 0) - held);
    const missing = requested - held;
    const recipe = OUTPUT_RECIPE_MAP.get(itemId);

    if (missing <= 0) return;
    if (!recipe || visiting.has(itemId)) {
      const existing = raw.get(itemId) ?? {
        itemId,
        required: 0,
        held: 0,
        missing: 0,
        sourceZoneIds: staticSourceZones(itemId, state),
      };
      existing.required += requested;
      existing.held += held;
      existing.missing += missing;
      raw.set(itemId, existing);
      return;
    }

    const outputBatches = Math.ceil(missing / recipe.outputCount);
    const nextVisiting = new Set(visiting).add(itemId);
    for (const ingredient of recipe.ingredients) {
      visitItem(ingredient.itemId, ingredient.count * outputBatches, depth + 1, nextVisiting);
    }
    intermediate.set(itemId, {
      recipeId: recipe.id,
      outputItemId: itemId,
      name: getItem(itemId).name,
      depth,
    });
  };

  for (const ingredient of target.ingredients) {
    visitItem(ingredient.itemId, ingredient.count, 1, new Set([target.outputItemId]));
  }

  return {
    depth: recipeDepth(target),
    rawMaterials: [...raw.values()],
    intermediateSteps: [...intermediate.values()].sort((a, b) => b.depth - a.depth || a.recipeId.localeCompare(b.recipeId)),
  };
}
