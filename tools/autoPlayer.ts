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
import { aliveCharacters, createGame, getPlayer } from '../src/core/gameState';
import { executeCommand } from '../src/core/gameEngine';
import { decideNpcAction } from '../src/core/npcDecide';
import {
  findDeadlock,
  getLegalPlayerCommands,
  type DeadlockReport,
  type LegalAction,
  type LegalActionCategory,
} from '../src/core/legalActions';
import { tryGetItem } from '../src/data/items';
import type { Command, Combatant, GameState, Personality } from '../src/core/types';

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

  /** 仅在 keepFinalState 为 true 时存在 */
  finalState?: GameState;
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
  aggressive: { combat: 10, search: 4, movement: 3, craft: 2, recovery: 1, item: 1, resolution: 0, meta: 0 },
  cautious: { combat: 1, search: 4, movement: 4, craft: 3, recovery: 6, item: 1, resolution: 0, meta: 0 },
  collector: { combat: 1, search: 9, movement: 4, craft: 5, recovery: 2, item: 1, resolution: 0, meta: 0 },
  opportunist: { combat: 4, search: 6, movement: 4, craft: 3, recovery: 3, item: 1, resolution: 0, meta: 0 },
  random: { combat: 3, search: 3, movement: 3, craft: 3, recovery: 3, item: 1, resolution: 0, meta: 0 },
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
        state.characters[d.targetId]?.alive
      ) {
        return {
          command: { type: 'ATTACK', targetId: d.targetId, style },
          reason: d.reason,
        };
      }
      return { command: { type: 'ATTACK_NEARBY', style }, reason: d.reason };
    }
    case 'guard':
      // 摆出防御姿态：消耗体力但减免下一击，与 NPC 共用同一套规则
      return { command: { type: 'GUARD' }, reason: d.reason };
    case 'use_skill':
      // 释放角色技能：与 NPC 共用同一套规则（Phase 3 Step 3）
      return d.skillId
        ? { command: { type: 'USE_SKILL', skillId: d.skillId }, reason: d.reason }
        : { command: null, reason: d.reason };
    case 'flee_combat':
      return { command: { type: 'FLEE' }, reason: d.reason };
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
      const preferred = decideAutoPlayerCommand(s, player, policy, policyRng);
      const matched = preferred.command
        ? legal.find((a) => sameCommand(a.command, preferred.command!))
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

    bump(commandCounts, chosen.command.type);
    if (chosen.advancesTime) timeAdvancingSteps += 1;
    if (chosen.category === 'resolution') resolutionSteps += 1;

    s = res.state;
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
    keepFinalState: options.keepFinalState ?? false,
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
  keepFinalState: boolean;
}

function buildResult(s: GameState, ctx: ResultContext): AutoGameResult {
  const outcome = resolveOutcome(s);
  const player = getPlayer(s);
  const alive = aliveCharacters(s);
  const total = Object.keys(s.characters).length;
  const deathIndex = s.deathOrder.indexOf(s.playerId);

  const hardLimitReached =
    s.endReason === 'time_limit' || s.time >= GAME_CONFIG.hardTimeLimit;

  const trustworthy =
    outcome !== 'timeout' &&
    ctx.deadlock === null &&
    !ctx.stalled &&
    !ctx.emptyLegalSet &&
    ctx.illegalCommands.length === 0;

  const result: AutoGameResult = {
    seed: ctx.seed,
    characterId: ctx.characterId,
    policy: ctx.policy,
    version: GAME_VERSION,

    outcome,
    finalStatus: s.status,
    endReason: s.endReason,
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
    playerRank: player.alive ? 1 : deathIndex >= 0 ? total - deathIndex : total,
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
  };

  if (ctx.keepFinalState) result.finalState = s;
  return result;
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
