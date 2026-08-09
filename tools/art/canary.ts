import type { ArtTask } from './types';

export const SCOUT_INJURED_CANARY_TASK_ID = 'character/scout/injured' as const;

export const EXCLUDED_PHASE4A41_VARIANT_TASK_IDS = [
  'character/fighter/injured',
  'character/engineer/injured',
  'character/medic/injured',
  'world_event/rain/illustration',
] as const;

export function selectScoutInjuredCanary(tasks: readonly ArtTask[]): ArtTask[] {
  return tasks.filter((task) => task.id === SCOUT_INJURED_CANARY_TASK_ID);
}
