/**
 * Phase 3 · P3-P1 模拟器 `--games` 语义验收。
 *
 * 背景（必须修的缺陷）：
 * Phase 2A-1 里 `--games 1000` 实际跑了 4 角色 × 5 策略 × 1000 = **20 000 局**，
 * 报告却写「1000 局」。这让所有引用过该数字的文档都失真了。
 *
 * Phase 3 起的契约：
 *   --games N           → N 是**总对局数**，在 20 个 cell 之间平均分配，
 *                         余数依次分给前几个 cell，Σ 各格 ≡ N。
 *   --games-per-cell N  → N 是**每格局数**，总数 = N × cell 数（旧行为）。
 *   两者互斥。
 *
 * 本测试只验证**分配计划**与**报告字段**，不真的跑对局（跑 1000 局太慢，
 * 且分配正确性与对局结果无关）。
 */

import { describe, expect, it } from 'vitest';

import {
  buildReport,
  parseArgs,
  planGames,
  distributionFromCells,
  renderMarkdown,
  type CellStats,
  type CliOptions,
} from '../tools/simulateBalance';
import { AUTO_PLAYER_POLICIES, type AutoPlayerPolicy } from '../tools/autoPlayer';
import { CHARACTERS } from '../src/data/characters';

const ALL_CHARACTERS = CHARACTERS.map((c) => c.id);
const ALL_POLICIES = [...AUTO_PLAYER_POLICIES];
/** 全矩阵 cell 数：4 × 5 = 20 */
const FULL_CELL_COUNT = ALL_CHARACTERS.length * ALL_POLICIES.length;

function planFull(argv: string[]): ReturnType<typeof planGames> {
  return planGames(ALL_CHARACTERS, ALL_POLICIES, parseArgs(argv));
}

/** 构造一个只关心 games / characterId / policy 的最小 cell */
function cell(characterId: string, policy: AutoPlayerPolicy, games: number): CellStats {
  const zero = 0;
  return {
    characterId,
    characterName: characterId,
    policy,
    games,
    wins: Math.max(1, Math.round(games * 0.05)),
    losses: 0,
    draws: 0,
    timeouts: 0,
    winRate: 0.05,
    lossRate: 0,
    drawRate: 0,
    timeoutRate: 0,
    survivalCount: 0,
    survivalRate: 0,
    trustworthyCount: games,
    trustworthyRate: 1,
    hardLimitCount: 0,
    hardLimitRate: 0,
    illegalCount: 0,
    illegalRate: 0,
    deadlockCount: 0,
    stalledCount: 0,
    emptyLegalSetCount: 0,
    illegalCommandCount: 0,
    avgTimeUsed: zero,
    bestRank: zero,
    worstRank: zero,
    avgPlayerRank: zero,
    avgKills: zero,
    avgDamageDealt: zero,
    avgDamageTaken: zero,
    avgSearches: zero,
    avgCrafts: zero,
    avgMoves: zero,
    avgAttacks: zero,
    avgItemsUsed: zero,
    avgPlayerHp: zero,
    avgPlayerStamina: zero,
    avgPlayerInventorySize: zero,
    avgZonesExhausted: zero,
    avgDeaths: zero,
    avgEventCount: zero,
    avgSteps: zero,
    totalSteps: 0,
    attackStyleCounts: {},
    exposedApplied: 0,
    exposedConsumed: 0,
    guardResolves: 0,
    skillUseCounts: {},
    worldEventCounts: {},
    commandCounts: {},
    attackStyleStats: {},
    guardCommands: 0,
    guardTriggered: 0,
    guardDamagePreventedTotal: 0,
    guardDamagePreventedAverage: 0,
    heavyMissCount: 0,
    exposedExpiredWithoutPunish: 0,
    exposedBonusDamageTotal: 0,
    skillStats: {},
    worldEventImpact: {},

  };
}

/** 按 planGames 的分配把 cells 造出来（模拟「跑完了」的结果） */
function cellsFromPlan(plan: ReturnType<typeof planGames>): CellStats[] {
  return plan.distribution.map((d) => cell(d.characterId, d.policy, d.games));
}

describe('[Phase 3 · P3-P1] --games 表示总对局数', () => {
  it('--games 1000 → 总共 1000 局（不是 20000 局）', () => {
    const plan = planFull(['--games', '1000']);
    expect(plan.mode).toBe('total');
    expect(plan.cellCount).toBe(FULL_CELL_COUNT);
    expect(plan.requestedTotalGames).toBe(1000);
    expect(plan.actualTotalGames).toBe(1000);
    expect(plan.gamesPerCell).toBe(50);
    // 1000 / 20 整除，每格恰好 50
    expect(plan.distribution).toHaveLength(FULL_CELL_COUNT);
    expect(plan.distribution.every((d) => d.games === 50)).toBe(true);
    expect(plan.distribution.reduce((a, d) => a + d.games, 0)).toBe(1000);
  });

  it('--games 1003 → 总共 1003 局，余数依次分给前 3 个 cell', () => {
    const plan = planFull(['--games', '1003']);
    expect(plan.requestedTotalGames).toBe(1003);
    expect(plan.actualTotalGames).toBe(1003);
    expect(plan.gamesPerCell).toBe(50);
    expect(plan.distribution.reduce((a, d) => a + d.games, 0)).toBe(1003);

    const counts = plan.distribution.map((d) => d.games);
    expect(counts.slice(0, 3)).toEqual([51, 51, 51]);
    expect(counts.slice(3).every((n) => n === 50)).toBe(true);
    // 任意两格差距不超过 1（真正的「平均分配」）
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('--games-per-cell 100 → 总共 2000 局（保留旧行为）', () => {
    const plan = planFull(['--games-per-cell', '100']);
    expect(plan.mode).toBe('per-cell');
    expect(plan.gamesPerCell).toBe(100);
    expect(plan.requestedTotalGames).toBe(2000);
    expect(plan.actualTotalGames).toBe(2000);
    expect(plan.distribution.every((d) => d.games === 100)).toBe(true);
    expect(plan.distribution.reduce((a, d) => a + d.games, 0)).toBe(2000);
  });

  it('--games 2000（Phase 3 验收档）→ 每格 100 局，合计 2000', () => {
    const plan = planFull(['--games', '2000']);
    expect(plan.actualTotalGames).toBe(2000);
    expect(plan.gamesPerCell).toBe(100);
    expect(plan.distribution.every((d) => d.games === 100)).toBe(true);
  });

  it('任意总局数下 Σ 各格局数恒等于请求值', () => {
    for (const n of [1, 7, 19, 20, 21, 99, 137, 500, 999, 1000, 1003, 2000, 4321]) {
      const plan = planFull(['--games', String(n)]);
      expect(
        plan.distribution.reduce((a, d) => a + d.games, 0),
        `--games ${n} 的分配总和应等于 ${n}`,
      ).toBe(n);
      expect(plan.actualTotalGames).toBe(n);
    }
  });

  it('子矩阵（--character / --policy）同样按总局数分配', () => {
    // 单角色 × 全策略 = 5 格
    const single = planGames(['scout'], ALL_POLICIES, parseArgs(['--games', '100', '--character', 'scout']));
    expect(single.cellCount).toBe(5);
    expect(single.actualTotalGames).toBe(100);
    expect(single.distribution.every((d) => d.games === 20)).toBe(true);

    // 单角色 × 单策略 = 1 格，全部 50 局都在这一格
    const one = planGames(['fighter'], ['aggressive'], parseArgs(['--games', '50']));
    expect(one.cellCount).toBe(1);
    expect(one.distribution[0]!.games).toBe(50);
  });
});

describe('[Phase 3 · P3-P1] 参数解析契约', () => {
  it('默认（无局数参数）= --games-per-cell 50', () => {
    const opts = parseArgs([]);
    expect(opts.gamesMode).toBe('per-cell');
    expect(opts.games).toBe(50);
  });

  it('--games 与 --games-per-cell 互斥', () => {
    expect(() => parseArgs(['--games', '1000', '--games-per-cell', '50'])).toThrow(/互斥/);
    expect(() => parseArgs(['--games-per-cell', '50', '--games', '1000'])).toThrow(/互斥/);
  });

  it('旧式位置参数等价于 --games（总局数）', () => {
    const opts = parseArgs(['2000']);
    expect(opts.gamesMode).toBe('total');
    expect(opts.games).toBe(2000);
  });

  it('支持 --games=1000 内联写法', () => {
    expect(parseArgs(['--games=1000'])).toMatchObject({ gamesMode: 'total', games: 1000 });
    expect(parseArgs(['--games-per-cell=25'])).toMatchObject({
      gamesMode: 'per-cell',
      games: 25,
    });
  });

  it('非正整数与未知参数一律报错', () => {
    expect(() => parseArgs(['--games', '0'])).toThrow(/正整数/);
    expect(() => parseArgs(['--games', '-5'])).toThrow(/正整数/);
    expect(() => parseArgs(['--games', 'abc'])).toThrow(/正整数/);
    expect(() => parseArgs(['--games', '10.5'])).toThrow(/正整数/);
    expect(() => parseArgs(['--nope'])).toThrow(/未知参数/);
  });

  it('总局数 < cell 数时不静默丢局：前 N 格各 1 局，其余 0 局', () => {
    const plan = planFull(['--games', '7']);
    expect(plan.actualTotalGames).toBe(7);
    expect(plan.gamesPerCell).toBe(0);
    expect(plan.distribution.filter((d) => d.games === 1)).toHaveLength(7);
    expect(plan.distribution.filter((d) => d.games === 0)).toHaveLength(FULL_CELL_COUNT - 7);
  });
});

describe('[Phase 3 · P3-P1] 报告必须显示四个分配字段', () => {
  const OPTS = (over: Partial<CliOptions>): CliOptions => ({
    gamesMode: 'total',
    games: 1000,
    seedPrefix: 'TEST-',
    character: null,
    policy: null,
    output: '/tmp/test-balance.json',
    ...over,
  });

  it('meta.config 含 requestedTotalGames / actualTotalGames / gamesPerCell / distribution', () => {
    const plan = planFull(['--games', '1003']);
    const report = buildReport(OPTS({ games: 1003 }), cellsFromPlan(plan));
    const cfg = report.meta.config;

    expect(cfg.gamesMode).toBe('total');
    expect(cfg.requestedTotalGames).toBe(1003);
    expect(cfg.actualTotalGames).toBe(1003);
    expect(cfg.gamesPerCell).toBe(50);
    expect(cfg.cellCount).toBe(FULL_CELL_COUNT);
    expect(Array.isArray(cfg.distribution)).toBe(true);
    expect(cfg.distribution).toHaveLength(FULL_CELL_COUNT);
    expect(cfg.distribution.reduce((a, d) => a + d.games, 0)).toBe(1003);
    // 全局摘要的总局数与分配一致
    expect(report.meta.summary.totalGames).toBe(1003);
  });

  it('per-cell 模式下 requestedTotalGames = 每格局数 × cell 数', () => {
    const plan = planFull(['--games-per-cell', '100']);
    const report = buildReport(
      OPTS({ gamesMode: 'per-cell', games: 100 }),
      cellsFromPlan(plan),
    );
    expect(report.meta.config.gamesMode).toBe('per-cell');
    expect(report.meta.config.gamesPerCell).toBe(100);
    expect(report.meta.config.requestedTotalGames).toBe(2000);
    expect(report.meta.config.actualTotalGames).toBe(2000);
  });

  it('实际跑的局数与请求不一致时会如实暴露（不掩盖）', () => {
    // 人为构造：请求 1000，但只有 19 格跑了（第 20 格丢了）
    const plan = planFull(['--games', '1000']);
    const broken = cellsFromPlan(plan).slice(0, FULL_CELL_COUNT - 1);
    const dist = distributionFromCells({ gamesMode: 'total', games: 1000 }, broken);
    expect(dist.requestedTotalGames).toBe(1000);
    expect(dist.actualTotalGames).toBe(950);
    expect(dist.actualTotalGames).not.toBe(dist.requestedTotalGames);
  });

  it('Markdown 报告里能读到这四个字段', () => {
    const plan = planFull(['--games', '1000']);
    const report = buildReport(OPTS({ games: 1000 }), cellsFromPlan(plan));
    expect(report.meta.tool).toBe('phase3-balance');

    const md = renderMarkdown(report);
    expect(md).toContain('requestedTotalGames');
    expect(md).toContain('actualTotalGames');
    expect(md).toContain('gamesPerCell');
    expect(md).toContain('distribution');
    // 数字本身也要出现，避免只有表头没有值
    expect(md).toMatch(/requestedTotalGames \| 1000/);
    expect(md).toMatch(/actualTotalGames \| 1000/);
  });
});
