/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditItemIntegrity } from '../src/core/itemIntegrity';
import { findUpgradeRecipe, performCraft } from '../src/core/crafting';
import { armorDefenseOf, weaponAttackOf } from '../src/core/inventory';
import { createGame, getPlayer } from '../src/core/gameState';
import { getItem, ITEMS } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { ZONES } from '../src/data/zones';
import { CraftPanel } from '../src/ui/components/CraftPanel';
import { craftPathSummary } from '../src/ui/craftPathPresentation';
import { getItemVisual } from '../src/ui/visualAssets';
import { listRecipes } from '../src/core/crafting';
import { clearInventory, give, npcs } from './helpers';

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

describe('Phase 4C-1 合成树与武器获取路径', () => {
  it('注册 29 件物品、17 条配方，并为每个区域保留武器来源', () => {
    expect(ITEMS).toHaveLength(29);
    expect(RECIPES).toHaveLength(17);
    for (const zone of ZONES) {
      expect(
        zone.rarePool.some((itemId) => getItem(itemId).category === 'weapon'),
        `${zone.id} 稀有池没有武器`,
      ).toBe(true);
    }
    const hospital = ZONES.find((zone) => zone.id === 'hospital')!;
    expect(hospital.basePool).not.toContain('stick');
    expect(hospital.rarePool).toContain('stick');
  });

  it('可完成木棍 → 加固握把 → 野外长矛的三级链路', () => {
    const state = createGame({ seed: 'PHASE4C1-CHAIN', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    clearInventory(player);
    give(state, player, 'wood');
    give(state, player, 'stone');
    give(state, player, 'rope');
    give(state, player, 'iron');

    expect(performCraft(state, player, 'r_stick').ok).toBe(true);
    expect(performCraft(state, player, 'r_reinforced_handle').ok).toBe(true);
    expect(performCraft(state, player, 'r_field_spear').ok).toBe(true);
    expect(player.inventory.some((stack) => stack.itemId === 'field_spear')).toBe(true);
    expect(auditItemIntegrity(state).ok).toBe(true);
  });

  it('现有 NPC 升级判断能逐步完成中间武器，不需要 core 改动', () => {
    const state = createGame({ seed: 'PHASE4C1-NPC-CHAIN', playerCharacterId: 'scout', playerName: '测试者' });
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    give(state, npc, 'wood');
    give(state, npc, 'stone');
    expect(findUpgradeRecipe(npc, weaponAttackOf(npc), armorDefenseOf(npc))?.id).toBe('r_stick');

    expect(performCraft(state, npc, 'r_stick').ok).toBe(true);
    give(state, npc, 'rope');
    expect(findUpgradeRecipe(npc, weaponAttackOf(npc), armorDefenseOf(npc))?.id).toBe('r_reinforced_handle');

    expect(performCraft(state, npc, 'r_reinforced_handle').ok).toBe(true);
    give(state, npc, 'iron');
    expect(findUpgradeRecipe(npc, weaponAttackOf(npc), armorDefenseOf(npc))?.id).toBe('r_field_spear');
  });

  it('路线展开只使用玩家背包和静态公开来源池', () => {
    const state = createGame({ seed: 'PHASE4C1-PATH', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    clearInventory(player);
    state.zones[player.currentZoneId]!.loot = [{ itemId: 'battery', count: 1, rarity: 'normal' }];

    const path = craftPathSummary('r_field_spear', state, player)!;
    expect(path.depth).toBe(3);
    expect(path.intermediateSteps.map((step) => step.outputItemId)).toEqual(['stick', 'reinforced_handle']);
    expect(path.rawMaterials.map((material) => material.itemId).sort()).toEqual(['iron', 'rope', 'stone', 'wood']);
    expect(path.rawMaterials.find((material) => material.itemId === 'iron')?.sourceZoneIds).toContain('factory');
    expect(path.rawMaterials.find((material) => material.itemId === 'wood')?.sourceZoneIds).toContain('forest');
  });

  it('合成引导明示武器主路径与中间部件，但不泄露区域库存', () => {
    const state = createGame({ seed: 'PHASE4C1-UI-BOUNDARY', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    clearInventory(player);
    state.zones[player.currentZoneId]!.loot = [{ itemId: 'battery', count: 1, rarity: 'normal' }];
    const views = listRecipes(state, player);

    act(() => root.render(
      <CraftPanel
        views={views}
        state={state}
        player={player}
        disabled={false}
        goalRecipeId="r_field_spear"
        goalCompleted={false}
        recommendations={[]}
        onSetGoal={() => undefined}
        onCraft={() => undefined}
      />,
    ));

    const text = container.textContent ?? '';
    expect(container.querySelector('[data-craft-guidance="weapon-primary-path"]')).not.toBeNull();
    expect(text).toContain('武器主要靠合成');
    expect(container.querySelector('[data-craft-intermediate-path]')?.textContent).toContain('加固握把');
    expect(text).toContain('铁块');
    expect(text).toContain('工厂');
    expect(container.querySelector('[data-craft-raw-materials]')?.textContent).not.toContain('电池');
    expect(text).not.toContain('物资 100%');
    expect(text).not.toContain('其他角色的背包');
  });

  it('新增武器没有正式图时沿用物品视觉 fallback', () => {
    const visual = getItemVisual('field_spear');
    expect(visual.image).toBeNull();
    expect(visual.source).toBe('emoji');
    expect(visual.emoji).toBe('⚔️');
  });
});
