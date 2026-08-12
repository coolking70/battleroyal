/**
 * 职业签名技能（Phase 3A / Phase 4L，数据驱动）。
 *
 * ## 为什么要重写
 *
 * Phase 3 的四个技能是「回 30% 血」「命中 ×1.12 伤害 ×1.6」「闪避 ×0.5」
 * 「回满体力 + 修耐久 + 回 20% 血」—— 全是纯战斗数值增益。
 * 后果是四个角色的差异退化成**数字大小**：谁的技能数值高谁就强，
 * 「侦察员擅长信息、工程师擅长合成」这些设定在实际操作里一点都摸不到。
 *
 * Phase 3A 把每个技能钉死在该角色的战略身份上：
 *
 * | 角色 | 技能 | 战略维度 | 核心效果 |
 * | --- | --- | --- | --- |
 * | 侦察员 scout | `scout_recon` 警觉侦察 | **信息** | 提升噪音信息并在 SEARCH 遭遇中抢占先手 |
 * | 斗士 fighter | `adrenaline` 肾上腺素 | **战斗节奏** | 接下来 3 次攻击省体力，代价是自己更脆 |
 * | 工程师 engineer | `field_craft` 野外工造 | **合成** | 接下来 2 次合成不要体力 |
 * | 医学生 medic | `emergency_treatment` 紧急处置 | **消耗品经济** | 止血，并让治疗品增效 25% |
 *
 * 注意 `adrenaline` 是**唯一带负面代价**的技能。这是刻意的：斗士本来就是
 * 「主动开战换收益」的角色，给他一个纯增益反而会让 heavy + 技能变成无脑最优。
 *
 * ## 不变的红线
 * - 玩家与 NPC 走同一个 `useSkill`，规则只写一遍；
 * - 技能有体力成本与冷却，不能连放；
 * - 本模块不消耗 RNG，同种子下结果完全确定。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { canPayStamina, gainStamina, spendStamina, type CostCheck } from './actionCosts';
import { pushEvent } from './events';
import {
  ADRENALINE_ID,
  FIELD_CRAFT_ID,
  MEDICAL_FOCUS_ID,
  SCOUT_AWARENESS_ID,
} from './statusIds';
import {
  ENGINEER_REINFORCE_ID,
  ESCAPE_PLAN_ID,
  FIGHTER_FOCUS_ID,
  getCharacterSkills,
  HUNTER_TRACK_ID,
  MEDIC_REGEN_ID,
  SCOUT_SMOKE_ID,
  SCAVENGE_FOCUS_ID,
  SORT_RARE_ID,
  STEADY_AIM_ID,
  SURVIVOR_CAMP_ID,
  TRAPPER_SETUP_ID,
  SKILLS,
  type SkillId,
} from './skillDefinitions';
import { applyHealing } from './vitals';
import type { Combatant, GameState, StatusEffect } from './types';

// 状态 id 与只读查询集中在 statusIds.ts（避免与 actionCosts / combat 形成循环依赖），
// 这里原样再导出，调用方 import 哪一边都行。
export {
  ADRENALINE_ID,
  FIELD_CRAFT_ID,
  MEDICAL_FOCUS_ID,
  SCOUT_AWARENESS_ID,
  adrenalineDamageMultiplier,
  adrenalineStaminaDelta,
  consumableHealMultiplier,
  hasFieldCraftCharge,
  hasScoutAwareness,
  selfDamageTakenMultiplier,
} from './statusIds';

export {
  ENGINEER_REINFORCE_ID,
  ESCAPE_PLAN_ID,
  FIGHTER_FOCUS_ID,
  getCharacterSkill,
  getCharacterSkills,
  getSkill,
  MEDIC_REGEN_ID,
  HUNTER_TRACK_ID,
  SCAVENGE_FOCUS_ID,
  SECONDARY_SKILL_UNLOCK_LEVEL,
  SECONDARY_STATUS_IDS,
  SCOUT_SMOKE_ID,
  SKILLS,
  SORT_RARE_ID,
  STEADY_AIM_ID,
  SURVIVOR_CAMP_ID,
  TRAPPER_SETUP_ID,
  type SkillDef,
  type SkillId,
} from './skillDefinitions';

/** 冷却是否为 0（或从未使用过） */
export function isSkillReady(actor: Combatant, skillId: SkillId): boolean {
  const cd = actor.skillCooldowns[skillId];
  return cd === undefined || cd <= 0;
}

/** 技能解锁由持久化 level 推导，不增加第二份解锁状态。 */
export function isSkillUnlocked(actor: Combatant, skillId: SkillId): boolean {
  return actor.level >= SKILLS[skillId].unlockLevel;
}

/** 前置校验：存活 + 拥有该技能 + 等级解锁 + 冷却就绪 + 体力足够 */
export function canUseSkill(actor: Combatant, skillId: SkillId): CostCheck {
  const def = SKILLS[skillId];
  const payStamina = canPayStamina; // 捕获引用，规避循环依赖下的绑定解析异常
  if (!actor.alive) {
    return { ok: false, reason: '已经死亡的角色无法行动。', cost: def.staminaCost };
  }
  if (!getCharacterSkills(actor.characterId).includes(skillId)) {
    return { ok: false, reason: '当前角色没有这个技能。', cost: def.staminaCost };
  }
  if (!isSkillUnlocked(actor, skillId)) {
    return {
      ok: false,
      reason: `等级不足：达到 Lv.${def.unlockLevel} 后解锁。`,
      cost: def.staminaCost,
    };
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

/* ------------------------------------------------------------------ */
/* 状态消费：会写状态、发事件，因此留在本文件（statusIds 只读）           */
/* ------------------------------------------------------------------ */

/**
 * 肾上腺素：消费一次攻击次数。攻击结算时调用，次数归零即移除状态。
 * @returns 是否确实消费了一次（用于模拟统计）
 */
export function consumeAdrenalineCharge(state: GameState, actor: Combatant): boolean {
  const e = actor.statusEffects.find((s) => s.id === ADRENALINE_ID);
  if (!e || typeof e.remainingAttacks !== 'number') return false;
  e.remainingAttacks -= 1;
  if (e.remainingAttacks > 0) return true;

  actor.statusEffects = actor.statusEffects.filter((s) => s.id !== ADRENALINE_ID);
  pushEvent(state, {
    type: 'STATUS_EXPIRED',
    actorId: actor.id,
    zoneId: actor.currentZoneId,
    importance: 'minor',
    message: `${actor.isPlayer ? '你' : actor.name}的肾上腺素退去了。`,
    metadata: { statusId: ADRENALINE_ID, reason: 'charges_used' },
  });
  return true;
}

/**
 * 现场加工：合成**成功**后调用，立即移除充能（只有一次）。
 * 失败的合成不调用本函数，因此不会白扣充能。
 * @returns 是否确实消费了（用于模拟统计）
 */
export function consumeFieldCraftCharge(state: GameState, actor: Combatant): boolean {
  const e = actor.statusEffects.find((s) => s.id === FIELD_CRAFT_ID);
  if (!e || typeof e.remainingCrafts !== 'number' || e.remainingCrafts <= 0) return false;

  actor.statusEffects = actor.statusEffects.filter((s) => s.id !== FIELD_CRAFT_ID);
  pushEvent(state, {
    type: 'STATUS_EXPIRED',
    actorId: actor.id,
    zoneId: actor.currentZoneId,
    importance: 'minor',
    message: `${actor.isPlayer ? '你' : actor.name}的现场加工在一次成功合成后用掉了。`,
    metadata: { statusId: FIELD_CRAFT_ID, reason: 'charges_used' },
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* 释放                                                                */
/* ------------------------------------------------------------------ */

export interface SkillResult {
  ok: boolean;
  message: string;
  /** 实际恢复的生命 */
  hpHealed: number;
  /** 实际恢复的体力 */
  staminaRestored: number;
  /** 保留统计字段兼容性；警觉侦察不提供精确人物揭示，因此运行时保持为 0。 */
  revealed: number;
}

function failSkill(message: string): SkillResult {
  return { ok: false, message, hpHealed: 0, staminaRestored: 0, revealed: 0 };
}

/**
 * 释放技能。调用方（actorActions / commandHandlers）负责更上层的存活与
 * 对局状态校验；这里只做技能自身的前置与效果结算。
 *
 * Phase 3A-1 严格回归规格（与 SKILL_DESIGN.md 逐字一致）：
 * - 警觉侦察：只挂 SCOUT_AWARENESS（噪音增强 + 搜索遭遇先手），**绝不**遍历
 *   aliveCharacterIds / 写 playerIntel / 公开身份位置；
 * - 肾上腺素：2 次攻击，伤害 +20%（damageMult 真正进 computeDamage）、
 *   体力 -1（下限 1）、自身受战斗攻击伤害 +10%、6 回合兜底；
 * - 现场加工：下一次成功合成体力 0（失败不消费），6 回合失效；
 * - 应急处理：固定 +15 HP（非百分比），不清除任何 DoT，4 回合治疗品 +25%。
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
  let revealed = 0;
  let detail = '';

  switch (skillId) {
    case 'scout_recon': {
      // 警觉：只增强噪音情报质量 + 为下次搜索遭遇标记先手。
      // 不读取 aliveCharacterIds、不写 playerIntel、不公开任何身份/位置。
      addStatusEffect(actor, {
        id: SCOUT_AWARENESS_ID,
        remaining: GAME_CONFIG.skillReconDuration,
        hpPerTick: 0,
        label: '警觉侦察',
      });
      detail = `进入警觉状态 ${GAME_CONFIG.skillReconDuration} 个时间单位：噪音情报更清晰，搜索遭遇时抢占先手`;
      break;
    }

    case 'adrenaline': {
      addStatusEffect(actor, {
        id: ADRENALINE_ID,
        // remaining 是 6 回合兜底；正常由 2 次攻击耗尽来结束，以先发生者为准
        remaining: GAME_CONFIG.skillAdrenalineDuration,
        hpPerTick: 0,
        label: '肾上腺素',
        remainingAttacks: GAME_CONFIG.skillAdrenalineAttacks,
        damageMult: GAME_CONFIG.skillAdrenalineDamageMult,
        attackStaminaDelta: GAME_CONFIG.skillAdrenalineStaminaDelta,
        selfDamageTakenMult: GAME_CONFIG.skillAdrenalineSelfDamageMult,
      });
      detail =
        `接下来 ${GAME_CONFIG.skillAdrenalineAttacks} 次攻击伤害 +${Math.round(
          (GAME_CONFIG.skillAdrenalineDamageMult - 1) * 100,
        )}%、体力 -1（下限 1），` +
        `但这期间自己受到的战斗伤害 +${Math.round(
          (GAME_CONFIG.skillAdrenalineSelfDamageMult - 1) * 100,
        )}%`;
      break;
    }

    case 'field_craft': {
      addStatusEffect(actor, {
        id: FIELD_CRAFT_ID,
        remaining: GAME_CONFIG.skillFieldCraftDuration,
        hpPerTick: 0,
        label: '现场加工',
        remainingCrafts: 1,
      });
      detail = `下一次成功合成不消耗体力（${GAME_CONFIG.skillFieldCraftDuration} 个时间单位内有效，失败不消耗）`;
      break;
    }

    case 'emergency_treatment': {
      // 固定 15 HP（不是最大生命百分比），且**不**清除任何持续伤害状态
      hpHealed = applyHealing(state, actor, GAME_CONFIG.skillTreatmentInstantHeal);

      addStatusEffect(actor, {
        id: MEDICAL_FOCUS_ID,
        remaining: GAME_CONFIG.skillTreatmentDuration,
        hpPerTick: 0,
        label: '应急处理',
        consumableHealMult: GAME_CONFIG.skillTreatmentConsumableMult,
      });
      detail =
        `恢复 ${hpHealed} 点生命，` +
        `${GAME_CONFIG.skillTreatmentDuration} 个时间单位内治疗类消耗品效果 +${Math.round(
          (GAME_CONFIG.skillTreatmentConsumableMult - 1) * 100,
        )}%`;
      break;
    }

    case 'scout_smoke': {
      addStatusEffect(actor, {
        id: SCOUT_SMOKE_ID,
        remaining: GAME_CONFIG.skillScoutSmokeDuration,
        hpPerTick: 0,
        label: '烟幕转位',
        evasionHitMult: GAME_CONFIG.skillScoutSmokeEvasionMult,
      });
      detail = `持续 ${GAME_CONFIG.skillScoutSmokeDuration} 个时间单位，降低被命中的机会`;
      break;
    }

    case 'fighter_focus': {
      addStatusEffect(actor, {
        id: FIGHTER_FOCUS_ID,
        remaining: GAME_CONFIG.skillFighterFocusDuration,
        hpPerTick: 0,
        label: '精准节拍',
        hitChanceMult: GAME_CONFIG.skillFighterFocusHitChanceMult,
      });
      detail = `持续 ${GAME_CONFIG.skillFighterFocusDuration} 个时间单位，提升攻击命中机会`;
      break;
    }

    case 'engineer_reinforce': {
      addStatusEffect(actor, {
        id: ENGINEER_REINFORCE_ID,
        remaining: GAME_CONFIG.skillEngineerReinforceDuration,
        hpPerTick: 0,
        label: '临时加固',
        defenseBonus: GAME_CONFIG.skillEngineerReinforceDefenseBonus,
      });
      detail = `持续 ${GAME_CONFIG.skillEngineerReinforceDuration} 个时间单位，防御 +${GAME_CONFIG.skillEngineerReinforceDefenseBonus}`;
      break;
    }

    case 'medic_regen': {
      addStatusEffect(actor, {
        id: MEDIC_REGEN_ID,
        remaining: GAME_CONFIG.skillMedicRegenDuration,
        hpPerTick: GAME_CONFIG.skillMedicRegenHpPerTick,
        label: '持续止血',
      });
      detail = `持续 ${GAME_CONFIG.skillMedicRegenDuration} 个时间单位，每回合恢复 ${GAME_CONFIG.skillMedicRegenHpPerTick} 点生命`;
      break;
    }

    case 'second_wind': {
      staminaRestored = gainStamina(actor, GAME_CONFIG.skillSecondWindRestore);
      detail = `恢复 ${staminaRestored} 点体力`;
      break;
    }

    case 'camp_routine': {
      addStatusEffect(actor, {
        id: SURVIVOR_CAMP_ID,
        remaining: GAME_CONFIG.skillCampRoutineDuration,
        hpPerTick: 0,
        label: '扎营节律',
        restStaminaBonus: GAME_CONFIG.skillCampRoutineRestBonus,
      });
      detail = `持续 ${GAME_CONFIG.skillCampRoutineDuration} 个时间单位，休息额外恢复 ${GAME_CONFIG.skillCampRoutineRestBonus} 点体力`;
      break;
    }

    case 'scavenge_focus': {
      addStatusEffect(actor, {
        id: SCAVENGE_FOCUS_ID,
        remaining: GAME_CONFIG.skillScavengeFocusDuration,
        hpPerTick: 0,
        label: '搜索专注',
        searchFindMult: GAME_CONFIG.skillScavengeFocusFindMult,
        searchMaterialBias: GAME_CONFIG.resourcefulMaterialBias,
      });
      detail = `持续 ${GAME_CONFIG.skillScavengeFocusDuration} 个时间单位，提高发现物品权重`;
      break;
    }

    case 'sort_rare': {
      addStatusEffect(actor, {
        id: SORT_RARE_ID,
        remaining: GAME_CONFIG.skillSortRareDuration,
        hpPerTick: 0,
        label: '筛选稀有',
        rareChanceBonus: GAME_CONFIG.skillSortRareChanceBonus,
      });
      detail = `持续 ${GAME_CONFIG.skillSortRareDuration} 个时间单位，提高稀有物品抽取机会`;
      break;
    }

    case 'track_target': {
      addStatusEffect(actor, {
        id: HUNTER_TRACK_ID,
        remaining: GAME_CONFIG.skillTrackTargetDuration,
        hpPerTick: 0,
        label: '追踪目标',
        searchEnemyMult: GAME_CONFIG.skillTrackTargetEnemyMult,
      });
      detail = `持续 ${GAME_CONFIG.skillTrackTargetDuration} 个时间单位，提高搜索遭遇权重，不显示远端位置`;
      break;
    }

    case 'steady_aim': {
      addStatusEffect(actor, {
        id: STEADY_AIM_ID,
        remaining: GAME_CONFIG.skillSteadyAimDuration,
        hpPerTick: 0,
        label: '稳定瞄准',
        rangedHitChanceMult: GAME_CONFIG.skillSteadyAimRangedHitMult,
      });
      detail = `持续 ${GAME_CONFIG.skillSteadyAimDuration} 个时间单位，仅提高远程攻击命中机会`;
      break;
    }

    case 'prepare_ambush': {
      actor.guarding = true;
      addStatusEffect(actor, {
        id: TRAPPER_SETUP_ID,
        remaining: GAME_CONFIG.skillPrepareAmbushDuration,
        hpPerTick: 0,
        label: '埋伏准备',
        counterChanceBonus: GAME_CONFIG.skillPrepareAmbushCounterBonus,
      });
      detail = `立即进入防御姿态，持续 ${GAME_CONFIG.skillPrepareAmbushDuration} 个时间单位提高反击机会`;
      break;
    }

    case 'escape_plan': {
      addStatusEffect(actor, {
        id: ESCAPE_PLAN_ID,
        remaining: GAME_CONFIG.skillEscapePlanDuration,
        hpPerTick: 0,
        label: '预留退路',
        fleeChanceBonus: GAME_CONFIG.skillEscapePlanFleeBonus,
      });
      detail = `持续 ${GAME_CONFIG.skillEscapePlanDuration} 个时间单位，提高正式脱离成功率`;
      break;
    }
  }

  const message = `${actor.isPlayer ? '你' : actor.name}使用了「${def.name}」：${detail}。`;
  pushEvent(state, {
    type: 'SKILL_USED',
    actorId: actor.id,
    zoneId: actor.currentZoneId,
    message,
    metadata: {
      skillId,
      dimension: def.dimension,
      hpHealed,
      revealed,
      staminaCost: def.staminaCost,
    },
  });

  return { ok: true, message, hpHealed, staminaRestored, revealed };
}
