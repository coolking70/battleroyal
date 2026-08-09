import type { ArtTask } from './types';

export const SCOUT_INJURED_CANARY_TASK_ID = 'character/scout/injured' as const;
export const SCOUT_COMBAT_CANARY_TASK_ID = 'character/scout/combat' as const;
export const COMBAT_BATCH_TASK_IDS = [
  'character/fighter/combat',
  'character/engineer/combat',
  'character/medic/combat',
] as const;

export const EXCLUDED_PHASE4A41_VARIANT_TASK_IDS = [
  'character/fighter/injured',
  'character/engineer/injured',
  'character/medic/injured',
  'world_event/rain/illustration',
] as const;

export const EXCLUDED_PHASE4A43_COMBAT_TASK_IDS = [
  'character/fighter/combat',
  'character/engineer/combat',
  'character/medic/combat',
  'character/scout/injured',
  'character/fighter/injured',
  'character/engineer/injured',
  'character/medic/injured',
  'world_event/rain/illustration',
] as const;

export function selectScoutInjuredCanary(tasks: readonly ArtTask[]): ArtTask[] {
  return tasks.filter((task) => task.id === SCOUT_INJURED_CANARY_TASK_ID);
}

export function selectScoutCombatCanary(tasks: readonly ArtTask[]): ArtTask[] {
  return tasks.filter((task) => task.id === SCOUT_COMBAT_CANARY_TASK_ID);
}

export function selectCombatBatch(tasks: readonly ArtTask[]): ArtTask[] {
  return COMBAT_BATCH_TASK_IDS.map((taskId) => tasks.find((task) => task.id === taskId)).filter((task): task is ArtTask => task !== undefined);
}
