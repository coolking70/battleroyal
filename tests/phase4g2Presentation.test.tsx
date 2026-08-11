/** @vitest-environment jsdom */

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { createGame, getPlayer } from '../src/core/gameState';
import { createStack } from '../src/core/inventory';
import { canAccessGroundItem, getLegalPlayerCommands } from '../src/core/legalActions';
import { GameScreen } from '../src/ui/screens/GameScreen';
import type { GameEvent, GameState, WorldEventState } from '../src/core/types';

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

function render(state: GameState): void {
  act(() => {
    root.render(
      <GameScreen
        state={state}
        player={getPlayer(state)}
        dispatch={() => undefined}
        onQuit={() => undefined}
      />,
    );
  });
}

function deathEvent(state: GameState, targetId: string): GameEvent {
  return {
    id: 'phase4g2-death',
    type: 'CHARACTER_DIED',
    time: state.time,
    actorId: state.playerId,
    targetId,
    zoneId: getPlayer(state).currentZoneId,
    message: '铜环 被 你 击杀。',
    importance: 'critical',
    metadata: { cause: '战斗', killerId: state.playerId, dropCount: 3 },
  };
}

function worldEvent(
  id: string,
  eventId: WorldEventState['eventId'],
  remaining: number,
  zoneId: string | null,
): WorldEventState {
  return {
    id,
    eventId,
    scope: zoneId ? 'zone' : 'global',
    zoneId,
    startedAtTime: 1,
    remaining,
    label: eventId === 'research_anomaly' ? '研究异常' : '连绵阴雨',
    description: eventId === 'research_anomaly' ? '研究所设施失控。' : '全城降雨。',
  };
}

describe('Phase 4G-2 loot ownership and world-event presentation', () => {
  it('keeps third-party corpse loot out of both the visible list and legal commands', () => {
    const state = createGame({ seed: 'PHASE4G2-UI-HIDDEN', playerCharacterId: 'scout' });
    const player = getPlayer(state);
    const victim = Object.values(state.characters).find((candidate) => !candidate.isPlayer)!;
    const stack = { ...createStack(state, 'wood'), droppedBy: victim.id, revealedTo: [] };
    state.zones[player.currentZoneId]!.groundItems.push(stack);
    state.events.push(deathEvent(state, victim.id));

    expect(canAccessGroundItem(player, stack)).toBe(false);
    expect(
      getLegalPlayerCommands(state).some(
        (entry) => entry.command.type === 'PICKUP_GROUND' && entry.command.uid === stack.uid,
      ),
    ).toBe(false);

    render(state);
    expect(container.querySelector('.ground-list')).toBeNull();
    expect(container.querySelector(`[data-item-id="${stack.itemId}"]`)).toBeNull();
    expect(container.textContent).not.toMatch(/\d+\s*件/);
    expect(document.querySelectorAll('[title]')).toHaveLength(0);
  });

  it('shows a corpse drop without a quantity once the player has searched the zone', () => {
    const state = createGame({ seed: 'PHASE4G2-UI-REVEALED', playerCharacterId: 'scout' });
    const player = getPlayer(state);
    const victim = Object.values(state.characters).find((candidate) => !candidate.isPlayer)!;
    const stack = { ...createStack(state, 'wood'), droppedBy: victim.id, revealedTo: [player.id] };
    state.zones[player.currentZoneId]!.groundItems.push(stack);
    state.events.push(deathEvent(state, victim.id));

    render(state);
    expect(container.querySelector('.ground-list')).not.toBeNull();
    expect(container.querySelector(`[data-item-id="${stack.itemId}"]`)).not.toBeNull();
    expect(container.textContent).toContain('地面掉落');
    expect(container.textContent).not.toMatch(/\d+\s*件/);
  });

  it('places multiple world-event banners beside the zone name and preserves severity and urgency cues', () => {
    const state = createGame({ seed: 'PHASE4G2-UI-WORLD-BANNERS', playerCharacterId: 'scout' });
    state.activeWorldEvents = [
      worldEvent('we-critical', 'research_anomaly', 1, 'lab'),
      worldEvent('we-ambient', 'rain', 4, null),
    ];
    render(state);

    const heroBanners = container.querySelector('.zone-hero-event-banners');
    expect(heroBanners).not.toBeNull();
    expect(heroBanners?.querySelectorAll('.event-banner-hero')).toHaveLength(2);
    expect(container.querySelector('.stage-content .event-banner-wrap')).toBeNull();
    expect(container.querySelector('.zone-hero h2')).not.toBeNull();
    expect(container.textContent).toContain('直接威胁');
    expect(container.textContent).toContain('即将结束');
    expect(container.textContent).toContain('持续中');
    expect(container.textContent).toContain('☠');
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });
});
