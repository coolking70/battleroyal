import type { ItemStack } from './itemTypes';

export type LandmarkKind = 'landmark' | 'facility';
export type LandmarkEffectType = 'treat_wounds' | 'analyze' | 'workbench' | 'restore_control' | 'start_generator' | 'service_system' | 'open_secure_storage' | 'field_prep';

/** Public, local prerequisites. Runtime depletion/loot is never encoded here. */
export type AccessRequirement =
  | { kind: 'item'; itemId: string; count?: number; consume?: boolean }
  | { kind: 'landmark_state'; landmarkId: string; state: 'discovered' | 'repaired' | 'activated' };

export interface LandmarkAccessDef {
  initial: 'locked' | 'disabled';
  prerequisites: readonly AccessRequirement[];
  /** Coarse text safe to show before the actor reaches the landmark. */
  hint: string;
}

export interface LandmarkLootDef {
  itemId: string;
  count: number;
}

export interface LandmarkSearchProfile {
  preferredItemIds: readonly string[];
  encounterChance: number;
  riskDamage: number;
  riskStatus?: 'wild' | 'noise' | 'damage';
}

export interface FacilityInteractionDef {
  id: string;
  label: string;
  effectType: LandmarkEffectType;
  chargeCost: number;
  maxCharges: number;
  requiresRepair?: boolean;
  requiresUnlock?: boolean;
  requiredItemId?: string;
  requiredItemCount?: number;
  /** Existing Phase 4Q interactions consume by default; tools may be retained. */
  requiredItemConsumes?: boolean;
  requiredLandmarkId?: string;
}

export interface LandmarkDef {
  id: string;
  zoneId: string;
  name: string;
  description: string;
  icon: string;
  kind: LandmarkKind;
  searchable: boolean;
  initialLoot: readonly LandmarkLootDef[];
  maxSearches: number;
  searchProfile: LandmarkSearchProfile;
  access?: LandmarkAccessDef;
  interaction?: FacilityInteractionDef;
}

export interface LandmarkSearchResult {
  kind: 'item' | 'enemy' | 'nothing' | 'hazard';
  landmarkId: string;
  stack?: ItemStack;
  itemName?: string;
  pending?: boolean;
  enemyId?: string;
}
