import { PERSONALITY_LABEL } from '../core/gameState';
import type {
  Combatant,
  ItemCategory,
  ItemDef,
  ItemStack,
  Personality,
  ZoneStatus,
} from '../core/types';
import { getItem } from '../data/items';

/** 类名拼接：过滤掉 false / null / undefined / '' */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 百分比（0-100，整数），用于血条宽度 */
export function percent(value: number, max: number): number {
  if (max <= 0) return 0;
  return clamp(Math.round((value / max) * 100), 0, 100);
}

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  material: '材料',
  weapon: '武器',
  armor: '防具',
  consumable: '消耗品',
};

export const ZONE_STATUS_LABEL: Record<ZoneStatus, string> = {
  safe: '安全',
  warning: '预警',
  restricted: '禁区',
};

export function personalityLabel(p: Personality): string {
  return PERSONALITY_LABEL[p];
}

/** 物品堆的显示名（含数量后缀） */
export function stackLabel(stack: ItemStack): string {
  const def = getItem(stack.itemId);
  return stack.count > 1 ? `${def.name} ×${stack.count}` : def.name;
}

/** 物品的一行属性摘要，例如「攻击 +6 · 耐久 12」 */
export function itemSummary(def: ItemDef, stack?: ItemStack): string {
  const parts: string[] = [];
  if (def.attack !== undefined) parts.push(`攻击 +${def.attack}`);
  if (def.defense !== undefined) parts.push(`防御 +${def.defense}`);
  if (def.healHp) parts.push(`生命 +${def.healHp}`);
  if (def.healStamina) parts.push(`体力 +${def.healStamina}`);
  if (def.category === 'weapon') {
    const cur = stack?.durability ?? def.durability ?? 0;
    parts.push(`耐久 ${cur}/${def.durability ?? 0}`);
    parts.push(def.weaponType === 'ranged' ? '远程' : '近战');
  }
  if (parts.length === 0) parts.push(`价值 ${def.value}`);
  return parts.join(' · ');
}

/** 生命比例对应的健康状态描述（用于 NPC 观察面板，不暴露精确数值） */
export function hpDescriptor(c: Combatant): string {
  if (!c.alive) return '已出局';
  const ratio = c.hp / c.maxHp;
  if (ratio > 0.85) return '状态良好';
  if (ratio > 0.6) return '轻伤';
  if (ratio > 0.35) return '负伤';
  if (ratio > 0.15) return '重伤';
  return '濒死';
}

/** 把种子输入规范化：去空格、转大写、限制长度与字符集 */
export function normalizeSeed(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\-_]/g, '');
  return cleaned.slice(0, 24);
}
