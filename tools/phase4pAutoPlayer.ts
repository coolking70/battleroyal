import { getZoneDef, ZONE_IDS } from '../src/data/zones';
import { createGame, getPlayer, refreshZoneOccupants } from '../src/core/gameState';
import { executeCommand } from '../src/core/gameEngine';
import { addItem, createStack } from '../src/core/inventory';
import { processApexSpawns } from '../src/core/apexSchedule';
import type { Command, GameState } from '../src/core/types';

export interface Phase4PAutoRouteResult {
  state: GameState;
  commandTypes: string[];
  illegalCommands: string[];
  route: string[];
}

function command(state: GameState, list: string[], illegal: string[], value: Command): GameState {
  const result = executeCommand(state, value);
  list.push(value.type);
  if (!result.ok) illegal.push(`${value.type}: ${result.message}`);
  return result.state;
}

/**
 * Deterministic representative route. The fixture seeds only base materials
 * and a legal scheduled Apex; the signature material is obtained exclusively
 * through SEARCH → canonical Wild combat → ground pickup.
 */
export function runPhase4PAutoRoute(seed = 'PHASE4P-APEX-ROUTE'): Phase4PAutoRouteResult {
  let state = createGame({ seed, playerCharacterId: 'fighter', playerName: 'Phase4P Auto' });
  const commands: string[] = [];
  const illegal: string[] = [];
  const route: string[] = [];
  const schedule = state.apexSchedule.find((entry) => entry.defId === 'prototype_aegis');
  if (!schedule) throw new Error('Phase4P AutoPlayer fixture missing prototype_aegis schedule');
  schedule.scheduledAt = 0;
  processApexSpawns(state);
  const apexUid = schedule.uid;
  if (!apexUid || !schedule.zoneId) throw new Error('Phase4P AutoPlayer fixture failed to spawn Aegis');

  const player = getPlayer(state);
  const adjacent = getZoneDef(schedule.zoneId).adjacent[0] ?? ZONE_IDS[0]!;
  player.currentZoneId = adjacent;
  player.hp = player.maxHp = 1000;
  player.stamina = player.maxStamina = 1000;
  player.attack = 200;
  player.inventory = [];
  player.equipment = [];
  player.equippedWeaponId = null;
  player.equippedArmorId = null;
  player.equippedUtilityId = null;
  // These are ordinary base resources prepared by the route fixture; no
  // Phase 4P signature is inserted and no DEBUG_GIVE_MATERIAL is used.
  addItem(player, createStack(state, 'iron', 1));
  addItem(player, createStack(state, 'scrap', 2));

  for (const npc of Object.values(state.characters)) if (!npc.isPlayer) npc.currentZoneId = adjacent;
  for (const zone of Object.values(state.zones)) zone.aliveCharacterIds = [];
  const targetZone = state.zones[schedule.zoneId]!;
  for (const zone of Object.values(state.zones)) zone.wildEnemyIds = [];
  for (const enemy of Object.values(state.wildEnemies)) {
    if (enemy.uid === apexUid) {
      enemy.zoneId = schedule.zoneId;
      targetZone.wildEnemyIds.push(enemy.uid);
    } else {
      enemy.zoneId = 'warehouse';
      state.zones.warehouse!.wildEnemyIds.push(enemy.uid);
    }
  }
  targetZone.loot = [];
  targetZone.objectiveLoot = [];
  targetZone.initialLootCount = 0;
  targetZone.remainingLootCount = 0;
  targetZone.supply = 0;
  refreshZoneOccupants(state);

  state = command(state, commands, illegal, { type: 'SET_CRAFT_GOAL', recipeId: 'r_aegis_plate' });
  route.push('SET_CRAFT_GOAL');
  state = command(state, commands, illegal, { type: 'MOVE', zoneId: schedule.zoneId });
  route.push('MOVE');
  state = command(state, commands, illegal, { type: 'SEARCH' });
  route.push('SEARCH');
  state = command(state, commands, illegal, { type: 'GUARD' });
  route.push('GUARD');
  for (let i = 0; i < 8 && state.wildEnemies[apexUid]?.status === 'alive'; i += 1) {
    state = command(state, commands, illegal, { type: 'ATTACK', targetId: apexUid, style: 'normal' });
    route.push('ATTACK');
  }
  state = command(state, commands, illegal, { type: 'CLOSE_ENCOUNTER' });
  const signature = state.zones[schedule.zoneId]!.groundItems.find((stack) => stack.itemId === 'aegis_core');
  if (!signature) throw new Error('Phase4P AutoPlayer route did not create Aegis signature ground loot');
  state = command(state, commands, illegal, { type: 'PICKUP_GROUND', uid: signature.uid });
  route.push('PICKUP_GROUND');
  for (const itemId of ['composite_plate', 'reinforced_servo']) {
    const stack = state.zones[schedule.zoneId]!.groundItems.find((item) => item.itemId === itemId);
    if (stack) state = command(state, commands, illegal, { type: 'PICKUP_GROUND', uid: stack.uid });
  }
  for (const recipeId of ['r_plate_armor', 'r_servo_housing', 'r_composite_chassis', 'r_aegis_plate']) {
    state = command(state, commands, illegal, { type: 'CRAFT', recipeId });
    route.push('CRAFT');
  }
  const output = state.characters[state.playerId]!.inventory.find((stack) => stack.itemId === 'aegis_plate');
  if (output) {
    state = command(state, commands, illegal, { type: 'EQUIP', uid: output.uid });
    route.push('EQUIP');
  }
  return { state, commandTypes: commands, illegalCommands: illegal, route };
}
