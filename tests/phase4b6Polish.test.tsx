/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createGame, getPlayer } from '../src/core/gameState';
import { GameScreen } from '../src/ui/screens/GameScreen';
import { ResultScreen } from '../src/ui/screens/ResultScreen';
import type { GameEvent } from '../src/core/types';
import { visibleEventsForPlayer } from '../src/ui/components/EventLog';
import type { AssetManifest } from '../src/ui/visualAssets';
import { setAssetManifest } from '../src/ui/visualAssets';

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
  setAssetManifest(null);
});

describe('Phase 4B-6 polish and accessibility closure', () => {
  it('defines global focus-visible and reduced-motion safeguards', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/ui/styles.css'), 'utf8');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('scroll-behavior: auto');
  });

  it('exposes action costs and disabled context through stable accessible names', () => {
    const state = createGame({ seed: 'PHASE4B6-A11Y', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    act(() => root.render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />));

    const search = container.querySelector('.actionbar-actions button');
    expect(search?.getAttribute('aria-label')).toContain('体力');
    expect(search?.getAttribute('aria-describedby')).toBe('actionbar-hint');
    expect(container.querySelectorAll('.planning-tabs button')).toHaveLength(3);
    expect(container.textContent).toContain('图鉴');
    expect(container.querySelector('.log-panel')).not.toBeNull();
  });

  it('focuses the drawer close control, supports Escape, and returns focus to the trigger', () => {
    const state = createGame({ seed: 'PHASE4B6-DRAWER', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    act(() => root.render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />));

    const trigger = container.querySelector('.planning-drawer-trigger') as HTMLButtonElement;
    act(() => trigger.click());
    expect(document.activeElement).toBe(container.querySelector('.planning-drawer-close'));

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(container.querySelector('.planning-slot-open')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('renders existing character and zone assets on the result surface only', () => {
    const manifest: AssetManifest = {
      version: 1,
      characters: { scout: { portrait: '/assets/characters/scout/portrait.png' } },
      zones: { forest: { background: '/assets/zones/forest/background.png' } },
      items: {},
      worldEvents: {},
    };
    setAssetManifest(manifest);
    const state = createGame({ seed: 'PHASE4B6-RESULT', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    player.currentZoneId = 'forest';
    state.status = 'won';
    state.endReason = 'player_won';
    state.endedAtTime = state.time;

    act(() => root.render(<ResultScreen state={state} player={player} onRestart={() => undefined} onBackToMenu={() => undefined} />));

    expect(container.querySelector('.result-character-visual')?.getAttribute('src')).toBe('/assets/characters/scout/portrait.png');
    expect(container.querySelector('.result-zone-visual')?.getAttribute('src')).toBe('/assets/zones/forest/background.png');
    expect(container.textContent).toContain('森林');
    expect(container.textContent).toContain('最后生还');
  });

  it('keeps the default information boundary intact after the polish pass', () => {
    const hiddenNpcEvent: GameEvent = {
      id: 'phase4b6-hidden-npc',
      type: 'NPC_ACTION',
      time: 3,
      actorId: 'npc-1',
      targetId: null,
      zoneId: 'forest',
      message: '青苔（search）：搜索当前区域（物资 100%）',
      importance: 'minor',
      metadata: { kind: 'search', reason: '搜索当前区域（物资 100%）' },
    };
    const ownAction: GameEvent = {
      ...hiddenNpcEvent,
      id: 'phase4b6-own-action',
      type: 'SEARCH_STARTED',
      actorId: 'p0',
      message: '你在森林搜索。',
    };

    const visible = visibleEventsForPlayer([hiddenNpcEvent, ownAction], 'p0');
    expect(visible.map((item) => item.id)).toEqual(['phase4b6-own-action']);
    expect(visible.map((item) => item.message).join('\n')).not.toContain('物资 100%');
    expect(visible.map((item) => item.message).join('\n')).not.toContain('（search）');
  });

  it('applies the player visibility boundary to the result timeline and hides NPC planner labels', () => {
    const state = createGame({ seed: 'PHASE4C8-RESULT-BOUNDARY', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    Object.values(state.characters)
      .filter((character) => !character.isPlayer)
      .forEach((character) => {
        character.personality = 'aggressive';
      });
    const npc = Object.values(state.characters).find((character) => !character.isPlayer)!;
    state.status = 'draw';
    state.endReason = 'time_limit';
    state.endedAtTime = 4;
    state.events = [
      {
        id: 'result-hidden-goal',
        type: 'CRAFT_GOAL_SET',
        time: 1,
        actorId: npc.id,
        targetId: null,
        zoneId: npc.currentZoneId,
        message: 'NPC_SECRET_GOAL 不应出现在结算时间线。',
        importance: 'major',
        metadata: { recipeId: 'r_field_spear', completed: false },
      },
      {
        id: 'result-hidden-encounter',
        type: 'ENCOUNTER_STARTED',
        time: 2,
        actorId: npc.id,
        targetId: 'n2',
        zoneId: npc.currentZoneId,
        message: 'NPC_SECRET_ENCOUNTER 不应出现在结算时间线。',
        importance: 'major',
        metadata: {},
      },
      {
        id: 'result-own-goal',
        type: 'CRAFT_GOAL_SET',
        time: 3,
        actorId: player.id,
        targetId: null,
        zoneId: player.currentZoneId,
        message: '你的公开制作目标仍应保留。',
        importance: 'major',
        metadata: { recipeId: 'r_field_spear', completed: false },
      },
      {
        id: 'result-public-death',
        type: 'CHARACTER_DIED',
        time: 4,
        actorId: npc.id,
        targetId: 'n2',
        zoneId: npc.currentZoneId,
        message: '公开播报：有人出局。',
        importance: 'critical',
        metadata: { cause: 'combat', killerId: npc.id, dropCount: 0 },
      },
    ];

    act(() => root.render(<ResultScreen state={state} player={player} onRestart={() => undefined} onBackToMenu={() => undefined} />));

    const text = container.textContent ?? '';
    expect(text).toContain('你的公开制作目标仍应保留。');
    expect(text).toContain('公开播报：有人出局。');
    expect(text).not.toContain('NPC_SECRET_GOAL');
    expect(text).not.toContain('NPC_SECRET_ENCOUNTER');
    expect(container.querySelector('.rank-table')?.textContent).not.toContain('激进');
  });
});
