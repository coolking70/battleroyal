import type { Combatant } from '../core/types';

export type CharacterVisualState = 'portrait' | 'injured' | 'combat';

/** Existing UI injured threshold; this is presentation-only and is not game logic. */
export const INJURED_VISUAL_HP_RATIO = 0.35;

export interface CharacterVisualStateOptions {
  activeEncounter?: boolean;
}

/** Resolve a character image variant from live UI context only. */
export function resolveCharacterVisualState(
  character: Pick<Combatant, 'hp' | 'maxHp'>,
  options: CharacterVisualStateOptions = {},
): CharacterVisualState {
  const ratio = character.maxHp > 0 ? character.hp / character.maxHp : 0;
  if (ratio <= INJURED_VISUAL_HP_RATIO) return 'injured';
  if (options.activeEncounter === true) return 'combat';
  return 'portrait';
}
