/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGame, getPlayer } from '../src/core/gameState';
import { GameScreen } from '../src/ui/screens/GameScreen';

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

describe('Phase 4B-5 responsive shell', () => {
  it('provides a single planning surface with an open/close drawer state', () => {
    const state = createGame({ seed: 'PHASE4B5-DRAWER', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    act(() => {
      root.render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />);
    });

    const trigger = container.querySelector('.planning-drawer-trigger') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelectorAll('.planning-drawer-panel')).toHaveLength(1);
    expect(container.querySelector('.planning-panel')).not.toBeNull();
    expect(container.querySelector('.log-panel')).not.toBeNull();

    act(() => trigger.click());
    expect(container.querySelector('.planning-slot-open')).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.planning-drawer-header')?.textContent).toContain('规划与历史');

    act(() => (container.querySelector('.planning-drawer-header .btn') as HTMLButtonElement).click());
    expect(container.querySelector('.planning-slot-open')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the main action rail, movement entries, encounter actions and boundary log in the same UI tree', () => {
    const state = createGame({ seed: 'PHASE4B5-CONTENT', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    act(() => {
      root.render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />);
    });

    expect(container.querySelector('.actionbar-actions button')).not.toBeNull();
    expect(container.querySelectorAll('.zone-item')).toHaveLength(6);
    expect(container.querySelector('.log-panel')).not.toBeNull();
    expect(container.textContent).not.toContain('flee_combat');
    expect(container.textContent).not.toContain('物资 100%');
  });
});
