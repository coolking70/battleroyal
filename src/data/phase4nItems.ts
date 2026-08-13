import type { ItemDef } from '../core/types';

export const PHASE4N_WILD_MATERIAL_IDS = [
  'animal_hide', 'animal_bone', 'venom_gland', 'sinew',
  'feral_fang', 'mechanical_core', 'optical_sensor', 'bio_resin',
] as const;

/** Finite wild drops and the deterministic crafting branch they unlock. */
export const PHASE4N_ITEMS: ItemDef[] = [
  { id: 'animal_hide', name: '兽皮', category: 'material', craftTier: 'raw', description: '从野生动物身上剥下的耐磨皮料。', value: 7, stackable: true, maxStack: 5 },
  { id: 'animal_bone', name: '兽骨', category: 'material', craftTier: 'raw', description: '致密而轻的骨材，可加工成握柄。', value: 6, stackable: true, maxStack: 5 },
  { id: 'venom_gland', name: '毒腺', category: 'material', craftTier: 'raw', description: '需要密封处理的生物毒腺。', value: 10, stackable: true, maxStack: 5 },
  { id: 'sinew', name: '筋腱', category: 'material', craftTier: 'raw', description: '高韧性的天然纤维。', value: 7, stackable: true, maxStack: 5 },
  { id: 'feral_fang', name: '锐牙', category: 'material', craftTier: 'raw', description: '野兽留下的锋利齿材。', value: 8, stackable: true, maxStack: 5 },
  { id: 'mechanical_core', name: '机械核心', category: 'material', craftTier: 'raw', description: '自动机械中尚可复用的驱动核心。', value: 12, stackable: true, maxStack: 5 },
  { id: 'optical_sensor', name: '光学传感器', category: 'material', craftTier: 'raw', description: '无人设备的精密观察组件。', value: 12, stackable: true, maxStack: 5 },
  { id: 'bio_resin', name: '生化树脂', category: 'material', craftTier: 'raw', description: '研究事故产物，凝固后异常坚硬。', value: 11, stackable: true, maxStack: 5 },

  { id: 'treated_hide', name: '鞣制兽皮', category: 'component', craftTier: 'component', description: '清理并加固后的防护皮料。', value: 16, stackable: true, maxStack: 5 },
  { id: 'bone_handle', name: '骨制握柄', category: 'component', craftTier: 'component', description: '兽骨与筋腱固定成的轻型握柄。', value: 15, stackable: true, maxStack: 5 },
  { id: 'toxin_extract', name: '毒素提取液', category: 'component', craftTier: 'component', description: '封装在玻璃中的稳定毒素。', value: 20, stackable: true, maxStack: 5 },
  { id: 'advanced_circuit', name: '追踪电路', category: 'component', craftTier: 'component', description: '机械核心和传感器组成的定位电路。', value: 24, stackable: true, maxStack: 5 },
  { id: 'reinforced_sinew', name: '强化筋索', category: 'component', craftTier: 'component', description: '筋腱与绳束复合成的高张力索。', value: 16, stackable: true, maxStack: 5 },
  { id: 'hardened_resin', name: '硬化树脂', category: 'component', craftTier: 'component', description: '以锐牙作为骨料固化的生化树脂。', value: 19, stackable: true, maxStack: 5 },

  { id: 'hunting_armor', name: '猎行护甲', category: 'armor', craftTier: 'final', equipmentSlot: 'armor', armorClass: 'medium', defense: 7, description: '鞣制兽皮与强化筋索组成的灵活护甲。', value: 43, stackable: false, maxStack: 1 },
  { id: 'venom_spear', name: '毒刃长矛', category: 'weapon', craftTier: 'final', equipmentSlot: 'weapon', weaponType: 'melee', weaponFamily: 'blade', attack: 16, durability: 30, description: '骨柄、金属刃与毒素处理构成的长矛。', value: 48, stackable: false, maxStack: 1 },
  { id: 'predator_bow', name: '猎食者弓', category: 'weapon', craftTier: 'final', equipmentSlot: 'weapon', weaponType: 'ranged', weaponFamily: 'bow', attack: 17, durability: 32, description: '骨柄和强化筋索提升了弓体张力。', value: 49, stackable: false, maxStack: 1 },
  { id: 'tracker_scope', name: '追踪瞄具', category: 'utility', craftTier: 'final', equipmentSlot: 'utility', searchFindMult: 1.1, description: '追踪电路封装进硬化树脂，辅助搜索。', value: 42, stackable: false, maxStack: 1 },
];
