/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGame, refreshZoneOccupants } from '../src/core/gameState';
import { SeededRandom } from '../src/core/random';
import { runNpcTurn } from '../src/core/npcAi';
import { tickIncidents } from '../src/core/incidents';
import { observeIncidentsInZone } from '../src/core/incidentVisibility';
import { IncidentPanel } from '../src/ui/components/IncidentPanel';
import { DebugPanel } from '../src/ui/components/DebugPanel';
import { getIncidentDef } from '../src/data/incidents';
import type { Combatant, GameState } from '../src/core/types';

let container: HTMLDivElement;
let root: Root;

function npcOf(state: GameState, index = 0): Combatant {
  return Object.values(state.characters).filter((actor) => !actor.isPlayer)[index]!;
}

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

describe('Phase 4T incident UI information boundary', () => {
  it('shows nothing when the player has not legally learned any incident', () => {
    const state = createGame({ seed: 'PHASE4T-UI-1', playerCharacterId: 'scout' });
    const player = state.characters[state.playerId]!;
    // Move the player to a zone whose LOCAL incident is only SCHEDULED.
    player.currentZoneId = 'factory';
    refreshZoneOccupants(state);
    act(() => {
      root.render(<IncidentPanel state={state} player={player} disabled={false} onCommand={() => {}} />);
    });
    expect(container.textContent).not.toContain('机修车间紧急抢救');
    expect(container.textContent).not.toContain('医院急诊窗口');
  });

  it('shows a coarse public notice after a PUBLIC_BROADCAST activation, without hidden runtime', () => {
    const state = createGame({ seed: 'PHASE4T-UI-2', playerCharacterId: 'scout' });
    const player = state.characters[state.playerId]!;
    player.currentZoneId = 'school';
    refreshZoneOccupants(state);
    const def = getIncidentDef('hospital_emergency');
    state.time = state.incidents[def.id]!.scheduledAt;
    tickIncidents(state);
    act(() => {
      root.render(<IncidentPanel state={state} player={player} disabled={false} onCommand={() => {}} />);
    });
    expect(container.textContent).toContain('医院急诊窗口');
    expect(container.textContent).toContain('进行中');
    // Coarse only: never the exact remaining overlay charges or reward counts.
    expect(container.textContent).not.toContain('overlay');
    expect(container.textContent).not.toContain('reward 2');
    // The player is not in the incident zone, so no interaction button.
    expect(container.querySelector('[data-action="resolve-incident"]')).toBeNull();
  });

  it('keeps a stale last-known notice after remote resolution without refresh', () => {
    const state = createGame({ seed: 'PHASE4T-UI-3', playerCharacterId: 'scout' });
    const player = state.characters[state.playerId]!;
    player.currentZoneId = 'school';
    refreshZoneOccupants(state);
    const def = getIncidentDef('hospital_emergency');
    const rt = state.incidents[def.id]!;
    state.time = rt.scheduledAt;
    tickIncidents(state);
    // Another actor resolves it remotely; the player has no legal refresh.
    rt.status = 'RESOLVED';
    rt.resolvedAt = state.time;
    act(() => {
      root.render(<IncidentPanel state={state} player={player} disabled={false} onCommand={() => {}} />);
    });
    // Last-known memory still says active (stale), which is correct.
    expect(container.textContent).toContain('进行中');
  });

  it('renders the debug incident inspector only in the debug panel surface', () => {
    const state = createGame({ seed: 'PHASE4T-UI-4', playerCharacterId: 'scout' });
    const player = state.characters[state.playerId]!;
    const def = getIncidentDef('lab_containment');
    state.time = state.incidents[def.id]!.scheduledAt;
    tickIncidents(state);
    act(() => {
      root.render(
        <DebugPanel
          state={state}
          saveError={null}
          onCommand={() => {}}
        />,
      );
    });
    expect(container.querySelector('[data-debug-incident-runtime]')).not.toBeNull();
    expect(container.querySelector('[data-debug-incident-memory]')).not.toBeNull();
    expect(container.textContent).toContain('lab_containment');

    // The normal player panel never mounts a debug inspector.
    const normal = document.createElement('div');
    document.body.appendChild(normal);
    const normalRoot = createRoot(normal);
    act(() => {
      normalRoot.render(<IncidentPanel state={state} player={player} disabled={false} onCommand={() => {}} />);
    });
    expect(normal.querySelector('[data-debug-incident-runtime]')).toBeNull();
    expect(normal.querySelector('[data-debug-incident-memory]')).toBeNull();
    expect(normal.textContent).not.toContain('claims');
    act(() => normalRoot.unmount());
    normal.remove();
  });

  it('never renders another actor private incident memory or intent in normal UI', () => {
    const state = createGame({ seed: 'PHASE4T-UI-5', playerCharacterId: 'scout' });
    const player = state.characters[state.playerId]!;
    player.currentZoneId = 'school';
    refreshZoneOccupants(state);
    const npc = npcOf(state, 0);
    npc.currentZoneId = 'factory';
    refreshZoneOccupants(state);
    const def = getIncidentDef('factory_salvage');
    const rt = state.incidents[def.id]!;
    state.time = rt.scheduledAt;
    tickIncidents(state);
    observeIncidentsInZone(state, npc);
    runNpcTurn(state, npc, new SeededRandom('PHASE4T-UI-5-NPC'));
    act(() => {
      root.render(<IncidentPanel state={state} player={player} disabled={false} onCommand={() => {}} />);
    });
    // The player has no legal knowledge of the LOCAL factory incident.
    expect(container.textContent).not.toContain('机修车间紧急抢救');
    expect(container.textContent).not.toContain(npc.name);
    expect(container.textContent).not.toContain('respond_to_incident');
  });
});
