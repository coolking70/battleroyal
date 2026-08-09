import type { ItemCategory, ItemStack } from '../core/types';
import { getItem } from '../data/items';
import { CATEGORY_LABEL, itemSummary, stackLabel } from '../utils/format';
import { getItemVisual } from './visualAssets';

/** 物品在各 UI 场景共用的展示元数据；不承载物品规则或合法性判断。 */
export interface ItemPresentation {
  itemId: string;
  name: string;
  category: ItemCategory;
  categoryLabel: string;
  quantityLabel: string;
  summary: string;
  visual: ReturnType<typeof getItemVisual>;
}

export const ITEM_CATEGORY_META: Record<
  ItemCategory,
  { label: string; icon: string }
> = {
  material: { label: CATEGORY_LABEL.material, icon: '◆' },
  weapon: { label: CATEGORY_LABEL.weapon, icon: '⚔' },
  armor: { label: CATEGORY_LABEL.armor, icon: '▣' },
  consumable: { label: CATEGORY_LABEL.consumable, icon: '✚' },
};

export function presentItem(itemId: string, stack?: ItemStack): ItemPresentation {
  const def = getItem(itemId);
  const normalizedStack = stack ?? { uid: 'presentation', itemId, count: 1 };
  return {
    itemId,
    name: def.name,
    category: def.category,
    categoryLabel: CATEGORY_LABEL[def.category],
    quantityLabel: `数量 ${normalizedStack.count}`,
    summary: itemSummary(def, stack),
    visual: getItemVisual(itemId),
  };
}

export function stackPresentation(stack: ItemStack): ItemPresentation {
  return presentItem(stack.itemId, stack);
}

export function itemLabel(stack: ItemStack): string {
  return stackLabel(stack);
}
