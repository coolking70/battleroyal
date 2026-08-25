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

export function useNpcRoleplayLine(
  provider: NpcRoleplayProvider | null,
  beatId: string | null,
  context: NpcRoleplayContext | null,
): NpcRoleplayLineState {
  const [state, setState] = useState<NpcRoleplayLineState>({ line: null, pending: false });
  const activeKeyRef = useRef<NpcRoleplayRequestKey | null>(null);

  useEffect(() => {
    // No provider / no visible enemy beat → nothing, immediately.
    if (!provider || !beatId || !context) {
      activeKeyRef.current = null;
      setState((previous) => (previous.line === null && !previous.pending
        ? previous
        : { line: null, pending: false }));
      return;
    }
    const key = requestKeyOf(beatId, context);
    // Same visible moment already handled (or in flight) → no duplicate call.
    if (activeKeyRef.current !== null && activeKeyRef.current.fingerprint === key.fingerprint
      && activeKeyRef.current.beatId === key.beatId) {
      return;
    }
    activeKeyRef.current = key;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NPC_ROLEPLAY_TIMEOUT_MS);
    setState({ line: null, pending: true });
    provider
      .generateNpcLine(context, controller.signal)
      .then((line) => {
        clearTimeout(timer);
        // Stale guard: only the still-active visible moment may display.
        if (activeKeyRef.current?.beatId === key.beatId
          && activeKeyRef.current.fingerprint === key.fingerprint) {
          setState({ line, pending: false });
        }
      })
      .catch(() => {
        clearTimeout(timer);
        if (activeKeyRef.current?.beatId === key.beatId
          && activeKeyRef.current.fingerprint === key.fingerprint) {
          setState({ line: null, pending: false });
        }
      });
    return () => {
      clearTimeout(timer);
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
