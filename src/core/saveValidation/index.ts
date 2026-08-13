/**
 * 存档校验 · 编排入口（第六层 / 对外模块）。
 *
 * 把四层校验（structure / numbers / references / consistency）串起来，
 * 收集全部错误后统一返回 `ValidationReport`：
 * - 任一结构层致命缺失（非对象 / 无 state）直接判失败；
 * - 其余层全部「尽力校验」，把所有问题一次性列全，便于调试面板展示。
 *
 * 对外仍只暴露 `validateSaveData` / `isValidSaveData`，签名与旧
 * `saveLoad.ts` 完全一致，旧调用方（含 `loadGame` 与验收测试）无需改动。
 */

import { validateConsistency } from './consistency';
import { validateNumbers } from './numbers';
import { validateReferences } from './references';
import { buildContext } from './structure';
import { toReport, type ValidationReport } from './types';
import { validateWildState } from './wild';

/**
 * 存档深度校验（四层）。
 *
 * 这是 Phase 2A Step 8 拆分后的唯一权威实现：
 * 1. structure  —— 顶层 / state 结构；
 * 2. numbers    —— 数值区间（hp / 体力 / 时间 / 物资）；
 * 3. references —— 交叉引用存在性；
 * 4. consistency—— 跨实体逻辑自洽。
 *
 * 返回**全部**错误（而非首个），便于调试面板一次性展示。
 */
export function validateSaveData(value: unknown): ValidationReport {
  const errors: string[] = [];
  const ctx = buildContext(value, errors);
  if (!ctx) return toReport(errors);

  validateNumbers(ctx);
  validateWildState(ctx);
  validateReferences(ctx);
  validateConsistency(ctx);

  return toReport(errors);
}

/** 布尔版校验，供既有调用方与类型收窄使用 */
export function isValidSaveData(value: unknown): value is unknown {
  return validateSaveData(value).ok;
}

export type { ValidationReport } from './types';
