/**
 * 全局类型定义。
 * 所有核心实体都在这里声明，UI 与 core 共用同一套类型。
 */

/* ------------------------------------------------------------------ */
/* 物品                                                                */
/* ------------------------------------------------------------------ */

export type ItemCategory = 'material' | 'weapon' | 'armor' | 'consumable';

/** 第一版只区分近战 / 远程，远程不实现弹道，仅在数值与日志上体现 */
export type WeaponType = 'melee' | 'ranged';

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  /** 价值评分：用于 NPC 取舍、尸体掉落排序、结算展示 */
  value: number;
  stackable: boolean;
  maxStack: number;
  /* 武器 */
  weaponType?: WeaponType;
  attack?: number;
  durability?: number;
  /* 防具 */
  defense?: number;
  /* 消耗品 */
  healHp?: number;
  healStamina?: number;
}

/** 背包 / 地面上的一个物品实例 */
export interface ItemStack {
  /** 实例唯一 ID，用于精确定位某一格 */
  uid: string;
  itemId: string;
  count: number;
  /** 武器当前耐久，非武器为 undefined */
  durability?: number;
}

/* ------------------------------------------------------------------ */
/* 角色                                                                */
/* ------------------------------------------------------------------ */

export type PassiveId = 'keen_eye' | 'brawler' | 'tinkerer' | 'field_medic';

export interface CharacterDef {
  id: string;
  name: string;
  description: string;
  maxHp: number;
  maxStamina: number;
  attack: number;
  defense: number;
  perception: number;
  speed: number;
  crafting: number;
  medical: number;
  passiveId: PassiveId;
  /** 被动效果的一句话说明（UI 展示用） */
  passiveName: string;
  passiveDescription: string;
}

export type Personality =
  | 'aggressive'
  | 'cautious'
  | 'collector'
  | 'opportunist'
  | 'random';

export interface StatusEffect {
  id: string;
  /** 剩余时间单位，<=0 时移除 */
  remaining: number;
  /** 每时间单位生命变化（负数为伤害） */
  hpPerTick: number;
  label: string;
  /** Phase 3 Step 3 战斗增益（可选；未设置视为 1 / 0） */
  /** 攻击方命中率倍率 */
  hitChanceMult?: number;
  /** 攻击方伤害倍率 */
  damageMult?: number;
  /** 受击方额外防御（减伤，单位同 attack/defense） */
  defenseBonus?: number;
  /** 受击方闪避倍率（<1 降低被命中概率） */
  evasionHitMult?: number;
  /** Phase 3A：受击方所受「攻击类战斗伤害」的倍率（EXPOSED 用，>1 为额外吃伤） */
  damageTakenMult?: number;
  /**
   * Phase 3A：跳过一次「自身行动完成即清除」的判定。
   * EXPOSED 在角色自己行动的中途产生，若不跳过就会被同一次行动立刻清掉。
   */
  skipOwnActionClearOnce?: boolean;
  /** Phase 3A：剩余可生效的攻击次数（肾上腺素用；不设置表示不按次数计） */
  remainingAttacks?: number;
  /** Phase 3A：攻击体力折扣（肾上腺素 -1，最低仍受 minAttackStamina 约束） */
  attackStaminaDelta?: number;
  /** Phase 3A：自身承受战斗伤害的倍率（肾上腺素换来的自伤代价） */
  selfDamageTakenMult?: number;
  /** Phase 3A：剩余免费合成次数（工程师野外工造） */
  remainingCrafts?: number;
  /** Phase 3A：治疗物品效果倍率（医学生 MEDICAL_FOCUS +25%） */
  consumableHealMult?: number;
}

export interface CombatantStats {
  searches: number;
  crafts: number;
  moves: number;
  itemsUsed: number;
  attacks: number;
  damageDealt: number;
  /** 累计承受伤害（含战斗、禁区、衰竭） */
  damageTaken: number;
}

export interface Combatant {
  id: string;
  name: string;
  isPlayer: boolean;
  characterId: string;
  personality: Personality;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  attack: number;
  defense: number;
  perception: number;
  speed: number;
  crafting: number;
  medical: number;
  passiveId: PassiveId;
  currentZoneId: string;
  /** 背包，最多 INVENTORY_SLOTS 格 */
  inventory: ItemStack[];
  /** 已装备的物品实例（不占用背包格） */
  equipment: ItemStack[];
  /** 指向 equipment 中某个 ItemStack.uid */
  equippedWeaponId: string | null;
  equippedArmorId: string | null;
  alive: boolean;
  kills: number;
  statusEffects: StatusEffect[];
  /** 最近一次行动的机器可读标识 */
  lastAction: string | null;
  /** 最近一次行动的原因（调试面板用） */
  lastActionReason: string | null;
  /** 已经见过的敌人 id */
  knownEnemies: string[];
  killedBy: string | null;
  diedAtTime: number | null;
  stats: CombatantStats;

  /* --- 制作目标（第二阶段） --- */
  /**
   * NPC 当前锁定的制作目标配方 id。
   * 玩家的目标存在 `GameState.craftGoalRecipeId`，两者刻意分开：
   * 玩家目标由界面显式设置，NPC 目标由 AI 自动规划。
   */
  plannedRecipeId: string | null;
  /** 该目标是在第几个时间单位定下的（用于过期重规划） */
  planCreatedAt: number | null;
  /** 定下该目标的理由（调试面板展示） */
  planReason: string | null;
  /** 目标完成度 0..1（已持有材料 / 所需材料），每回合由规划器刷新（Phase 2A-1） */
  planProgress: number;
  /** 连续无进展回合数（超过阈值触发重规划，Phase 2A-1） */
  planNoProgressTurns: number;
  /** 计划推荐前往搜索的区域 id（Phase 2A-1） */
  planRecommendedZoneId: string | null;
  /** 最近一次重规划的原因（调试面板展示，Phase 2A-1） */
  lastReplanReason: string | null;
  /** 最远抵达的阶段，用于结算展示 */
  furthestPhase: GamePhase;
  /** 是否处于防御姿态（Phase 3 Step 1）：下次受击伤害减免，出手或被新攻击命中后解除 */
  guarding: boolean;
  /** 技能冷却：skillId -> 剩余冷却时间单位（Phase 3 Step 3） */
  skillCooldowns: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/* 区域                                                                */
/* ------------------------------------------------------------------ */

export interface ZoneDef {
  id: string;
  name: string;
  description: string;
  /** 相邻区域 id，双向 */
  adjacent: string[];
  /** 基础物品池 */
  basePool: string[];
  /** 稀有物品池 */
  rarePool: string[];
  /** 色块主题色（UI 占位美术用） */
  color: string;
}

export type ZoneStatus = 'safe' | 'warning' | 'restricted';

/** 物资稀有度 */
export type LootRarity = 'normal' | 'rare';

/**
 * 区域物资库存中的一条。
 * 第二阶段起，区域物资是**开局一次性生成的有限清单**，
 * 每次搜索从这里扣减，扣完即"搜空"，不再有任何补充。
 */
export interface ZoneLootEntry {
  itemId: string;
  /** 剩余件数，扣到 0 后该条目被移除 */
  count: number;
  rarity: LootRarity;
}

/** 区域噪音等级（玩家可见的模糊信息） */
export type NoiseLevel = 'quiet' | 'active' | 'loud';

/** 玩家可见的区域物资状态（模糊分档，精确数字仅调试面板可见） */
export type SupplyStatus = 'rich' | 'normal' | 'scarce' | 'empty';

export interface ZoneState {
  id: string;
  status: ZoneStatus;
  /** 该区域被搜索过的次数 */
  searchCount: number;
  /**
   * 剩余物资比例 = remainingLootCount / initialLootCount，取值 [0, 1]。
   * 这是一个**派生字段**，由物资系统在每次扣减后同步维护，
   * 供搜索权重、NPC 决策与调试面板直接读取。
   */
  supply: number;
  /** 有限物资库存 */
  loot: ZoneLootEntry[];
  /** 开局生成的物资总件数（普通 + 稀有） */
  initialLootCount: number;
  /** 当前剩余物资总件数 */
  remainingLootCount: number;
  /** 库存已空之后又被搜索了多少次（用于提示"这里已经被翻烂了"） */
  searchedEmptyCount: number;
  /** 进入预警的时间单位 */
  warningAtTime: number | null;
  /** 正式成为禁区的时间单位 */
  restrictedAtTime: number | null;
  /** 地面上的掉落物（尸体 / 丢弃） */
  groundItems: ItemStack[];
  /** 当前该区域存活角色 id（每个时间单位刷新） */
  aliveCharacterIds: string[];
  /** 最近一次发生战斗的时间单位，-1 表示从未 */
  lastCombatTime: number;
  /** 最近一次产生噪音的时间单位，-1 表示从未 */
  lastNoiseTime: number;
  /** 噪音累计值，随时间衰减；玩家只能看到它的分档结果 */
  noiseLevel: number;
}

/* ------------------------------------------------------------------ */
/* 配方                                                                */
/* ------------------------------------------------------------------ */

export interface RecipeIngredient {
  itemId: string;
  count: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  outputItemId: string;
  outputCount: number;
  description: string;
}

/* ------------------------------------------------------------------ */
/* 事件                                                                */
/* ------------------------------------------------------------------ */

export type GameEventType =
  | 'GAME_STARTED'
  | 'CHARACTER_MOVED'
  | 'SEARCH_STARTED'
  | 'ITEM_FOUND'
  | 'ITEM_PICKED'
  | 'ITEM_DROPPED'
  | 'ITEM_USED'
  | 'ITEM_CRAFTED'
  | 'ITEM_EQUIPPED'
  | 'ENCOUNTER_STARTED'
  | 'ATTACK_HIT'
  | 'ATTACK_MISSED'
  | 'CHARACTER_ESCAPED'
  | 'CHARACTER_DIED'
  | 'ZONE_WARNING'
  | 'ZONE_RESTRICTED'
  | 'ZONE_DAMAGE'
  | 'ZONE_EXHAUSTED'
  | 'PHASE_CHANGED'
  | 'FINALE_DECAY'
  | 'CRAFT_GOAL_SET'
  | 'NPC_ACTION'
  | 'REST'
  | 'GUARD'
  | 'SKILL_USED'
  /** Phase 3A：状态失效（目前用于 EXPOSED 的条件B 解除） */
  | 'STATUS_EXPIRED'
  /** Phase 3A：世界事件开始（取代已删除的 DYNAMIC_EVENT） */
  | 'WORLD_EVENT'
  /** Phase 3A：世界事件结束 */
  | 'WORLD_EVENT_ENDED'
  | 'GAME_ENDED';

/**
 * 事件重要度。
 * - `critical`：死亡、阶段切换、对局结束 —— 永远保留
 * - `major`：战斗命中、合成、禁区变化、稀有物品 —— 保留到硬上限
 * - `minor`：普通搜索、移动、空手 —— 超过保留额度后从最旧的开始裁剪
 */
export type EventImportance = 'critical' | 'major' | 'minor';

/** 事件附带的结构化数据，值域刻意保持简单以便序列化 */
export type EventMetadata = Record<string, string | number | boolean | null>;

export interface GameEvent {
  id: string;
  type: GameEventType;
  time: number;
  actorId: string | null;
  targetId: string | null;
  zoneId: string | null;
  message: string;
  importance: EventImportance;
  metadata: EventMetadata;
}

/** 被裁剪掉的事件仍然保留统计，避免"发生过什么"这一信息彻底丢失 */
export interface EventCounters {
  total: number;
  archived: number;
  byType: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/* 遭遇 / 待处理交互                                                    */
/* ------------------------------------------------------------------ */

export interface EncounterState {
  enemyId: string;
  zoneId: string;
  startedAtTime: number;
  /** 战斗轮次日志（仅本次遭遇） */
  log: string[];
  /** 敌人已死亡 / 已逃跑时，遭遇进入"可关闭"状态 */
  resolved: boolean;
}

/** 背包已满时发现物品，等待玩家决策 */
export interface PendingPickup {
  stack: ItemStack;
  source: 'search' | 'ground';
  zoneId: string;
}

/* ------------------------------------------------------------------ */
/* 游戏状态                                                            */
/* ------------------------------------------------------------------ */

export type GameStatus = 'playing' | 'won' | 'lost' | 'draw';

/**
 * 对局阶段。
 * - `opening` 开局：自由搜集，禁区尚未启动
 * - `midgame` 中局：禁区收缩，物资开始紧张
 * - `finale`  终局：强制收束，全场衰竭，必然在有限时间内结束
 */
export type GamePhase = 'opening' | 'midgame' | 'finale';

export const PHASE_ORDER: readonly GamePhase[] = ['opening', 'midgame', 'finale'];

export interface GameGlobalStats {
  searches: number;
  crafts: number;
  moves: number;
  itemsUsed: number;
  attacks: number;
  /** 被搜空的区域数量 */
  zonesExhausted: number;
}

/**
 * 玩家掌握的"最后已知情报"。
 * 第二阶段起，玩家不再拥有上帝视角：只有亲眼见过（同区域 / 遭遇 / 公开击杀播报）
 * 的对手位置才会被记录下来，并且会随时间过期。
 */
export interface IntelEntry {
  zoneId: string;
  /** 记录发生的时间单位 */
  atTime: number;
  /** 情报来源 */
  source: 'sight' | 'encounter' | 'broadcast';
}

export interface GameState {
  version: string;
  seed: string;
  /** 伪随机数生成器的可序列化状态 */
  rngState: number;
  /** 当前时间单位 */
  time: number;
  status: GameStatus;
  playerId: string;
  /** 行动顺序（固定，保证同种子可复现） */
  turnOrder: string[];
  characters: Record<string, Combatant>;
  zones: Record<string, ZoneState>;
  events: GameEvent[];
  /** 事件自增序号，用于生成稳定的事件 id */
  eventSeq: number;
  /** 实例自增序号，用于生成稳定的 ItemStack uid */
  uidSeq: number;
  encounter: EncounterState | null;
  pendingPickup: PendingPickup | null;
  /** 当前生效中的世界事件（Phase 3A Step 6，取代 Phase 3 的 activeEvents） */
  activeWorldEvents: WorldEventState[];
  /** 已结束的世界事件归档，供模拟统计事件覆盖率 */
  worldEventHistory: WorldEventRecord[];
  /**
   * 本时间单位内已经在「玩家行动阶段」与玩家交过手的 NPC。
   * 这些 NPC 在随后的 NPC 行动阶段不会再对玩家出手，
   * 避免玩家在一个时间单位内被同一个对手打两次。每次推进时间后清空。
   */
  engagedWithPlayer: string[];
  /** 下一次禁区公布的时间单位 */
  nextZoneEventTime: number;
  /** 下一次世界事件触发的时间单位（Phase 3A Step 6） */
  nextWorldEventTime: number;
  /** 死亡顺序（先死在前），用于结算排名 */
  deathOrder: string[];
  stats: GameGlobalStats;
  endedAtTime: number | null;

  /* --- 第二阶段新增 --- */
  /** 当前对局阶段 */
  phase: GamePhase;
  /** 进入终局的时间单位，尚未进入时为 null */
  finaleStartedAt: number | null;
  /** 玩家设定的制作目标配方 id */
  craftGoalRecipeId: string | null;
  /** 制作目标是否已经达成 */
  craftGoalCompleted: boolean;
  /** 事件统计（含被裁剪掉的部分） */
  eventCounters: EventCounters;
  /** 玩家对各对手的最后已知位置 */
  playerIntel: Record<string, IntelEntry>;
  /** 对局结束原因，便于结算页与模拟工具归类 */
  endReason:
    | null
    | 'player_won'
    | 'player_died'
    | 'time_limit'
    | 'draw';
}


/* ------------------------------------------------------------------ */
/* 命令 / 世界事件（Phase 3 Step 10 已拆至 commandTypes.ts，此处保留出口） */
/* ------------------------------------------------------------------ */

import type { WorldEventRecord, WorldEventState } from './commandTypes';

export type {
  AttackStyle,
  Command,
  CommandResult,
  WorldEventId,
  WorldEventRecord,
  WorldEventScope,
  WorldEventState,
} from './commandTypes';
