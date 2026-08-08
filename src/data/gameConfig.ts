/**
 * 全局游戏配置。所有魔法数字集中在这里，方便平衡调整与测试。
 */
export const GAME_VERSION = '0.2.0';

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

  /* --- 四角色技能（Phase 3 Step 3） --- */
  /** 技能冷却时间单位（使用后置为 cooldown，每时间单位 -1） */
  skillCooldown: 5,
  /** 医学生「急救」：恢复最大生命的比例（Step 9 调优：略降以收敛角色胜率比） */
  skillFirstAidHealRatio: 0.3,
  /** 工程师「应急修理」：恢复体力的比例（额外修复装备耐久） */
  skillRepairStaminaRatio: 1.0,
  /** 工程师「应急修理」：装备武器耐久修复量（不超过物品上限） */
  skillRepairDurability: 25,
  /** 工程师「应急修理」：额外恢复生命的比例（Step 9 调优：让修理也提供续航，抬升工程师胜率） */
  skillRepairHealRatio: 0.2,
  /** 斗士「破甲」增益持续回合 */
  skillSunderDuration: 3,
  /** 斗士「破甲」命中倍率 */
  skillSunderHitMult: 1.12,
  /** 斗士「破甲」伤害倍率 */
  skillSunderDamageMult: 1.6,
  /** 侦察「疾影」增益持续回合（Step 9 调优：延长闪避覆盖以抬升侦察员胜率） */
  skillDashDuration: 2,
  /** 侦察「疾影」闪避倍率（<1 降低被命中） */
  skillDashEvasionMult: 0.5,

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

  /* --- 动态事件（Phase 3 Step 4） --- */
  /** 是否启用区域内动态事件 */
  dynamicEventsEnabled: true,
  /** 首个动态事件最早出现的时间单位 */
  firstDynamicEventTime: 12,
  /** 两次动态事件之间的最小间隔 */
  dynamicEventIntervalMin: 9,
  /** 两次动态事件之间的最大间隔 */
  dynamicEventIntervalMax: 15,
  /** 各事件相对权重（用于加权随机） */
  stormWeight: 1,
  supplyDropWeight: 1,
  ambushWeight: 1,
  /** 风暴持续回合 */
  stormDuration: 3,
  /** 风暴每回合对区域内角色造成的伤害 */
  stormDamagePerTick: 5,
  /** 空投投放的物品 id 池 */
  supplyDropItems: ['medkit', 'energy_drink', 'scrap'],
  /** 空投每次投放的件数 */
  supplyDropCount: 3,
  /** 空投优先投放到预警/安全区域（false 则全区域随机） */
  supplyDropPreferSafe: true,
  /** 伏击造成的即时伤害 */
  ambushDamage: 8,
} as const;

/** 事件日志在界面上默认展示的条数 */
export const LOG_DISPLAY_COUNT = 20;
