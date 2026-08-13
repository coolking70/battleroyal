import { buildCraftPlan } from '../core/craftPlan';
import type { CraftPlanStep } from '../core/craftPlan';
import { getZoneDistance } from '../core/craftGuide';
import { weaponAttackOf } from '../core/inventory';
import { getItem } from '../data/items';
import { getRecipeDepth, RECIPES, recipeVisibility, tryGetRecipe } from '../data/recipes';
import { ZONES } from '../data/zones';
import type { Combatant, GameState } from '../core/types';

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
  required: number;
}

export type CraftStepStatus = 'complete' | 'ready' | 'blocked';

/** 合成目标依赖树中的可制作节点，状态只来自玩家自身物品与权威 RecipeView。 */
export interface CraftTreeStep {
  recipeId: string;
  outputItemId: string;
  name: string;
  depth: number;
  required: number;
  owned: number;
  missing: number;
  batchesRequired: number;
  status: CraftStepStatus;
}

export interface CraftGoalSuggestion {
  recipeId: string;
  outputItemId: string;
  name: string;
  attack: number;
  score: number;
  nextStep: CraftTreeStep | null;
  reason: string;
  sourceZoneIds: string[];
}

export interface CraftPathSummary {
  /** 目标配方的静态树深度；基础材料直出为 1。 */
  depth: number;
  rawMaterials: RawCraftMaterial[];
  intermediateSteps: IntermediateCraftStep[];
  /** 原始材料到目标成品的完整制作节点，按可执行顺序排列。 */
  steps: CraftTreeStep[];
  /** 当前最先未完成的子目标；随着玩家物品变化自动推进。 */
  nextStep: CraftTreeStep | null;
  /** raw leaf 已齐，但不等于目标配方可以直接执行。 */
  rawReady: boolean;
  /** 目标配方本身当前可执行。 */
  finalCraftable: boolean;
  /** 当前背包/目标装备中真实拥有目标成品。 */
  targetComplete: boolean;
}

// Static-only query used by Codex source display. Runtime route state must use
// buildCraftPlan below; this map never reads inventory or computes readiness.
const STATIC_RECIPE_BY_OUTPUT = new Map(
  RECIPES.map((recipe) => [recipe.outputItemId, recipe]),
);

/** 图鉴可用的静态公开来源，不读取当前区域库存。 */
export function publicSourceZones(itemId: string): string[] {
  return ZONES
    .filter((zone) => zone.basePool.includes(itemId) || zone.rarePool.includes(itemId))
    .map((zone) => zone.id);
}

/** 返回配方依赖的原始材料 id，供图鉴展示完整来源，不携带库存数量。 */
export function rawMaterialIdsForRecipe(recipeId: string): string[] {
  const recipe = tryGetRecipe(recipeId);
  if (!recipe) return [];
  const result = new Set<string>();
  const visit = (itemId: string, seen: Set<string>): void => {
    const child = STATIC_RECIPE_BY_OUTPUT.get(itemId);
    if (!child || seen.has(child.id)) {
      result.add(itemId);
      return;
    }
    const nextSeen = new Set(seen).add(child.id);
    for (const ingredient of child.ingredients) visit(ingredient.itemId, nextSeen);
  };
  for (const ingredient of recipe.ingredients) visit(ingredient.itemId, new Set([recipe.id]));
  return [...result].sort();
}

function presentPlanStep(step: CraftPlanStep): CraftTreeStep {
  return {
    recipeId: step.recipeId,
    outputItemId: step.outputItemId,
    name: step.name,
    depth: step.depth,
    required: step.required,
    owned: step.owned,
    missing: step.missing,
    batchesRequired: step.batchesRequired,
    status: step.status === 'craftable' ? 'ready' : step.status,
  };
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
  const plan = buildCraftPlan(state, player, recipeId);
  if (!target || !plan) return null;
  const steps = plan.steps.map(presentPlanStep);
  const nextStep = plan.nextStep ? presentPlanStep(plan.nextStep) : null;
  const intermediateSteps = steps
    .filter((step) => step.recipeId !== target.id)
    .map((step) => ({
      recipeId: step.recipeId,
      outputItemId: step.outputItemId,
      name: step.name,
      depth: step.depth,
      required: step.required,
    }));

  return {
    depth: getRecipeDepth(target.id),
    rawMaterials: plan.rawGaps,
    intermediateSteps,
    steps,
    nextStep,
    rawReady: plan.rawReady,
    finalCraftable: plan.finalCraftable,
    targetComplete: plan.targetStep.status === 'complete',
  };
}

/**
 * 基于玩家自己的材料、装备武器和当前位置，给出一个可采纳的目标。
 * 这是纯展示层排序，不修改 state；采纳时由 UI 继续派发 SET_CRAFT_GOAL。
 */
export function getCraftGoalSuggestion(
  state: GameState,
  player: Combatant,
): CraftGoalSuggestion | null {
  // 手动目标优先：自动建议不得覆盖玩家意图。
  if (state.craftGoalRecipeId) return null;

  const currentAttack = weaponAttackOf(player);
  const candidates = RECIPES.filter((recipe) => {
    if (recipeVisibility(recipe.id) !== 'visible') return false;
    const item = getItem(recipe.outputItemId);
    return item.category === 'weapon' && (item.attack ?? 0) > currentAttack;
  }).map((recipe) => {
    const path = craftPathSummary(recipe.id, state, player);
    if (!path) return null;
    const attack = getItem(recipe.outputItemId).attack ?? 0;
    const completed = path.steps.filter((step) => step.status === 'complete').length;
    const rawMissing = path.rawMaterials.reduce((sum, material) => sum + material.missing, 0);
    const sourceZoneIds = [...new Set(path.rawMaterials.flatMap((material) => material.sourceZoneIds))];
    const sourceDistance = sourceZoneIds.length > 0
      ? Math.min(...sourceZoneIds.map((zoneId) => getZoneDistance(player.currentZoneId, zoneId)))
      : 8;
    const score =
      (attack - currentAttack) * 100 +
      completed * 15 -
      rawMissing * 4 -
      path.depth * 2 -
      sourceDistance * 3;
    const nextStep = path.nextStep;
    return {
      recipeId: recipe.id,
      outputItemId: recipe.outputItemId,
      name: getItem(recipe.outputItemId).name,
      attack,
      score,
      nextStep,
      sourceZoneIds,
      reason: nextStep
        ? `攻击 +${attack} · 当前先做「${nextStep.name}」 · 公开来源可在图鉴查看`
        : path.finalCraftable
          ? `攻击 +${attack} · 当前材料已齐，可直接合成`
          : `攻击 +${attack} · 当前路线正在等待可执行步骤`,
    } satisfies CraftGoalSuggestion;
  }).filter((candidate): candidate is CraftGoalSuggestion => candidate !== null);

  candidates.sort((a, b) =>
    b.score - a.score || a.recipeId.localeCompare(b.recipeId),
  );
  return candidates[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Phase 4D-1 改进 C：合成引导提权                                      */
/* ------------------------------------------------------------------ */

/** 目标条上展示的一项材料缺口。 */
export interface CraftGoalBannerGap {
  itemId: string;
  name: string;
  missing: number;
}

/**
 * 中栏常驻目标条的数据。
 *
 * 它回答四个问题，且**只**回答这四个：
 * 目标是什么 / 现在该做哪一步 / 还缺什么 / 去哪找。
 *
 * 信息边界与合成 tab 完全一致：只读玩家自己的背包、静态配方表和
 * 区域的**公开**物资池（`basePool` / `rarePool`），不读 `zone.loot` 的
 * 实际剩余、不读其他角色、不读未发现的掉落。
 */
export interface CraftGoalBanner {
  /** goal = 玩家已设目标；suggestion = 尚未设目标时的系统建议 */
  kind: 'goal' | 'suggestion';
  recipeId: string;
  outputItemId: string;
  name: string;
  completed: boolean;
  rawReady: boolean;
  finalCraftable: boolean;
  /** 当前最先未完成的子目标名；全部步骤就绪时为 null */
  nextStepName: string | null;
  /** 缺口最大的原始材料（最多 3 项） */
  gaps: CraftGoalBannerGap[];
  /** 去哪找：公开来源区域名（去重，最多 3 个） */
  sourceZoneNames: string[];
}

const BANNER_GAP_LIMIT = 3;
const BANNER_ZONE_LIMIT = 3;

function bannerFromPath(
  kind: CraftGoalBanner['kind'],
  recipeId: string,
  state: GameState,
  player: Combatant,
): CraftGoalBanner | null {
  const recipe = tryGetRecipe(recipeId);
  if (!recipe) return null;
  const path = craftPathSummary(recipeId, state, player);
  if (!path) return null;

  const gaps = path.rawMaterials
    .filter((material) => material.missing > 0)
    .sort((a, b) => b.missing - a.missing || a.itemId.localeCompare(b.itemId))
    .slice(0, BANNER_GAP_LIMIT)
    .map((material) => ({
      itemId: material.itemId,
      name: getItem(material.itemId).name,
      missing: material.missing,
    }));

  // 只列还缺的那些材料的来源；已经凑齐的材料没必要再指路
  const sourceZoneIds = [
    ...new Set(
      path.rawMaterials
        .filter((material) => material.missing > 0)
        .flatMap((material) => material.sourceZoneIds),
    ),
  ];
  const sourceZoneNames = sourceZoneIds
    .sort(
      (a, b) =>
        getZoneDistance(player.currentZoneId, a) -
          getZoneDistance(player.currentZoneId, b) || a.localeCompare(b),
    )
    .slice(0, BANNER_ZONE_LIMIT)
    .map((zoneId) => ZONES.find((zone) => zone.id === zoneId)?.name ?? zoneId);

  return {
    kind,
    recipeId,
    outputItemId: recipe.outputItemId,
    name: getItem(recipe.outputItemId).name,
    completed: path.targetComplete,
    rawReady: path.rawReady,
    finalCraftable: path.finalCraftable,
    nextStepName: path.nextStep?.name ?? null,
    gaps,
    sourceZoneNames,
  };
}

/**
 * 中栏常驻目标条（Phase 4D-1 改进 C）。
 *
 * 为什么要提权：武器主要靠合成拿，但这条认知过去只活在右侧规划抽屉的
 * 「合成」tab 里——玩家不主动切 tab 就完全感知不到自己正在做什么、还差什么。
 * 现在把它抬到中栏主视线的常驻一行，玩家不需要任何操作就能看见进度。
 *
 * 优先级：玩家手动设的目标 > 系统建议。手动目标永远优先，
 * 与 `getCraftGoalSuggestion` 内部「有手动目标就不给建议」的约定一致。
 */
export function craftGoalBanner(
  state: GameState,
  player: Combatant,
): CraftGoalBanner | null {
  if (state.craftGoalRecipeId) {
    return bannerFromPath(
      'goal',
      state.craftGoalRecipeId,
      state,
      player,
    );
  }
  const suggestion = getCraftGoalSuggestion(state, player);
  if (!suggestion) return null;
  return bannerFromPath('suggestion', suggestion.recipeId, state, player);
}

/** 玩家自己的最近一次合成，用于复用 4B-3 的原地结果卡形态。 */
export interface CraftProgressFeedback {
  eventId: string;
  outputItemId: string;
  message: string;
}

export function latestPlayerCraftFeedback(
  state: GameState,
  player: Combatant,
): CraftProgressFeedback | null {
  const event = [...state.events]
    .reverse()
    .find((candidate) => candidate.type === 'ITEM_CRAFTED' && candidate.actorId === player.id);
  if (!event || typeof event.metadata.outputItemId !== 'string') return null;
  return {
    eventId: event.id,
    outputItemId: event.metadata.outputItemId,
    message: event.message,
  };
}
