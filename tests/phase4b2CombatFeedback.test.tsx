/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyExposed } from '../src/core/exposed';
import { allCharacters, createGame, getPlayer } from '../src/core/gameState';
import { EncounterPanel } from '../src/ui/components/EncounterPanel';
import { GameScreen } from '../src/ui/screens/GameScreen';
import { setAssetManifest, type AssetManifest } from '../src/ui/visualAssets';

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
  state.encounter = {
    enemyId: enemy.id,
    zoneId: player.currentZoneId,
    startedAtTime: state.time,
    log: ['你发现了可见目标。'],
    resolved: false,
  };
  return { state, player, enemy };
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

describe('Phase 4B-2 encounter and combat feedback', () => {
  it('renders balanced player and enemy Combat visuals in the three-part encounter composition', () => {
    const { state, player, enemy } = encounterFixture('PHASE4B2-COMBAT');
    act(() => root.render(
      <EncounterPanel
        state={state}
        encounter={state.encounter!}
        player={player}
        enemy={enemy}
        onAttack={() => undefined}
        onFlee={() => undefined}
        onGuard={() => undefined}
        onSkill={() => undefined}
        onClose={() => undefined}
      />,
    ));

    expect(container.querySelector('.encounter-composition')).not.toBeNull();
    expect(container.querySelectorAll('.encounter-combat-visual')).toHaveLength(2);
    expect(container.querySelector('.combatant-player')?.getAttribute('data-visual-state')).toBe('combat');
    expect(container.querySelector('.combatant-enemy')?.getAttribute('data-visual-state')).toBe('combat');
    expect(container.querySelector('.encounter-player-visual')?.getAttribute('src')).toBe('/assets/characters/scout/combat.png');
    expect(container.querySelector('.encounter-character-visual')?.getAttribute('src')).toBe('/assets/characters/fighter/combat.png');
    expect(container.querySelector('.encounter-focus')?.textContent).toContain('你发现了可见目标');
    expect(container.textContent).toContain('主要攻击');
    expect(container.textContent).toContain('次级行动');
  });

  it('promotes player Injured art and keeps all three state labels non-color-coded', () => {
    const { state, player, enemy } = encounterFixture('PHASE4B2-INJURED');
    player.hp = Math.floor(player.maxHp * 0.3);
    act(() => root.render(
      <EncounterPanel
        state={state}
        encounter={state.encounter!}
        player={player}
        enemy={enemy}
        onAttack={() => undefined}
        onFlee={() => undefined}
        onGuard={() => undefined}
        onSkill={() => undefined}
        onClose={() => undefined}
      />,
    ));

    expect(container.querySelector('.combatant-player')?.getAttribute('data-visual-state')).toBe('injured');
    expect(container.querySelector('.encounter-player-visual')?.getAttribute('src')).toBe('/assets/characters/scout/injured.png');
    expect(container.querySelector('.combat-visual-state.state-injured')?.textContent).toContain('负伤姿态');
    expect(container.querySelector('.combat-visual-state.state-injured .combat-cue-icon')?.textContent).toBe('✚');
    expect(container.textContent).toContain('生命');
    expect(container.textContent).toContain('体力');
  });

  it('renders Guard, EXPOSED and skill-ready as icon plus text cues', () => {
    const { state, player, enemy } = encounterFixture('PHASE4B2-CUES', 'scout');
    player.guarding = true;
    applyExposed(state, player);
    act(() => root.render(
      <EncounterPanel
        state={state}
        encounter={state.encounter!}
        player={player}
        enemy={enemy}
        onAttack={() => undefined}
        onFlee={() => undefined}
        onGuard={() => undefined}
        onSkill={() => undefined}
        onClose={() => undefined}
      />,
    ));

    const text = container.textContent ?? '';
    expect(text).toContain('防御中');
    expect(text).toContain('露出破绽');
    expect(text).toContain('技能就绪');
    expect(container.querySelector('.tag-guard .combat-cue-icon')?.textContent).toBe('▣');
    expect(container.querySelector('.tag-exposed .combat-cue-icon')?.textContent).toBe('!');
    expect(container.querySelector('[data-action="skill"] .combat-cue-icon')?.textContent).toBe('✦');
  });

  it('marks encounter entry and resolved exit without changing exploration actions', () => {
    const { state, player, enemy } = encounterFixture('PHASE4B2-TRANSITION');
    act(() => root.render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />));
    expect(container.querySelector('.game')?.getAttribute('data-encounter-mode')).toBe('active');
    expect(container.querySelector('.stage')?.getAttribute('data-stage-focus')).toBe('encounter');
    expect(container.querySelector('.game-encounter-active')).not.toBeNull();
    expect(container.querySelector('.topbar-encounter-cue')?.textContent).toContain('遭遇战进行中');
    expect((container.querySelector('.actionbar button') as HTMLButtonElement | null)?.disabled).toBe(true);

    state.encounter = { ...state.encounter!, enemyId: enemy.id, resolved: true };
    act(() => root.render(<GameScreen state={state} player={player} dispatch={() => undefined} onQuit={() => undefined} />));
    expect(container.querySelector('.game')?.getAttribute('data-encounter-mode')).toBe('resolved');
    expect(container.querySelector('.stage')?.getAttribute('data-stage-focus')).toBe('exploration');
    expect(container.querySelector('.encounter')?.textContent).toContain('遭遇已结束');
    expect(container.querySelector('.topbar-encounter-cue')?.textContent).toContain('遭遇已结束');
    expect(container.querySelector('.encounter-continue')).not.toBeNull();
  });

  it('returns both sides to the existing Portrait visual state after encounter resolution', () => {
    const { state, player, enemy } = encounterFixture('PHASE4B2-PORTRAIT');
    state.encounter = { ...state.encounter!, resolved: true };
    act(() => root.render(
      <EncounterPanel
        state={state}
        encounter={state.encounter!}
        player={player}
        enemy={enemy}
        onAttack={() => undefined}
        onFlee={() => undefined}
        onGuard={() => undefined}
        onSkill={() => undefined}
        onClose={() => undefined}
      />,
    ));

    expect(container.querySelector('.combatant-player')?.getAttribute('data-visual-state')).toBe('portrait');
    expect(container.querySelector('.combatant-enemy')?.getAttribute('data-visual-state')).toBe('portrait');
    expect(container.querySelector('.encounter-player-visual')?.getAttribute('src')).toBe('/assets/characters/scout/portrait.png');
    expect(container.querySelector('.encounter-character-visual')?.getAttribute('src')).toBe('/assets/characters/fighter/portrait.png');
    expect(container.querySelector('.combat-visual-state.state-portrait')?.textContent).toContain('常态');
  });

  it('does not expose an enemy exact HP number in the encounter DOM', () => {
    const { state, player, enemy } = encounterFixture('PHASE4B2-BOUNDARY');
    enemy.hp = 17;
    enemy.maxHp = 100;
    act(() => root.render(
      <EncounterPanel
        state={state}
        encounter={state.encounter!}
        player={player}
        enemy={enemy}
        onAttack={() => undefined}
        onFlee={() => undefined}
        onGuard={() => undefined}
        onSkill={() => undefined}
        onClose={() => undefined}
      />,
    ));

    const enemyText = container.querySelector('.combatant-enemy')?.textContent ?? '';
    expect(enemyText).toContain('重伤');
    expect(enemyText).not.toContain('17/100');
    expect(enemyText).not.toContain('生命 17');
  });
});
