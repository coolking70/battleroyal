/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, getPlayer } from '../src/core/gameState';
import { createStack } from '../src/core/inventory';
import { experienceToNextLevel, gainExperience } from '../src/core/progression';
import type { EncounterState } from '../src/core/types';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { GameScreen } from '../src/ui/screens/GameScreen';
import { StatusBar } from '../src/ui/components/StatusBar';

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

describe('Phase 4G-1 growth curve, corpse loot, and vital hot zones', () => {
  it('uses the new threshold boundaries and keeps the level cap from accumulating exp', () => {
    const state = createGame({ seed: 'PHASE4G1-THRESHOLD-BOUNDARY', playerCharacterId: 'scout' });
    const actor = getPlayer(state);
    const levelTwoThreshold = experienceToNextLevel(1);
    actor.exp = levelTwoThreshold - 1;
    gainExperience(actor, 1);
    expect(actor.level).toBe(2);
    expect(actor.exp).toBe(0);

    const levelThreeThreshold = experienceToNextLevel(2);
    actor.exp = levelThreeThreshold - 1;
    gainExperience(actor, 1);
    expect(actor.level).toBe(3);
    expect(actor.exp).toBe(0);

    actor.level = GAME_CONFIG.maxLevel;
    actor.exp = 0;
    const cappedStats = { attack: actor.attack, defense: actor.defense, maxHp: actor.maxHp, hp: actor.hp };
    const result = gainExperience(actor, 9999);
    expect(result.gained).toBe(0);
    expect(actor).toMatchObject({ level: GAME_CONFIG.maxLevel, exp: 0, ...cappedStats });
  });

  it('renders experience with the same three-part metric surface as HP and stamina', () => {
    const state = createGame({ seed: 'PHASE4G1-THREE-BARS', playerCharacterId: 'scout' });
    const actor = getPlayer(state);
    act(() => root.render(
      <StatusBar
        state={state}
        player={actor}
        aliveCount={state.turnOrder.length}
        onQuit={() => undefined}
        onUseItem={vi.fn()}
      />,
    ));

    const metrics = container.querySelectorAll('.survival-metrics > .survival-metric');
    expect(metrics).toHaveLength(3);
    expect(container.querySelectorAll('.survival-metric .bar')).toHaveLength(3);
    expect(container.querySelector('.survival-metric-growth .bar-growth')).not.toBeNull();
    expect(container.querySelectorAll('.survival-metric-hp, .survival-metric-stamina')).toHaveLength(2);
    for (const kind of ['hp', 'stamina'] as const) {
      const button = container.querySelector(`.survival-metric-${kind} .bar-button`);
      expect(button?.tagName).toBe('BUTTON');
      expect(button?.querySelector('.metric-label')).not.toBeNull();
      expect(button?.querySelector('.bar')).not.toBeNull();
      expect(button?.querySelector('b')).not.toBeNull();
      expect(button?.getAttribute('aria-label')).toContain(kind === 'hp' ? '生命' : '体力');
    }
  });

  it('shows public corpse loot in the resolved encounter feedback at the kill moment', () => {
    const state = createGame({ seed: 'PHASE4G1-CORPSE-IMMEDIATE', playerCharacterId: 'scout' });
    const actor = getPlayer(state);
    const enemy = Object.values(state.characters).find((candidate) => !candidate.isPlayer)!;
    enemy.currentZoneId = actor.currentZoneId;
    enemy.alive = false;
    enemy.hp = 0;
    const encounter: EncounterState = {
      enemyId: enemy.id,
      zoneId: actor.currentZoneId,
      startedAtTime: state.time,
      log: [`${enemy.name} 已被击杀。`],
      resolved: true,
    };
    state.encounter = encounter;
    state.zones[actor.currentZoneId]!.groundItems.push({
      ...createStack(state, 'wood'),
      droppedBy: state.playerId,
      revealedTo: [],
    });
    state.zones[actor.currentZoneId]!.groundItems.push({
      ...createStack(state, 'stone'),
      droppedBy: state.playerId,
      revealedTo: [],
    });
    state.events.push({
      id: 'phase4g1-public-death',
      type: 'CHARACTER_DIED',
      time: state.time,
      actorId: state.playerId,
      targetId: enemy.id,
      zoneId: actor.currentZoneId,
      message: `${enemy.name} 被 你 击杀。`,
      importance: 'critical',
      metadata: { cause: '战斗', killerId: state.playerId, dropCount: 2 },
    });

    act(() => root.render(
      <GameScreen state={state} player={actor} dispatch={() => undefined} onQuit={() => undefined} />,
    ));

    const feedback = container.querySelector('.encounter-hero-feedback')?.textContent ?? '';
    expect(feedback).toContain('击杀战利品：该对手遗留了物资，可拾取');
    expect(feedback).not.toMatch(/\d+\s*件/);
    expect(container.querySelector('.encounter-hero-feedback strong')?.getAttribute('data-corpse-loot-available')).toBe('true');
  });
});
