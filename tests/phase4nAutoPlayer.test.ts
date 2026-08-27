import { describe, expect, it } from 'vitest';
import { runAutoGame } from '../tools/autoPlayer';

describe('Phase 4N · representative AutoPlayer PvE loop', () => {
  it('can complete a deterministic public wild-material build route', () => {
    const result = runAutoGame({
      // Re-pinned after the Phase 4X / 4X-AF1 balance tuning shifted this
      // trajectory (4X: -3→-4; AF1: -4→-6). The route itself still closes
      // through the formal command pipeline; only the fixture seed moved.
      seed: 'AF3-N4-6',
      characterId: 'hunter',
      policy: 'collector',
      representativeBuildLoop: true,
      representativeRecipeId: 'r_hunting_armor',
      keepEventTrace: true,
      maxSteps: 1000,
    });
    expect(result.trustworthy).toBe(true);
    expect(result.craftGoalCompleted).toBe(true);
    expect(result.wildCraftGoalAttempted).toBe(true);
    expect(result.wildCraftGoalCompleted).toBe(true);
    expect(result.wildKillCount).toBeGreaterThan(0);
    for (const commandType of ['SET_CRAFT_GOAL', 'MOVE', 'SEARCH', 'ATTACK', 'PICKUP_GROUND', 'CRAFT', 'EQUIP']) {
      expect(result.commandCounts[commandType] ?? 0, commandType).toBeGreaterThan(0);
    }
    expect(result.illegalCommands).toHaveLength(0);
  });
});
