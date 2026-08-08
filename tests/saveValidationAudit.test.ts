/**
 * Phase 2A-1 · 存档深度校验回归测试（60 项损坏用例）。
 *
 * 用例清单与 `tools/auditSaveValidation.ts`（`npm run audit:save`）共用同一份
 * `CASES` 定义，保证「独立验收脚本」与「测试套件」检查的是完全相同的契约。
 *
 * 覆盖（规格 §16 要求）：
 * 背包 9 格 / count=0 / count>maxStack / 全局重复 UID / 负 eventSeq / 负 uidSeq /
 * 负统计 / 顶层 seed、time、rngState 不一致 / 缺 savedAt / NaN savedAt /
 * 非法玩家制作目标 / 错误 supply 比例 / 错误事件 actor / 重复事件 ID 等。
 */

import { describe, expect, it } from 'vitest';
import { CASES, makeValidSave } from '../tools/auditSaveValidation';
import { validateSaveData } from '../src/core/saveLoad';

describe('[Phase 2A-1] 存档深度校验（对照组）', () => {
  it('正常存档通过校验', () => {
    expect(validateSaveData(makeValidSave()).ok).toBe(true);
  });
  it('损坏用例数量 ≥ 40', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(40);
  });
});

describe('[Phase 2A-1] 存档深度校验（60 项损坏用例全部拒绝）', () => {
  for (const c of CASES) {
    it(`拒绝：${c.case}`, () => {
      const save = makeValidSave(`BR-T-${c.case.length}-${c.case.charCodeAt(0)}`);
      c.mutate(save);
      const report = validateSaveData(save);
      expect(report.ok, `用例「${c.case}」应当被拒绝，实际被接受`).toBe(false);
    });
  }
});
