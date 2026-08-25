/** @vitest-environment jsdom */

/**
 * Phase 4W — optional LLM NPC roleplay layer regressions.
 *
 * The layer is presentation-only: every test here also proves that the
 * authoritative GameState, formal action trace, RNG and saves stay untouched
 * whether the provider succeeds, fails, hangs or leaks nothing.
 */

import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { allCharacters, createGame, getPlayer } from '../src/core/gameState';
import { executeCommand } from '../src/core/gameEngine';
import { pushEvent } from '../src/core/events';
import { visibleEventsForPlayer } from '../src/ui/components/EventLog';
import { buildEncounterPresentation } from '../src/ui/encounterPresentation';
import { getZoneDef } from '../src/data/zones';
import {
  contextFingerprint,
  contextFromEncounterBeat,
  contextFromLocalIncidentEvent,
} from '../src/ui/npcLlm/context';
import {
  createMockNpcRoleplayProvider,
  isNpcRoleplayConfigUsable,
  providerFromConfig,
  sanitizeNpcLine,
} from '../src/ui/npcLlm/provider';
import { createOpenAiCompatibleProvider } from '../src/ui/npcLlm/openAiCompatibleProvider';
import { npcRoleplaySettings, useNpcRoleplayLine } from '../src/ui/npcLlm/roleplay';
import type { NpcRoleplayConfig, NpcRoleplayContext, NpcRoleplayProvider } from '../src/ui/npcLlm/types';
import type { GameState } from '../src/core/types';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  npcRoleplaySettings.reset();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => {
    if (root) root.unmount();
  });
  root = null;
  container?.remove();
  container = null;
});

function encounterFixture(seed: string): { state: GameState; enemyId: string } {
  const state = createGame({ seed, playerCharacterId: 'scout', playerName: '测试者' });
  const player = getPlayer(state);
  const enemy = allCharacters(state).find((character) => !character.isPlayer)!;
  enemy.currentZoneId = player.currentZoneId;
  state.zones[player.currentZoneId]!.aliveCharacterIds = [player.id, enemy.id];
  state.encounter = {
    enemyId: enemy.id,
    zoneId: player.currentZoneId,
    startedAtTime: state.time,
    log: [],
    resolved: false,
  };
  pushEvent(state, {
    type: 'ENCOUNTER_STARTED',
    actorId: player.id,
    targetId: enemy.id,
    zoneId: player.currentZoneId,
    importance: 'minor',
    message: `你与 ${enemy.name} 进入交战。`,
    metadata: { enemyId: enemy.id },
  });
  return { state, enemyId: enemy.id };
}

function latestEnemyBeatContext(state: GameState) {
  const player = getPlayer(state);
  const enemy = state.characters[state.encounter!.enemyId]!;
  const presentation = buildEncounterPresentation({
    encounter: state.encounter!,
    player,
    enemy,
    currentTime: state.time,
    zoneName: getZoneDef(state.encounter!.zoneId).name,
    visibleEvents: visibleEventsForPlayer(state.events, state.playerId),
  });
  for (const beat of presentation.beats.slice().reverse()) {
    const context = contextFromEncounterBeat({
      npcName: enemy.name,
      zoneName: getZoneDef(state.encounter!.zoneId).name,
      personality: enemy.personality,
      beat,
    });
    if (context) return { beatId: beat.id, context };
  }
  return null;
}

/** Rerender-capable probe (the simple one above is fixed-args). */
function makeProbe(provider: NpcRoleplayProvider | null) {
  let output = { line: null as string | null, pending: false };
  let currentBeatId: string | null = null;
  let currentContext: NpcRoleplayContext | null = null;
  const api = {
    set(beatId: string | null, context: NpcRoleplayContext | null): void {
      currentBeatId = beatId;
      currentContext = context;
      act(() => root!.render(<Probe />));
    },
    get(): { line: string | null; pending: boolean } {
      return output;
    },
  };
  function Probe(): JSX.Element {
    const state = useNpcRoleplayLine(provider, currentBeatId, currentContext);
    output = state;
    return <div data-hook-line={state.line ?? ''} data-hook-pending={String(state.pending)}>{state.line ?? ''}</div>;
  }
  root = createRoot(container!);
  return api;
}

/**
 * AF1-1 probe rendered inside a REAL <StrictMode> tree, so React double-invokes
 * effect setup → cleanup → setup exactly as it does in src/main.tsx.
 */
function makeStrictProbe(provider: NpcRoleplayProvider | null) {
  let output = { line: null as string | null, pending: false };
  let renders = 0;
  let currentBeatId: string | null = null;
  let currentContext: NpcRoleplayContext | null = null;
  function Probe(): JSX.Element {
    const state = useNpcRoleplayLine(provider, currentBeatId, currentContext);
    output = state;
    renders += 1;
    return <div>{state.line ?? ''}</div>;
  }
  root = createRoot(container!);
  return {
    set(beatId: string | null, context: NpcRoleplayContext | null): void {
      currentBeatId = beatId;
      currentContext = context;
      act(() => root!.render(<StrictMode><Probe /></StrictMode>));
    },
    get(): { line: string | null; pending: boolean } {
      return output;
    },
    renderCount(): number {
      return renders;
    },
  };
}

async function flushAsync(): Promise<void> {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
}

function scriptedRun(seed: string, onTurn?: (state: GameState) => void): GameState {
  const state = createGame({ seed, playerCharacterId: 'scout', playerName: '测试者' });
  const commands = [
    { type: 'SEARCH' } as const,
    { type: 'REST' } as const,
    { type: 'SEARCH' } as const,
    { type: 'MOVE', zoneId: getZoneDef(getPlayer(state).currentZoneId).adjacent[0]! } as const,
  ];
  for (const command of commands) {
    executeCommand(state, command);
    onTurn?.(state);
  }
  return state;
}

describe('Phase 4W — optional LLM NPC roleplay layer', () => {

  it('W-1 OFF: provider 0 calls and gameplay stays byte-identical', async () => {
    const calls: NpcRoleplayContext[] = [];
    const mock = createMockNpcRoleplayProvider({ respond: () => '别发呆。', calls });
    const { state } = encounterFixture('PHASE4W-W1');
    const target = latestEnemyBeatContext(state)!;
    expect(target).not.toBeNull();
    // OFF: the app resolves no provider (settings default OFF), so even with
    // a configured backend available the layer makes zero calls.
    const probe = makeProbe(npcRoleplaySettings.get().enabled ? mock : null);
    probe.set(target.beatId, target.context);
    await flushAsync();
    expect(probe.get().line).toBeNull();
    expect(calls.length).toBe(0);
    // The presentation pipeline exercised between turns changes nothing.
    const baseline = scriptedRun('PHASE4W-W1B');
    const withLayer = scriptedRun('PHASE4W-W1B', (current) => {
      const event = visibleEventsForPlayer(current.events, current.playerId).at(-1);
      if (event) sanitizeNpcLine('演练台词，不影响状态。');
    });
    expect(JSON.stringify(withLayer)).toBe(JSON.stringify(baseline));
  });

  it('W-2 a visible local encounter beat triggers exactly one sanitized call and shows the line', async () => {
    const calls: NpcRoleplayContext[] = [];
    const mock = createMockNpcRoleplayProvider({ respond: () => '别发呆，我可不会给你第二次机会。', calls });
    const { state } = encounterFixture('PHASE4W-W2');
    const target = latestEnemyBeatContext(state)!;
    const probe = makeProbe(mock);
    probe.set(target.beatId, target.context);
    await flushAsync();
    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual(target.context);
    expect(probe.get().line).toBe('别发呆，我可不会给你第二次机会。');
    expect(container!.textContent).toContain('别发呆');
    // Re-setting the same beat does not duplicate the request.
    probe.set(target.beatId, target.context);
    await flushAsync();
    expect(calls.length).toBe(1);
  });

  it('W-3 hidden / remote NPC events trigger zero provider calls', async () => {
    const calls: NpcRoleplayContext[] = [];
    const mock = createMockNpcRoleplayProvider({ respond: () => '这里不值得继续耗下去。', calls });
    const { state } = encounterFixture('PHASE4W-W3');
    const player = getPlayer(state);
    const enemy = state.characters[state.encounter!.enemyId]!;
    // A remote-zone incident claim is not a local contest.
    const remoteEvent = state.events[0]!;
    const remote = contextFromLocalIncidentEvent({
      npcName: enemy.name, zoneName: '某区域', personality: enemy.personality,
      event: { ...remoteEvent, type: 'INCIDENT_CLAIMED', actorId: enemy.id, zoneId: 'somewhere-else' } as never,
      playerZoneId: player.currentZoneId,
    });
    expect(remote).toBeNull();
    // Player-side and non-trigger beats produce no context at all.
    const playerBeat = { id: 'b1', time: 1, kind: 'hit' as const, side: 'player' as const, icon: '', title: '你的重击命中', detail: '' };
    expect(contextFromEncounterBeat({
      npcName: enemy.name, zoneName: '某区域', personality: enemy.personality, beat: playerBeat,
    })).toBeNull();
    const probe = makeProbe(mock);
    probe.set(null, null);
    await flushAsync();
    expect(calls.length).toBe(0);
    expect(probe.get().line).toBeNull();
  });

  it('W-4 twin worlds: identical visible history, divergent hidden runtime → identical context', () => {
    const { state } = encounterFixture('PHASE4W-W4');
    const twin = structuredClone(state);
    const enemyA = state.characters[state.encounter!.enemyId]!;
    const enemyB = twin.characters[twin.encounter!.enemyId]!;
    // Hidden divergence: live HP, inventory, intent, memory, real position.
    enemyA.hp = 88; enemyB.hp = 3;
    enemyA.inventory = []; enemyB.inventory = enemyB.inventory.slice(0, 1);
    enemyB.strategicIntent = { type: 'hunt_known_target', reason: 'KNOWN_TARGET', targetId: 'p0', committedAt: 1, reevaluateAt: 7 };
    enemyA.strategicIntent = null;
    enemyB.knowledgeMemory.entries = [];
    enemyB.currentZoneId = 'factory';
    const contextA = latestEnemyBeatContext(state)!;
    const contextB = latestEnemyBeatContext(twin)!;
    expect(contextA.context).toEqual(contextB.context);
    expect(contextFingerprint(contextA.context)).toBe(contextFingerprint(contextB.context));
  });

  it('W-5 the sanitized context never contains forbidden runtime fields', () => {
    const { state } = encounterFixture('PHASE4W-W5');
    const target = latestEnemyBeatContext(state)!;
    const serialized = JSON.stringify(target.context);
    for (const forbidden of ['strategicIntent', 'knowledgeMemory', 'inventory', 'remainingHp', 'currentZoneId', 'hp', 'stamina']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(serialized).not.toMatch(/\d/); // no numeric intel of any kind
    // Allowed: display name, visible zone, public beat, tone hint.
    expect(target.context.npcName).toBe(state.characters[state.encounter!.enemyId]!.name);
  });

  it('W-6 timeout / exception / malformed content never touch GameState and fall back silently', async () => {
    const { state } = encounterFixture('PHASE4W-W6');
    const before = JSON.stringify(state);
    const target = latestEnemyBeatContext(state)!;
    const failing = createMockNpcRoleplayProvider({ respond: () => { throw new Error('network down'); } });
    const probeA = makeProbe(failing);
    probeA.set(target.beatId, target.context);
    await flushAsync();
    expect(probeA.get().line).toBeNull();
    expect(probeA.get().pending).toBe(false);
    // Malformed / over-long / numeric responses are rejected by the sanitizer.
    expect(sanitizeNpcLine('')).toBeNull();
    expect(sanitizeNpcLine('{"line":"json"}')).toBeNull();
    expect(sanitizeNpcLine('# 你HP剩30点，快逃！')).toBeNull();
    expect(sanitizeNpcLine(`这是一段${'很'.repeat(80)}长的台词，超过了长度限制，必须被拒绝。`)).toBeNull();
    expect(JSON.stringify(state)).toBe(before);
    // A formal action still proceeds normally while the layer failed.
    const res = executeCommand(state, { type: 'GUARD' } as never);
    expect(res.ok).toBe(true);
  });

  it('W-7 a stale async response is discarded and never attaches to the new encounter', async () => {
    const { state } = encounterFixture('PHASE4W-W7');
    const first = latestEnemyBeatContext(state)!;
    const slow = createMockNpcRoleplayProvider({
      respond: (context) => (context.trigger === 'encounter_start' ? '旧的遭遇台词。' : '新的遭遇台词。'),
      delayMs: 120,
    });
    const probe = makeProbe(slow);
    probe.set(first.beatId, first.context);
    // The encounter moves on before the first response lands.
    const second = { beatId: 'beat-new-encounter', context: { ...first.context, beatTitle: '敌方命中', trigger: 'npc_attack_hit' } as NpcRoleplayContext };
    probe.set(second.beatId, second.context);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await act(async () => { await Promise.resolve(); });
    // Only the new beat's line may display; the stale one was discarded.
    expect(probe.get().line).toBe('新的遭遇台词。');
    expect(container!.textContent).not.toContain('旧的遭遇台词。');
  });

  it('W-8 the API key never reaches saves, events, localStorage, logs or the wire payload', async () => {
    const config: NpcRoleplayConfig = {
      enabled: true,
      endpoint: 'https://llm.example.test/v1',
      model: 'test-model',
      apiKey: 'sk-SECRET-4W-KEY',
    };
    const storageSpy = jestSpyLocalStorage();
    const provider = createOpenAiCompatibleProvider(config);
    const { state } = encounterFixture('PHASE4W-W8');
    const target = latestEnemyBeatContext(state)!;
    // The outgoing context payload (what a provider may log) has no key.
    const serialized = JSON.stringify(target.context);
    expect(serialized).not.toContain('sk-SECRET-4W-KEY');
    // The settings store is memory-only: no localStorage writes.
    npcRoleplaySettings.set(config);
    expect(storageSpy.writes.length).toBe(0);
    // Save data and GameEvents stay clean.
    const saveBlob = JSON.stringify(state);
    expect(saveBlob).not.toContain('sk-SECRET-4W-KEY');
    expect(state.events.every((event) => !JSON.stringify(event).includes('sk-SECRET-4W-KEY'))).toBe(true);
    // The fetch itself carries the key ONLY in the Authorization header.
    const sent = await captureFetch(provider, target.context);
    expect(sent.url).toBe('https://llm.example.test/v1/chat/completions');
    expect(sent.body).not.toContain('sk-SECRET-4W-KEY');
    expect(sent.authHeader).toBe('Bearer sk-SECRET-4W-KEY');
    // Rendered DOM never shows the key (settings panel input is type=password).
    expect(document.body.textContent ?? '').not.toContain('sk-SECRET-4W-KEY');
    storageSpy.restore();
  });

  it('W-9 different mock texts over the same history leave the authoritative state identical', async () => {
    const providerA = createMockNpcRoleplayProvider({ respond: () => '一句完全不同的台词甲。' });
    const providerB = createMockNpcRoleplayProvider({ respond: () => '另一句完全不同的台词乙！' });
    const runA = scriptedRun('PHASE4W-W9', () => { providerA.generateNpcLine({ npcName: 'n', zoneName: 'z', trigger: 'npc_guard', beatTitle: 'GUARD', tone: '直率好斗', language: 'zh-CN' }, new AbortController().signal).catch(() => undefined); });
    const runB = scriptedRun('PHASE4W-W9', () => { providerB.generateNpcLine({ npcName: 'n', zoneName: 'z', trigger: 'npc_guard', beatTitle: 'GUARD', tone: '难以捉摸', language: 'zh-CN' }, new AbortController().signal).catch(() => undefined); });
    await flushAsync();
    expect(JSON.stringify(runA)).toBe(JSON.stringify(runB));
  });

  /* ---------------------------------------------------------------- */
  /* AF1-1 — React StrictMode request lifecycle                        */
  /* ---------------------------------------------------------------- */

  it('AF1-1a StrictMode: a working provider still resolves — never stuck pending', async () => {
    const calls: NpcRoleplayContext[] = [];
    // delayMs makes the provider genuinely abortable, so the StrictMode
    // cleanup really does cancel the first attempt (an instant provider would
    // have already resolved and would hide the bug).
    const mock = createMockNpcRoleplayProvider({ respond: () => '你走错地方了。', calls, delayMs: 30 });
    const { state } = encounterFixture('PHASE4W-AF1A');
    const target = latestEnemyBeatContext(state)!;
    const probe = makeStrictProbe(mock);
    probe.set(target.beatId, target.context);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
    // Before the fix the StrictMode remount suppressed the retry of the
    // aborted first attempt and the hook stayed pending forever.
    expect(probe.get().line).toBe('你走错地方了。');
    expect(probe.get().pending).toBe(false);
    expect(container!.textContent).toContain('你走错地方了。');
  });

  it('AF1-1b a cleanup-aborted request does not block a legitimate retry of the same key', async () => {
    const calls: NpcRoleplayContext[] = [];
    // Slow enough that the StrictMode cleanup aborts the first attempt.
    const mock = createMockNpcRoleplayProvider({ respond: () => '再靠近一步试试。', calls, delayMs: 30 });
    const { state } = encounterFixture('PHASE4W-AF1B');
    const target = latestEnemyBeatContext(state)!;
    const probe = makeStrictProbe(mock);
    probe.set(target.beatId, target.context);
    // StrictMode issued setup → cleanup(abort) → setup: the second attempt for
    // the SAME semantic key must have been allowed to start.
    expect(calls.length).toBe(2);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 120)); });
    expect(probe.get().line).toBe('再靠近一步试试。');
    expect(probe.get().pending).toBe(false);
    // The aborted attempt's rejection never wrote null over the live line.
    await flushAsync();
    expect(probe.get().line).toBe('再靠近一步试试。');
  });

  it('AF1-1c StrictMode: a stale response never bleeds into the new encounter', async () => {
    const { state } = encounterFixture('PHASE4W-AF1C');
    const first = latestEnemyBeatContext(state)!;
    const slow = createMockNpcRoleplayProvider({
      respond: (context) => (context.trigger === 'encounter_start' ? '旧遭遇的台词。' : '新遭遇的台词。'),
      delayMs: 120,
    });
    const probe = makeStrictProbe(slow);
    probe.set(first.beatId, first.context);
    const second = {
      beatId: 'af1c-new-encounter',
      context: { ...first.context, npcName: '另一个对手', beatTitle: '敌方命中', trigger: 'npc_attack_hit' } as NpcRoleplayContext,
    };
    probe.set(second.beatId, second.context);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 320)); });
    expect(probe.get().line).toBe('新遭遇的台词。');
    expect(container!.textContent).not.toContain('旧遭遇的台词。');
    // And a later null target clears rather than resurrecting anything.
    probe.set(null, null);
    await flushAsync();
    expect(probe.get().line).toBeNull();
  });

  it('AF1-1d one valid beat never produces a request storm, even under repeated re-render', async () => {
    const calls: NpcRoleplayContext[] = [];
    const mock = createMockNpcRoleplayProvider({ respond: () => '安静点，别乱动。', calls });
    const { state } = encounterFixture('PHASE4W-AF1D');
    const target = latestEnemyBeatContext(state)!;
    const probe = makeStrictProbe(mock);
    probe.set(target.beatId, target.context);
    await flushAsync();
    const afterFirst = calls.length;
    // StrictMode costs at most one extra attempt for the aborted setup.
    expect(afterFirst).toBeLessThanOrEqual(2);
    // Re-rendering the same semantic key many times (fresh context objects
    // with an identical fingerprint) must add zero further calls.
    for (let index = 0; index < 12; index += 1) {
      probe.set(target.beatId, { ...target.context });
      await flushAsync();
    }
    expect(calls.length).toBe(afterFirst);
    expect(probe.get().line).toBe('安静点，别乱动。');
    expect(probe.renderCount()).toBeGreaterThan(0);
  });

  /* ---------------------------------------------------------------- */
  /* AF1-2 — no API key ⇒ zero network calls                           */
  /* ---------------------------------------------------------------- */

  it('AF1-2a provider resolution is null for disabled / blank endpoint / blank model / blank key', () => {
    const base: NpcRoleplayConfig = {
      enabled: true,
      endpoint: 'https://llm.example.test/v1',
      model: 'test-model',
      apiKey: 'sk-AF1-KEY',
    };
    const resolve = (config: NpcRoleplayConfig): NpcRoleplayProvider | null =>
      providerFromConfig(config, createOpenAiCompatibleProvider);
    expect(resolve(base)).not.toBeNull();
    expect(resolve({ ...base, enabled: false })).toBeNull();
    expect(resolve({ ...base, endpoint: '' })).toBeNull();
    expect(resolve({ ...base, endpoint: '   ' })).toBeNull();
    expect(resolve({ ...base, model: '' })).toBeNull();
    expect(resolve({ ...base, model: '  \t ' })).toBeNull();
    expect(resolve({ ...base, apiKey: undefined })).toBeNull();
    expect(resolve({ ...base, apiKey: '' })).toBeNull();
    expect(resolve({ ...base, apiKey: '   ' })).toBeNull();
    expect(providerFromConfig(null, createOpenAiCompatibleProvider)).toBeNull();
    // Same rule set is what the settings panel and the provider itself use.
    expect(isNpcRoleplayConfigUsable({ ...base, apiKey: '   ' })).toBe(false);
    expect(isNpcRoleplayConfigUsable(base)).toBe(true);
  });

  it('AF1-2b enabled + endpoint + model but no API key ⇒ 0 fetch, presentation and GameState intact', async () => {
    const { state } = encounterFixture('PHASE4W-AF12B');
    const before = JSON.stringify(state);
    const target = latestEnemyBeatContext(state)!;
    const fetchCalls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      fetchCalls.push(String(input));
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      for (const apiKey of [undefined, '', '   ']) {
        npcRoleplaySettings.reset();
        npcRoleplaySettings.set({
          enabled: true,
          endpoint: 'https://llm.example.test/v1',
          model: 'test-model',
          apiKey,
        });
        const provider = providerFromConfig(npcRoleplaySettings.get(), createOpenAiCompatibleProvider);
        expect(provider).toBeNull();
        const probe = makeStrictProbe(provider);
        probe.set(target.beatId, target.context);
        await flushAsync();
        expect(probe.get().line).toBeNull();
        expect(probe.get().pending).toBe(false);
        act(() => { root!.unmount(); });
        root = null;
      }
      expect(fetchCalls.length).toBe(0);
      // Even a directly constructed provider refuses to hit the network.
      const raw = createOpenAiCompatibleProvider({
        enabled: true, endpoint: 'https://llm.example.test/v1', model: 'test-model', apiKey: '   ',
      });
      await expect(raw.generateNpcLine(target.context, new AbortController().signal)).rejects.toThrow();
      expect(fetchCalls.length).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
    // The existing Phase 4V presentation is unchanged and so is GameState.
    expect(latestEnemyBeatContext(state)!.context).toEqual(target.context);
    expect(JSON.stringify(state)).toBe(before);
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function jestSpyLocalStorage(): { writes: string[]; restore: () => void } {
  // Install a controllable in-memory storage surface (the jsdom default may
  // be unavailable) and count every write through it.
  const writes: string[] = [];
  const backing = new Map<string, string>();
  const stub: Storage = {
    get length() { return backing.size; },
    clear: () => backing.clear(),
    getItem: (key) => backing.get(key) ?? null,
    key: (index) => [...backing.keys()][index] ?? null,
    removeItem: (key) => { backing.delete(key); },
    setItem: (key: string, value: string) => { writes.push(`${key}=${value}`); backing.set(key, value); },
  };
  const previous = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', { value: stub, configurable: true });
  return {
    writes,
    restore: () => {
      if (previous) Object.defineProperty(window, 'localStorage', previous);
      else delete (window as unknown as { localStorage?: Storage }).localStorage;
    },
  };
}

async function captureFetch(
  provider: NpcRoleplayProvider,
  context: NpcRoleplayContext,
): Promise<{ url: string; body: string; authHeader: string }> {
  const captured = { url: '', body: '', authHeader: '' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.url = String(input);
    captured.body = typeof init?.body === 'string' ? init.body : '';
    captured.authHeader = (init?.headers as Record<string, string>)?.Authorization ?? '';
    return new Response(JSON.stringify({ choices: [{ message: { content: '收到，撤退。' } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const line = await provider.generateNpcLine(context, new AbortController().signal);
    expect(line).toBe('收到，撤退。');
  } finally {
    globalThis.fetch = originalFetch;
  }
  return captured;
}
