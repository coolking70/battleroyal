import { describe, expect, it } from 'vitest';
import { getWildEnemy } from '../src/data/wildEnemies';
import { refreshZoneOccupants } from '../src/core/gameState';
import { pushEvent } from '../src/core/events';
import { processApexSpawns } from '../src/core/apexSchedule';
import { attackWildActor, startWildEncounter } from '../src/core/wildCombat';
import { buildCraftPlan } from '../src/core/craftPlan';
import { hasPlannedWildSourceHere } from '../src/core/npcWildHunt';
import { currentSourceZonesForItem, currentWorldSourcesForItem } from '../src/core/worldSources';
import { visibleEventsForPlayer } from '../src/ui/components/EventLog';
import { SeededRandom } from '../src/core/random';
import type { GameEvent, GameState, WildEnemyInstance } from '../src/core/types';
import { newGame, npcs, player } from './helpers';

function spawnApex(state: GameState, defId: string): WildEnemyInstance {
  const entry = state.apexSchedule.find((candidate) => candidate.defId === defId)!;
  entry.scheduledAt = 0;
  state.time = 0;
  processApexSpawns(state);
  if (!entry.uid) throw new Error(`Apex ${defId} did not spawn`);
  return state.wildEnemies[entry.uid]!;
}

function defeatWithCanonicalCombat(state: GameState, enemy: WildEnemyInstance): void {
  const actor = player(state);
  actor.currentZoneId = enemy.zoneId;
  actor.attack = 1000;
  actor.stamina = actor.maxStamina = 1000;
  enemy.hp = 1;
  refreshZoneOccupants(state);
  startWildEncounter(state, actor, enemy);
  expect(attackWildActor(state, actor, enemy.uid, new SeededRandom('PHASE4P-AF3-CANONICAL'))
    .enemyDefeated).toBe(true);
}

function lifecycleEvent(state: GameState, type: 'WILD_DEFEATED' | 'APEX_DEFEATED', defId: string, zoneId: string, uid: string): void {
  pushEvent(state, {
    type,
    actorId: type === 'WILD_DEFEATED' ? state.playerId : null,
    zoneId,
    message: type === 'WILD_DEFEATED' ? '战斗事实' : '公共广播：命名威胁已被消灭。',
    metadata: type === 'WILD_DEFEATED'
      ? { wildUid: uid, wildDefId: defId, tier: 'apex' }
      : { wildDefId: defId, tier: 'apex', zoneId },
  });
}

describe('Phase 4P-AF3 public Apex lifecycle and planner boundary', () => {
  it('does not let hidden runtime defeat status close a remote Apex source', () => {
    const state = newGame('PHASE4P-AF3-HIDDEN-STATUS');
    const enemy = spawnApex(state, 'prototype_aegis');
    const entry = state.apexSchedule.find((candidate) => candidate.defId === 'prototype_aegis')!;
    expect(currentSourceZonesForItem(state, 'aegis_core')).toEqual([entry.zoneId]);

    const hiddenDefeat = structuredClone(state);
    hiddenDefeat.wildEnemies[enemy.uid]!.status = 'defeated';
    hiddenDefeat.wildEnemies[enemy.uid]!.hp = 0;
    expect(currentSourceZonesForItem(hiddenDefeat, 'aegis_core')).toEqual([entry.zoneId]);
  });

  it('does not let hidden WILD_DEFEATED alone close a remote Apex source', () => {
    const state = newGame('PHASE4P-AF3-HIDDEN-EVENT');
    const enemy = spawnApex(state, 'prototype_aegis');
    const entry = state.apexSchedule.find((candidate) => candidate.defId === 'prototype_aegis')!;
    const hiddenDefeat = structuredClone(state);
    lifecycleEvent(hiddenDefeat, 'WILD_DEFEATED', 'prototype_aegis', enemy.zoneId, enemy.uid);
    expect(currentSourceZonesForItem(hiddenDefeat, 'aegis_core')).toEqual([entry.zoneId]);
  });

  it('closes the current source only after the public APEX_DEFEATED lifecycle event', () => {
    const state = newGame('PHASE4P-AF3-PUBLIC-CLOSE');
    const enemy = spawnApex(state, 'prototype_aegis');
    const npc = npcs(state)[0]!;
    npc.plannedRecipeId = 'r_aegis_plate';
    npc.currentZoneId = enemy.zoneId;
    const plan = buildCraftPlan(state, npc, 'r_aegis_plate');
    expect(hasPlannedWildSourceHere(state, npc, plan)).toBe(true);

    lifecycleEvent(state, 'APEX_DEFEATED', 'prototype_aegis', enemy.zoneId, enemy.uid);
    expect(currentSourceZonesForItem(state, 'aegis_core')).toEqual([]);
    expect(currentWorldSourcesForItem(state, 'aegis_core')).toEqual([]);
    expect(plan?.rawGaps.find((gap) => gap.itemId === 'aegis_core')?.sourceZoneIds).toEqual(['factory', 'station', 'warehouse']);
  });

  it('publishes one minimal Apex lifecycle event in canonical defeat order', () => {
    const state = newGame('PHASE4P-AF3-CANONICAL');
    const enemy = spawnApex(state, 'prototype_aegis');
    defeatWithCanonicalCombat(state, enemy);
    const relevant = state.events.filter((event) =>
      event.metadata.wildDefId === 'prototype_aegis' &&
      (event.type !== 'WILD_DROP_CREATED' || event.metadata.itemId === 'aegis_core') &&
      ['WILD_DEFEATED', 'APEX_DEFEATED', 'WILD_DROP_CREATED'].includes(event.type),
    );
    expect(relevant.map((event) => event.type)).toEqual([
      'WILD_DEFEATED', 'APEX_DEFEATED', 'WILD_DROP_CREATED',
    ]);
    expect(state.events.filter((event) => event.type === 'APEX_DEFEATED')).toHaveLength(1);
    const publicEvent = state.events.find((event) => event.type === 'APEX_DEFEATED')!;
    expect(publicEvent.actorId).toBeNull();
    expect(publicEvent.metadata).toEqual({
      wildDefId: 'prototype_aegis',
      tier: 'apex',
      zoneId: enemy.zoneId,
    });
    for (const forbidden of ['wildUid', 'itemId', 'count', 'hp', 'damage', 'pendingIntent', 'abilityCharges', 'killerInventory', 'groundItemUid']) {
      expect(Object.prototype.hasOwnProperty.call(publicEvent.metadata, forbidden)).toBe(false);
    }
    expect(state.events.filter((event) => event.type === 'WILD_DROP_CREATED' && event.metadata.itemId === 'aegis_core')).toHaveLength(1);
  });

  it('does not publish APEX_DEFEATED for Common or Elite Wild defeats', () => {
    for (const [index, tier] of (['common', 'elite'] as const).entries()) {
      const state = newGame(`PHASE4P-AF3-NON-APEX-${index}`);
      const enemy = Object.values(state.wildEnemies).find((candidate) => getWildEnemy(candidate.defId).tier === tier);
      if (!enemy) throw new Error(`missing ${tier} fixture`);
      defeatWithCanonicalCombat(state, enemy);
      expect(state.events.some((event) => event.type === 'APEX_DEFEATED')).toBe(false);
      expect(state.events.filter((event) => event.type === 'WILD_DEFEATED')).toHaveLength(1);
    }
  });

  it('keeps WILD_DEFEATED combat-local while exposing APEX_DEFEATED in the public EventLog', () => {
    const remoteWild: GameEvent = {
      id: 'remote-wild',
      type: 'WILD_DEFEATED',
      time: 3,
      actorId: 'npc-1',
      targetId: null,
      zoneId: 'station',
      message: '远处 NPC 击败了原型 Aegis。',
      importance: 'major',
      metadata: { wildUid: 'w99', wildDefId: 'prototype_aegis', tier: 'apex' },
    };
    const publicApex: GameEvent = {
      id: 'public-apex',
      type: 'APEX_DEFEATED',
      time: 3,
      actorId: null,
      targetId: null,
      zoneId: 'station',
      message: '公共广播：位于车站的命名威胁「原型 Aegis」已被消灭。',
      importance: 'critical',
      metadata: { wildDefId: 'prototype_aegis', tier: 'apex', zoneId: 'station' },
    };
    const visible = visibleEventsForPlayer([remoteWild, publicApex], 'p0');
    expect(visible.map((event) => event.id)).toEqual(['public-apex']);
    expect(visible[0]!.message).not.toContain('掉落');
    expect(visible[0]!.message).not.toContain('UID');
  });
});
