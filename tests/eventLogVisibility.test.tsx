/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/types';
import { EventLog, visibleEventsForPlayer } from '../src/ui/components/EventLog';

let container: HTMLDivElement;
let root: Root;

function event(overrides: Partial<GameEvent>): GameEvent {
  return {
    id: 'e1',
    type: 'NPC_ACTION',
    time: 1,
    actorId: 'npc-1',
    targetId: null,
    zoneId: 'forest',
    message: '青苔（search）：搜索当前区域（物资 100%）',
    importance: 'minor',
    metadata: { kind: 'search', reason: '搜索当前区域（物资 100%）' },
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
  act(() => root.unmount());
  container.remove();
});

describe('default event-log information boundary', () => {
  it('filters NPC search/plan/pickup and movement events from the default log', () => {
    const events = [
      event({ id: 'npc-search', message: '青苔 在森林搜索。' }),
      event({ id: 'npc-pickup', type: 'ITEM_FOUND', message: '青苔 找到了 药草。' }),
      event({ id: 'npc-plan', message: '寒星（flee_combat）：战力不足，脱离接触' }),
      event({ id: 'npc-move', type: 'CHARACTER_MOVED', message: '断线 前往住宅区。' }),
    ];

    expect(visibleEventsForPlayer(events, 'p0')).toHaveLength(0);

    act(() => {
      root.render(<EventLog events={events} playerId="p0" />);
    });
    expect(container.textContent).toContain('暂无记录');
    expect(container.textContent).not.toContain('物资 100%');
    expect(container.textContent).not.toContain('flee_combat');
  });

  it('keeps player actions, player combat, own damage, and public broadcasts', () => {
    const events = [
      event({ id: 'self-search', type: 'SEARCH_STARTED', actorId: 'p0', message: '你在森林搜索。' }),
      event({ id: 'self-hit', type: 'ATTACK_HIT', actorId: 'npc-1', targetId: 'p0', message: '你被击中。' }),
      event({ id: 'self-damage', type: 'ZONE_DAMAGE', actorId: 'p0', message: '你在禁区受伤。' }),
      event({ id: 'self-goal', type: 'CRAFT_GOAL_SET', actorId: 'p0', message: '你设定了合成目标。' }),
      event({ id: 'warning', type: 'ZONE_WARNING', actorId: null, message: '广播：学校将封锁。' }),
      event({ id: 'death', type: 'CHARACTER_DIED', actorId: 'npc-2', targetId: 'npc-3', message: '公开播报：有人出局。' }),
    ];

    const visible = visibleEventsForPlayer(events, 'p0');
    expect(visible.map((item) => item.id)).toEqual([
      'self-search',
      'self-hit',
      'self-damage',
      'self-goal',
      'warning',
      'death',
    ]);
  });

  it('does not change complete event visibility in the debug-facing input', () => {
    const hidden = event({ id: 'hidden-npc' });
    expect(hidden.metadata.reason).toBe('搜索当前区域（物资 100%）');
    expect(hidden.message).toContain('青苔');
  });
});
