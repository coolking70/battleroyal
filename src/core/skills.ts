/**
 * 四角色技能系统（Phase 3 Step 3）。
 *
 * 每个角色拥有一枚专属签名技能：
 * - 侦察「疾影」：进入疾影状态，数回合内大幅降低被命中概率（闪避）。
 * - 斗士「破甲」：进入破甲状态，数回合内攻击命中与伤害提升。
 * - 工程师「应急修理」：立即回满体力、修复装备耐久，并紧急修补自身恢复部分生命。
 * - 医学生「急救」：立即恢复大量生命。
 *
 * 设计原则（与 Phase 2A 同规则红线一致）：
 * - 玩家与 NPC 走同一套 `useSkill`，规则只写一遍；
 * - 技能有体力成本与冷却，不能无脑连放；
 * - 所有随机来源都来自种子 RNG（本模块不消耗 RNG，结果确定）。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { getItem } from '../data/items';
import { getEquippedWeapon } from './inventory';
import { canPayStamina, spendStamina, type CostCheck } from './actionCosts';
import { applyHealing } from './vitals';
import { pushEvent } from './events';
import type { Combatant, GameState, StatusEffect } from './types';

export type SkillId = 'dash' | 'sunder' | 'field_repair' | 'first_aid';

export interface SkillDef {
  id: SkillId;
  name: string;
  /** 拥有该技能的角色 id */
  characterId: string;
  /** 体力成本 */
  staminaCost: number;
  /** 冷却时间单位 */
  cooldown: number;
  description: string;
}

/** 角色 -> 专属技能（每角色一枚签名技能） */
export const SKILLS: Record<SkillId, SkillDef> = {
  first_aid: {
    id: 'first_aid',
    name: '急救',
    characterId: 'medic',
    staminaCost: 4,
    cooldown: GAME_CONFIG.skillCooldown,
    description: '立即恢复大量生命。',
  },
  field_repair: {
    id: 'field_repair',
    name: '应急修理',
    characterId: 'engineer',
    staminaCost: 3,
    cooldown: GAME_CONFIG.skillCooldown,
    description: '立即回满体力、修复装备耐久，并紧急修补自身恢复部分生命。',
  },
  sunder: {
    id: 'sunder',
    name: '破甲',
    characterId: 'fighter',
    staminaCost: 5,
    cooldown: GAME_CONFIG.skillCooldown,
    description: '进入破甲状态，数回合内命中与伤害提升。',
  },
  dash: {
    id: 'dash',
    name: '疾影',
    characterId: 'scout',
    staminaCost: 3,
    cooldown: GAME_CONFIG.skillCooldown,
    description: '进入疾影状态，数回合内大幅降低被命中概率。',
  },
};

/** 返回某角色拥有的技能 id（没有则返回 null） */
export function getCharacterSkill(characterId: string): SkillId | null {
  for (const def of Object.values(SKILLS)) {
    if (def.characterId === characterId) return def.id;
  }
  return null;
}

export function getSkill(skillId: SkillId): SkillDef {
  return SKILLS[skillId];
}

/** 冷却是否为 0（或从未使用过） */
export function isSkillReady(actor: Combatant, skillId: SkillId): boolean {
  const cd = actor.skillCooldowns[skillId];
  return cd === undefined || cd <= 0;
}

/** 前置校验：存活 + 拥有该技能 + 冷却就绪 + 体力足够 */
export function canUseSkill(actor: Combatant, skillId: SkillId): CostCheck {
  const def = SKILLS[skillId];
  const payStamina = canPayStamina; // 捕获引用，规避循环依赖下的绑定解析异常
  if (!actor.alive) {
    return { ok: false, reason: '已经死亡的角色无法行动。', cost: def.staminaCost };
  }
  if (getCharacterSkill(actor.characterId) !== skillId) {
    return { ok: false, reason: '当前角色没有这个技能。', cost: def.staminaCost };
  }
  if (!isSkillReady(actor, skillId)) {
    return {
      ok: false,
      reason: `技能冷却中（剩余 ${actor.skillCooldowns[skillId]} 回合）。`,
      cost: def.staminaCost,
    };
  }
  const pay = payStamina(actor, def.staminaCost);
  if (!pay.ok) {
    return {
      ok: false,
      reason: `体力不足：技能需要 ${def.staminaCost} 点，当前只有 ${Math.floor(actor.stamina)} 点。`,
      cost: def.staminaCost,
    };
  }
  return { ok: true, reason: null, cost: def.staminaCost };
}

/** 给角色叠加一个状态效果（同名效果刷新持续时间，不叠加多层） */
function addStatusEffect(actor: Combatant, effect: StatusEffect): void {
  actor.statusEffects = actor.statusEffects.filter((e) => e.id !== effect.id);
  actor.statusEffects.push(effect);
}

export interface SkillResult {
  ok: boolean;
  message: string;
  /** 实际恢复的生命 */
  hpHealed: number;
  /** 实际恢复的体力 */
  staminaRestored: number;
}

function failSkill(message: string): SkillResult {
  return { ok: false, message, hpHealed: 0, staminaRestored: 0 };
}

/**
 * 释放技能。调用方（actorActions / commandHandlers）负责更上层的存活与
 * 对局状态校验；这里只做技能自身的前置与效果结算。
 */
export function useSkill(
  state: GameState,
  actor: Combatant,
  skillId: SkillId,
  _rng: import('./random').SeededRandom,
): SkillResult {
  const def = SKILLS[skillId];
  const cost = canUseSkill(actor, skillId);
  if (!cost.ok) return failSkill(cost.reason ?? '无法使用该技能。');

  spendStamina(actor, def.staminaCost);
  actor.skillCooldowns[skillId] = def.cooldown;

  let hpHealed = 0;
  let staminaRestored = 0;
  let detail = '';

  switch (skillId) {
    case 'first_aid': {
      const before = actor.hp;
      const amount = Math.round(actor.maxHp * GAME_CONFIG.skillFirstAidHealRatio);
      hpHealed = applyHealing(state, actor, amount);
      detail = `恢复 ${hpHealed} 点生命`;
      void before;
      break;
    }
    case 'field_repair': {
      staminaRestored = actor.maxStamina - actor.stamina;
      actor.stamina = actor.maxStamina;
      const weapon = getEquippedWeapon(actor);
      let repaired = '';
      if (weapon && typeof weapon.durability === 'number') {
        const cap = getItem(weapon.itemId).durability ?? weapon.durability;
        const after = Math.min(cap, weapon.durability + GAME_CONFIG.skillRepairDurability);
        weapon.durability = after;
        repaired = `武器耐久修复至 ${after}`;
      }
      const amount = Math.round(actor.maxHp * GAME_CONFIG.skillRepairHealRatio);
      hpHealed = applyHealing(state, actor, amount);
      detail = `体力回满${repaired ? `，${repaired}` : ''}，并紧急修补恢复 ${hpHealed} 点生命`;
      break;
    }
    case 'sunder': {
      addStatusEffect(actor, {
        id: 'sunder',
        remaining: GAME_CONFIG.skillSunderDuration,
        hpPerTick: 0,
        label: '破甲',
        hitChanceMult: GAME_CONFIG.skillSunderHitMult,
        damageMult: GAME_CONFIG.skillSunderDamageMult,
      });
      detail = `进入破甲状态 ${GAME_CONFIG.skillSunderDuration} 回合（命中与伤害提升）`;
      break;
    }
    case 'dash': {
      addStatusEffect(actor, {
        id: 'dash',
        remaining: GAME_CONFIG.skillDashDuration,
        hpPerTick: 0,
        label: '疾影',
        evasionHitMult: GAME_CONFIG.skillDashEvasionMult,
      });
      detail = `进入疾影状态 ${GAME_CONFIG.skillDashDuration} 回合（闪避提升）`;
      break;
    }
  }

  pushEvent(state, {
    type: 'SKILL_USED',
    actorId: actor.id,
    zoneId: actor.currentZoneId,
    message: `${actor.isPlayer ? '你' : actor.name}使用了「${def.name}」：${detail}。`,
    metadata: { skillId, hpHealed, staminaRestored },
  });

  return {
    ok: true,
    message: `${actor.isPlayer ? '你' : actor.name}使用了「${def.name}」：${detail}。`,
    hpHealed,
    staminaRestored,
  };
}
