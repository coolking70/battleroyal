/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GameEvent, GameEventType, WildEnemyInstance } from '../src/core/types';
import { wildCombatProfile } from '../src/core/wildCombat';
import { ALL_WILD_ENEMIES } from '../src/data/wildEnemies';
import { EncounterHero } from '../src/ui/components/EncounterHero';
import { visibleEventsForPlayer } from '../src/ui/components/EventLog';
import { buildEncounterPresentation } from '../src/ui/encounterPresentation';
import { newGame, npcs, player } from './helpers';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function event(
  id: string,
  type: GameEventType,
  actorId: string | null,
  targetId: string | null,
  metadata: GameEvent['metadata'] = {},
  message = `${id} message`,
): GameEvent {
  return {
    id,
    type,
    time: 3,
    actorId,
    targetId,
    zoneId: 'school',
    message,
    importance: 'minor',
    metadata,
  };
}

describe('Phase 4V · encounter presentation beats', () => {
  it('projects hit, miss, exposed, guard and escape with stable styles', () => {
    const state = newGame('PHASE4V-BEATS');
    const self = player(state);
    const enemy = npcs(state)[0]!;
    self.currentZoneId = 'school';
    enemy.currentZoneId = 'school';
    const encounter = { enemyId: enemy.id, zoneId: 'school', startedAtTime: 2, log: [], resolved: true };
    const events = [
      event('start', 'ENCOUNTER_STARTED', self.id, enemy.id),
      event('hit', 'ATTACK_HIT', self.id, enemy.id, { style: 'quick', damage: 4, remainingHp: 37 }),
      event('miss', 'ATTACK_MISSED', self.id, enemy.id, { style: 'heavy', exposed: true }),
      event('guard', 'GUARD', self.id, null, { guarding: true }),
      event('escape', 'CHARACTER_ESCAPED', self.id, enemy.id, { success: true }),
    ];

    const view = buildEncounterPresentation({
      encounter,
      player: self,
      enemy,
      currentTime: 5,
      zoneName: '废弃学校',
      visibleEvents: visibleEventsForPlayer(events, self.id),
    });

    expect(view.beats.map((beat) => beat.kind)).toEqual(['miss', 'exposed', 'guard', 'escape', 'resolved']);
    expect(view.beats[0]).toMatchObject({ style: 'heavy', title: expect.stringContaining('HEAVY MISS') });
    expect(view.beats[1]!.title).toContain('EXPOSED');
    expect(view.beats[2]!.title).toContain('GUARD');
    expect(view.beats[3]!.title).toContain('成功脱离');
    expect(view.latest.kind).toBe('resolved');
  });

  it('never projects contestant remainingHp even when ATTACK_HIT metadata contains it', () => {
    const state = newGame('PHASE4V-HP-BOUNDARY');
    const self = player(state);
    const enemy = npcs(state)[0]!;
    self.currentZoneId = 'school';
    enemy.currentZoneId = 'school';
    enemy.hp = 37;
    const encounter = { enemyId: enemy.id, zoneId: 'school', startedAtTime: 2, log: [], resolved: false };
    const events = [event(
      'hit-private-hp',
      'ATTACK_HIT',
      self.id,
      enemy.id,
      { style: 'normal', damage: 4, remainingHp: 37 },
      `${self.name} 命中 ${enemy.name}，remainingHp=37。`,
    )];
    const presentation = buildEncounterPresentation({
      encounter,
      player: self,
      enemy,
      currentTime: 4,
      zoneName: '废弃学校',
      visibleEvents: visibleEventsForPlayer(events, self.id),
    });

    expect(JSON.stringify(presentation)).not.toContain('remainingHp');
    expect(JSON.stringify(presentation)).not.toContain('37');

    act(() => root.render(
      <EncounterHero encounter={encounter} player={self} enemy={enemy} combat={null} presentation={presentation} />,
    ));
    expect(container.textContent).not.toContain('37');
    expect(container.textContent).toContain('生命状态');
  });

  it('ignores hidden NPC_ACTION, strategic metadata and remote combat/inventory changes', () => {
    const state = newGame('PHASE4V-HIDDEN');
    const self = player(state);
    const [enemy, remote] = npcs(state);
    self.currentZoneId = 'school';
    enemy!.currentZoneId = 'school';
    remote!.currentZoneId = 'hospital';
    const encounter = { enemyId: enemy!.id, zoneId: 'school', startedAtTime: 2, log: [], resolved: false };
    const localHit = event('local-hit', 'ATTACK_HIT', self.id, enemy!.id, { style: 'quick', damage: 2, remainingHp: 19 });
    const hiddenAction = event(
      'hidden-plan',
      'NPC_ACTION',
      remote!.id,
      null,
      { strategicIntent: 'ambush', memory: 'player@hospital', inventory: 'secret-medkit' },
      'NPC_ACTION debug: exact remote HP 41 and hidden inventory',
    );
    const hiddenEnemyGuard = event('hidden-enemy-guard', 'GUARD', enemy!.id, null, { guarding: true });
    const remoteHit = { ...event('remote-hit', 'ATTACK_HIT', remote!.id, npcs(state)[2]!.id, { remainingHp: 11 }), zoneId: 'hospital' };

    const build = (events: GameEvent[]) => buildEncounterPresentation({
      encounter,
      player: self,
      enemy: enemy!,
      currentTime: 4,
      zoneName: '废弃学校',
      // Deliberately pass the raw history: the projection must re-enforce visibility.
      visibleEvents: events,
    });
    const before = build([localHit]);
    remote!.hp = 1;
    remote!.inventory = [];
    remote!.personality = 'aggressive';
    const after = build([localHit, hiddenAction, hiddenEnemyGuard, remoteHit]);

    expect(after).toEqual(before);
    expect(JSON.stringify(after)).not.toMatch(/ambush|memory|inventory|remote HP|strategicIntent/);
  });

  it('freezes a resolved contestant view after the opponent leaves the local encounter', () => {
    const state = newGame('PHASE4V-AF1-REMOTE-RUNTIME');
    const self = player(state);
    const originalEnemy = npcs(state)[0]!;
    self.currentZoneId = 'school';
    const encounter = {
      enemyId: originalEnemy.id,
      zoneId: 'school',
      startedAtTime: 2,
      log: [],
      resolved: true,
    };
    const visible = visibleEventsForPlayer([
      event(
        'confirmed-opponent-escape',
        'CHARACTER_ESCAPED',
        originalEnemy.id,
        self.id,
        { success: true },
        '对手成功脱离接触。',
      ),
    ], self.id);

    const enemyA = structuredClone(originalEnemy);
    enemyA.currentZoneId = 'hospital';
    enemyA.hp = Math.max(1, enemyA.maxHp - 3);
    enemyA.guarding = false;
    enemyA.statusEffects = [];
    enemyA.equipment = [{ uid: 'world-a-weapon', itemId: 'stick', count: 1, durability: 20 }];
    enemyA.equippedWeaponId = 'world-a-weapon';
    enemyA.inventory = [{ uid: 'world-a-secret', itemId: 'bandage', count: 4 }];

    const enemyB = structuredClone(originalEnemy);
    enemyB.currentZoneId = 'factory';
    enemyB.alive = false;
    enemyB.maxHp += 40;
    enemyB.hp = 1;
    enemyB.guarding = true;
    enemyB.statusEffects = [{
      id: 'exposed',
      remaining: 2,
      hpPerTick: 0,
      label: '露出破绽',
      damageTakenMult: 1.2,
    }];
    enemyB.equipment = [{ uid: 'world-b-weapon', itemId: 'stone_axe', count: 1, durability: 22 }];
    enemyB.equippedWeaponId = 'world-b-weapon';
    enemyB.inventory = [{ uid: 'world-b-secret', itemId: 'energy_drink', count: 5 }];

    const build = (enemy: typeof enemyA) => buildEncounterPresentation({
      encounter,
      player: self,
      enemy,
      currentTime: 5,
      zoneName: '废弃学校',
      visibleEvents: visible,
    });
    const presentationA = build(enemyA);
    const presentationB = build(enemyB);

    expect(presentationA).toEqual(presentationB);

    act(() => root.render(
      <EncounterHero encounter={encounter} player={self} enemy={enemyA} combat={null} presentation={presentationA} />,
    ));
    const outputA = container.textContent;
    expect(container.querySelector('.eh-hp')).toBeNull();
    expect(container.querySelector('.eh-weapon')).toBeNull();

    act(() => root.render(
      <EncounterHero encounter={encounter} player={self} enemy={enemyB} combat={null} presentation={presentationB} />,
    ));
    const outputB = container.textContent;

    expect(outputB).toBe(outputA);
    expect(outputB).toContain('对手已脱离，本次交战状态不再更新');
    expect(outputB).toContain('对手成功脱离接触');
    expect(outputB).not.toMatch(/GUARD|EXPOSED|木棍|石斧|hospital|factory/);
    expect(container.querySelector('.eh-hp')).toBeNull();
    expect(container.querySelector('.eh-weapon')).toBeNull();
    expect(container.querySelector('[data-live-opponent-state="hidden"]')).not.toBeNull();
  });

  it('keeps Wild telegraph public and renders resolved defeat/loot without a blocking continue button', () => {
    const state = newGame('PHASE4V-WILD');
    const self = player(state);
    const def = ALL_WILD_ENEMIES.find((candidate) => candidate.specialAbilityId !== 'none')!;
    const wild: WildEnemyInstance = {
      uid: 'phase4v-wild',
      defId: def.id,
      zoneId: 'school',
      hp: 0,
      status: 'defeated',
      guarding: false,
      abilityCharges: 0,
      statusEffects: [],
      pendingIntent: null,
      dropResolved: true,
      defeatedAtTime: 4,
    };
    self.currentZoneId = 'school';
    const enemy = wildCombatProfile(wild);
    const encounter = { enemyId: wild.uid, targetKind: 'wild' as const, zoneId: 'school', startedAtTime: 2, log: [], resolved: true };
    const telegraph = event('telegraph', 'WILD_ATTACK', null, self.id, {
      wildUid: wild.uid,
      wildDefId: wild.defId,
      action: 'telegraph',
      specialAbility: def.specialAbilityId,
    }, `${def.name} 正在蓄力。`);
    const defeated = event('wild-defeat', 'WILD_DEFEATED', self.id, null, { wildUid: wild.uid, wildDefId: wild.defId });
    const drop = event('wild-drop', 'WILD_DROP_CREATED', self.id, null, { wildUid: wild.uid, wildDefId: wild.defId, itemId: def.signatureDropItemId ?? 'scrap', count: 1 }, '目标留下了可拾取物资。');
    const presentation = buildEncounterPresentation({
      encounter,
      player: self,
      enemy,
      wildEnemy: wild,
      currentTime: 5,
      zoneName: '废弃学校',
      visibleEvents: visibleEventsForPlayer([telegraph, defeated, drop], self.id),
      lootAvailable: true,
    });

    expect(presentation.beats.map((beat) => beat.kind)).toEqual(['start', 'telegraph', 'defeat', 'loot', 'resolved']);
    expect(presentation.beats[1]!.detail).toContain('蓄力');

    act(() => root.render(
      <EncounterHero encounter={encounter} player={self} enemy={enemy} wildEnemy={wild} combat={null} lootAvailable presentation={presentation} />,
    ));
    expect(container.textContent).toContain('野外目标被击败');
    expect(container.textContent).toContain('可拾取');
    expect([...container.querySelectorAll('button')].some((button) => button.textContent?.includes('继续探索'))).toBe(false);
  });

  it('is deterministic for the same visible history and local state', () => {
    const state = newGame('PHASE4V-DETERMINISTIC');
    const self = player(state);
    const enemy = npcs(state)[0]!;
    self.currentZoneId = 'school';
    enemy.currentZoneId = 'school';
    enemy.guarding = true;
    const encounter = { enemyId: enemy.id, zoneId: 'school', startedAtTime: 2, log: [], resolved: false, reconInitiative: true };
    const visible = visibleEventsForPlayer([
      event('start', 'ENCOUNTER_STARTED', self.id, enemy.id),
      event('enemy-miss', 'ATTACK_MISSED', enemy.id, self.id, { style: 'normal' }),
    ], self.id);
    const input = { encounter, player: self, enemy, currentTime: 6, zoneName: '废弃学校', visibleEvents: visible };

    expect(buildEncounterPresentation(input)).toEqual(buildEncounterPresentation(input));
  });
});
