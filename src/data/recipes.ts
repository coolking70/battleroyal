import type { Recipe } from '../core/types';

/**
 * 11 条配方。武器 5 条、防具 3 条、治疗 3 条。
 * 每条配方只用 2 种材料，保持第一版复杂度可控。
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
