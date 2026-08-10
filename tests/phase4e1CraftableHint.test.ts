/**
 * Phase 4E-1 改进 B：检测"新获得物品使某配方从不可做变为可做"。
 *
 * 直接测纯函数 `detectCraftableHint`：
 * - 基线（prevCraftableIds 为 null）不触发提示；
 * - 有配方变可做且有物品获得 → 提示；
 * - 优先提示"当前合成目标"相关配方；
 * - 无目标时取新可做配方中输出价值最高的一条；
 * - 仅体力恢复（无物品获得）→ 即使配方变可做也不提示。
 */

import { describe, expect, it } from 'vitest';
import { listRecipes } from '../src/core/crafting';
import { getItem } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { clearInventory, give, newGame, player } from './helpers';
import { detectCraftableHint } from '../src/ui/craftableHint';

function giveIngredients(state: ReturnType<typeof newGame>, p: ReturnType<typeof player>, recipeId: string): void {
  const recipe = RECIPES.find((r) => r.id === recipeId)!;
  for (const ing of recipe.ingredients) give(state, p, ing.itemId, ing.count);
}

describe('Phase 4E-1 改进 B：可合成提示检测', () => {
  it('基线（首次调用）不触发提示', () => {
    const state = newGame('E1-HINT-BASE');
    const p = player(state);
    clearInventory(p);
    const views = listRecipes(state, p);
    const res = detectCraftableHint({
      recipeViews: views,
      inventory: p.inventory,
      prevCraftableIds: null,
      prevInventory: null,
      goalRecipeId: null,
    });
    expect(res.recipeId).toBeNull();
  });

  it('配方变可做且有物品获得 → 提示该配方（目标优先级最高）', () => {
    const state = newGame('E1-HINT-GOAL');
    const p = player(state);
    clearInventory(p);
    const views0 = listRecipes(state, p);
    const prevCraftable = new Set(views0.filter((v) => v.craftable).map((v) => v.recipe.id));

    const R = RECIPES[0]!;
    giveIngredients(state, p, R.id);
    const views1 = listRecipes(state, p);

    const res = detectCraftableHint({
      recipeViews: views1,
      inventory: p.inventory,
      prevCraftableIds: prevCraftable,
      prevInventory: {},
      goalRecipeId: R.id,
    });
    expect(res.recipeId).toBe(R.id);
  });

  it('无目标时取新可做配方中输出价值最高的一条', () => {
    const state = newGame('E1-HINT-VALUE');
    const p = player(state);
    clearInventory(p);
    const views0 = listRecipes(state, p);
    const prevCraftable = new Set(views0.filter((v) => v.craftable).map((v) => v.recipe.id));

    const R1 = RECIPES[0]!;
    const R2 = RECIPES[1]!;
    giveIngredients(state, p, R1.id);
    giveIngredients(state, p, R2.id);
    const views1 = listRecipes(state, p);

    const res = detectCraftableHint({
      recipeViews: views1,
      inventory: p.inventory,
      prevCraftableIds: prevCraftable,
      prevInventory: {},
      goalRecipeId: null,
    });

    const newlyCraftable = views1
      .filter((v) => v.craftable && !prevCraftable.has(v.recipe.id))
      .map((v) => v.recipe.id);
    let best = -1;
    let expected: string | null = null;
    for (const id of newlyCraftable) {
      const view = views1.find((v) => v.recipe.id === id)!;
      const value = getItem(view.recipe.outputItemId).value;
      if (value > best) {
        best = value;
        expected = id;
      }
    }
    expect(res.recipeId).toBe(expected);
  });

  it('仅体力恢复（无物品获得）不触发提示，即使配方变可做', () => {
    const state = newGame('E1-HINT-NOGAIN');
    const p = player(state);
    clearInventory(p);
    const R = RECIPES[0]!;
    giveIngredients(state, p, R.id);
    const views1 = listRecipes(state, p);
    // 把"上一帧"设成"当前可合成集合 + 当前背包"：即没有新获得物品
    const prevCraftable = new Set(views1.filter((v) => v.craftable).map((v) => v.recipe.id));
    const prevInv: Record<string, number> = {};
    for (const s of p.inventory) prevInv[s.itemId] = (prevInv[s.itemId] ?? 0) + s.count;

    const res = detectCraftableHint({
      recipeViews: views1,
      inventory: p.inventory,
      prevCraftableIds: prevCraftable,
      prevInventory: prevInv,
      goalRecipeId: null,
    });
    expect(res.recipeId).toBeNull();
  });
});
