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
});
