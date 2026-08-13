import { describe, expect, it } from 'vitest';
import { LANDMARKS, landmarksForZone } from '../src/data/landmarks';
import { executeCommand } from '../src/core/gameEngine';
import { auditItemIntegrity } from '../src/core/itemIntegrity';
import { createStack } from '../src/core/inventory';
import { landmarkStatus } from '../src/core/landmarks';
import { newGame, player } from './helpers';

describe('Phase 4Q 地标内容与定向搜索', () => {
  it('12 个区域各有至少两个唯一地标，且满足设施/风险门槛', () => {
    expect(LANDMARKS).toHaveLength(24);
    expect(new Set(LANDMARKS.map((landmark) => landmark.id)).size).toBe(24);
    for (const zoneId of Object.keys(newGame('PHASE4Q-CONTENT').zones)) expect(landmarksForZone(zoneId).length).toBeGreaterThanOrEqual(2);
    expect(LANDMARKS.filter((landmark) => landmark.interaction).length).toBeGreaterThanOrEqual(8);
    expect(LANDMARKS.filter((landmark) => landmark.searchProfile.riskDamage > 0 || landmark.searchProfile.encounterChance >= 0.25).length).toBeGreaterThanOrEqual(8);
  });

  it('SEARCH_LANDMARK 通过正式命令消耗正体力/时间，且错误区域与耗尽状态被拒绝', () => {
    const state = newGame('PHASE4Q-SEARCH-LEGAL');
    const actor = player(state);
    actor.currentZoneId = 'commercial';
    for (const zone of Object.values(state.zones)) zone.wildEnemyIds = [];
    const runtime = state.landmarks.commercial_electronics_shop!;
    runtime.loot = [createStack(state, 'battery')];
    runtime.remainingSearches = 1;
    runtime.maxSearches = 1;
    runtime.exhausted = false;
    actor.stamina = actor.maxStamina;
    const beforeTime = state.time;
    const found = executeCommand(state, { type: 'SEARCH_LANDMARK', landmarkId: runtime.landmarkId });
    expect(found.ok).toBe(true);
    expect(found.state.time).toBe(beforeTime + 1);
    expect(player(found.state).stamina).toBeLessThan(actor.stamina);
    expect(found.state.events.some((event) => event.type === 'LANDMARK_SEARCHED')).toBe(true);
    expect(landmarkStatus(found.state.landmarks.commercial_electronics_shop!)).toBe('exhausted');
    expect(auditItemIntegrity(found.state).ok).toBe(true);

    const wrongZone = executeCommand(found.state, { type: 'SEARCH_LANDMARK', landmarkId: 'hospital_pharmacy' });
    expect(wrongZone.ok).toBe(false);
    const exhausted = executeCommand(found.state, { type: 'SEARCH_LANDMARK', landmarkId: runtime.landmarkId });
    expect(exhausted.ok).toBe(false);
  });

  it('同 seed 初始化地标有限库存与 UID 完全确定', () => {
    const a = newGame('PHASE4Q-DETERMINISTIC');
    const b = newGame('PHASE4Q-DETERMINISTIC');
    expect(a.landmarks).toEqual(b.landmarks);
    expect(a.uidSeq).toBe(b.uidSeq);
  });
});
