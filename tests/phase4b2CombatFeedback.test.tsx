/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyExposed } from '../src/core/exposed';
import { allCharacters, createGame, getPlayer } from '../src/core/gameState';
import { buildCombatActionBar } from '../src/ui/combatActionsPresentation';
import { EncounterHero } from '../src/ui/components/EncounterHero';
import { GameScreen } from '../src/ui/screens/GameScreen';
import { setAssetManifest, type AssetManifest } from '../src/ui/visualAssets';
import type { Combatant, GameState } from '../src/core/types';

let root: Root;
let container: HTMLDivElement;

async function loadManifest(): Promise<AssetManifest> {
  return JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
}

function encounterFixture(seed: string, playerCharacterId = 'scout') {
  const state = createGame({ seed, playerCharacterId, playerName: '测试者' });
  const player = getPlayer(state);
  const enemy = allCharacters(state).find((character) => !character.isPlayer)!;
  enemy.characterId = 'fighter';
  enemy.currentZoneId = player.currentZoneId;
  state.zones[player.currentZoneId]!.aliveCharacterIds = [player.id, enemy.id];
  state.encounter = {
    enemyId: enemy.id,
    zoneId: player.currentZoneId,
    startedAtTime: state.time,
    log: ['你发现了可见目标。'],
    resolved: false,
  };
  return { state, player, enemy };
}

/** 4D-3 起遭遇是主视觉的一种状态，`EncounterHero` 与共用行动栏共享同一组数值 */
function renderHero(state: GameState, player: Combatant, enemy: Combatant): void {
  act(() => root.render(
    <EncounterHero
      encounter={state.encounter!}
      player={player}
      enemy={enemy}
      combat={state.encounter!.resolved ? null : buildCombatActionBar(state, player, enemy)}
    />,
  ));
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  setAssetManifest(await loadManifest());
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setAssetManifest(null);
});

describe('Phase 4B-2 encounter and combat feedback（4D-3 迁移到主视觉遭遇态）', () => {
  it('遭遇态主视觉以敌方 Combat 立绘为唯一主体，不再有玩家侧对位立绘', () => {
    const { state, player, enemy } = encounterFixture('PHASE4B2-COMBAT');
    renderHero(state, player, enemy);

    // 唯一的一张遭遇立绘就是敌人（4B-2 的两张对位构图在 4D-3 收敛为一张）
    expect(container.querySelectorAll('.encounter-enemy-visual')).toHaveLength(1);
    expect(container.querySelector('.encounter-hero-portrait')?.getAttribute('data-visual-state')).toBe('combat');
    expect(container.querySelector('.encounter-enemy-visual')?.getAttribute('src')).toBe('/assets/characters/fighter/combat.png');
    // 玩家立绘 / 玩家卡片都不在遭遇主视觉里（玩家状态只在顶栏）
    expect(container.querySelector('.encounter-player-visual')).toBeNull();
    expect(container.querySelector('.combatant-player')).toBeNull();
    // 即时反馈仍是最近一条战斗记录
    expect(container.querySelector('.encounter-hero-feedback')?.textContent).toContain('你发现了可见目标');
  });

  it('敌方 Injured 优先于 Combat，三态标签仍是图标 + 文字（不只靠颜色）', () => {
    const { state, player, enemy } = encounterFixture('PHASE4B2-INJURED');
    enemy.hp = Math.floor(enemy.maxHp * 0.3);
    renderHero(state, player, enemy);

    expect(container.querySelector('.encounter-hero-portrait')?.getAttribute('data-visual-state')).toBe('injured');
    expect(container.querySelector('.encounter-enemy-visual')?.getAttribute('src')).toBe('/assets/characters/fighter/injured.png');
    expect(container.querySelector('.combat-visual-state.state-injured')?.textContent).toContain('负伤姿态');
    expect(container.querySelector('.combat-visual-state.state-injured .combat-cue-icon')?.textContent).toBe('✚');
    // 敌方生命只有条 + 文字档位，没有精确数字
    expect(container.textContent).toContain('敌方生命状态');
    expect(container.querySelector('.eh-hp .bar')).not.toBeNull();
  });

  it('EXPOSED 与技能就绪仍是图标 + 文字提示，分别落在主视觉与共用行动栏', () => {
    const { state, player, enemy } = encounterFixture('PHASE4B2-CUES', 'scout');
    applyExposed(state, enemy);
    renderHero(state, player, enemy);

    expect(container.textContent).toContain('露出破绽');
    expect(container.querySelector('.tag-exposed .combat-cue-icon')?.textContent).toBe('!');

    // 技能就绪的图标 + 文字在共用行动栏上（4D-3 §2.5）
    act(() => root.render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />));
    const skill = container.querySelector('.actionbar-combat-actions [data-action="skill"]');
    expect(skill).not.toBeNull();
    expect(skill?.querySelector('.combat-cue-icon')?.textContent).toBe('✦');
    expect(container.querySelector('.actionbar-combat-actions [data-action="guard"] .combat-cue-icon')?.textContent).toBe('▣');
  });

  it('遭遇进入 / 结算切换不改动探索动作，且结算态不再有独立面板与关闭按钮', () => {
    const { state, player, enemy } = encounterFixture('PHASE4B2-TRANSITION');
    act(() => root.render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />));
    expect(container.querySelector('.game')?.getAttribute('data-encounter-mode')).toBe('active');
    expect(container.querySelector('.stage')?.getAttribute('data-stage-focus')).toBe('encounter');
    expect(container.querySelector('.game-encounter-active')).not.toBeNull();
    expect(container.querySelector('.topbar-encounter-cue')?.textContent).toContain('遭遇战进行中');
    // 遭遇态行动栏切成战斗动作，而不是把探索按钮禁用后留在原地
    expect(container.querySelector('.actionbar')?.getAttribute('data-action-mode')).toBe('combat');

    state.encounter = { ...state.encounter!, enemyId: enemy.id, resolved: true };
    act(() => root.render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />));
    expect(container.querySelector('.game')?.getAttribute('data-encounter-mode')).toBe('resolved');
    expect(container.querySelector('.stage')?.getAttribute('data-stage-focus')).toBe('exploration');
    expect(container.querySelector('.encounter-hero')?.getAttribute('data-encounter-state')).toBe('resolved');
    expect(container.querySelector('.topbar-encounter-cue')?.textContent).toContain('遭遇已结束');
    // 4D-3 §2.3：没有「继续探索」按钮，也没有独立面板
    expect(container.querySelector('.encounter-continue')).toBeNull();
    expect(container.querySelector('.stage-content .encounter')).toBeNull();
    // 结算态行动栏回到探索动作
    expect(container.querySelector('.actionbar')?.getAttribute('data-action-mode')).toBe('exploration');
  });

  it('遭遇结算后敌方立绘回到既有 Portrait 状态', () => {
    const { state, player, enemy } = encounterFixture('PHASE4B2-PORTRAIT');
    state.encounter = { ...state.encounter!, resolved: true };
    renderHero(state, player, enemy);

    expect(container.querySelector('.encounter-hero-portrait')?.getAttribute('data-visual-state')).toBe('portrait');
    expect(container.querySelector('.encounter-enemy-visual')?.getAttribute('src')).toBe('/assets/characters/fighter/portrait.png');
    expect(container.querySelector('.combat-visual-state.state-portrait')?.textContent).toContain('常态');
  });

  it('遭遇 DOM 里不出现敌方精确 HP 数值', () => {
    const { state, player, enemy } = encounterFixture('PHASE4B2-BOUNDARY');
    enemy.hp = 17;
    enemy.maxHp = 100;
    renderHero(state, player, enemy);

    const enemyText = container.querySelector('.encounter-hero-enemyinfo')?.textContent ?? '';
    expect(enemyText).toContain('重伤');
    expect(enemyText).not.toContain('17/100');
    expect(enemyText).not.toContain('生命 17');
  });
});
