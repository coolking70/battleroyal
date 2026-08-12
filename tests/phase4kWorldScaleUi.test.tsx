/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGame, getPlayer } from '../src/core/gameState';
import { ZONE_IDS, ZONES } from '../src/data/zones';
import { ZoneMap } from '../src/ui/components/ZoneMap';
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

describe('Phase 4K · scalable map UI', () => {
  it('renders every zone, current/reachable state, warning and restricted cues', () => {
    const state = createGame({ seed: 'PHASE4K-UI-MAP', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    player.currentZoneId = 'commercial';
    state.zones.commercial!.status = 'warning';
    state.zones.underground!.status = 'restricted';

    act(() => root.render(<ZoneMap state={state} player={player} disabled={false} onMove={() => undefined} />));

    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.zone-item')];
    expect(buttons).toHaveLength(ZONES.length);
    expect(buttons.map((button) => button.dataset.zoneId)).toEqual(ZONE_IDS);
    expect(container.textContent).toContain('商业街');
    expect(container.textContent).toContain('地下通道');
    expect(container.querySelector('.cue-warning')?.textContent).toContain('预警');
    expect(container.querySelector('.cue-restricted')?.textContent).toContain('禁区');

    const current = buttons.find((button) => button.dataset.zoneId === 'commercial')!;
    expect(current.disabled).toBe(true);
    const adjacent = buttons.find((button) => button.dataset.zoneId === 'station')!;
    expect(adjacent.disabled).toBe(false);
    const remote = buttons.find((button) => button.dataset.zoneId === 'underground')!;
    expect(remote.disabled).toBe(true);
    expect(remote.getAttribute('aria-label')).toContain('不与当前区域相邻');
  });

  it('keeps the full map drawer readable as a data-driven 12-zone surface', () => {
    const state = createGame({ seed: 'PHASE4K-UI-DRAWER', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    act(() => root.render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />));

    const trigger = container.querySelector('.zone-rail-expand') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    act(() => trigger.click());
    expect(container.querySelector('.map-slot-open')).not.toBeNull();
    const map = container.querySelector('.map-drawer-panel')!;
    expect(map.querySelectorAll('.zone-item')).toHaveLength(ZONES.length);
    expect(map.textContent).toContain('商业街');
    expect(map.textContent).toContain('车站');
    expect(map.textContent).toContain('公园');
    expect(map.textContent).toContain('仓库');
    expect(map.textContent).toContain('建筑工地');
    expect(map.textContent).toContain('地下通道');
  });
});
