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
    state.zones[player.currentZoneId]!.loot = [{ itemId: 'glass', count: 1, rarity: 'normal' }];
    render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />);
    const stageText = container.querySelector('.stage')?.textContent ?? '';
    expect(stageText).not.toContain('玻璃');
    expect(container.textContent).not.toContain('其他角色的背包');
    expect(container.querySelector('[data-search-result]')).toBeNull();
  });
});
