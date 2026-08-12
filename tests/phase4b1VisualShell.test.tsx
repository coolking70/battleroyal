/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGame, getPlayer } from '../src/core/gameState';
import { createStack } from '../src/core/inventory';
import { ZoneMap } from '../src/ui/components/ZoneMap';
import { StatusBar } from '../src/ui/components/StatusBar';
import { GameScreen } from '../src/ui/screens/GameScreen';
import { getZoneDef } from '../src/data/zones';
import { ZONES } from '../src/data/zones';
import { zoneStatusMeta } from '../src/ui/zonePresentation';

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

describe('Phase 4B-1 visual shell', () => {
  it('renders the current Zone as a VisualImage-backed hero rather than a stage icon', () => {
    const state = createGame({ seed: 'PHASE4B1-HERO', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    act(() => root.render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />));

    expect(container.querySelector('.zone-hero')).not.toBeNull();
    expect(container.querySelector('.zone-hero-image')).not.toBeNull();
    expect(container.querySelector('.zone-hero')?.getAttribute('data-zone-status')).toBe('safe');
    expect(container.querySelector('.zone-hero')?.textContent).toContain('安全');
  });

  it('keeps all navigable Zone entries and renders non-color status cues', () => {
    const state = createGame({ seed: 'PHASE4B1-MAP', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    state.zones.school!.status = 'warning';
    state.zones.lab!.status = 'restricted';
    act(() => root.render(
      <ZoneMap state={state} player={player} disabled={false} freshIntelZones={new Set()} onMove={() => undefined} />,
    ));

    expect(container.querySelectorAll('.zone-item')).toHaveLength(ZONES.length);
    expect(container.querySelector('.cue-warning')?.textContent).toContain('预警');
    expect(container.querySelector('.cue-warning .zone-state-icon')?.textContent).toBe('⚠');
    expect(container.querySelector('.cue-restricted')?.textContent).toContain('禁区');
    expect(container.querySelector('.cue-restricted .zone-state-icon')?.textContent).toBe('✕');
    expect(container.querySelector('.cue-safe .zone-state-icon')?.textContent).toBe('◇');
  });

  it('does not expose remote ground-drop counts on the player map', () => {
    const state = createGame({ seed: 'PHASE4C9-GROUND-BOUNDARY', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    const remoteZoneId = Object.keys(state.zones).find((id) => id !== player.currentZoneId)!;
    state.zones[remoteZoneId]!.groundItems.push(createStack(state, 'iron'));
    state.zones[player.currentZoneId]!.groundItems.push(createStack(state, 'wood'));

    act(() => root.render(
      <ZoneMap state={state} player={player} disabled={false} freshIntelZones={new Set()} onMove={() => undefined} />,
    ));

    const currentName = getZoneDef(player.currentZoneId).name;
    const remoteName = getZoneDef(remoteZoneId).name;
    const currentButton = Array.from(container.querySelectorAll('.zone-item')).find((node) =>
      node.textContent?.includes(currentName),
    );
    const remoteButton = Array.from(container.querySelectorAll('.zone-item')).find((node) =>
      node.textContent?.includes(remoteName),
    );
    expect(currentButton?.textContent).toContain('有地面物资');
    expect(currentButton?.textContent).not.toMatch(/\d+\s*件/);
    expect(remoteButton?.textContent).not.toContain('有地面物资');
  });

  it('defines Safe/Warning/Restricted with label, icon and distinct pattern cues', () => {
    expect(zoneStatusMeta('safe')).toMatchObject({ label: '安全', icon: '◇', pattern: 'clear' });
    expect(zoneStatusMeta('warning')).toMatchObject({ label: '预警', icon: '⚠', pattern: 'stripe' });
    expect(zoneStatusMeta('restricted')).toMatchObject({ label: '禁区', icon: '✕', pattern: 'diagonal' });
  });

  it('keeps P0 survival values visible in the redesigned StatusBar', () => {
    const state = createGame({ seed: 'PHASE4B1-P0', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    state.zones[player.currentZoneId]!.status = 'restricted';
    act(() => root.render(<StatusBar state={state} player={player} aliveCount={state.turnOrder.length} onQuit={() => undefined} />));

    const text = container.querySelector('.topbar')?.textContent ?? '';
    expect(text).toContain('生命');
    expect(text).toContain('体力');
    expect(text).toContain('禁区');
    expect(container.querySelector('.topbar-danger-restricted')).not.toBeNull();
    expect(container.querySelector('.topbar-danger .zone-state-icon')?.textContent).toBe('✕');
  });
});
