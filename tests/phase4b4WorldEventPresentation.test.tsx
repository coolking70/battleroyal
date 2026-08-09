/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEvent, WorldEventState } from '../src/core/types';
import { StatusBar } from '../src/ui/components/StatusBar';
import { InstantWorldEventAnnouncement, WorldEventBanner } from '../src/ui/components/WorldEventFeedback';
import {
  latestInstantWorldEvent,
  sortWorldEvents,
  worldEventRemainingMeta,
} from '../src/ui/worldEventPresentation';
import {
  latestPlayerHazardFeedback,
  warningRemaining,
  zoneUrgencyMeta,
} from '../src/ui/zonePresentation';
import { createGame } from '../src/core/gameState';
import { getPlayer } from '../src/core/gameState';

let container: HTMLDivElement;
let root: Root;

function worldEvent(
  eventId: WorldEventState['eventId'],
  remaining: number,
  zoneId: string | null = null,
): WorldEventState {
  return {
    id: `we-${eventId}-${remaining}`,
    eventId,
    scope: zoneId ? 'zone' : 'global',
    zoneId,
    startedAtTime: 1,
    remaining,
    label: eventId,
    description: `${eventId} public description`,
  };
}

function event(overrides: Partial<GameEvent>): GameEvent {
  return {
    id: 'e1',
    type: 'WORLD_EVENT',
    time: 4,
    actorId: null,
    targetId: null,
    zoneId: null,
    message: '监控发现「医院」近期活动频繁。',
    importance: 'major',
    metadata: {
      worldEventId: 'emergency_broadcast',
      scope: 'global',
      instant: true,
      broadcastZoneId: 'hospital',
    },
    ...overrides,
  };
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
});

describe('Phase 4B-4 world event and restricted-zone presentation', () => {
  it('sorts direct threats first and distinguishes remaining-time urgency', () => {
    const sorted = sortWorldEvents([
      worldEvent('rain', 1),
      worldEvent('research_anomaly', 4, 'lab'),
      worldEvent('blackout', 2),
    ]);
    expect(sorted.map((item) => item.eventId)).toEqual([
      'research_anomaly',
      'blackout',
      'rain',
    ]);
    expect(worldEventRemainingMeta(1).label).toBe('即将结束');
    expect(worldEventRemainingMeta(2).label).toBe('临近结束');
    expect(worldEventRemainingMeta(4).label).toBe('持续中');
  });

  it('renders severity, scope, remaining time and non-color cues', () => {
    act(() => {
      root.render(<WorldEventBanner event={worldEvent('research_anomaly', 1, 'lab')} />);
    });
    expect(container.querySelector('[data-event-severity="critical"]')).not.toBeNull();
    expect(container.textContent).toContain('直接威胁');
    expect(container.textContent).toContain('区域 · 研究所');
    expect(container.textContent).toContain('即将结束');
    expect(container.textContent).toContain('☠');
    expect(container.querySelector('.event-banner-icon')).not.toBeNull();
  });

  it('shows an instant announcement and auto-hides it without blocking controls', () => {
    vi.useFakeTimers();
    const instant = event({ id: 'instant-1' });
    act(() => {
      root.render(<InstantWorldEventAnnouncement event={instant} />);
    });
    expect(container.querySelector('[data-world-event-announcement="true"]')).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    act(() => vi.advanceTimersByTime(4499));
    expect(container.querySelector('[data-world-event-announcement="true"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('[data-world-event-announcement="true"]')).toBeNull();
    expect(latestInstantWorldEvent([instant])?.id).toBe('instant-1');
  });

  it('distinguishes warning urgency and exposes only the player hazard feedback', () => {
    expect(warningRemaining(10, 11, 2)).toBe(1);
    expect(zoneUrgencyMeta(1)).toEqual({ urgency: 'imminent', label: '最后 1 回合', icon: '!' });
    const feedback = latestPlayerHazardFeedback(
      [
        {
          id: 'npc-damage',
          type: 'ZONE_DAMAGE',
          actorId: 'npc-1',
          time: 4,
          metadata: { damage: 20 },
        },
        {
          id: 'player-damage',
          type: 'ZONE_DAMAGE',
          actorId: 'p0',
          time: 4,
          metadata: { damage: 20 },
        },
      ],
      'p0',
      4,
    );
    expect(feedback).toMatchObject({ eventId: 'player-damage', source: '禁区侵蚀', damage: 20 });
  });

  it('renders warning countdown and restricted damage in the P0 status surface', () => {
    const state = createGame({ seed: 'PHASE4B4-STATUS', playerCharacterId: 'scout' });
    const player = getPlayer(state);
    const zone = state.zones[player.currentZoneId]!;
    zone.status = 'warning';
    zone.warningAtTime = state.time;
    act(() => {
      root.render(<StatusBar state={state} player={player} aliveCount={6} onQuit={() => undefined} />);
    });
    expect(container.querySelector('[data-zone-urgency="near"]')).not.toBeNull();
    expect(container.textContent).toContain('即将封锁');

    zone.status = 'restricted';
    state.events.push({
      id: 'zone-damage',
      type: 'ZONE_DAMAGE',
      time: state.time,
      actorId: player.id,
      targetId: null,
      zoneId: zone.id,
      message: '你受到禁区侵蚀。',
      importance: 'minor',
      metadata: { damage: 20, died: false },
    });
    act(() => {
      root.render(<StatusBar state={state} player={player} aliveCount={6} onQuit={() => undefined} />);
    });
    expect(container.querySelector('[data-zone-hazard-feedback="zone-damage"]')).not.toBeNull();
    expect(container.textContent).toContain('禁区侵蚀 −20 生命');
    expect(container.textContent).toContain('已是禁区');
  });
});
