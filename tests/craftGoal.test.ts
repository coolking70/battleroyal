import { describe, it, expect } from 'vitest';
import { executeCommand } from '../src/core/gameEngine';
import { clearInventory, give, newGame, player } from './helpers';
import type { GameEvent, GameEventType, GameState } from '../src/core/types';

function lastEventOfType(state: GameState, type: GameEventType): GameEvent | null {
  for (let i = state.events.length - 1; i >= 0; i--) {
    if (state.events[i]!.type === type) return state.events[i]!;
  }
  return null;
}

describe('制作目标（玩家 SET_CRAFT_GOAL）', () => {
  it('设定有效配方会写入 craftGoalRecipeId 并播报 CRAFT_GOAL_SET', () => {
    const state = newGame();
    const res = executeCommand(state, { type: 'SET_CRAFT_GOAL', recipeId: 'r_stick' });
    expect(res.ok).toBe(true);
    expect(res.state.craftGoalRecipeId).toBe('r_stick');
    expect(res.state.craftGoalCompleted).toBe(false);
    const ev = lastEventOfType(res.state, 'CRAFT_GOAL_SET');
    expect(ev).not.toBeNull();
    expect(ev!.metadata.completed).toBe(false);
  });

  it('合成目标配方会标记已完成并播报 completed=true', () => {
    const state = newGame();
    const p = player(state);
    clearInventory(p);
    give(state, p, 'wood', 1);
    give(state, p, 'stone', 1);
    let res = executeCommand(state, { type: 'SET_CRAFT_GOAL', recipeId: 'r_stick' });
    expect(res.ok).toBe(true);
    res = executeCommand(res.state, { type: 'CRAFT', recipeId: 'r_stick' });
    expect(res.ok).toBe(true);
    expect(res.state.craftGoalCompleted).toBe(true);
    const ev = lastEventOfType(res.state, 'CRAFT_GOAL_SET');
    expect(ev!.metadata.completed).toBe(true);
  });

  it('合成别的配方不会完成已设目标', () => {
    const state = newGame();
    const p = player(state);
    clearInventory(p);
    give(state, p, 'scrap', 1);
    give(state, p, 'wood', 1);
    let res = executeCommand(state, { type: 'SET_CRAFT_GOAL', recipeId: 'r_stick' });
    res = executeCommand(res.state, { type: 'CRAFT', recipeId: 'r_iron_pipe' });
    expect(res.ok).toBe(true);
    expect(res.state.craftGoalRecipeId).toBe('r_stick');
    expect(res.state.craftGoalCompleted).toBe(false);
  });

  it('设为 null 会清空目标', () => {
    const state = newGame();
    let res = executeCommand(state, { type: 'SET_CRAFT_GOAL', recipeId: 'r_stick' });
    res = executeCommand(res.state, { type: 'SET_CRAFT_GOAL', recipeId: null });
    expect(res.ok).toBe(true);
    expect(res.state.craftGoalRecipeId).toBeNull();
    expect(res.state.craftGoalCompleted).toBe(false);
  });

  it('未知配方被拒绝且不改变目标', () => {
    const state = newGame();
    const res = executeCommand(state, { type: 'SET_CRAFT_GOAL', recipeId: 'nope' });
    expect(res.ok).toBe(false);
    expect(res.state.craftGoalRecipeId).toBeNull();
  });
});
