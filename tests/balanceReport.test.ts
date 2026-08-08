/**
 * Phase 2A-1 · 平衡报告验收字段测试。
 *
 * 覆盖规格 §六 / §16：
 * - 报告必须存在 characterBalance 与 threshold: 2.5；
 * - 最高/最低非零胜率比 ≥ 2.5 时 passed=false；
 * - 任一角色 0 胜率时 passed=false；
 * - 平衡时 passed=true（含引擎健康）。
 */

import { describe, expect, it } from 'vitest';
import {
  buildReport,
  type CellStats,
  type CliOptions,
} from '../tools/simulateBalance';
import type { AutoPlayerPolicy } from '../tools/autoPlayer';

const OPTS: CliOptions = {
  // Phase 3 · P3-P1：显式声明局数语义（这里用旧的「每格 N 局」语义构造样本）
  gamesMode: 'per-cell',
  games: 100,
  seedPrefix: 'TEST-',
  character: null,
  policy: null,
  output: '/tmp/test-balance.json',
};

/** 构造一个最小但完整的 cell（其余字段置 0，只控制 games / wins） */
function makeCell(
  characterId: string,
  wins: number,
  games = 100,
): CellStats {
  const zero = (): number => 0;
  return {
    characterId,
    characterName: characterId,
    policy: 'cautious' as AutoPlayerPolicy,
    games,
    wins,
    losses: 0,
    draws: 0,
    timeouts: 0,
    winRate: games > 0 ? wins / games : 0,
    lossRate: 0,
    drawRate: 0,
    timeoutRate: 0,
    survivalCount: 0,
    survivalRate: 0,
    trustworthyCount: 0,
    trustworthyRate: 0,
    hardLimitCount: 0,
    hardLimitRate: 0,
    illegalCount: 0,
    illegalRate: 0,
    deadlockCount: 0,
    stalledCount: 0,
    emptyLegalSetCount: 0,
    illegalCommandCount: 0,
    avgTimeUsed: zero(),
    bestRank: zero(),
    worstRank: zero(),
    avgPlayerRank: zero(),
    avgKills: zero(),
    avgDamageDealt: zero(),
    avgDamageTaken: zero(),
    avgSearches: zero(),
    avgCrafts: zero(),
    avgMoves: zero(),
    avgAttacks: zero(),
    avgItemsUsed: zero(),
    avgPlayerHp: zero(),
    avgPlayerStamina: zero(),
    avgPlayerInventorySize: zero(),
    avgZonesExhausted: zero(),
    avgDeaths: zero(),
    avgEventCount: zero(),
    avgSteps: zero(),
    totalSteps: 0,
  };
}

function cellsFor(winRates: Record<string, number>): CellStats[] {
  return Object.entries(winRates).map(([id, rate]) =>
    makeCell(id, Math.round(rate * 100), 100),
  );
}

describe('[Phase 2A-1] 平衡报告验收字段', () => {
  it('报告包含 characterBalance 与 threshold 2.5', () => {
    const report = buildReport(OPTS, cellsFor({ scout: 0.04, fighter: 0.08 }));
    expect(report.meta.characterBalance).toBeDefined();
    expect(report.meta.characterBalance.threshold).toBe(2.5);
    expect(typeof report.meta.characterBalance.highestWinRate).toBe('number');
    expect(typeof report.meta.characterBalance.lowestNonZeroWinRate).toBe('number');
    expect(typeof report.meta.characterBalance.ratio).toBe('number');
    expect(Array.isArray(report.meta.characterBalance.zeroWinCharacters)).toBe(true);
  });

  it('比值 ≥ 2.5 时 passed=false', () => {
    const report = buildReport(
      OPTS,
      cellsFor({ scout: 0.03, engineer: 0.15 }),
    );
    expect(report.meta.characterBalance.ratio).toBeGreaterThanOrEqual(2.5);
    expect(report.meta.characterBalance.passed).toBe(false);
    expect(report.meta.overallPassed).toBe(false);
  });

  it('任一角色 0 胜率时 passed=false', () => {
    const report = buildReport(
      OPTS,
      cellsFor({ scout: 0, engineer: 0.05 }),
    );
    expect(report.meta.characterBalance.zeroWinCharacters).toContain('scout');
    expect(report.meta.characterBalance.passed).toBe(false);
    expect(report.meta.overallPassed).toBe(false);
  });

  it('比值 < 2.5 且无 0 胜率时 passed=true', () => {
    const report = buildReport(
      OPTS,
      cellsFor({ scout: 0.032, fighter: 0.068, engineer: 0.056, medic: 0.06 }),
    );
    expect(report.meta.characterBalance.ratio).toBeLessThan(2.5);
    expect(report.meta.characterBalance.passed).toBe(true);
    expect(report.meta.characterBalance.zeroWinCharacters).toEqual([]);
    expect(report.meta.overallPassed).toBe(true);
  });

  it('引擎健康红线仍参与整体判定（timeout>0 则 FAIL）', () => {
    const cells = cellsFor({ scout: 0.04, fighter: 0.08 });
    cells[0]!.timeouts = 5;
    cells[0]!.timeoutRate = 0.05;
    const report = buildReport(OPTS, cells);
    expect(report.meta.health.timeout.flagged).toBe(true);
    expect(report.meta.overallPassed).toBe(false);
  });
});
