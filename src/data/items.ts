import type { CraftTier, ItemDef } from '../core/types';
import { PHASE4M_ITEMS } from './phase4mItems';

/**
 * Phase 4C-1 物品表：10 材料 + 11 武器 + 3 防具 + 5 消耗品 = 29 种。
 * 新增武器没有正式 PNG，统一沿用 VisualImage 的 SVG / emoji fallback。
 */
type LegacyItemDef = Omit<ItemDef, 'craftTier'> & { craftTier?: CraftTier };

const LEGACY_ITEMS: LegacyItemDef[] = [
  /* ---------------- 材料 ---------------- */
  {
    id: 'wood',
    name: '木材',
    category: 'material',
    description: '从倒塌家具上拆下来的木条，最基础的制作材料。',
    value: 3,
    stackable: true,
    maxStack: 5,
  },
  {
    id: 'stone',
    name: '石头',
    category: 'material',
    description: '边缘还算锋利的碎石块，可以充当刃口。',
    value: 3,
    stackable: true,
    maxStack: 5,
  },
  {
    id: 'iron',
    name: '铁块',
    category: 'material',
    description: '沉甸甸的铸铁块，敲打后能成为护甲板。',
    value: 6,
    stackable: true,
    maxStack: 5,
  },
  {
    id: 'cloth',
    name: '布料',
    category: 'material',
    description: '撕下来的窗帘与床单，用途很广。',
    value: 3,
    stackable: true,
    maxStack: 5,
  },
  {
    id: 'rope',
    name: '绳子',
    category: 'material',
    description: '一小捆尼龙绳，捆绑与拉弦都靠它。',
    value: 4,
    stackable: true,
    maxStack: 5,
  },
  {
    id: 'glass',
    name: '玻璃',
    category: 'material',
    description: '完整的玻璃器皿碎片，实验室里到处都是。',
    value: 4,
    stackable: true,
    maxStack: 5,
  },
  {
    id: 'battery',
    name: '电池',
    category: 'material',
    description: '还有余电的工业电池，谨慎短路。',
    value: 8,
    stackable: true,
    maxStack: 5,
  },
  {
    id: 'herb',
    name: '药草',
    category: 'material',
    description: '未经处理的止血植物，需要加工才能使用。',
    value: 5,
    stackable: true,
    maxStack: 5,
  },
  {
    id: 'alcohol',
    name: '酒精',
    category: 'material',
    description: '医用消毒酒精，配药与点火都行。',
    value: 5,
    stackable: true,
    maxStack: 5,
  },
  {
    id: 'scrap',
    name: '废金属',
    category: 'material',
    description: '车间角落的金属边角料，管材的来源。',
    value: 4,
    stackable: true,
    maxStack: 5,
  },

  /* ---------------- 武器 ---------------- */
  {
    id: 'stick',
    name: '木棍',
    category: 'weapon',
    weaponType: 'melee',
    attack: 3,
    durability: 20,
    description: '削尖的木棍。聊胜于无，但确实能打人。',
    value: 10,
    stackable: false,
    maxStack: 1,
  },
  {
    id: 'stone_axe',
    name: '石斧',
    category: 'weapon',
    weaponType: 'melee',
    attack: 6,
    durability: 22,
    description: '石头绑在木柄上，重量带来的伤害很实在。',
    value: 18,
    stackable: false,
    maxStack: 1,
  },
  {
    id: 'iron_pipe',
    name: '铁管',
    category: 'weapon',
    weaponType: 'melee',
    attack: 8,
    durability: 30,
    description: '一米长的工业铁管，握感冰冷且耐用。',
    value: 24,
    stackable: false,
    maxStack: 1,
  },
  {
    id: 'simple_bow',
    name: '简易弓',
    category: 'weapon',
    weaponType: 'ranged',
    attack: 7,
    durability: 18,
    description: '木条与绳子做成的弓。远程出手更容易命中。',
    value: 22,
    stackable: false,
    maxStack: 1,
  },
  {
    id: 'stun_rod',
    name: '电击棒',
    category: 'weapon',
    weaponType: 'melee',
    attack: 11,
    durability: 15,
    description: '接了电池的金属棒，电流让对手很难还手。',
    value: 32,
    stackable: false,
    maxStack: 1,
  },
  /* ---------------- 武器 · Phase 4C-1 深层成品 ---------------- */
  {
    id: 'reinforced_handle',
    name: '加固握把',
    category: 'weapon',
    weaponType: 'melee',
    attack: 4,
    durability: 24,
    description: '木棍外缠绳子，握持更稳，是长柄武器的中间部件。',
    value: 14,
    stackable: false,
    maxStack: 1,
  },
  {
    id: 'field_spear',
    name: '野外长矛',
    category: 'weapon',
    weaponType: 'melee',
    attack: 9,
    durability: 28,
    description: '加固握把接上铁片，适合在野外保持距离。',
    value: 28,
    stackable: false,
    maxStack: 1,
  },
  {
    id: 'steel_axe',
    name: '钢刃斧',
    category: 'weapon',
    weaponType: 'melee',
    attack: 12,
    durability: 32,
    description: '石斧换上铁块加固，沉重但能应付更强的对手。',
    value: 30,
    stackable: false,
    maxStack: 1,
  },
  {
    id: 'composite_bow',
    name: '复合弓',
    category: 'weapon',
    weaponType: 'ranged',
    attack: 12,
    durability: 24,
    description: '用玻璃片加固弓身，弓弦张力更稳定。',
    value: 30,
    stackable: false,
    maxStack: 1,
  },
  {
    id: 'insulated_pipe',
    name: '绝缘铁管',
    category: 'weapon',
    weaponType: 'melee',
    attack: 12,
    durability: 34,
    description: '铁管包上布料，握持更安全，也更适合持续近战。',
    value: 31,
    stackable: false,
    maxStack: 1,
  },
  {
    id: 'insulated_stun_rod',
    name: '绝缘电击棒',
    category: 'weapon',
    weaponType: 'melee',
    attack: 12,
    durability: 20,
    description: '电击棒加上布料绝缘，输出更强但仍需小心电池。',
    value: 31,
    stackable: false,
    maxStack: 1,
  },

  /* ---------------- 防具 ---------------- */
  {
    id: 'cloth_armor',
    name: '布衣',
    category: 'armor',
    defense: 2,
    description: '多层布料缝制的软甲，挡不住利器但比没有强。',
    value: 10,
    stackable: false,
    maxStack: 1,
  },
  {
    id: 'simple_armor',
    name: '简易护甲',
    category: 'armor',
    defense: 4,
    description: '布料内衬铁片，穿上后动作略显笨重。',
    value: 20,
    stackable: false,
    maxStack: 1,
  },
  {
    id: 'plate_armor',
    name: '铁板护甲',
    category: 'armor',
    defense: 7,
    description: '厚重铁板拼接的护甲，钝器打上去只剩闷响。',
    value: 34,
    stackable: false,
    maxStack: 1,
  },

  /* ---------------- 消耗品 ---------------- */
  {
    id: 'bandage',
    name: '绷带',
    category: 'consumable',
    healHp: 15,
    description: '干净的绷带，能快速止住流血。',
    value: 12,
    stackable: true,
    maxStack: 3,
  },
  {
    id: 'herb_remedy',
    name: '草药',
    category: 'consumable',
    healHp: 10,
    healStamina: 10,
    description: '捣碎调配好的草药，回复少量生命与体力。',
    value: 14,
    stackable: true,
    maxStack: 3,
  },
  {
    id: 'medkit',
    name: '医疗包',
    category: 'consumable',
    healHp: 40,
    description: '规范配置的急救包，能处理相当严重的伤口。',
    value: 30,
    stackable: true,
    maxStack: 2,
  },
  {
    id: 'water',
    name: '饮用水',
    category: 'consumable',
    healStamina: 20,
    description: '一瓶还没开封的水，缓解疲劳。',
    value: 8,
    stackable: true,
    maxStack: 3,
  },
  {
    id: 'energy_drink',
    name: '能量饮料',
    category: 'consumable',
    healStamina: 40,
    healHp: 5,
    description: '味道糟糕的功能饮料，体力恢复非常明显。',
    value: 18,
    stackable: true,
    maxStack: 2,
  },
];

const RAW_LEGACY_IDS = new Set([
  'wood', 'stone', 'iron', 'cloth', 'rope', 'glass', 'battery', 'herb', 'alcohol', 'scrap', 'water', 'energy_drink',
]);
const COMPONENT_LEGACY_IDS = new Set(['reinforced_handle']);

function enrichLegacyItem(item: LegacyItemDef): ItemDef {
  const category = COMPONENT_LEGACY_IDS.has(item.id) ? 'component' : item.category;
  const craftTier = item.craftTier ?? (
    RAW_LEGACY_IDS.has(item.id)
      ? 'raw'
      : COMPONENT_LEGACY_IDS.has(item.id)
        ? 'component'
        : 'final'
  );
  const equipmentSlot = craftTier === 'final'
    ? category === 'weapon'
      ? 'weapon'
      : category === 'armor'
        ? 'armor'
        : undefined
    : undefined;
  const weaponFamily = item.weaponFamily ?? (
    item.weaponType === 'ranged' ? 'bow' : 'blunt'
  );
  return {
    ...item,
    category,
    craftTier,
    ...(equipmentSlot ? { equipmentSlot } : {}),
    ...(item.weaponType ? { weaponFamily } : {}),
  };
}

export const ITEMS: ItemDef[] = [
  ...LEGACY_ITEMS.map(enrichLegacyItem),
  ...PHASE4M_ITEMS,
];

export function validateItemRegistry(items: readonly ItemDef[] = ITEMS): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  const categories = new Set(['material', 'component', 'weapon', 'armor', 'consumable', 'utility']);
  const tiers = new Set(['raw', 'component', 'final']);
  for (const item of items) {
    if (ids.has(item.id)) errors.push(`重复物品 id：${item.id}`);
    ids.add(item.id);
    if (names.has(item.name)) errors.push(`重复物品名称：${item.name}`);
    names.add(item.name);
    if (!item.id || !/^[a-z][a-z0-9_]*$/.test(item.id)) errors.push(`物品 id 非 snake_case：${item.id}`);
    if (!categories.has(item.category)) errors.push(`物品 ${item.id} 类别非法`);
    if (!tiers.has(item.craftTier)) errors.push(`物品 ${item.id} craftTier 非法`);
    if (!Number.isInteger(item.maxStack) || item.maxStack <= 0) errors.push(`物品 ${item.id} maxStack 非法`);
    if (item.stackable && item.maxStack < 2) errors.push(`可堆叠物品 ${item.id} maxStack 必须大于 1`);
    if (!item.stackable && item.maxStack !== 1) errors.push(`不可堆叠物品 ${item.id} maxStack 必须为 1`);
    for (const [key, value] of Object.entries(item)) {
      if (['value', 'maxStack', 'attack', 'defense', 'durability', 'healHp', 'healStamina'].includes(key) && value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
        errors.push(`物品 ${item.id} 的 ${key} 不得为负或非有限数`);
      }
    }
    if (item.category === 'weapon') {
      if (item.craftTier === 'final' && item.equipmentSlot !== 'weapon') errors.push(`最终武器 ${item.id} 缺少 weapon 槽位`);
      if (!Number.isInteger(item.durability) || (item.durability ?? 0) <= 0) errors.push(`武器 ${item.id} 初始耐久非法`);
      if (item.weaponType === undefined || item.weaponFamily === undefined) errors.push(`武器 ${item.id} 缺少 family/type`);
    }
    if (item.category === 'armor' && item.craftTier === 'final' && item.equipmentSlot !== 'armor') errors.push(`最终防具 ${item.id} 缺少 armor 槽位`);
    if (item.category === 'utility' && (item.craftTier !== 'final' || item.equipmentSlot !== 'utility')) errors.push(`utility ${item.id} 必须是最终 utility 装备`);
    if (item.searchFindMult !== undefined && (typeof item.searchFindMult !== 'number' || !Number.isFinite(item.searchFindMult) || item.searchFindMult <= 0)) {
      errors.push(`物品 ${item.id} searchFindMult 必须是有限正数`);
    }
    if (item.category === 'consumable' && item.craftTier === 'final' && (item.healHp ?? 0) <= 0 && (item.healStamina ?? 0) <= 0) errors.push(`消耗品 ${item.id} 缺少正向效果`);
  }
  return errors;
}

const itemRegistryErrors = validateItemRegistry();
if (itemRegistryErrors.length > 0) throw new Error(itemRegistryErrors.join('；'));

const ITEM_MAP: Record<string, ItemDef> = Object.fromEntries(
  ITEMS.map((i) => [i.id, i]),
);

/** 按 id 取物品定义；未知 id 抛错，避免静默失败 */
export function getItem(itemId: string): ItemDef {
  const def = ITEM_MAP[itemId];
  if (!def) {
    throw new Error(`未知物品 id: ${itemId}`);
  }
  return def;
}

export function tryGetItem(itemId: string): ItemDef | null {
  return ITEM_MAP[itemId] ?? null;
}

export const MATERIAL_IDS: string[] = ITEMS.filter(
  (i) => i.category === 'material',
).map((i) => i.id);
