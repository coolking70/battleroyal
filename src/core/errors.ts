/**
 * 领域错误类型。
 *
 * 设计原则：
 * - **预期内**的规则错误（未知配方 / 未知物品 / 未知区域 / 未知角色 / 非法操作）
 *   一律使用 `GameRuleError`。命令层会捕获它并转成 `{ ok: false, message }`，
 *   绝不让界面崩溃。
 * - **存档结构问题**使用 `SaveValidationError`，由读档层捕获并提示"存档损坏"。
 * - 其它任何异常都视为**程序缺陷**，继续向上抛出，不做吞噬 —— 静默失败比崩溃更危险。
 */

/** 规则层预期错误：调用方给了非法输入，但引擎本身是健康的 */
export class GameRuleError extends Error {
  /** 机器可读的原因码，便于测试与日志归类 */
  readonly code: string;

  constructor(message: string, code = 'rule_violation') {
    super(message);
    this.name = 'GameRuleError';
    this.code = code;
    // 保证 instanceof 在编译到 ES5 目标时仍然可用
    Object.setPrototypeOf(this, GameRuleError.prototype);
  }
}

/** 存档校验失败 */
export class SaveValidationError extends Error {
  readonly field: string;

  constructor(message: string, field = 'unknown') {
    super(message);
    this.name = 'SaveValidationError';
    this.field = field;
    Object.setPrototypeOf(this, SaveValidationError.prototype);
  }
}

/** 是否为命令层应当捕获并转成失败结果的预期错误 */
export function isExpectedError(err: unknown): err is GameRuleError | SaveValidationError {
  return err instanceof GameRuleError || err instanceof SaveValidationError;
}

/** 取一条可以直接展示给玩家的错误文案 */
export function describeError(err: unknown): string {
  if (err instanceof GameRuleError) return err.message;
  if (err instanceof SaveValidationError) return `存档校验失败：${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
