import type { Recipe } from '../core/types';
import { PHASE4M_RECIPES } from './phase4mRecipes';
import { PHASE4N_RECIPES } from './phase4nRecipes';
import { ITEMS as ITEMS_FOR_GRAPH } from './items';
import { validateRawWorldSources } from '../core/worldSources';

/**
 * Phase 4C-1 共 17 条配方：11 条武器、3 条防具、3 条治疗。
 * 武器树允许“基础材料 → 中间武器 → 高阶武器”的多步链路。
 */
const LEGACY_RECIPES: Recipe[] = [
  {
    id: 'r_stick',
    name: '木棍',
    ingredients: [
      { itemId: 'wood', count: 1 },
      { itemId: 'stone', count: 1 },
    ],
    outputItemId: 'stick',
    outputCount: 1,
    description: '用石头把木条削出尖头。',
  },
  {
    id: 'r_stone_axe',
    name: '石斧',
    ingredients: [
      { itemId: 'stick', count: 1 },
      { itemId: 'stone', count: 1 },
    ],
    outputItemId: 'stone_axe',
    outputCount: 1,
    description: '把石头绑上木棍，重量就是伤害。',
  },
  {
    id: 'r_iron_pipe',
    name: '铁管',
    ingredients: [
      { itemId: 'scrap', count: 1 },
      { itemId: 'wood', count: 1 },
    ],
    outputItemId: 'iron_pipe',
    outputCount: 1,
    description: '废金属敲直，木片做握把。',
  },
  {
    id: 'r_simple_bow',
    name: '简易弓',
    ingredients: [
      { itemId: 'wood', count: 1 },
      { itemId: 'rope', count: 1 },
    ],
    outputItemId: 'simple_bow',
    outputCount: 1,
    description: '弯木上弦，勉强能射出去。',
  },
  {
    id: 'r_stun_rod',
    name: '电击棒',
    ingredients: [
      { itemId: 'battery', count: 1 },
      { itemId: 'scrap', count: 1 },
    ],
    outputItemId: 'stun_rod',
    outputCount: 1,
    description: '电池接上金属棒，小心自己别碰到。',
  },
  /* ---------------- 武器深层链路（Phase 4C-1） ---------------- */
  {
    id: 'r_reinforced_handle',
    name: '加固握把',
    ingredients: [
      { itemId: 'stick', count: 1 },
      { itemId: 'rope', count: 1 },
    ],
    outputItemId: 'reinforced_handle',
    outputCount: 1,
    description: '先把木棍和绳子做成稳定的中间部件。',
  },
  {
    id: 'r_field_spear',
    name: '野外长矛',
    ingredients: [
      { itemId: 'reinforced_handle', count: 1 },
      { itemId: 'iron', count: 1 },
    ],
    outputItemId: 'field_spear',
    outputCount: 1,
    description: '加固握把还需要金属材料才能成为长矛。',
  },
  {
    id: 'r_steel_axe',
    name: '钢刃斧',
    ingredients: [
      { itemId: 'stone_axe', count: 1 },
      { itemId: 'iron', count: 1 },
    ],
    outputItemId: 'steel_axe',
    outputCount: 1,
    description: '石斧完成后，再去找铁块加固刃口。',
  },
  {
    id: 'r_composite_bow',
    name: '复合弓',
    ingredients: [
      { itemId: 'simple_bow', count: 1 },
      { itemId: 'glass', count: 1 },
    ],
    outputItemId: 'composite_bow',
    outputCount: 1,
    description: '简易弓成形后，用玻璃片加强弓身。',
  },
  {
    id: 'r_insulated_pipe',
    name: '绝缘铁管',
    ingredients: [
      { itemId: 'iron_pipe', count: 1 },
      { itemId: 'cloth', count: 1 },
    ],
    outputItemId: 'insulated_pipe',
    outputCount: 1,
    description: '铁管需要布料包裹，才能成为更稳定的武器。',
  },
  {
    id: 'r_insulated_stun_rod',
    name: '绝缘电击棒',
    ingredients: [
      { itemId: 'stun_rod', count: 1 },
      { itemId: 'cloth', count: 1 },
    ],
    outputItemId: 'insulated_stun_rod',
    outputCount: 1,
    description: '电击棒还需要布料绝缘，才能安全提高输出。',
  },
  {
    id: 'r_cloth_armor',
    name: '布衣',
    ingredients: [
      { itemId: 'cloth', count: 1 },
      { itemId: 'rope', count: 1 },
    ],
    outputItemId: 'cloth_armor',
    outputCount: 1,
    description: '多层布料捆扎成简陋软甲。',
  },
  {
    id: 'r_simple_armor',
    name: '简易护甲',
    ingredients: [
      { itemId: 'iron', count: 1 },
      { itemId: 'cloth', count: 1 },
    ],
    outputItemId: 'simple_armor',
    outputCount: 1,
    description: '铁片缝进布衬里。',
  },
  {
    id: 'r_plate_armor',
    name: '铁板护甲',
    ingredients: [
      { itemId: 'iron', count: 1 },
      { itemId: 'scrap', count: 1 },
    ],
    outputItemId: 'plate_armor',
    outputCount: 1,
    description: '厚铁板拼接，沉但可靠。',
  },
  {
    id: 'r_bandage',
    name: '绷带',
    ingredients: [
      { itemId: 'herb', count: 1 },
      { itemId: 'cloth', count: 1 },
    ],
    outputItemId: 'bandage',
    outputCount: 1,
    description: '药草敷在布条上。',
  },
  {
    id: 'r_medkit',
    name: '医疗包',
    ingredients: [
      { itemId: 'herb', count: 1 },
      { itemId: 'alcohol', count: 1 },
    ],
    outputItemId: 'medkit',
    outputCount: 1,
    description: '消毒加止血，能处理大伤口。',
  },
  {
    id: 'r_herb_remedy',
    name: '草药',
    ingredients: [
      { itemId: 'herb', count: 1 },
      { itemId: 'glass', count: 1 },
    ],
    outputItemId: 'herb_remedy',
    outputCount: 1,
    description: '用玻璃器皿把药草捣成可服用的糊剂。',
  },
];

export const RECIPES: Recipe[] = [...LEGACY_RECIPES, ...PHASE4M_RECIPES, ...PHASE4N_RECIPES];

/** 配方图谱的唯一来源：一件输出物只能有一个正式配方。 */
const RECIPE_MAP: Record<string, Recipe> = Object.fromEntries(
  RECIPES.map((r) => [r.id, r]),
);
const RECIPE_OUTPUT_MAP: Record<string, Recipe> = Object.fromEntries(
  RECIPES.map((r) => [r.outputItemId, r]),
);

export function recipeForOutput(itemId: string): Recipe | null {
  return RECIPES.find((recipe) => recipe.outputItemId === itemId) ?? null;
}

/**
 * 验证制作图：引用、唯一输出、正数、自环/环、raw 叶子与中间件可达性。
 * 返回稳定排序的错误列表，既可在模块加载时自检，也可由验收测试直接调用。
 */
export function validateRecipeGraph(recipes: readonly Recipe[] = RECIPES): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const outputs = new Map<string, Recipe>();
  const itemIds = new Set(ITEMS_FOR_GRAPH.map((item) => item.id));
  for (const recipe of recipes) {
    if (ids.has(recipe.id)) errors.push(`重复配方 id：${recipe.id}`);
    ids.add(recipe.id);
    if (!/^r_[a-z][a-z0-9_]*$/.test(recipe.id)) errors.push(`配方 id 非稳定 snake_case：${recipe.id}`);
    if (!itemIds.has(recipe.outputItemId)) errors.push(`配方 ${recipe.id} 输出未知物品：${recipe.outputItemId}`);
    if (!Number.isInteger(recipe.outputCount) || recipe.outputCount <= 0) errors.push(`配方 ${recipe.id} outputCount 非法`);
    if (outputs.has(recipe.outputItemId)) errors.push(`物品 ${recipe.outputItemId} 存在多个输出配方`);
    outputs.set(recipe.outputItemId, recipe);
    const ingredientIds = new Set<string>();
    for (const ingredient of recipe.ingredients) {
      if (!itemIds.has(ingredient.itemId)) errors.push(`配方 ${recipe.id} 引用了未知材料：${ingredient.itemId}`);
      if (!Number.isInteger(ingredient.count) || ingredient.count <= 0) errors.push(`配方 ${recipe.id} 的 ${ingredient.itemId} 数量非法`);
      if (ingredientIds.has(ingredient.itemId)) errors.push(`配方 ${recipe.id} 重复引用材料：${ingredient.itemId}`);
      ingredientIds.add(ingredient.itemId);
      if (ingredient.itemId === recipe.outputItemId) errors.push(`配方 ${recipe.id} 存在 self-reference`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (itemId: string, path: string[]): void => {
    const child = outputs.get(itemId);
    if (!child) return;
    if (visiting.has(child.id)) {
      errors.push(`配方图存在环：${[...path, child.id].join(' -> ')}`);
      return;
    }
    if (visited.has(child.id)) return;
    visiting.add(child.id);
    for (const ingredient of child.ingredients) walk(ingredient.itemId, [...path, child.id]);
    visiting.delete(child.id);
    visited.add(child.id);
  };
  for (const recipe of recipes) walk(recipe.outputItemId, []);

  const consumers = new Set<string>();
  for (const recipe of recipes) for (const ingredient of recipe.ingredients) consumers.add(ingredient.itemId);
  const reachableComponents = new Set<string>();
  const reachable = (itemId: string, seen = new Set<string>()): void => {
    if (seen.has(itemId)) return;
    const next = new Set(seen).add(itemId);
    const recipe = outputs.get(itemId);
    if (!recipe) return;
    for (const ingredient of recipe.ingredients) {
      const item = ITEMS_FOR_GRAPH.find((candidate) => candidate.id === ingredient.itemId);
      if (item?.craftTier === 'component') reachableComponents.add(ingredient.itemId);
      reachable(ingredient.itemId, next);
    }
  };
  for (const recipe of recipes) {
    const output = ITEMS_FOR_GRAPH.find((item) => item.id === recipe.outputItemId);
    if (output?.craftTier === 'final') reachable(recipe.outputItemId);
  }
  for (const item of ITEMS_FOR_GRAPH) {
    if (item.craftTier !== 'component') continue;
    if (!outputs.has(item.id)) errors.push(`中间件 ${item.id} 没有输出配方`);
    if (!consumers.has(item.id)) errors.push(`中间件 ${item.id} 没有消费者`);
    if (!reachableComponents.has(item.id)) errors.push(`中间件 ${item.id} 不可从最终产物到达`);
  }

  // 每个最终装备 / 最终消耗品都必须能递归落到 raw 叶子。
  const leafCheck = (itemId: string, path: string[] = []): void => {
    const item = ITEMS_FOR_GRAPH.find((candidate) => candidate.id === itemId);
    const recipe = outputs.get(itemId);
    if (!item || !recipe) return;
    for (const ingredient of recipe.ingredients) {
      const ingredientDef = ITEMS_FOR_GRAPH.find((candidate) => candidate.id === ingredient.itemId);
      if (!ingredientDef) continue;
      if (!outputs.has(ingredient.itemId) && ingredientDef.craftTier !== 'raw') {
        errors.push(`最终配方 ${itemId} 的叶子 ${ingredient.itemId} 不是 raw`);
      }
      if (path.includes(ingredient.itemId)) errors.push(`配方图路径环：${[...path, ingredient.itemId].join(' -> ')}`);
      else leafCheck(ingredient.itemId, [...path, itemId]);
    }
  };
  for (const item of ITEMS_FOR_GRAPH) {
    if (item.craftTier === 'final' && (item.category === 'weapon' || item.category === 'armor' || item.category === 'utility' || item.category === 'consumable')) {
      leafCheck(item.id);
    }
  }
  const rawLeaves = ITEMS_FOR_GRAPH.filter((item) => item.craftTier === 'raw').map((item) => item.id);
  errors.push(...validateRawWorldSources(rawLeaves));
  return [...new Set(errors)].sort();
}

export function getRecipeDepth(recipeId: string): number {
  const recipe = RECIPE_MAP[recipeId];
  if (!recipe) return 0;
  const depthOfItem = (itemId: string, seen: Set<string>): number => {
    const child = RECIPE_OUTPUT_MAP[itemId];
    if (!child || seen.has(child.id)) return 0;
    const next = new Set(seen).add(child.id);
    return 1 + Math.max(0, ...child.ingredients.map((ingredient) => depthOfItem(ingredient.itemId, next)));
  };
  return depthOfItem(recipe.outputItemId, new Set());
}

export const getCraftDepth = getRecipeDepth;

const recipeGraphErrors = validateRecipeGraph();
if (recipeGraphErrors.length > 0) throw new Error(recipeGraphErrors.join('；'));

/**
 * 图鉴可见性接缝。
 *
 * 4C-2 中所有配方都公开；未来若加入隐藏配方，只需在数据层调整这个
 * 维度，展示层不必重构依赖图。本阶段不实现解锁或发现逻辑。
 */
export type RecipeVisibility = 'visible' | 'hidden';

export const RECIPE_VISIBILITY: Readonly<Record<string, RecipeVisibility>> =
  Object.freeze(
    Object.fromEntries(RECIPES.map((recipe) => [recipe.id, 'visible'])),
  ) as Readonly<Record<string, RecipeVisibility>>;

export function recipeVisibility(recipeId: string): RecipeVisibility {
  return RECIPE_VISIBILITY[recipeId] ?? 'hidden';
}

export function getRecipe(id: string): Recipe {
  const r = RECIPE_MAP[id];
  if (!r) {
    throw new Error(`未知配方 id: ${id}`);
  }
  return r;
}

export function tryGetRecipe(id: string): Recipe | null {
  return RECIPE_MAP[id] ?? null;
}
