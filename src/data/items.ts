import type { ItemDef } from '../core/types';

/**
 * 第一版物品表：10 材料 + 5 武器 + 3 防具 + 5 消耗品 = 23 种。
 * 所有名称与描述均为原创占位内容。
 */
export const ITEMS: ItemDef[] = [
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
