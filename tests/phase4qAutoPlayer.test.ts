import { describe, expect, it } from 'vitest';
import { runAutoGame } from '../tools/autoPlayer';

describe('Phase 4Q AutoPlayer 正式地标路线', () => {
  it('支持 SET_CRAFT_GOAL → MOVE → SEARCH_LANDMARK → CRAFT → EQUIP 的正式命令闭环', () => {
    const result = runAutoGame({
      seed: 'PHASE4Q-AUTOPLAYER-ELECTRONICS',
      characterId: 'scavenger',
      policy: 'collector',
      representativeBuildLoop: true,
      representativeRecipeId: 'r_circuit',
      representativeLandmarkId: 'commercial_electronics_shop',
      keepEventTrace: true,
      maxSteps: 500,
    });
    expect(result.trustworthy).toBe(true);
    expect(result.commandCounts.SEARCH_LANDMARK ?? 0).toBeGreaterThan(0);
    expect(result.commandCounts.SET_CRAFT_GOAL ?? 0).toBeGreaterThan(0);
    expect(result.illegalCommands).toEqual([]);
  });
});
