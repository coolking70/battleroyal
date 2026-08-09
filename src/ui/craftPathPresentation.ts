import type { Combatant, GameState, Recipe } from '../core/types';
import { listRecipes } from '../core/crafting';
import { getZoneDistance } from '../core/craftGuide';
import { weaponAttackOf } from '../core/inventory';
import { getItem } from '../data/items';
import { RECIPES, recipeVisibility, tryGetRecipe } from '../data/recipes';
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

export type CraftStepStatus = 'complete' | 'ready' | 'blocked';

/** 合成目标依赖树中的可制作节点，状态只来自玩家自身物品与权威 RecipeView。 */
export interface CraftTreeStep {
  recipeId: string;
  outputItemId: string;
  name: string;
  depth: number;
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
    const child = OUTPUT_RECIPE_MAP.get(itemId);
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

function ownedCount(player: Combatant, itemId: string): number {
  return [...player.inventory, ...player.equipment]
    .filter((stack) => stack.itemId === itemId)
    .reduce((sum, stack) => sum + stack.count, 0);
}

function hasCraftedOutput(state: GameState, player: Combatant, itemId: string): boolean {
  return state.events.some(
    (event) =>
      event.type === 'ITEM_CRAFTED' &&
      event.actorId === player.id &&
      event.metadata.outputItemId === itemId,
  );
}

function buildCraftTreeSteps(
  recipe: Recipe,
  state: GameState,
  player: Combatant,
  seen = new Set<string>(),
): CraftTreeStep[] {
  if (seen.has(recipe.id)) return [];
  const nextSeen = new Set(seen).add(recipe.id);
  const children = recipe.ingredients.flatMap((ingredient) => {
    const child = OUTPUT_RECIPE_MAP.get(ingredient.itemId);
    return child ? buildCraftTreeSteps(child, state, player, nextSeen) : [];
  });
  const view = listRecipes(state, player).find((candidate) => candidate.recipe.id === recipe.id);
  const output = getItem(recipe.outputItemId);
  // 中间部件可能已经被下一步消耗；玩家自己的合成事件仍是合法的进度证据。
  const complete =
    ownedCount(player, recipe.outputItemId) >= recipe.outputCount ||
    hasCraftedOutput(state, player, recipe.outputItemId);
  const status: CraftStepStatus = complete
    ? 'complete'
    : view?.craftable
      ? 'ready'
      : 'blocked';
  return [
    ...children,
    {
      recipeId: recipe.id,
      outputItemId: recipe.outputItemId,
      name: output.name,
      depth: recipeDepth(recipe),
      status,
    },
  ];
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

  const steps = buildCraftTreeSteps(target, state, player);
  const nextStep = steps.find((step) => step.status !== 'complete') ?? null;

  return {
    depth: recipeDepth(target),
    rawMaterials: [...raw.values()],
    intermediateSteps: [...intermediate.values()].sort((a, b) => b.depth - a.depth || a.recipeId.localeCompare(b.recipeId)),
    steps,
    nextStep,
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
        : `攻击 +${attack} · 材料与步骤已齐，可直接合成`,
    } satisfies CraftGoalSuggestion;
  }).filter((candidate): candidate is CraftGoalSuggestion => candidate !== null);

  candidates.sort((a, b) =>
    b.score - a.score || a.recipeId.localeCompare(b.recipeId),
  );
  return candidates[0] ?? null;
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
