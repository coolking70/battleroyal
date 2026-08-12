/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { performCraft } from '../src/core/crafting';
import { createGame, getPlayer } from '../src/core/gameState';
import { addItem, createStack } from '../src/core/inventory';
import { getItem } from '../src/data/items';
import { RECIPE_VISIBILITY, RECIPES, recipeVisibility } from '../src/data/recipes';
import { CraftPanel } from '../src/ui/components/CraftPanel';
import { CraftingCodex } from '../src/ui/components/CraftingCodex';
import {
  craftPathSummary,
  getCraftGoalSuggestion,
} from '../src/ui/craftPathPresentation';
import { listRecipes } from '../src/core/crafting';
import { clearInventory, give } from './helpers';

let root: Root;
let container: HTMLDivElement;

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

function render(node: JSX.Element): void {
  act(() => root.render(node));
}

describe('Phase 4C-2 合成引导与公开图鉴', () => {
  it('自动建议只在没有手动目标时出现，并以当前装备强度为基线', () => {
    const state = createGame({ seed: 'PHASE4C2-SUGGEST', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    clearInventory(player);
    give(state, player, 'wood');
    give(state, player, 'rope');

    const suggestion = getCraftGoalSuggestion(state, player);
    expect(suggestion).not.toBeNull();
    expect(getItem(suggestion!.outputItemId).category).toBe('weapon');
    expect(suggestion!.attack).toBeGreaterThan(0);
    expect(suggestion!.nextStep).not.toBeNull();
    expect(suggestion!.reason).toContain('当前先做');

    state.craftGoalRecipeId = 'r_field_spear';
    expect(getCraftGoalSuggestion(state, player)).toBeNull();
  });

  it('三级目标的子目标会随玩家合成跨回合推进', () => {
    const state = createGame({ seed: 'PHASE4C2-SUBGOAL', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    clearInventory(player);
    give(state, player, 'wood');
    give(state, player, 'stone');
    give(state, player, 'rope');
    give(state, player, 'iron');

    expect(craftPathSummary('r_field_spear', state, player)!.steps.map((step) => step.recipeId)).toEqual([
      'r_stick',
      'r_reinforced_handle',
      'r_field_spear',
    ]);
    expect(craftPathSummary('r_field_spear', state, player)!.nextStep?.recipeId).toBe('r_stick');

    expect(performCraft(state, player, 'r_stick').ok).toBe(true);
    expect(craftPathSummary('r_field_spear', state, player)!.nextStep?.recipeId).toBe('r_reinforced_handle');
    expect(performCraft(state, player, 'r_reinforced_handle').ok).toBe(true);
    expect(craftPathSummary('r_field_spear', state, player)!.nextStep?.recipeId).toBe('r_field_spear');
  });

  it('采纳自动建议只通过父层回调，交由 SET_CRAFT_GOAL 命令通道处理', () => {
    const state = createGame({ seed: 'PHASE4C2-ADOPT', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    const suggestion = getCraftGoalSuggestion(state, player);
    expect(suggestion).not.toBeNull();
    const received: Array<string | null> = [];

    render(
      <CraftPanel
        views={listRecipes(state, player)}
        state={state}
        player={player}
        disabled={false}
        goalRecipeId={null}
        goalCompleted={false}
        recommendations={[]}
        suggestion={suggestion}
        onSetGoal={(recipeId) => received.push(recipeId)}
        onCraft={() => undefined}
      />,
    );

    expect(container.querySelector('[data-craft-auto-suggestion]')).not.toBeNull();
    act(() => (container.querySelector('[data-craft-adopt-suggestion]') as HTMLButtonElement).click());
    expect(received).toEqual([suggestion!.recipeId]);
    expect(state.craftGoalRecipeId).toBeNull();
  });

  it('图鉴展示完整依赖树、默认全可见，并使用新物品的 fallback 视觉', () => {
    const state = createGame({ seed: 'PHASE4C2-CODEX', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    render(
      <CraftingCodex
        state={state}
        player={player}
        disabled={false}
        onSetGoal={() => undefined}
      />,
    );

    expect(Object.keys(RECIPE_VISIBILITY)).toHaveLength(RECIPES.length);
    expect(RECIPES.every((recipe) => recipeVisibility(recipe.id) === 'visible')).toBe(true);
    expect(container.querySelector('[data-craft-codex]')).not.toBeNull();
    expect(container.querySelectorAll('[data-codex-root-id]')).toHaveLength(RECIPES.length);
    expect(container.querySelector('[data-codex-depth="3"]')).not.toBeNull();
    expect(container.querySelector('[data-codex-root-id="r_field_spear"]')?.textContent).toContain('木棍');
    expect(container.querySelector('[data-codex-root-id="r_field_spear"] .craft-codex-visual')?.textContent).toContain('⚔️');
  });

  it('图鉴与引导只使用静态配方资料和玩家状态，不读取隐藏库存或 NPC 物品', () => {
    const state = createGame({ seed: 'PHASE4C2-BOUNDARY', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    const npc = state.characters.n1!;
    clearInventory(npc);
    addItem(npc, createStack(state, 'battery', 5));
    state.zones[player.currentZoneId]!.loot = [{ itemId: 'battery', count: 5, rarity: 'rare' }];

    render(
      <CraftingCodex
        state={state}
        player={player}
        disabled={false}
        onSetGoal={() => undefined}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).not.toContain(npc.name);
    expect(text).not.toContain('电池×5');
    expect(text).not.toContain('zone.loot');
    // 电池作为静态公开配方材料可以出现，但隐藏库存数量不应出现。
    expect(text).toContain('电池');
  });
});
