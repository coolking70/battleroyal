/** @vitest-environment jsdom */

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { createGame, getPlayer } from '../src/core/gameState';
import { refreshZoneOccupants } from '../src/core/gameState';
import { VictoryPaths } from '../src/ui/components/VictoryPaths';
import { ResultScreen } from '../src/ui/screens/ResultScreen';
import { give } from './helpers';

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

describe('Phase 4O victory route presentation', () => {
  it('renders exactly three route cards and exposes the public extraction countdown', () => {
    const state = createGame({ seed: 'PHASE4O-UI-COUNTDOWN', playerCharacterId: 'scout' });
    const player = getPlayer(state);
    player.currentZoneId = 'station';
    player.stamina = player.maxStamina;
    give(state, player, 'extraction_beacon');
    state.activeExtraction = {
      callerId: player.id,
      zoneId: 'station',
      startedAtTime: 0,
      readyAtTime: 3,
      phase: 'called',
    };
    refreshZoneOccupants(state);

    act(() => root.render(<VictoryPaths state={state} player={player} onCommand={() => undefined} />));

    expect(container.querySelectorAll('[data-victory-type]')).toHaveLength(3);
    expect(container.textContent).toContain('最后生还者');
    expect(container.textContent).toContain('撤离');
    expect(container.textContent).toContain('研究');
    expect(container.textContent).toContain('公开倒计时 3 回合');
    expect(container.textContent).toContain('仅你可见');
    expect(container.querySelector('button')).toBeNull();
  });

  it('only exposes a route command when the shared legal-action gate allows it', () => {
    const state = createGame({ seed: 'PHASE4O-UI-ACTION', playerCharacterId: 'scout' });
    const player = getPlayer(state);
    player.currentZoneId = 'station';
    player.stamina = player.maxStamina;
    give(state, player, 'extraction_beacon');
    const commands: string[] = [];
    act(() => root.render(
      <VictoryPaths
        state={state}
        player={player}
        onCommand={(command) => commands.push(command.type)}
      />,
    ));

    const call = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '呼叫撤离');
    expect(call).not.toBeUndefined();
    act(() => (call as HTMLButtonElement).click());
    expect(commands).toEqual(['CALL_EXTRACTION']);
  });

  it('uses route-specific result copy for player extraction and an alive-player NPC loss', () => {
    const extraction = createGame({ seed: 'PHASE4O-UI-RESULT-EXTRACTION', playerCharacterId: 'scout' });
    const extractionPlayer = getPlayer(extraction);
    extraction.status = 'won';
    extraction.endReason = 'extraction';
    extraction.endedAtTime = 4;
    extraction.victory = { winnerId: extractionPlayer.id, type: 'extraction', declaredAtTime: 4 };
    act(() => root.render(
      <ResultScreen
        key="extraction"
        state={extraction}
        player={extractionPlayer}
        onRestart={() => undefined}
        onBackToMenu={() => undefined}
      />,
    ));
    expect(container.querySelector('#result-title')?.textContent).toContain('撤离成功');
    expect(container.textContent).toContain('撤离完成');

    const research = createGame({ seed: 'PHASE4O-UI-RESULT-NPC', playerCharacterId: 'scout' });
    const researchPlayer = getPlayer(research);
    const npc = Object.values(research.characters).find((character) => !character.isPlayer)!;
    research.status = 'lost';
    research.endReason = 'research';
    research.endedAtTime = 5;
    research.victory = { winnerId: npc.id, type: 'research', declaredAtTime: 5 };
    act(() => root.render(
      <ResultScreen
        key="research"
        state={research}
        player={researchPlayer}
        onRestart={() => undefined}
        onBackToMenu={() => undefined}
      />,
    ));
    expect(container.querySelector('#result-title')?.textContent).toContain('目标胜利 · 研究');
    expect(container.textContent).toContain('仍存活');
    expect(container.textContent).toContain(npc.name);
    expect(container.textContent).not.toContain('你已被淘汰');
  });

  it('renders an alternative winner at rank one even below other survivors in kills', () => {
    const state = createGame({ seed: 'PHASE4O-UI-RANKING', playerCharacterId: 'scout' });
    const resultPlayer = getPlayer(state);
    const npcs = Object.values(state.characters).filter((character) => !character.isPlayer);
    const winner = npcs[0]!;
    const highKills = npcs[1]!;
    const mediumKills = npcs[2]!;
    winner.kills = 0;
    highKills.kills = 10;
    mediumKills.kills = 5;
    state.status = 'lost';
    state.endReason = 'research';
    state.endedAtTime = 8;
    state.victory = { winnerId: winner.id, type: 'research', declaredAtTime: 8 };

    act(() => root.render(
      <ResultScreen
        state={state}
        player={resultPlayer}
        onRestart={() => undefined}
        onBackToMenu={() => undefined}
      />,
    ));

    const rows = Array.from(container.querySelectorAll('.rank-table tbody tr'));
    expect(rows[0]?.textContent).toContain(winner.name);
    expect(rows[0]?.textContent).toContain('胜者 · 研究');
    expect(rows[1]?.textContent).toContain(highKills.name);
    expect(rows[1]?.textContent).toContain('存活，但路线胜负已结算');
    expect(rows[1]?.textContent).not.toContain('出局');
  });
});
