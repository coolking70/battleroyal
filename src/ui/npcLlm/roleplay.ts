import { useEffect, useRef, useState } from 'react';
import { requestKeyOf } from './context';
import { NPC_ROLEPLAY_TIMEOUT_MS, type NpcRoleplayConfig, type NpcRoleplayContext, type NpcRoleplayProvider, type NpcRoleplayRequestKey } from './types';

/**
 * Phase 4W — orchestration.
 *
 * `useNpcRoleplayLine` is presentation-only async enrichment bound to one
 * visible beat: the request identity is (beatId, context fingerprint). When
 * the response arrives after the beat / encounter moved on, it is discarded —
 * an old line is never attached to a new NPC or encounter. Gameplay is never
 * awaited, blocked or mutated.
 */

export interface NpcRoleplayLineState {
  line: string | null;
  pending: boolean;
}

/**
 * One request attempt. The record is the request identity used by every
 * guard: only the attempt that is still `requestRef.current` may write state,
 * so a response belonging to an older beat / NPC / encounter can never be
 * displayed. `cancelled` marks an attempt torn down by effect cleanup — such
 * an attempt never lands, so the same semantic key must be allowed to start
 * again (React StrictMode double-invokes setup → cleanup → setup).
 */
interface NpcRoleplayRequestRecord {
  key: NpcRoleplayRequestKey;
  settled: boolean;
  cancelled: boolean;
  /** Restarts already spent on this key after cleanup cancellations. */
  restarts: number;
}

/**
 * Upper bound on cleanup-driven restarts of one semantic key. StrictMode
 * needs exactly one; the cap keeps a pathological re-render loop from turning
 * a single visible beat into an unbounded request storm.
 */
const MAX_CANCELLED_RESTARTS = 2;

function sameRequestKey(a: NpcRoleplayRequestKey, b: NpcRoleplayRequestKey): boolean {
  return a.beatId === b.beatId && a.fingerprint === b.fingerprint;
}

export function useNpcRoleplayLine(
  provider: NpcRoleplayProvider | null,
  beatId: string | null,
  context: NpcRoleplayContext | null,
): NpcRoleplayLineState {
  const [state, setState] = useState<NpcRoleplayLineState>({ line: null, pending: false });
  const requestRef = useRef<NpcRoleplayRequestRecord | null>(null);

  useEffect(() => {
    // No provider / no visible enemy beat → nothing, immediately.
    if (!provider || !beatId || !context) {
      requestRef.current = null;
      setState((previous) => (previous.line === null && !previous.pending
        ? previous
        : { line: null, pending: false }));
      return;
    }
    const key = requestKeyOf(beatId, context);
    const previous = requestRef.current;
    const isSameKey = previous !== null && sameRequestKey(previous.key, key);
    if (isSameKey && !previous.cancelled) {
      // Same visible moment already in flight or already answered → no
      // duplicate call, and the displayed line is kept as-is.
      return;
    }
    if (isSameKey && previous.restarts >= MAX_CANCELLED_RESTARTS) {
      // Storm guard: refuse to keep re-issuing the very same beat.
      return;
    }
    const record: NpcRoleplayRequestRecord = {
      key,
      settled: false,
      cancelled: false,
      restarts: isSameKey ? previous.restarts + 1 : 0,
    };
    requestRef.current = record;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NPC_ROLEPLAY_TIMEOUT_MS);
    /** Only the live, non-cancelled attempt may display. */
    const isLive = (): boolean => requestRef.current === record && !record.cancelled;
    setState({ line: null, pending: true });
    provider
      .generateNpcLine(context, controller.signal)
      .then((line) => {
        clearTimeout(timer);
        record.settled = true;
        if (isLive()) setState({ line, pending: false });
      })
      .catch(() => {
        clearTimeout(timer);
        record.settled = true;
        if (isLive()) setState({ line: null, pending: false });
      });
    return () => {
      clearTimeout(timer);
      if (!record.settled) {
        // Torn down before landing: this attempt is void, so the same
        // semantic key is free to be requested again on the next setup.
        record.cancelled = true;
      }
      controller.abort();
    };
  }, [provider, beatId, context]);

  return state;
}

/* ------------------------------------------------------------------ */
/* Experimental settings — browser memory only.                        */
/* ------------------------------------------------------------------ */

export const DEFAULT_NPC_ROLEPLAY_CONFIG: NpcRoleplayConfig = {
  enabled: false,
  endpoint: '',
  model: '',
  apiKey: undefined,
};

type Listener = (config: NpcRoleplayConfig) => void;

/**
 * Session-memory store. Deliberately NOT localStorage: the API key must
 * vanish on refresh, never reach saves, events, URLs or the repository.
 */
class NpcRoleplaySettingsStore {
  private config: NpcRoleplayConfig = { ...DEFAULT_NPC_ROLEPLAY_CONFIG };
  private listeners = new Set<Listener>();

  get(): NpcRoleplayConfig {
    return { ...this.config };
  }

  set(patch: Partial<NpcRoleplayConfig>): void {
    this.config = { ...this.config, ...patch };
    for (const listener of this.listeners) listener(this.get());
  }

  /** Test hook: restore the OFF default. */
  reset(): void {
    this.config = { ...DEFAULT_NPC_ROLEPLAY_CONFIG };
    for (const listener of this.listeners) listener(this.get());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const npcRoleplaySettings = new NpcRoleplaySettingsStore();
