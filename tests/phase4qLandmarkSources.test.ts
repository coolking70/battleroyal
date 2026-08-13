import { describe, expect, it } from 'vitest';
import { currentWorldSourcesForActor, currentWorldSourcesForItem, worldSourcesForItem } from '../src/core/worldSources';
import { refreshLandmarkRecommendation } from '../src/core/npcLandmarkPlan';
import { tryGetRecipe } from '../src/data/recipes';
import { newGame, npcs } from './helpers';

describe('Phase 4Q 来源、NPC 计划与信息边界', () => {
  it('静态 Craft Guide 来源包含地标，远程耗尽不改变公共来源而 static provenance 保留', () => {
    const state = newGame('PHASE4Q-SOURCE');
    expect(worldSourcesForItem('battery').some((source) => source.kind === 'landmark_loot')).toBe(true);
    const before = currentWorldSourcesForItem(state, 'battery');
    expect(before.some((source) => source.kind === 'landmark_loot')).toBe(true);
    state.landmarks.commercial_electronics_shop!.loot = [];
    state.landmarks.commercial_electronics_shop!.remainingSearches = 0;
    state.landmarks.commercial_electronics_shop!.exhausted = true;
    const after = currentWorldSourcesForItem(state, 'battery');
    const landmarkSource = after.find((source) => source.kind === 'landmark_loot');
    expect(landmarkSource?.landmarkIds).toContain('commercial_electronics_shop');
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'school';
    expect(currentWorldSourcesForActor(state, npc, 'battery').find((source) => source.kind === 'landmark_loot')?.landmarkIds)
      .toContain('commercial_electronics_shop');
    npc.currentZoneId = 'commercial';
    expect(currentWorldSourcesForActor(state, npc, 'battery').find((source) => source.kind === 'landmark_loot')?.landmarkIds)
      .not.toContain('commercial_electronics_shop');
    expect(worldSourcesForItem('battery').some((source) => source.kind === 'landmark_loot' && source.landmarkIds.includes('commercial_electronics_shop'))).toBe(true);
  });

  it('NPC 可基于自己的配方缺口推荐当前区域地标，耗尽后不会继续推荐它', () => {
    const state = newGame('PHASE4Q-NPC-PLAN');
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'commercial';
    npc.plannedRecipeId = 'r_circuit';
    const recipe = tryGetRecipe(npc.plannedRecipeId)!;
    refreshLandmarkRecommendation(state, npc, recipe);
    expect(npc.planRecommendedLandmarkId).toBe('commercial_electronics_shop');
    state.landmarks.commercial_electronics_shop!.loot = [];
    state.landmarks.commercial_electronics_shop!.remainingSearches = 0;
    state.landmarks.commercial_electronics_shop!.exhausted = true;
    refreshLandmarkRecommendation(state, npc, recipe);
    expect(npc.planRecommendedLandmarkId).not.toBe('commercial_electronics_shop');
  });
});
