import type { Combatant } from './characterTypes';
import type { EncounterState, PendingPickup } from './encounterTypes';
import type { EventCounters, GameEvent } from './eventTypes';
import type { GamePhase, GameStatus } from './sharedTypes';
import type { ZoneState } from './zoneTypes';
import type { WorldEventRecord, WorldEventState } from '../commandTypes';
import type { WildEnemyInstance } from './wildTypes';

/* ------------------------------------------------------------------ */
/* 游戏状态                                                            */
/* ------------------------------------------------------------------ */

export interface GameGlobalStats {
  searches: number;
  crafts: number;
  moves: number;
  itemsUsed: number;
  attacks: number;
  /** 被搜空的区域数量 */
  zonesExhausted: number;
  /** Phase 3A-1：「全域骚动」期间被阻止的噪音衰减次数（区域 × tick） */
  noiseDecayBlockedTicks: number;
  wildEncounterCount: number;
  wildKillCount: number;
  wildFleeCount: number;
  wildDamageTaken: number;
  wildPlayerDeaths: number;
  wildDropsCreated: number;
  wildMaterialPickups: number;
  wildCrafts: number;
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
  /** Dedicated PvE runtime registry. Wild enemies are never contestants. */
  wildEnemies: Record<string, WildEnemyInstance>;
  wildUidSeq: number;
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
