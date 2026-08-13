import { afterEach, describe, expect, it } from 'vitest';
import { GAME_CONFIG, SAVE_KEY } from '../src/data/gameConfig';
import {
  LEGACY_ZONE_IDS,
  ZONE_IDS,
  ZONES,
  areAdjacent,
  getZoneDef,
  validateZoneGraph,
} from '../src/data/zones';
import { tryGetItem } from '../src/data/items';
import { getCraftGoalRecommendations, getZoneDistance } from '../src/core/craftGuide';
import { advancePhase } from '../src/core/phase';
import { executeCommand } from '../src/core/gameEngine';
import { clearInventory, newGame, npcs, player } from './helpers';
import { announceWarning, promoteWarnings, safeZoneIds } from '../src/core/restrictedZones';
import { refreshZoneOccupants, SPAWN_ZONE_IDS } from '../src/core/gameState';
import { SeededRandom } from '../src/core/random';
import {
  createMemoryStorage,
  loadGame,
  saveGame,
  setStorage,
  type SaveData,
  type StorageLike,
} from '../src/core/saveLoad';
import type { GameState } from '../src/core/types';
import { validateZoneLootPools } from '../src/core/zoneLoot';

const NEW_ZONE_IDS = ZONE_IDS.filter((id) => !LEGACY_ZONE_IDS.includes(id as never));

function bfsRoute(from: string, to: string): string[] {
  if (from === to) return [from];
  const queue = [from];
  const previous = new Map<string, string | null>([[from, null]]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of getZoneDef(current).adjacent) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      queue.push(next);
      if (next === to) {
        const route: string[] = [];
        let cursor: string | null = to;
        while (cursor !== null) {
          route.unshift(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        return route;
      }
    }
  }
  return [];
}

function setPlayerZone(state: GameState, zoneId: string): void {
  player(state).currentZoneId = zoneId;
  refreshZoneOccupants(state);
}

function writeRawSave(
  storage: StorageLike,
  state: GameState,
  mutate: (raw: SaveData) => void = () => undefined,
): void {
  const raw: SaveData = {
    version: state.version,
    savedAt: Date.now(),
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state: structuredClone(state),
  };
  mutate(raw);
  storage.setItem(SAVE_KEY, JSON.stringify(raw));
}

describe('Phase 4K · fixed world graph and zone content', () => {
  it('contains at least 12 playable zones with a connected, symmetric simple graph', () => {
    expect(ZONES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ZONE_IDS).size).toBe(ZONES.length);
    expect(validateZoneGraph()).toEqual([]);
    expect(ZONES.every((zone) => zone.adjacent.length >= 2 && zone.adjacent.length <= 4)).toBe(true);
    expect(ZONES.some((zone) => zone.adjacent.length >= 3)).toBe(true);
  });

  it('gives every zone a distinct loot identity made only from known items', () => {
    expect(validateZoneLootPools()).toEqual([]);
    for (const zone of ZONES) {
      expect(zone.name.length, zone.id).toBeGreaterThan(0);
      expect(zone.description.length, zone.id).toBeGreaterThan(0);
      expect(zone.basePool.length, `${zone.id} basePool`).toBeGreaterThan(0);
      expect(zone.rarePool.length, `${zone.id} rarePool`).toBeGreaterThan(0);
      for (const itemId of [...zone.basePool, ...zone.rarePool]) {
        expect(tryGetItem(itemId), `${zone.id} -> ${itemId}`).not.toBeNull();
      }
    }
    const newZoneBasePools = NEW_ZONE_IDS.map((id) => getZoneDef(id).basePool.join('|'));
    expect(new Set(newZoneBasePools).size).toBe(NEW_ZONE_IDS.length);
  });

  it('searches every new zone without a hidden six-zone branch', () => {
    for (const zoneId of NEW_ZONE_IDS) {
      const state = newGame(`PHASE4K-SEARCH-${zoneId}`);
      const p = player(state);
      setPlayerZone(state, zoneId);
      for (const npc of npcs(state)) npc.currentZoneId = LEGACY_ZONE_IDS[0];
      refreshZoneOccupants(state);
      p.stamina = p.maxStamina;
      const result = executeCommand(state, { type: 'SEARCH' });
      expect(result.ok, zoneId).toBe(true);
      expect(result.state.zones[zoneId]!.searchCount).toBe(1);
      const searchedOrEncounteredWild = result.state.events.some(
        (event) => event.type === 'WILD_ENCOUNTER_STARTED' && event.actorId === p.id && event.zoneId === zoneId,
      );
      expect(
        result.state.zones[zoneId]!.remainingLootCount < result.state.zones[zoneId]!.initialLootCount || searchedOrEncounteredWild,
      ).toBe(true);
    }
  });

  it('moves legally across new zones and rejects non-adjacent destinations', () => {
    for (const zoneId of NEW_ZONE_IDS) {
      const state = newGame(`PHASE4K-MOVE-${zoneId}`);
      const p = player(state);
      const from = getZoneDef(zoneId).adjacent[0]!;
      setPlayerZone(state, from);
      p.stamina = p.maxStamina;
      const moved = executeCommand(state, { type: 'MOVE', zoneId });
      expect(moved.ok, `${from} -> ${zoneId}`).toBe(true);
      expect(player(moved.state).currentZoneId).toBe(zoneId);

      const nonAdjacent = ZONE_IDS.find(
        (candidate) => candidate !== zoneId && !areAdjacent(zoneId, candidate),
      )!;
      const rejected = executeCommand(moved.state, { type: 'MOVE', zoneId: nonAdjacent });
      expect(rejected.ok, `${zoneId} -> ${nonAdjacent}`).toBe(false);
    }
  });

  it('keeps every pair reachable through finite adjacency routes', () => {
    for (const from of ZONE_IDS) {
      for (const to of ZONE_IDS) {
        expect(getZoneDistance(from, to), `${from} -> ${to}`).toBeGreaterThanOrEqual(0);
        const route = bfsRoute(from, to);
        expect(route[0]).toBe(from);
        expect(route.at(-1)).toBe(to);
        for (let i = 1; i < route.length; i++) {
          expect(areAdjacent(route[i - 1]!, route[i]!)).toBe(true);
        }
      }
    }
  });
});

describe('Phase 4K · restricted zones, craft routes and spawns', () => {
  it.each(['PHASE4K-ZONE-A', 'PHASE4K-ZONE-B', 'PHASE4K-ZONE-C'])(
    'progresses warning/restricted zones while preserving a safe-zone floor (%s)',
    (seed) => {
      const state = newGame(seed);
      const rng = SeededRandom.fromState(state.rngState);
      let announcements = 0;
      while (safeZoneIds(state).length > 1) {
        const warning = announceWarning(state, rng);
        if (!warning) break;
        announcements += 1;
        state.time += GAME_CONFIG.zoneWarningDuration;
        promoteWarnings(state);
        expect(safeZoneIds(state).length).toBeGreaterThanOrEqual(GAME_CONFIG.minSafeZones);
      }
      expect(announcements).toBeGreaterThan(0);
      expect(state.events.some((event) => event.type === 'ZONE_WARNING')).toBe(true);
      expect(state.events.some((event) => event.type === 'ZONE_RESTRICTED')).toBe(true);
      expect(safeZoneIds(state).length).toBe(GAME_CONFIG.minSafeZones);
    },
  );

  it('makes restricted-zone selection deterministic and finale remains reachable', () => {
    const a = newGame('PHASE4K-RESTRICTED-DETERMINISM');
    const b = newGame('PHASE4K-RESTRICTED-DETERMINISM');
    const arng = SeededRandom.fromState(a.rngState);
    const brng = SeededRandom.fromState(b.rngState);
    for (let i = 0; i < 4; i++) {
      expect(announceWarning(a, arng)).toBe(announceWarning(b, brng));
      a.time += GAME_CONFIG.zoneWarningDuration;
      b.time += GAME_CONFIG.zoneWarningDuration;
      promoteWarnings(a);
      promoteWarnings(b);
    }
    expect(Object.fromEntries(Object.entries(a.zones).map(([id, z]) => [id, z.status]))).toEqual(
      Object.fromEntries(Object.entries(b.zones).map(([id, z]) => [id, z.status])),
    );

    a.time = GAME_CONFIG.finaleForcedTime;
    expect(advancePhase(a)).toBe(true);
    expect(a.phase).toBe('finale');
  });

  it.each([
    ['r_stick', 'melee'],
    ['r_simple_bow', 'ranged'],
    ['r_cloth_armor', 'armor'],
    ['r_bandage', 'healing'],
  ] as const)('recommends legal routes for the %s %s target', (recipeId, _kind) => {
    const state = newGame(`PHASE4K-CRAFT-${recipeId}`);
    const p = player(state);
    clearInventory(p);
    state.craftGoalRecipeId = recipeId;
    const recommendations = getCraftGoalRecommendations(state, p);
    expect(recommendations.length, recipeId).toBeGreaterThan(0);
    for (const recommendation of recommendations) {
      expect(ZONE_IDS).toContain(recommendation.zoneId);
      expect(getZoneDistance(p.currentZoneId, recommendation.zoneId)).toBeGreaterThanOrEqual(0);
      const def = getZoneDef(recommendation.zoneId);
      for (const itemId of recommendation.itemIds) {
        expect([...def.basePool, ...def.rarePool]).toContain(itemId);
      }
      const route = bfsRoute(p.currentZoneId, recommendation.zoneId);
      for (let i = 1; i < route.length; i++) expect(areAdjacent(route[i - 1]!, route[i]!)).toBe(true);
    }
  });

  it('uses one unified 12-zone spawn candidate pool for player and NPCs', () => {
    expect(SPAWN_ZONE_IDS).toEqual(ZONE_IDS);
    const playerZones = new Set<string>();
    const npcZones = new Set<string>();
    for (let i = 0; i < 1024; i++) {
      const state = newGame(`PHASE4K-SPAWN-${i}`);
      playerZones.add(player(state).currentZoneId);
      for (const npc of npcs(state)) npcZones.add(npc.currentZoneId);
    }
    expect([...playerZones].sort()).toEqual([...ZONE_IDS].sort());
    expect([...npcZones].sort()).toEqual([...ZONE_IDS].sort());

    const first = newGame('PHASE4K-SPAWN-DETERMINISTIC');
    const second = newGame('PHASE4K-SPAWN-DETERMINISTIC');
    expect(Object.fromEntries(Object.entries(first.characters).map(([id, c]) => [id, c.currentZoneId]))).toEqual(
      Object.fromEntries(Object.entries(second.characters).map(([id, c]) => [id, c.currentZoneId])),
    );
  });
});

describe('Phase 4K · save/load compatibility', () => {
  afterEach(() => setStorage(null));

  it('round-trips a player in a new zone and continues deterministically', () => {
    const storage = createMemoryStorage();
    setStorage(storage);
    const state = newGame('PHASE4K-SAVE-NEW-ZONE');
    setPlayerZone(state, 'underground');
    state.zones.underground!.status = 'warning';
    state.zones.park!.status = 'restricted';
    const before = structuredClone(state);
    expect(saveGame(state).ok).toBe(true);
    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.data.state).toEqual(before);
    expect(loaded.data.state.characters[state.playerId]!.currentZoneId).toBe('underground');
    expect(loaded.data.state.characters[state.playerId]!.inventory).toEqual(
      state.characters[state.playerId]!.inventory,
    );

    const target = getZoneDef('underground').adjacent.find((id) => id !== 'park')!;
    state.characters[state.playerId]!.stamina = state.characters[state.playerId]!.maxStamina;
    loaded.data.state.characters[loaded.data.state.playerId]!.stamina =
      loaded.data.state.characters[loaded.data.state.playerId]!.maxStamina;
    const direct = executeCommand(state, { type: 'MOVE', zoneId: target });
    const resumed = executeCommand(loaded.data.state, { type: 'MOVE', zoneId: target });
    expect(resumed.ok).toBe(direct.ok);
    expect(resumed.state.rngState).toBe(direct.state.rngState);
    expect(resumed.state.characters[resumed.state.playerId]!.currentZoneId).toBe(target);
    expect(resumed.state.characters).toEqual(direct.state.characters);
  });

  it('rejects a legacy six-zone save until pre-release compatibility work is scheduled', () => {
    const storage = createMemoryStorage();
    setStorage(storage);
    const state = newGame('PHASE4K-SAVE-LEGACY');
    for (const character of Object.values(state.characters)) character.currentZoneId = 'school';
    refreshZoneOccupants(state);
    const originalRngState = state.rngState;
    writeRawSave(storage, state, (raw) => {
      for (const id of NEW_ZONE_IDS) delete (raw.state.zones as Record<string, unknown>)[id];
    });
    const loaded = loadGame();
    expect(loaded.ok).toBe(false);
    expect(loaded.error).toContain('存档校验未通过');
    expect(originalRngState).toBe(state.rngState);
  });

  it.each([
    ['缺少一个新区', (raw: SaveData) => { delete (raw.state.zones as Record<string, unknown>).park; }, '缺少当前版本区域：park'],
    ['缺少多个但不是全部新区', (raw: SaveData) => {
      delete (raw.state.zones as Record<string, unknown>).park;
      delete (raw.state.zones as Record<string, unknown>).underground;
    }, '缺少当前版本区域：park'],
    ['legacy 六区加一个新区', (raw: SaveData) => {
      for (const id of NEW_ZONE_IDS) {
        if (id !== 'commercial') delete (raw.state.zones as Record<string, unknown>)[id];
      }
    }, '缺少当前版本区域：station'],
    ['完整当前存档加未知区域', (raw: SaveData) => {
      (raw.state.zones as Record<string, unknown>).unknown_zone = structuredClone(raw.state.zones.school);
    }, '存档包含未知区域：unknown_zone'],
    ['legacy 六区加未知区域', (raw: SaveData) => {
      for (const id of NEW_ZONE_IDS) delete (raw.state.zones as Record<string, unknown>)[id];
      (raw.state.zones as Record<string, unknown>).unknown_zone = structuredClone(raw.state.zones.school);
    }, '缺少当前版本区域：commercial'],
  ])('拒绝损坏或非 exact legacy 的存档：%s', (_label, mutate, errorText) => {
    const storage = createMemoryStorage();
    setStorage(storage);
    writeRawSave(storage, newGame(`PHASE4K-SAVE-CORRUPT-${_label}`), mutate);
    const loaded = loadGame();
    expect(loaded.ok).toBe(false);
    expect(loaded.error).toContain('存档校验未通过');
    expect(loaded.error).toContain(errorText);
  });

  it('legacy migration compatibility remains deferred and does not load an incomplete ecology', () => {
    const state = newGame('PHASE4K-SAVE-MIGRATION-DETERMINISTIC');
    for (const character of Object.values(state.characters)) character.currentZoneId = 'school';
    refreshZoneOccupants(state);
    const storageA = createMemoryStorage();
    const storageB = createMemoryStorage();
    const writeLegacy = (storage: StorageLike): number => {
      writeRawSave(storage, state, (raw) => {
        for (const id of NEW_ZONE_IDS) delete (raw.state.zones as Record<string, unknown>)[id];
      });
      const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as SaveData;
      return raw.state.rngState;
    };
    const originalRngState = writeLegacy(storageA);
    writeLegacy(storageB);

    setStorage(storageA);
    const a = loadGame();
    setStorage(storageB);
    const b = loadGame();
    expect(a.ok && b.ok).toBe(false);
    expect(a.ok ? null : a.error).toContain('存档校验未通过');
    expect(b.ok ? null : b.error).toContain('存档校验未通过');
    expect(originalRngState).toBe(state.rngState);
  });
});
