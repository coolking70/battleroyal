/**
 * Phase 3 · 权威平衡模拟器（统一模拟入口）。
 *
 * `npm run simulate` 与 `npm run simulate:balance` 都指向本文件，
 * 废弃了「simulate.ts 冒烟 / simulateBalance.ts 权威」的双入口语义不一致。
 * 本文件只调用自动对局控制器 `tools/autoPlayer.ts` —— 而 autoPlayer 又只走
 * 正式命令通道 `executeCommand`，因此报告里的胜率、存活、死因全部来自引擎真实结论。
 *
 * 矩阵：4 角色（scout / fighter / engineer / medic）× 5 策略
 *       （aggressive / cautious / collector / opportunist / random）= 20 个 cell。
 *
 * ── P3-P1：`--games` 语义修正（Phase 3 Preflight）──────────────────────────
 * Phase 2A-1 的 `--games N` 实际含义是「每个 cell 跑 N 局」，
 * 于是 `--games 1000` 会跑 20 000 局 —— 报告里写「1000 局」是**错的**。
 * Phase 3 起：
 *   --games N            N = 整轮模拟的**总对局数**，在 20 个 cell 之间平均分配，
 *                        余数依次分给前几个 cell（1003 → 前 3 个 cell 各 51 局，
 *                        其余 17 个各 50 局，合计恰好 1003）。
 *   --games-per-cell N   保留旧行为：每个 cell 各 N 局（总数 = N × cell 数）。
 * 两者互斥；都不给时默认 `--games-per-cell 50`。
 * 报告 `meta.config` 必须同时给出：
 *   requestedTotalGames / actualTotalGames / gamesPerCell / distribution
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 健康红线（FAIL 条件，必须驱动到 0）：
 *   - timeout           跑到步数上限仍是 playing
 *   - illegalState      合法集合里的命令被引擎拒绝 / 死锁 / livelock / 空集合
 *   - hardLimitReached  触及 180 硬上限才结束
 *   - characterBalance  最高/最低非零胜率比 ≥ 2.5 或存在 0 胜率角色
 *
 * 用法（唯一正式入口 npm run simulate）：
 *   npm run simulate -- --games 2000                  总共 2000 局（每格 100）
 *   npm run simulate -- --games 2000 --seed-prefix PHASE3
 *   npm run simulate -- --games-per-cell 100          每格 100 局（总共 2000）
 *   npm run simulate -- --games 100 --character scout 单角色 5 格，总共 100 局
 *   npm run simulate -- --games 100 --policy cautious
 *   npm run simulate -- --games 50 --character fighter --policy aggressive
 *   npm run simulate -- --games 2000 --output reports/phase3-balance
 *   npm run simulate -- 2000          # 旧式位置参数（等价 --games 2000，总局数）
 *   npm run simulate -- --help        # 帮助
 * 参数错误时打印帮助并以 exit code 1 退出。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GAME_CONFIG, GAME_VERSION } from '../src/data/gameConfig';
import { CHARACTERS } from '../src/data/characters';
import { WORLD_EVENT_IDS } from '../src/core/worldEvents';

import {
  AUTO_PLAYER_POLICIES,
  runAutoGame,
  type AutoGameOutcome,
  type AutoPlayerPolicy,
  type AutoGameResult,
} from './autoPlayer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

/**
 * `games` 字段的语义模式（P3-P1）。
 * - `'total'`    ：games = 整轮模拟的**总对局数**，由 `--games` 指定
 * - `'per-cell'` ：games = **每个 cell** 的局数，由 `--games-per-cell` 指定
 */
export type GamesMode = 'total' | 'per-cell';

interface CliOptions {
  /** games 数字的语义，见 {@link GamesMode} */
  gamesMode: GamesMode;
  /** 语义由 gamesMode 决定的局数（总局数 或 每格局数） */
  games: number;
  seedPrefix: string;
  character: string | null;
  policy: string | null;
  output: string;
}

const DEFAULT_GAMES_PER_CELL = 50;
const DEFAULT_SEED_PREFIX = 'BAL-';
const DEFAULT_OUTPUT = resolve(__dirname, '..', 'reports', 'phase3-balance.json');

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`区域大逃杀 · 平衡模拟器（Phase 3）
用法：
  npm run simulate -- --games <N>                    N = **总对局数**，在全部 cell 间平均分配（余数给前几格）
  npm run simulate -- --games-per-cell <N>           N = **每格局数**（旧行为；总数 = N × cell 数）
  npm run simulate -- --games 2000 --seed-prefix X   指定种子前缀
  npm run simulate -- --character <id>               只跑单个角色（scout/fighter/engineer/medic）
  npm run simulate -- --policy <p>                   只跑单个策略（aggressive/cautious/collector/opportunist/random）
  npm run simulate -- --output <path>                报告输出路径（.json，自动附 .md）
  npm run simulate -- 2000                           旧式位置参数（等价 --games 2000，即总局数）
  npm run simulate -- --help / -h                    显示帮助

说明：
  · 默认（两个局数参数都不给）= --games-per-cell ${DEFAULT_GAMES_PER_CELL}
  · --games 与 --games-per-cell 互斥，同时给出会报错
  · 全矩阵 = 4 角色 × 5 策略 = 20 个 cell，故 --games 2000 → 每格 100 局`);
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    gamesMode: 'per-cell',
    games: DEFAULT_GAMES_PER_CELL,
    seedPrefix: DEFAULT_SEED_PREFIX,
    character: null,
    policy: null,
    output: DEFAULT_OUTPUT,
  };
  /** 记录用户显式指定过哪个局数参数，用于互斥检测 */
  let gamesFlag: '--games' | '--games-per-cell' | null = null;

  const setGames = (flag: '--games' | '--games-per-cell', raw: string): void => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0 || String(n) !== raw.trim()) {
      throw new Error(`${flag} 必须是正整数`);
    }
    if (gamesFlag !== null && gamesFlag !== flag) {
      throw new Error('--games 与 --games-per-cell 互斥，不能同时指定');
    }
    gamesFlag = flag;
    opts.gamesMode = flag === '--games' ? 'total' : 'per-cell';
    opts.games = n;
  };

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!;
    const eq = tok.indexOf('=');
    const key = eq >= 0 ? tok.slice(0, eq) : tok;
    const inlineVal = eq >= 0 ? tok.slice(eq + 1) : undefined;
    const next = (): string | undefined => inlineVal ?? argv[i + 1];
    const take = (): string => {
      const v = next();
      if (v === undefined) throw new Error(`参数 ${key} 缺少值`);
      if (inlineVal === undefined) i += 1;
      return v;
    };
    switch (key) {
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      case '--games':
        setGames('--games', take());
        break;
      case '--games-per-cell':
        setGames('--games-per-cell', take());
        break;
      case '--seed-prefix':
        opts.seedPrefix = take();
        break;
      case '--character': {
        const c = take();
        if (!CHARACTERS.some((d) => d.id === c)) {
          throw new Error(`--character 必须是 ${CHARACTERS.map((d) => d.id).join(' / ')}`);
        }
        opts.character = c;
        break;
      }
      case '--policy': {
        const p = take();
        if (!AUTO_PLAYER_POLICIES.includes(p as AutoPlayerPolicy)) {
          throw new Error(`--policy 必须是 ${AUTO_PLAYER_POLICIES.join(' / ')}`);
        }
        opts.policy = p;
        break;
      }
      case '--output':
        opts.output = resolve(process.cwd(), take());
        break;
      default:
        if (key.startsWith('-')) {
          throw new Error(`未知参数：${key}`);
        }
        // 旧式位置参数：单个数字视为**总局数**（与 --games 同义）
        setGames('--games', tok);
        break;
    }
  }
  return opts;
}

/* ------------------------------------------------------------------ */
/* P3-P1：局数分配                                                     */
/* ------------------------------------------------------------------ */

/** 单个 cell 的运行计划 */
export interface CellPlan {
  characterId: string;
  policy: AutoPlayerPolicy;
  games: number;
}

/** 局数分配结果——报告必须原样呈现这四个字段 */
export interface GamesDistribution {
  mode: GamesMode;
  cellCount: number;
  /** 用户请求的总对局数（per-cell 模式下 = games × cellCount） */
  requestedTotalGames: number;
  /** 实际会跑（或已跑）的总对局数——total 模式下恒等于 requestedTotalGames */
  actualTotalGames: number;
  /** 每格基准局数：total 模式 = floor(总数 / cell 数)；per-cell 模式 = 用户给的值 */
  gamesPerCell: number;
  /** 每个 cell 的实际局数明细，顺序 = 矩阵遍历顺序（角色外层、策略内层） */
  distribution: CellPlan[];
}

/**
 * 把「总局数 / 每格局数」翻译成每个 cell 的具体局数。
 *
 * total 模式的分配规则（P3-P1 明确要求）：
 *   base = floor(total / cellCount)，remainder = total % cellCount，
 *   **前 remainder 个 cell 各多跑 1 局**，因此 Σ 各格局数 ≡ total（不多不少）。
 */
export function planGames(
  characters: readonly string[],
  policies: readonly AutoPlayerPolicy[],
  opts: Pick<CliOptions, 'gamesMode' | 'games'>,
): GamesDistribution {
  const pairs: Array<{ characterId: string; policy: AutoPlayerPolicy }> = [];
  for (const characterId of characters) {
    for (const policy of policies) pairs.push({ characterId, policy });
  }
  const cellCount = pairs.length;

  if (cellCount === 0) {
    return {
      mode: opts.gamesMode,
      cellCount: 0,
      requestedTotalGames: opts.gamesMode === 'total' ? opts.games : 0,
      actualTotalGames: 0,
      gamesPerCell: 0,
      distribution: [],
    };
  }

  if (opts.gamesMode === 'per-cell') {
    const distribution: CellPlan[] = pairs.map((p) => ({ ...p, games: opts.games }));
    const total = opts.games * cellCount;
    return {
      mode: 'per-cell',
      cellCount,
      requestedTotalGames: total,
      actualTotalGames: total,
      gamesPerCell: opts.games,
      distribution,
    };
  }

  const base = Math.floor(opts.games / cellCount);
  const remainder = opts.games % cellCount;
  const distribution: CellPlan[] = pairs.map((p, i) => ({
    ...p,
    games: base + (i < remainder ? 1 : 0),
  }));
  return {
    mode: 'total',
    cellCount,
    requestedTotalGames: opts.games,
    actualTotalGames: distribution.reduce((a, c) => a + c.games, 0),
    gamesPerCell: base,
    distribution,
  };
}

/* ------------------------------------------------------------------ */
/* 聚合                                                                */
/* ------------------------------------------------------------------ */

function isIllegal(r: AutoGameResult): boolean {
  return (
    r.illegalCommands.length > 0 ||
    r.deadlock !== null ||
    r.stalled ||
    r.emptyLegalSet
  );
}

interface CellStats {
  characterId: string;
  characterName: string;
  policy: AutoPlayerPolicy;
  games: number;

  wins: number;
  losses: number;
  draws: number;
  timeouts: number;

  winRate: number;
  lossRate: number;
  drawRate: number;
  timeoutRate: number;

  survivalCount: number;
  survivalRate: number;

  trustworthyCount: number;
  trustworthyRate: number;

  hardLimitCount: number;
  hardLimitRate: number;

  illegalCount: number;
  illegalRate: number;
  deadlockCount: number;
  stalledCount: number;
  emptyLegalSetCount: number;
  illegalCommandCount: number;

  avgTimeUsed: number;
  bestRank: number;
  worstRank: number;
  avgPlayerRank: number;
  avgKills: number;
  avgDamageDealt: number;
  avgDamageTaken: number;

  avgSearches: number;
  avgCrafts: number;
  avgMoves: number;
  avgAttacks: number;
  avgItemsUsed: number;

  avgPlayerHp: number;
  avgPlayerStamina: number;
  avgPlayerInventorySize: number;

  avgZonesExhausted: number;
  avgDeaths: number;
  avgEventCount: number;

  avgSteps: number;
  totalSteps: number;

  /* --- Phase 3A 玩法统计（事件扫描聚合） --- */
  attackStyleCounts: Record<string, number>;
  exposedApplied: number;
  exposedConsumed: number;
  guardResolves: number;
  skillUseCounts: Record<string, number>;
  worldEventCounts: Record<string, number>;
  /** 全部命令类型计数（GUARD 使用率的分母） */
  commandCounts: Record<string, number>;
}

function aggregateCell(
  characterId: string,
  characterName: string,
  policy: AutoPlayerPolicy,
  results: AutoGameResult[],
): CellStats {
  const n = results.length;
  const sum = (f: (r: AutoGameResult) => number): number =>
    results.reduce((acc, r) => acc + f(r), 0);

  const wins = results.filter((r) => r.outcome === 'won').length;
  const losses = results.filter((r) => r.outcome === 'lost').length;
  const draws = results.filter((r) => r.outcome === 'draw').length;
  const timeouts = results.filter((r) => r.outcome === 'timeout').length;
  const survivalCount = results.filter((r) => r.survived).length;
  const hardLimitCount = results.filter((r) => r.hardLimitReached).length;
  const illegalList = results.filter(isIllegal);
  const deadlockCount = results.filter((r) => r.deadlock !== null).length;
  const stalledCount = results.filter((r) => r.stalled).length;
  const emptyLegalSetCount = results.filter((r) => r.emptyLegalSet).length;
  const illegalCommandCount = sum((r) => r.illegalCommands.length);

  const ranks = results.map((r) => r.playerRank);
  const pct = (x: number): number => (n > 0 ? x / n : 0);

  return {
    characterId,
    characterName,
    policy,
    games: n,

    wins,
    losses,
    draws,
    timeouts,

    winRate: pct(wins),
    lossRate: pct(losses),
    drawRate: pct(draws),
    timeoutRate: pct(timeouts),

    survivalCount,
    survivalRate: pct(survivalCount),

    trustworthyCount: results.filter((r) => r.trustworthy).length,
    trustworthyRate: pct(results.filter((r) => r.trustworthy).length),

    hardLimitCount,
    hardLimitRate: pct(hardLimitCount),

    illegalCount: illegalList.length,
    illegalRate: pct(illegalList.length),
    deadlockCount,
    stalledCount,
    emptyLegalSetCount,
    illegalCommandCount,

    avgTimeUsed: n > 0 ? sum((r) => r.timeUsed) / n : 0,
    bestRank: ranks.length > 0 ? Math.min(...ranks) : 0,
    worstRank: ranks.length > 0 ? Math.max(...ranks) : 0,
    avgPlayerRank: n > 0 ? sum((r) => r.playerRank) / n : 0,
    avgKills: n > 0 ? sum((r) => r.playerKills) / n : 0,
    avgDamageDealt: n > 0 ? sum((r) => r.damageDealt) / n : 0,
    avgDamageTaken: n > 0 ? sum((r) => r.damageTaken) / n : 0,

    avgSearches: n > 0 ? sum((r) => r.searches) / n : 0,
    avgCrafts: n > 0 ? sum((r) => r.crafts) / n : 0,
    avgMoves: n > 0 ? sum((r) => r.moves) / n : 0,
    avgAttacks: n > 0 ? sum((r) => r.attacks) / n : 0,
    avgItemsUsed: n > 0 ? sum((r) => r.itemsUsed) / n : 0,

    avgPlayerHp: n > 0 ? sum((r) => r.playerHp) / n : 0,
    avgPlayerStamina: n > 0 ? sum((r) => r.playerStamina) / n : 0,
    avgPlayerInventorySize: n > 0 ? sum((r) => r.playerInventorySize) / n : 0,

    avgZonesExhausted: n > 0 ? sum((r) => r.zonesExhausted) / n : 0,
    avgDeaths: n > 0 ? sum((r) => r.deaths) / n : 0,
    avgEventCount: n > 0 ? sum((r) => r.eventCount) / n : 0,

    avgSteps: n > 0 ? sum((r) => r.steps) / n : 0,
    totalSteps: sum((r) => r.steps),

    /* --- Phase 3A 玩法统计聚合 --- */
    attackStyleCounts: mergeCounts((r) => r.attackStyleCounts, results),
    exposedApplied: sum((r) => r.exposedApplied),
    exposedConsumed: sum((r) => r.exposedConsumed),
    guardResolves: sum((r) => r.guardResolves),
    skillUseCounts: mergeCounts((r) => r.skillUseCounts, results),
    worldEventCounts: mergeCounts((r) => r.worldEventCounts, results),
    commandCounts: mergeCounts((r) => r.commandCounts, results),
  };
}

/** 把多局结果的 { key: count } 字典按 key 累加 */
function mergeCounts(
  pick: (r: AutoGameResult) => Record<string, number>,
  results: AutoGameResult[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of results) {
    for (const [k, v] of Object.entries(pick(r))) {
      out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 报告                                                                */
/* ------------------------------------------------------------------ */

/** 全局汇总的稳定形状（此前错误地引用了不存在的 aggregateGlobal 函数类型） */
export interface GlobalSummary {
  totalGames: number;
  trustworthyGames: number;
  trustworthyRate: number;
  outcomeCounts: Record<AutoGameOutcome, number>;
  winRate: number;
  lossRate: number;
  drawRate: number;
  survivalRate: number;
  timeoutRate: number;
  avgTimeUsed: number;
  avgPlayerRank: number;
  avgKills: number;
  avgDamageDealt: number;
  avgDamageTaken: number;
}

interface BalanceReport {
  meta: {
    tool: 'phase3-balance';
    version: string;
    generatedAt: string;
    config: {
      /* --- P3-P1 局数分配（四个字段必须同时出现） --- */
      /** games 参数的语义：'total'（--games）或 'per-cell'（--games-per-cell） */
      gamesMode: GamesMode;
      /** 用户请求的总对局数 */
      requestedTotalGames: number;
      /** 实际跑完的总对局数（应恒等于 requestedTotalGames） */
      actualTotalGames: number;
      /** 每格基准局数 */
      gamesPerCell: number;
      /** 每格实际局数明细 */
      distribution: CellPlan[];
      /** cell 数量（角色数 × 策略数） */
      cellCount: number;

      seedPrefix: string;
      characters: string[];
      policies: string[];
      hardTimeLimit: number;
      totalContestants: number;
      maxSteps: number;
    };
    /** 健康红线：三者全为 0 才 PASS */
    health: {
      timeout: { count: number; flagged: boolean };
      illegalState: { count: number; flagged: boolean };
      hardLimitReached: { count: number; flagged: boolean };
      engineHealthy: boolean;
    };
    /** 角色平衡验收（Phase 2A-1：最高/最低非零胜率比 < 2.5，不允许 0 胜率） */
    characterBalance: {
      perCharacterWinRate: Record<string, number>;
      highestWinRate: number;
      lowestNonZeroWinRate: number;
      ratio: number;
      threshold: number;
      zeroWinCharacters: string[];
      passed: boolean;
    };
    /** Phase 3A 玩法使用率与事件覆盖验收（Step 9/10/14） */
    phase3a: {
      attackStyleCounts: Record<string, number>;
      attackTotal: number;
      styleUsageRate: Record<string, number>;
      quickPassed: boolean;
      heavyPassed: boolean;
      guardCommandCount: number;
      totalCommands: number;
      guardUsageRate: number;
      guardPassed: boolean;
      guardResolves: number;
      exposedApplied: number;
      exposedConsumed: number;
      skillUseCounts: Record<string, number>;
      worldEventCounts: Record<string, number>;
      worldEventTarget: number;
      worldEventCoveragePassed: boolean;
      threshold: number;
      passed: boolean;
    };
    /** 整体判定 = 引擎健康 && 角色平衡 && Phase 3A 玩法验收（规格 §六） */
    overallPassed: boolean;
    summary: GlobalSummary;
  };
  characterSummary: Record<string, CellStats>;
  policySummary: Record<string, CellStats>;
  matrix: CellStats[];
}

function buildReport(opts: CliOptions, cells: CellStats[]): BalanceReport {
  // character / policy 汇总：对每个 cell 已含的真实结果按 games 加权平均，
  // 与原始结果完全一致（不重新跑对局）。
  const makeSummary = (subset: CellStats[]): CellStats => {
    const totalGames = subset.reduce((a, c) => a + c.games, 0);
    const sum = (f: (c: CellStats) => number): number =>
      subset.reduce((a, c) => a + f(c), 0);
    const w = (f: (c: CellStats) => number): number =>
      totalGames > 0 ? sum((c) => f(c) * c.games) / totalGames : 0;
    const wins = sum((c) => c.wins);
    const losses = sum((c) => c.losses);
    const draws = sum((c) => c.draws);
    const timeouts = sum((c) => c.timeouts);
    const survival = sum((c) => c.survivalCount);
    const hard = sum((c) => c.hardLimitCount);
    const illegal = sum((c) => c.illegalCount);
    const dead = sum((c) => c.deadlockCount);
    const st = sum((c) => c.stalledCount);
    const emp = sum((c) => c.emptyLegalSetCount);
    const ic = sum((c) => c.illegalCommandCount);
    const trust = sum((c) => c.trustworthyCount);

    return {
      characterId: 'ALL',
      characterName: '汇总',
      policy: 'ALL' as AutoPlayerPolicy,
      games: totalGames,

      wins,
      losses,
      draws,
      timeouts,

      winRate: totalGames ? wins / totalGames : 0,
      lossRate: totalGames ? losses / totalGames : 0,
      drawRate: totalGames ? draws / totalGames : 0,
      timeoutRate: totalGames ? timeouts / totalGames : 0,

      survivalCount: survival,
      survivalRate: totalGames ? survival / totalGames : 0,

      trustworthyCount: trust,
      trustworthyRate: totalGames ? trust / totalGames : 0,

      hardLimitCount: hard,
      hardLimitRate: totalGames ? hard / totalGames : 0,

      illegalCount: illegal,
      illegalRate: totalGames ? illegal / totalGames : 0,
      deadlockCount: dead,
      stalledCount: st,
      emptyLegalSetCount: emp,
      illegalCommandCount: ic,

      avgTimeUsed: w((c) => c.avgTimeUsed),
      bestRank: subset.length ? Math.min(...subset.map((c) => c.bestRank)) : 0,
      worstRank: subset.length ? Math.max(...subset.map((c) => c.worstRank)) : 0,
      avgPlayerRank: w((c) => c.avgPlayerRank),
      avgKills: w((c) => c.avgKills),
      avgDamageDealt: w((c) => c.avgDamageDealt),
      avgDamageTaken: w((c) => c.avgDamageTaken),

      avgSearches: w((c) => c.avgSearches),
      avgCrafts: w((c) => c.avgCrafts),
      avgMoves: w((c) => c.avgMoves),
      avgAttacks: w((c) => c.avgAttacks),
      avgItemsUsed: w((c) => c.avgItemsUsed),

      avgPlayerHp: w((c) => c.avgPlayerHp),
      avgPlayerStamina: w((c) => c.avgPlayerStamina),
      avgPlayerInventorySize: w((c) => c.avgPlayerInventorySize),

      avgZonesExhausted: w((c) => c.avgZonesExhausted),
      avgDeaths: w((c) => c.avgDeaths),
      avgEventCount: w((c) => c.avgEventCount),

      avgSteps: w((c) => c.avgSteps),
      totalSteps: sum((c) => c.totalSteps),

      /* --- Phase 3A 玩法统计聚合（计数直接求和） --- */
      attackStyleCounts: mergeSummaryCounts(subset, (c) => c.attackStyleCounts),
      exposedApplied: sum((c) => c.exposedApplied),
      exposedConsumed: sum((c) => c.exposedConsumed),
      guardResolves: sum((c) => c.guardResolves),
      skillUseCounts: mergeSummaryCounts(subset, (c) => c.skillUseCounts),
      worldEventCounts: mergeSummaryCounts(subset, (c) => c.worldEventCounts),
      commandCounts: mergeSummaryCounts(subset, (c) => c.commandCounts),
    };
  };

  const mergeSummaryCounts = (
    subset: CellStats[],
    pick: (c: CellStats) => Record<string, number>,
  ): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const c of subset) {
      for (const [k, v] of Object.entries(pick(c))) {
        out[k] = (out[k] ?? 0) + v;
      }
    }
    return out;
  };

  const characterIds = [...new Set(cells.map((c) => c.characterId))];
  const policyIds = [...new Set(cells.map((c) => c.policy))];

  const characterSummary: Record<string, CellStats> = {};
  for (const id of characterIds) {
    characterSummary[id] = makeSummary(cells.filter((c) => c.characterId === id));
    characterSummary[id]!.characterId = id;
    characterSummary[id]!.characterName = CHARACTERS.find((d) => d.id === id)?.name ?? id;
  }
  const policySummary: Record<string, CellStats> = {};
  for (const id of policyIds) {
    policySummary[id] = makeSummary(cells.filter((c) => c.policy === id));
    policySummary[id]!.policy = id as AutoPlayerPolicy;
  }

  const timeoutCount = sumGlobal(cells, (c) => c.timeouts);
  const illegalCount = sumGlobal(cells, (c) => c.illegalCount);
  const hardLimitCount = sumGlobal(cells, (c) => c.hardLimitCount);

  const global = aggregateGlobalFromCells(cells);

  /* --- 角色平衡验收（Phase 2A-1） --- */
  const perCharacterWinRate: Record<string, number> = {};
  for (const id of characterIds) {
    perCharacterWinRate[id] = characterSummary[id]?.winRate ?? 0;
  }
  const rates = Object.values(perCharacterWinRate);
  const highestWinRate = rates.length > 0 ? Math.max(...rates) : 0;
  const nonZero = rates.filter((r) => r > 0);
  const lowestNonZeroWinRate = nonZero.length > 0 ? Math.min(...nonZero) : 0;
  const ratio =
    lowestNonZeroWinRate > 0 ? highestWinRate / lowestNonZeroWinRate : Infinity;
  const zeroWinCharacters = characterIds.filter(
    (id) => (perCharacterWinRate[id] ?? 0) === 0,
  );
  const BALANCE_THRESHOLD = 2.5;
  const characterBalancePassed =
    zeroWinCharacters.length === 0 && ratio < BALANCE_THRESHOLD;

  /* --- Phase 3A 玩法使用率与事件覆盖验收（Step 9/10/14） --- */
  const all = makeSummary(cells);
  const attackStyleCounts = all.attackStyleCounts;
  const attackTotal =
    (attackStyleCounts.quick ?? 0) +
    (attackStyleCounts.normal ?? 0) +
    (attackStyleCounts.heavy ?? 0);
  const styleUsageRate: Record<string, number> = {};
  for (const [k, v] of Object.entries(attackStyleCounts)) {
    styleUsageRate[k] = attackTotal > 0 ? v / attackTotal : 0;
  }
  const totalCommands = Object.values(all.commandCounts).reduce((a, b) => a + b, 0);
  const guardCommandCount = all.commandCounts.GUARD ?? 0;
  const guardUsageRate = totalCommands > 0 ? guardCommandCount / totalCommands : 0;
  const PHASE3A_THRESHOLD = 0.02; // quick / heavy / guard 各 ≥ 2%
  const quickPassed = (styleUsageRate.quick ?? 0) >= PHASE3A_THRESHOLD;
  const heavyPassed = (styleUsageRate.heavy ?? 0) >= PHASE3A_THRESHOLD;
  const guardPassed = guardUsageRate >= PHASE3A_THRESHOLD;
  // 世界事件覆盖：6 种事件在正式 3000 局规模下各 ≥ 50 次
  const WORLD_EVENT_TARGET = 50;
  const worldEventCounts = all.worldEventCounts;
  const worldEventCoveragePassed = WORLD_EVENT_IDS.every(
    (id) => (worldEventCounts[id] ?? 0) >= WORLD_EVENT_TARGET,
  );
  const phase3aPassed =
    quickPassed && heavyPassed && guardPassed && worldEventCoveragePassed;

  const engineHealthy = timeoutCount === 0 && illegalCount === 0 && hardLimitCount === 0;

  const dist = distributionFromCells(opts, cells);

  return {
    meta: {
      tool: 'phase3-balance',
      version: GAME_VERSION,
      generatedAt: new Date().toISOString(),
      config: {
        gamesMode: dist.mode,
        requestedTotalGames: dist.requestedTotalGames,
        actualTotalGames: dist.actualTotalGames,
        gamesPerCell: dist.gamesPerCell,
        distribution: dist.distribution,
        cellCount: dist.cellCount,

        seedPrefix: opts.seedPrefix,
        characters: characterIds,
        policies: policyIds,
        hardTimeLimit: GAME_CONFIG.hardTimeLimit,
        totalContestants: GAME_CONFIG.totalContestants,
        maxSteps: GAME_CONFIG.hardTimeLimit * 4 + 200,
      },
      health: {
        timeout: { count: timeoutCount, flagged: timeoutCount > 0 },
        illegalState: { count: illegalCount, flagged: illegalCount > 0 },
        hardLimitReached: { count: hardLimitCount, flagged: hardLimitCount > 0 },
        engineHealthy,
      },
      characterBalance: {
        perCharacterWinRate,
        highestWinRate,
        lowestNonZeroWinRate,
        ratio,
        threshold: BALANCE_THRESHOLD,
        zeroWinCharacters,
        passed: characterBalancePassed,
      },
      phase3a: {
        attackStyleCounts,
        attackTotal,
        styleUsageRate,
        quickPassed,
        heavyPassed,
        guardCommandCount,
        totalCommands,
        guardUsageRate,
        guardPassed,
        guardResolves: all.guardResolves,
        exposedApplied: all.exposedApplied,
        exposedConsumed: all.exposedConsumed,
        skillUseCounts: all.skillUseCounts,
        worldEventCounts,
        worldEventTarget: WORLD_EVENT_TARGET,
        worldEventCoveragePassed,
        threshold: PHASE3A_THRESHOLD,
        passed: phase3aPassed,
      },
      overallPassed: engineHealthy && characterBalancePassed && phase3aPassed,
      summary: global,
    },
    characterSummary,
    policySummary,
    matrix: cells,
  };
}

function sumGlobal(cells: CellStats[], f: (c: CellStats) => number): number {
  return cells.reduce((a, c) => a + f(c), 0);
}

/**
 * 从**已经跑完**的 cell 统计里回算局数分配。
 *
 * 之所以不直接复用 `planGames` 的输出，是为了让报告里的 `actualTotalGames`
 * 反映引擎真正跑过的局数——若两者不一致，说明分配或执行环节出了 bug，
 * 报告会如实暴露而不是掩盖。
 */
function distributionFromCells(
  opts: Pick<CliOptions, 'gamesMode' | 'games'>,
  cells: CellStats[],
): GamesDistribution {
  const cellCount = cells.length;
  const actualTotalGames = cells.reduce((a, c) => a + c.games, 0);
  const requestedTotalGames =
    opts.gamesMode === 'total' ? opts.games : opts.games * cellCount;
  const gamesPerCell =
    opts.gamesMode === 'total'
      ? cellCount > 0
        ? Math.floor(opts.games / cellCount)
        : 0
      : opts.games;
  return {
    mode: opts.gamesMode,
    cellCount,
    requestedTotalGames,
    actualTotalGames,
    gamesPerCell,
    distribution: cells.map((c) => ({
      characterId: c.characterId,
      policy: c.policy,
      games: c.games,
    })),
  };
}

/**
 * 从已聚合的 cell 统计数据里重建全局汇总（按 games 加权）。
 * 这样即便调用方只拿到了 cell 列表，也能得到一致的全局数字。
 */
function aggregateGlobalFromCells(
  cells: CellStats[],
): GlobalSummary {
  const totalGames = cells.reduce((a, c) => a + c.games, 0);
  const sum = (f: (c: CellStats) => number): number =>
    cells.reduce((a, c) => a + f(c), 0);
  const w = (f: (c: CellStats) => number): number =>
    totalGames > 0 ? sum((c) => f(c) * c.games) / totalGames : 0;

  const outcomeCounts = {
    won: sum((c) => c.wins),
    lost: sum((c) => c.losses),
    draw: sum((c) => c.draws),
    timeout: sum((c) => c.timeouts),
  };
  const pct = (x: number): number => (totalGames > 0 ? x / totalGames : 0);

  return {
    totalGames,
    trustworthyGames: sum((c) => c.trustworthyCount),
    trustworthyRate: pct(sum((c) => c.trustworthyCount)),
    outcomeCounts,
    winRate: pct(outcomeCounts.won),
    lossRate: pct(outcomeCounts.lost),
    drawRate: pct(outcomeCounts.draw),
    survivalRate: pct(sum((c) => c.survivalCount)),
    timeoutRate: pct(outcomeCounts.timeout),
    avgTimeUsed: w((c) => c.avgTimeUsed),
    avgPlayerRank: w((c) => c.avgPlayerRank),
    avgKills: w((c) => c.avgKills),
    avgDamageDealt: w((c) => c.avgDamageDealt),
    avgDamageTaken: w((c) => c.avgDamageTaken),
  };
}

/* ------------------------------------------------------------------ */
/* Markdown 渲染                                                       */
/* ------------------------------------------------------------------ */

function fmtPct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
function fmtNum(x: number): string {
  return x.toFixed(1);
}

function renderMarkdown(report: BalanceReport): string {
  const { meta } = report;
  const L: string[] = [];
  const bar = '#'.repeat(64);

  L.push('# Phase 3 平衡模拟报告');
  L.push('');
  L.push(`- 版本：${meta.version}`);
  L.push(`- 生成时间：${meta.generatedAt}`);
  L.push(
    `- 矩阵：${meta.config.characters.length} 角色 × ${meta.config.policies.length} 策略 = ${meta.config.cellCount} 格`,
  );
  L.push(`- 种子前缀：${meta.config.seedPrefix}`);
  L.push('');

  // ---- P3-P1：局数分配（必须显示的四个字段） ----
  L.push('## 局数分配（P3-P1）');
  L.push('');
  L.push(`| 字段 | 值 |`);
  L.push(`| --- | --- |`);
  L.push(
    `| gamesMode | ${meta.config.gamesMode}（${meta.config.gamesMode === 'total' ? '--games = 总对局数' : '--games-per-cell = 每格局数'}） |`,
  );
  L.push(`| requestedTotalGames | ${meta.config.requestedTotalGames} |`);
  L.push(`| actualTotalGames | ${meta.config.actualTotalGames} |`);
  L.push(`| gamesPerCell（基准） | ${meta.config.gamesPerCell} |`);
  L.push(`| cellCount | ${meta.config.cellCount} |`);
  L.push(
    `| 请求 = 实际 | ${meta.config.requestedTotalGames === meta.config.actualTotalGames ? '✓' : '✗ **不一致，属缺陷**'} |`,
  );
  L.push('');
  L.push('<details><summary>distribution（每格实际局数）</summary>');
  L.push('');
  L.push('| # | 角色 | 策略 | 局数 |');
  L.push('| ---: | --- | --- | ---: |');
  meta.config.distribution.forEach((d, i) => {
    L.push(`| ${i + 1} | ${d.characterId} | ${d.policy} | ${d.games} |`);
  });
  L.push('');
  L.push('</details>');
  L.push('');

  // ---- 健康红线 ----
  L.push('## 引擎健康红线（FAIL 条件）');
  L.push('');
  const h = meta.health;
  L.push(`- timeout（跑到步数上限仍未结束）：${h.timeout.count}  →  ${h.timeout.flagged ? '**FAIL**' : 'OK'}`);
  L.push(`- illegalState（合法集合被拒 / 死锁 / livelock / 空集合）：${h.illegalState.count}  →  ${h.illegalState.flagged ? '**FAIL**' : 'OK'}`);
  L.push(`- hardLimitReached（触及 180 硬上限）：${h.hardLimitReached.count}  →  ${h.hardLimitReached.flagged ? '**FAIL**' : 'OK'}`);
  L.push('');
  L.push(`**引擎整体判定：${h.engineHealthy ? 'PASS' : 'FAIL'}**`);
  L.push('');
  L.push('> 说明：timeout 在 Step 13 的 `enforceTimeLimit` 落地后会由 `playing → draw` 收束而归零；');
  L.push('> illegalState 与 hardLimitReached 必须始终为 0。本报告**不设胜率门槛**——低胜率属结构性。');
  L.push('');

  // ---- 角色平衡验收（Phase 2A-1） ----
  L.push('## 角色平衡验收（最高/最低非零胜率比 < 2.5）');
  L.push('');
  const cb = meta.characterBalance;
  L.push(`| 指标 | 值 |`);
  L.push(`| --- | --- |`);
  L.push(`| 最高胜率 | ${fmtPct(cb.highestWinRate)} |`);
  L.push(`| 最低非零胜率 | ${fmtPct(cb.lowestNonZeroWinRate)} |`);
  L.push(`| 比值 | ${cb.ratio === Infinity ? '∞（存在 0 胜率角色）' : cb.ratio.toFixed(2)} |`);
  L.push(`| 阈值 | ${cb.threshold} |`);
  L.push(`| 0 胜率角色 | ${cb.zeroWinCharacters.length === 0 ? '无' : cb.zeroWinCharacters.join('、')} |`);
  L.push(`| 判定 | ${cb.passed ? '**PASS**' : '**FAIL**'} |`);
  L.push('');
  const p3 = meta.phase3a;
  L.push(`**整体判定：${meta.overallPassed ? 'PASS' : 'FAIL'}**（= 引擎健康 ${h.engineHealthy ? '✓' : '✗'} && 角色平衡 ${cb.passed ? '✓' : '✗'} && Phase 3A 玩法 ${p3.passed ? '✓' : '✗'}）`);
  L.push('');

  // ---- Phase 3A 玩法使用率与事件覆盖（Step 9/10/14） ----
  L.push('## Phase 3A 玩法使用率与事件覆盖验收');
  L.push('');
  L.push('### 攻击风格（玩家侧全部攻击动作）');
  L.push('');
  L.push('| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |');
  L.push('| --- | ---: | ---: | --- | --- |');
  L.push(
    `| quick | ${p3.attackStyleCounts.quick ?? 0} | ${fmtPct(p3.styleUsageRate.quick ?? 0)} | ${fmtPct(p3.threshold)} | ${p3.quickPassed ? '**PASS**' : '**FAIL**'} |`,
  );
  L.push(
    `| normal | ${p3.attackStyleCounts.normal ?? 0} | ${fmtPct(p3.styleUsageRate.normal ?? 0)} | - | - |`,
  );
  L.push(
    `| heavy | ${p3.attackStyleCounts.heavy ?? 0} | ${fmtPct(p3.styleUsageRate.heavy ?? 0)} | ${fmtPct(p3.threshold)} | ${p3.heavyPassed ? '**PASS**' : '**FAIL**'} |`,
  );
  L.push(`| 合计 | ${p3.attackTotal} | 100% | - | - |`);
  L.push('');
  L.push('### 防御姿态与 Heavy 风险');
  L.push('');
  L.push('| 指标 | 值 | 门槛 | 判定 |');
  L.push('| --- | ---: | --- | --- |');
  L.push(
    `| GUARD 命令次数 | ${p3.guardCommandCount} | - | - |`,
  );
  L.push(
    `| GUARD 使用率（占全部命令） | ${fmtPct(p3.guardUsageRate)} | ${fmtPct(p3.threshold)} | ${p3.guardPassed ? '**PASS**' : '**FAIL**'} |`,
  );
  L.push(`| 防御成功减免次数 | ${p3.guardResolves} | - | - |`);
  L.push(`| EXPOSED 施加（重击挥空） | ${p3.exposedApplied} | - | - |`);
  L.push(`| EXPOSED 兑现（破绽被击中） | ${p3.exposedConsumed} | - | - |`);
  L.push('');
  L.push('### 技能使用（按技能）');
  L.push('');
  L.push('| 技能 | 使用次数 |');
  L.push('| --- | ---: |');
  const skillEntries = Object.entries(p3.skillUseCounts).sort((a, b) => b[1] - a[1]);
  if (skillEntries.length === 0) {
    L.push('| （无技能被使用） | 0 |');
  } else {
    for (const [sid, n] of skillEntries) L.push(`| ${sid} | ${n} |`);
  }
  L.push('');
  L.push('### 世界事件触发覆盖（正式规模下各 ≥ 50 次）');
  L.push('');
  L.push('| 事件 | 触发次数 | 门槛 | 判定 |');
  L.push('| --- | ---: | ---: | --- |');
  for (const id of WORLD_EVENT_IDS) {
    const n = p3.worldEventCounts[id] ?? 0;
    L.push(`| ${id} | ${n} | ${p3.worldEventTarget} | ${n >= p3.worldEventTarget ? '✓' : '**FAIL**'} |`);
  }
  L.push('');
  L.push(
    `**Phase 3A 玩法整体判定：${p3.passed ? 'PASS' : 'FAIL'}**（quick ${p3.quickPassed ? '✓' : '✗'} / heavy ${p3.heavyPassed ? '✓' : '✗'} / guard ${p3.guardPassed ? '✓' : '✗'} / 事件覆盖 ${p3.worldEventCoveragePassed ? '✓' : '✗'}）`,
  );
  L.push('');

  // ---- 全局摘要 ----
  L.push('## 全局摘要');
  L.push('');
  const s = meta.summary;
  L.push(`| 指标 | 值 |`);
  L.push(`| --- | --- |`);
  L.push(`| 总对局 | ${s.totalGames} |`);
  L.push(`| 可信对局率 | ${fmtPct(s.trustworthyRate)} |`);
  L.push(`| 胜率 | ${fmtPct(s.winRate)} |`);
  L.push(`| 败率 | ${fmtPct(s.lossRate)} |`);
  L.push(`| 平局率 | ${fmtPct(s.drawRate)} |`);
  L.push(`| 超时率 | ${fmtPct(s.timeoutRate)} |`);
  L.push(`| 存活率 | ${fmtPct(s.survivalRate)} |`);
  L.push(`| 平均时长 | ${fmtNum(s.avgTimeUsed)} 时间单位 |`);
  L.push(`| 平均名次 | ${fmtNum(s.avgPlayerRank)}（理论 ${((s.totalGames ? meta.config.totalContestants : 6) - 1) / 2 + 1} 为全灭）|`);
  L.push(`| 平均击杀 | ${fmtNum(s.avgKills)} |`);
  L.push(`| 平均造成伤害 | ${fmtNum(s.avgDamageDealt)} |`);
  L.push(`| 平均承受伤害 | ${fmtNum(s.avgDamageTaken)} |`);
  L.push('');

  // ---- 矩阵 ----
  L.push('## 角色 × 策略矩阵');
  L.push('');
  L.push('| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |');
  L.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const c of report.matrix) {
    const flag = c.timeoutRate > 0 || c.illegalRate > 0 || c.hardLimitRate > 0 ? ' ⚠' : '';
    L.push(
      `| ${c.characterName} | ${c.policy} | ${c.games} | ${c.wins} | ${c.losses} | ${c.draws} | ${c.timeouts} | ${fmtPct(c.survivalRate)} | ${fmtPct(c.trustworthyRate)} | ${c.hardLimitCount} | ${c.illegalCount} | ${fmtNum(c.avgPlayerRank)} | ${fmtNum(c.avgKills)} | ${fmtNum(c.avgTimeUsed)} |${flag}`,
    );
  }
  L.push('');

  // ---- 按角色汇总 ----
  L.push('## 按角色汇总（行平均）');
  L.push('');
  L.push('| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |');
  L.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const id of meta.config.characters) {
    const c = report.characterSummary[id];
    if (!c) continue;
    L.push(
      `| ${c.characterName} | ${c.games} | ${fmtPct(c.winRate)} | ${fmtPct(c.survivalRate)} | ${fmtPct(c.trustworthyRate)} | ${fmtNum(c.avgPlayerRank)} | ${fmtNum(c.avgKills)} | ${fmtNum(c.avgDamageTaken)} |`,
    );
  }
  L.push('');

  // ---- 按策略汇总 ----
  L.push('## 按策略汇总（列平均）');
  L.push('');
  L.push('| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |');
  L.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const id of meta.config.policies) {
    const c = report.policySummary[id];
    if (!c) continue;
    L.push(
      `| ${id} | ${c.games} | ${fmtPct(c.winRate)} | ${fmtPct(c.survivalRate)} | ${fmtPct(c.trustworthyRate)} | ${fmtNum(c.avgPlayerRank)} | ${fmtNum(c.avgKills)} | ${fmtNum(c.avgDamageTaken)} |`,
    );
  }
  L.push('');

  L.push(bar);
  return L.join('\n');
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */

function run(opts: CliOptions): BalanceReport {
  const characters = opts.character
    ? [opts.character]
    : CHARACTERS.map((c) => c.id);
  const policies = opts.policy
    ? [opts.policy as AutoPlayerPolicy]
    : [...AUTO_PLAYER_POLICIES];

  // P3-P1：先算出每格该跑多少局，再按计划执行
  const plan = planGames(characters, policies, opts);

  const cells: CellStats[] = [];
  for (const cellPlan of plan.distribution) {
    const def = CHARACTERS.find((c) => c.id === cellPlan.characterId)!;
    const results: AutoGameResult[] = [];
    for (let i = 0; i < cellPlan.games; i++) {
      const seed = `${opts.seedPrefix}${cellPlan.characterId}-${cellPlan.policy}-${i}`;
      results.push(
        runAutoGame({
          seed,
          characterId: cellPlan.characterId,
          policy: cellPlan.policy,
          playerName: `Auto-${cellPlan.policy}`,
        }),
      );
    }
    cells.push(aggregateCell(def.id, def.name, cellPlan.policy, results));
  }

  return buildReport(opts, cells);
}

function main(): void {
  let opts: CliOptions;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    // 参数错误：打印帮助并以 exit code 1 退出（规格 §七）
    // eslint-disable-next-line no-console
    console.error(`[phase3-balance] 参数错误：${err instanceof Error ? err.message : String(err)}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  const characters = opts.character ? [opts.character] : CHARACTERS.map((c) => c.id);
  const policies = opts.policy
    ? [opts.policy as AutoPlayerPolicy]
    : [...AUTO_PLAYER_POLICIES];
  const plan = planGames(characters, policies, opts);

  // eslint-disable-next-line no-console
  console.log(
    `[phase3-balance] 运行矩阵：${opts.character ?? '全角色'} × ${opts.policy ?? '全策略'} = ${plan.cellCount} 格；` +
      `模式 ${plan.mode}；请求总局数 ${plan.requestedTotalGames}，实际 ${plan.actualTotalGames}，每格基准 ${plan.gamesPerCell} 局…`,
  );
  if (plan.mode === 'total' && plan.gamesPerCell === 0 && plan.cellCount > 1) {
    // eslint-disable-next-line no-console
    console.warn(
      `[phase3-balance] 警告：总局数 ${plan.requestedTotalGames} < cell 数 ${plan.cellCount}，` +
        `有 ${plan.cellCount - (plan.requestedTotalGames % plan.cellCount)} 个 cell 将跑 0 局，统计结论不可用于平衡验收。`,
    );
  }

  const report = run(opts);

  const jsonPath = opts.output;
  const mdPath = jsonPath.replace(/\.json$/, '') + '.md';
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(mdPath, renderMarkdown(report), 'utf8');

  const h = report.meta.health;
  const cb = report.meta.characterBalance;
  const p3 = report.meta.phase3a;
  // eslint-disable-next-line no-console
  console.log(
    `[phase3-balance] 完成：requestedTotalGames=${report.meta.config.requestedTotalGames} ` +
      `actualTotalGames=${report.meta.config.actualTotalGames} ` +
      `gamesPerCell=${report.meta.config.gamesPerCell} ` +
      `cells=${report.meta.config.cellCount}，` +
      `胜率 ${fmtPct(report.meta.summary.winRate)}，` +
      `可信率 ${fmtPct(report.meta.summary.trustworthyRate)}，` +
      `引擎判定 ${h.engineHealthy ? 'PASS' : 'FAIL'}` +
      (h.engineHealthy ? '' : `（timeout=${h.timeout.count} illegal=${h.illegalState.count} hardLimit=${h.hardLimitReached.count}）`) +
      `，角色平衡 ${cb.passed ? 'PASS' : 'FAIL'}` +
      (cb.passed ? '' : `（ratio=${cb.ratio === Infinity ? '∞' : cb.ratio.toFixed(2)}，0胜率=${cb.zeroWinCharacters.join('、') || '无'}）`) +
      `，Phase 3A ${p3.passed ? 'PASS' : 'FAIL'}` +
      (p3.passed
        ? ''
        : `（quick=${p3.quickPassed ? '✓' : '✗'} heavy=${p3.heavyPassed ? '✓' : '✗'} guard=${p3.guardPassed ? '✓' : '✗'} 事件覆盖=${p3.worldEventCoveragePassed ? '✓' : '✗'}）`),
  );
  // eslint-disable-next-line no-console
  console.log(`[phase3-balance] 整体判定：${report.meta.overallPassed ? 'PASS' : 'FAIL'}`);
  // eslint-disable-next-line no-console
  console.log(`[phase3-balance] 报告已写入：\n  ${jsonPath}\n  ${mdPath}`);
  if (!report.meta.overallPassed) {
    process.exitCode = 1;
  }
}

// 仅在作为入口直接运行时执行（便于被测试导入而不触发副作用）
const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('simulateBalance.ts') ||
    process.argv[1].endsWith('simulateBalance.js') ||
    fileURLToPath(import.meta.url) === pathToFileURL(process.argv[1]).href);

if (isMain) {
  main();
}

export {
  run,
  buildReport,
  parseArgs,
  aggregateCell,
  renderMarkdown,
  distributionFromCells,
  type BalanceReport,
  type CellStats,
  type CliOptions,
};
