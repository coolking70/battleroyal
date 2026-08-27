/**
 * Phase 4X / 4X-AF1 — formal same-version save migration.
 *
 * The support boundary below is exactly what `tests/phase4xSaveMigration.test.ts`
 * proves end to end (storage → loadGame → migrate → validate → next command).
 * Nothing here reconstructs history it cannot derive.
 *
 * SUPPORTED — current GAME_VERSION *and* current schema, with one of:
 *   1. `equippedUtilityId` absent on a character → null. Phase 4M added this
 *      optional slot without bumping GAME_VERSION; absence can only mean
 *      "empty", so the backfill is lossless.
 *   2. The zone TABLE is still exactly the historical six-zone map while the
 *      rest of the save already carries current-schema state for the full
 *      fixed map. The missing zone states are rebuilt from a migration-only
 *      RNG (`phase4k:<seed>:<zoneId>`) that is isolated from `state.rngState`,
 *      so the next command continues the original sequence bit-for-bit.
 *      The rebuild fires ONLY on an exact six-zone match, so a partially
 *      corrupted zone table is never "repaired" into a plausible-looking one.
 *
 * UNSUPPORTED — rejected by `loadGame`, storage left byte-for-byte intact:
 *   - Any other GAME_VERSION (version gate, before migration runs).
 *   - Genuine pre-4K / pre-4N / pre-4Q historical *schema* saves. Those lack
 *     `wildEnemies`, `landmarks`, `incidents` and per-actor knowledge memory
 *     entirely. Which finite wild population was already consumed, which
 *     incidents already fired, and what each actor had observed are NOT
 *     derivable from such a save, and inventing them would silently change
 *     the run. This migration therefore does not touch them at all: the save
 *     falls through to validation, is refused, and is preserved for the
 *     player to keep or clear manually.
 *
 * In other words: a truncated zone table is repairable; missing subsystem
 * history is not.
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
