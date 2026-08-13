/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGame, getPlayer } from '../src/core/gameState';
import type { GameEvent, WildEnemyInstance } from '../src/core/types';
import { wildCombatProfile } from '../src/core/wildCombat';
import { getWildEnemy } from '../src/data/wildEnemies';
import { EncounterHero } from '../src/ui/components/EncounterHero';
import { visibleEventsForPlayer } from '../src/ui/components/EventLog';
import { ZoneMap } from '../src/ui/components/ZoneMap';

let root: Root;
let container: HTMLDivElement;

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

function firstWild(state: ReturnType<typeof createGame>): WildEnemyInstance {
  const enemy = Object.values(state.wildEnemies)[0];
  if (!enemy) throw new Error('测试世界缺少野外敌人');
  return enemy;
}

function wildEvent(id: string, actorId: string | null, targetId: string | null): GameEvent {
  return {
    id,
    type: 'WILD_ATTACK',
    time: 1,
    actorId,
    targetId,
    zoneId: 'school',
    message: `${id} message`,
    importance: 'minor',
    metadata: { wildUid: 'w0', wildDefId: 'feral_dog' },
  };
}

describe('Phase 4N · PvE presentation and information boundary', () => {
  it('shows the current wild target with exact HP, threat, category, and emoji fallback without rates', () => {
    const state = createGame({ seed: 'PHASE4N-UI-ENCOUNTER', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    const wild = firstWild(state);
    const def = getWildEnemy(wild.defId);
    player.currentZoneId = wild.zoneId;

    act(() => root.render(
      <EncounterHero
        encounter={{ enemyId: wild.uid, targetKind: 'wild', zoneId: wild.zoneId, startedAtTime: 0, log: [], resolved: false }}
        player={player}
        enemy={wildCombatProfile(wild)}
        wildEnemy={wild}
        combat={null}
      />,
    ));

    expect(container.textContent).toContain(def.name);
    expect(container.textContent).toContain(`${wild.hp} / ${def.maxHp}`);
    expect(container.textContent).toContain(`威胁：${def.threat}`);
    expect(container.textContent).toContain(`掉落类别：${def.dropCategory}`);
    expect(container.querySelector('.encounter-enemy-visual')?.textContent).toContain(def.fallbackEmoji);
    expect(container.textContent).not.toMatch(/(?:概率|掉率|0\.\d+|\d+%)/);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders only static common threats on the map, independent of live population ids', () => {
    const state = createGame({ seed: 'PHASE4N-UI-MAP', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);

    act(() => root.render(<ZoneMap state={state} player={player} disabled={false} onMove={() => undefined} />));
    const before = container.textContent;
    expect(before).toContain('常见威胁：');
    expect(before).toContain('野化猎犬');

    for (const zone of Object.values(state.zones)) zone.wildEnemyIds = [];
    state.wildEnemies = {};
    act(() => root.render(<ZoneMap state={state} player={player} disabled={false} onMove={() => undefined} />));
    expect(container.textContent).toBe(before);
    expect(container.textContent).not.toMatch(/w\d+|剩余\s*\d+|种群\s*\d+/);
  });

  it('projects only player-relevant wild events to the default event log', () => {
    const events = [
      wildEvent('remote-wild', 'npc-1', 'npc-2'),
      wildEvent('hits-player', null, 'p0'),
      wildEvent('player-hits', 'p0', null),
      { ...wildEvent('own-drop', 'p0', null), type: 'WILD_DROP_CREATED' as const },
      { ...wildEvent('remote-drop', 'npc-1', null), type: 'WILD_DROP_CREATED' as const },
    ];
    expect(visibleEventsForPlayer(events, 'p0').map((event) => event.id)).toEqual([
      'hits-player',
      'player-hits',
      'own-drop',
    ]);
  });
});
