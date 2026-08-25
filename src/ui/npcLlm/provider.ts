import type {
  NpcRoleplayConfig,
  NpcRoleplayContext,
  NpcRoleplayProvider,
} from './types';

/**
 * Phase 4W — provider utilities: output sanitation and a deterministic mock.
 *
 * The sanitizer enforces the output contract on EVERY provider (remote
 * included): one very short Chinese line, no Markdown, no JSON, no numeric
 * intel, no system chatter. Anything that fails becomes null → silent
 * fallback to the existing Phase 4V presentation.
 */

const MAX_LINE_LENGTH = 60;
const MAX_SENTENCES = 2;

/**
 * Enforce the output contract. Returns the cleaned line or null when the
 * response is unusable (fallback path — never an error the game must handle).
 */
export function sanitizeNpcLine(raw: string): string | null {
  let line = (raw ?? '').trim();
  if (line.length === 0) return null;
  // Reject JSON / system-style output entirely.
  if (line.startsWith('{') || line.startsWith('[') || line.startsWith('"')) return null;
  if (line.includes('```') || /\w+\s*:\s*["{[]/.test(line)) return null;
  // Strip common Markdown decorations.
  line = line.replace(/[*_`#>~|\[\]]/g, '');
  // One or two short sentences at most.
  const sentences = line
    .split(/(?<=[。！？!?…])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  if (sentences.length === 0) return null;
  line = sentences.slice(0, MAX_SENTENCES).join('');
  // No numeric intel (HP numbers, distances, counts) may leak.
  if (/\d/.test(line)) return null;
  if (line.length > MAX_LINE_LENGTH) return null;
  return line;
}

/** Deterministic mock provider for tests and offline development. */
export interface MockProviderOptions {
  /** Constant or per-context response (already raw — sanitizer still applies). */
  respond: (context: NpcRoleplayContext) => string | Promise<string>;
  delayMs?: number;
  /** Call log for assertions. */
  calls?: NpcRoleplayContext[];
}

export function createMockNpcRoleplayProvider(options: MockProviderOptions): NpcRoleplayProvider {
  return {
    id: 'mock',
    async generateNpcLine(context: NpcRoleplayContext, signal: AbortSignal): Promise<string> {
      options.calls?.push(context);
      if (options.delayMs && options.delayMs > 0) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => resolve(), options.delayMs);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('aborted', 'AbortError'));
          }, { once: true });
        });
      }
      const raw = await options.respond(context);
      const clean = sanitizeNpcLine(raw);
      if (clean === null) throw new Error('mock response rejected by sanitizer');
      return clean;
    },
  };
}

/**
 * The single source of truth for "may this config talk to a backend at all".
 * Every consumer (GameScreen, providerFromConfig, the remote provider itself)
 * goes through this, so there is exactly one rule set and no path that can
 * issue an unauthenticated request.
 *
 * Silent (false) when: disabled, blank endpoint, blank model, or a missing /
 * empty / whitespace-only API key. In every one of those cases the layer must
 * make ZERO fetches and ZERO provider calls.
 */
export function isNpcRoleplayConfigUsable(
  config: NpcRoleplayConfig | null | undefined,
): config is NpcRoleplayConfig {
  if (!config || !config.enabled) return false;
  if (typeof config.endpoint !== 'string' || config.endpoint.trim().length === 0) return false;
  if (typeof config.model !== 'string' || config.model.trim().length === 0) return false;
  if (typeof config.apiKey !== 'string' || config.apiKey.trim().length === 0) return false;
  return true;
}

/** Resolve a provider from user config. Null when the layer must stay silent. */
export function providerFromConfig(
  config: NpcRoleplayConfig | null | undefined,
  dynamic: (config: NpcRoleplayConfig) => NpcRoleplayProvider | null,
): NpcRoleplayProvider | null {
  if (!isNpcRoleplayConfigUsable(config)) return null;
  return dynamic(config);
}
