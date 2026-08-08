/**
 * 全局游戏配置。所有魔法数字集中在这里，方便平衡调整与测试。
 */
/**
 * 存档版本。
 *
 * Phase 3A 改了三处**不可向后兼容**的状态结构：EXPOSED 状态、四角色技能全部换 id、
 * 世界事件取代动态事件。0.2.0 存档里的 `dash` / `storm` 等字段在新规则下没有对应语义，
 * 强行读入只会得到一个自相矛盾的局面。因此**明确拒绝**旧档，不做迁移。
 */
export const GAME_VERSION = '0.3.0';

/** 默认测试种子 */
export const DEFAULT_SEED = 'BR-DEMO-001';

/** 存档 localStorage key（第二阶段起为 v2） */
export const SAVE_KEY = 'zone-br.save.v2';

/**
 * 历史版本的存档 key。
 * 第二阶段**不做静默迁移**：检测到旧档只在主菜单提示，并允许玩家删除。
 */
export const LEGACY_SAVE_KEYS: string[] = ['zone-br.save.v1'];

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

  /* --- 四角色技能（Phase 3A Step 4 重定义） ---
   *
   * Phase 3 的四个技能全是纯战斗数值增益（回血、加伤、加闪避），
   * 谁拿到都一样好用，角色之间只剩数字大小的差别。
   * Phase 3A 把它们重写为**战略身份技能**：每个技能强化的是该角色
   * 在「信息 / 战斗节奏 / 合成 / 消耗品经济」四条线里的看家本事。
   */
  /** 技能冷却时间单位（使用后置为 cooldown，每时间单位 -1） */
  skillCooldown: 6,

  /* 侦察员 · 战场侦察（信息） */
  /** 侦察半径：0 = 仅当前区域，1 = 当前 + 相邻区域 */
  skillReconRadius: 1,
  /** 侦察得到的情报视为「新鲜」的时长（写入 playerIntel 后自然老化） */
  skillReconStaminaCost: 2,

  /* 斗士 · 肾上腺素（战斗节奏，收益与代价并存） */
  /** 生效的攻击次数（用完即失效） */
  skillAdrenalineAttacks: 3,
  /** 每次攻击的体力折扣（实际成本下限 1） */
  skillAdrenalineStaminaDelta: -1,
  /** 代价：状态期间自身受到的伤害倍率 */
  skillAdrenalineSelfDamageMult: 1.25,
  skillAdrenalineStaminaCost: 3,

  /* 工程师 · 野外工造（合成） */
  /** 生效的合成次数（期间合成体力成本为 0） */
  skillFieldCraftCharges: 2,
  /** 兜底存续时间单位（防止拿到手却一直不合成，状态永久挂着） */
  skillFieldCraftDuration: 8,
  skillFieldCraftStaminaCost: 2,

  /* 医学生 · 紧急处置（消耗品经济） */
  /** 状态持续时间单位 */
  skillTreatmentDuration: 5,
  /** 状态期间治疗类消耗品的效果倍率 */
  skillTreatmentConsumableMult: 1.25,
  /** 施放瞬间的止血量（按最大生命比例，同时清除持续掉血类状态） */
  skillTreatmentInstantHealRatio: 0.12,
  skillTreatmentStaminaCost: 3,

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

  /* blackout 大停电（区域级） */
  blackoutDuration: 4,
  /** 停电区域内命中率乘数（看不清） */
  blackoutHitMult: 0.85,
  /** 停电区域内搜索「找到东西」权重乘数 */
  blackoutSearchMult: 0.7,

  /* rain 连绵阴雨（全局） */
  rainDuration: 6,
  /** 雨天全局命中率乘数 */
  rainHitMult: 0.9,
  /** 雨天逃跑成功率加成（湿滑难追） */
  rainFleeBonus: 0.1,

  /* emergency_broadcast 紧急广播（全局） */
  broadcastDuration: 3,

  /* medical_alert 医疗管制（全局） */
  medicalAlertDuration: 5,
  /** 管制期间治疗类消耗品效果乘数 */
  medicalAlertHealMult: 0.75,
  /** 管制期间医疗物资搜索权重加成（物资被翻出来了） */
  medicalAlertMedicalFindBonus: 0.35,

  /* research_anomaly 研究异常（区域级） */
  researchAnomalyDuration: 5,
  /** 异常区域内材料类物品搜索权重加成 */
  researchAnomalyMaterialFindBonus: 0.6,
  /** 异常区域内装备每次判定的额外耐久损耗 */
  researchAnomalyDurabilityLoss: 1,

  /* citywide_unrest 全城骚动（全局） */
  unrestDuration: 5,
  /** 骚动期间 NPC 进攻倾向加成 */
  unrestAggressionBonus: 0.25,
  /** 骚动期间搜索遭遇敌人的权重乘数 */
  unrestEncounterMult: 1.3,

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
