/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearInventory, newGame, player } from './helpers';
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

describe('Phase 4Q 地标探索 UI 与信息边界', () => {
  it('只展示当前区域地标和粗粒度状态，不预览隐藏物资，并发出定向命令', () => {
    const state = newGame('PHASE4Q-UI-LANDMARKS');
    const actor = player(state);
    actor.currentZoneId = 'commercial';
    clearInventory(actor);
    for (const zone of Object.values(state.zones)) zone.wildEnemyIds = [];
    const dispatch = vi.fn();

    act(() => root.render(<GameScreen state={state} player={actor} dispatch={dispatch} onQuit={() => undefined} />));

    const panel = container.querySelector('[data-landmark-panel="true"]')!;
    expect(panel.querySelectorAll('.landmark-card')).toHaveLength(2);
    expect(panel.textContent).toContain('便利店');
    expect(panel.textContent).toContain('电子商店');
    expect(panel.textContent).toContain('隐藏物资不会预览');
    expect(panel.textContent).not.toContain('电池');
    expect(panel.textContent).not.toContain('导线');
    expect(panel.textContent).not.toContain('电路板');

    const search = panel.querySelector<HTMLButtonElement>('[data-landmark-id="commercial_electronics_shop"] [data-action="search-landmark"]');
    expect(search).not.toBeNull();
    act(() => search!.click());
    expect(dispatch).toHaveBeenCalledWith({ type: 'SEARCH_LANDMARK', landmarkId: 'commercial_electronics_shop' });
  });
});
