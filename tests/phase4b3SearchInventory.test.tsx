/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addItem, createStack, equipItem } from '../src/core/inventory';
import { createGame, getPlayer } from '../src/core/gameState';
import { listRecipes } from '../src/core/crafting';
import { pushEvent } from '../src/core/events';
import type { AssetManifest } from '../src/ui/visualAssets';
import { setAssetManifest } from '../src/ui/visualAssets';
import { Inventory } from '../src/ui/components/Inventory';
import { CraftPanel } from '../src/ui/components/CraftPanel';
import { PendingPickupPanel } from '../src/ui/components/PendingPickupPanel';
import { SearchResultFeedback } from '../src/ui/components/SearchResultFeedback';
import { GameScreen } from '../src/ui/screens/GameScreen';
import { craftGoalBanner } from '../src/ui/craftPathPresentation';
import { latestPlayerSearchFeedback } from '../src/ui/searchPresentation';

let root: Root;
let container: HTMLDivElement;

async function loadManifest(): Promise<AssetManifest> {
  return JSON.parse(
    await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8'),
  ) as AssetManifest;
}

function render(node: JSX.Element): void {
  act(() => root.render(node));
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  setAssetManifest(await loadManifest());
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setAssetManifest(null);
});

describe('Phase 4B-3 search, loot, inventory and craft presentation', () => {
  it('renders item, empty and encounter search outcomes as distinct non-blocking feedback', () => {
    const state = createGame({ seed: 'PHASE4B3-SEARCH', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    pushEvent(state, {
      type: 'ITEM_FOUND',
      actorId: player.id,
      zoneId: player.currentZoneId,
      message: '你找到了绷带。',
      metadata: { itemId: 'bandage' },
    });
    render(<SearchResultFeedback feedback={{ kind: 'item', itemId: 'bandage', pending: false, eventId: 'e-item', modifiers: [] }} />);
    expect(container.querySelector('[data-search-result="item"]')).not.toBeNull();
    expect(container.querySelector('.search-result-item-visual')?.getAttribute('src')).toBe('/assets/items/bandage/icon.png');

    render(<SearchResultFeedback feedback={{ kind: 'nothing', exhausted: true, eventId: 'e-empty', modifiers: [] }} />);
    expect(container.querySelector('[data-search-result="nothing"]')?.textContent).toContain('区域已搜空');

    pushEvent(state, {
      type: 'SEARCH_STARTED',
      actorId: player.id,
      zoneId: player.currentZoneId,
      message: '你一无所获。',
      metadata: { empty: true, exhausted: false },
    });
    pushEvent(state, {
      type: 'ZONE_DAMAGE',
      actorId: player.id,
      zoneId: player.currentZoneId,
      message: '环境伤害。',
      metadata: { amount: 1 },
    });
    expect(latestPlayerSearchFeedback(state)?.kind).toBe('nothing');

    pushEvent(state, {
      type: 'ENCOUNTER_STARTED',
      actorId: player.id,
      targetId: 'npc-1',
      zoneId: player.currentZoneId,
      message: '遭遇敌人。',
      metadata: {},
    });
    expect(latestPlayerSearchFeedback(state)?.kind).toBe('encounter');

    const equipState = createGame({ seed: 'PHASE4B3-SEARCH-EQUIP-FEEDBACK', playerCharacterId: 'scout', playerName: '测试者' });
    const equipPlayer = getPlayer(equipState);
    const pipe = createStack(equipState, 'iron_pipe');
    addItem(equipPlayer, pipe);
    pushEvent(equipState, {
      type: 'ITEM_FOUND',
      actorId: equipPlayer.id,
      zoneId: equipPlayer.currentZoneId,
      message: '你找到了铁管。',
      metadata: { itemId: 'iron_pipe' },
    });
    pushEvent(equipState, {
      type: 'ITEM_PICKED',
      actorId: equipPlayer.id,
      zoneId: equipPlayer.currentZoneId,
      message: '你收下了铁管。',
      metadata: { itemId: 'iron_pipe' },
    });
    pushEvent(equipState, {
      type: 'ITEM_EQUIPPED',
      actorId: equipPlayer.id,
      zoneId: equipPlayer.currentZoneId,
      message: '你装备了铁管。',
      metadata: { itemId: 'iron_pipe', slot: 'weapon' },
    });
    expect(latestPlayerSearchFeedback(equipState)?.kind).toBe('item');
  });

  it('uses official item art in inventory rows and equipped slots', () => {
    const state = createGame({ seed: 'PHASE4B3-INVENTORY', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    const weapon = createStack(state, 'iron_pipe');
    addItem(player, weapon);
    expect(equipItem(player, weapon.uid).ok).toBe(true);
    addItem(player, createStack(state, 'bandage'));

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

    expect(container.querySelector('.equip-item-visual')?.getAttribute('src')).toBe('/assets/items/iron_pipe/icon.png');
    expect(container.querySelector('[data-item-id="bandage"] .item-visual')?.getAttribute('src')).toBe('/assets/items/bandage/icon.png');
    expect(container.querySelector('.equip-slot')?.textContent).toContain('攻击 +8');
  });

  it('shows craft output/material art and an explicit missing-material state', () => {
    const state = createGame({ seed: 'PHASE4B3-CRAFT', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    const views = listRecipes(state, player);
    render(
      <CraftPanel
        views={views}
        state={state}
        player={player}
        disabled={false}
        goalRecipeId={views[0]?.recipe.id ?? null}
        goalCompleted={false}
        recommendations={[]}
        onSetGoal={() => undefined}
        onCraft={() => undefined}
      />,
    );

    expect(container.querySelectorAll('.craft-output-visual').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.craft-material-visual').length).toBeGreaterThan(0);
    expect(container.querySelector('.recipe-state-blocked')?.textContent).toContain('材料不足');
    expect(container.querySelector('[data-missing-materials="true"]')?.textContent).toContain('缺少：');
  });

  it('uses item art in pending pickup and ground-drop contexts', () => {
    const state = createGame({ seed: 'PHASE4B3-PICKUP', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    const replacement = createStack(state, 'wood');
    addItem(player, replacement);
    state.pendingPickup = { stack: createStack(state, 'bandage'), source: 'search', zoneId: player.currentZoneId };
    render(
      <PendingPickupPanel
        pending={state.pendingPickup}
        player={player}
        onResolve={() => undefined}
      />,
    );
    expect(container.querySelector('.pending-item-visual')?.getAttribute('src')).toBe('/assets/items/bandage/icon.png');
    expect(container.querySelector('[data-replace-item-id="wood"] .pending-replace-visual')?.getAttribute('src')).toBe('/assets/items/wood/icon.png');

    state.pendingPickup = null;
    state.zones[player.currentZoneId]!.groundItems.push(createStack(state, 'iron'));
    render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />);
    expect(container.querySelector('.ground-item-visual')).not.toBeNull();
    expect(container.querySelector('.ground-item')?.textContent).toContain('铁块');
  });

  it('does not render undiscovered zone loot or other characters’ inventory information', () => {
    const state = createGame({ seed: 'PHASE4B3-BOUNDARY', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    state.zones[player.currentZoneId]!.loot = [
      { itemId: 'glass', count: 1, rarity: 'normal' },
      // 对照物：能量饮料不参与任何配方，因此它一旦出现在中栏，
      // 唯一可能的来源就是 zone.loot 泄露——这条断言不受任何展示层改动干扰。
      { itemId: 'energy_drink', count: 1, rarity: 'rare' },
    ];
    render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />);
    const stage = container.querySelector('.stage');
    expect(stage?.textContent ?? '').not.toContain('能量饮料');

    // Phase 4D-1 改进 C 之后，中栏常驻目标条会以「还缺玻璃 ×N」的形式
    // 提到玻璃。这不是泄露：数据来自静态配方表 + 玩家自己的背包 +
    // 区域的**公开**物资池（图鉴里本来就能查），与 zone.loot 的实际剩余无关。
    // 为了让本用例继续精确守住 zone.loot 这条边界，先核对目标条里出现的
    // 材料确实来自配方缺口，再把目标条摘掉、对中栏其余部分重新断言一次。
    const goalBar = stage?.querySelector('.craft-goal-bar') ?? null;
    if (goalBar?.textContent?.includes('玻璃')) {
      const banner = craftGoalBanner(state, player);
      expect(banner?.gaps.some((gap) => gap.itemId === 'glass')).toBe(true);
    }
    goalBar?.remove();
    expect(stage?.textContent ?? '').not.toContain('玻璃');

    expect(container.textContent).not.toContain('其他角色的背包');
    expect(container.querySelector('[data-search-result]')).toBeNull();
  });
});
