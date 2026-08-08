import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { SeededRandom } from '../src/core/random';
import { chooseNpcGoal, planNpcGoal } from '../src/core/npcDecide';
import { runNpcTurn } from '../src/core/npcAi';
import { clearInventory, give, newGame, npcs } from './helpers';
import type { Combatant, GameState, Personality } from '../src/core/types';

function findNpc(state: GameState, personality: Personality): Combatant | null {
  return npcs(state).find((c) => c.personality === personality) ?? null;
}

describe('NPC 制作目标规划（Step 5 / Phase 2A-1 五种人格）', () => {
  it('拥有材料且材料已齐时，投机型会把可做的升级配方选为目标', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    npc.personality = 'opportunist';
    clearInventory(npc);
    give(state, npc, 'wood', 1);
    give(state, npc, 'stone', 1);
    const goal = chooseNpcGoal(npc);
    expect(goal).not.toBeNull();
    expect(goal!.recipeId).toBe('r_stick');
    expect(goal!.reason).toContain('强化');
  });

  it('收集型 NPC 会为「高价值、多材料、长路线」的配方定下长期目标', () => {
    const state = newGame();
    const npc = findNpc(state, 'collector');
    expect(npc).not.toBeNull();
    clearInventory(npc!);
    give(state, npc!, 'wood', 1); // 材料远未齐——但收集型追逐的是价值
    planNpcGoal(state, npc!);
    // 铁板护甲（value 34）价值最高，收集型优先锁定它而非"差一点"的配方
    expect(npc!.plannedRecipeId).toBe('r_plate_armor');
    expect(npc!.planReason).toContain('铁板护甲');
    expect(npc!.planCreatedAt).toBe(state.time);
    expect(npc!.planRecommendedZoneId).not.toBeNull();
  });

  it('过期的目标会按 TTL 自动重规划', () => {
    const state = newGame();
    const npc = findNpc(state, 'collector') ?? npcs(state)[0]!;
    clearInventory(npc);
    give(state, npc, 'wood', 1);
    npc.plannedRecipeId = 'r_stick';
    npc.planCreatedAt = state.time - GAME_CONFIG.npcPlanTtl - 1; // 已过期
    npc.planReason = '旧目标';
    planNpcGoal(state, npc);
    expect(npc.planCreatedAt).toBe(state.time);
  });

  it('仍处于有效期内的目标不会被重规划', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    npc.plannedRecipeId = 'r_stick';
    npc.planCreatedAt = state.time; // 刚刚定下，未过期、也未完成
    npc.planReason = 'x';
    planNpcGoal(state, npc);
    expect(npc.planCreatedAt).toBe(state.time);
    expect(npc.plannedRecipeId).toBe('r_stick');
  });

  it('成品已拥有的目标视为无效并触发重规划', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    npc.plannedRecipeId = 'r_stick';
    npc.planCreatedAt = state.time - 5; // 未过期（ttl=10）
    give(state, npc, 'stick', 1); // 已拥有成品
    planNpcGoal(state, npc);
    expect(npc.planCreatedAt).toBe(state.time); // 因无效而重规划
  });

  it('runNpcTurn 会维护 NPC 的制作目标（接线验证）', () => {
    const state = newGame('BR-NPC-PLAN', 'scout');
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    npc.personality = 'collector';
    give(state, npc, 'wood', 1);
    const rng = SeededRandom.fromState(state.rngState);
    runNpcTurn(state, npc, rng);
    expect(npc.plannedRecipeId).not.toBeNull();
    expect(npc.planReason).not.toBeNull();
  });
});
