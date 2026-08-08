/**
 * 状态效果 id 与纯查询函数（Phase 3A）。
 *
 * 为什么单独一个文件：`skills.ts` 要用 `actionCosts.ts` 的体力闸门，
 * 而 `actionCosts.ts` 又要知道「野外工造是否免费」、`combat.ts` 要知道
 * 「肾上腺素的体力折扣」—— 直接互相 import 就成了循环依赖。
 *
 * 把「id 常量 + 只读 statusEffects 的纯函数」抽到这一层，
 * 它只依赖 `types.ts`，谁都可以放心引用，环就断了。
 *
 * 规则：本文件**不允许**产生副作用（不写状态、不发事件、不消耗 RNG）。
 * 需要修改状态的逻辑一律留在 `skills.ts` / `exposed.ts`。
 */

import type { Combatant } from './types';

/** 斗士「肾上腺素」 */
export const ADRENALINE_ID = 'adrenaline';
/** 工程师「野外工造」 */
export const FIELD_CRAFT_ID = 'field_craft';
/** 医学生「紧急处置」留下的专注状态 */
export const MEDICAL_FOCUS_ID = 'medical_focus';
/** 重击落空留下的破绽（定义在 exposed.ts，这里只列出以便集中查阅） */
export const EXPOSED_ID = 'exposed';

/** 肾上腺素：当前的攻击体力增减（无状态时为 0） */
export function adrenalineStaminaDelta(actor: Combatant): number {
  const e = actor.statusEffects.find((s) => s.id === ADRENALINE_ID);
  return e?.attackStaminaDelta ?? 0;
}

/** 肾上腺素：自身承受战斗伤害的倍率（无状态时为 1） */
export function selfDamageTakenMultiplier(actor: Combatant): number {
  const e = actor.statusEffects.find((s) => s.id === ADRENALINE_ID);
  return e?.selfDamageTakenMult ?? 1;
}

/** 野外工造：本次合成是否免体力 */
export function hasFieldCraftCharge(actor: Combatant): boolean {
  const e = actor.statusEffects.find((s) => s.id === FIELD_CRAFT_ID);
  return (e?.remainingCrafts ?? 0) > 0;
}

/** 紧急处置：治疗类消耗品的额外倍率（无状态时为 1） */
export function consumableHealMultiplier(actor: Combatant): number {
  const e = actor.statusEffects.find((s) => s.id === MEDICAL_FOCUS_ID);
  return e?.consumableHealMult ?? 1;
}
