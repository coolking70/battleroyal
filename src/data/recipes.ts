import type { Recipe } from '../core/types';

/**
 * Phase 4C-1 共 17 条配方：11 条武器、3 条防具、3 条治疗。
 * 武器树允许“基础材料 → 中间武器 → 高阶武器”的多步链路。
 */
export const RECIPES: Recipe[] = [
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

const RECIPE_MAP: Record<string, Recipe> = Object.fromEntries(
  RECIPES.map((r) => [r.id, r]),
);

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
