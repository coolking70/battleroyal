import { WILD_DROP_TABLES, ALL_WILD_ENEMIES, commonZonesForEnemy, getWildEnemy } from '../data/wildEnemies';
import { ZONES } from '../data/zones';
import type { GameState } from './types';

export type WorldSource =
  | { kind: 'zone_loot'; zoneIds: string[] }
  | { kind: 'wild_drop'; enemyIds: string[]; zoneIds: string[] };

function openZoneIds(state: GameState, zoneIds: readonly string[]): string[] {
  return zoneIds.filter((zoneId) => state.zones[zoneId]?.status !== 'restricted');
}

function apexSourceZones(state: GameState, enemyId: string): string[] {
  const def = getWildEnemy(enemyId);
  const eligibleZones = def.eligibleZones ?? [];
  const entry = state.apexSchedule.find((candidate) => candidate.defId === enemyId);
  if (!entry || !entry.spawned) return openZoneIds(state, eligibleZones);
  if (!entry.uid || !entry.zoneId) return [];

  const instance = state.wildEnemies[entry.uid];
  const defeated = instance?.status === 'defeated' || state.events.some((event) =>
    event.type === 'WILD_DEFEATED' && event.metadata.wildUid === entry.uid,
  );
  if (defeated) return [];
  return openZoneIds(state, [entry.zoneId]);
}

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

/**
 * Resolve current public acquisition sources without changing static provenance.
 * Common/Elite Wild sources remain ecology-wide; a named Apex is potential-zone
 * sourced before spawn, collapses to its public spawned zone after spawn, and
 * disappears as a future source after its one-shot instance is defeated.
 */
export function currentWorldSourcesForItem(state: GameState, itemId: string): WorldSource[] {
  const staticSources = worldSourcesForItem(itemId);
  const sources: WorldSource[] = [];
  const staticZoneSource = staticSources.find((source) => source.kind === 'zone_loot');
  const zoneIds = staticZoneSource ? openZoneIds(state, staticZoneSource.zoneIds) : [];
  if (zoneIds.length > 0) sources.push({ kind: 'zone_loot', zoneIds });

  const staticWildSource = staticSources.find((source) => source.kind === 'wild_drop');
  if (!staticWildSource) return sources;
  const enemyIds: string[] = [];
  const wildZoneIds: string[] = [];
  for (const enemyId of staticWildSource.enemyIds) {
    const def = getWildEnemy(enemyId);
    const sourceZones = def.tier === 'apex'
      ? apexSourceZones(state, enemyId)
      : openZoneIds(state, commonZonesForEnemy(enemyId));
    if (sourceZones.length === 0) continue;
    enemyIds.push(enemyId);
    for (const zoneId of sourceZones) if (!wildZoneIds.includes(zoneId)) wildZoneIds.push(zoneId);
  }
  if (enemyIds.length > 0) sources.push({ kind: 'wild_drop', enemyIds, zoneIds: wildZoneIds });
  return sources;
}

export function currentSourceZonesForItem(state: GameState, itemId: string): string[] {
  return currentWorldSourcesForItem(state, itemId)
    .flatMap((source) => source.zoneIds)
    .filter((zoneId, index, all) => all.indexOf(zoneId) === index);
}

export function validateRawWorldSources(itemIds: readonly string[]): string[] {
  return itemIds
    .filter((itemId) => worldSourcesForItem(itemId).length === 0)
    .map((itemId) => `raw 叶子 ${itemId} 没有区域或野外掉落来源`)
    .sort();
}
