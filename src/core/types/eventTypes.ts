/* ------------------------------------------------------------------ */
/* 事件                                                                */
/* ------------------------------------------------------------------ */

export type GameEventType =
  | 'GAME_STARTED'
  | 'CHARACTER_MOVED'
  | 'SEARCH_STARTED'
  | 'LANDMARK_SEARCHED'
  | 'LANDMARK_EXHAUSTED'
  | 'FACILITY_USED'
  | 'FACILITY_ACTIVATED'
  | 'ITEM_FOUND'
  | 'ITEM_PICKED'
  | 'ITEM_DROPPED'
  | 'ITEM_USED'
  | 'ITEM_CRAFTED'
  | 'ITEM_EQUIPPED'
  | 'ENCOUNTER_STARTED'
  | 'WILD_ENCOUNTER_STARTED'
  | 'WILD_ATTACK'
  | 'WILD_DEFEATED'
  | 'WILD_FLED'
  | 'WILD_DROP_CREATED'
  | 'APEX_SPAWNED'
  | 'APEX_DEFEATED'
  | 'ATTACK_HIT'
  | 'ATTACK_MISSED'
  | 'CHARACTER_ESCAPED'
  | 'CHARACTER_DIED'
  | 'ZONE_WARNING'
  | 'ZONE_RESTRICTED'
  | 'ZONE_DAMAGE'
  | 'ZONE_EXHAUSTED'
  | 'PHASE_CHANGED'
  | 'FINALE_DECAY'
  | 'CRAFT_GOAL_SET'
  | 'NPC_ACTION'
  | 'REST'
  | 'GUARD'
  | 'SKILL_USED'
  /** Phase 3A：状态失效（目前用于 EXPOSED 的条件B 解除） */
  | 'STATUS_EXPIRED'
  /** Phase 3A：世界事件开始（取代已删除的 DYNAMIC_EVENT） */
  | 'WORLD_EVENT'
  /** Phase 3A：世界事件结束 */
  | 'WORLD_EVENT_ENDED'
  /** Phase 3A-1：世界事件造成的环境伤害（走 applyDamage 后记录） */
  | 'WORLD_EVENT_DAMAGE'
  | 'VICTORY_DECLARED'
  | 'EXTRACTION_CALLED'
  | 'EXTRACTION_CANCELLED'
  | 'EXTRACTION_READY'
  | 'EXTRACTION_COMPLETED'
  | 'RESEARCH_COMPLETED'
  | 'GAME_ENDED';

/** 事件重要度。 */
export type EventImportance = 'critical' | 'major' | 'minor';
/** 事件附带的结构化数据，值域刻意保持简单以便序列化 */
export type EventMetadata = Record<string, string | number | boolean | null>;

export interface GameEvent {
  id: string;
  type: GameEventType;
  time: number;
  actorId: string | null;
  targetId: string | null;
  zoneId: string | null;
  message: string;
  importance: EventImportance;
  metadata: EventMetadata;
}

/** 被裁剪掉的事件仍然保留统计，避免"发生过什么"这一信息彻底丢失 */
export interface EventCounters {
  total: number;
  archived: number;
  byType: Record<string, number>;
}
