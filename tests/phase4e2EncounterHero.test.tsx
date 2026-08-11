/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getPlayer } from '../src/core/gameState';
import { EncounterHero } from '../src/ui/components/EncounterHero';
import { newGame, npcs } from './helpers';

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

describe('Phase 4E-2：对方逃走的即时反馈', () => {
  it('敌人离开本次交手区域后，即时反馈明确写出对方已脱离接触', () => {
    const state = newGame('PHASE4E2-OPPONENT-ESCAPE');
    const player = getPlayer(state);
    const enemy = npcs(state)[0]!;
    const destination = Object.keys(state.zones).find(
      (zoneId) => zoneId !== player.currentZoneId,
    )!;
    enemy.currentZoneId = destination;

    act(() => {
      root.render(
        <EncounterHero
          encounter={{
            enemyId: enemy.id,
            zoneId: player.currentZoneId,
            startedAtTime: state.time,
            log: ['你 命中 敌人，造成 3 点伤害。'],
            resolved: true,
          }}
          player={player}
          enemy={enemy}
          combat={null}
        />,
      );
    });

    const feedback = container.querySelector('.encounter-hero-feedback strong')?.textContent ?? '';
    expect(feedback).toContain(enemy.name);
    expect(feedback).toContain('已经离开该区域');
    expect(feedback).toContain('脱离接触');
  });
});
