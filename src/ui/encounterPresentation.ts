import { ATTACK_STYLE_LABEL } from '../core/combat';
import { hasExposed } from '../core/exposed';
import type {
  AttackStyle,
  Combatant,
  EncounterState,
  GameEvent,
  WildEnemyInstance,
} from '../core/types';
import { WILD_SPECIAL_ABILITIES } from '../data/wildApexAbilities';
import { isEventVisibleToPlayer } from './components/EventLog';

export type EncounterBeatKind =
  | 'start'
  | 'hit'
  | 'miss'
  | 'guard'
  | 'exposed'
  | 'telegraph'
  | 'escape'
  | 'defeat'
  | 'loot'
  | 'resolved';

export type EncounterBeatSide = 'player' | 'enemy' | 'system';

export interface EncounterPresentationBeat {
  id: string;
  time: number;
  kind: EncounterBeatKind;
  side: EncounterBeatSide;
  icon: string;
  title: string;
  detail: string;
  style?: AttackStyle;
}

export interface EncounterObservedStatus {
  id: 'player-guard' | 'player-exposed' | 'enemy-guard' | 'enemy-exposed';
  side: 'player' | 'enemy';
  label: 'GUARD' | 'EXPOSED';
}

export interface EncounterPresentationView {
  zoneName: string;
  durationTurns: number;
  initiativeLabel: string;
  beats: EncounterPresentationBeat[];
  latest: EncounterPresentationBeat;
  statuses: EncounterObservedStatus[];
}

export interface EncounterPresentationInput {
  encounter: EncounterState;
  player: Combatant;
  enemy: Combatant;
  wildEnemy?: WildEnemyInstance | null;
  currentTime: number;
  zoneName: string;
  /** Normally already passed through visibleEventsForPlayer(); rechecked defensively. */
  visibleEvents: readonly GameEvent[];
  lootAvailable?: boolean;
}

const STYLE_SET = new Set<AttackStyle>(['quick', 'normal', 'heavy']);

function attackStyle(event: GameEvent): AttackStyle {
  const candidate = event.metadata.style;
  return typeof candidate === 'string' && STYLE_SET.has(candidate as AttackStyle)
    ? candidate as AttackStyle
    : 'normal';
}

function numberMetadata(event: GameEvent, key: string): number | null {
  const value = event.metadata[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function wildUid(event: GameEvent): string | null {
  const value = event.metadata.wildUid;
  return typeof value === 'string' ? value : null;
}

function isRelevantEvent(
  event: GameEvent,
  encounter: EncounterState,
  playerId: string,
): boolean {
  if (event.time < encounter.startedAtTime) return false;

  const opponentId = encounter.enemyId;
  if (encounter.targetKind === 'wild') {
    if (wildUid(event) === opponentId) return true;
    return event.type === 'GUARD' && event.actorId === playerId && event.zoneId === encounter.zoneId;
  }

  return (
    event.actorId === opponentId ||
    event.targetId === opponentId ||
    ((event.actorId === playerId || event.targetId === playerId) && event.zoneId === encounter.zoneId)
  );
}

function hitBeat(event: GameEvent, player: Combatant, enemy: Combatant): EncounterPresentationBeat {
  const playerActed = event.actorId === player.id;
  const style = attackStyle(event);
  const damage = numberMetadata(event, 'damage');
  return {
    id: event.id,
    time: event.time,
    kind: 'hit',
    side: playerActed ? 'player' : 'enemy',
    icon: playerActed ? '✦' : '✹',
    title: playerActed ? `你的${ATTACK_STYLE_LABEL[style]}命中` : '敌方命中',
    detail: `${playerActed ? player.name : enemy.name} 命中${playerActed ? enemy.name : player.name}${damage === null ? '' : `，造成 ${damage} 点伤害`}。`,
    style,
  };
}

function missBeats(event: GameEvent, player: Combatant, enemy: Combatant): EncounterPresentationBeat[] {
  const playerActed = event.actorId === player.id;
  const style = attackStyle(event);
  const exposed = event.metadata.exposed === true;
  const beats: EncounterPresentationBeat[] = [{
    id: event.id,
    time: event.time,
    kind: 'miss',
    side: playerActed ? 'player' : 'enemy',
    icon: style === 'heavy' ? '◌' : '↯',
    title: playerActed
      ? `${ATTACK_STYLE_LABEL[style]}落空${style === 'heavy' ? ' · HEAVY MISS' : ''}`
      : '你闪开了攻击',
    detail: playerActed
      ? `${enemy.name} 避开了${player.name}的攻击。`
      : `${player.name} 避开了${enemy.name}的攻击。`,
    style,
  }];
  if (exposed) {
    beats.push({
      id: `${event.id}:exposed`,
      time: event.time,
      kind: 'exposed',
      side: playerActed ? 'player' : 'enemy',
      icon: '!',
      title: playerActed ? '你露出破绽 · EXPOSED' : '对手露出破绽 · EXPOSED',
      detail: '重击落空留下了可被下一次命中兑现的破绽。',
    });
  }
  return beats;
}

function eventBeats(
  event: GameEvent,
  player: Combatant,
  enemy: Combatant,
): EncounterPresentationBeat[] {
  switch (event.type) {
    case 'ENCOUNTER_STARTED':
    case 'WILD_ENCOUNTER_STARTED':
      return [{ id: event.id, time: event.time, kind: 'start', side: 'system', icon: '⚔', title: '遭遇开始', detail: `你与 ${enemy.name} 进入交战。` }];
    case 'ATTACK_HIT':
      return [hitBeat(event, player, enemy)];
    case 'ATTACK_MISSED':
      return missBeats(event, player, enemy);
    case 'GUARD':
      return [{ id: event.id, time: event.time, kind: 'guard', side: event.actorId === player.id ? 'player' : 'enemy', icon: '▣', title: event.actorId === player.id ? '你进入 GUARD' : '对手进入 GUARD', detail: '防御姿态将减免下一次命中的伤害。' }];
    case 'WILD_ATTACK': {
      const action = event.metadata.action;
      if (action === 'telegraph') {
        return [{ id: event.id, time: event.time, kind: 'telegraph', side: 'enemy', icon: '⚠', title: '野外技能预兆', detail: event.message }];
      }
      if (action === 'guard' || action === 'special_guard') {
        return [{ id: event.id, time: event.time, kind: 'guard', side: 'enemy', icon: '▣', title: '野外目标进入 GUARD', detail: event.message }];
      }
      if (event.metadata.hit === false) {
        return [{ id: event.id, time: event.time, kind: 'miss', side: 'enemy', icon: '↯', title: '你闪开了野外攻击', detail: event.message }];
      }
      return [{ id: event.id, time: event.time, kind: 'hit', side: 'enemy', icon: '✹', title: '野外目标命中', detail: event.message }];
    }
    case 'CHARACTER_ESCAPED': {
      const success = event.metadata.success === true;
      return [{ id: event.id, time: event.time, kind: success ? 'escape' : 'miss', side: event.actorId === player.id ? 'player' : 'enemy', icon: success ? '➜' : '×', title: success ? (event.actorId === player.id ? '成功脱离' : '对手逃走') : '脱离失败', detail: event.message }];
    }
    case 'WILD_FLED': {
      const playerEscaped = event.actorId === player.id || event.metadata.direction === 'contestant';
      return [{ id: event.id, time: event.time, kind: 'escape', side: playerEscaped ? 'player' : 'enemy', icon: '➜', title: playerEscaped ? '成功脱离野外遭遇' : '野外目标逃走', detail: event.message }];
    }
    case 'CHARACTER_DIED':
      if (event.targetId !== enemy.id) return [];
      return [{ id: event.id, time: event.time, kind: 'defeat', side: 'player', icon: '†', title: '对手被击杀', detail: `${enemy.name} 已失去战斗能力。` }];
    case 'WILD_DEFEATED':
      return [{ id: event.id, time: event.time, kind: 'defeat', side: 'player', icon: '◆', title: '野外目标被击败', detail: `${enemy.name} 已被击败。` }];
    case 'WILD_DROP_CREATED':
      return [{ id: event.id, time: event.time, kind: 'loot', side: 'system', icon: '◇', title: '发现可拾取战利品', detail: event.message }];
    case 'STATUS_EXPIRED':
      if (event.metadata.statusId !== 'exposed' && event.metadata.status !== 'exposed') return [];
      return [{ id: event.id, time: event.time, kind: 'exposed', side: event.actorId === player.id ? 'player' : 'enemy', icon: '○', title: 'EXPOSED 已解除', detail: '破绽状态已经结束。' }];
    default:
      return [];
  }
}

function hasBeat(beats: readonly EncounterPresentationBeat[], kind: EncounterBeatKind): boolean {
  return beats.some((beat) => beat.kind === kind);
}

/**
 * Pure, deterministic encounter projection. Callers pass only events already approved by
 * visibleEventsForPlayer(); metadata such as remainingHp is deliberately never projected.
 */
export function buildEncounterPresentation(input: EncounterPresentationInput): EncounterPresentationView {
  const {
    encounter,
    player,
    enemy,
    wildEnemy = null,
    currentTime,
    zoneName,
    visibleEvents,
    lootAvailable = false,
  } = input;
  const relevant = visibleEvents
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isEventVisibleToPlayer(event, player.id))
    .filter(({ event }) => isRelevantEvent(event, encounter, player.id))
    .sort((a, b) => a.event.time - b.event.time || a.index - b.index);
  const beats = relevant.flatMap(({ event }) => eventBeats(event, player, enemy));

  if (!hasBeat(beats, 'start')) {
    beats.unshift({
      id: 'encounter:start',
      time: encounter.startedAtTime,
      kind: 'start',
      side: 'system',
      icon: '⚔',
      title: '遭遇开始',
      detail: `你与 ${enemy.name} 在${zoneName}进入交战。`,
    });
  }

  if (wildEnemy?.pendingIntent && !hasBeat(beats, 'telegraph')) {
    beats.push({
      id: `encounter:telegraph:${wildEnemy.pendingIntent}`,
      time: currentTime,
      kind: 'telegraph',
      side: 'enemy',
      icon: '⚠',
      title: '野外技能预兆',
      detail: WILD_SPECIAL_ABILITIES[wildEnemy.pendingIntent].telegraph,
    });
  }

  const opponentDefeated = !enemy.alive || Boolean(wildEnemy && wildEnemy.status !== 'alive');
  const opponentLeftArea = encounter.resolved && enemy.alive && enemy.currentZoneId !== encounter.zoneId;
  const playerLeftArea = encounter.resolved && player.alive && player.currentZoneId !== encounter.zoneId;
  if (opponentDefeated && !hasBeat(beats, 'defeat')) {
    beats.push({ id: 'encounter:defeat', time: currentTime, kind: 'defeat', side: 'player', icon: wildEnemy ? '◆' : '†', title: wildEnemy ? '野外目标被击败' : '对手被击杀', detail: `${enemy.name} 已失去战斗能力。` });
  } else if (opponentLeftArea && !hasBeat(beats, 'escape')) {
    beats.push({ id: 'encounter:opponent-left', time: currentTime, kind: 'escape', side: 'enemy', icon: '➜', title: '对手逃走', detail: `${enemy.name} 已经离开该区域，脱离接触。` });
  } else if (playerLeftArea && !hasBeat(beats, 'escape')) {
    beats.push({ id: 'encounter:player-left', time: currentTime, kind: 'escape', side: 'player', icon: '➜', title: '成功脱离', detail: `你已摆脱 ${enemy.name}。` });
  }

  if (encounter.resolved) {
    beats.push({ id: 'encounter:resolved', time: currentTime, kind: 'resolved', side: 'system', icon: '✓', title: '遭遇已解决', detail: opponentDefeated ? '威胁已经清除。' : '双方已结束接触。' });
  }
  if (lootAvailable && opponentDefeated && !hasBeat(beats, 'loot')) {
    beats.push({ id: 'encounter:loot', time: currentTime, kind: 'loot', side: 'system', icon: '◇', title: '击杀战利品', detail: '该对手遗留了物资，可拾取。' });
  }

  const statuses: EncounterObservedStatus[] = [];
  if (player.guarding) statuses.push({ id: 'player-guard', side: 'player', label: 'GUARD' });
  if (hasExposed(player)) statuses.push({ id: 'player-exposed', side: 'player', label: 'EXPOSED' });
  if (enemy.guarding) statuses.push({ id: 'enemy-guard', side: 'enemy', label: 'GUARD' });
  if (hasExposed(enemy)) statuses.push({ id: 'enemy-exposed', side: 'enemy', label: 'EXPOSED' });

  const recentBeats = beats.slice(-5);
  const latest = recentBeats[recentBeats.length - 1]!;
  return {
    zoneName,
    durationTurns: Math.max(0, currentTime - encounter.startedAtTime),
    initiativeLabel: encounter.reconInitiative ? '侦察先手有效' : '常规交战',
    beats: recentBeats,
    latest,
    statuses,
  };
}
