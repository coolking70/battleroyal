/** Phase 4N wild PvE definitions are deliberately separate from contestants. */
export type WildBehavior = 'aggressive' | 'defensive' | 'skittish';
export type WildThreat = 'low' | 'medium' | 'high';
export type WildDropCategory = 'animal' | 'mechanical' | 'experimental';
export type WildAbilityId = 'none' | 'venom' | 'charge' | 'enrage' | 'evasive' | 'armored';
export type WildEnemyStatus = 'alive' | 'defeated' | 'fled';

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
  dropCategory: WildDropCategory;
  dropTableId: string;
  abilityId: WildAbilityId;
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
  dropResolved: boolean;
  defeatedAtTime: number | null;
}
