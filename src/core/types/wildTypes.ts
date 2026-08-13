/** Phase 4N wild PvE definitions are deliberately separate from contestants. */
export type WildBehavior = 'aggressive' | 'defensive' | 'skittish';
export type WildThreat = 'low' | 'medium' | 'high';
export type WildDropCategory = 'animal' | 'mechanical' | 'experimental';
export type WildAbilityId = 'none' | 'venom' | 'charge' | 'enrage' | 'evasive' | 'armored';
export type WildThreatTier = 'common' | 'elite' | 'apex';
export type WildSpecialAbilityId = 'none' | 'shield_cycle' | 'overcharge' | 'toxic_burst' | 'massive_charge' | 'suppression_fire';
export type WildPendingIntent = 'shield_cycle' | 'overcharge' | 'toxic_burst' | 'massive_charge' | 'suppression_fire';
export type WildEnemyStatus = 'alive' | 'defeated';

export interface WildEnemyDef {
  id: string;
  name: string;
  description: string;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  encounterWeight: number;
  behavior: WildBehavior;
  threat: WildThreat;
  tier: WildThreatTier;
  dropCategory: WildDropCategory;
  dropTableId: string;
  abilityId: WildAbilityId;
  specialAbilityId: WildSpecialAbilityId;
  eligibleZones?: readonly string[];
  signatureDropItemId?: string;
  fallbackEmoji: string;
  fallbackColor: string;
}

export interface WildDropEntry {
  itemId: string;
  probability: number;
  min: number;
  max: number;
}

export interface WildDropTable {
  id: string;
  entries: WildDropEntry[];
}

export interface WildEcologyEntry {
  enemyId: string;
  weight: number;
}

export interface WildStatusEffect {
  id: 'enraged' | 'evasive' | 'armored';
  remaining: number;
}

export interface WildEnemyInstance {
  uid: string;
  defId: string;
  zoneId: string;
  hp: number;
  status: WildEnemyStatus;
  guarding: boolean;
  abilityCharges: number;
  statusEffects: WildStatusEffect[];
  /** Persisted one-turn telegraph; never inferred from a log message. */
  pendingIntent: WildPendingIntent | null;
  dropResolved: boolean;
  defeatedAtTime: number | null;
}

export interface ApexScheduleEntry {
  defId: string;
  scheduledAt: number;
  spawned: boolean;
  spawnedAt: number | null;
  uid: string | null;
  zoneId: string | null;
}
