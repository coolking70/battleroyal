/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGame, getPlayer } from '../src/core/gameState';
import { createStack } from '../src/core/inventory';
import type { Combatant, EncounterState } from '../src/core/types';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { EncounterHero } from '../src/ui/components/EncounterHero';
import { StatusBar } from '../src/ui/components/StatusBar';
import { GameScreen } from '../src/ui/screens/GameScreen';
import { growthFeedbackText } from '../src/utils/growthPresentation';

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

function playerPair(): { before: Combatant; after: Combatant } {
  const state = createGame({ seed: 'PHASE4F2-GROWTH-TOAST', playerCharacterId: 'fighter' });
  const player = getPlayer(state);
  const before = { ...player };
  const after = {
    ...before,
    level: before.level + 1,
    exp: 0,
    attack: before.attack + GAME_CONFIG.levelAttackGain,
    defense: before.defense + GAME_CONFIG.levelDefenseGain,
    maxHp: before.maxHp + GAME_CONFIG.levelMaxHpGain,
    hp: before.hp + GAME_CONFIG.levelMaxHpGain,
  };
  return { before, after };
}

describe('Phase 4F-2 player growth presentation', () => {
  it('keeps the player level and progress in the existing P0 top bar', () => {
    const state = createGame({ seed: 'PHASE4F2-TOPBAR', playerCharacterId: 'scout' });
    const player = getPlayer(state);
    player.exp = 7;

    act(() => root.render(
      <StatusBar state={state} player={player} aliveCount={state.turnOrder.length} onQuit={() => undefined} />,
    ));

    const growth = container.querySelector('.survival-metric-growth');
    expect(growth?.textContent).toContain('Lv.1');
    // 可见文本不带 EXP 后缀（三条状态条共用固定宽度，带后缀会溢出到相邻字段）；
    // 完整措辞仍由 aria-valuetext 承担，所以这里两者都断言。
    expect(growth?.textContent).toContain(`7/${GAME_CONFIG.levelExpThresholds[0]}`);
    expect(growth?.textContent).not.toContain('EXP');
    expect(growth?.getAttribute('data-growth-capped')).toBe('false');
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('7');
    expect(progressbar?.getAttribute('aria-valuetext')).toContain(
      `7/${GAME_CONFIG.levelExpThresholds[0]} EXP`,
    );
    expect(container.querySelectorAll('.survival-metric')).toHaveLength(3);
    expect(container.querySelector('.growth-max-state')).toBeNull();
  });

  it('expresses the level cap as text instead of an endless progress bar', () => {
    const state = createGame({ seed: 'PHASE4F2-CAP', playerCharacterId: 'scout' });
    const player = getPlayer(state);
    player.level = GAME_CONFIG.maxLevel;
    player.exp = 0;

    act(() => root.render(
      <StatusBar state={state} player={player} aliveCount={state.turnOrder.length} onQuit={() => undefined} />,
    ));

    expect(container.querySelector('.growth-max-state')?.textContent).toContain('已满级');
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('explains source, kill bonus, and all three level-up gains in the existing toast text', () => {
    const { before, after } = playerPair();
    const upgraded = growthFeedbackText({
      command: { type: 'ATTACK', targetId: 'npc-1', style: 'normal' },
      before: { ...before, exp: 19 },
      after: { ...after, kills: before.kills + 1 },
      message: '你 命中 对手，造成 8 点伤害。',
      ok: true,
    });

    expect(upgraded).toContain('战斗结算');
    expect(upgraded).toContain('击杀额外奖励');
    expect(upgraded).toContain('升级 Lv.2');
    expect(upgraded).toContain('攻击 +1');
    expect(upgraded).toContain('防御 +1');
    expect(upgraded).toContain('最大生命 +10');
    expect(growthFeedbackText({
      command: { type: 'REST' },
      before,
      after: before,
      message: '休整完毕，体力 +10。',
      ok: true,
    })).toContain('休息不会获得经验');

    expect(growthFeedbackText({
      command: { type: 'CRAFT', recipeId: 'r_stick' },
      before,
      after: { ...before, exp: before.exp + 2 },
      message: '合成成功：木棍',
      ok: true,
    })).toContain('合成成长 +2 EXP');
    expect(growthFeedbackText({
      command: { type: 'SEARCH' },
      before,
      after: { ...before, exp: before.exp + 1 },
      message: '找到了一件物品。',
      ok: true,
    })).toContain('探索成长 +1 EXP');
    expect(growthFeedbackText({
      command: { type: 'MOVE', zoneId: 'forest' },
      before,
      after: { ...before, exp: before.exp + 1 },
      message: '你前往森林。',
      ok: true,
    })).toContain('探索成长 +1 EXP');
  });

  it('does not expose enemy growth fields in the encounter hero or battle record', () => {
    const state = createGame({ seed: 'PHASE4F2-BOUNDARY', playerCharacterId: 'scout' });
    const player = getPlayer(state);
    const enemy = Object.values(state.characters).find((actor) => !actor.isPlayer)!;
    enemy.level = GAME_CONFIG.maxLevel;
    enemy.exp = 0;
    const encounter: EncounterState = {
      enemyId: enemy.id,
      zoneId: player.currentZoneId,
      startedAtTime: state.time,
      log: ['合法战报：你命中目标，造成 8 点伤害。', '敌人等级：5，经验：0'],
      resolved: false,
    };

    act(() => root.render(
      <EncounterHero encounter={encounter} player={player} enemy={enemy} combat={null} />,
    ));
    const hero = container.querySelector('.encounter-hero')!;
    expect(hero.textContent).toContain('合法战报');
    expect(hero.textContent).not.toMatch(/等级\s*[:：=]?\s*\d+/);
    expect(hero.textContent).not.toMatch(/经验\s*[:：=]?\s*\d+/);

    act(() => (container.querySelector('.encounter-hero-log-toggle') as HTMLButtonElement).click());
    expect(hero.textContent).not.toMatch(/等级\s*[:：=]?\s*\d+/);
    expect(hero.textContent).not.toMatch(/经验\s*[:：=]?\s*\d+/);
  });

  it('marks a player kill drop as corpse loot using only the visible death event', () => {
    const state = createGame({ seed: 'PHASE4F2-CORPSE-LOOT', playerCharacterId: 'scout' });
    const player = getPlayer(state);
    const zone = state.zones[player.currentZoneId]!;
    zone.groundItems.push({
      ...createStack(state, 'wood'),
      droppedBy: state.playerId,
      revealedTo: [],
    });
    state.events.push({
      id: 'phase4f2-corpse-death',
      type: 'CHARACTER_DIED',
      time: state.time,
      actorId: state.playerId,
      targetId: 'npc-1',
      zoneId: player.currentZoneId,
      message: '铜环 被 你 击杀（医院）。',
      importance: 'critical',
      metadata: { killerId: state.playerId, cause: '战斗', dropCount: 1 },
    });

    act(() => root.render(
      <GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />,
    ));

    expect(container.querySelector('.corpse-loot-notice')?.textContent).toContain('击杀战利品');
    expect(container.querySelector('.corpse-loot-notice')?.textContent).not.toMatch(/\d+\s*件/);
    expect(container.querySelector('.ground-list')).not.toBeNull();
  });

  it('keeps the new top-bar control surface free of title attributes', () => {
    const state = createGame({ seed: 'PHASE4F2-A11Y', playerCharacterId: 'scout' });
    act(() => root.render(
      <StatusBar state={state} player={getPlayer(state)} aliveCount={state.turnOrder.length} onQuit={() => undefined} />,
    ));
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
    expect(container.querySelector('.growth-progress-wrap')?.getAttribute('aria-label')).toContain('经验进度');
    expect(container.querySelector('.survival-metric-growth .bar-growth')).not.toBeNull();
  });
});
