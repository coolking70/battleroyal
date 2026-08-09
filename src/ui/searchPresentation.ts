import type { GameEvent, GameState } from '../core/types';

export type SearchFeedback =
  | {
      kind: 'item';
      itemId: string;
      pending: boolean;
      eventId: string;
      modifiers: string[];
    }
  | { kind: 'nothing'; exhausted: boolean; eventId: string; modifiers: string[] }
  | { kind: 'encounter'; eventId: string };

const SEARCH_CHAIN_TYPES = new Set<GameEvent['type']>([
  'SEARCH_STARTED',
  'ITEM_FOUND',
  'ITEM_PICKED',
  'ENCOUNTER_STARTED',
]);

const PLAYER_ACTION_TYPES = new Set<GameEvent['type']>([
  'CHARACTER_MOVED',
  'SEARCH_STARTED',
  'ITEM_FOUND',
  'ITEM_PICKED',
  'ITEM_DROPPED',
  'ITEM_USED',
  'ITEM_CRAFTED',
  'ITEM_EQUIPPED',
  'ENCOUNTER_STARTED',
  'ATTACK_HIT',
  'ATTACK_MISSED',
  'CHARACTER_ESCAPED',
  'CRAFT_GOAL_SET',
  'REST',
  'GUARD',
  'SKILL_USED',
]);

function stringMetadata(event: GameEvent, key: string): string | null {
  const value = event.metadata[key];
  return typeof value === 'string' ? value : null;
}

function booleanMetadata(event: GameEvent, key: string): boolean {
  return event.metadata[key] === true;
}

function searchModifiers(events: GameEvent[], index: number): string[] {
  const event = events[index];
  if (!event) return [];
  const search = events
    .slice(0, index + 1)
    .reverse()
    .find(
      (candidate) =>
        candidate.actorId === event.actorId &&
        candidate.type === 'SEARCH_STARTED' &&
        candidate.time === event.time,
    );
  if (!search) return [];
  const modifiers: string[] = [];
  if (booleanMetadata(search, 'blackoutActive')) modifiers.push('大停电影响');
  if (booleanMetadata(search, 'unrestActive')) modifiers.push('全城骚动影响');
  return modifiers;
}

function hasMatchingFoundEvent(
  events: GameEvent[],
  index: number,
  itemId: string,
  actorId: string,
): boolean {
  return events.slice(0, index).some(
    (event) =>
      event.type === 'ITEM_FOUND' &&
      event.actorId === actorId &&
      event.time === events[index]?.time &&
      stringMetadata(event, 'itemId') === itemId,
  );
}

/**
 * 只读取玩家最近一次结构化行动事件，避免把旧搜索结果伪装成当前结果。
 * 该函数不重算概率、库存或合法性，只把 core 已记录的事实映射为展示状态。
 */
export function latestPlayerSearchFeedback(state: GameState): SearchFeedback | null {
  const events = state.events;
  const latestIndex = [...events]
    .map((event, index) => ({ event, index }))
    .reverse()
    .find(({ event }) => event.actorId === state.playerId && PLAYER_ACTION_TYPES.has(event.type))?.index;
  if (latestIndex === undefined) return null;

  const latest = events[latestIndex];
  if (!latest || !SEARCH_CHAIN_TYPES.has(latest.type)) return null;

  if (latest.type === 'ENCOUNTER_STARTED') {
    return { kind: 'encounter', eventId: latest.id };
  }

  if (latest.type === 'SEARCH_STARTED' && booleanMetadata(latest, 'empty')) {
    return {
      kind: 'nothing',
      exhausted: booleanMetadata(latest, 'exhausted'),
      eventId: latest.id,
      modifiers: searchModifiers(events, latestIndex),
    };
  }

  if (latest.type === 'ITEM_FOUND') {
    const itemId = stringMetadata(latest, 'itemId');
    if (!itemId) return null;
    return {
      kind: 'item',
      itemId,
      pending: Boolean(state.pendingPickup),
      eventId: latest.id,
      modifiers: searchModifiers(events, latestIndex),
    };
  }

  if (latest.type === 'ITEM_PICKED') {
    const itemId = stringMetadata(latest, 'itemId');
    if (!itemId || !hasMatchingFoundEvent(events, latestIndex, itemId, state.playerId)) {
      return null;
    }
    return {
      kind: 'item',
      itemId,
      pending: false,
      eventId: latest.id,
      modifiers: searchModifiers(events, latestIndex),
    };
  }

  return null;
}
