import type {
  EncounterBeatKind,
  EncounterPresentationBeat,
} from '../encounterPresentation';
import type {
  GameEvent,
  Personality,
} from '../../core/types';
import type {
  NpcRoleplayContext,
  NpcRoleplayRequestKey,
  NpcRoleplayTone,
  NpcRoleplayTrigger,
} from './types';

/**
 * Phase 4W — sanitized context construction.
 *
 * The context is built ONLY from player-visible inputs (display name, zone
 * name, a visible encounter beat / visible event, personality converted to a
 * presentation-safe tone hint). Hidden runtime (exact HP, inventory,
 * StrategicIntent, ActorKnowledgeMemory, remote positions) never reaches
 * this module because callers may only pass already-visible projections.
 */

/** Internal personality → presentation-safe tone hint. Labels never leave. */
const TONE_BY_PERSONALITY: Record<Personality, NpcRoleplayTone> = {
  aggressive: '直率好斗',
  cautious: '警惕克制',
  collector: '务实专注',
  opportunist: '轻快机敏',
  random: '难以捉摸',
};

export function toneHintForPersonality(personality: Personality): NpcRoleplayTone {
  return TONE_BY_PERSONALITY[personality] ?? '难以捉摸';
}

/** Enemy-side beats that are worth a flavor line (player-visible only). */
const TRIGGER_BY_BEAT_KIND: Partial<Record<EncounterBeatKind, NpcRoleplayTrigger>> = {
  start: 'encounter_start',
  hit: 'npc_attack_hit',
  miss: 'npc_attack_miss',
  guard: 'npc_guard',
  exposed: 'npc_exposed',
  escape: 'npc_flee',
  resolved: 'encounter_resolved',
};

/**
 * Build a context from a visible encounter beat whose speaker is the enemy
 * NPC, or null. Enemy-side beats always qualify; the system-side start /
 * resolved beats are also attributed to the opponent. Player-side beats
 * never do.
 */
export function contextFromEncounterBeat(input: {
  npcName: string;
  zoneName: string;
  personality: Personality;
  beat: EncounterPresentationBeat;
}): NpcRoleplayContext | null {
  const trigger = TRIGGER_BY_BEAT_KIND[input.beat.kind];
  if (!trigger) return null;
  const systemAttributed = input.beat.side === 'system'
    && (input.beat.kind === 'start' || input.beat.kind === 'resolved');
  if (input.beat.side !== 'enemy' && !systemAttributed) return null;
  return {
    npcName: input.npcName,
    zoneName: input.zoneName,
    trigger,
    beatTitle: input.beat.title,
    tone: toneHintForPersonality(input.personality),
    language: 'zh-CN',
  };
}

/**
 * Build a context from a locally witnessed incident competition event, or
 * null. Only events already filtered through visibleEventsForPlayer() may be
 * passed here, and only when the competition happened in the player's own
 * zone (a broadcast about a far zone is not a local contest).
 */
export function contextFromLocalIncidentEvent(input: {
  npcName: string;
  zoneName: string;
  personality: Personality;
  event: GameEvent;
  playerZoneId: string;
}): NpcRoleplayContext | null {
  const { event } = input;
  if (event.type !== 'INCIDENT_CLAIMED') return null;
  if (event.actorId === null || event.zoneId !== input.playerZoneId) return null;
  return {
    npcName: input.npcName,
    zoneName: input.zoneName,
    trigger: 'local_incident_contest',
    beatTitle: '事件争夺',
    tone: toneHintForPersonality(input.personality),
    language: 'zh-CN',
  };
}

/** Stable fingerprint of everything the provider saw (privacy audits & stale checks). */
export function contextFingerprint(context: NpcRoleplayContext): string {
  const parts = [
    context.npcName,
    context.zoneName,
    context.trigger,
    context.beatTitle,
    context.tone,
    context.language,
  ];
  let hash = 0;
  const source = parts.join('|');
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 131 + source.charCodeAt(index)) % 0x7fffffff;
  }
  return `${source.length.toString(36)}-${hash.toString(36)}`;
}

/** Request identity for stale-response binding. */
export function requestKeyOf(beatId: string, context: NpcRoleplayContext): NpcRoleplayRequestKey {
  return { beatId, fingerprint: contextFingerprint(context) };
}
