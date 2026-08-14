import { getItem } from '../data/items';
import { PHASE4N_WILD_MATERIAL_IDS } from '../data/phase4nItems';
import { PHASE4P_SIGNATURE_IDS, PHASE4P_WILD_MATERIAL_IDS } from '../data/phase4pItems';
import { buildCraftPlan } from './craftPlan';
import { pushEvent } from './events';
import {
  addItem,
  canAccept,
  equipItem,
  getEquippedArmor,
  getEquippedUtility,
  getEquippedWeapon,
  stackValue,
} from './inventory';
import { canAccessGroundItem, clearGroundOwnership } from './legalActions';
import { observeOwnAction, observeOwnItem } from './npcKnowledge';
import type { Combatant, GameState, ItemStack } from './types';

const WILD_MATERIALS = new Set<string>([...PHASE4N_WILD_MATERIAL_IDS, ...PHASE4P_WILD_MATERIAL_IDS]);
const SIGNATURE_MATERIALS = new Set<string>(PHASE4P_SIGNATURE_IDS);

function noteWildPickup(state: GameState, itemId: string): void {
  if (WILD_MATERIALS.has(itemId)) state.stats.wildMaterialPickups += 1;
  if (SIGNATURE_MATERIALS.has(itemId)) state.stats.signaturePickups = (state.stats.signaturePickups ?? 0) + 1;
}

/** Existing free equipment maintenance; cognition only observes the completed legal transfer. */
export function autoEquipNpc(state: GameState, npc: Combatant): void {
  const plannedRoute = npc.plannedRecipeId ? buildCraftPlan(state, npc, npc.plannedRecipeId) : null;
  for (const slot of ['weapon', 'armor', 'utility'] as const) {
    const current = slot === 'weapon'
      ? getEquippedWeapon(npc)
      : slot === 'armor'
        ? getEquippedArmor(npc)
        : getEquippedUtility(npc);
    const currentValue = current
      ? slot === 'weapon'
        ? getItem(current.itemId).attack ?? 0
        : slot === 'armor'
          ? getItem(current.itemId).defense ?? 0
          : (getItem(current.itemId).searchFindMult ?? 1) * 100
      : 0;

    let best: { stack: ItemStack; value: number } | null = null;
    for (const stack of npc.inventory) {
      const def = getItem(stack.itemId);
      if (def.equipmentSlot !== slot) continue;
      if (plannedRoute && stack.itemId !== plannedRoute.targetItemId
        && plannedRoute.steps.some((step) => step.outputItemId === stack.itemId
          && step.recipeId !== plannedRoute.targetRecipeId)) continue;
      const value = slot === 'weapon'
        ? def.attack ?? 0
        : slot === 'armor'
          ? def.defense ?? 0
          : (def.searchFindMult ?? 1) * 100;
      if (value <= currentValue) continue;
      if (!best || value > best.value) best = { stack, value };
    }

    if (!best) continue;
    const result = equipItem(npc, best.stack.uid);
    if (!result.ok) continue;
    observeOwnAction(state, npc, 'EQUIP', 'success', 'item', best.stack.itemId);
    pushEvent(state, {
      type: 'ITEM_EQUIPPED', actorId: npc.id, zoneId: npc.currentZoneId,
      message: `${npc.name} 装备了 ${getItem(best.stack.itemId).name}。`,
      metadata: { itemId: best.stack.itemId, slot },
    });
  }
}

/** Existing bounded ground-loot maintenance; acquired items remain real UID-bearing stacks. */
export function autoLootNpc(state: GameState, npc: Combatant): void {
  const zone = state.zones[npc.currentZoneId];
  if (!zone || zone.groundItems.length === 0) return;
  let picks = 2;
  for (let index = zone.groundItems.length - 1; index >= 0 && picks > 0; index -= 1) {
    const stack = zone.groundItems[index]!;
    if (!canAccessGroundItem(npc, stack)) continue;
    if (canAccept(npc, stack)) {
      zone.groundItems.splice(index, 1);
      addItem(npc, clearGroundOwnership(stack));
      noteWildPickup(state, stack.itemId);
      observeOwnItem(state, npc, stack.itemId);
      observeOwnAction(state, npc, 'PICKUP', 'success', 'item', stack.itemId);
      picks -= 1;
      pushEvent(state, {
        type: 'ITEM_PICKED', actorId: npc.id, zoneId: zone.id,
        message: `${npc.name} 捡走了地上的 ${getItem(stack.itemId).name}。`,
        metadata: { itemId: stack.itemId },
      });
      continue;
    }

    const worst = npc.inventory.reduce<ItemStack | null>((minimum, current) => {
      if (!minimum) return current;
      return stackValue(current) < stackValue(minimum) ? current : minimum;
    }, null);
    if (!worst || stackValue(stack) <= stackValue(worst) * 1.4) continue;
    const inventoryIndex = npc.inventory.findIndex((candidate) => candidate.uid === worst.uid);
    if (inventoryIndex >= 0) {
      npc.inventory.splice(inventoryIndex, 1);
      zone.groundItems.push(worst);
    }
    zone.groundItems.splice(index, 1);
    addItem(npc, clearGroundOwnership(stack));
    noteWildPickup(state, stack.itemId);
    observeOwnItem(state, npc, stack.itemId);
    observeOwnAction(state, npc, 'PICKUP', 'success', 'item', stack.itemId);
    picks -= 1;
    pushEvent(state, {
      type: 'ITEM_PICKED', actorId: npc.id, zoneId: zone.id,
      message: `${npc.name} 丢下 ${getItem(worst.itemId).name}，换走了 ${getItem(stack.itemId).name}。`,
      metadata: { itemId: stack.itemId, droppedItemId: worst.itemId },
    });
  }
}
