/**
 * Phase 4C-4：核心循环诊断工具的非侵入性回归。
 *
 * 诊断字段只读取正式命令通道产出的事件与状态；本测试确保开启诊断
 * 不会改变同一种子的最终结果，并校验零体力应急动作计数的基本不变量。
 */

import { describe, expect, it } from 'vitest';

import { runAutoGame } from '../tools/autoPlayer';

describe('Phase 4C-4 核心循环诊断', () => {
  it('完整事件追踪是可选的，且不会改变确定性结果', () => {
    const baseline = runAutoGame({
      seed: 'PHASE4C4-DIAG-DETERMINISM',
      characterId: 'fighter',
      policy: 'collector',
      keepFinalState: true,
    });
    const diagnosed = runAutoGame({
      seed: 'PHASE4C4-DIAG-DETERMINISM',
      characterId: 'fighter',
      policy: 'collector',
      keepFinalState: true,
      keepEventTrace: true,
    });

    expect(baseline.eventTrace).toBeUndefined();
    expect(diagnosed.eventTrace).toBeDefined();
    expect(diagnosed.eventTrace?.length).toBeGreaterThan(0);
    expect(diagnosed.finalState).toEqual(baseline.finalState);
    expect(diagnosed.endReason).toBe(baseline.endReason);
    expect(diagnosed.commandCounts).toEqual(baseline.commandCounts);
  });

  it('零体力应急动作计数不超过对应命令总数，死亡快照保持公开诊断口径', () => {
    const result = runAutoGame({
      seed: 'PHASE4C4-DIAG-EMERGENCY',
      characterId: 'scout',
      policy: 'random',
      keepFinalState: true,
      keepEventTrace: true,
    });

    expect(result.zeroStaminaGuardCommands).toBeGreaterThanOrEqual(0);
    expect(result.zeroStaminaFleeCommands).toBeGreaterThanOrEqual(0);
    expect(result.zeroStaminaGuardCommands).toBeLessThanOrEqual(result.commandCounts.GUARD ?? 0);
    expect(result.zeroStaminaFleeCommands).toBeLessThanOrEqual(result.commandCounts.FLEE ?? 0);

    if (result.playerDeathSnapshot) {
      expect(result.playerDeathSnapshot.time).toBeGreaterThanOrEqual(0);
      expect(result.playerDeathSnapshot.zoneId).toMatch(/\S+/);
      expect(result.playerDeathSnapshot.inventorySize).toBeGreaterThanOrEqual(0);
      expect(result.playerDeathSnapshot.stamina).toBeGreaterThanOrEqual(0);
      expect(result.playerDeathSnapshot.hp).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.playerDeathSnapshot.carriedWeaponIds)).toBe(true);
      expect(Array.isArray(result.playerDeathSnapshot.carriedArmorIds)).toBe(true);
    }
  });
});
