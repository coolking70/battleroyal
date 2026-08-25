/**
 * Phase 4X — formal same-version save migration.
 *
 * SUPPORTED (safely reconstructible, no history invented):
 *   - `equippedUtilityId` absent on a character → null. Phase 4M added one
 *     optional utility slot without bumping GAME_VERSION; an absent slot
 *     unambiguously means "empty", so this is lossless.
 *   - Fixed-map zone states that did not exist yet. Only applied when the
 *     save carries EXACTLY the historical six-zone map, so a partially
 *     corrupted zone table is never "repaired" into a plausible-looking one.
 *     New zones are seeded from a migration-only RNG
 *     (`phase4k:<seed>:<zoneId>`) that is isolated from `state.rngState`,
 *     so the next command continues the original sequence bit-for-bit.
 *
 * DELIBERATELY UNSUPPORTED (cannot be reconstructed — never faked):
 *   - Anything from a different GAME_VERSION. In particular pre-4N saves
 *     have no record of which finite wild population was already consumed,
 *     and inventing one would silently change the run's difficulty. Those
 *     saves are rejected by the version gate in loadGame, left untouched in
 *     storage, and surfaced to the player for a manual decision.
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
    objectiveLoot: [],
    initialLootCount: 0,
    remainingLootCount: 0,
    searchedEmptyCount: 0,
    warningAtTime: null,
    restrictedAtTime: null,
    groundItems: [],
    aliveCharacterIds: [],
    wildEnemyIds: [],
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
 * Migrate a same-version save in place and return it.
 *
 * Returning the original reference is safe: loadGame passes the object it
 * just produced from JSON.parse, which nothing else observes. A save that
 * needs no migration is returned untouched.
 */
export function migrateSameVersionSave(raw: unknown): unknown {
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
