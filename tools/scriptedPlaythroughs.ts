/**
 * Phase 3 · Scripted Playthrough（脚本化完整对局）记录器。
 *
 * ── P3-P3：不再冒充人工测试（Phase 3 Preflight）──────────────────────────
 * 这个工具在 Phase 2A-1 里叫「真实手动测试记录器」，输出叫「真实手测记录」。
 * 那是**不诚实的命名**：跑的是脚本，没有任何人类坐在屏幕前点过一次按钮，
 * 也就不可能发现「按钮点不动」「文字被截断」「动画看着别扭」这类问题。
 *
 * Phase 3 起统一正名：
 *   - 工具名 / 脚本名 / 报告名一律用 **Scripted Playthrough / 脚本化完整对局**
 *   - 它验证的是「引擎能否被从头到尾完整驱动完」，**不是**可用性或手感
 *   - 真正需要人类执行的清单另见仓库根目录 `HUMAN_PLAYTEST_CHECKLIST.md`，
 *     那份清单里的结论**只能由人类填写**，AI / 脚本不得代填
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 本工具做的事：
 *   1. createGame 开局；
 *   2. 立即用 SET_CRAFT_GOAL 设定一个制作目标；
 *   3. 之后每一回合从 getLegalPlayerCommands 合法集合里选动作并 executeCommand
 *      （决策内核与自动对局控制器共用，绝不绕过规则）；
 *   4. 对局结束（won / lost / draw / timeout）后，从**真实最终状态**提取
 *      每一个字段，写入 reports/phase3-scripted-playthroughs.md。
 *
 * 用法：
 *   npm run scripted:playthroughs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGame } from '../src/core/gameState';
import { executeCommand } from '../src/core/gameEngine';
import { getLegalPlayerCommands } from '../src/core/legalActions';
import { SeededRandom } from '../src/core/random';
import { GAME_CONFIG, GAME_VERSION } from '../src/data/gameConfig';
import { decideAutoPlayerCommand } from './autoPlayer';
import { getCraftGoalRecommendations, describeCraftGoal } from '../src/core/craftGuide';
import { getEquippedArmor, getEquippedWeapon } from '../src/core/inventory';
import { getCharacterSkill, SKILLS } from '../src/core/skills';
import { getItem, tryGetItem } from '../src/data/items';
import { getZoneDef } from '../src/data/zones';
import type { AutoPlayerPolicy } from './autoPlayer';
import type { Command, DynamicEventType, GameState } from '../src/core/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ScriptedPlaythroughRecord {
  seed: string;
  characterId: string;
  policy: AutoPlayerPolicy;
  outcome: 'won' | 'lost' | 'draw' | 'timeout';
  rank: number;
  timeUsed: number;
  endReason: string;
  craftGoalRecipeId: string | null;
  craftGoalCompleted: boolean;
  craftGoalDesc: string;
  recommendedZones: string[];
  finalZone: string;
  visitedRecommended: boolean;
  finalWeapon: string;
  finalArmor: string;
  finalInventory: string;
  kills: number;
  damageTaken: number;
  steps: number;
  stuck: boolean;
  issues: string[];
  /** Phase 3 Step 8：玩家专属技能覆盖 */
  playerSkill: string;
  skillUses: number;
  /** Phase 3 Step 8：动态事件覆盖（按子类型统计） */
  dynamicEvents: Record<DynamicEventType, number>;
  dynamicEventTotal: number;
}

/**
 * 8 局脚本化完整对局（Phase 3 §Step 9 要求 8 局）。
 * 覆盖 4 个角色 × 5 种策略中的 8 种组合，每局一个不同的制作目标。
 */
const RUNS: Array<{
  seed: string;
  characterId: string;
  goal: string;
  policy: AutoPlayerPolicy;
}> = [
  { seed: 'SPT-1', characterId: 'scout', goal: 'r_stick', policy: 'cautious' },
  { seed: 'SPT-2', characterId: 'fighter', goal: 'r_iron_pipe', policy: 'aggressive' },
  { seed: 'SPT-3', characterId: 'engineer', goal: 'r_stun_rod', policy: 'collector' },
  { seed: 'SPT-4', characterId: 'medic', goal: 'r_medkit', policy: 'cautious' },
  { seed: 'SPT-5', characterId: 'scout', goal: 'r_simple_bow', policy: 'opportunist' },
  { seed: 'SPT-6', characterId: 'fighter', goal: 'r_plate_armor', policy: 'collector' },
  { seed: 'SPT-7', characterId: 'engineer', goal: 'r_stone_axe', policy: 'random' },
  { seed: 'SPT-8', characterId: 'medic', goal: 'r_herb_remedy', policy: 'aggressive' },
];

function sameType(a: Command, b: Command): boolean {
  return a.type === b.type;
}

/** 脚本化完整游玩一局，返回最终状态与过程诊断 */
function playThrough(cfg: (typeof RUNS)[number]): {
  final: GameState;
  issues: string[];
  steps: number;
  recommendedZones: string[];
} {
  let s = createGame({
    seed: cfg.seed,
    playerCharacterId: cfg.characterId,
    playerName: '脚本化对局',
  });
  const issues: string[] = [];

  // 开局设定制作目标，并在**开局状态**上记录推荐路线（不能用终局状态回算）
  const goalRes = executeCommand(s, { type: 'SET_CRAFT_GOAL', recipeId: cfg.goal });
  if (!goalRes.ok) issues.push(`设定制作目标被拒：${goalRes.message}`);
  s = goalRes.state;

  const startPlayer = s.characters[s.playerId]!;
  const recommendedZones = getCraftGoalRecommendations(s, startPlayer).map(
    (r) => getZoneDef(r.zoneId).name,
  );

  const policyRng = new SeededRandom(`${cfg.seed}::policy::${cfg.policy}`);
  let steps = 0;
  let lastTime = s.time;
  let stall = 0;

  while (s.status === 'playing' && steps < GAME_CONFIG.hardTimeLimit * 4 + 200) {
    const legal = getLegalPlayerCommands(s);
    if (legal.length === 0) {
      issues.push('合法集合为空');
      break;
    }
    const p = s.characters[s.playerId]!;
    const preferred = decideAutoPlayerCommand(s, p, cfg.policy, policyRng);
    const matched = preferred.command
      ? legal.find((a) => sameType(a.command, preferred.command!))
      : undefined;
    const pick = matched ?? legal.find((a) => a.advancesTime) ?? legal[0]!;
    const res = executeCommand(s, pick.command);
    if (!res.ok) {
      issues.push(`合法集合命令被拒：${pick.command.type}（${res.message}）`);
      break;
    }
    s = res.state;
    steps += 1;

    if (s.time === lastTime) {
      stall += 1;
      if (stall >= 16) {
        issues.push('时间停滞（livelock）');
        break;
      }
    } else {
      stall = 0;
      lastTime = s.time;
    }
  }

  if (s.status === 'playing') issues.push('超时：跑到步数上限仍未结束');
  return { final: s, issues, steps, recommendedZones };
}

function recordRun(cfg: (typeof RUNS)[number]): ScriptedPlaythroughRecord {
  const { final: s, issues, steps, recommendedZones } = playThrough(cfg);
  const p = s.characters[s.playerId]!;

  const outcome =
    s.status === 'won'
      ? 'won'
      : s.status === 'draw'
        ? 'draw'
        : s.status === 'lost'
          ? 'lost'
          : 'timeout';
  const deathIndex = s.deathOrder.indexOf(s.playerId);
  const rank = p.alive
    ? 1
    : deathIndex >= 0
      ? s.turnOrder.length - deathIndex
      : s.turnOrder.length;

  const craftGoalDesc = describeCraftGoal(s, p);
  const visitedRecommended =
    recommendedZones.length > 0 &&
    recommendedZones.includes(getZoneDef(p.currentZoneId).name);

  const weapon = getEquippedWeapon(p);
  const armor = getEquippedArmor(p);

  // 玩家专属技能覆盖（Phase 3 Step 8）
  const skillId = getCharacterSkill(p.characterId);
  const playerSkill = skillId ? SKILLS[skillId].name : '无';
  const skillUses = s.eventCounters.byType['SKILL_USED'] ?? 0;

  // 动态事件覆盖（Phase 3 Step 8）：按子类型统计
  const dynamicEvents: Record<DynamicEventType, number> = {
    storm: 0,
    supply_drop: 0,
    ambush: 0,
  };
  for (const e of s.events) {
    if (e.type === 'DYNAMIC_EVENT') {
      const sub = (e.metadata?.eventType as DynamicEventType | undefined) ?? undefined;
      if (sub && sub in dynamicEvents) dynamicEvents[sub] += 1;
    }
  }
  const dynamicEventTotal = s.eventCounters.byType['DYNAMIC_EVENT'] ?? 0;

  return {
    seed: cfg.seed,
    characterId: cfg.characterId,
    policy: cfg.policy,
    outcome,
    rank,
    timeUsed: s.endedAtTime ?? s.time,
    endReason: s.endReason ?? '—',
    craftGoalRecipeId: s.craftGoalRecipeId,
    craftGoalCompleted: s.craftGoalCompleted,
    craftGoalDesc,
    recommendedZones,
    finalZone: getZoneDef(p.currentZoneId).name,
    visitedRecommended,
    finalWeapon: weapon ? getItem(weapon.itemId).name : '徒手',
    finalArmor: armor ? getItem(armor.itemId).name : '无',
    finalInventory:
      p.inventory
        .map((st) => `${tryGetItem(st.itemId)?.name ?? st.itemId}×${st.count}`)
        .join('、') || '空',
    kills: p.kills,
    damageTaken: p.stats.damageTaken,
    steps,
    stuck: issues.length > 0,
    issues,
    playerSkill,
    skillUses,
    dynamicEvents,
    dynamicEventTotal,
  };
}

function renderMarkdown(records: ScriptedPlaythroughRecord[]): string {
  const L: string[] = [];
  const bar = '#'.repeat(64);
  L.push('# Phase 3 · Scripted Playthrough（脚本化完整对局）记录');
  L.push('');
  L.push('> **这不是人工测试。** 本报告由 `npm run scripted:playthroughs` 自动生成，');
  L.push('> 全程无人类参与操作。它能证明的只有一件事：**引擎可以被从头到尾完整驱动完，');
  L.push('> 且合法动作集合的契约始终成立**。');
  L.push('>');
  L.push('> 它**不能**证明：按钮好不好点、文案有没有被截断、动画是否流畅、');
  L.push('> 新手是否看得懂、信息层级是否合理。这些必须由真人执行');
  L.push('> [`HUMAN_PLAYTEST_CHECKLIST.md`](../HUMAN_PLAYTEST_CHECKLIST.md) 才能得出结论。');
  L.push('');
  L.push(`- 版本：${GAME_VERSION}`);
  L.push(`- 生成时间：${new Date().toISOString()}`);
  L.push(`- 局数：${records.length}`);
  L.push(
    `- 覆盖角色：${[...new Set(records.map((r) => r.characterId))].join('、')}`,
  );
  L.push(`- 覆盖策略：${[...new Set(records.map((r) => r.policy))].join('、')}`);
  L.push('');

  // ---- 汇总表 ----
  L.push('## 汇总');
  L.push('');
  L.push('| # | 种子 | 角色 | 策略 | 结果 | 名次 | 时长 | 步数 | 目标达成 | 卡死 |');
  L.push('| ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |');
  records.forEach((r, i) => {
    L.push(
      `| ${i + 1} | ${r.seed} | ${r.characterId} | ${r.policy} | ${r.outcome} | ${r.rank} | ${r.timeUsed} | ${r.steps} | ${r.craftGoalCompleted ? '✓' : '✗'} | ${r.stuck ? '**是**' : '否'} |`,
    );
  });
  L.push('');

  // ---- 逐局明细 ----
  records.forEach((r, i) => {
    L.push(`## 第 ${i + 1} 局 · ${r.seed}`);
    L.push('');
    L.push(`| 字段 | 记录 |`);
    L.push(`| --- | --- |`);
    L.push(`| 种子 | ${r.seed} |`);
    L.push(`| 角色 | ${r.characterId} |`);
    L.push(`| 决策策略 | ${r.policy} |`);
    L.push(`| 结果 | ${r.outcome}（${r.endReason}） |`);
    L.push(`| 最终名次 | ${r.rank} / ${GAME_CONFIG.totalContestants} |`);
    L.push(`| 时间 | ${r.timeUsed} 个时间单位 |`);
    L.push(`| 命令步数 | ${r.steps} |`);
    L.push(
      `| 制作目标 | ${r.craftGoalRecipeId ?? '无'}（${r.craftGoalCompleted ? '已达成' : '未完成'}） |`,
    );
    L.push(`| 目标描述 | ${r.craftGoalDesc} |`);
    L.push(`| 推荐路线（开局计算） | ${r.recommendedZones.join('、') || '无'} |`);
    L.push(
      `| 终局所在区域 | ${r.finalZone}；${r.visitedRecommended ? '命中推荐区域' : '未停留于推荐区域'} |`,
    );
    L.push(`| 最终武器 | ${r.finalWeapon} |`);
    L.push(`| 最终防具 | ${r.finalArmor} |`);
    L.push(`| 最终背包 | ${r.finalInventory} |`);
    L.push(`| 击杀 | ${r.kills} |`);
    L.push(`| 受到伤害 | ${r.damageTaken} |`);
    L.push(`| 玩家专属技能 | ${r.playerSkill} |`);
    L.push(`| 技能释放次数 | ${r.skillUses} |`);
    L.push(
      `| 动态事件（风暴 / 空投 / 伏击） | ${r.dynamicEvents.storm} / ${r.dynamicEvents.supply_drop} / ${r.dynamicEvents.ambush}（日志合计 ${r.dynamicEventTotal}） |`,
    );
    L.push(`| 是否卡死 | ${r.stuck ? '是' : '否'} |`);
    L.push(`| 引擎层面发现的问题 | ${r.issues.length > 0 ? r.issues.join('；') : '无'} |`);
    L.push('');
  });

  // ---- 技能 / 事件覆盖汇总（Phase 3 Step 8）----
  const skillCoverage = records.filter((r) => r.skillUses > 0).length;
  const eventCoverage = records.filter((r) => r.dynamicEventTotal > 0).length;
  const stormSeen = records.some((r) => r.dynamicEvents.storm > 0);
  const supplySeen = records.some((r) => r.dynamicEvents.supply_drop > 0);
  const ambushSeen = records.some((r) => r.dynamicEvents.ambush > 0);
  L.push(`## 技能 / 事件覆盖汇总（Phase 3 Step 8）`);
  L.push('');
  L.push(`- 技能被释放的对局：${skillCoverage} / ${records.length}`);
  L.push(`- 动态事件发生过的对局：${eventCoverage} / ${records.length}`);
  L.push(
    `- 动态事件子类型覆盖：风暴 ${stormSeen ? '✓' : '✗'} · 空投 ${supplySeen ? '✓' : '✗'} · 伏击 ${ambushSeen ? '✓' : '✗'}`,
  );
  L.push(
    `- 覆盖判定：${skillCoverage > 0 && eventCoverage > 0 ? '技能与事件均在本批次中得到覆盖。' : '⚠ 覆盖不足，建议补充对应策略的对局。'}`,
  );
  L.push('');

  const anyIssue = records.some((r) => r.issues.length > 0);
  L.push(`## 结论`);
  L.push('');
  L.push(`- 卡死对局：${records.filter((r) => r.stuck).length} / ${records.length}`);
  L.push(
    `- 发现问题对局：${records.filter((r) => r.issues.length > 0).length} / ${records.length}`,
  );
  L.push(
    `- 引擎层判定：${anyIssue ? '**发现需跟进的问题**' : `${records.length} 局全部完整跑完，无卡死、无 livelock、合法集合契约始终成立`}。`,
  );
  L.push('');
  L.push('- 可用性 / 视觉 / 手感层判定：**本报告不作结论**，见 `HUMAN_PLAYTEST_CHECKLIST.md`。');
  L.push('');
  L.push(bar);
  return L.join('\n');
}

function main(): void {
  const records = RUNS.map(recordRun);
  const mdPath = resolve(
    __dirname,
    '..',
    'reports',
    'phase3-scripted-playthroughs.md',
  );
  mkdirSync(dirname(mdPath), { recursive: true });
  writeFileSync(mdPath, renderMarkdown(records), 'utf8');

  // eslint-disable-next-line no-console
  console.log(
    `[scripted:playthroughs] 已完成 ${records.length} 局脚本化完整对局（角色：${[
      ...new Set(records.map((r) => r.characterId)),
    ].join('、')}）`,
  );
  for (const r of records) {
    // eslint-disable-next-line no-console
    console.log(
      `  - ${r.seed} / ${r.characterId} / ${r.policy}: ${r.outcome} rank=${r.rank} t=${r.timeUsed} steps=${r.steps} 目标完成=${r.craftGoalCompleted} 卡死=${r.stuck} 问题=${r.issues.length}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(`[scripted:playthroughs] 报告已写入：${mdPath}`);
  // eslint-disable-next-line no-console
  console.log(
    '[scripted:playthroughs] 提醒：这是脚本化对局，不等于人工测试。真人清单见 HUMAN_PLAYTEST_CHECKLIST.md',
  );

  if (records.some((r) => r.stuck)) process.exitCode = 1;
}

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('scriptedPlaythroughs.ts') ||
    process.argv[1].endsWith('scriptedPlaythroughs.js'));

if (isMain) {
  main();
}

export { recordRun, renderMarkdown, RUNS };
