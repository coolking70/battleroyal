import type { Combatant, GameState, VictoryType } from './types';

/**
 * Stable intent selection for NPCs. The mapping is deliberately independent
 * of combat outcomes and never consumes the match RNG stream.
 */
export function deriveNpcVictoryGoal(
  state: Pick<GameState, 'seed'>,
  npc: Pick<Combatant, 'id' | 'characterId' | 'personality'>,
): VictoryType {
  switch (npc.personality) {
    case 'aggressive': return 'last_survivor';
    case 'collector': return 'research';
    case 'cautious': return 'extraction';
    case 'opportunist': return 'extraction';
    case 'random': {
      const key = `${state.seed}:${npc.id}:${npc.characterId}:${npc.personality}`;
      let hash = 2166136261;
      for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
      return (['last_survivor', 'extraction', 'research'] as const)[(hash >>> 0) % 3] ?? 'last_survivor';
    }
  }
}
