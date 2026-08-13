/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { performCraft, listRecipes } from '../src/core/crafting';
import { addItem, createStack } from '../src/core/inventory';
import { createGame, getPlayer } from '../src/core/gameState';
import { CraftPanel } from '../src/ui/components/CraftPanel';
import { Inventory } from '../src/ui/components/Inventory';
import { SearchResultFeedback } from '../src/ui/components/SearchResultFeedback';
import { bestInventoryEquipment, equipmentHandoffFor } from '../src/ui/equipmentPresentation';
import { clearInventory, give } from './helpers';
import { runAutoGame } from '../tools/autoPlayer';

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

describe('Phase 4C-5 玩家装备交接闭环', () => {
  it('搜索得到玩家自己的武器后，结果卡提供正式 EQUIP 回调', () => {
    const state = createGame({ seed: 'PHASE4C5-SEARCH-EQUIP', playerCharacterId: 'scout' });
    const player = getPlayer(state);
    clearInventory(player);
    const weapon = createStack(state, 'iron_pipe');
    addItem(player, weapon);
    const received: string[] = [];

    render(
      <SearchResultFeedback
        player={player}
        onEquip={(uid) => received.push(uid)}
        feedback={{ kind: 'item', itemId: 'iron_pipe', pending: false, eventId: 'e-search', modifiers: [] }}
      />,
    );

    expect(container.querySelector('[data-search-equip-output]')).not.toBeNull();
    act(() => (container.querySelector('[data-search-equip-output]') as HTMLButtonElement).click());
    expect(received).toEqual([weapon.uid]);
    expect(player.equippedWeaponId).toBeNull();
  });

  it('合成反馈提供立即装备，但不直接改变玩家装备状态', () => {
    const state = createGame({ seed: 'PHASE4C5-CRAFT-EQUIP', playerCharacterId: 'scout' });
    const player = getPlayer(state);
    clearInventory(player);
    give(state, player, 'wood');
    give(state, player, 'stone');
    const result = performCraft(state, player, 'r_stick');
    expect(result.ok).toBe(true);
    const event = state.events.at(-1)!;
    const output = player.inventory.find((stack) => stack.itemId === 'stick')!;
    const received: string[] = [];

    render(
      <CraftPanel
        views={listRecipes(state, player)}
        state={state}
        player={player}
        disabled={false}
        goalRecipeId={null}
        goalCompleted={false}
        recommendations={[]}
        onSetGoal={() => undefined}
        onCraft={() => undefined}
        latestCraftFeedback={{
          eventId: event.id,
          outputItemId: 'stick',
          message: event.message,
        }}
        onEquip={(uid) => received.push(uid)}
      />,
    );

    expect(container.querySelector('[data-craft-equip-output]')).not.toBeNull();
    act(() => (container.querySelector('[data-craft-equip-output]') as HTMLButtonElement).click());
    expect(received).toEqual([output.uid]);
    expect(player.equippedWeaponId).toBeNull();
  });

  it('装备候选按槽位数值选择最高者，并保持信息只来自玩家自身', () => {
    const state = createGame({ seed: 'PHASE4C5-CANDIDATE', playerCharacterId: 'scout' });
    const player = getPlayer(state);
    clearInventory(player);
    give(state, player, 'stick');
    give(state, player, 'iron_pipe');
    const candidate = bestInventoryEquipment(player, 'weapon');

    expect(candidate?.itemId).toBe('iron_pipe');
    expect(equipmentHandoffFor(player, 'iron_pipe')?.status).toBe('ready');

    render(
      <Inventory
        player={player}
        disabled={false}
        onUse={() => undefined}
        onEquip={() => undefined}
        onUnequip={() => undefined}
        onDrop={() => undefined}
      />,
    );
    expect(container.querySelector('[data-candidate-item-id="iron_pipe"]')).not.toBeNull();
    expect(container.textContent).not.toContain(state.characters.n1?.name ?? 'NPC');
  });

  it('代表玩家闭环通过正式命令通道采纳目标并完成装备交接', () => {
    const results = [
      {
        seed: 'PHASE4N-ROUTE-hunter-2',
        characterId: 'hunter',
        policy: 'collector' as const,
        representativeRecipeId: 'r_hunting_armor',
      },
      ...['A', 'B', 'C'].map((suffix) => ({
        seed: `PHASE4C5-${suffix}`,
        characterId: 'scout',
        policy: 'collector' as const,
      })),
    ].map((config) =>
      runAutoGame({ ...config, representativeBuildLoop: true }),
    );

    expect(results.every((result) => result.trustworthy)).toBe(true);
    expect(results.every((result) => (result.commandCounts.SET_CRAFT_GOAL ?? 0) > 0)).toBe(true);
    expect(results.every((result) => (result.commandCounts.SEARCH ?? 0) > 0)).toBe(true);
    expect(results.some((result) => (result.commandCounts.CRAFT ?? 0) > 0)).toBe(true);
    expect(results.some((result) => (result.commandCounts.EQUIP ?? 0) > 0)).toBe(true);
  });
});
