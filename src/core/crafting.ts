import { GAME_CONFIG } from '../data/gameConfig';
import { getItem } from '../data/items';
import { RECIPES, tryGetRecipe } from '../data/recipes';
import { canPayActionCost, payActionCost } from './actionCosts';
import { pushEvent } from './events';
import {
  addItem,
  consumeIngredients,
  countItem,
  createStack,
  hasIngredients,
  missingIngredients,
} from './inventory';
import { consumeFieldCraftCharge, hasFieldCraftCharge } from './skills';
import type { Combatant, GameState, Recipe, RecipeIngredient } from './types';

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
  const outDef = getItem(recipe.outputItemId);

  // 模拟消耗材料后会空出多少格
  let freedSlots = 0;
  for (const ing of recipe.ingredients) {
    let need = ing.count;
    for (const s of actor.inventory) {
      if (s.itemId !== ing.itemId || need <= 0) continue;
      const take = Math.min(s.count, need);
      need -= take;
      if (take === s.count) freedSlots += 1;
    }
  }

  const freeAfter =
    GAME_CONFIG.inventorySlots - actor.inventory.length + freedSlots;
  if (freeAfter > 0) return true;

  // 没有空格时，成品若能堆叠进已有同类堆也可以
  if (outDef.stackable) {
    const existing = actor.inventory.filter((s) => s.itemId === recipe.outputItemId);
    const room = existing.reduce((sum, s) => sum + (outDef.maxStack - s.count), 0);
    // 注意：作为材料被消耗掉的同类堆已在上面计入 freedSlots
    if (room >= recipe.outputCount) return true;
  }
  return false;
}

/** 生成给界面用的配方列表（可合成 / 缺什么 / 消耗多少） */
export function listRecipes(state: GameState, actor: Combatant): RecipeView[] {
  const cost = craftStaminaCost(actor);
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

  consumeIngredients(actor, recipe.ingredients);
  // Phase 3A-1 统计：本次合成是否免体力（现场加工）；
  // 「省下的体力」= 无充能时应付的基础成本（充能生效时闸门成本为 0）
  const freeCraft = hasFieldCraftCharge(actor);
  const staminaSaved = freeCraft ? craftStaminaCost(actor) : 0;
  payActionCost(actor, 'CRAFT');
  // Phase 3A-1：现场加工的充能**只在合成真的成功之后**扣。
  // 前面任何一个 return 都意味着这次合成没做成，白扣充能是纯粹的坑。
  consumeFieldCraftCharge(state, actor);

  const stack = createStack(state, recipe.outputItemId, recipe.outputCount);
  const added = addItem(actor, stack);
  if (!added.ok) {
    // 理论上被 hasRoomForOutput 拦截；真的发生时把成品丢在地上，避免物品凭空消失
    const zone = state.zones[actor.currentZoneId];
    if (zone) zone.groundItems.push(stack);
  }

  actor.stats.crafts += 1;
  state.stats.crafts += 1;

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
    if (out.category === 'weapon') {
      gain = (out.attack ?? 0) - currentWeaponAttack;
    } else if (out.category === 'armor') {
      gain = (out.defense ?? 0) - currentArmorDefense;
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
