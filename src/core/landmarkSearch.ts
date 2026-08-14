import { getItem } from '../data/items';
import { getLandmarkDef } from '../data/landmarks';
import { canPayActionCost, payActionCost } from './actionCosts';
import { addNoise } from './info';
import { addItem, canAccept } from './inventory';
import { canSearchLandmark, landmarkState } from './landmarks';
import { pushEvent } from './events';
import { livingWildEnemiesInZone } from './wildPopulation';
import { startWildEncounter } from './wildCombat';
import { applyDamage } from './vitals';
import { applyAccessTransitions } from './accessChains';
import type { Combatant, GameState, LandmarkSearchResult } from './types';
import type { SeededRandom } from './random';

function preferredWeight(itemId: string, preferred: readonly string[], actor: Combatant): number {
  const base = preferred.includes(itemId) ? 4 : 1;
  // Scavenger's existing resourceful passive becomes a transparent, finite
  // choice bias rather than an extra item source.
  return actor.characterId === 'scavenger' ? base * 1.25 : base;
}

export function searchLandmark(
  state: GameState,
  actor: Combatant,
  landmarkId: string,
  rng: SeededRandom,
): { ok: boolean; message: string; staminaSpent: number; outcome: LandmarkSearchResult | null } {
  const check = canSearchLandmark(state, actor.id, landmarkId);
  if (!check.ok) return { ok: false, message: check.reason ?? '无法搜索地标。', staminaSpent: 0, outcome: null };
  const cost = canPayActionCost(actor, 'SEARCH_LANDMARK');
  if (!cost.ok) return { ok: false, message: cost.reason ?? '体力不足。', staminaSpent: 0, outcome: null };
  const def = getLandmarkDef(landmarkId);
  const runtime = landmarkState(state, landmarkId)!;
  payActionCost(actor, 'SEARCH_LANDMARK');
  runtime.discovered = true;
  runtime.remainingSearches -= 1;
  runtime.lastUsedAt = state.time;
  actor.stats.searches += 1;
  state.stats.searches += 1;
  (state.stats.landmarkSearches ??= 0);
  state.stats.landmarkSearches += 1;
  addNoise(state, def.zoneId, 'search');

  const wild = livingWildEnemiesInZone(state, def.zoneId);
  const encounterChance = actor.characterId === 'hunter'
    ? Math.max(0, def.searchProfile.encounterChance - 0.08)
    : actor.characterId === 'trapper'
      ? Math.max(0, def.searchProfile.encounterChance - 0.04)
      : def.searchProfile.encounterChance;
  if (wild.length > 0 && rng.chance(encounterChance)) {
    const enemy = rng.pick(wild);
    if (enemy) {
      startWildEncounter(state, actor, enemy);
      pushEvent(state, {
        type: 'LANDMARK_SEARCHED', actorId: actor.id, zoneId: def.zoneId,
        message: `${actor.name} 搜索${def.name}时遭遇了野外威胁。`,
        metadata: { landmarkId, outcome: 'wild' },
      });
      finishLandmarkSearch(state, landmarkId, actor.id);
      return { ok: true, message: `搜索${def.name}时遭遇野外威胁。`, staminaSpent: cost.cost, outcome: { kind: 'enemy', landmarkId, enemyId: enemy.uid } };
    }
  }

  const stackIndex = rng.pickWeighted(runtime.loot.map((stack, index) => ({
    value: index,
    weight: preferredWeight(stack.itemId, def.searchProfile.preferredItemIds, actor),
  })));
  const stack = typeof stackIndex === 'number' ? runtime.loot[stackIndex] : undefined;
  if (!stack) {
    finishLandmarkSearch(state, landmarkId, actor.id);
    pushEvent(state, { type: 'LANDMARK_SEARCHED', actorId: actor.id, zoneId: def.zoneId, message: `${actor.name} 搜索${def.name}，一无所获。`, metadata: { landmarkId, outcome: 'nothing' } });
    return { ok: true, message: `搜索${def.name}，一无所获。`, staminaSpent: cost.cost, outcome: { kind: 'nothing', landmarkId } };
  }

  if (def.searchProfile.riskDamage > 0 && def.searchProfile.riskStatus === 'damage' && rng.chance(0.35)) {
    applyDamage(state, actor, def.searchProfile.riskDamage, null, `${def.name}环境伤害`);
    if (!actor.alive) {
      pushEvent(state, {
        type: 'LANDMARK_SEARCHED', actorId: actor.id, zoneId: def.zoneId,
        message: `${actor.name} 搜索${def.name}时遭遇致命环境风险。`,
        metadata: { landmarkId, outcome: 'fatal_risk', riskDamage: def.searchProfile.riskDamage },
      });
      finishLandmarkSearch(state, landmarkId, actor.id);
      return {
        ok: true,
        message: `搜索${def.name}时遭遇致命环境风险。`,
        staminaSpent: cost.cost,
        outcome: { kind: 'hazard', landmarkId },
      };
    }
  }
  runtime.loot.splice(stackIndex!, 1);
  const itemName = getItem(stack.itemId).name;
  const pending = !canAccept(actor, stack);
  if (!pending) addItem(actor, stack);
  if (!pending) state.stats.landmarkItemsRecovered = (state.stats.landmarkItemsRecovered ?? 0) + 1;
  pushEvent(state, { type: 'ITEM_FOUND', actorId: actor.id, zoneId: def.zoneId, importance: 'minor', message: `${actor.name} 在${def.name}找到了 ${itemName}。`, metadata: { itemId: stack.itemId, landmarkId } });
  if (!pending) pushEvent(state, { type: 'ITEM_PICKED', actorId: actor.id, zoneId: def.zoneId, message: `${actor.name} 收起了 ${itemName}。`, metadata: { itemId: stack.itemId, landmarkId } });
  pushEvent(state, { type: 'LANDMARK_SEARCHED', actorId: actor.id, zoneId: def.zoneId, message: `${actor.name} 搜索了${def.name}。`, metadata: { landmarkId, outcome: 'item', itemId: stack.itemId, pending } });
  finishLandmarkSearch(state, landmarkId, actor.id);
  return { ok: true, message: pending ? `找到${itemName}，但背包已满。` : `找到${itemName}。`, staminaSpent: cost.cost, outcome: { kind: 'item', landmarkId, stack, itemName, pending } };
}

function finishLandmarkSearch(state: GameState, landmarkId: string, actorId: string | null): void {
  const runtime = landmarkState(state, landmarkId);
  if (!runtime) return;
  applyAccessTransitions(state, actorId, landmarkId);
  if (runtime.exhausted) return;
  if (runtime.remainingSearches <= 0 || runtime.loot.length === 0) {
    runtime.remainingSearches = Math.max(0, runtime.remainingSearches);
    runtime.exhausted = true;
    (state.stats.landmarkExhaustions ??= 0);
    state.stats.landmarkExhaustions += 1;
    pushEvent(state, { type: 'LANDMARK_EXHAUSTED', actorId, zoneId: runtime.zoneId, message: `${getLandmarkDef(landmarkId).name}的有限资源已经耗尽。`, metadata: { landmarkId } });
  }
}
