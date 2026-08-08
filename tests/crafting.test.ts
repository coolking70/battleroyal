import { describe, expect, it } from 'vitest';
import { craftStaminaCost, listRecipes, performCraft } from '../src/core/crafting';
import { countItem } from '../src/core/inventory';
import { executeCommand } from '../src/core/gameEngine';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { clearInventory, give, newGame, player } from './helpers';

describe('合成', () => {
  it('材料齐全时可以合成，并正确扣除材料、生成成品', () => {
    const state = newGame();
    const p = player(state);
    clearInventory(p);
    give(state, p, 'wood');
    give(state, p, 'stone');

    const res = performCraft(state, p, 'r_stick');
    expect(res.ok).toBe(true);
    expect(countItem(p, 'wood')).toBe(0);
    expect(countItem(p, 'stone')).toBe(0);
    expect(countItem(p, 'stick')).toBe(1);
  });

  it('材料不足时不能合成，且不消耗任何东西', () => {
    const state = newGame();
    const p = player(state);
    clearInventory(p);
    give(state, p, 'wood');
    const staminaBefore = p.stamina;

    const res = performCraft(state, p, 'r_stick');
    expect(res.ok).toBe(false);
    expect(res.message).toContain('材料不足');
    expect(countItem(p, 'wood')).toBe(1);
    expect(p.stamina).toBe(staminaBefore);
  });

  it('合成消耗 2 点体力，工程师只消耗 1 点', () => {
    const normal = newGame('BR-CRAFT', 'scout');
    const np = player(normal);
    clearInventory(np);
    give(normal, np, 'wood');
    give(normal, np, 'stone');
    const nBefore = np.stamina;
    performCraft(normal, np, 'r_stick');
    expect(nBefore - np.stamina).toBe(GAME_CONFIG.craftStaminaCost);

    const eng = newGame('BR-CRAFT', 'engineer');
    const ep = player(eng);
    clearInventory(ep);
    give(eng, ep, 'wood');
    give(eng, ep, 'stone');
    expect(craftStaminaCost(ep)).toBe(GAME_CONFIG.craftStaminaCostEngineer);
    const eBefore = ep.stamina;
    performCraft(eng, ep, 'r_stick');
    expect(eBefore - ep.stamina).toBe(GAME_CONFIG.craftStaminaCostEngineer);
  });

  it('体力不足时不能合成', () => {
    const state = newGame();
    const p = player(state);
    clearInventory(p);
    give(state, p, 'wood');
    give(state, p, 'stone');
    p.stamina = 0;

    const res = performCraft(state, p, 'r_stick');
    expect(res.ok).toBe(false);
    expect(res.message).toContain('体力不足');
  });

  it('背包塞满不可堆叠物品时不能合成', () => {
    const state = newGame();
    const p = player(state);
    clearInventory(p);
    // 8 格全部塞入不可堆叠的武器，材料放不下 -> 也就无法合成
    for (let i = 0; i < GAME_CONFIG.inventorySlots; i++) {
      give(state, p, 'stick');
    }
    const res = performCraft(state, p, 'r_stick');
    expect(res.ok).toBe(false);
  });

  it('材料被消耗后腾出的空间可以用来放成品', () => {
    const state = newGame();
    const p = player(state);
    clearInventory(p);
    give(state, p, 'wood');
    give(state, p, 'stone');
    // 剩余 6 格全部占满
    for (let i = 0; i < GAME_CONFIG.inventorySlots - 2; i++) {
      give(state, p, 'stick');
    }
    expect(p.inventory.length).toBe(GAME_CONFIG.inventorySlots);

    const res = performCraft(state, p, 'r_stick');
    expect(res.ok).toBe(true);
    expect(countItem(p, 'stick')).toBe(GAME_CONFIG.inventorySlots - 1);
  });

  it('配方列表能标出缺少的材料', () => {
    const state = newGame();
    const p = player(state);
    clearInventory(p);
    give(state, p, 'wood');

    const view = listRecipes(state, p).find((v) => v.recipe.id === 'r_stick')!;
    expect(view.craftable).toBe(false);
    expect(view.blockedReason).toBe('材料不足');
    expect(view.missing).toEqual([{ itemId: 'stone', count: 1 }]);
  });

  it('通过命令合成会推进时间并写入事件', () => {
    const state = newGame();
    const p = player(state);
    clearInventory(p);
    give(state, p, 'wood');
    give(state, p, 'stone');

    const res = executeCommand(state, { type: 'CRAFT', recipeId: 'r_stick' });
    expect(res.ok).toBe(true);
    expect(res.state.time).toBe(state.time + 1);
    expect(res.state.events.some((e) => e.type === 'ITEM_CRAFTED')).toBe(true);
  });
});
