/**
 * 当前版本的区域地图存档迁移。
 *
 * Phase 4K 保持 GAME_VERSION 不变：旧的 0.4.0 存档已经具备完整的成长、
 * 世界事件和存档字段，只是创建时还没有新增区域。加载时为这些缺失区域
 * 补建安全状态和确定性初始库存，既不消耗主 RNG 流，也不改变旧区域内容。
 * 其他版本仍由 saveLoad 的版本闸门拒绝，不在这里静默迁移。
 */

import { generateZoneLoot, initZoneLoot } from './zoneLoot';
import { SeededRandom } from './random';
import { LEGACY_ZONE_IDS, ZONES } from '../data/zones';
import type { ZoneState } from './types';

function createMigratedZoneState(id: string): ZoneState {
  const zone: ZoneState = {
    id,
    status: 'safe',
    searchCount: 0,
    supply: 1,
    loot: [],
    initialLootCount: 0,
    remainingLootCount: 0,
    searchedEmptyCount: 0,
    warningAtTime: null,
    restrictedAtTime: null,
    groundItems: [],
    aliveCharacterIds: [],
    lastCombatTime: -1,
    lastNoiseTime: -1,
    noiseLevel: 0,
  };
  return zone;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 给同版本的六区存档补齐当前固定地图区域。
 * 返回原对象引用是安全的：loadGame 传入的是刚刚 JSON.parse 的临时对象。
 */
export function migrateMissingZoneStates(raw: unknown): unknown {
  if (!isRecord(raw) || !isRecord(raw.state) || !isRecord(raw.state.zones)) return raw;

  const zones = raw.state.zones;
  // Phase 4M adds one optional utility slot without changing GAME_VERSION.
  // Old same-version saves have no utility id; absence means the slot is empty.
  if (isRecord(raw.state.characters)) {
    for (const character of Object.values(raw.state.characters)) {
      if (isRecord(character) && !Object.prototype.hasOwnProperty.call(character, 'equippedUtilityId')) {
        character.equippedUtilityId = null;
      }
    }
  }
  const legacyIds = new Set<string>(LEGACY_ZONE_IDS);
  const zoneKeys = Object.keys(zones);
  const isExactLegacyMap =
    zoneKeys.length === LEGACY_ZONE_IDS.length &&
    zoneKeys.every((id) => legacyIds.has(id)) &&
    LEGACY_ZONE_IDS.every((id) => isRecord(zones[id]));
  if (!isExactLegacyMap) return raw;

  const seed = typeof raw.state.seed === 'string' ? raw.state.seed : 'invalid-save';
  for (const def of ZONES) {
    if (isRecord(zones[def.id])) continue;
    const zone = createMigratedZoneState(def.id);
    // 迁移 RNG 与 state.rngState 隔离，加载后下一条玩家命令仍从原序列继续。
    initZoneLoot(zone, generateZoneLoot(def.id, new SeededRandom(`phase4k:${seed}:${def.id}`)));
    zones[def.id] = zone;
  }
  return raw;
}
