import { APEX_WILD_ENEMY_IDS, getWildEnemy } from '../data/wildEnemies';
import { getZoneDef } from '../data/zones';
import { pushEvent } from './events';
import { SeededRandom } from './random';
import type { GameState } from './types';

/** Create one immutable-in-order schedule per named Apex. */
export function initializeApexSchedule(state: GameState): void {
  const rng = new SeededRandom(`phase4p:apex-schedule:${state.seed}`);
  state.apexSchedule = rng.shuffle(APEX_WILD_ENEMY_IDS).map((defId, index) => ({
    defId,
    // Midgame / late-midgame windows stay out of the historical opening
    // routes while remaining well before the 180-tick hard limit.
    scheduledAt: 60 + index * 18 + rng.int(0, 4),
    spawned: false,
    spawnedAt: null,
    uid: null,
    zoneId: null,
  }));
}

function chooseSpawnZone(state: GameState, defId: string): string | null {
  const def = getWildEnemy(defId);
  const eligible = [...(def.eligibleZones ?? [])].filter((zoneId) => Boolean(state.zones[zoneId]));
  const openEligible = eligible.filter((zoneId) => state.zones[zoneId]?.status !== 'restricted');
  // Apexes never fall back to an unrelated open zone.  A due entry remains
  // unspawned while every legal zone is restricted and is retried on a later
  // tick, so opening one eligible zone is sufficient to release the spawn.
  if (openEligible.length === 0) return null;
  return new SeededRandom(`phase4p:spawn-zone:${state.seed}:${defId}`).pick(openEligible) ?? openEligible[0]!;
}

/** Idempotent scheduled spawn. It only mutates a due, unspawned entry. */
export function processApexSpawns(state: GameState): void {
  if (state.status !== 'playing') return;
  for (const entry of state.apexSchedule) {
    if (entry.spawned || state.time < entry.scheduledAt) continue;
    const def = getWildEnemy(entry.defId);
    const zoneId = chooseSpawnZone(state, entry.defId);
    if (!zoneId) continue;
    const zone = state.zones[zoneId];
    if (!zone) continue;
    const uid = `w${state.wildUidSeq}`;
    state.wildUidSeq += 1;
    state.wildEnemies[uid] = {
      uid, defId: def.id, zoneId, hp: def.maxHp, status: 'alive', guarding: false,
      abilityCharges: 2, statusEffects: [], pendingIntent: null,
      dropResolved: false, defeatedAtTime: null,
    };
    zone.wildEnemyIds.push(uid);
    entry.spawned = true;
    entry.spawnedAt = state.time;
    entry.uid = uid;
    entry.zoneId = zoneId;
    state.stats.apexSpawnedCount = (state.stats.apexSpawnedCount ?? 0) + 1;
    pushEvent(state, {
      type: 'APEX_SPAWNED', zoneId,
      message: `公开播报：${def.name} 出现在${getZoneDef(zoneId).name}。`,
      metadata: { wildDefId: def.id, tier: 'apex', zoneId },
    });
  }
}

/** Public projection intentionally excludes UID, HP, status, and loot. */
export function publicApexReports(state: GameState): Array<{ defId: string; name: string; zoneId: string; spawnedAt: number }> {
  return state.apexSchedule
    .filter((entry) => entry.spawned && entry.zoneId !== null && entry.spawnedAt !== null)
    .map((entry) => ({ defId: entry.defId, name: getWildEnemy(entry.defId).name, zoneId: entry.zoneId!, spawnedAt: entry.spawnedAt! }));
}
