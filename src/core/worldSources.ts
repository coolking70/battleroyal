import { WILD_DROP_TABLES, ALL_WILD_ENEMIES, commonZonesForEnemy } from '../data/wildEnemies';
import { ZONES } from '../data/zones';
import type { GameState } from './types';

export type WorldSource =
  | { kind: 'zone_loot'; zoneIds: string[] }
  | { kind: 'wild_drop'; enemyIds: string[]; zoneIds: string[] };

/** Static public provenance only: never reads population, HP or drop odds. */
export function worldSourcesForItem(itemId: string, state?: GameState): WorldSource[] {
  const available = (zoneId: string): boolean => state?.zones[zoneId]?.status !== 'restricted';
  const zoneIds = ZONES
    .filter((zone) => zone.basePool.includes(itemId) || zone.rarePool.includes(itemId) || zone.objectivePool?.includes(itemId))
    .map((zone) => zone.id)
    .filter(available);
  const tableIds = new Set(WILD_DROP_TABLES.filter((table) => table.entries.some((entry) => entry.itemId === itemId)).map((table) => table.id));
  const enemyIds = ALL_WILD_ENEMIES.filter((enemy) => tableIds.has(enemy.dropTableId)).map((enemy) => enemy.id);
  const wildZoneIds = enemyIds
    .flatMap(commonZonesForEnemy)
    .filter((zoneId, index, all) => all.indexOf(zoneId) === index)
    .filter(available);
  const sources: WorldSource[] = [];
  if (zoneIds.length > 0) sources.push({ kind: 'zone_loot', zoneIds });
  if (enemyIds.length > 0) sources.push({ kind: 'wild_drop', enemyIds, zoneIds: wildZoneIds });
  return sources;
}

export function validateRawWorldSources(itemIds: readonly string[]): string[] {
  return itemIds
    .filter((itemId) => worldSourcesForItem(itemId).length === 0)
    .map((itemId) => `raw 叶子 ${itemId} 没有区域或野外掉落来源`)
    .sort();
}
