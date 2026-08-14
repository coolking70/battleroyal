import type { GamePhase } from './sharedTypes';
import type { ItemStack } from './itemTypes';
import type { VictoryType } from './victoryTypes';

/* ------------------------------------------------------------------ */
/* 角色                                                                */
/* ------------------------------------------------------------------ */

export type PassiveId =
  | 'keen_eye'
  | 'brawler'
  | 'tinkerer'
  | 'field_medic'
  | 'enduring'
  | 'resourceful'
  | 'tracker'
  | 'trapsetter';

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
  /** Phase 3A：跳过一次「自身行动完成即清除」的判定。 */
  skipOwnActionClearOnce?: boolean;
  /** Phase 3A：剩余可生效的攻击次数（肾上腺素用；不设置表示不按次数计） */
  remainingAttacks?: number;
  /** Phase 3A：攻击体力折扣（肾上腺素 -1，最低仍受 minAttackStamina 约束） */
  attackStaminaDelta?: number;
  /** Phase 3A：自身承受战斗伤害的倍率（肾上腺素换来的自伤代价） */
  selfDamageTakenMult?: number;
  /** 生存专家：休息额外恢复体力 */
  restStaminaBonus?: number;
  /** 拾荒者：搜索发现物品权重倍率 */
  searchFindMult?: number;
  /** 猎人：搜索遭遇权重倍率 */
  searchEnemyMult?: number;
  /** 拾荒者：搜索材料偏好倍率 */
  searchMaterialBias?: number;
  /** 拾荒者：搜索稀有物品概率加成 */
  rareChanceBonus?: number;
  /** 猎人：远程攻击命中率倍率 */
  rangedHitChanceMult?: number;
  /** 陷阱师：防御姿态下反击概率加成 */
  counterChanceBonus?: number;
  /** 陷阱师：脱离成功率加成 */
  fleeChanceBonus?: number;
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
  /** PvE defeats are tracked independently and never increment contestant kills. */
  wildKills: number;
}

export type ExplorationObjectivePhase = 'obtain_item' | 'complete_prerequisite' | 'reach_target';

/** Small persisted route commitment used by the existing NPC goal planner. */
export interface ExplorationObjective {
  targetLandmarkId: string;
  nextLandmarkId: string;
  phase: ExplorationObjectivePhase;
  requiredItemId: string | null;
  prerequisiteLandmarkId: string | null;
  reason: string;
  committedAt: number;
}

export interface Combatant {
  id: string;
  name: string;
  isPlayer: boolean;
  characterId: string;
  personality: Personality;
  /** Deterministic alternative-route intent for NPC planning. */
  victoryGoal: VictoryType | null;
  /** Runtime-derived intent is activated after the NPC obtains a route material. */
  victoryGoalMode?: 'derived' | 'explicit';
  /** Phase 4F-1：持久化成长状态；经验是当前等级内进度，5 级时固定为 0。 */
  level: number;
  exp: number;
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
  /** Phase 4M：单一 utility 槽。 */
  equippedUtilityId: string | null;
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
  /** NPC 当前锁定的制作目标配方 id。玩家目标与 NPC 目标刻意分开。 */
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
  /** 计划推荐的区域内部来源；只表达自己的制作路线。 */
  planRecommendedLandmarkId: string | null;
  /** 最近一次重规划的原因（调试面板展示，Phase 2A-1） */
  lastReplanReason: string | null;
  /** Phase 4R: committed local access step for the current gameplay goal. */
  explorationObjective: ExplorationObjective | null;
  /** 最远抵达的阶段，用于结算展示 */
  furthestPhase: GamePhase;
  /** 是否处于防御姿态（Phase 3 Step 1）：下次受击伤害减免，出手或被新攻击命中后解除 */
  guarding: boolean;
  /** 技能冷却：skillId -> 剩余冷却时间单位（Phase 3 Step 3） */
  skillCooldowns: Record<string, number>;
}
