/**
 * Phase 2A-1 · 五种人格长期制作规划测试。
 *
 * 覆盖规格 §四 与 §16 要求：
 * 1. 五人格开局全部有目标；
 * 2. 激进优先武器；
 * 3. 谨慎优先生存（低血时医疗权重提高）；
 * 4. 收集优先高价值长路线；
 * 5. 投机优先高完成度；
 * 6. 随机结果确定性（SeededRandom，禁 Math.random）；
 * 7. 目标完成重规划；
 * 8. 目标材料区域全部成为禁区重规划；
 * 9. 连续无进展重规划；
 * 10. 进入 finale 重规划。
 */

import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { getItem } from '../src/data/items';
import { tryGetRecipe } from '../src/data/recipes';
import { SeededRandom } from '../src/core/random';
import { chooseNpcGoal, planNpcGoal } from '../src/core/npcDecide';
import { clearInventory, give, newGame, npcs } from './helpers';
import type { Combatant, GameState, Personality } from '../src/core/types';

function findNpc(state: GameState, personality: Personality): Combatant {
  const npc = npcs(state).find((c) => c.personality === personality);
  if (!npc) throw new Error(`找不到人格 ${personality} 的 NPC`);
  return npc;
}

/** 清空后按指定人格重设一个 NPC */
function setupNpc(state: GameState, personality: Personality): Combatant {
  const npc = findNpc(state, personality);
  clearInventory(npc);
  npc.personality = personality;
  return npc;
}

describe('[Phase 2A-1] 五人格开局全部有长期目标', () => {
  it('普通开局下五种人格的 NPC 在第一次规划后都有目标', () => {
    for (const seed of ['BR-PLAN-1', 'BR-PLAN-2', 'BR-PLAN-3']) {
      const state = newGame(seed);
      for (const npc of npcs(state)) {
        planNpcGoal(state, npc);
        expect(
          npc.plannedRecipeId,
          `${seed} 下人格 ${npc.personality} 的 NPC 没有目标`,
        ).not.toBeNull();
        expect(npc.planReason).not.toBeNull();
        expect(npc.planRecommendedZoneId).not.toBeNull();
        expect(npc.planCreatedAt).toBe(state.time);
      }
    }
  });
});

describe('[Phase 2A-1] 人格专属评分', () => {
  it('激进型优先武器（无装备时选择攻击提升最高的武器）', () => {
    const state = newGame();
    const npc = setupNpc(state, 'aggressive');
    const goal = chooseNpcGoal(npc);
    expect(goal).not.toBeNull();
    const recipe = tryGetRecipe(goal!.recipeId)!;
    expect(getItem(recipe.outputItemId).category).toBe('weapon');
  });

  it('谨慎型满血时优先防具', () => {
    const state = newGame();
    const npc = setupNpc(state, 'cautious');
    const goal = chooseNpcGoal(npc);
    expect(goal).not.toBeNull();
    const recipe = tryGetRecipe(goal!.recipeId)!;
    expect(getItem(recipe.outputItemId).category).toBe('armor');
  });

  it('谨慎型低生命时医疗配方权重显著提高', () => {
    const state = newGame();
    const npc = setupNpc(state, 'cautious');
    npc.hp = Math.round(npc.maxHp * 0.1); // 生命 10%
    give(state, npc, 'herb', 1);
    give(state, npc, 'alcohol', 1); // 医疗包配方材料已齐
    const goal = chooseNpcGoal(npc);
    expect(goal).not.toBeNull();
    const recipe = tryGetRecipe(goal!.recipeId)!;
    const out = getItem(recipe.outputItemId);
    expect(out.category).toBe('consumable');
    expect((out.healHp ?? 0)).toBeGreaterThan(0);
  });

  it('收集型优先高价值、多材料、长路线', () => {
    const state = newGame();
    const npc = setupNpc(state, 'collector');
    give(state, npc, 'wood', 1);
    const goal = chooseNpcGoal(npc);
    expect(goal).not.toBeNull();
    // Phase 4M 的重型护甲是固定 roster 中价值最高的长线防具目标。
    expect(goal!.recipeId).toBe('r_heavy_armor');
  });

  it('投机型优先材料完成度最高的配方', () => {
    const state = newGame();
    const npc = setupNpc(state, 'opportunist');
    give(state, npc, 'rope', 1); // simple_bow / cloth_armor 各差一半
    const goal = chooseNpcGoal(npc);
    expect(goal).not.toBeNull();
    // 扩展后的完成度/攻击评分将复合弓升级件排在首位。
    expect(goal!.recipeId).toBe('r_composite_bow_upgrade');
  });

  it('随机型结果由 SeededRandom 决定（同种子同结果）', () => {
    const state = newGame();
    const npc = setupNpc(state, 'random');
    const rngA = new SeededRandom('plan-rng');
    const rngB = new SeededRandom('plan-rng');
    const goalA = chooseNpcGoal(npc, rngA);
    const goalB = chooseNpcGoal(npc, rngB);
    expect(goalA).not.toBeNull();
    expect(goalA!.recipeId).toBe(goalB!.recipeId);
    // 随机型也在前 5 合理候选里，必须非空
    expect(goalA).not.toBeNull();
  });
});

describe('[Phase 2A-1] 重规划触发', () => {
  it('目标成品已拥有 → 重规划', () => {
    const state = newGame();
    const npc = setupNpc(state, 'opportunist');
    npc.plannedRecipeId = 'r_stick';
    npc.planCreatedAt = state.time - 2;
    npc.planReason = '旧目标';
    give(state, npc, 'stick', 1); // 目标成品已拥有
    planNpcGoal(state, npc);
    expect(npc.lastReplanReason).toContain('成品已拥有');
    expect(npc.planCreatedAt).toBe(state.time);
  });

  it('目标材料所在区域全部成为禁区 → 重规划', () => {
    const state = newGame();
    const npc = setupNpc(state, 'opportunist');
    npc.plannedRecipeId = 'r_stick'; // 需要 wood / stone
    npc.planCreatedAt = state.time - 2;
    npc.planReason = '旧目标';
    for (const zone of Object.values(state.zones)) zone.status = 'restricted';
    planNpcGoal(state, npc);
    expect(npc.lastReplanReason).toContain('禁区');
    expect(npc.planCreatedAt).toBe(state.time);
  });

  it('连续无进展 → 重规划', () => {
    const state = newGame();
    const npc = setupNpc(state, 'opportunist');
    npc.plannedRecipeId = 'r_stick';
    npc.planCreatedAt = state.time - 2;
    npc.planReason = '旧目标';
    npc.planProgress = 1; // 假装曾有进展
    npc.planNoProgressTurns = GAME_CONFIG.npcPlanNoProgressLimit; // 已达阈值
    planNpcGoal(state, npc);
    expect(npc.lastReplanReason).toContain('无进展');
    expect(npc.planNoProgressTurns).toBe(0); // 重规划后重置
  });

  it('进入 finale → 重规划', () => {
    const state = newGame();
    const npc = setupNpc(state, 'opportunist');
    npc.plannedRecipeId = 'r_stick';
    npc.planCreatedAt = 5; // 终局前定下的目标
    npc.planReason = '旧目标';
    state.time = 12;
    state.phase = 'finale';
    state.finaleStartedAt = 10;
    planNpcGoal(state, npc);
    expect(npc.lastReplanReason).toContain('终局');
    expect(npc.planCreatedAt).toBe(state.time);
  });

  it('有效期内的目标不会被重规划（对照组）', () => {
    const state = newGame();
    const npc = setupNpc(state, 'opportunist');
    give(state, npc, 'wood', 1);
    give(state, npc, 'stone', 1);
    planNpcGoal(state, npc);
    const recipeId = npc.plannedRecipeId;
    const createdAt = npc.planCreatedAt;
    const reason = npc.lastReplanReason; // 首次规划
    planNpcGoal(state, npc); // 再来一次：不应触发任何重规划
    expect(npc.plannedRecipeId).toBe(recipeId);
    expect(npc.planCreatedAt).toBe(createdAt);
    expect(npc.lastReplanReason).toBe(reason); // 原因未被覆盖 = 没有重规划
    expect(npc.planNoProgressTurns).toBeGreaterThan(0); // 但进度照常记录
  });
});
