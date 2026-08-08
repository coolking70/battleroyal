/**
 * 信息不完全（第二阶段核心改动）。
 *
 * 第一阶段玩家拥有上帝视角：地图直接显示每个区域有几个人、
 * 同区域面板直接列出所有对手的生命与武器。这让"侦察"这件事失去意义。
 *
 * 第二阶段起：
 * - 地图只提供**噪音等级**（安静 / 有动静 / 嘈杂），噪音由搜索、战斗、死亡产生，随时间衰减；
 * - 对手的位置只在**亲眼看见 / 遭遇 / 全场广播**时被记录为"最后已知位置"，并会过期；
 * - 精确的生命、武器、背包信息只在**遭遇发生时**对当前对手揭示；
 * - 调试面板保留全知视角，方便开发验证。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { aliveCharacters } from './gameState';
import { worldModifiersAt } from './worldEvents';
import type {
  GameState,
  IntelEntry,
  NoiseLevel,
  ZoneState,
} from './types';

/* ------------------------------------------------------------------ */
/* 噪音                                                                */
/* ------------------------------------------------------------------ */

export type NoiseSource = 'search' | 'combat' | 'death';

const NOISE_AMOUNT: Record<NoiseSource, number> = {
  search: GAME_CONFIG.noiseFromSearch,
  combat: GAME_CONFIG.noiseFromCombat,
  death: GAME_CONFIG.noiseFromDeath,
};

/** 在某区域制造噪音 */
export function addNoise(state: GameState, zoneId: string, source: NoiseSource): void {
  const zone = state.zones[zoneId];
  if (!zone) return;
  zone.noiseLevel = Math.min(20, zone.noiseLevel + NOISE_AMOUNT[source]);
  zone.lastNoiseTime = state.time;
}

/** 每个时间单位衰减一次噪音 */
export function decayNoise(state: GameState): void {
  for (const zone of Object.values(state.zones)) {
    if (zone.noiseLevel <= 0) continue;
    zone.noiseLevel = Math.max(0, zone.noiseLevel - GAME_CONFIG.noiseDecayPerTick);
  }
}

export function noiseLevelOf(zone: ZoneState): NoiseLevel {
  if (zone.noiseLevel >= GAME_CONFIG.noiseLoudThreshold) return 'loud';
  if (zone.noiseLevel >= GAME_CONFIG.noiseActiveThreshold) return 'active';
  return 'quiet';
}

export const NOISE_LABEL: Record<NoiseLevel, string> = {
  quiet: '安静',
  active: '有动静',
  loud: '嘈杂',
};

/* ------------------------------------------------------------------ */
/* 情报（最后已知位置）                                                 */
/* ------------------------------------------------------------------ */

/** 情报保鲜期：超过这个时长的"最后已知位置"会被标记为陈旧 */
export const INTEL_FRESH_WINDOW = 6;

/**
 * 记录一条玩家情报。
 *
 * Phase 3A Step 6：`sight` 来源的情报会被「大停电」屏蔽 —— 漆黑的区域里
 * 你根本看不清对面是谁。`encounter` / `broadcast` 不受影响：
 * 前者是真刀真枪打过照面，后者是全城广播，都不依赖视线。
 */
export function recordIntel(
  state: GameState,
  targetId: string,
  zoneId: string,
  source: IntelEntry['source'],
): void {
  if (targetId === state.playerId) return;
  if (source === 'sight' && worldModifiersAt(state, zoneId).intelBlocked) return;
  state.playerIntel[targetId] = { zoneId, atTime: state.time, source };
}

/**
 * 刷新玩家视野：每个时间单位结束时调用一次。
 *
 * 信息隐藏（2A-E）：只有「正在与玩家遭遇」的对手才会被识别并记录情报。
 * 仅仅是同区域共处不会泄露身份——否则玩家只要走进一个有人区域就自动拿到
 * 对方全部档案，等于变相上帝视角。身份只能靠真正交手去换取。
 *
 * Phase 3A Step 6 例外：「紧急广播」生效期间全场位置公开，
 * 这是**双向**的（NPC 决策同样读得到玩家位置），不是单方面送情报。
 */
export function refreshPlayerSight(state: GameState): void {
  const player = state.characters[state.playerId];
  if (!player || !player.alive) return;

  // 紧急广播：公开所有存活者的所在区域
  if (worldModifiersAt(state, player.currentZoneId).revealAll) {
    for (const c of aliveCharacters(state)) {
      if (c.id === player.id) continue;
      recordIntel(state, c.id, c.currentZoneId, 'broadcast');
    }
  }

  const encounterId = state.encounter?.enemyId ?? null;
  if (!encounterId) return;
  const zone = state.zones[player.currentZoneId];
  if (!zone || !zone.aliveCharacterIds.includes(encounterId)) return;
  recordIntel(state, encounterId, player.currentZoneId, 'sight');
}

export interface IntelView {
  characterId: string;
  name: string;
  zoneId: string;
  atTime: number;
  /** 情报是否仍然新鲜 */
  fresh: boolean;
  /** 该角色是否已经出局（出局信息通过全场广播公开） */
  dead: boolean;
  source: IntelEntry['source'];
}

/** 生成界面用的情报列表（按新鲜度排序） */
export function listIntel(state: GameState): IntelView[] {
  const out: IntelView[] = [];
  for (const [characterId, entry] of Object.entries(state.playerIntel)) {
    const c = state.characters[characterId];
    if (!c) continue;
    out.push({
      characterId,
      name: c.name,
      zoneId: entry.zoneId,
      atTime: entry.atTime,
      fresh: state.time - entry.atTime <= INTEL_FRESH_WINDOW,
      dead: !c.alive,
      source: entry.source,
    });
  }
  return out.sort((a, b) => b.atTime - a.atTime);
}

/* ------------------------------------------------------------------ */
/* 同区域人员存在感（Phase 2A-1 信息隐藏 §十）                           */
/* ------------------------------------------------------------------ */

/**
 * 同区域人员的**存在感分档**。
 *
 * Phase 2A-1 起，未发生正式遭遇时不再逐行列出匿名对手（那会泄露精确人数），
 * 只给一个区域级提示。分档依据「公开噪音 + 感知」：
 * - none：本区域只有玩家一人；
 * - some：似乎有人活动；
 * - active：活动迹象明显；
 * - many：这里可能有多人。
 * 任何分档都不给出精确人数。
 */
export type PresenceLevel = 'none' | 'some' | 'active' | 'many';

export const PRESENCE_TEXT: Record<PresenceLevel, string> = {
  none: '这里暂时只有你一个人。',
  some: '附近似乎有人活动。',
  active: '活动迹象明显，附近动静不少。',
  many: '这里可能有多人，小心行事。',
};

/** 计算玩家所在区域的"存在感分档"（绝不泄露精确人数） */
export function zonePresence(state: GameState): PresenceLevel {
  const player = state.characters[state.playerId];
  if (!player || !player.alive) return 'none';
  const zone = state.zones[player.currentZoneId];
  if (!zone) return 'none';
  const others = zone.aliveCharacterIds.filter((id) => id !== player.id).length;
  if (others === 0) return 'none';

  // 公开噪音 + 感知 → 模糊分档；阈值刻意带重叠，避免反推精确人数
  const noise = zone.noiseLevel;
  if (noise >= GAME_CONFIG.noiseLoudThreshold || others >= 4) return 'many';
  if (noise >= GAME_CONFIG.noiseActiveThreshold || others >= 2) return 'active';
  return 'some';
}

/**
 * 玩家在当前区域能看到的对手。
 *
 * 同区域一定"看得见有人"，但只有正在遭遇的那一个才会暴露精确状态；
 * 其余的只给一句模糊印象，逼迫玩家自己去接触或撤离。
 */
// （visibleRivals 已在 Phase 2A-1 移除：未遭遇时逐行列出匿名对手会泄露人数，
//  由 zonePresence 的区域级存在感提示取代。）
