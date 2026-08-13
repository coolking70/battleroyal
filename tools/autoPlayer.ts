/**
 * Phase 2A · 自动对局控制器（唯一权威的模拟入口）。
 *
 * 设计红线（对应 Phase 2A 规格第五节）：
 *
 * 1. **只走正式命令通道**：全程只调用 `executeCommand`，绝不直接改写 `GameState`，
 *    也不调用任何 handler / 内部函数。模拟器看到的规则 = 玩家看到的规则。
 * 2. **绝不伪造胜者**：结果只由 `state.status` / `state.endReason` 决定。
 *    循环结束时若仍是 `playing`，一律记为 `timeout`，**不允许**按血量、
 *    按击杀数或任何其它启发式推断"谁赢了"。
 * 3. **只从合法集合里出牌**：每一步先向 `getLegalPlayerCommands` 要行动空间，
 *    策略只能在这个集合里挑。若挑出的命令被引擎拒绝（`ok === false`），
 *    那就是 `legalActions` 与引擎不一致的**真 bug**，会被记进
 *    `illegalCommands` 并让整局判为不可信。
 * 4. **每步体检**：调用 `findDeadlock` 检查"活着却无法推进时间"的死锁，
 *    并检测时间停滞（livelock）。任何一项命中都会让 `trustworthy` 变成 false。
 *
 * 本文件是**库**，没有任何顶层副作用，可被测试与 `tools/simulate.ts` 安全导入。
 */

import { GAME_CONFIG, GAME_VERSION } from '../src/data/gameConfig';
import { SeededRandom } from '../src/core/random';
import { aliveCharacters, createGame, getPlayer, refreshZoneOccupants } from '../src/core/gameState';
import { buildFinalRanking } from '../src/core/resultRanking';
import { executeCommand } from '../src/core/gameEngine';
import { chooseNpcGoal, decideNpcAction } from '../src/core/npcDecide';
import {
  findDeadlock,
  getLegalPlayerCommands,
  type DeadlockReport,
  type LegalAction,
  type LegalActionCategory,
} from '../src/core/legalActions';
import { addItem, countItem, createStack, getEquippedArmor, getEquippedUtility, getEquippedWeapon } from '../src/core/inventory';
import { initZoneLoot, syncSupplyRatio } from '../src/core/zoneLoot';
import { getCraftGoalRecommendations, getZoneDistance } from '../src/core/craftGuide';
import { buildCraftPlan } from '../src/core/craftPlan';
import { tryGetItem } from '../src/data/items';
import type { Command, Combatant, GameEvent, GameState, Personality, VictoryType } from '../src/core/types';
import { craftPathSummary, getCraftGoalSuggestion } from '../src/ui/craftPathPresentation';
import { PHASE4N_RECIPES } from '../src/data/phase4nRecipes';
import { PHASE4P_RECIPES } from '../src/data/phase4pRecipes';
import { getWildEnemy } from '../src/data/wildEnemies';

const PHASE4P_RECIPE_IDS = new Set(PHASE4P_RECIPES.map((recipe) => recipe.id));

/* ------------------------------------------------------------------ */
/* 对外类型                                                            */
/* ------------------------------------------------------------------ */

/** 自动玩家策略：与 5 种 NPC 人格一一对应，保证「玩家」与 NPC 用同一套规则竞争 */
export type AutoPlayerPolicy =
  | 'aggressive'
  | 'cautious'
  | 'collector'
  | 'opportunist'
  | 'random';

export const AUTO_PLAYER_POLICIES: readonly AutoPlayerPolicy[] = [
  'aggressive',
  'cautious',
  'collector',
  'opportunist',
  'random',
];

/** Pure simulator aggregation helper: boss kills are Apex-only by contract. */
export function countWildEvents(
  events: readonly GameEvent[],
  type: string,
  field: 'wildDefId' | 'zoneId',
  predicate?: (event: GameEvent) => boolean,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    if (event.type !== type || (predicate && !predicate(event))) continue;
    const key = field === 'zoneId' ? event.zoneId : event.metadata.wildDefId;
    if (typeof key === 'string') counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * 对局结局。
 * - `won` / `lost` / `draw`：引擎给出的正式结论
 * - `timeout`：跑到步数上限仍是 `playing`，属于**失败**，不是一种正常结局
 */
export type AutoGameOutcome = 'won' | 'lost' | 'draw' | 'timeout';

/** 从合法集合里选出的命令却被引擎拒绝——这是必须修的一致性缺陷 */
export interface IllegalCommandRecord {
  time: number;
  step: number;
  commandType: string;
  command: Command;
  message: string | null;
  /** 'policy' 表示策略首选，'fallback' 表示退化选项 */
  source: 'policy' | 'fallback';
}

export interface AutoGameOptions {
  seed: string;
  /** 玩家角色模板 id，默认 'scout' */
  characterId?: string;
  /** 自动玩家策略，默认 'cautious' */
  policy?: AutoPlayerPolicy;
  playerName?: string;
  /** 步数上限（含不推进时间的解决型命令），默认 hardTimeLimit * 4 + 200 */
  maxSteps?: number;
  /** 时间停滞多少步后判为 livelock，默认 16 */
  stallLimit?: number;
  /** 是否保留最终状态引用（批量模拟时关掉可省内存），默认 false */
  keepFinalState?: boolean;
  /** 是否保留未被事件裁剪的完整事件流（仅诊断工具使用） */
  keepEventTrace?: boolean;
  /** 可选的玩家式闭环：采纳公开建议、优先当前子目标、合成后装备。 */
  representativeBuildLoop?: boolean;
  /** Optional public recipe target for a deterministic representative route. */
  representativeRecipeId?: string;
  /** Deterministic formal-command route fixture for an alternative victory. */
  victoryGoal?: VictoryType | 'auto';
}

/** 玩家死亡瞬间的只读诊断快照，不参与任何规则结算。 */
export interface PlayerDeathSnapshot {
  time: number;
  cause: string | null;
  killerId: string | null;
  zoneId: string;
  equippedWeaponId: string | null;
  equippedArmorId: string | null;
  carriedWeaponIds: string[];
  carriedArmorIds: string[];
  inventorySize: number;
  stamina: number;
  hp: number;
}

export interface AutoGameResult {
  /* --- 输入回执 --- */
  seed: string;
  characterId: string;
  policy: AutoPlayerPolicy;
  version: string;

  /* --- 结局（唯一真相来源：引擎） --- */
  outcome: AutoGameOutcome;
  finalStatus: GameState['status'];
  endReason: GameState['endReason'];
  winnerId: string | null;
  victoryType: VictoryType | null;
  /** Acceptance metrics for the authoritative terminal tuple. */
  terminalWithoutWinner: boolean;
  invalidVictoryTuple: boolean;
  duplicateApexSpawn: boolean;
  invalidApexSpawnZone: boolean;
  /** 对局结束时的时间单位 */
  timeUsed: number;
  endedAtTime: number | null;
  phase: GameState['phase'];
  finaleStartedAt: number | null;

  /* --- 可信度体检 --- */
  /** 跑到 180 硬上限才结束（Phase 2A 要求 1000 局中为 0） */
  hardLimitReached: boolean;
  /** 活着却无法推进时间 */
  deadlock: DeadlockReport | null;
  /** 时间长期不推进（只在解决型命令之间打转） */
  stalled: boolean;
  /** 合法集合里的命令被引擎拒绝 */
  illegalCommands: IllegalCommandRecord[];
  /** 合法集合为空但对局仍在进行 */
  emptyLegalSet: boolean;
  /** 以上任何一项命中即为 false —— 这一局的数据不可用于平衡结论 */
  trustworthy: boolean;

  /* --- 玩家侧 --- */
  survived: boolean;
  playerHp: number;
  playerStamina: number;
  playerKills: number;
  playerRank: number;
  playerDiedAtTime: number | null;
  playerKilledBy: string | null;
  playerZoneId: string;
  playerInventorySize: number;
  damageDealt: number;
  damageTaken: number;
  searches: number;
  crafts: number;
  moves: number;
  attacks: number;
  itemsUsed: number;
  craftGoalRecipeId: string | null;
  craftGoalCompleted: boolean;
  wildEncounterCount: number;
  wildKillCount: number;
  wildFleeCount: number;
  wildDamageTaken: number;
  wildPlayerDeaths: number;
  wildDropsCreated: number;
  wildMaterialPickups: number;
  wildCrafts: number;
  eliteEncounters: number;
  eliteKills: number;
  apexSpawned: number;
  apexEncounters: number;
  apexKills: number;
  apexFlees: number;
  signatureDrops: number;
  signaturePickups: number;
  signatureCrafts: number;
  bossKillsByType: Record<string, number>;
  wildEncounterByType: Record<string, number>;
  wildEncounterByZone: Record<string, number>;
  wildKillByType: Record<string, number>;
  wildKillByZone: Record<string, number>;
  wildCraftGoalAttempted: boolean;
  wildCraftGoalCompleted: boolean;

  /* --- 全局 --- */
  totalParticipants: number;
  survivorCount: number;
  survivorIds: string[];
  npcSurvivorPersonalities: Personality[];
  deaths: number;
  zonesExhausted: number;
  eventCount: number;

  /* --- 控制器自身 --- */
  steps: number;
  timeAdvancingSteps: number;
  resolutionSteps: number;
  fallbackSteps: number;
  commandCounts: Record<string, number>;

  /* --- Phase 3A 玩法统计（由对局事件扫描得出，与 UI/核心同源） --- */
  /** 攻击风格使用次数：quick / normal / heavy */
  attackStyleCounts: Record<string, number>;
  /** 重击挥空挂上 EXPOSED 的次数（Heavy 风险） */
  exposedApplied: number;
  /** EXPOSED 被成功战斗伤害兑现的次数 */
  exposedConsumed: number;
  /** 防御姿态成功减免伤害的次数 */
  guardResolves: number;
  /** 技能使用次数：skillId -> count */
  skillUseCounts: Record<string, number>;
  /** 世界事件触发次数：eventId -> count */
  worldEventCounts: Record<string, number>;

  /* --- Phase 3A-1 完整统计（Step 7） --- */
  /** 攻击风格细分：attempts/hits/misses/hitRate/damage/avgShownChance/deltaPP */
  attackStyleStats: Record<string, StyleAggStat>;
  /** GUARD 命令次数（来自 commandCounts） */
  guardCommands: number;
  /** 防御成功触发（减免了伤害）次数 */
  guardTriggered: number;
  /** 防御减免伤害总量 */
  guardDamagePreventedTotal: number;
  /** 防御平均每次减免伤害 */
  guardDamagePreventedAverage: number;
  /** 重击总落空次数（= exposedApplied 的上游） */
  heavyMissCount: number;
  /** EXPOSED 未兑现即失效（条件B / 兜底）次数 */
  exposedExpiredWithoutPunish: number;
  /** EXPOSED 兑现时多吃的伤害总量 */
  exposedBonusDamageTotal: number;
  /** 技能收益统计（玩家 / NPC 分列） */
  skillStats: Record<string, SkillAggStat>;
  /** 世界事件影响统计 */
  worldEventImpact: Record<string, WorldEventImpactAgg>;

  /** 仅在 keepFinalState 为 true 时存在 */
  finalState?: GameState;
  /** 仅在 keepEventTrace 为 true 时存在；不写入游戏存档或浏览器状态 */
  eventTrace?: GameEvent[];
  /** 自动玩家命令执行前玩家恰好 0 体力时的应急动作次数 */
  zeroStaminaGuardCommands: number;
  zeroStaminaFleeCommands: number;
  /** 玩家死亡前最后一次可观察到的装备/资源快照 */
  playerDeathSnapshot: PlayerDeathSnapshot | null;
}

/* ------------------------------------------------------------------ */
/* Phase 3A-1 统计聚合类型                                              */
/* ------------------------------------------------------------------ */

export interface StyleAggStat {
  attempts: number;
  hits: number;
  misses: number;
  hitRate: number;
  damageTotal: number;
  avgDamageOnHit: number;
  /** 展示命中率均值（百分数，来自 metadata.chance） */
  averageShownChance: number;
  /** |展示命中率 - 实际命中率|（百分点） */
  deltaPP: number;
}

export interface SkillAggStat {
  playerUses: number;
  npcUses: number;
  /** scout：警觉先手次数 */
  reconEncounterInitiativeCount: number;
  /** fighter：肾上腺素覆盖的攻击次数 */
  adrenalineAttackCount: number;
  adrenalineBonusDamage: number;
  adrenalineStaminaSaved: number;
  /** fighter 状态期间自身多吃的伤害 */
  adrenalineExtraDamageTaken: number;
  /** engineer：免费合成次数 */
  freeCraftCount: number;
  craftStaminaSaved: number;
  /** medic：即时治疗量 */
  instantHealing: number;
  /** medic：MEDICAL_FOCUS 带来的额外治疗量 */
  bonusConsumableHealing: number;
}

export interface WorldEventImpactAgg {
  triggerCount: number;
  /** blackout */
  searchesAffected: number;
  encounterWeightReductionCount: number;
  nothingWeightIncreaseCount: number;
  /** rain */
  movesAffected: number;
  extraMoveStaminaPaid: number;
  rangedAttacksAffected: number;
  /** broadcast */
  zonesBroadcast: number;
  /** medical_alert */
  healsAffected: number;
  bonusHealing: number;
  /** research_anomaly */
  ticks: number;
  damageTotal: number;
  deaths: number;
  /** citywide_unrest */
  noiseDecayPrevented: number;
  searchNoiseBonus: number;
}

/* ------------------------------------------------------------------ */
/* 结局判定：唯一允许的映射                                            */
/* ------------------------------------------------------------------ */

/**
 * 状态 → 结局的**全部**映射规则。
 * 用字符串索引而不是 switch，是为了让 Step 13 给 `GameStatus` 加上 `'draw'`
 * 之后这里无需改动即可正确工作。
 */
const OUTCOME_BY_STATUS: Readonly<Record<string, AutoGameOutcome>> = {
  won: 'won',
  lost: 'lost',
  draw: 'draw',
};

/**
 * 由引擎状态推导结局。
 * `playing` ⇒ `timeout`。这里**没有**任何血量 / 击杀数分支，也永远不会有。
 */
export function resolveOutcome(state: GameState): AutoGameOutcome {
  return OUTCOME_BY_STATUS[state.status] ?? 'timeout';
}

/* ------------------------------------------------------------------ */
/* 策略层                                                              */
/* ------------------------------------------------------------------ */

/** 各策略对合法动作分类的偏好权重（用于策略首选不可用时的退化挑选） */
const CATEGORY_WEIGHT: Record<AutoPlayerPolicy, Record<LegalActionCategory, number>> = {
  aggressive: { combat: 10, search: 4, movement: 3, craft: 2, recovery: 1, item: 1, objective: 2, resolution: 0, meta: 0 },
  cautious: { combat: 1, search: 4, movement: 4, craft: 3, recovery: 6, item: 1, objective: 2, resolution: 0, meta: 0 },
  collector: { combat: 1, search: 9, movement: 4, craft: 5, recovery: 2, item: 1, objective: 2, resolution: 0, meta: 0 },
  opportunist: { combat: 4, search: 6, movement: 4, craft: 3, recovery: 3, item: 1, objective: 2, resolution: 0, meta: 0 },
  random: { combat: 3, search: 3, movement: 3, craft: 3, recovery: 3, item: 1, objective: 2, resolution: 0, meta: 0 },
};

/** 愿意为了新物品腾格子的策略 */
const PICKUP_GREEDY: Record<AutoPlayerPolicy, boolean> = {
  aggressive: false,
  cautious: false,
  collector: true,
  opportunist: true,
  random: false,
};

function itemValue(itemId: string): number {
  return tryGetItem(itemId)?.value ?? 0;
}

/** 命令等价判断（命令载荷全是原始值，逐字段比较即可） */
function sameCommand(a: Command, b: Command): boolean {
  if (a.type !== b.type) return false;
  const ka = a as unknown as Record<string, unknown>;
  const kb = b as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(ka), ...Object.keys(kb)])) {
    if (ka[key] !== kb[key]) return false;
  }
  return true;
}

/**
 * 把 NPC 决策内核的输出翻译成玩家命令。
 *
 * 关键点：这里**不做**任何"玩家专属"的加强。自动玩家用的就是 NPC 那套大脑，
 * 只是把人格换成了指定策略，这样 4 角色 × 5 策略的胜率才有可比性。
 */
export function decideAutoPlayerCommand(
  state: GameState,
  player: Combatant,
  policy: AutoPlayerPolicy,
  rng: SeededRandom,
): { command: Command | null; reason: string } {
  // 换人格的副本：避免把策略写回真实状态，也避免 decideNpcAction 的中间字段污染存档
  const view: Combatant = { ...player, personality: policy as Personality };
  if (state.craftGoalRecipeId) {
    view.plannedRecipeId = state.craftGoalRecipeId;
    view.planCreatedAt = state.time;
    view.planReason = '玩家公开制作目标';
    view.planRecommendedZoneId = buildCraftPlan(state, view, state.craftGoalRecipeId)?.suggestedMoveZoneId ?? null;
  }
  if (!view.plannedRecipeId) {
    const goal = chooseNpcGoal(view, rng);
    if (goal) {
      const plan = buildCraftPlan(state, view, goal.recipeId);
      view.plannedRecipeId = goal.recipeId;
      view.planCreatedAt = state.time;
      view.planReason = goal.reason;
      view.planRecommendedZoneId = plan?.suggestedMoveZoneId ?? null;
    }
  }
  const d = decideNpcAction(state, view, rng);

  switch (d.kind) {
    case 'evacuate':
    case 'move':
      return { command: d.zoneId ? { type: 'MOVE', zoneId: d.zoneId } : null, reason: d.reason };
    case 'heal':
      return { command: d.uid ? { type: 'USE_ITEM', uid: d.uid } : null, reason: d.reason };
    case 'rest':
      return { command: { type: 'REST' }, reason: d.reason };
    case 'craft':
      return { command: d.recipeId ? { type: 'CRAFT', recipeId: d.recipeId } : null, reason: d.reason };
    case 'attack': {
      // Phase 2A-1：未遭遇时合法集合只给泛化的 ATTACK_NEARBY，
      // 遭遇时才允许精确指定对手（目标已被识别）。
      const enc = state.encounter;
      const inEncounter = Boolean(enc && !enc.resolved);
      const style = d.attackStyle ?? 'normal';
      if (
        inEncounter &&
        d.targetId &&
        enc!.enemyId === d.targetId &&
        (enc!.targetKind === 'wild'
          ? state.wildEnemies[d.targetId]?.status === 'alive'
          : state.characters[d.targetId]?.alive)
      ) {
        return {
          command: { type: 'ATTACK', targetId: d.targetId, style },
          reason: d.reason,
        };
      }
      return { command: { type: 'ATTACK_NEARBY', style }, reason: d.reason };
    }
    case 'guard':
      // 摆出防御姿态：通常消耗体力；恰好 0 体力由共享成本层提供应急免费防御。
      // 玩家与 NPC 共用同一套规则。
      return { command: { type: 'GUARD' }, reason: d.reason };
    case 'use_skill':
      // 释放角色技能：与 NPC 共用同一套规则（Phase 3 Step 3）
      return d.skillId
        ? { command: { type: 'USE_SKILL', skillId: d.skillId }, reason: d.reason }
        : { command: null, reason: d.reason };
    case 'flee_combat':
      return { command: { type: 'FLEE' }, reason: d.reason };
    case 'call_extraction':
      return { command: { type: 'CALL_EXTRACTION' }, reason: d.reason };
    case 'extract':
      return { command: { type: 'EXTRACT' }, reason: d.reason };
    case 'submit_research':
      return { command: { type: 'SUBMIT_RESEARCH' }, reason: d.reason };
    case 'search':
      return { command: { type: 'SEARCH' }, reason: d.reason };
    default:
      return { command: null, reason: d.reason };
  }
}

/** 待决拾取：策略决定收还是弃，收则丢掉背包里最不值钱的一件 */
function choosePickupResolution(
  state: GameState,
  player: Combatant,
  legal: LegalAction[],
  policy: AutoPlayerPolicy,
): LegalAction {
  const reject = legal.find(
    (a) => a.command.type === 'RESOLVE_PICKUP' && a.command.accept === false,
  );
  const pending = state.pendingPickup;
  const accepts = legal.filter(
    (a) => a.command.type === 'RESOLVE_PICKUP' && a.command.accept === true,
  );

  if (!pending || accepts.length === 0) return reject ?? legal[0]!;

  const incoming = itemValue(pending.stack.itemId);
  // 背包里最不值钱的一格
  let worst: { action: LegalAction; value: number } | null = null;
  for (const a of accepts) {
    const cmd = a.command as Extract<Command, { type: 'RESOLVE_PICKUP' }>;
    const stack = player.inventory.find((s) => s.uid === cmd.dropUid);
    if (!stack) continue;
    const v = itemValue(stack.itemId);
    if (!worst || v < worst.value) worst = { action: a, value: v };
  }
  if (!worst) return reject ?? accepts[0]!;

  // 严格更值钱才换；囤积型策略在等值时也愿意换
  const better = PICKUP_GREEDY[policy] ? incoming >= worst.value : incoming > worst.value;
  if (better) return worst.action;
  return reject ?? worst.action;
}

/** 按策略权重从合法动作里加权随机挑一个（只在策略首选不可用时使用） */
function weightedPick(
  candidates: LegalAction[],
  policy: AutoPlayerPolicy,
  rng: SeededRandom,
): LegalAction {
  const weights = CATEGORY_WEIGHT[policy];
  const entries = candidates.map((a) => ({
    action: a,
    weight: Math.max(1, weights[a.category] ?? 1),
  }));
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng.next() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e.action;
  }
  return entries[entries.length - 1]!.action;
}

function equipmentScore(itemId: string): number {
  const item = tryGetItem(itemId);
  return item?.category === 'weapon'
    ? item.attack ?? 0
    : item?.category === 'armor'
      ? item.defense ?? 0
      : item?.category === 'utility'
        ? (item.searchFindMult ?? 1) * 100
        : 0;
}

/**
 * 诊断用的玩家闭环偏好：只从合法命令中选择，不改变引擎规则。
 * 公开建议与路线来自现有 presentation/core 查询；所有实际动作仍走
 * SET_CRAFT_GOAL / CRAFT / EQUIP 正式命令。
 */
interface RepresentativeRouteContext {
  targetZoneId: string | null;
  searchNoYield: number;
  lastSearch: { zoneId: string; time: number } | null;
}

/** Seed only deterministic world conditions; objective ingredients never enter inventory here. */
export function seedObjectiveRouteWorldFixture(state: GameState, player: Combatant, goal: VictoryType): void {
  if (goal === 'last_survivor') return;
  player.inventory = [];
  player.equipment = [];
  player.equippedWeaponId = null;
  player.equippedArmorId = null;
  player.equippedUtilityId = null;
  player.stamina = player.maxStamina;
  player.hp = player.maxHp;
  player.currentZoneId = 'school';
  addItem(player, createStack(state, 'water', 1));
  addItem(player, createStack(state, 'stick', 1));

  if (goal === 'extraction') {
    const factory = state.zones.factory!;
    initZoneLoot(factory, [
      { itemId: 'battery', count: 2, rarity: 'normal' },
      { itemId: 'circuit', count: 1, rarity: 'normal' },
      { itemId: 'metal_plate', count: 1, rarity: 'normal' },
      { itemId: 'metal_parts', count: 1, rarity: 'normal' },
    ]);
  } else {
    const lab = state.zones.lab!;
    initZoneLoot(lab, [
      { itemId: 'herb', count: 1, rarity: 'normal' },
      { itemId: 'alcohol', count: 1, rarity: 'normal' },
      { itemId: 'scrap', count: 1, rarity: 'normal' },
      { itemId: 'glass', count: 2, rarity: 'normal' },
      { itemId: 'battery', count: 1, rarity: 'normal' },
    ]);
    lab.objectiveLoot = [{ itemId: 'research_notes', count: 2, rarity: 'rare' }];
    const resin = Object.values(state.wildEnemies).find((enemy) => enemy.defId === 'resin_stalker')
      ?? Object.values(state.wildEnemies)[0];
    if (!resin) throw new Error('Research fixture requires a wild population source');
    resin.defId = 'resin_stalker';
    for (const zone of Object.values(state.zones)) {
      zone.wildEnemyIds = zone.wildEnemyIds.filter((uid) => uid !== resin.uid);
    }
    for (const uid of [...lab.wildEnemyIds]) {
      const enemy = state.wildEnemies[uid];
      if (!enemy || enemy.uid === resin.uid) continue;
      enemy.status = 'defeated';
      enemy.hp = 0;
      enemy.dropResolved = true;
      enemy.statusEffects = [];
      enemy.guarding = false;
      enemy.defeatedAtTime = state.time;
    }
    resin.zoneId = 'lab';
    resin.status = 'alive';
    resin.hp = 1;
    resin.guarding = false;
    resin.abilityCharges = 0;
    resin.statusEffects = [];
    resin.pendingIntent = null;
    resin.dropResolved = false;
    resin.defeatedAtTime = null;
    lab.wildEnemyIds.push(resin.uid);
    syncSupplyRatio(lab);
  }
  for (const npc of Object.values(state.characters)) {
    if (!npc.isPlayer) npc.currentZoneId = 'warehouse';
  }
  refreshZoneOccupants(state);
}

export function chooseEquipmentUpgradeAction(
  player: Combatant,
  legal: LegalAction[],
): LegalAction | null {
  const currentWeapon = getEquippedWeapon(player);
  const currentArmor = getEquippedArmor(player);
  const currentUtility = getEquippedUtility(player);
  const currentWeaponScore = currentWeapon ? equipmentScore(currentWeapon.itemId) : 0;
  const currentArmorScore = currentArmor ? equipmentScore(currentArmor.itemId) : 0;
  const currentUtilityScore = currentUtility ? equipmentScore(currentUtility.itemId) : 0;
  const equipment = legal
    .map((action) => {
      const command = action.command;
      if (command.type !== 'EQUIP') return null;
      const stack = player.inventory.find((item) => item.uid === command.uid);
      if (!stack) return null;
      const item = tryGetItem(stack.itemId);
      if (!item || !item.equipmentSlot) return null;
      const current = item.category === 'weapon'
        ? currentWeaponScore
        : item.category === 'armor'
          ? currentArmorScore
          : currentUtilityScore;
      return { action, itemId: stack.itemId, score: equipmentScore(stack.itemId), current };
    })
    .filter((item): item is { action: LegalAction; itemId: string; score: number; current: number } => Boolean(item))
    .sort((a, b) => b.score - a.score || a.itemId.localeCompare(b.itemId));
  return equipment.find((item) => item.score > item.current)?.action ?? null;
}

/**
 * 诊断用的玩家闭环偏好：只从合法命令中选择，不改变引擎规则。
 * 路线目标在一局内保持稳定，到达推荐区后先搜索；连续两次没有玩家可见的
 * ITEM_FOUND 才轮换目标，避免因距离评分变化在相邻区域间来回摆动。
 */
function chooseRepresentativeBuildAction(
  state: GameState,
  player: Combatant,
  legal: LegalAction[],
  route: RepresentativeRouteContext,
  preferredRecipeId?: string,
  victoryGoal?: VictoryType | 'auto',
): LegalAction | null {
  const groundPickup = legal.find((action) => action.command.type === 'PICKUP_GROUND');
  if (groundPickup) return groundPickup;

  if (victoryGoal === 'research') {
    if (state.encounter && !state.encounter.resolved) return null;
    if (!state.craftGoalRecipeId && preferredRecipeId) {
      return legal.find(
        (action) => action.command.type === 'SET_CRAFT_GOAL' && action.command.recipeId === preferredRecipeId,
      ) ?? null;
    }
    if (countItem(player, 'research_package') > 0 && player.currentZoneId === 'lab') {
      return legal.find((action) => action.command.type === 'SUBMIT_RESEARCH') ?? null;
    }
    if (player.currentZoneId !== 'lab' && countItem(player, 'research_package') === 0) {
      const currentDistance = getZoneDistance(player.currentZoneId, 'lab');
      const towardLab = legal
        .filter((action): action is LegalAction & { command: Extract<Command, { type: 'MOVE' }> } => action.command.type === 'MOVE')
        .map((action) => ({ action, distance: getZoneDistance(action.command.zoneId, 'lab') }))
        .sort((a, b) => a.distance - b.distance);
      return towardLab.find((entry) => entry.distance < currentDistance)?.action ?? towardLab[0]?.action ?? null;
    }
    const path = state.craftGoalRecipeId ? craftPathSummary(state.craftGoalRecipeId, state, player) : null;
    if (path?.nextStep) {
      const craft = legal.find(
        (action) => action.command.type === 'CRAFT' && action.command.recipeId === path.nextStep!.recipeId,
      );
      if (craft) return craft;
    }
    return legal.find((action) => action.command.type === 'SEARCH')
      ?? legal.find((action) => action.command.type === 'REST')
      ?? null;
  }

  if (victoryGoal && victoryGoal !== 'auto' && victoryGoal !== 'last_survivor') {
    const completion = victoryGoal === 'extraction' ? 'EXTRACT' : 'SUBMIT_RESEARCH';
    const completed = legal.find((action) => action.command.type === completion);
    if (completed) return completed;
    if (victoryGoal === 'extraction' && state.activeExtraction) {
      // The public countdown is time-based; wait using a formal free REST.
      return legal.find((action) => action.command.type === 'REST') ?? null;
    }
    const targetZone = victoryGoal === 'extraction' ? 'station' : 'lab';
    const targetItem = victoryGoal === 'extraction' ? 'extraction_beacon' : 'research_package';
    if (countItem(player, targetItem) > 0 && player.currentZoneId !== targetZone) {
      const currentDistance = getZoneDistance(player.currentZoneId, targetZone);
      const toward = legal
        .filter((action): action is LegalAction & { command: Extract<Command, { type: 'MOVE' }> } => action.command.type === 'MOVE')
        .map((action) => ({ action, distance: getZoneDistance(action.command.zoneId, targetZone) }))
        .sort((a, b) => a.distance - b.distance);
      return toward.find((entry) => entry.distance < currentDistance)?.action ?? toward[0]?.action ?? null;
    }
    const call = legal.find((action) => action.command.type === 'CALL_EXTRACTION');
    if (call) return call;
  }
  if (!state.craftGoalRecipeId) {
    const suggestion = getCraftGoalSuggestion(state, player, {
      // Phase 4P adds higher-tier content to the shared public suggestion
      // registry. Keep the historical AutoPlayer representative loop bounded
      // to its original content unless a route explicitly opts into P.
      excludeRecipeIds: PHASE4P_RECIPE_IDS,
    });
    const adopt = legal.find(
      (action) =>
        action.command.type === 'SET_CRAFT_GOAL' &&
        action.command.recipeId === (preferredRecipeId ?? suggestion?.recipeId),
    );
    if (adopt) {
      route.targetZoneId = null;
      route.searchNoYield = 0;
      return adopt;
    }
  } else {
    const path = craftPathSummary(state.craftGoalRecipeId, state, player);
    const nextRecipeId = path?.nextStep?.recipeId;
    if (nextRecipeId) {
      const craft = legal.find(
        (action) => action.command.type === 'CRAFT' && action.command.recipeId === nextRecipeId,
      );
      if (craft) return craft;
    }
  }

  // 拾取/合成后的装备交接优先于下一次移动；仍只装备玩家自己的合法候选。
  const equipmentUpgrade = chooseEquipmentUpgradeAction(player, legal);
  if (equipmentUpgrade) return equipmentUpgrade;

  if (!state.craftGoalRecipeId) return null;
  const recommendations = getCraftGoalRecommendations(state, player);
  if (recommendations.length === 0) {
    route.targetZoneId = null;
    route.searchNoYield = 0;
    return null;
  }

  // 保持路线目标稳定，避免“按当前位置重新评分”导致两个区域之间来回摆动。
  const targetStillValid = recommendations.some(
    (recommendation) => recommendation.zoneId === route.targetZoneId,
  );
  if (!targetStillValid || route.searchNoYield >= 2) {
    const nextTarget = recommendations.find(
      (recommendation) => recommendation.zoneId !== player.currentZoneId,
    ) ?? recommendations[0];
    route.targetZoneId = nextTarget?.zoneId ?? null;
    route.searchNoYield = 0;
  }

  const target = recommendations.find(
    (recommendation) => recommendation.zoneId === route.targetZoneId,
  );
  if (!target) return null;
  if (target.zoneId === player.currentZoneId) {
    return legal.find((action) => action.command.type === 'SEARCH') ?? null;
  }

  const currentDistance = getZoneDistance(player.currentZoneId, target.zoneId);
  const moves = legal
    .map((action) => {
      if (action.command.type !== 'MOVE') return null;
      return {
        action,
        distance: getZoneDistance(action.command.zoneId, target.zoneId),
      };
    })
    .filter((move): move is { action: LegalAction; distance: number } => Boolean(move))
    .sort((a, b) => a.distance - b.distance);
  return moves.find((move) => move.distance < currentDistance)?.action ?? moves[0]?.action ?? null;
}

/* ------------------------------------------------------------------ */
/* 主循环                                                              */
/* ------------------------------------------------------------------ */

function emptyCounts(): Record<string, number> {
  return {};
}

function bump(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

/**
 * 跑完一整局自动对局。
 *
 * 保证：
 * - 返回的 `outcome` 只可能是 won / lost / draw / timeout，且完全由引擎状态决定；
 * - 全程只经由 `executeCommand`；
 * - 任何可信度问题都被显式记录，而不是被悄悄吞掉。
 */
export function runAutoGame(options: AutoGameOptions): AutoGameResult {
  const characterId = options.characterId ?? 'scout';
  const policy = options.policy ?? 'cautious';
  const maxSteps = options.maxSteps ?? GAME_CONFIG.hardTimeLimit * 4 + 200;
  const stallLimit = options.stallLimit ?? 16;

  let s = createGame({
    seed: options.seed,
    playerCharacterId: characterId,
    playerName: options.playerName ?? `Auto-${policy}`,
  });
  const victoryGoal = options.victoryGoal ?? 'auto';
  if (victoryGoal !== 'auto') seedObjectiveRouteWorldFixture(s, getPlayer(s), victoryGoal);

  // 策略专用 RNG：与引擎 RNG 完全隔离，避免自动玩家的选择消耗掉对局随机数，
  // 从而保证「同种子 + 同角色 + 同策略」严格可复现。
  const policyRng = new SeededRandom(`${options.seed}::policy::${policy}`);

  const illegalCommands: IllegalCommandRecord[] = [];
  const commandCounts = emptyCounts();
  let deadlock: DeadlockReport | null = null;
  let stalled = false;
  let emptyLegalSet = false;
  let steps = 0;
  let timeAdvancingSteps = 0;
  let resolutionSteps = 0;
  let fallbackSteps = 0;
  let stallCounter = 0;
  let lastTime = s.time;
  let zeroStaminaGuardCommands = 0;
  let zeroStaminaFleeCommands = 0;
  let playerDeathSnapshot: PlayerDeathSnapshot | null = null;
  const representativeRoute: RepresentativeRouteContext = {
    targetZoneId: null,
    searchNoYield: 0,
    lastSearch: null,
  };
  // Phase 3A-1：事件日志会被 pruneEvents 裁剪（miss 是 minor 会被优先丢弃），
  // 统计必须基于**全量事件流**，否则命中率会被系统性高估。
  // 注意：pruneEvents 会从数组头部裁剪旧事件，按长度切片会被打乱，
  // 因此用「已收集事件 id 集合」去重收集。
  const capturedEventIds = new Set<string>();
  const fullEvents: GameEvent[] = [];
  const captureNewEvents = (): void => {
    for (const e of s.events) {
      if (!capturedEventIds.has(e.id)) {
        capturedEventIds.add(e.id);
        fullEvents.push(e);
      }
    }
  };

  while (s.status === 'playing' && steps < maxSteps) {
    // ---- 每步体检 1：死锁 ----
    deadlock = findDeadlock(s);
    if (deadlock) break;

    const legal = getLegalPlayerCommands(s);
    if (legal.length === 0) {
      emptyLegalSet = true;
      break;
    }

    const player = getPlayer(s);
    let chosen: LegalAction;
    let source: 'policy' | 'fallback' = 'policy';

    if (s.pendingPickup) {
      // 阻塞态只有一条出路：先把待决拾取处理掉
      chosen = choosePickupResolution(s, player, legal, policy);
    } else {
      // 标准五策略也必须消费已经进入合法集合的装备升级动作。
      // 这仍然只读 legalActions，不改变策略的搜索、移动、合成或战斗决策。
      const equipmentUpgrade = options.representativeBuildLoop
        ? null
        : chooseEquipmentUpgradeAction(player, legal);
      const preferred = options.representativeBuildLoop
        ? chooseRepresentativeBuildAction(
            s,
            player,
            legal,
            representativeRoute,
            options.representativeRecipeId ?? (victoryGoal === 'extraction' ? 'r_extraction_beacon' : victoryGoal === 'research' ? 'r_research_package' : undefined),
            victoryGoal,
          )
        : equipmentUpgrade;
      const decision = preferred
        ? { command: preferred.command, reason: '代表玩家闭环：目标 / 合成 / 装备' }
        : decideAutoPlayerCommand(s, player, policy, policyRng);
      const matched = decision.command
        ? legal.find((a) => sameCommand(a.command, decision.command!))
        : undefined;
      if (matched) {
        chosen = matched;
      } else {
        // 策略首选不在合法集合里（例如遭遇战中想搜索）——退化到加权挑选。
        // 这不是 bug：合法集合本来就是规则的硬约束。
        source = 'fallback';
        fallbackSteps += 1;
        const advancing = legal.filter((a) => a.advancesTime);
        const pool = advancing.length > 0 ? advancing : legal;
        chosen = weightedPick(pool, policy, policyRng);
      }
    }

    // ---- 只走正式命令通道 ----
    const playerBeforeAction = getPlayer(s);
    const playerBeforeActionStamina = playerBeforeAction.stamina;
    const searchBeforeAction = chosen.command.type === 'SEARCH'
      ? { zoneId: playerBeforeAction.currentZoneId, time: s.time }
      : null;
    let res = executeCommand(s, chosen.command);

    if (!res.ok) {
      // 合法集合承诺过"一定成功"，被拒绝就是真缺陷，记录后尝试退化一次
      illegalCommands.push({
        time: s.time,
        step: steps,
        commandType: chosen.command.type,
        command: chosen.command,
        message: res.message,
        source,
      });
      const fb = legal.find(
        (a) => a.advancesTime && !sameCommand(a.command, chosen.command),
      );
      if (!fb) break;
      fallbackSteps += 1;
      res = executeCommand(s, fb.command);
      if (!res.ok) {
        illegalCommands.push({
          time: s.time,
          step: steps,
          commandType: fb.command.type,
          command: fb.command,
          message: res.message,
          source: 'fallback',
        });
        break;
      }
      chosen = fb;
    }

    if (res.ok) {
      if (chosen.command.type === 'GUARD' && playerBeforeActionStamina === 0) {
        zeroStaminaGuardCommands += 1;
      }
      if (chosen.command.type === 'FLEE' && playerBeforeActionStamina === 0) {
        zeroStaminaFleeCommands += 1;
      }
    }

    bump(commandCounts, chosen.command.type);
    if (chosen.advancesTime) timeAdvancingSteps += 1;
    if (chosen.category === 'resolution') resolutionSteps += 1;

    s = res.state;
    if (options.representativeBuildLoop && representativeRoute.lastSearch) {
      const previousSearch = representativeRoute.lastSearch;
      const yielded = s.events.some(
        (event) =>
          event.type === 'ITEM_FOUND' &&
          event.actorId === player.id &&
          event.zoneId === previousSearch.zoneId &&
          event.time === previousSearch.time,
      );
      representativeRoute.searchNoYield = yielded
        ? 0
        : representativeRoute.searchNoYield + 1;
      representativeRoute.lastSearch = null;
    }
    if (options.representativeBuildLoop && searchBeforeAction) {
      representativeRoute.lastSearch = searchBeforeAction;
    }
    // 增量收集全量事件（不受 pruneEvents 影响）
    captureNewEvents();
    if (!playerDeathSnapshot && !getPlayer(s).alive) {
      const deathEvent = [...fullEvents]
        .reverse()
        .find((event) => event.type === 'CHARACTER_DIED' && event.targetId === s.playerId);
      playerDeathSnapshot = {
        time: s.time,
        cause: typeof deathEvent?.metadata?.cause === 'string' ? deathEvent.metadata.cause : null,
        killerId: deathEvent?.actorId ?? getPlayer(s).killedBy,
        zoneId: playerBeforeAction.currentZoneId,
        equippedWeaponId: getEquippedWeapon(playerBeforeAction)?.itemId ?? null,
        equippedArmorId: getEquippedArmor(playerBeforeAction)?.itemId ?? null,
        carriedWeaponIds: playerBeforeAction.inventory
          .filter((stack) => tryGetItem(stack.itemId)?.category === 'weapon')
          .map((stack) => stack.itemId),
        carriedArmorIds: playerBeforeAction.inventory
          .filter((stack) => tryGetItem(stack.itemId)?.category === 'armor')
          .map((stack) => stack.itemId),
        inventorySize: playerBeforeAction.inventory.length,
        stamina: playerBeforeAction.stamina,
        hp: playerBeforeAction.hp,
      };
    }
    steps += 1;

    // ---- 每步体检 2：时间停滞 ----
    if (s.time === lastTime) {
      stallCounter += 1;
      if (stallCounter >= stallLimit) {
        stalled = true;
        break;
      }
    } else {
      stallCounter = 0;
      lastTime = s.time;
    }
  }

  return buildResult(s, {
    seed: options.seed,
    characterId,
    policy,
    deadlock,
    stalled,
    emptyLegalSet,
    illegalCommands,
    steps,
    timeAdvancingSteps,
    resolutionSteps,
    fallbackSteps,
    commandCounts,
    zeroStaminaGuardCommands,
    zeroStaminaFleeCommands,
    playerDeathSnapshot,
    keepFinalState: options.keepFinalState ?? false,
    keepEventTrace: options.keepEventTrace ?? false,
    fullEvents,
  });
}

interface ResultContext {
  seed: string;
  characterId: string;
  policy: AutoPlayerPolicy;
  deadlock: DeadlockReport | null;
  stalled: boolean;
  emptyLegalSet: boolean;
  illegalCommands: IllegalCommandRecord[];
  steps: number;
  timeAdvancingSteps: number;
  resolutionSteps: number;
  fallbackSteps: number;
  commandCounts: Record<string, number>;
  zeroStaminaGuardCommands: number;
  zeroStaminaFleeCommands: number;
  playerDeathSnapshot: PlayerDeathSnapshot | null;
  keepEventTrace: boolean;
  keepFinalState: boolean;
  fullEvents: GameEvent[];
}

function buildResult(s: GameState, ctx: ResultContext): AutoGameResult {
  const outcome = resolveOutcome(s);
  const player = getPlayer(s);
  const alive = aliveCharacters(s);
  const total = Object.keys(s.characters).length;

  const hardLimitReached =
    s.endReason === 'time_limit' || s.time >= GAME_CONFIG.hardTimeLimit;
  const eventCounts = (
    type: string,
    field: 'wildDefId' | 'zoneId',
    predicate?: (event: GameEvent) => boolean,
  ): Record<string, number> => {
    return countWildEvents(ctx.fullEvents, type, field, predicate);
  };
  const wildRecipeIds = new Set([...PHASE4N_RECIPES, ...PHASE4P_RECIPES].map((recipe) => recipe.id));
  const wildCraftGoalAttempted = Boolean(s.craftGoalRecipeId && wildRecipeIds.has(s.craftGoalRecipeId));

  const trustworthy =
    outcome !== 'timeout' &&
    ctx.deadlock === null &&
    !ctx.stalled &&
    !ctx.emptyLegalSet &&
    ctx.illegalCommands.length === 0 &&
    !s.apexSchedule.some((entry) =>
      entry.spawned && (entry.zoneId === null || !getWildEnemy(entry.defId).eligibleZones?.includes(entry.zoneId)),
    );

  const result: AutoGameResult = {
    seed: ctx.seed,
    characterId: ctx.characterId,
    policy: ctx.policy,
    version: GAME_VERSION,

    outcome,
    finalStatus: s.status,
    endReason: s.endReason,
    winnerId: s.victory.winnerId,
    victoryType: s.victory.type,
    timeUsed: s.endedAtTime ?? s.time,
    endedAtTime: s.endedAtTime,
    phase: s.phase,
    finaleStartedAt: s.finaleStartedAt,

    hardLimitReached,
    deadlock: ctx.deadlock,
    stalled: ctx.stalled,
    illegalCommands: ctx.illegalCommands,
    emptyLegalSet: ctx.emptyLegalSet,
    trustworthy,

    survived: player.alive,
    playerHp: player.hp,
    playerStamina: player.stamina,
    playerKills: player.kills,
    // 死者名次 = 总人数 - 死亡序号；存活者并列第一（平局时的诚实表述）
    playerRank: Math.max(1, buildFinalRanking(s).findIndex((character) => character.id === player.id) + 1),
    terminalWithoutWinner: (s.status === 'won' || s.status === 'lost') && s.victory.winnerId === null,
    invalidVictoryTuple: (() => {
      const empty = s.victory.winnerId === null
        && s.victory.type === null
        && s.victory.declaredAtTime === null;
      const complete = typeof s.victory.winnerId === 'string'
        && typeof s.victory.type === 'string'
        && typeof s.victory.declaredAtTime === 'number';
      return (!empty && !complete)
        || ((s.status === 'won' || s.status === 'lost') && !complete)
        || (s.status === 'draw' && !empty);
    })(),
    duplicateApexSpawn: (() => {
      const seen = new Set<string>();
      return ctx.fullEvents
        .filter((event) => event.type === 'APEX_SPAWNED')
        .some((event) => {
          const id = typeof event.metadata.wildDefId === 'string' ? event.metadata.wildDefId : event.id;
          if (seen.has(id)) return true;
          seen.add(id);
          return false;
        });
    })(),
    invalidApexSpawnZone: s.apexSchedule.some((entry) =>
      entry.spawned && (entry.zoneId === null || !getWildEnemy(entry.defId).eligibleZones?.includes(entry.zoneId)),
    ),
    playerDiedAtTime: player.diedAtTime,
    playerKilledBy: player.killedBy,
    playerZoneId: player.currentZoneId,
    playerInventorySize: player.inventory.length,
    damageDealt: player.stats.damageDealt,
    damageTaken: player.stats.damageTaken,
    searches: player.stats.searches,
    crafts: player.stats.crafts,
    moves: player.stats.moves,
    attacks: player.stats.attacks,
    itemsUsed: player.stats.itemsUsed,
    craftGoalRecipeId: s.craftGoalRecipeId,
    craftGoalCompleted: s.craftGoalCompleted,
    wildEncounterCount: s.stats.wildEncounterCount,
    wildKillCount: s.stats.wildKillCount,
    wildFleeCount: s.stats.wildFleeCount,
    wildDamageTaken: s.stats.wildDamageTaken,
    wildPlayerDeaths: s.stats.wildPlayerDeaths,
    wildDropsCreated: s.stats.wildDropsCreated,
    wildMaterialPickups: s.stats.wildMaterialPickups,
    wildCrafts: s.stats.wildCrafts,
    eliteEncounters: s.stats.eliteEncounterCount ?? 0,
    eliteKills: s.stats.eliteKillCount ?? 0,
    apexSpawned: s.stats.apexSpawnedCount ?? 0,
    apexEncounters: s.stats.apexEncounterCount ?? 0,
    apexKills: s.stats.apexKillCount ?? 0,
    apexFlees: s.stats.apexFleeCount ?? 0,
    signatureDrops: s.stats.signatureDrops ?? 0,
    signaturePickups: s.stats.signaturePickups ?? 0,
    signatureCrafts: s.stats.signatureCrafts ?? 0,
    bossKillsByType: eventCounts('WILD_DEFEATED', 'wildDefId', (event) => event.metadata.tier === 'apex'),
    wildEncounterByType: eventCounts('WILD_ENCOUNTER_STARTED', 'wildDefId'),
    wildEncounterByZone: eventCounts('WILD_ENCOUNTER_STARTED', 'zoneId'),
    wildKillByType: eventCounts('WILD_DEFEATED', 'wildDefId'),
    wildKillByZone: eventCounts('WILD_DEFEATED', 'zoneId'),
    wildCraftGoalAttempted,
    wildCraftGoalCompleted: wildCraftGoalAttempted && s.craftGoalCompleted,

    totalParticipants: total,
    survivorCount: alive.length,
    survivorIds: alive.map((c) => c.id),
    npcSurvivorPersonalities: alive.filter((c) => !c.isPlayer).map((c) => c.personality),
    deaths: s.deathOrder.length,
    zonesExhausted: s.stats.zonesExhausted,
    eventCount: s.events.length,

    steps: ctx.steps,
    timeAdvancingSteps: ctx.timeAdvancingSteps,
    resolutionSteps: ctx.resolutionSteps,
    fallbackSteps: ctx.fallbackSteps,
    commandCounts: ctx.commandCounts,
    zeroStaminaGuardCommands: ctx.zeroStaminaGuardCommands,
    zeroStaminaFleeCommands: ctx.zeroStaminaFleeCommands,
    playerDeathSnapshot: ctx.playerDeathSnapshot,

    ...scanPhase3aCounters(
      { ...s, events: ctx.fullEvents.length > 0 ? ctx.fullEvents : s.events },
      ctx.commandCounts,
    ),
  };

  if (ctx.keepFinalState) result.finalState = s;
  if (ctx.keepEventTrace) result.eventTrace = ctx.fullEvents.slice();
  return result;
}

/**
 * 扫描对局事件，统计 Phase 3A / 3A-1 玩法指标。
 *
 * 数据源是 `state.events` —— 与 UI 展示、存档完全同源，不存在「模拟器自己
 * 另算一套」的风险。口径：
 *  - 攻击风格：ATTACK_HIT / ATTACK_MISSED 的 `metadata.style` / `chance` / `damage`；
 *  - EXPOSED：重击挥空 `metadata.exposed === true`（施加），
 *    ATTACK_HIT `metadata.exposedConsumed === true`（兑现），
 *    STATUS_EXPIRED(statusId=exposed) 计为「未兑现失效」；
 *  - 防御姿态：ATTACK_HIT `metadata.guarded` / `guardPrevented`；
 *  - 技能：SKILL_USED 的 `metadata.skillId` + actorId 区分玩家/NPC；
 *  - 世界事件：WORLD_EVENT / WORLD_EVENT_DAMAGE / SEARCH_STARTED /
 *    CHARACTER_MOVED / ITEM_USED / ITEM_CRAFTED 的富化 metadata。
 *
 * 理论/实测命中差（§30）：expectedChance = 每次攻击事件 `metadata.chance` 的
 * 平均（百分数），actualHitRate = hits/attempts；deltaPP = |expected - actual|。
 */
function scanPhase3aCounters(
  s: GameState,
  commandCounts: Record<string, number>,
): {
  attackStyleCounts: Record<string, number>;
  exposedApplied: number;
  exposedConsumed: number;
  guardResolves: number;
  skillUseCounts: Record<string, number>;
  worldEventCounts: Record<string, number>;
  attackStyleStats: Record<string, StyleAggStat>;
  guardCommands: number;
  guardTriggered: number;
  guardDamagePreventedTotal: number;
  guardDamagePreventedAverage: number;
  heavyMissCount: number;
  exposedExpiredWithoutPunish: number;
  exposedBonusDamageTotal: number;
  skillStats: Record<string, SkillAggStat>;
  worldEventImpact: Record<string, WorldEventImpactAgg>;
} {
  const attackStyleCounts: Record<string, number> = {};
  const skillUseCounts: Record<string, number> = {};
  const worldEventCounts: Record<string, number> = {};
  const attackStyleStats: Record<string, StyleAggStat> = {};
  const skillStats: Record<string, SkillAggStat> = {};
  const worldEventImpact: Record<string, WorldEventImpactAgg> = {};
  /** 内部累积：展示命中率（百分数）之和，按风格 */
  const chanceSumByStyle: Record<string, number> = {};

  let exposedApplied = 0;
  let exposedConsumed = 0;
  let guardResolves = 0;
  let guardTriggered = 0;
  let guardDamagePreventedTotal = 0;
  let heavyMissCount = 0;
  let exposedExpiredWithoutPunish = 0;
  let exposedBonusDamageTotal = 0;

  const playerId = s.playerId;

  const styleStat = (style: string): StyleAggStat => {
    attackStyleStats[style] ??= {
      attempts: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      damageTotal: 0,
      avgDamageOnHit: 0,
      averageShownChance: 0,
      deltaPP: 0,
    };
    return attackStyleStats[style]!;
  };
  const skillStat = (sid: string): SkillAggStat => {
    skillStats[sid] ??= {
      playerUses: 0,
      npcUses: 0,
      reconEncounterInitiativeCount: 0,
      adrenalineAttackCount: 0,
      adrenalineBonusDamage: 0,
      adrenalineStaminaSaved: 0,
      adrenalineExtraDamageTaken: 0,
      freeCraftCount: 0,
      craftStaminaSaved: 0,
      instantHealing: 0,
      bonusConsumableHealing: 0,
    };
    return skillStats[sid]!;
  };
  const impactStat = (wid: string): WorldEventImpactAgg => {
    worldEventImpact[wid] ??= {
      triggerCount: 0,
      searchesAffected: 0,
      encounterWeightReductionCount: 0,
      nothingWeightIncreaseCount: 0,
      movesAffected: 0,
      extraMoveStaminaPaid: 0,
      rangedAttacksAffected: 0,
      zonesBroadcast: 0,
      healsAffected: 0,
      bonusHealing: 0,
      ticks: 0,
      damageTotal: 0,
      deaths: 0,
      noiseDecayPrevented: 0,
      searchNoiseBonus: 0,
    };
    return worldEventImpact[wid]!;
  };

  for (const e of s.events) {
    const m = e.metadata ?? {};
    if (e.type === 'ATTACK_HIT' || e.type === 'ATTACK_MISSED') {
      const style = m.style as string | undefined;
      if (style) {
        attackStyleCounts[style] = (attackStyleCounts[style] ?? 0) + 1;
        const st = styleStat(style);
        st.attempts += 1;
        chanceSumByStyle[style] =
          (chanceSumByStyle[style] ?? 0) + (typeof m.chance === 'number' ? m.chance : 0);
      }
      if (m.exposed === true) exposedApplied += 1;
      if (e.type === 'ATTACK_HIT') {
        if (m.exposedConsumed === true) exposedConsumed += 1;
        if (typeof m.exposedBonus === 'number') exposedBonusDamageTotal += m.exposedBonus;
        if (m.guarded === true && e.targetId === playerId) {
          guardResolves += 1;
          guardTriggered += 1;
          if (typeof m.guardPrevented === 'number') guardDamagePreventedTotal += m.guardPrevented;
        }
        const st = style ? styleStat(style) : null;
        if (st) {
          st.hits += 1;
          if (typeof m.damage === 'number') st.damageTotal += m.damage;
        }
        if (m.adrenalineActive === true) {
          const fs = skillStat('adrenaline');
          fs.adrenalineAttackCount += 1;
          fs.adrenalineStaminaSaved += typeof m.staminaSaved === 'number' ? m.staminaSaved : 0;
          fs.adrenalineBonusDamage += typeof m.adrenalineBonus === 'number' ? m.adrenalineBonus : 0;
        }
        if (e.targetId === playerId && typeof m.frenzyBonus === 'number') {
          skillStat('adrenaline').adrenalineExtraDamageTaken += m.frenzyBonus;
        }
        if (m.ranged === true) {
          impactStat('rain').rangedAttacksAffected += 1;
        }
      } else {
        const st = style ? styleStat(style) : null;
        if (st) {
          st.misses += 1;
          if (style === 'heavy') heavyMissCount += 1;
        }
        if (m.adrenalineActive === true) {
          const fs = skillStat('adrenaline');
          fs.adrenalineAttackCount += 1;
          fs.adrenalineStaminaSaved += typeof m.staminaSaved === 'number' ? m.staminaSaved : 0;
        }
      }
    } else if (e.type === 'STATUS_EXPIRED') {
      if (m.statusId === 'exposed') exposedExpiredWithoutPunish += 1;
    } else if (e.type === 'SKILL_USED') {
      const sid = m.skillId as string | undefined;
      if (sid) {
        skillUseCounts[sid] = (skillUseCounts[sid] ?? 0) + 1;
        const ss = skillStat(sid);
        if (e.actorId === playerId) ss.playerUses += 1;
        else ss.npcUses += 1;
        if (sid === 'emergency_treatment' && e.actorId === playerId) {
          ss.instantHealing += typeof m.hpHealed === 'number' ? m.hpHealed : 0;
        }
      }
    } else if (e.type === 'ENCOUNTER_STARTED') {
      if (m.reconInitiative === true && e.actorId === playerId) {
        skillStat('scout_recon').reconEncounterInitiativeCount += 1;
      }
    } else if (e.type === 'WORLD_EVENT') {
      const wid = m.worldEventId as string | undefined;
      if (wid) {
        worldEventCounts[wid] = (worldEventCounts[wid] ?? 0) + 1;
        impactStat(wid).triggerCount += 1;
        if (wid === 'emergency_broadcast' && typeof m.broadcastZoneId === 'string') {
          impactStat(wid).zonesBroadcast += 1;
        }
      }
    } else if (e.type === 'WORLD_EVENT_DAMAGE') {
      const imp = impactStat('research_anomaly');
      imp.ticks += 1;
      imp.damageTotal += typeof m.damage === 'number' ? m.damage : 0;
      if (m.died === true) imp.deaths += 1;
    } else if (e.type === 'SEARCH_STARTED') {
      if (m.blackoutActive === true) {
        const imp = impactStat('blackout');
        imp.searchesAffected += 1;
        if ((m.enemyWeight as number) > 0) imp.encounterWeightReductionCount += 1;
        if ((m.nothingWeight as number) > 0) imp.nothingWeightIncreaseCount += 1;
      }
      if (m.unrestActive === true && typeof m.searchNoiseBonus === 'number') {
        const imp = impactStat('citywide_unrest');
        imp.searchNoiseBonus += m.searchNoiseBonus as number;
      }
    } else if (e.type === 'CHARACTER_MOVED') {
      if (m.rainActive === true) {
        const imp = impactStat('rain');
        imp.movesAffected += 1;
        imp.extraMoveStaminaPaid += typeof m.extraMoveStaminaPaid === 'number' ? (m.extraMoveStaminaPaid as number) : 0;
      }
    } else if (e.type === 'ITEM_USED') {
      if (m.medicalAlertActive === true && m.inHospital === true && (m.hpRestored as number) > 0) {
        const imp = impactStat('medical_alert');
        imp.healsAffected += 1;
        const actor = e.actorId ? s.characters[e.actorId] : undefined;
        const passive = actor?.passiveId === 'field_medic' ? 1.25 : 1;
        const focus = m.focusActive === true ? 1.25 : 1;
        const expected = Math.round((m.baseHeal as number) * passive * focus);
        imp.bonusHealing += Math.max(0, (m.hpRestored as number) - expected);
      }
      if (m.focusActive === true && e.actorId === playerId && (m.hpRestored as number) > 0) {
        const actor = s.characters[e.actorId];
        const passive = actor?.passiveId === 'field_medic' ? 1.25 : 1;
        const world = m.medicalAlertActive === true && m.inHospital === true ? 1.2 : 1;
        const expected = Math.round((m.baseHeal as number) * passive * world);
        skillStat('emergency_treatment').bonusConsumableHealing += Math.max(
          0,
          (m.hpRestored as number) - expected,
        );
      }
    } else if (e.type === 'ITEM_CRAFTED') {
      if (m.freeCraft === true) {
        const es = skillStat('field_craft');
        es.freeCraftCount += 1;
        es.craftStaminaSaved += typeof m.staminaSaved === 'number' ? m.staminaSaved : 0;
      }
    }
  }

  // 归一化命中统计
  for (const [style, st] of Object.entries(attackStyleStats)) {
    st.averageShownChance = st.attempts > 0 ? (chanceSumByStyle[style] ?? 0) / st.attempts : 0;
    st.hitRate = st.attempts > 0 ? st.hits / st.attempts : 0;
    st.avgDamageOnHit = st.hits > 0 ? st.damageTotal / st.hits : 0;
    st.deltaPP = Math.abs(st.averageShownChance - st.hitRate * 100);
  }
  const guardCommands = commandCounts.GUARD ?? 0;
  const guardDamagePreventedAverage =
    guardTriggered > 0 ? guardDamagePreventedTotal / guardTriggered : 0;
  // 全域骚动：阻止噪音衰减的次数来自 state.stats（decayNoise 内统计）
  impactStat('citywide_unrest').noiseDecayPrevented =
    s.stats.noiseDecayBlockedTicks ?? 0;

  return {
    attackStyleCounts,
    exposedApplied,
    exposedConsumed,
    guardResolves,
    skillUseCounts,
    worldEventCounts,
    attackStyleStats,
    guardCommands,
    guardTriggered,
    guardDamagePreventedTotal,
    guardDamagePreventedAverage,
    heavyMissCount,
    exposedExpiredWithoutPunish,
    exposedBonusDamageTotal,
    skillStats,
    worldEventImpact,
  };
}

/** 批量跑同一配置的多局，种子按 `${seedPrefix}-${i}` 生成，便于复现单局 */
export function runAutoGames(
  count: number,
  base: Omit<AutoGameOptions, 'seed'> & { seedPrefix: string },
): AutoGameResult[] {
  const out: AutoGameResult[] = [];
  for (let i = 0; i < count; i++) {
    out.push(runAutoGame({ ...base, seed: `${base.seedPrefix}-${i}` }));
  }
  return out;
}
