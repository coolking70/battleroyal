import { describe, expect, it } from 'vitest';
import { buildCraftPlan } from '../src/core/craftPlan';
import { createGame, getPlayer } from '../src/core/gameState';
import { worldSourcesForItem } from '../src/core/worldSources';
import { ITEMS } from '../src/data/items';
import { PHASE4N_WILD_MATERIAL_IDS } from '../src/data/phase4nItems';
import { PHASE4N_RECIPES } from '../src/data/phase4nRecipes';
import { getRecipeDepth, validateRecipeGraph } from '../src/data/recipes';
import { WILD_DROP_TABLES, WILD_ECOLOGY, WILD_ENEMIES, validateWildRegistries } from '../src/data/wildEnemies';
import { ZONE_IDS } from '../src/data/zones';

function population(seed: string) {
  const state = createGame({ seed, playerCharacterId: 'scout' });
  return ZONE_IDS.map((zoneId) => ({
    zoneId,
    ids: state.zones[zoneId]!.wildEnemyIds.map((uid) => ({ uid, defId: state.wildEnemies[uid]!.defId })),
  }));
}

describe('Phase 4N wild ecology data', () => {
  it('registers ten valid threats across every zone', () => {
    expect(WILD_ENEMIES).toHaveLength(10);
    expect(validateWildRegistries()).toEqual([]);
    expect(Object.keys(WILD_ECOLOGY).sort()).toEqual([...ZONE_IDS].sort());
    expect(ZONE_IDS.every((zoneId) => (WILD_ECOLOGY[zoneId]?.length ?? 0) >= 2)).toBe(true);
  });

  it('creates finite stable 1-4 populations without contestant overlap', () => {
    const first = population('PHASE4N-POPULATION-A');
    expect(first).toEqual(population('PHASE4N-POPULATION-A'));
    expect(first).not.toEqual(population('PHASE4N-POPULATION-B'));
    expect(first.every((zone) => zone.ids.length >= 1 && zone.ids.length <= 4)).toBe(true);
    const state = createGame({ seed: 'PHASE4N-POPULATION-A', playerCharacterId: 'scout' });
    expect(Object.keys(state.wildEnemies).some((uid) => uid in state.characters)).toBe(false);
  });

  it('provides eight wild-only materials and ten connected recipes', () => {
    expect(PHASE4N_WILD_MATERIAL_IDS).toHaveLength(8);
    expect(PHASE4N_RECIPES).toHaveLength(10);
    expect(validateRecipeGraph()).toEqual([]);
    const dropped = new Set(WILD_DROP_TABLES.flatMap((table) => table.entries.map((entry) => entry.itemId)));
    const consumed = new Set(PHASE4N_RECIPES.flatMap((recipe) => recipe.ingredients.map((entry) => entry.itemId)));
    for (const itemId of PHASE4N_WILD_MATERIAL_IDS) {
      expect(ITEMS.find((item) => item.id === itemId)?.craftTier).toBe('raw');
      expect(dropped.has(itemId)).toBe(true);
      expect(consumed.has(itemId)).toBe(true);
      expect(worldSourcesForItem(itemId).some((source) => source.kind === 'wild_drop')).toBe(true);
    }
    expect(getRecipeDepth('r_venom_spear')).toBeGreaterThanOrEqual(2);
  });

  it('exposes wild provenance to the canonical planner without live counts or odds', () => {
    const state = createGame({ seed: 'PHASE4N-WORLD-SOURCE', playerCharacterId: 'scout' });
    const plan = buildCraftPlan(state, getPlayer(state), 'r_tracker_scope');
    const wildGaps = plan?.rawGaps.filter((gap) => gap.sourceEnemyIds.length > 0) ?? [];
    expect(wildGaps.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(wildGaps)).not.toContain('probability');
    expect(JSON.stringify(wildGaps)).not.toContain('wildEnemyIds');
  });
});
