/**
 * 状态效果 id 与纯查询函数（Phase 3A / Phase 3A-1）。
 *
 * 为什么单独一个文件：`skills.ts` 要用 `actionCosts.ts` 的体力闸门，
 * 而 `actionCosts.ts` 又要知道「现场加工是否免费」、`combat.ts` 要知道
 * 「肾上腺素的体力折扣与伤害倍率」—— 直接互相 import 就成了循环依赖。
 *
 * 把「id 常量 + 只读 statusEffects 的纯函数」抽到这一层，
 * 它只依赖 `types.ts`，谁都可以放心引用，环就断了。
 *
 * 规则：本文件**不允许**产生副作用（不写状态、不发事件、不消耗 RNG）。
 * 需要修改状态的逻辑一律留在 `skills.ts` / `exposed.ts`。
 */

import type { Combatant } from './types';
import {
  ESCAPE_PLAN_ID,
  HUNTER_TRACK_ID,
  SCAVENGE_FOCUS_ID,
  SORT_RARE_ID,
  STEADY_AIM_ID,
  SURVIVOR_CAMP_ID,
  TRAPPER_SETUP_ID,
} from './skillDefinitions';

export {
  ESCAPE_PLAN_ID,
  HUNTER_TRACK_ID,
  SCAVENGE_FOCUS_ID,
  SORT_RARE_ID,
  STEADY_AIM_ID,
  SURVIVOR_CAMP_ID,
  TRAPPER_SETUP_ID,
} from './skillDefinitions';

/** 斗士「肾上腺素」 */
export const ADRENALINE_ID = 'adrenaline';
/** 工程师「现场加工」 */
export const FIELD_CRAFT_ID = 'field_craft';
/** 医学生「应急处理」留下的专注状态 */
export const MEDICAL_FOCUS_ID = 'medical_focus';
/** 侦察员「警觉侦察」的警觉状态（噪音增强 + 搜索遭遇先手） */
export const SCOUT_AWARENESS_ID = 'scout_awareness';
/** 重击落空留下的破绽（定义在 exposed.ts，这里只列出以便集中查阅） */
export const EXPOSED_ID = 'exposed';

/** 肾上腺素：当前的攻击体力增减（无状态时为 0） */
export function adrenalineStaminaDelta(actor: Combatant): number {
  const e = actor.statusEffects.find((s) => s.id === ADRENALINE_ID);
  return e?.attackStaminaDelta ?? 0;
}

/** 肾上腺素：攻击方最终伤害倍率（无状态时为 1；必须真正进入 computeDamage） */
export function adrenalineDamageMultiplier(actor: Combatant): number {
  const e = actor.statusEffects.find((s) => s.id === ADRENALINE_ID);
  return e?.damageMult ?? 1;
}

/** 肾上腺素：自身承受战斗伤害的倍率（无状态时为 1） */
export function selfDamageTakenMultiplier(actor: Combatant): number {
  const e = actor.statusEffects.find((s) => s.id === ADRENALINE_ID);
  return e?.selfDamageTakenMult ?? 1;
}

/** 现场加工：本次合成是否免体力（只对下一次成功合成生效一次） */
export function hasFieldCraftCharge(actor: Combatant): boolean {
  const e = actor.statusEffects.find((s) => s.id === FIELD_CRAFT_ID);
  return (e?.remainingCrafts ?? 0) > 0;
}

/** 应急处理：治疗类消耗品的额外倍率（无状态时为 1） */
export function consumableHealMultiplier(actor: Combatant): number {
  const e = actor.statusEffects.find((s) => s.id === MEDICAL_FOCUS_ID);
  return e?.consumableHealMult ?? 1;
}

/** 警觉侦察：角色当前是否处于警觉状态 */
export function hasScoutAwareness(actor: Combatant): boolean {
  return actor.statusEffects.some((s) => s.id === SCOUT_AWARENESS_ID);
}

function statusNumber(actor: Combatant, id: string, field: keyof Combatant['statusEffects'][number], fallback: number): number {
  const effect = actor.statusEffects.find((s) => s.id === id);
  const value = effect?.[field];
  return typeof value === 'number' ? value : fallback;
}

/** 生存专家：扎营状态只提高 REST 的收益。 */
export function restStaminaBonus(actor: Combatant): number {
  return statusNumber(actor, SURVIVOR_CAMP_ID, 'restStaminaBonus', 0);
}

/** 拾荒者：搜索发现物品权重的状态倍率。 */
export function searchFindMultiplier(actor: Combatant): number {
  return statusNumber(actor, SCAVENGE_FOCUS_ID, 'searchFindMult', 1);
}

/** 猎人：搜索遭遇权重的状态倍率。 */
export function searchEnemyMultiplier(actor: Combatant): number {
  return statusNumber(actor, HUNTER_TRACK_ID, 'searchEnemyMult', 1);
}

/** 拾荒者：搜索时的材料偏好倍率。 */
export function searchMaterialBias(actor: Combatant): number {
  return statusNumber(actor, SCAVENGE_FOCUS_ID, 'searchMaterialBias', 1);
}

/** 拾荒者：从正式 loot pool 抽取稀有物品的概率加成。 */
export function searchRareChanceBonus(actor: Combatant): number {
  return statusNumber(actor, SORT_RARE_ID, 'rareChanceBonus', 0);
}

/** 猎人：仅作用于远程攻击的命中倍率。 */
export function rangedHitChanceMultiplier(actor: Combatant): number {
  return statusNumber(actor, STEADY_AIM_ID, 'rangedHitChanceMult', 1);
}

/** 陷阱师：防御姿态下的反击概率加成。 */
export function counterChanceBonus(actor: Combatant): number {
  return statusNumber(actor, TRAPPER_SETUP_ID, 'counterChanceBonus', 0);
}

/** 陷阱师：正式脱离的成功率加成。 */
export function fleeChanceBonus(actor: Combatant): number {
  return statusNumber(actor, ESCAPE_PLAN_ID, 'fleeChanceBonus', 0);
}
