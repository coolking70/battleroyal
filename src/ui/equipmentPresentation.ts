import {
  armorDefenseOf,
  getEquippedArmor,
  getEquippedUtility,
  getEquippedWeapon,
  weaponAttackOf,
} from '../core/inventory';
import type { Combatant, ItemCategory, ItemStack } from '../core/types';
import { getItem } from '../data/items';

/**
 * 玩家自己的“拿到后是否值得立刻装备”展示状态。
 *
 * 这是 UI 交接层，不参与战斗结算，也不替代 core 的 EQUIP 合法性检查。
 * 评分只使用公开的静态武器攻击 / 防具防御数值和玩家自己的装备。
 */
export type EquipmentSlot = 'weapon' | 'armor' | 'utility';
export type EquipmentHandoffStatus = 'none' | 'equipped' | 'ready' | 'backup';

export interface EquipmentHandoff {
  slot: EquipmentSlot;
  itemId: string;
  candidate: ItemStack | null;
  equipped: ItemStack | null;
  status: EquipmentHandoffStatus;
  candidateScore: number;
  equippedScore: number;
}

function slotOf(category: ItemCategory): EquipmentSlot | null {
  if (category === 'weapon') return 'weapon';
  if (category === 'armor') return 'armor';
  if (category === 'utility') return 'utility';
  return null;
}

function scoreOf(itemId: string, slot: EquipmentSlot): number {
  const item = getItem(itemId);
  return slot === 'weapon'
    ? item.attack ?? 0
    : slot === 'armor'
      ? item.defense ?? 0
      : (item.searchFindMult ?? 1) * 100;
}

function equippedFor(player: Combatant, slot: EquipmentSlot): ItemStack | null {
  return slot === 'weapon'
    ? getEquippedWeapon(player)
    : slot === 'armor'
      ? getEquippedArmor(player)
      : getEquippedUtility(player);
}

function metricLabel(slot: EquipmentSlot): string {
  return slot === 'weapon' ? '攻击' : slot === 'armor' ? '防御' : '搜索效率';
}

/** 返回玩家背包中同一物品的一个实例，供父层派发精确 uid 的 EQUIP。 */
export function inventoryEquipmentCandidate(
  player: Combatant,
  itemId: string,
): ItemStack | null {
  const category = getItem(itemId).category;
  const slot = slotOf(category);
  if (!slot) return null;
  return player.inventory
    .filter((stack) => getItem(stack.itemId).category === category)
    .sort((a, b) => scoreOf(b.itemId, slot) - scoreOf(a.itemId, slot) || a.uid.localeCompare(b.uid))
    .find((stack) => stack.itemId === itemId) ?? null;
}

/**
 * 把搜索 / 合成结果映射成玩家自己的装备交接提示。
 * `EQUIP` 仍由父层通过正式命令通道派发；这里不修改 Combatant。
 */
export function equipmentHandoffFor(
  player: Combatant,
  itemId: string,
): EquipmentHandoff | null {
  const slot = slotOf(getItem(itemId).category);
  if (!slot) return null;

  const equipped = equippedFor(player, slot);
  const candidate = inventoryEquipmentCandidate(player, itemId);
  const candidateScore = scoreOf(itemId, slot);
  // 只比较槽位关键属性；耐久度刻意不参与本轮提示判定。
  const equippedScore = slot === 'weapon'
    ? weaponAttackOf(player)
    : slot === 'armor'
      ? armorDefenseOf(player)
      : equipped ? scoreOf(equipped.itemId, slot) : 0;

  let status: EquipmentHandoffStatus = 'none';
  if (equipped?.itemId === itemId) status = 'equipped';
  else if (candidate && (!equipped || candidateScore > equippedScore)) status = 'ready';
  else if (candidate) status = 'backup';

  return { slot, itemId, candidate, equipped, status, candidateScore, equippedScore };
}

/** 合成提示中的简短数值对比；只允许展示玩家自己的装备与成品数值。 */
export function equipmentComparisonText(handoff: EquipmentHandoff): string {
  const metric = metricLabel(handoff.slot);
  return handoff.equipped
    ? `${metric} ${handoff.equippedScore} → ${handoff.candidateScore}`
    : `当前空槽 · ${metric} +${handoff.candidateScore}`;
}

/** 合成成品只有空槽或严格变强时才给装备提示。 */
export function shouldPromptCraftEquipment(handoff: EquipmentHandoff | null): boolean {
  return Boolean(handoff?.candidate && handoff.status === 'ready');
}

/** 背包装备槽使用：总是显示该槽位数值最高的候选，而不是第一格物品。 */
export function bestInventoryEquipment(
  player: Combatant,
  slot: EquipmentSlot,
): ItemStack | null {
  const category: ItemCategory = slot === 'weapon' ? 'weapon' : slot === 'armor' ? 'armor' : 'utility';
  return player.inventory
    .filter((stack) => getItem(stack.itemId).category === category)
    .sort((a, b) => scoreOf(b.itemId, slot) - scoreOf(a.itemId, slot) || a.uid.localeCompare(b.uid))[0] ?? null;
}
