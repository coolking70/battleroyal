/**
 * Phase 3 · P3-P2 存档审计工具的异常处理契约。
 *
 * 背景（必须修的缺陷）：
 * Phase 2A-1 的 `tools/auditSaveValidation.ts` 里有这么一段——
 *     try { c.mutate(save); } catch { return { passed: true, actual: false } }
 * 只要构造损坏存档的代码自己抛异常（字段改名、结构调整、索引越界……），
 * 审计就**默认这条用例通过**。可实际上 `validateSaveData` 压根没被调用：
 * 这是用工具自身的 bug 伪造出来的绿色记录。
 *
 * Phase 3 契约：
 *   - mutate 抛异常 ⇒ constructionFailed=true、actual=null、passed=false
 *   - 只要存在任何一条构造失败，整轮审计 FAIL（驱动 `npm run audit:save` exit 1）
 *   - 「应拒却被接受」的漏判仍然独立地被检出
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CASES,
  runAudit,
  runCase,
  renderMarkdown,
  type AuditCase,
} from '../tools/auditSaveValidation';

/** 一条故意在构造阶段抛错的用例 */
const THROWING_CASE: AuditCase = {
  case: '【自测】mutate 故意抛出异常',
  expected: false,
  mutate: () => {
    throw new Error('deliberate construction failure');
  },
};

/** 一条「改了个无关紧要的东西、校验器会放行」的用例 —— 代表真正的校验漏判 */
const NOT_ACTUALLY_BROKEN_CASE: AuditCase = {
  case: '【自测】期望被拒但存档其实合法',
  expected: false,
  mutate: () => {
    /* 什么都不改：存档仍然合法，校验器必然接受 */
  },
};

describe('[Phase 3 · P3-P2] 用例构造失败必须判 FAIL', () => {
  it('mutate 抛异常 → constructionFailed=true / actual=null / passed=false', () => {
    const r = runCase(THROWING_CASE);
    expect(r.constructionFailed).toBe(true);
    expect(r.actual).toBeNull();
    expect(r.passed).toBe(false);
    expect(r.errorMessage).toContain('用例构造失败');
    expect(r.errorMessage).toContain('deliberate construction failure');
  });

  it('构造失败绝不会被记成「拒绝」', () => {
    const r = runCase(THROWING_CASE);
    // 旧实现会写成 actual=false（即「被拒绝」）—— 这正是要根除的伪造
    expect(r.actual).not.toBe(false);
    expect(r.actual).not.toBe(true);
  });

  it('整轮审计只要含一条构造失败就整体 FAIL（→ audit:save exit 1）', () => {
    const run = runAudit([...CASES, THROWING_CASE]);
    expect(run.constructionFailures).toHaveLength(1);
    expect(run.constructionFailures[0]!.case).toBe(THROWING_CASE.case);
    expect(run.failed.some((r) => r.case === THROWING_CASE.case)).toBe(true);
    expect(run.passed).toBe(false);
  });

  it('构造失败与「校验漏判」在报告里分开统计', () => {
    const run = runAudit([THROWING_CASE, NOT_ACTUALLY_BROKEN_CASE]);
    expect(run.results).toHaveLength(2);
    expect(run.constructionFailures).toHaveLength(1);
    expect(run.failed).toHaveLength(2);

    const leak = run.results.find((r) => r.case === NOT_ACTUALLY_BROKEN_CASE.case)!;
    expect(leak.constructionFailed).toBe(false);
    expect(leak.actual).toBe(true); // 校验器确实接受了
    expect(leak.passed).toBe(false); // 但期望是拒绝 → 漏判
  });

  it('Markdown 报告单列构造失败一节并给出异常信息', () => {
    const md = renderMarkdown(runAudit([THROWING_CASE]));
    expect(md).toContain('用例构造失败');
    expect(md).toContain('deliberate construction failure');
    expect(md).toContain('构造失败（校验器未被调用）');
    expect(md).toContain('FAIL');
  });
});

describe('[Phase 3 · P3-P2] 现有用例集本身必须健康', () => {
  it('全部既有损坏用例都能成功构造（无一条走构造失败分支）', () => {
    const run = runAudit(CASES);
    expect(
      run.constructionFailures.map((r) => `${r.case}: ${r.errorMessage}`),
      '存在构造失败的用例，说明用例代码与当前数据结构已经脱节',
    ).toEqual([]);
  });

  it('全部既有损坏用例都被校验器拒绝，整轮 PASS', () => {
    const run = runAudit(CASES);
    expect(run.control.passed).toBe(true);
    expect(run.failed.map((r) => r.case)).toEqual([]);
    expect(run.passed).toBe(true);
  });

  it('每条用例的 actual 都是明确的布尔值（不存在 null）', () => {
    const run = runAudit(CASES);
    for (const r of run.results) {
      expect(typeof r.actual, `用例「${r.case}」的 actual 不应为 null`).toBe('boolean');
    }
  });
});

describe('[Phase 3 · P3-P2] 源码层面禁止再吞异常', () => {
  const source = readFileSync(
    resolve(__dirname, '..', 'tools', 'auditSaveValidation.ts'),
    'utf8',
  );

  it('不再出现「视为损坏被拒」这类把异常粉饰成通过的注释与逻辑', () => {
    expect(source).not.toContain('视为损坏被拒');
  });

  it('构造失败路径显式存在', () => {
    expect(source).toContain('constructionFailed');
    expect(source).toContain('校验器未被调用');
  });
});
