import type { ItemDef } from '../core/types';

/**
 * Phase 4M additions. Components are ordinary conserved inventory items: every
 * craft consumes them and every successful craft produces exactly one stack.
 * They are deliberately fixed definitions; there are no rarity rolls or
 * procedural modifiers.
 */
export const PHASE4M_ITEMS: ItemDef[] = [
  { id: 'metal_plate', name: '金属板', category: 'component', craftTier: 'component', description: '把铁料压平后的基础板件。', value: 12, stackable: true, maxStack: 5 },
  { id: 'sharpened_metal', name: '磨利金属', category: 'component', craftTier: 'component', description: '处理过的金属刃口，可装配多种武器。', value: 16, stackable: true, maxStack: 5 },
  { id: 'metal_parts', name: '金属零件', category: 'component', craftTier: 'component', description: '工厂拆解并分类的通用金属零件。', value: 14, stackable: true, maxStack: 5 },
  { id: 'reinforced_frame', name: '加固框架', category: 'component', craftTier: 'component', description: '承重结构件，是护甲与重武器的共同骨架。', value: 20, stackable: true, maxStack: 5 },
  { id: 'wooden_handle', name: '木制握柄', category: 'component', craftTier: 'component', description: '打磨并加固的握持部件。', value: 12, stackable: true, maxStack: 5 },
  { id: 'processed_wood', name: '处理木材', category: 'component', craftTier: 'component', description: '削平、烘干后的木料，适合做结构件。', value: 10, stackable: true, maxStack: 5 },
  { id: 'bow_limb', name: '弓臂', category: 'component', craftTier: 'component', description: '有弹性的木质弓臂。', value: 13, stackable: true, maxStack: 5 },
  { id: 'cloth_roll', name: '布卷', category: 'component', craftTier: 'component', description: '裁切并卷好的布料，医疗与护甲共用。', value: 10, stackable: true, maxStack: 5 },
  { id: 'reinforced_cloth', name: '加固布层', category: 'component', craftTier: 'component', description: '多层缝合后的柔性防护材料。', value: 16, stackable: true, maxStack: 5 },
  { id: 'rope_bundle', name: '绳束', category: 'component', craftTier: 'component', description: '整理成束的高强度绳索。', value: 11, stackable: true, maxStack: 5 },
  { id: 'wire', name: '导线', category: 'component', craftTier: 'component', description: '剥皮并整理好的导电线材。', value: 12, stackable: true, maxStack: 5 },
  { id: 'circuit', name: '电路板', category: 'component', craftTier: 'component', description: '可复用的简易控制电路。', value: 18, stackable: true, maxStack: 5 },
  { id: 'battery_pack', name: '电池组', category: 'component', craftTier: 'component', description: '串联并绝缘后的稳定电源。', value: 22, stackable: true, maxStack: 5 },
  { id: 'antiseptic', name: '消毒液', category: 'component', craftTier: 'component', description: '药草与酒精处理出的基础消毒剂。', value: 13, stackable: true, maxStack: 5 },
  { id: 'chemical_mix', name: '药剂混合物', category: 'component', craftTier: 'component', description: '经过容器调配的复合药剂。', value: 20, stackable: true, maxStack: 5 },
  { id: 'medical_kit_parts', name: '医疗包组件', category: 'component', craftTier: 'component', description: '已分装的医疗包内部组件。', value: 24, stackable: true, maxStack: 5 },

  { id: 'reinforced_pipe', name: '加固铁管', category: 'weapon', craftTier: 'final', equipmentSlot: 'weapon', weaponType: 'melee', weaponFamily: 'blunt', attack: 13, durability: 38, description: '金属零件与木制握柄加固的钝击武器。', value: 38, stackable: false, maxStack: 1 },
  { id: 'machete', name: '砍刀', category: 'weapon', craftTier: 'final', equipmentSlot: 'weapon', weaponType: 'melee', weaponFamily: 'blade', attack: 14, durability: 28, description: '磨利金属装上握柄，适合快速劈砍。', value: 39, stackable: false, maxStack: 1 },
  { id: 'war_axe', name: '战斧', category: 'weapon', craftTier: 'final', equipmentSlot: 'weapon', weaponType: 'melee', weaponFamily: 'heavy', attack: 16, durability: 36, description: '重型加固框架承载锋利刃口，力量感十足。', value: 45, stackable: false, maxStack: 1 },
  { id: 'reinforced_bow', name: '加固弓', category: 'weapon', craftTier: 'final', equipmentSlot: 'weapon', weaponType: 'ranged', weaponFamily: 'bow', attack: 14, durability: 30, description: '弓臂与绳束配合，远程出手更稳定。', value: 40, stackable: false, maxStack: 1 },
  { id: 'composite_bow_upgrade', name: '复合弓升级件', category: 'weapon', craftTier: 'final', equipmentSlot: 'weapon', weaponType: 'ranged', weaponFamily: 'bow', attack: 17, durability: 34, description: '在加固弓上增加玻璃支撑的终阶远程武器。', value: 48, stackable: false, maxStack: 1 },
  { id: 'improvised_spear', name: '改装投矛', category: 'weapon', craftTier: 'final', equipmentSlot: 'weapon', weaponType: 'ranged', weaponFamily: 'improvised_ranged', attack: 12, durability: 24, description: '临时制作的投掷长矛，不需要弹药。', value: 34, stackable: false, maxStack: 1 },
  { id: 'shock_baton', name: '冲击电棍', category: 'weapon', craftTier: 'final', equipmentSlot: 'weapon', weaponType: 'melee', weaponFamily: 'electric_special', attack: 15, durability: 26, description: '电池组驱动电路，对近身目标产生强烈冲击。', value: 46, stackable: false, maxStack: 1 },

  { id: 'light_vest', name: '轻型背心', category: 'armor', craftTier: 'final', equipmentSlot: 'armor', armorClass: 'light', defense: 3, description: '轻便的加固布层，保留移动灵活性。', value: 18, stackable: false, maxStack: 1 },
  { id: 'reinforced_armor', name: '强化护甲', category: 'armor', craftTier: 'final', equipmentSlot: 'armor', armorClass: 'medium', defense: 6, description: '加固框架与布层组合的中型防护。', value: 35, stackable: false, maxStack: 1 },
  { id: 'heavy_armor', name: '重型护甲', category: 'armor', craftTier: 'final', equipmentSlot: 'armor', armorClass: 'heavy', defense: 9, description: '厚重框架和金属板组成的终阶防具。', value: 50, stackable: false, maxStack: 1 },
  { id: 'field_kit', name: '野外工具包', category: 'utility', craftTier: 'final', equipmentSlot: 'utility', searchFindMult: 1.08, description: '整理搜索工具，使发现物资的机会略有提升。', value: 28, stackable: false, maxStack: 1 },
  { id: 'trauma_kit', name: '创伤急救包', category: 'consumable', craftTier: 'final', healHp: 55, description: '由医疗包组件与复合药剂组成的固定急救品。', value: 42, stackable: true, maxStack: 2 },
];
