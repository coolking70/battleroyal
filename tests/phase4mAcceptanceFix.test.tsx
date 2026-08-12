/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildCraftPlan } from '../src/core/craftPlan';
import { craftGoalBanner, craftPathSummary } from '../src/ui/craftPathPresentation';
import { describeCraftGoal } from '../src/core/craftGuide';
import { performCraft } from '../src/core/crafting';
import { hasFieldCraftCharge, useSkill } from '../src/core/skills';
import { runNpcTurn } from '../src/core/npcAi';
import { SeededRandom } from '../src/core/random';
import { countItem } from '../src/core/inventory';
import { getItem, validateItemRegistry } from '../src/data/items';
import { CraftingCodex } from '../src/ui/components/CraftingCodex';
import { createGame, getPlayer, refreshZoneOccupants } from '../src/core/gameState';
import { clearInventory, give, newGame, npcs } from './helpers';
import type { ItemDef } from '../src/core/types';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

function craft(state: ReturnType<typeof newGame>, actor: ReturnType<typeof getPlayer>, recipeId: string): void {
  const result = performCraft(state, actor, recipeId);
  expect(result.ok, `${recipeId}: ${result.message}`).toBe(true);
}

function giveWarAxeRaws(state: ReturnType<typeof newGame>, actor: ReturnType<typeof getPlayer>): void {
  give(state, actor, 'iron', 5);
  give(state, actor, 'stone');
  give(state, actor, 'scrap', 2);
}

describe('Phase 4M-AF planner consolidation and shared dependency semantics', () => {
  it('war_axe accumulates metal_plate ×2 and reopens the second requirement after consumption', () => {
    const state = newGame('PHASE4M-AF-WAR-AXE');
    const actor = getPlayer(state);
    clearInventory(actor);
    giveWarAxeRaws(state, actor);

    let plan = buildCraftPlan(state, actor, 'r_war_axe')!;
    expect(plan.steps.find((step) => step.recipeId === 'r_metal_plate')).toMatchObject({
      required: 2,
      owned: 0,
      missing: 2,
    });
    expect(plan.suggestedNextCraft?.recipeId).toBe('r_metal_plate');
    expect(plan.rawGaps).toEqual([]);
    expect(plan.rawReady).toBe(true);
    expect(plan.finalCraftable).toBe(false);

    craft(state, actor, 'r_metal_plate');
    craft(state, actor, 'r_sharpened_metal');
    expect(countItem(actor, 'metal_plate')).toBe(0);

    plan = buildCraftPlan(state, actor, 'r_war_axe')!;
    expect(plan.steps.find((step) => step.recipeId === 'r_metal_plate')).toMatchObject({
      required: 2,
      owned: 0,
      missing: 1,
    });
    expect(plan.steps.find((step) => step.recipeId === 'r_metal_plate')?.status).not.toBe('complete');
    expect(plan.suggestedNextCraft?.recipeId).toBe('r_metal_plate');

    craft(state, actor, 'r_metal_plate');
    plan = buildCraftPlan(state, actor, 'r_war_axe')!;
    expect(plan.steps.find((step) => step.recipeId === 'r_reinforced_frame')?.missingDirect)
      .not.toContainEqual({ itemId: 'metal_plate', count: expect.any(Number) });
    expect(plan.suggestedNextCraft?.recipeId).toBe('r_metal_parts');
  });

  it('presentation consumes the same plan and exposes shared quantity plus current-state completion', () => {
    const state = newGame('PHASE4M-AF-PRESENTATION');
    const actor = getPlayer(state);
    clearInventory(actor);
    giveWarAxeRaws(state, actor);

    const path = craftPathSummary('r_war_axe', state, actor)!;
    expect(path.steps.find((step) => step.recipeId === 'r_metal_plate')).toMatchObject({ required: 2 });
    expect(path.finalCraftable).toBe(false);

    craft(state, actor, 'r_metal_plate');
    craft(state, actor, 'r_sharpened_metal');
    const afterConsumption = craftPathSummary('r_war_axe', state, actor)!;
    expect(afterConsumption.targetComplete).toBe(false);
    expect(afterConsumption.steps.find((step) => step.recipeId === 'r_metal_plate')).toMatchObject({
      required: 2,
      missing: 1,
      status: 'ready',
    });
    // History is retained for telemetry, but never satisfies the current plan.
    expect(state.events.some((event) => event.type === 'ITEM_CRAFTED' && event.metadata.outputItemId === 'metal_plate')).toBe(true);
  });

  it('raw-ready is distinct from final-craft-ready and describeCraftGoal says which intermediate is next', () => {
    const state = newGame('PHASE4M-AF-RAW-READY');
    const actor = getPlayer(state);
    clearInventory(actor);
    give(state, actor, 'wood', 2);
    give(state, actor, 'rope', 4);
    give(state, actor, 'glass');
    state.craftGoalRecipeId = 'r_composite_bow_upgrade';

    const plan = buildCraftPlan(state, actor, 'r_composite_bow_upgrade')!;
    expect(plan.rawGaps).toHaveLength(0);
    expect(plan.rawReady).toBe(true);
    expect(plan.finalCraftable).toBe(false);
    expect(plan.nextStep?.recipeId).toBe('r_processed_wood');
    expect(plan.suggestedNextCraft?.recipeId).toBe('r_processed_wood');
    expect(describeCraftGoal(state, actor)).toContain('原料齐全');
    expect(describeCraftGoal(state, actor)).toContain('下一步');
    expect(craftGoalBanner(state, actor)).toMatchObject({ rawReady: true, finalCraftable: false });
  });

  it('partial intermediate is consumed by the next route and is not recursively re-expanded', () => {
    const state = newGame('PHASE4M-AF-PARTIAL');
    const actor = getPlayer(state);
    clearInventory(actor);
    give(state, actor, 'bow_limb');
    give(state, actor, 'rope', 2);
    give(state, actor, 'glass');
    const plan = buildCraftPlan(state, actor, 'r_composite_bow_upgrade')!;
    expect(plan.steps.find((step) => step.recipeId === 'r_bow_limb')).toMatchObject({ status: 'complete', owned: 1 });
    expect(plan.steps.some((step) => step.recipeId === 'r_processed_wood')).toBe(false);
    expect(plan.suggestedNextCraft?.recipeId).toBe('r_rope_bundle');
  });
});

describe('Phase 4M-AF route, utility validation, and Engineer charge regression', () => {
  it('NPC completes a deep war_axe route through real craft turns and equips the final weapon', () => {
    const state = newGame('PHASE4M-AF-NPC-WAR-AXE');
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    npc.personality = 'collector';
    npc.plannedRecipeId = 'r_war_axe';
    npc.planCreatedAt = state.time;
    npc.planReason = 'Phase 4M-AF deep route';
    npc.planRecommendedZoneId = npc.currentZoneId;
    npc.stamina = 100;
    npc.maxStamina = 100;
    giveWarAxeRaws(state, npc);
    for (const other of Object.values(state.characters)) {
      if (other.id !== npc.id) other.currentZoneId = 'school';
    }
    refreshZoneOccupants(state);

    const rng = SeededRandom.fromState(state.rngState);
    const actions: string[] = [];
    for (let i = 0; i < 20 && countItem(npc, 'war_axe') === 0; i += 1) {
      actions.push(runNpcTurn(state, npc, rng).kind);
    }
    expect(actions.filter((action) => action === 'craft').length).toBeGreaterThanOrEqual(5);
    expect(countItem(npc, 'war_axe')).toBe(0);
    expect(npc.equipment.some((stack) => stack.itemId === 'war_axe')).toBe(true);
    expect(npc.equippedWeaponId).not.toBeNull();
  });

  it.each([NaN, Infinity, 0, -1])('rejects invalid utility searchFindMult: %s', (value) => {
    const invalid = structuredClone(getItem('field_kit')) as ItemDef;
    invalid.id = `invalid_search_find_${String(value).replace(/[^a-z0-9]+/gi, '_')}`;
    invalid.name = `非法搜索倍率${String(value)}`;
    invalid.searchFindMult = value;
    expect(validateItemRegistry([invalid])).toEqual(
      expect.arrayContaining([expect.stringContaining('searchFindMult')]),
    );
  });

  it('Engineer field_craft is one atomic free craft, then normal cost resumes with no chain exploit', () => {
    const state = createGame({ seed: 'PHASE4M-AF-ENGINEER', playerCharacterId: 'engineer', playerName: '工程师' });
    const actor = getPlayer(state);
    clearInventory(actor);
    actor.characterId = 'engineer';
    actor.passiveId = 'tinkerer';
    actor.stamina = 2;
    give(state, actor, 'iron', 4);
    give(state, actor, 'stone');
    give(state, actor, 'scrap', 2);
    expect(useSkill(state, actor, 'field_craft', new SeededRandom('PHASE4M-AF-ENGINEER-SKILL')).ok).toBe(true);
    expect(hasFieldCraftCharge(actor)).toBe(true);
    expect(performCraft(state, actor, 'r_metal_plate').ok).toBe(true);
    expect(hasFieldCraftCharge(actor)).toBe(false);
    expect(actor.stamina).toBe(0);
    actor.stamina = 1;
    expect(performCraft(state, actor, 'r_sharpened_metal').ok).toBe(true);
    expect(actor.stamina).toBe(0);
    expect(performCraft(state, actor, 'r_metal_plate').ok).toBe(false);

    const failed = createGame({ seed: 'PHASE4M-AF-ENGINEER-FAIL', playerCharacterId: 'engineer', playerName: '工程师' });
    const failedActor = getPlayer(failed);
    failedActor.characterId = 'engineer';
    failedActor.passiveId = 'tinkerer';
    failedActor.stamina = 2;
    expect(useSkill(failed, failedActor, 'field_craft', new SeededRandom('PHASE4M-AF-ENGINEER-FAIL-SKILL')).ok).toBe(true);
    failedActor.stamina = 0;
    expect(performCraft(failed, failedActor, 'r_metal_plate').ok).toBe(false);
    expect(hasFieldCraftCharge(failedActor)).toBe(true);
  });
});

describe('Phase 4M-AF CraftingCodex shared quantity presentation', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  it('renders metal_plate ×2 from the authoritative route plan', () => {
    const state = newGame('PHASE4M-AF-CODEX');
    const actor = getPlayer(state);
    clearInventory(actor);
    giveWarAxeRaws(state, actor);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<CraftingCodex state={state} player={actor} disabled={false} onSetGoal={() => undefined} />));
    const plate = container.querySelector('[data-codex-root-id="r_war_axe"] [data-codex-step-id="r_metal_plate"]');
    expect(plate?.textContent).toContain('金属板 ×2');
    expect(plate?.getAttribute('data-codex-required')).toBe('2');
    act(() => root!.unmount());
    container.remove();
    root = null;
    container = null;
  });
});
