import { describe, expect, it } from 'vitest';
import { runNpcTurn } from '../src/core/npcAi';
import { refreshNpcPlanRecommendation } from '../src/core/npcGoalPlan';
import { refreshLandmarkRecommendation } from '../src/core/npcLandmarkPlan';
import { SeededRandom } from '../src/core/random';
import { tryGetRecipe } from '../src/data/recipes';
import { newGame, npcs } from './helpers';

describe('Phase 4Q NPC 地标路线', () => {
  it('从自身配方缺口规划地标，经过正式 NPC 回合搜索，并在耗尽后改用后备来源', () => {
    const state = newGame('PHASE4Q-NPC-LANDMARK-ROUTE');
    const npc = npcs(state)[0]!;
    npc.currentZoneId = 'commercial';
    npc.plannedRecipeId = 'r_circuit';
    npc.planCreatedAt = state.time;
    npc.planReason = 'Phase 4Q landmark route';
    npc.planProgress = 0;
    npc.planNoProgressTurns = 0;
    for (const character of Object.values(state.characters)) {
      if (character.id !== npc.id) character.currentZoneId = 'school';
    }
    for (const zone of Object.values(state.zones)) zone.wildEnemyIds = [];

    refreshNpcPlanRecommendation(state, npc);
    expect(npc.planRecommendedLandmarkId).toBe('commercial_electronics_shop');
    const decision = runNpcTurn(state, npc, new SeededRandom('PHASE4Q-NPC-LANDMARK-TURN'));
    expect(decision.kind).toBe('search_landmark');
    expect(state.stats.npcLandmarkSearches).toBe(1);
    expect(state.events.some((event) => event.type === 'LANDMARK_SEARCHED' && event.actorId === npc.id)).toBe(true);

    const exhausted = state.landmarks.commercial_electronics_shop!;
    exhausted.loot = [];
    exhausted.remainingSearches = 0;
    exhausted.exhausted = true;
    refreshLandmarkRecommendation(state, npc, tryGetRecipe(npc.plannedRecipeId!));
    expect(npc.planRecommendedLandmarkId).not.toBe('commercial_electronics_shop');
  });
});
