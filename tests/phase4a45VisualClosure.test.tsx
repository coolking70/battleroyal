/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { allCharacters, createGame, getPlayer } from '../src/core/gameState';
import { CHARACTERS } from '../src/data/characters';
import { ITEMS } from '../src/data/items';
import { LEGACY_ZONE_IDS } from '../src/data/zones';
import { WORLD_EVENT_IDS } from '../src/core/worldEvents';
import { buildCombatActionBar } from '../src/ui/combatActionsPresentation';
import { EncounterHero } from '../src/ui/components/EncounterHero';
import { StatusBar } from '../src/ui/components/StatusBar';
import { resolveCharacterVisualState, INJURED_VISUAL_HP_RATIO } from '../src/ui/characterVisualState';
import {
  getCharacterVisual,
  getItemVisual,
  getWorldEventVisual,
  getZoneVisual,
  setAssetManifest,
  type AssetManifest,
} from '../src/ui/visualAssets';
import { loadTasks } from '../tools/art/taskPlanner';

let root: Root;
let container: HTMLDivElement;

async function manifest(): Promise<AssetManifest> {
  return JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
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
  setAssetManifest(null);
});

describe('Phase 4A-4.5 derived character visual state', () => {
  it('uses portrait when healthy and there is no active encounter', () => {
    expect(resolveCharacterVisualState({ hp: 100, maxHp: 100 })).toBe('portrait');
  });

  it('uses combat when healthy and an encounter is active', () => {
    expect(resolveCharacterVisualState({ hp: 100, maxHp: 100 }, { activeEncounter: true })).toBe('combat');
  });

  it('uses injured at the existing UI threshold without an encounter', () => {
    expect(resolveCharacterVisualState({ hp: 35, maxHp: 100 })).toBe('injured');
    expect(INJURED_VISUAL_HP_RATIO).toBe(0.35);
  });

  it('gives injured precedence over combat', () => {
    expect(resolveCharacterVisualState({ hp: 35, maxHp: 100 }, { activeEncounter: true })).toBe('injured');
  });

  it('uses injured for zero-max-health defensive data without changing core state', () => {
    expect(resolveCharacterVisualState({ hp: 0, maxHp: 0 }, { activeEncounter: true })).toBe('injured');
  });

  it('does not add visual state to the save-backed GameState', () => {
    const state = createGame({ seed: 'PHASE4A45-VISUAL', playerCharacterId: 'fighter', playerName: '测试者' });
    expect('visualState' in getPlayer(state)).toBe(false);
    expect(state.version).toBe('0.5.0');
  });

  it('maps all twelve character base slots to official runtime paths', async () => {
    setAssetManifest(await manifest());
    for (const character of CHARACTERS.filter((candidate) => ['scout', 'fighter', 'engineer', 'medic'].includes(candidate.id))) {
      for (const slot of ['portrait', 'injured', 'combat'] as const) {
        const visual = getCharacterVisual(character.id, slot);
        expect(visual.source, `${character.id}/${slot}`).toBe('official');
        expect(visual.image).toBe(`/assets/characters/${character.id}/${slot}.png`);
      }
    }
  });

  it('keeps all legacy zone backgrounds on their approved runtime paths', async () => {
    setAssetManifest(await manifest());
    for (const zoneId of LEGACY_ZONE_IDS) expect(getZoneVisual(zoneId).source).toBe('official');
  });

  it('maps every current Item ArtTask to an official runtime icon', async () => {
    setAssetManifest(await manifest());
    const itemTasks = (await loadTasks(process.cwd())).filter((task) => task.category === 'item');
    expect(itemTasks.length).toBe(12);
    for (const task of itemTasks) {
      expect(getItemVisual(task.entityId).source, task.entityId).toBe('official');
      expect(getItemVisual(task.entityId).image).toBe(`/assets/items/${task.entityId}/icon.png`);
    }
  });

  it('maps five official events and keeps Rain fallback-only', async () => {
    setAssetManifest(await manifest());
    const officialEvents = WORLD_EVENT_IDS.filter((id) => id !== 'rain');
    expect(officialEvents).toHaveLength(5);
    for (const id of officialEvents) expect(getWorldEventVisual(id).source).toBe('official');
    expect(getWorldEventVisual('rain').source).not.toBe('official');
    expect(getWorldEventVisual('rain').image).toBe('events/rain.svg');
  });

  it('keeps unknown runtime IDs safe and non-throwing', () => {
    expect(() => getCharacterVisual('unknown-character', 'combat')).not.toThrow();
    expect(() => getZoneVisual('unknown-zone')).not.toThrow();
    expect(() => getItemVisual('unknown-item')).not.toThrow();
    expect(() => getWorldEventVisual('unknown-event' as never)).not.toThrow();
    expect(getCharacterVisual('unknown-character', 'combat').image).toBe('fallback.svg');
  });

  it('renders player Combat in the real StatusBar consumer during an active encounter', async () => {
    const state = createGame({ seed: 'PHASE4A45-STATUS', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    const enemy = allCharacters(state).find((character) => !character.isPlayer)!;
    state.encounter = { enemyId: enemy.id, zoneId: player.currentZoneId, startedAtTime: state.time, log: [], resolved: false };
    setAssetManifest(await manifest());
    act(() => root.render(<StatusBar state={state} player={player} aliveCount={state.turnOrder.length} onQuit={() => undefined} />));
    expect(container.querySelector('.status-visual')?.getAttribute('src')).toBe('/assets/characters/scout/combat.png');
  });

  it('renders injured before Combat in StatusBar after encounter damage', async () => {
    const state = createGame({ seed: 'PHASE4A45-STATUS-INJURED', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    player.hp = 30;
    const enemy = allCharacters(state).find((character) => !character.isPlayer)!;
    state.encounter = { enemyId: enemy.id, zoneId: player.currentZoneId, startedAtTime: state.time, log: [], resolved: false };
    setAssetManifest(await manifest());
    act(() => root.render(<StatusBar state={state} player={player} aliveCount={state.turnOrder.length} onQuit={() => undefined} />));
    expect(container.querySelector('.status-visual')?.getAttribute('src')).toBe('/assets/characters/scout/injured.png');
  });

  it('renders the visible encounter opponent through the shared Combat/Injured resolver', async () => {
    const state = createGame({ seed: 'PHASE4A45-ENCOUNTER', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    const enemy = allCharacters(state).find((character) => !character.isPlayer)!;
    enemy.characterId = 'fighter';
    state.encounter = { enemyId: enemy.id, zoneId: player.currentZoneId, startedAtTime: state.time, log: [], resolved: false };
    setAssetManifest(await manifest());
    act(() => root.render(
      <EncounterHero
        encounter={state.encounter!}
        player={player}
        enemy={enemy}
        combat={buildCombatActionBar(state, player, enemy)}
      />,
    ));
    expect(container.querySelector('.encounter-enemy-visual')?.getAttribute('src')).toBe('/assets/characters/fighter/combat.png');
  });

  it('uses the injured encounter asset after the visible opponent is low HP', async () => {
    const state = createGame({ seed: 'PHASE4A45-ENCOUNTER-INJURED', playerCharacterId: 'scout', playerName: '测试者' });
    const player = getPlayer(state);
    const enemy = allCharacters(state).find((character) => !character.isPlayer)!;
    enemy.characterId = 'fighter';
    enemy.hp = 1;
    state.encounter = { enemyId: enemy.id, zoneId: player.currentZoneId, startedAtTime: state.time, log: [], resolved: false };
    setAssetManifest(await manifest());
    act(() => root.render(
      <EncounterHero
        encounter={state.encounter!}
        player={player}
        enemy={enemy}
        combat={buildCombatActionBar(state, player, enemy)}
      />,
    ));
    expect(container.querySelector('.encounter-enemy-visual')?.getAttribute('src')).toBe('/assets/characters/fighter/injured.png');
  });

  it('returns from Combat to Portrait when the encounter is resolved and HP is healthy', () => {
    expect(resolveCharacterVisualState({ hp: 100, maxHp: 100 }, { activeEncounter: false })).toBe('portrait');
  });

  it('keeps the final character Manifest shape limited to the three base variants', async () => {
    const loaded = await manifest();
    for (const slots of Object.values(loaded.characters)) expect(Object.keys(slots).sort()).toEqual(['combat', 'injured', 'portrait']);
  });

  it('keeps Zone warning and restricted variants explicitly optional and null', async () => {
    const loaded = await manifest();
    for (const slots of Object.values(loaded.zones)) {
      expect(slots.warning ?? null).toBeNull();
      expect(slots.restricted ?? null).toBeNull();
    }
  });

  it('keeps Rain out of the formal Manifest while preserving its fallback getter', async () => {
    const loaded = await manifest();
    expect(loaded.worldEvents.rain).toBeUndefined();
    expect(getWorldEventVisual('rain').image).toBe('events/rain.svg');
  });

  it('keeps derived visual state absent from serialized player fields', () => {
    const state = createGame({ seed: 'PHASE4A45-SERIALIZE', playerCharacterId: 'medic', playerName: '测试者' });
    const serialized = JSON.stringify(getPlayer(state));
    expect(serialized).not.toContain('visualState');
    expect(serialized).not.toContain('artState');
  });

  it('keeps current gameplay item definitions separate from the 12 current base Item ArtTasks', async () => {
    const tasks = (await loadTasks(process.cwd())).filter((task) => task.category === 'item');
    expect(tasks).toHaveLength(12);
    expect(new Set(tasks.map((task) => task.entityId)).size).toBe(12);
    expect(ITEMS.length).toBeGreaterThan(tasks.length);
  });
});
