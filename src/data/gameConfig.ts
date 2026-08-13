/**
 * 全局游戏配置。所有魔法数字集中在这里，方便平衡调整与测试。
 */
/**
 * 存档版本。
 *
 * Phase 4N adds finite wild populations and discriminated encounters.
 * Older saves cannot reconstruct already-consumed ecology and are rejected.
 * Compatibility is DEFERRED UNTIL PRE-RELEASE.
 */
export const GAME_VERSION = '0.5.0';

/** 默认测试种子 */
export const DEFAULT_SEED = 'BR-DEMO-001';

/** 存档 localStorage key（第二阶段起为 v2） */
export const SAVE_KEY = 'zone-br.save.v3';

/**
 * 历史版本的存档 key。
 * 第二阶段**不做静默迁移**：检测到旧档只在主菜单提示，并允许玩家删除。
 */
export const LEGACY_SAVE_KEYS: string[] = ['zone-br.save.v1', 'zone-br.save.v2'];

export const GAME_CONFIG = {
  /** 参赛者总数：1 玩家 + 5 NPC */
  totalContestants: 6,
  npcCount: 5,

  /** 背包格数 */
  inventorySlots: 8,

  /* --- 体力消耗 --- */
  searchStaminaCost: 5,
  craftStaminaCost: 2,
  craftStaminaCostEngineer: 1,
  moveStaminaCost: 3,
  attackStaminaCost: 2,
  /**
   * 脱离战斗是**免费行动**（Phase 2A）。
   *
   * 原先脱离要 2 点体力，于是出现了真实的死锁：
   * 玩家体力为 0 且陷入遭遇战时，攻击付不起、逃跑也付不起，
   * 界面上没有任何能推进时间的按钮，对局卡死。
   *
   * 改为 0 之后逃跑永远可选，但**并非没有代价**：
   * - 逃跑仍然消耗 1 个时间单位（禁区伤害 / 终局衰竭会照常结算）；
   * - 逃跑失败时敌人会获得一次追击，追击可以直接把人打死。
   * 因此"无限重试"要付出时间与生命，不存在零风险刷逃跑。
   */
  fleeStaminaCost: 0,
  restStaminaGain: 15,

  /* --- 搜索 --- */
  /** 基础权重（发现 / 遭遇 / 空手） */
  searchBaseFindWeight: 60,
  searchBaseEnemyWeight: 20,
  searchBaseNothingWeight: 20,

  /* --- 有限物资（第二阶段核心改动） --- */
  /** 每个区域开局生成的普通物资件数区间（含端点） */
  zoneLootNormalMin: 18,
  zoneLootNormalMax: 28,
  /** 每个区域开局生成的稀有物资件数区间（含端点） */
  zoneLootRareMin: 2,
  zoneLootRareMax: 5,
  /** 搜索时优先命中稀有物资的概率（仍有稀有库存时才生效） */
  rareChance: 0.18,
  /** 剩余物资比例分档：> 充足 / > 一般 / > 稀少 / = 0 已被搜空 */
  supplyRichThreshold: 0.6,
  supplyNormalThreshold: 0.3,
  supplyScarceThreshold: 0,
  /** 区域被搜空后，"一无所获"权重的额外加成 */
  emptyZoneNothingBonus: 120,

  /* --- 战斗 --- */
  baseHitChance: 0.62,
  minHitChance: 0.35,
  maxHitChance: 0.95,
  damageRandomMax: 4,
  minDamage: 1,
  baseCounterChance: 0.35,
  baseFleeChance: 0.45,
  /** 远程武器命中加成 */
  rangedHitBonus: 0.08,

  /* --- 经验与等级（Phase 4F-1） --- */
  maxLevel: 5,
  /**
   * 各等级升到下一级所需的“当前级经验”；5 级封顶，不再累计经验。
   *
   * 累计 430 是照单局经验总量的分位数定的：实测中位数 230、95 分位 397，
   * 所以满级落在 95 分位之上 —— 满级罕见但可达，而不是够不着。
   * 三组独立种子 × 100 局的最终等级分布稳定在
   * Lv.3 约 48%、Lv.4 约 43%、Lv.5 约 2~4%。
   */
  levelExpThresholds: [30, 100, 140, 160],
  levelAttackGain: 1,
  levelDefenseGain: 1,
  levelMaxHpGain: 10,
  /** 单次有体力成本的攻击结算：攻击者与承受者各得一次。 */
  expCombatParticipation: 8,
  /** 击杀者在参与经验之外获得的额外奖励。 */
  expKillBonus: 7,
  expSearch: 1,
  expExplore: 1,
  /** 合成经验按成品既有 value 派生，不新增物品分级字段。 */
  expCraftValueDivisor: 6,
  expCraftMin: 2,
  expCraftMax: 6,

  /* --- 战斗风格（Phase 3 Step 1） --- */
  /** 攻击风格的体力成本：quick 轻量、normal 基准、heavy 重击 */
  attackStyleStaminaCost: { quick: 1, normal: 2, heavy: 4 },
  /** 攻击风格的伤害倍率（heavy 明显更痛，quick 偏轻） */
  attackStyleDamageMult: { quick: 0.7, normal: 1.0, heavy: 1.6 },
  /** 攻击风格的命中倍率（quick 更易命中、heavy 更易落空） */
  attackStyleHitMult: { quick: 1.15, normal: 1.0, heavy: 0.8 },
  /** 防守方被某种风格命中时的反击概率倍率（heavy 破绽更大，更易招来反击） */
  attackStyleCounterVuln: { quick: 0.8, normal: 1.0, heavy: 1.4 },

  /* --- 防御姿态（Phase 3 Step 1） --- */
  /** 摆出防御姿态的体力成本 */
  guardStaminaCost: 2,
  /** 防御姿态对下一次所受伤害的减免比例 */
  guardDamageReduction: 0.5,

  /* --- EXPOSED 露出破绽（Phase 3A Step 3） --- */
  /** 处于破绽时，受到的攻击类战斗伤害倍率（1.2 = +20%） */
  exposedDamageMult: 1.2,
  /**
   * 破绽的兜底存续时间单位。
   * 正常情况下破绽由「挨打」或「自己下次行动」清除，
   * 这个值只防止极端情况（既不行动也不挨打）导致状态永久残留。
   */
  exposedMaxDuration: 6,

  /* --- 既有四角色签名技能（Phase 3A-1 严格回归规格） ---
   *
   * 每个技能自带 cooldown，禁止全局统一冷却。
   * 数值与 SKILL_DESIGN.md 逐字一致。
   */
  /** 第二技能统一在 Lv.3 解锁；解锁状态由角色 level 推导，不入存档。 */
  skillSecondaryUnlockLevel: 3,

  /* 侦察员 · 警觉侦察（信息） */
  /** 冷却 */
  skillReconCooldown: 10,
  /** 体力成本 */
  skillReconStaminaCost: 3,
  /** SCOUT_AWARENESS 持续时间（噪音增强 + 搜索遭遇先手） */
  skillReconDuration: 3,
  /** NPC 警觉状态下搜索遭遇敌人权重的加成（只提升搜索权重，不获得角色位置） */
  scoutAwarenessNpcSearchBoost: 1.25,

  /* 斗士 · 肾上腺素（战斗节奏，收益与代价并存） */
  /** 冷却 */
  skillAdrenalineCooldown: 12,
  /** 体力成本 */
  skillAdrenalineStaminaCost: 3,
  /** 生效的攻击次数（用完即失效） */
  skillAdrenalineAttacks: 2,
  /** 兜底存续时间单位（与次数以先发生者为准） */
  skillAdrenalineDuration: 6,
  /** 状态期间最终攻击伤害倍率（必须真正进入 computeDamage） */
  skillAdrenalineDamageMult: 1.2,
  /** 每次攻击的体力折扣（实际成本下限 1） */
  skillAdrenalineStaminaDelta: -1,
  /** 代价：状态期间自身受到的战斗攻击伤害倍率（不得 1.25） */
  skillAdrenalineSelfDamageMult: 1.1,

  /* 工程师 · 现场加工（合成） */
  /** 冷却 */
  skillFieldCraftCooldown: 10,
  /** 体力成本 */
  skillFieldCraftStaminaCost: 2,
  /** 兜底存续时间单位（一次成功合成即消失；6 回合未成功则失效） */
  skillFieldCraftDuration: 6,

  /* 医学生 · 应急处理（消耗品经济） */
  /** 冷却 */
  skillTreatmentCooldown: 10,
  /** 体力成本 */
  skillTreatmentStaminaCost: 3,
  /** 立即恢复的固定生命值（不是最大生命百分比） */
  skillTreatmentInstantHeal: 15,
  /** MEDICAL_FOCUS 持续时间 */
  skillTreatmentDuration: 4,
  /** 状态期间治疗类消耗品最终治疗量倍率 */
  skillTreatmentConsumableMult: 1.25,

  /* --- Lv.3 第二技能（Phase 4I-1） ---
   * 只复用既有体力、冷却与 StatusEffect 字段，不新增资源或随机抽取。
   */
  skillScoutSmokeCooldown: 10,
  skillScoutSmokeStaminaCost: 3,
  skillScoutSmokeDuration: 3,
  skillScoutSmokeEvasionMult: 0.75,

  skillFighterFocusCooldown: 12,
  skillFighterFocusStaminaCost: 3,
  skillFighterFocusDuration: 3,
  skillFighterFocusHitChanceMult: 1.15,

  skillEngineerReinforceCooldown: 10,
  skillEngineerReinforceStaminaCost: 2,
  skillEngineerReinforceDuration: 4,
  skillEngineerReinforceDefenseBonus: 2,

  skillMedicRegenCooldown: 10,
  skillMedicRegenStaminaCost: 3,
  skillMedicRegenDuration: 3,
  skillMedicRegenHpPerTick: 4,

  /* --- Phase 4L 新职业技能 --- */
  /** 生存专家 · 第二呼吸：正体力成本换即时体力恢复 */
  skillSecondWindCooldown: 10,
  skillSecondWindStaminaCost: 3,
  skillSecondWindRestore: 12,
  /** 生存专家 · 扎营：只提高后续 REST，不提供免费行动 */
  skillCampRoutineCooldown: 8,
  skillCampRoutineStaminaCost: 2,
  skillCampRoutineDuration: 3,
  skillCampRoutineRestBonus: 5,

  /** 拾荒者 · 搜索专注：提高正式搜索的发现权重 */
  skillScavengeFocusCooldown: 9,
  skillScavengeFocusStaminaCost: 3,
  skillScavengeFocusDuration: 4,
  skillScavengeFocusFindMult: 1.35,
  /** 拾荒者 · 筛选稀有：提高正式 loot pool 的稀有抽取机会 */
  skillSortRareCooldown: 10,
  skillSortRareStaminaCost: 2,
  skillSortRareDuration: 4,
  skillSortRareChanceBonus: 0.12,

  /** 猎人 · 追踪目标：只提高搜索遭遇权重，不揭示位置 */
  skillTrackTargetCooldown: 10,
  skillTrackTargetStaminaCost: 3,
  skillTrackTargetDuration: 4,
  skillTrackTargetEnemyMult: 1.5,
  /** 猎人 · 稳定瞄准：只提高远程攻击命中率 */
  skillSteadyAimCooldown: 12,
  skillSteadyAimStaminaCost: 3,
  skillSteadyAimDuration: 3,
  skillSteadyAimRangedHitMult: 1.15,

  /** 陷阱师 · 埋伏准备：把一次防御姿态与反击窗口绑定 */
  skillPrepareAmbushCooldown: 9,
  skillPrepareAmbushStaminaCost: 2,
  skillPrepareAmbushDuration: 4,
  skillPrepareAmbushCounterBonus: 0.2,
  /** 陷阱师 · 预留退路：为未来一次撤离保留确定性加成 */
  skillEscapePlanCooldown: 10,
  skillEscapePlanStaminaCost: 2,
  skillEscapePlanDuration: 4,
  skillEscapePlanFleeBonus: 0.2,

  /* --- 禁区 --- */
  /** 第一次公布禁区的时间单位 */
  firstZoneEventTime: 8,
  /** 之后每隔多少时间单位新增一个禁区 */
  zoneEventInterval: 6,
  /** 预警持续时间单位 */
  zoneWarningDuration: 2,
  /** 正式禁区每时间单位造成的伤害 */
  zoneDamagePerTick: 20,
  /** 终局阶段禁区伤害的额外倍率 */
  zoneDamageFinaleMultiplier: 1.5,
  /** 最少保留的安全区域数量 */
  minSafeZones: 1,

  /* --- 阶段与终局收束（第二阶段核心改动） --- */
  /** 进入中局的时间单位 */
  midgameStartTime: 12,
  /** 无论如何都会强制进入终局的时间单位 */
  finaleForcedTime: 90,
  /** 存活人数降到该值及以下时立即进入终局 */
  finaleAliveThreshold: 2,
  /** 全场剩余物资比例低于该值时进入终局 */
  finaleLootRatioThreshold: 0.15,
  /** 终局每时间单位的基础衰竭伤害 */
  finaleDecayBase: 4,
  /** 终局每多持续 1 个时间单位，衰竭伤害的增量 */
  finaleDecayGrowth: 2,
  /** 衰竭伤害上限，防止数值爆炸 */
  finaleDecayMax: 40,
  /** 对局硬上限：到达即强制结算 */
  hardTimeLimit: 180,

  /* --- 噪音（信息不完全） --- */
  /** 一次搜索产生的噪音值 */
  noiseFromSearch: 1,
  /** 一次战斗产生的噪音值 */
  noiseFromCombat: 3,
  /** 一次死亡产生的噪音值 */
  noiseFromDeath: 4,
  /** 每时间单位噪音衰减量 */
  noiseDecayPerTick: 1,
  /** 噪音分档阈值：>= 为"嘈杂"，>= 为"有动静"，否则"安静" */
  noiseLoudThreshold: 5,
  noiseActiveThreshold: 2,

  /* --- 事件日志体积控制 --- */
  /** 低重要度事件的保留上限，超出后从最旧的开始丢弃 */
  minorEventRetention: 220,
  /** 事件总量硬上限 */
  eventHardLimit: 900,

  /* --- NPC --- */
  /** 生命低于该比例时优先治疗 */
  npcHealThreshold: 0.3,
  /** 体力低于该值时优先休息 */
  npcRestThreshold: 12,
  /** 谨慎型回避战斗的生命比例线 */
  cautiousAvoidHpRatio: 0.6,
  /** NPC 制作目标的有效期（时间单位），过期后重新规划 */
  npcPlanTtl: 10,
  /** 目标连续无进展多少回合后触发重规划（Phase 2A-1） */
  npcPlanNoProgressLimit: 5,

  /* --- 掉落 --- */
  maxCorpseDrops: 3,

  /* --- 被动数值 --- */
  /** 搏击：近战额外伤害（Phase 2A-1 从 2 削弱到 1） */
  brawlerMeleeBonus: 1,
  /** 搏击：逃跑成功率惩罚（Step 9 调优：从 0.15 降到 0.10，减少斗士被缠住的概率以收敛胜率比） */
  brawlerFleePenalty: 0.1,
  /** 锐目：搜索空手概率倍率（Phase 2A-1 从 0.5 加强到 0.4） */
  keenEyeNothingMultiplier: 0.4,
  /** 锐目：遭遇发现率加成（Phase 2A-1 新增） */
  keenEyeEncounterBonus: 1.5,
  /** 锐目：逃跑成功率加成（Phase 2A-1 新增） */
  keenEyeFleeBonus: 0.08,
  /** 临床：治疗量倍率（Phase 2A-1 从 1.5 加强到 1.8；Step 9 调优收敛胜率比回落到 1.6） */
  medicHealMultiplier: 1.6,
  /** 临床：医院搜索加成（Phase 2A-1 从 0.3 加强到 0.45） */
  medicHospitalFindBonus: 0.45,
  /** 巧手：材料类物品搜索权重（Phase 2A-1 从 1.6 加强到 2.2） */
  tinkererMaterialBias: 2.2,
  /** 生存专家：休息额外恢复 */
  enduringRestBonus: 4,
  /** 生存专家：禁区侵蚀倍率 */
  enduringZoneDamageMult: 0.8,
  /** 拾荒者：发现物品权重倍率 */
  resourcefulFindMult: 1.2,
  /** 拾荒者：材料偏好倍率 */
  resourcefulMaterialBias: 1.6,
  /** 猎人：已知目标远程命中加成 */
  trackerKnownRangedHitMult: 1.08,
  /** 陷阱师：防御姿态反击概率加成 */
  trapsetterCounterBonus: 0.2,

  /* --- 世界事件（Phase 3A Step 6，取代 Phase 3 的动态事件） --- */
  /**
   * 是否启用世界事件。
   *
   * 6 种事件全部是**环境修正型**：只改判定用的乘数/加成，不直接扣血、
   * 不写隐藏库存、不瞬移角色 —— 因此结构上不可能绕过 `applyDamage`。
   */
  worldEventsEnabled: true,
  /** 首个世界事件最早出现的时间单位 */
  firstWorldEventTime: 10,
  /** 两次世界事件之间的最小间隔 */
  worldEventIntervalMin: 8,
  /** 两次世界事件之间的最大间隔 */
  worldEventIntervalMax: 14,
  /**
   * 同时生效的世界事件上限。
   * 超过上限时新事件不会触发（调度仍然推进），避免修正叠乘到失控。
   */
  maxConcurrentWorldEvents: 2,
  /** 同一种事件在生效期间不会重复触发（去重靠 eventId） */

  /* blackout 大停电（全局） */
  blackoutDuration: 6,
  /** 搜索「遭遇敌人」权重乘数（-20%） */
  blackoutSearchEnemyMult: 0.8,
  /** 搜索「空手」权重乘数（+10%） */
  blackoutSearchNothingMult: 1.1,

  /* rain 连绵阴雨（全局） */
  rainDuration: 6,
  /** 移动体力成本加成（玩家与 NPC 同时生效，走 actionCosts） */
  rainMoveCostBonus: 1,
  /** 远程武器命中率乘数（近战与逃跑不受影响） */
  rainRangedHitMult: 0.9,

  /* emergency_broadcast 紧急广播（全局·即时，无持续时间） */

  /* medical_alert 医疗警报（仅医院生效） */
  medicalAlertDuration: 5,
  /** 医院内治疗类消耗品最终治疗量倍率 */
  medicalAlertHealMult: 1.2,

  /* research_anomaly 研究异常（固定研究所） */
  researchAnomalyDuration: 4,
  /** 固定生效区域（不是随机区域） */
  researchAnomalyZoneId: 'lab',
  /** 每时间单位环境伤害（必须走 applyDamage） */
  researchAnomalyDamagePerTick: 3,

  /* citywide_unrest 全城骚动（全局） */
  unrestDuration: 3,
  /** 搜索产生的噪音乘数 */
  unrestSearchNoiseMult: 1.5,

  /**
   * 6 种事件的相对权重。
   * 全部设为 1（等概率），以保证「3000 局中 6 种事件各 ≥ 50 次」的验收门槛
   * 有充足余量：期望每种约占总触发数的 1/6。
   */
  worldEventWeights: {
    blackout: 1,
    rain: 1,
    emergency_broadcast: 1,
    medical_alert: 1,
    research_anomaly: 1,
    citywide_unrest: 1,
  },
} as const;

/** 事件日志在界面上默认展示的条数 */
export const LOG_DISPLAY_COUNT = 20;
