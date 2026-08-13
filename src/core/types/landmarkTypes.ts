import type { ItemStack } from './itemTypes';

export type LandmarkKind = 'landmark' | 'facility';
export type LandmarkEffectType = 'treat_wounds' | 'analyze' | 'workbench' | 'restore_control' | 'start_generator' | 'service_system' | 'open_secure_storage' | 'field_prep';

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
