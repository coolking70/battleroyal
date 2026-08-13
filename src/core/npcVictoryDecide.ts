import { getZoneDef } from '../data/zones';
import { canCallExtraction, canExtract, canSubmitResearch } from './victory';
import { countItem } from './inventory';
import type { Combatant, GameState } from './types';

export type NpcVictoryDecision =
  | { kind: 'extract'; reason: string }
  | { kind: 'submit_research'; reason: string }
  | { kind: 'call_extraction'; reason: string }
  | { kind: 'move'; reason: string; zoneId: string };

/** Deterministic shortest-path step for a carried objective. */
function nextObjectiveStep(state: GameState, npc: Combatant, targetZoneId: string): string | null {
  if (npc.currentZoneId === targetZoneId) return null;
  const queue: Array<{ zoneId: string; first: string }> = [];
  const seen = new Set([npc.currentZoneId]);
  for (const adjacent of getZoneDef(npc.currentZoneId).adjacent) {
    if (state.zones[adjacent]?.status !== 'restricted') {
      queue.push({ zoneId: adjacent, first: adjacent });
      seen.add(adjacent);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.zoneId === targetZoneId) return current.first;
    for (const adjacent of getZoneDef(current.zoneId).adjacent) {
      if (seen.has(adjacent) || state.zones[adjacent]?.status === 'restricted') continue;
      seen.add(adjacent);
      queue.push({ zoneId: adjacent, first: current.first });
    }
  }
  return null;
}

/** Alternative route priority for NPCs carrying a completed objective. */
export function decideNpcVictoryAction(state: GameState, npc: Combatant): NpcVictoryDecision | null {
  if (canExtract(state, npc).ok) return { kind: 'extract', reason: '撤离窗口已准备，立即完成撤离' };
  if (canSubmitResearch(state, npc).ok) return { kind: 'submit_research', reason: '研究成果已在研究所就绪，立即提交' };

  if (countItem(npc, 'extraction_beacon') > 0) {
    if (npc.currentZoneId !== 'station') {
      const step = nextObjectiveStep(state, npc, 'station');
      if (step) return { kind: 'move', reason: '携带撤离信标前往车站', zoneId: step };
    } else if (canCallExtraction(state, npc).ok) {
      return { kind: 'call_extraction', reason: '携带撤离信标，在车站呼叫撤离' };
    }
  }
  if (countItem(npc, 'research_package') > 0 && npc.currentZoneId !== 'lab') {
    const step = nextObjectiveStep(state, npc, 'lab');
    if (step) return { kind: 'move', reason: '携带研究成果包返回研究所', zoneId: step };
  }
  return null;
}
