import { GAME_CONFIG } from '../data/gameConfig';
import { getItem } from '../data/items';
import type {
  Combatant,
  GameState,
  ItemDef,
  ItemStack,
  RecipeIngredient,
} from './types';

/* ------------------------------------------------------------------ */
/* 实例创建                                                            */
/* ------------------------------------------------------------------ */

/** 生成一个确定性的实例 uid（自增，不使用随机数或时间戳） */
export function nextUid(state: GameState): string {
  const uid = `i${state.uidSeq}`;
  state.uidSeq += 1;
  return uid;
}

export function createStack(
  state: GameState,
  itemId: string,
  count = 1,
): ItemStack {
  const def = getItem(itemId);
  const stack: ItemStack = {
    uid: nextUid(state),
    itemId,
    count: def.stackable ? count : 1,
  };
  if (def.category === 'weapon' && typeof def.durability === 'number') {
    stack.durability = def.durability;
  }
  return stack;
}

/* ------------------------------------------------------------------ */
/* 查询                                                                */
/* ------------------------------------------------------------------ */

export function usedSlots(c: Combatant): number {
  return c.inventory.length;
}

export function hasFreeSlot(c: Combatant): boolean {
  return c.inventory.length < GAME_CONFIG.inventorySlots;
}

export function countItem(c: Combatant, itemId: string): number {
  return c.inventory
    .filter((s) => s.itemId === itemId)
    .reduce((sum, s) => sum + s.count, 0);
}

export function findStack(c: Combatant, uid: string): ItemStack | null {
  return c.inventory.find((s) => s.uid === uid) ?? null;
}

export function getEquippedWeapon(c: Combatant): ItemStack | null {
  if (!c.equippedWeaponId) return null;
  return c.equipment.find((s) => s.uid === c.equippedWeaponId) ?? null;
}

export function getEquippedArmor(c: Combatant): ItemStack | null {
  if (!c.equippedArmorId) return null;
  return c.equipment.find((s) => s.uid === c.equippedArmorId) ?? null;
}

export function weaponAttackOf(c: Combatant): number {
  const w = getEquippedWeapon(c);
  if (!w) return 0;
  return getItem(w.itemId).attack ?? 0;
}

export function armorDefenseOf(c: Combatant): number {
  const a = getEquippedArmor(c);
  if (!a) return 0;
  return getItem(a.itemId).defense ?? 0;
}

/** 总攻击 = 基础攻击 + 武器攻击 */
export function totalAttack(c: Combatant): number {
  return c.attack + weaponAttackOf(c);
}

/** 总防御 = 基础防御 + 防具防御 */
export function totalDefense(c: Combatant): number {
  return c.defense + armorDefenseOf(c);
}

/** 一个物品堆的总价值，用于 NPC 取舍与掉落排序 */
export function stackValue(stack: ItemStack): number {
  return getItem(stack.itemId).value * stack.count;
}

/* ------------------------------------------------------------------ */
/* 增删                                                                */
/* ------------------------------------------------------------------ */

export interface AddItemResult {
  ok: boolean;
  /** 未能放入的剩余数量 */
  leftover: number;
  reason: 'ok' | 'no_space';
}

/**
 * 尝试把物品放进背包。
 * 优先堆叠到已有同类堆，再占用空格。
 */
export function addItem(c: Combatant, stack: ItemStack): AddItemResult {
  const def = getItem(stack.itemId);
  let remaining = stack.count;

  if (def.stackable) {
    for (const s of c.inventory) {
      if (s.itemId !== stack.itemId) continue;
      const room = def.maxStack - s.count;
      if (room <= 0) continue;
      const moved = Math.min(room, remaining);
      s.count += moved;
      remaining -= moved;
      if (remaining === 0) return { ok: true, leftover: 0, reason: 'ok' };
    }
  }

  while (remaining > 0 && hasFreeSlot(c)) {
    const put = def.stackable ? Math.min(def.maxStack, remaining) : 1;
    c.inventory.push({
      uid: stack.uid && remaining === stack.count ? stack.uid : `${stack.uid}_${remaining}`,
      itemId: stack.itemId,
      count: put,
      ...(stack.durability !== undefined ? { durability: stack.durability } : {}),
    });
    remaining -= put;
  }

  if (remaining > 0) {
    return { ok: false, leftover: remaining, reason: 'no_space' };
  }
  return { ok: true, leftover: 0, reason: 'ok' };
}

/** 判断一个物品堆是否能够完整放入背包（不实际放入） */
export function canAccept(c: Combatant, stack: ItemStack): boolean {
  const def = getItem(stack.itemId);
  let remaining = stack.count;
  if (def.stackable) {
    for (const s of c.inventory) {
      if (s.itemId !== stack.itemId) continue;
      remaining -= Math.max(0, def.maxStack - s.count);
      if (remaining <= 0) return true;
    }
  }
  const free = GAME_CONFIG.inventorySlots - c.inventory.length;
  const perSlot = def.stackable ? def.maxStack : 1;
  return remaining <= free * perSlot;
}

/** 按 uid 移除整个物品堆，返回被移除的堆 */
export function removeStack(c: Combatant, uid: string): ItemStack | null {
  const idx = c.inventory.findIndex((s) => s.uid === uid);
  if (idx < 0) return null;
  const [removed] = c.inventory.splice(idx, 1);
  return removed ?? null;
}

/** 按 uid 移除 1 个（堆叠物品只减 1，减到 0 则移除该格） */
export function consumeOne(c: Combatant, uid: string): boolean {
  const stack = findStack(c, uid);
  if (!stack) return false;
  stack.count -= 1;
  if (stack.count <= 0) {
    removeStack(c, uid);
  }
  return true;
}

/** 检查是否拥有配方所需的全部材料 */
export function hasIngredients(
  c: Combatant,
  ingredients: RecipeIngredient[],
): boolean {
  return ingredients.every((ing) => countItem(c, ing.itemId) >= ing.count);
}

/** 缺少的材料清单（用于界面提示） */
export function missingIngredients(
  c: Combatant,
  ingredients: RecipeIngredient[],
): RecipeIngredient[] {
  const out: RecipeIngredient[] = [];
  for (const ing of ingredients) {
    const have = countItem(c, ing.itemId);
    if (have < ing.count) {
      out.push({ itemId: ing.itemId, count: ing.count - have });
    }
  }
  return out;
}

/**
 * 扣除配方材料。调用前必须先用 hasIngredients 校验。
 * @returns 是否成功扣除
 */
export function consumeIngredients(
  c: Combatant,
  ingredients: RecipeIngredient[],
): boolean {
  if (!hasIngredients(c, ingredients)) return false;
  for (const ing of ingredients) {
    let need = ing.count;
    // 从后往前扣，避免 splice 影响遍历
    for (let i = c.inventory.length - 1; i >= 0 && need > 0; i--) {
      const s = c.inventory[i]!;
      if (s.itemId !== ing.itemId) continue;
      const take = Math.min(s.count, need);
      s.count -= take;
      need -= take;
      if (s.count <= 0) c.inventory.splice(i, 1);
    }
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* 装备                                                                */
/* ------------------------------------------------------------------ */

export interface EquipResult {
  ok: boolean;
  reason: 'ok' | 'not_found' | 'not_equipable' | 'no_space';
  itemDef: ItemDef | null;
  /** 被换下来的旧装备 */
  replaced: ItemStack | null;
}

/**
 * 装备背包中的某个物品。
 * 装备槽独立于背包格：物品离开背包进入装备槽，旧装备回到背包，净占格变化为 0。
 */
export function equipItem(c: Combatant, uid: string): EquipResult {
  const stack = findStack(c, uid);
  if (!stack) {
    return { ok: false, reason: 'not_found', itemDef: null, replaced: null };
  }
  const def = getItem(stack.itemId);
  if (def.category !== 'weapon' && def.category !== 'armor') {
    return { ok: false, reason: 'not_equipable', itemDef: def, replaced: null };
  }

  const slot = def.category === 'weapon' ? 'weapon' : 'armor';
  const oldStack = slot === 'weapon' ? getEquippedWeapon(c) : getEquippedArmor(c);

  // 先把新装备从背包取出，这样必定为旧装备腾出一格
  removeStack(c, uid);

  if (oldStack) {
    c.equipment = c.equipment.filter((s) => s.uid !== oldStack.uid);
    const res = addItem(c, oldStack);
    if (!res.ok) {
      // 理论上不会发生（刚腾出一格）；发生则回滚，保证状态一致
      c.equipment.push(oldStack);
      c.inventory.push(stack);
      return { ok: false, reason: 'no_space', itemDef: def, replaced: null };
    }
  }

  c.equipment.push(stack);
  if (slot === 'weapon') {
    c.equippedWeaponId = stack.uid;
  } else {
    c.equippedArmorId = stack.uid;
  }
  return { ok: true, reason: 'ok', itemDef: def, replaced: oldStack };
}

/** 卸下装备放回背包 */
export function unequip(c: Combatant, slot: 'weapon' | 'armor'): boolean {
  const stack = slot === 'weapon' ? getEquippedWeapon(c) : getEquippedArmor(c);
  if (!stack) return false;
  if (!hasFreeSlot(c)) return false;
  c.equipment = c.equipment.filter((s) => s.uid !== stack.uid);
  c.inventory.push(stack);
  if (slot === 'weapon') c.equippedWeaponId = null;
  else c.equippedArmorId = null;
  return true;
}

/** 移除已损坏的武器（耐久归零） */
export function destroyEquippedWeapon(c: Combatant): ItemStack | null {
  const w = getEquippedWeapon(c);
  if (!w) return null;
  c.equipment = c.equipment.filter((s) => s.uid !== w.uid);
  c.equippedWeaponId = null;
  return w;
}

/** 背包中价值最高的若干物品堆（用于尸体掉落） */
export function topValueStacks(c: Combatant, n: number): ItemStack[] {
  return c.inventory
    .slice()
    .sort((a, b) => stackValue(b) - stackValue(a))
    .slice(0, n);
}
