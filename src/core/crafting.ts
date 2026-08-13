import { GAME_CONFIG } from '../data/gameConfig';
import { getItem } from '../data/items';
import { RECIPES, tryGetRecipe } from '../data/recipes';
import { PHASE4N_RECIPES } from '../data/phase4nRecipes';
import { canPayActionCost, getActionStaminaCost, payActionCost } from './actionCosts';
import { pushEvent } from './events';
import {
  addItem,
  canAccept,
  consumeIngredients,
  countItem,
  createStack,
  hasIngredients,
  missingIngredients,
} from './inventory';
import { consumeFieldCraftCharge, hasFieldCraftCharge } from './skills';
import { craftExperienceFor, gainCostedActionExperience } from './progression';
import type { Combatant, GameState, Recipe, RecipeIngredient } from './types';

const WILD_RECIPE_IDS = new Set(PHASE4N_RECIPES.map((recipe) => recipe.id));

export interface RecipeView {
  recipe: Recipe;
  craftable: boolean;
  missing: RecipeIngredient[];
  staminaCost: number;
  /** 不可合成时的原因，用于界面提示 */
  blockedReason: string | null;
}

/**
 * 工程师被动：合成只消耗 1 点体力。
 * 实际数值统一由 `actionCosts` 提供，这里只做转发，避免两套折扣逻辑分叉。
 */
export function craftStaminaCost(actor: Combatant): number {
  return actor.passiveId === 'tinkerer'
    ? GAME_CONFIG.craftStaminaCostEngineer
    : GAME_CONFIG.craftStaminaCost;
}

/**
 * 合成后是否有空间放成品。
 * 材料会先被消耗，所以只要「消耗后腾出的格子数 + 现有空格」足够即可。
 */
export function hasRoomForOutput(actor: Combatant, recipe: Recipe): boolean {
  if (!hasIngredients(actor, recipe.ingredients)) return false;
  const simulated = {
    ...actor,
    inventory: structuredClone(actor.inventory),
  } as Combatant;
  if (!consumeIngredients(simulated, recipe.ingredients)) return false;
  const output = getItem(recipe.outputItemId);
  return canAccept(simulated, {
    uid: 'craft-preview',
    itemId: recipe.outputItemId,
    count: recipe.outputCount,
    ...(output.category === 'weapon' && output.durability !== undefined
      ? { durability: output.durability }
      : {}),
  });
}

/** 生成给界面用的配方列表（可合成 / 缺什么 / 消耗多少） */
export function listRecipes(state: GameState, actor: Combatant): RecipeView[] {
  const cost = getActionStaminaCost(actor, 'CRAFT');
  return RECIPES.map((recipe) => {
    const missing = missingIngredients(actor, recipe.ingredients);
    let blockedReason: string | null = null;
    if (missing.length > 0) {
      blockedReason = '材料不足';
    } else if (actor.stamina < cost) {
      blockedReason = '体力不足';
    } else if (!hasRoomForOutput(actor, recipe)) {
      blockedReason = '背包没有空间';
    } else if (state.status !== 'playing') {
      blockedReason = '对局已结束';
    }
    return {
      recipe,
      craftable: blockedReason === null,
      missing,
      staminaCost: cost,
      blockedReason,
    };
  });
}

export interface CraftResult {
  ok: boolean;
  message: string;
  outputItemId: string | null;
}

/** 执行合成（玩家与 NPC 共用） */
export function performCraft(
  state: GameState,
  actor: Combatant,
  recipeId: string,
): CraftResult {
  if (state.status !== 'playing') {
    return { ok: false, message: '对局已经结束。', outputItemId: null };
  }
  if (!actor.alive) {
    return { ok: false, message: '已经死亡的角色无法合成。', outputItemId: null };
  }

  // 未知配方只返回失败，绝不抛异常（存档被改坏、界面传错 id 都走这里）
  const recipe = tryGetRecipe(recipeId);
  if (!recipe) {
    return { ok: false, message: '没有这个配方。', outputItemId: null };
  }

  const check = canPayActionCost(actor, 'CRAFT');
  const cost = check.cost;

  if (!hasIngredients(actor, recipe.ingredients)) {
    const missing = missingIngredients(actor, recipe.ingredients)
      .map((m) => `${getItem(m.itemId).name}×${m.count}`)
      .join('、');
    return { ok: false, message: `材料不足，还缺 ${missing}。`, outputItemId: null };
  }
  if (!check.ok) {
    return { ok: false, message: check.reason ?? '体力不足。', outputItemId: null };
  }
  if (!hasRoomForOutput(actor, recipe)) {
    return { ok: false, message: '背包没有空间存放成品。', outputItemId: null };
  }

  const inventoryBefore = structuredClone(actor.inventory);
  const staminaBefore = actor.stamina;
  const uidBefore = state.uidSeq;
  if (!consumeIngredients(actor, recipe.ingredients)) {
    return { ok: false, message: '材料状态发生变化，合成已回滚。', outputItemId: null };
  }
  // Phase 3A-1 统计：本次合成是否免体力（现场加工）；
  // 「省下的体力」= 无充能时应付的基础成本（充能生效时闸门成本为 0）
  const freeCraft = hasFieldCraftCharge(actor);
  const staminaSaved = freeCraft ? craftStaminaCost(actor) : 0;
  payActionCost(actor, 'CRAFT');
  const stack = createStack(state, recipe.outputItemId, recipe.outputCount);
  const added = addItem(actor, stack);
  if (!added.ok) {
    // 事务红线：输出无法完整放入时，材料、体力、uid 序列和背包全部回滚。
    actor.inventory = inventoryBefore;
    actor.stamina = staminaBefore;
    state.uidSeq = uidBefore;
    return { ok: false, message: '背包没有空间存放成品，合成已回滚。', outputItemId: null };
  }

  // Phase 3A-1：现场加工的充能只在输出完整进入背包后扣除。
  // 这使材料、体力、uid 序列和免费次数共同遵守同一条原子事务边界。
  consumeFieldCraftCharge(state, actor);

  actor.stats.crafts += 1;
  state.stats.crafts += 1;
  if (WILD_RECIPE_IDS.has(recipe.id)) state.stats.wildCrafts += 1;
  gainCostedActionExperience(actor, craftExperienceFor(recipe.outputItemId), cost);

  const outName = getItem(recipe.outputItemId).name;
  pushEvent(state, {
    type: 'ITEM_CRAFTED',
    actorId: actor.id,
    zoneId: actor.currentZoneId,
    message: `${actor.name} 合成了 ${outName}（消耗 ${cost} 点体力）。`,
    metadata: {
      recipeId: recipe.id,
      outputItemId: recipe.outputItemId,
      cost,
      freeCraft,
      staminaSaved,
    },
  });

  return { ok: true, message: `合成成功：${outName}`, outputItemId: recipe.outputItemId };
}

/**
 * NPC 用：找出当前能合成且「明显更强」的配方。
 * 只考虑武器与防具升级，避免 NPC 无意义地反复合成。
 */
export function findUpgradeRecipe(
  actor: Combatant,
  currentWeaponAttack: number,
  currentArmorDefense: number,
): Recipe | null {
  const cost = craftStaminaCost(actor);
  if (actor.stamina < cost) return null;

  let best: { recipe: Recipe; gain: number } | null = null;
  for (const recipe of RECIPES) {
    if (!hasIngredients(actor, recipe.ingredients)) continue;
    if (!hasRoomForOutput(actor, recipe)) continue;
    const out = getItem(recipe.outputItemId);
    let gain = 0;
    if (out.equipmentSlot === 'weapon') {
      gain = (out.attack ?? 0) - currentWeaponAttack;
    } else if (out.category === 'armor') {
      gain = (out.defense ?? 0) - currentArmorDefense;
    } else if (out.craftTier === 'component' && out.attack !== undefined) {
      // Legacy 4C keeps one weapon-shaped intermediate for the historical
      // NPC step test, but it is not equipable and therefore remains a
      // component rather than a final weapon.
      gain = out.attack - currentWeaponAttack;
    } else {
      continue;
    }
    if (gain <= 0) continue;
    if (!best || gain > best.gain) best = { recipe, gain };
  }
  return best ? best.recipe : null;
}

/** NPC 用：缺治疗品时能否现做一个 */
export function findHealRecipe(actor: Combatant): Recipe | null {
  const cost = craftStaminaCost(actor);
  if (actor.stamina < cost) return null;
  for (const recipe of RECIPES) {
    const out = getItem(recipe.outputItemId);
    if (out.category !== 'consumable') continue;
    if ((out.healHp ?? 0) <= 0) continue;
    if (!hasIngredients(actor, recipe.ingredients)) continue;
    if (!hasRoomForOutput(actor, recipe)) continue;
    return recipe;
  }
  return null;
}

/** 收集型 NPC 用：判断某材料是否还差一点就能凑成配方 */
export function isUsefulMaterial(actor: Combatant, itemId: string): boolean {
  return RECIPES.some((r) => {
    if (!r.ingredients.some((i) => i.itemId === itemId)) return false;
    const missing = r.ingredients.filter(
      (i) => countItem(actor, i.itemId) < i.count,
    );
    return missing.length <= 1;
  });
}
