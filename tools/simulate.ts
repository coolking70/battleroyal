/**
 * 旧版批量模拟入口（第二阶段遗留）。
 *
 * ⚠️ 这个脚本在 Phase 2A 已被降级为**薄壳**：
 *
 * - 原实现在时间耗尽时，会在存活者里挑出生命值最高的那个当作"胜者"。
 *   这是**伪造胜负**，直接导致第二阶段 `reports/phase2-balance.*` 的
 *   胜率数据不可信。该 reduce 比较逻辑已彻底删除，并由
 *   `tests/phase2a-acceptance.test.ts` 的 `[2A-I]` 用例长期看守——
 *   任何按生命值推断胜负的写法都会让验收测试变红。
 * - 它不再写任何报告文件。`reports/phase2-balance.json/.md` 已标记为
 *   NON_AUTHORITATIVE，权威报告是 `reports/phase2a-balance.{json,md}`。
 *
 * 现在它只做一件事：调用唯一权威的自动对局控制器 `tools/autoPlayer.ts`，
 * 打印一份**只含引擎真实结论**的结局分布，用于快速冒烟。
 *
 * 用法：
 *   npm run simulate            # 默认 200 局冒烟
 *   npm run simulate -- 1000    # 指定局数
 */

import {
  AUTO_PLAYER_POLICIES,
  runAutoGame,
  type AutoGameOutcome,
  type AutoGameResult,
} from './autoPlayer';
import { CHARACTERS as CHARACTER_DEFS } from '../src/data/characters';

const CHARACTERS = CHARACTER_DEFS.map((character) => character.id);

function parseCount(): number {
  const raw = process.argv[2];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 200;
}

function main(): void {
  const total = parseCount();
  const outcomes: Record<AutoGameOutcome, number> = {
    won: 0,
    lost: 0,
    draw: 0,
    timeout: 0,
  };
  const untrustworthy: AutoGameResult[] = [];
  let hardLimit = 0;
  let timeSum = 0;

  for (let i = 0; i < total; i++) {
    const characterId = CHARACTERS[i % CHARACTERS.length]!;
    const policy = AUTO_PLAYER_POLICIES[i % AUTO_PLAYER_POLICIES.length]!;
    const r = runAutoGame({ seed: `SMOKE-${i}`, characterId, policy });
    outcomes[r.outcome] += 1;
    if (r.hardLimitReached) hardLimit += 1;
    if (!r.trustworthy) untrustworthy.push(r);
    timeSum += r.timeUsed;
  }

  const bar = '='.repeat(52);
  const log = (line: string): void => {
    // eslint-disable-next-line no-console
    console.log(line);
  };

  log(bar);
  log('区域大逃杀 · 冒烟模拟（非权威，仅看引擎是否健康）');
  log(bar);
  log(`对局数：${total}`);
  log(`平均时长：${(timeSum / total).toFixed(1)} 个时间单位`);
  log('');
  for (const key of ['won', 'lost', 'draw', 'timeout'] as AutoGameOutcome[]) {
    const n = outcomes[key];
    log(`  ${key.padEnd(8)} ${String(n).padStart(5)}  (${((n / total) * 100).toFixed(1)}%)`);
  }
  log('');
  log(`触及 180 硬上限：${hardLimit} 局`);
  log(`不可信对局：${untrustworthy.length} 局`);
  for (const r of untrustworthy.slice(0, 5)) {
    const why = r.deadlock
      ? `死锁 @${r.deadlock.time}`
      : r.stalled
        ? '时间停滞'
        : r.emptyLegalSet
          ? '合法集合为空'
          : r.illegalCommands.length > 0
            ? `非法命令 ${r.illegalCommands[0]!.commandType}`
            : 'timeout';
    log(`  - ${r.seed} / ${r.characterId} / ${r.policy}：${why}`);
  }
  log(bar);
  log('权威平衡报告请运行：npm run simulate:balance');
  log(bar);
}

main();
