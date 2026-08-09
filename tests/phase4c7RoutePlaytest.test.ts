/** Phase 4C-7：半自动路线观察器的口径与边界回归。 */

import { describe, expect, it } from 'vitest';

import { collectRoutePlaytest, markdownForRoutePlaytest } from '../tools/observeRoutePlaytest';

describe('Phase 4C-7 半自动路线观察', () => {
  it('只记录玩家里程碑，并保持小样本可复现且健康', () => {
    const report = collectRoutePlaytest({
      seedPrefix: 'PHASE4C7-TEST',
      scenarioCount: 4,
    });

    expect(report.evidenceClass).toBe('SEMI_AUTOMATED_ROUTE_OBSERVATION');
    expect(report.humanPlaytestStatus).toBe('NOT_PERFORMED');
    expect(report.method.requestedRuns).toBe(4);
    expect(report.method.actualRuns).toBe(4);
    expect(report.health.requestedEqualsActual).toBe(true);
    expect(report.health.noTimeoutDeadlockIllegalOrHardLimit).toBe(true);
    expect(report.records.every((record) => record.trustworthy)).toBe(true);
    expect(report.records.every((record) => Object.keys(record.milestones.firstRawMaterialPicked).every((itemId) =>
      !itemId.includes('npc') && !itemId.includes('zone.loot')),
    )).toBe(true);
    expect(report.records.every((record) => 'rawMaterialsSeen' in record && 'routeDiagnosis' in record)).toBe(true);
  });

  it('报告明确声明不是真人证据，且不写入隐藏 NPC 信息', () => {
    const report = collectRoutePlaytest({ seedPrefix: 'PHASE4C7-MARKER', scenarioCount: 1 });
    const markdown = markdownForRoutePlaytest(report);

    expect(markdown).toContain('SEMI_AUTOMATED_ROUTE_OBSERVATION');
    expect(markdown).toContain('不是真人试玩');
    expect(markdown).toContain('HUMAN-PLAYTEST-NEEDED');
    expect(markdown).not.toMatch(/\b(?:n1|n2|n3|n4)\b|青苔|寒星|断线/);
  });
});
