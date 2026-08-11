/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { performCraft } from '../src/core/crafting';
import { equipItem } from '../src/core/inventory';
import { getPlayer } from '../src/core/gameState';
import { GameScreen } from '../src/ui/screens/GameScreen';
import {
  equipmentComparisonText,
  equipmentHandoffFor,
  shouldPromptCraftEquipment,
} from '../src/ui/equipmentPresentation';
import { clearInventory, give, newGame, player } from './helpers';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderCrafted(
  recipeId: string,
  ingredients: string[],
  equippedItemId?: string,
): { state: ReturnType<typeof newGame>; dispatch: ReturnType<typeof vi.fn> } {
  const state = newGame(`PHASE4E2-CRAFT-${recipeId}-${equippedItemId ?? 'empty'}`);
  const p = player(state);
  clearInventory(p);
  if (equippedItemId) {
    give(state, p, equippedItemId);
    const equipped = p.inventory[0];
    if (!equipped || !equipItem(p, equipped.uid).ok) throw new Error('测试装备失败');
  }
  for (const itemId of ingredients) give(state, p, itemId);
  const crafted = performCraft(state, p, recipeId);
  if (!crafted.ok) throw new Error(crafted.message);

  const dispatch = vi.fn();
  act(() => {
    root.render(
      <GameScreen
        state={state}
        player={getPlayer(state)}
        dispatch={dispatch}
        onQuit={() => undefined}
      />,
    );
  });
  return { state, dispatch };
}

describe('Phase 4E-2：合成装备提示', () => {
  it('空武器槽触发，并展示“当前空槽 · 攻击 +数值”', () => {
    const { state } = renderCrafted('r_stick', ['wood', 'stone']);
    const handoff = equipmentHandoffFor(player(state), 'stick');

    expect(handoff?.status).toBe('ready');
    expect(handoff ? equipmentComparisonText(handoff) : '').toBe('当前空槽 · 攻击 +3');
    expect(container.querySelector('[data-craft-equipment-hint="true"]')).not.toBeNull();
    expect(container.querySelector('[data-craft-equipment-comparison="true"]')?.textContent).toBe(
      '当前空槽 · 攻击 +3',
    );
  });

  it('新武器严格更强时触发，并展示攻击数值对比；点击只派发 EQUIP', () => {
    const { state, dispatch } = renderCrafted(
      'r_iron_pipe',
      ['scrap', 'wood'],
      'stick',
    );
    const p = player(state);
    const output = p.inventory.find((stack) => stack.itemId === 'iron_pipe');
    const handoff = equipmentHandoffFor(p, 'iron_pipe');

    expect(handoff?.status).toBe('ready');
    expect(handoff ? equipmentComparisonText(handoff) : '').toBe('攻击 3 → 8');
    expect(container.querySelector('[data-craft-equipment-comparison="true"]')?.textContent).toBe(
      '攻击 3 → 8',
    );

    act(() => {
      (container.querySelector('[data-craft-equipment-hint-equip="true"]') as HTMLButtonElement).click();
    });
    expect(dispatch).toHaveBeenCalledWith({ type: 'EQUIP', uid: output?.uid });
    expect(p.equippedWeaponId).not.toBe(output?.uid);
  });

  it('新物品不更强时不触发提示；护甲空槽仍按 defense 规则触发', () => {
    const weaker = renderCrafted('r_stick', ['wood', 'stone'], 'iron_pipe');
    const weakerHandoff = equipmentHandoffFor(player(weaker.state), 'stick');
    expect(weakerHandoff?.status).toBe('backup');
    expect(shouldPromptCraftEquipment(weakerHandoff)).toBe(false);
    expect(weaker.state.events.at(-1)?.type).toBe('ITEM_CRAFTED');
    expect(container.querySelector('[data-craft-equipment-hint="true"]')).toBeNull();

    const armor = newGame('PHASE4E2-CRAFT-ARMOR');
    const armorPlayer = player(armor);
    clearInventory(armorPlayer);
    give(armor, armorPlayer, 'iron');
    give(armor, armorPlayer, 'cloth');
    const crafted = performCraft(armor, armorPlayer, 'r_simple_armor');
    expect(crafted.ok).toBe(true);
    const armorHandoff = equipmentHandoffFor(armorPlayer, 'simple_armor');
    expect(armorHandoff?.status).toBe('ready');
    expect(armorHandoff ? equipmentComparisonText(armorHandoff) : '').toBe('当前空槽 · 防御 +4');
  });
});
