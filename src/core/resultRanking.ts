import { allCharacters } from './gameState';
import type { Combatant, GameState } from './types';

/**
 * Authoritative final ordering shared by the result screen and simulation.
 * A declared winner is always first; the remaining ordering stays the
 * deterministic survivor/kills/death-order rule used by earlier phases.
 */
export function buildFinalRanking(state: GameState): Combatant[] {
  const all = allCharacters(state);
  const winnerId = state.victory.winnerId;
  const winner = winnerId ? all.find((character) => character.id === winnerId) : null;
  const survivors = all
    .filter((character) => character.alive && character.id !== winnerId)
    .sort((a, b) => b.kills - a.kills || a.id.localeCompare(b.id));
  const deathIndex = (id: string): number => {
    const index = state.deathOrder.indexOf(id);
    return index < 0 ? Number.NEGATIVE_INFINITY : index;
  };
  const dead = all
    .filter((character) => !character.alive)
    .sort((a, b) => deathIndex(b.id) - deathIndex(a.id) || a.id.localeCompare(b.id));
  return winner ? [winner, ...survivors, ...dead] : [...survivors, ...dead];
}
