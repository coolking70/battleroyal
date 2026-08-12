import { GAME_CONFIG } from '../data/gameConfig';

/** 技能 id。主技能保持既有 id，第二技能从等级 3 开始可用。 */
export type SkillId =
  | 'scout_recon'
  | 'scout_smoke'
  | 'adrenaline'
  | 'fighter_focus'
  | 'field_craft'
  | 'engineer_reinforce'
  | 'emergency_treatment'
  | 'medic_regen'
  | 'second_wind'
  | 'camp_routine'
  | 'scavenge_focus'
  | 'sort_rare'
  | 'track_target'
  | 'steady_aim'
  | 'prepare_ambush'
  | 'escape_plan';

export interface SkillDef {
  id: SkillId;
  name: string;
  /** 拥有该技能的角色 id */
  characterId: string;
  /** 体力成本 */
  staminaCost: number;
  /** 冷却时间单位（每个技能各自定义，禁止全局统一冷却） */
  cooldown: number;
  /** 战略维度标签（UI 与文档用） */
  dimension: '信息' | '战斗节奏' | '合成' | '消耗品经济' | '生存' | '搜索' | '追踪' | '区域控制';
  description: string;
  /** 技能可用的最低等级；主技能保持 Lv.1。 */
  unlockLevel: number;
  /** 明确保留既有单技能调用点所需的主技能语义。 */
  isPrimary: boolean;
}

/** 各职业第二技能及 Phase 4L 新技能使用的状态 id；状态结构复用既有 StatusEffect 字段。 */
export const SCOUT_SMOKE_ID = 'scout_smoke';
export const FIGHTER_FOCUS_ID = 'fighter_focus';
export const ENGINEER_REINFORCE_ID = 'engineer_reinforce';
export const MEDIC_REGEN_ID = 'medic_regen';
export const SURVIVOR_CAMP_ID = 'survivor_camp';
export const SCAVENGE_FOCUS_ID = 'scavenge_focus';
export const SORT_RARE_ID = 'sort_rare';
export const HUNTER_TRACK_ID = 'hunter_track';
export const STEADY_AIM_ID = 'steady_aim';
export const TRAPPER_SETUP_ID = 'trapper_setup';
export const ESCAPE_PLAN_ID = 'escape_plan';

export const SECONDARY_STATUS_IDS = [
  SCOUT_SMOKE_ID,
  FIGHTER_FOCUS_ID,
  ENGINEER_REINFORCE_ID,
  MEDIC_REGEN_ID,
  SURVIVOR_CAMP_ID,
  SCAVENGE_FOCUS_ID,
  SORT_RARE_ID,
  HUNTER_TRACK_ID,
  STEADY_AIM_ID,
  TRAPPER_SETUP_ID,
  ESCAPE_PLAN_ID,
] as const;

const PRIMARY_LEVEL = 1;

/** 角色统一的第二技能解锁等级。 */
export const SECONDARY_SKILL_UNLOCK_LEVEL = GAME_CONFIG.skillSecondaryUnlockLevel;

/** 所有技能定义。每个角色的主技能始终排在第二技能之前。 */
export const SKILLS: Record<SkillId, SkillDef> = {
  scout_recon: {
    id: 'scout_recon',
    name: '警觉侦察',
    characterId: 'scout',
    staminaCost: GAME_CONFIG.skillReconStaminaCost,
    cooldown: GAME_CONFIG.skillReconCooldown,
    dimension: '信息',
    description: '提升噪音情报质量，并在搜索遭遇中抢占先手（不提供精确角色位置）。',
    unlockLevel: PRIMARY_LEVEL,
    isPrimary: true,
  },
  scout_smoke: {
    id: 'scout_smoke',
    name: '烟幕转位',
    characterId: 'scout',
    staminaCost: GAME_CONFIG.skillScoutSmokeStaminaCost,
    cooldown: GAME_CONFIG.skillScoutSmokeCooldown,
    dimension: '信息',
    description: `制造 ${GAME_CONFIG.skillScoutSmokeDuration} 回合烟幕，降低被命中的机会。`,
    unlockLevel: SECONDARY_SKILL_UNLOCK_LEVEL,
    isPrimary: false,
  },
  adrenaline: {
    id: 'adrenaline',
    name: '肾上腺素',
    characterId: 'fighter',
    staminaCost: GAME_CONFIG.skillAdrenalineStaminaCost,
    cooldown: GAME_CONFIG.skillAdrenalineCooldown,
    dimension: '战斗节奏',
    description: `接下来 ${GAME_CONFIG.skillAdrenalineAttacks} 次攻击伤害 +${Math.round(
      (GAME_CONFIG.skillAdrenalineDamageMult - 1) * 100,
    )}%、体力 -1（下限 1）；代价是这期间自己受到的战斗伤害 +${Math.round(
      (GAME_CONFIG.skillAdrenalineSelfDamageMult - 1) * 100,
    )}%。`,
    unlockLevel: PRIMARY_LEVEL,
    isPrimary: true,
  },
  fighter_focus: {
    id: 'fighter_focus',
    name: '精准节拍',
    characterId: 'fighter',
    staminaCost: GAME_CONFIG.skillFighterFocusStaminaCost,
    cooldown: GAME_CONFIG.skillFighterFocusCooldown,
    dimension: '战斗节奏',
    description: `持续 ${GAME_CONFIG.skillFighterFocusDuration} 回合，提升攻击命中机会。`,
    unlockLevel: SECONDARY_SKILL_UNLOCK_LEVEL,
    isPrimary: false,
  },
  field_craft: {
    id: 'field_craft',
    name: '现场加工',
    characterId: 'engineer',
    staminaCost: GAME_CONFIG.skillFieldCraftStaminaCost,
    cooldown: GAME_CONFIG.skillFieldCraftCooldown,
    dimension: '合成',
    description: `下一次成功合成不消耗体力（${GAME_CONFIG.skillFieldCraftDuration} 个时间单位内有效，失败不消耗）。`,
    unlockLevel: PRIMARY_LEVEL,
    isPrimary: true,
  },
  engineer_reinforce: {
    id: 'engineer_reinforce',
    name: '临时加固',
    characterId: 'engineer',
    staminaCost: GAME_CONFIG.skillEngineerReinforceStaminaCost,
    cooldown: GAME_CONFIG.skillEngineerReinforceCooldown,
    dimension: '合成',
    description: `持续 ${GAME_CONFIG.skillEngineerReinforceDuration} 回合，获得额外防御。`,
    unlockLevel: SECONDARY_SKILL_UNLOCK_LEVEL,
    isPrimary: false,
  },
  emergency_treatment: {
    id: 'emergency_treatment',
    name: '应急处理',
    characterId: 'medic',
    staminaCost: GAME_CONFIG.skillTreatmentStaminaCost,
    cooldown: GAME_CONFIG.skillTreatmentCooldown,
    dimension: '消耗品经济',
    description: `立即恢复 ${GAME_CONFIG.skillTreatmentInstantHeal} 点生命，并在 ${GAME_CONFIG.skillTreatmentDuration} 个时间单位内让治疗类消耗品效果 +${Math.round(
      (GAME_CONFIG.skillTreatmentConsumableMult - 1) * 100,
    )}%。`,
    unlockLevel: PRIMARY_LEVEL,
    isPrimary: true,
  },
  medic_regen: {
    id: 'medic_regen',
    name: '持续止血',
    characterId: 'medic',
    staminaCost: GAME_CONFIG.skillMedicRegenStaminaCost,
    cooldown: GAME_CONFIG.skillMedicRegenCooldown,
    dimension: '消耗品经济',
    description: `持续 ${GAME_CONFIG.skillMedicRegenDuration} 回合，每回合恢复 ${GAME_CONFIG.skillMedicRegenHpPerTick} 点生命。`,
    unlockLevel: SECONDARY_SKILL_UNLOCK_LEVEL,
    isPrimary: false,
  },
  second_wind: {
    id: 'second_wind',
    name: '第二呼吸',
    characterId: 'survivor',
    staminaCost: GAME_CONFIG.skillSecondWindStaminaCost,
    cooldown: GAME_CONFIG.skillSecondWindCooldown,
    dimension: '生存',
    description: `支付 ${GAME_CONFIG.skillSecondWindStaminaCost} 点体力，立即恢复 ${GAME_CONFIG.skillSecondWindRestore} 点体力。`,
    unlockLevel: PRIMARY_LEVEL,
    isPrimary: true,
  },
  camp_routine: {
    id: 'camp_routine',
    name: '扎营节律',
    characterId: 'survivor',
    staminaCost: GAME_CONFIG.skillCampRoutineStaminaCost,
    cooldown: GAME_CONFIG.skillCampRoutineCooldown,
    dimension: '生存',
    description: `持续 ${GAME_CONFIG.skillCampRoutineDuration} 回合，REST 额外恢复 ${GAME_CONFIG.skillCampRoutineRestBonus} 点体力。`,
    unlockLevel: SECONDARY_SKILL_UNLOCK_LEVEL,
    isPrimary: false,
  },
  scavenge_focus: {
    id: 'scavenge_focus',
    name: '搜索专注',
    characterId: 'scavenger',
    staminaCost: GAME_CONFIG.skillScavengeFocusStaminaCost,
    cooldown: GAME_CONFIG.skillScavengeFocusCooldown,
    dimension: '搜索',
    description: `持续 ${GAME_CONFIG.skillScavengeFocusDuration} 回合，提高正式搜索的发现物品权重。`,
    unlockLevel: PRIMARY_LEVEL,
    isPrimary: true,
  },
  sort_rare: {
    id: 'sort_rare',
    name: '筛选稀有',
    characterId: 'scavenger',
    staminaCost: GAME_CONFIG.skillSortRareStaminaCost,
    cooldown: GAME_CONFIG.skillSortRareCooldown,
    dimension: '搜索',
    description: `持续 ${GAME_CONFIG.skillSortRareDuration} 回合，提高从正式 loot pool 抽取稀有物品的机会。`,
    unlockLevel: SECONDARY_SKILL_UNLOCK_LEVEL,
    isPrimary: false,
  },
  track_target: {
    id: 'track_target',
    name: '追踪目标',
    characterId: 'hunter',
    staminaCost: GAME_CONFIG.skillTrackTargetStaminaCost,
    cooldown: GAME_CONFIG.skillTrackTargetCooldown,
    dimension: '追踪',
    description: `持续 ${GAME_CONFIG.skillTrackTargetDuration} 回合，提高搜索遭遇权重，不显示远端精确位置。`,
    unlockLevel: PRIMARY_LEVEL,
    isPrimary: true,
  },
  steady_aim: {
    id: 'steady_aim',
    name: '稳定瞄准',
    characterId: 'hunter',
    staminaCost: GAME_CONFIG.skillSteadyAimStaminaCost,
    cooldown: GAME_CONFIG.skillSteadyAimCooldown,
    dimension: '追踪',
    description: `持续 ${GAME_CONFIG.skillSteadyAimDuration} 回合，仅提高远程攻击命中机会。`,
    unlockLevel: SECONDARY_SKILL_UNLOCK_LEVEL,
    isPrimary: false,
  },
  prepare_ambush: {
    id: 'prepare_ambush',
    name: '埋伏准备',
    characterId: 'trapper',
    staminaCost: GAME_CONFIG.skillPrepareAmbushStaminaCost,
    cooldown: GAME_CONFIG.skillPrepareAmbushCooldown,
    dimension: '区域控制',
    description: `立即进入防御姿态，持续 ${GAME_CONFIG.skillPrepareAmbushDuration} 回合提高反击机会。`,
    unlockLevel: PRIMARY_LEVEL,
    isPrimary: true,
  },
  escape_plan: {
    id: 'escape_plan',
    name: '预留退路',
    characterId: 'trapper',
    staminaCost: GAME_CONFIG.skillEscapePlanStaminaCost,
    cooldown: GAME_CONFIG.skillEscapePlanCooldown,
    dimension: '区域控制',
    description: `持续 ${GAME_CONFIG.skillEscapePlanDuration} 回合，提高正式脱离成功率。`,
    unlockLevel: SECONDARY_SKILL_UNLOCK_LEVEL,
    isPrimary: false,
  },
};

const CHARACTER_SKILL_IDS: Record<string, SkillId[]> = {
  scout: ['scout_recon', 'scout_smoke'],
  fighter: ['adrenaline', 'fighter_focus'],
  engineer: ['field_craft', 'engineer_reinforce'],
  medic: ['emergency_treatment', 'medic_regen'],
  survivor: ['second_wind', 'camp_routine'],
  scavenger: ['scavenge_focus', 'sort_rare'],
  hunter: ['track_target', 'steady_aim'],
  trapper: ['prepare_ambush', 'escape_plan'],
};

/** 返回角色的技能集合，主技能始终位于第一个位置。 */
export function getCharacterSkills(characterId: string): SkillId[] {
  return [...(CHARACTER_SKILL_IDS[characterId] ?? [])];
}

/** 向后兼容的主技能查询；既有调用点继续只取得主技能。 */
export function getCharacterSkill(characterId: string): SkillId | null {
  return getCharacterSkills(characterId).find((skillId) => SKILLS[skillId].isPrimary) ?? null;
}

export function getSkill(skillId: SkillId): SkillDef {
  return SKILLS[skillId];
}
