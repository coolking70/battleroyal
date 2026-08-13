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
import { recipeVisibility, tryGetRecipe } from '../data/recipes';
import { getWildEnemy } from '../data/wildEnemies';
import { buildCraftPlan } from './craftPlan';
import { SUPPLY_STATUS_LABEL, supplyStatusOf } from './zoneLoot';
import type { Combatant, GameState } from './types';

export { buildCraftPlan } from './craftPlan';
export type { CraftPlan, CraftPlanRawGap, CraftPlanStep, CraftPlanStepStatus } from './craftPlan';

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
  /** Static common drop sources; never a live population read. */
  sourceEnemyIds: string[];
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

  // Current-state route data comes from the sole runtime planner. This keeps
  // source recommendations consistent with Craft Guide, UI and AutoPlayer.
  const plan = buildCraftPlan(state, player, recipe.id);
  const needed = plan?.rawGaps
    .filter((gap) => gap.missing > 0)
    .map((gap) => ({ itemId: gap.itemId, count: gap.missing })) ?? [];
  if (needed.length === 0) return [];

  const gaps = plan?.rawGaps.filter((gap) => gap.missing > 0) ?? [];
  const recs: CraftGoalRecommendation[] = [];

  for (const zoneId of Object.keys(state.zones)) {
    const zone = state.zones[zoneId];

    // 正式禁区直接排除（Phase 2A-1）
    if (zone?.status === 'restricted') continue;

    const here = new Set<string>();
    const sourceEnemyIds = new Set<string>();
    let rareCover = 0;
    const def = getZoneDef(zoneId);
    for (const gap of gaps) {
      if (!gap.sourceZoneIds.includes(zoneId)) continue;
      here.add(gap.itemId);
      if (def.rarePool.includes(gap.itemId) || def.objectivePool?.includes(gap.itemId)) rareCover += 1;
      for (const source of gap.worldSources) {
        if (source.kind !== 'wild_drop' || !source.zoneIds.includes(zoneId)) continue;
        source.enemyIds.forEach((enemyId) => sourceEnemyIds.add(enemyId));
      }
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
      reason: sourceEnemyIds.size > 0
        ? `可获取 ${[...here].map((id) => tryGetItem(id)?.name ?? id).join('、')}；常见威胁：${[...sourceEnemyIds].map((id) => getWildEnemy(id).name).join('、')}（距离 ${distance}）`
        : `可搜到 ${[...here].map((id) => tryGetItem(id)?.name ?? id).join('、')}（距离 ${distance}，${SUPPLY_STATUS_LABEL[supplyStatusOf(zone)]}）`,
      sourceEnemyIds: [...sourceEnemyIds],
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

  const plan = buildCraftPlan(state, player, recipe.id);
  if (!plan) return `制作目标：${name}。当前路线不可用。`;
  if (plan.targetStep.status === 'complete') return `制作目标：${name}（已完成）。`;
  if (plan.finalCraftable) return `制作目标：${name}（可直接合成）。`;
  if (plan.rawReady) {
    const next = plan.suggestedNextCraft;
    return next
      ? `制作目标：${name}（原料齐全，还需完成 ${plan.steps.filter((step) => step.status !== 'complete').length} 个制作步骤）。下一步：${next.name}。`
      : `制作目标：${name}（原料齐全，但当前不能执行下一步）。`;
  }

  const needed = plan.rawGaps
    .filter((gap) => gap.missing > 0)
    .map((gap) => ({ itemId: gap.itemId, count: gap.missing }));

  const missing = needed
    .map(
      (ing) => `${tryGetItem(ing.itemId)?.name ?? ing.itemId} ×${ing.count}`,
    )
    .join('、');

  const recs = getCraftGoalRecommendations(state, player);
  const zones = recs.slice(0, 3).map((r) => r.zoneId).join('、');
  return `制作目标：${name}。仍缺：${missing}。建议前往：${zones || '（无可用区域）'}。`;
}
