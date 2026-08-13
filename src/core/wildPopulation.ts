import { WILD_ECOLOGY, getWildEnemy } from '../data/wildEnemies';
import { ZONE_IDS } from '../data/zones';
import { SeededRandom } from './random';
import type { GameState, WildEnemyInstance } from './types';

export function livingWildEnemiesInZone(state: GameState, zoneId: string): WildEnemyInstance[] {
  return (state.zones[zoneId]?.wildEnemyIds ?? [])
    .map((uid) => state.wildEnemies[uid])
    .filter((enemy): enemy is WildEnemyInstance => enemy?.status === 'alive');
}

/** One deterministic, finite population pass. No respawn path exists. */
export function initializeWildPopulations(state: GameState): void {
  for (const zoneId of ZONE_IDS) {
    const zone = state.zones[zoneId];
    if (!zone) continue;
    zone.wildEnemyIds = [];
    const rng = new SeededRandom(`phase4n:${state.seed}:${zoneId}`);
    const count = rng.int(1, 4);
    const ecology = WILD_ECOLOGY[zoneId] ?? [];
    for (let index = 0; index < count; index += 1) {
      const defId = rng.pickWeighted(ecology.map((entry) => ({ value: entry.enemyId, weight: entry.weight }))) ?? ecology[0]?.enemyId;
      if (!defId) continue;
      const def = getWildEnemy(defId);
      const uid = `w${state.wildUidSeq}`;
      state.wildUidSeq += 1;
      state.wildEnemies[uid] = {
        uid, defId, zoneId, hp: def.maxHp, status: 'alive', guarding: false,
        abilityCharges: def.abilityId === 'none' ? 0 : 1,
        statusEffects: [], dropResolved: false, defeatedAtTime: null,
      };
      zone.wildEnemyIds.push(uid);
    }
  }
}
