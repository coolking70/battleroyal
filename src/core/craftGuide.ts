/**
 * 制作目标路线推荐（Phase 2A-1 升级）。
 *
 * 评分从「缺失材料覆盖量 + 稀有池权重」升级为（规格 §九）：
 *
 *   score = 可覆盖缺失材料数量 × 10
 *         + 稀有材料覆盖 × 3
 *         + 公开资源状态权重
 *         − BFS 距离 × 2
 *
 * 规则：
 * - 正式禁区直接排除；预警区明显扣分；
 * - 「公开资源状态」只使用玩家可见的模糊分档（rich / normal / scarce / empty），
 *   取自 `supplyStatusOf(zone)`（由 zone.supply 派生），绝不低于 zone.loot；
 * - 距离用固定区域邻接图上的 BFS 计算（`getZoneDistance`）。
 *
 * 反作弊不变量（2A-H）：推荐**绝不读取 `zone.loot` / `zone.remainingLootCount`**
 * 等随搜索枯竭的隐藏信息——把某区域库存清空，推荐结果（按 zoneId 排序）不变。
 * （`zone.supply` 是公开的模糊比例，清空 loot 不改变它，因此也满足该不变量。）
 */

import { getZoneDef } from '../data/zones';
import { getItem, tryGetItem } from '../data/items';
import { RECIPES, recipeVisibility, tryGetRecipe } from '../data/recipes';
import { SUPPLY_STATUS_LABEL, supplyStatusOf } from './zoneLoot';
import type { Combatant, GameState } from './types';

export interface CraftGoalRecommendation {
  /** 推荐前往搜索的区域 id */
  zoneId: string;
  /** 该区域静态池里能覆盖的、当前仍缺失的原始材料 */
  itemIds: string[];
  /** 推荐权重：覆盖缺失材料 ×10 + 稀有覆盖 ×3 + 公开资源 − BFS 距离 ×2 */
  score: number;
  /** 与玩家所在区域的 BFS 距离（步数） */
  distance: number;
  /** 玩家可见的物资分档文案（rich/normal/scarce/empty） */
  supplyLabel: string;
  /** 一句话理由（UI 展示用） */
  reason: string;
}

const OUTPUT_RECIPE_MAP = new Map(
  RECIPES.map((recipe) => [recipe.outputItemId, recipe]),
);

/**
 * 展开制作目标的公开依赖树，返回当前仍缺失的原始材料。
 *
 * 这是路线建议的只读计算，不参与合成结算，也不读取 zone.loot。
 * 已持有的中间部件会优先被消耗；若中间部件尚未持有，则继续展开到
 * 静态材料。未来隐藏配方不会被反向展开，避免借路线推荐泄露隐藏依赖。
 */
function missingRawMaterialsForGoal(
  recipeId: string,
  player: Combatant,
): Map<string, number> {
  const recipe = tryGetRecipe(recipeId);
  if (!recipe || recipeVisibility(recipe.id) !== 'visible') return new Map();

  const available = new Map<string, number>();
  for (const stack of player.inventory) {
    available.set(stack.itemId, (available.get(stack.itemId) ?? 0) + stack.count);
  }
  const missing = new Map<string, number>();

  const visit = (
    itemId: string,
    requested: number,
    visiting: Set<string>,
  ): void => {
    const held = Math.min(requested, available.get(itemId) ?? 0);
    if (held > 0) {
      available.set(itemId, (available.get(itemId) ?? 0) - held);
    }
    const remaining = requested - held;
    if (remaining <= 0) return;

    const child = OUTPUT_RECIPE_MAP.get(itemId);
    if (
      !child ||
      recipeVisibility(child.id) !== 'visible' ||
      visiting.has(child.id)
    ) {
      missing.set(itemId, (missing.get(itemId) ?? 0) + remaining);
      return;
    }

    const batches = Math.ceil(remaining / child.outputCount);
    const nextVisiting = new Set(visiting).add(child.id);
    for (const ingredient of child.ingredients) {
      visit(ingredient.itemId, ingredient.count * batches, nextVisiting);
    }
  };

  for (const ingredient of recipe.ingredients) {
    visit(ingredient.itemId, ingredient.count, new Set([recipe.id]));
  }
  return missing;
}

/**
 * 固定区域邻接图上的 BFS 最短距离。
 * 不连通时返回 -1（本游戏邻接图连通，正常情况下不会发生）。
 */
export function getZoneDistance(fromZoneId: string, toZoneId: string): number {
  if (fromZoneId === toZoneId) return 0;
  const visited = new Set<string>([fromZoneId]);
  let frontier = [fromZoneId];
  let depth = 0;
  while (frontier.length > 0) {
    depth += 1;
    const next: string[] = [];
    for (const zoneId of frontier) {
      for (const adj of getZoneDef(zoneId).adjacent) {
        if (visited.has(adj)) continue;
        if (adj === toZoneId) return depth;
        visited.add(adj);
        next.push(adj);
      }
    }
    frontier = next;
  }
  return -1;
}

/** 公开资源状态 → 评分权重（搜空的区域基本失去推荐价值） */
function resourceWeightOf(zoneId: string, state: GameState): number {
  const zone = state.zones[zoneId];
  if (!zone) return -100;
  switch (supplyStatusOf(zone)) {
    case 'rich':
      return 4;
    case 'normal':
      return 2;
    case 'scarce':
      return 0;
    case 'empty':
      return -50;
  }
}

/**
 * 根据当前制作目标，推荐优先搜索哪些区域。
 *
 * @returns 按 score 降序排列的推荐列表；无目标 / 目标未知 / 材料已齐时返回空数组。
 */
export function getCraftGoalRecommendations(
  state: GameState,
  player: Combatant,
): CraftGoalRecommendation[] {
  const recipeId = state.craftGoalRecipeId;
  if (!recipeId) return [];
  const recipe = tryGetRecipe(recipeId);
  if (!recipe || recipeVisibility(recipe.id) !== 'visible') return [];

  // 展开多步配方后仍缺失的原始材料；不读取当前区域库存。
  const needed = [...missingRawMaterialsForGoal(recipe.id, player).entries()]
    .map(([itemId, count]) => ({ itemId, count }));
  if (needed.length === 0) return [];

  const neededIds = new Set(needed.map((i) => i.itemId));
  const recs: CraftGoalRecommendation[] = [];

  for (const zoneId of Object.keys(state.zones)) {
    const zone = state.zones[zoneId];
    const def = getZoneDef(zoneId);

    // 正式禁区直接排除（Phase 2A-1）
    if (zone?.status === 'restricted') continue;

    const here = new Set<string>();
    let rareCover = 0;
    for (const id of [...def.basePool, ...def.rarePool]) {
      if (!neededIds.has(id)) continue;
      here.add(id);
      if (def.rarePool.includes(id)) rareCover += 1;
    }
    if (here.size === 0) continue;

    const distance = getZoneDistance(player.currentZoneId, zoneId);
    let score =
      here.size * 10 +
      rareCover * 3 +
      resourceWeightOf(zoneId, state) -
      distance * 2;

    // 预警区明显扣分（Phase 2A-1）
    if (zone?.status === 'warning') score -= 6;

    recs.push({
      zoneId,
      itemIds: [...here],
      score,
      distance,
      supplyLabel: SUPPLY_STATUS_LABEL[supplyStatusOf(zone)],
      reason: `可搜到 ${[...here].map((id) => tryGetItem(id)?.name ?? id).join('、')}（距离 ${distance}，${SUPPLY_STATUS_LABEL[supplyStatusOf(zone)]}）`,
    });
  }

  recs.sort((x, y) => y.score - x.score || x.zoneId.localeCompare(y.zoneId));
  return recs;
}

/**
 * 生成当前制作目标的一段可读描述（结算 / 调试面板 / 制作目标面板用）。
 */
export function describeCraftGoal(state: GameState, player: Combatant): string {
  const recipeId = state.craftGoalRecipeId;
  if (!recipeId) return '尚未设定制作目标。';
  const recipe = tryGetRecipe(recipeId);
  if (!recipe || recipeVisibility(recipe.id) !== 'visible') return '制作目标指向未知配方。';
  const name = getItem(recipe.outputItemId).name;

  const needed = [...missingRawMaterialsForGoal(recipe.id, player).entries()]
    .map(([itemId, count]) => ({ itemId, count }));
  if (needed.length === 0) {
    return `制作目标：${name}（材料已齐，可直接合成）。`;
  }

  const missing = needed
    .map(
      (ing) => `${tryGetItem(ing.itemId)?.name ?? ing.itemId} ×${ing.count}`,
    )
    .join('、');

  const recs = getCraftGoalRecommendations(state, player);
  const zones = recs.slice(0, 3).map((r) => r.zoneId).join('、');
  return `制作目标：${name}。仍缺：${missing}。建议前往：${zones || '（无可用区域）'}。`;
}
