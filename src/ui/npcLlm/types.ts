/**
 * Phase 4W — optional LLM NPC roleplay layer (presentation only).
 *
 * Contract red lines enforced by every consumer of these types:
 *   - The provider NEVER receives GameState / Combatant / memory / intent /
 *     inventory or any hidden runtime. Only the sanitized context below.
 *   - The provider returns ONE short flavor line. Nothing else is consumed.
 *   - The layer is async enrichment: gameplay, RNG, saves and the formal
 *     action trace are untouched whether it succeeds, fails or hangs.
 */

/** Presentation-safe tone hint (internal personality labels are never sent). */
export type NpcRoleplayTone =
  | '直率好斗'
  | '警惕克制'
  | '务实专注'
  | '轻快机敏'
  | '难以捉摸';

/** Which player-visible moment triggers a flavor line request. */
export type NpcRoleplayTrigger =
  | 'encounter_start'
  | 'npc_attack_hit'
  | 'npc_attack_miss'
  | 'npc_guard'
  | 'npc_exposed'
  | 'npc_flee'
  | 'encounter_resolved'
  | 'local_incident_contest';

/**
 * The ONLY payload a provider may see. Every field is already player-visible
 * (display names, zone name, the public beat, a tone hint).
 */
export interface NpcRoleplayContext {
  npcName: string;
  zoneName: string;
  trigger: NpcRoleplayTrigger;
  /** Public beat title, e.g. "敌方命中" — never numeric intel. */
  beatTitle: string;
  /** Coarse tone hint converted from the internal personality label. */
  tone: NpcRoleplayTone;
  /** 'zh-CN' — the line language. */
  language: 'zh-CN';
}

/** Stable identity of one request: the beat it belongs to + visible fingerprint. */
export interface NpcRoleplayRequestKey {
  beatId: string;
  fingerprint: string;
}

/** Experimental user configuration. The API key lives in browser memory only. */
export interface NpcRoleplayConfig {
  enabled: boolean;
  endpoint: string;
  model: string;
  apiKey?: string;
}

/** Minimal provider contract (OpenAI-compatible, mock, or future adapters). */
export interface NpcRoleplayProvider {
  readonly id: string;
  generateNpcLine(context: NpcRoleplayContext, signal: AbortSignal): Promise<string>;
}

export const NPC_ROLEPLAY_TIMEOUT_MS = 4000;
