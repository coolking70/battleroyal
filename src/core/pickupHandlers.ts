import { tryGetItem } from '../data/items';
import { PHASE4N_WILD_MATERIAL_IDS } from '../data/phase4nItems';
import { pushEvent } from './events';
import { addItem, canAccept, removeStack } from './inventory';
import { canAccessGroundItem, clearGroundOwnership } from './legalActions';
import type { Combatant, GameState } from './types';

interface PickupOutcome { ok: boolean; message: string | null }
const WILD_MATERIALS = new Set<string>(PHASE4N_WILD_MATERIAL_IDS);
const itemName = (itemId: string): string => tryGetItem(itemId)?.name ?? '未知物品';

function noteWildPickup(state: GameState, itemId: string): void {
  if (WILD_MATERIALS.has(itemId)) state.stats.wildMaterialPickups += 1;
}

export function handlePickupGround(state: GameState, player: Combatant, uid: string): PickupOutcome {
  const zone = state.zones[player.currentZoneId];
  if (!zone) return { ok: false, message: '区域数据异常。' };
  const idx = zone.groundItems.findIndex((stack) => stack.uid === uid);
  if (idx < 0) return { ok: false, message: '地上没有这件物品。' };
  const stack = zone.groundItems[idx]!;
  if (!canAccessGroundItem(player, stack)) return { ok: false, message: '你还没有搜索过这里，暂时看不到这件遗物。' };
  const def = tryGetItem(stack.itemId);
  if (!def) {
    zone.groundItems.splice(idx, 1);
    return { ok: false, message: '这件物品的数据已失效，已从地面移除。' };
  }
  if (!canAccept(player, stack)) {
    state.pendingPickup = { stack, source: 'ground', zoneId: zone.id };
    zone.groundItems.splice(idx, 1);
    return { ok: true, message: '背包已满，请选择是否替换。' };
  }
  zone.groundItems.splice(idx, 1);
  addItem(player, clearGroundOwnership(stack));
  noteWildPickup(state, stack.itemId);
  pushEvent(state, { type: 'ITEM_PICKED', actorId: player.id, zoneId: zone.id, message: `你捡起了 ${def.name}。`, metadata: { itemId: stack.itemId } });
  return { ok: true, message: `拾取 ${def.name}。` };
}

export function handleResolvePickup(
  state: GameState,
  player: Combatant,
  accept: boolean,
  dropUid?: string,
): PickupOutcome {
  const pending = state.pendingPickup;
  if (!pending) return { ok: false, message: '没有待处理的拾取。' };
  const zone = state.zones[pending.zoneId];
  if (!accept) {
    state.pendingPickup = null;
    if (zone) zone.groundItems.push(pending.stack);
    pushEvent(state, { type: 'ITEM_DROPPED', actorId: player.id, zoneId: pending.zoneId, message: `你放弃了 ${itemName(pending.stack.itemId)}。`, metadata: { itemId: pending.stack.itemId } });
    return { ok: true, message: '已放弃该物品。' };
  }
  if (!dropUid) return { ok: false, message: '请选择要丢弃的物品。' };
  const dropped = removeStack(player, dropUid);
  if (!dropped) return { ok: false, message: '要丢弃的物品不存在。' };
  if (zone) zone.groundItems.push(dropped);
  addItem(player, clearGroundOwnership(pending.stack));
  noteWildPickup(state, pending.stack.itemId);
  state.pendingPickup = null;
  pushEvent(state, { type: 'ITEM_DROPPED', actorId: player.id, zoneId: pending.zoneId, message: `你丢下 ${itemName(dropped.itemId)}，换取了 ${itemName(pending.stack.itemId)}。`, metadata: { droppedItemId: dropped.itemId, itemId: pending.stack.itemId } });
  return { ok: true, message: '已完成替换。' };
}
