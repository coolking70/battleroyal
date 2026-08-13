import type { Recipe } from '../core/types';

/** Shared component graph for Phase 4M. Order is raw -> component -> final. */
export const PHASE4M_RECIPES: Recipe[] = [
  { id: 'r_metal_plate', name: '金属板', ingredients: [{ itemId: 'iron', count: 2 }], outputItemId: 'metal_plate', outputCount: 1, description: '把两份铁料压平成通用板件。' },
  { id: 'r_sharpened_metal', name: '磨利金属', ingredients: [{ itemId: 'metal_plate', count: 1 }, { itemId: 'stone', count: 1 }], outputItemId: 'sharpened_metal', outputCount: 1, description: '用石材处理金属边缘。' },
  { id: 'r_metal_parts', name: '金属零件', ingredients: [{ itemId: 'scrap', count: 2 }, { itemId: 'iron', count: 1 }], outputItemId: 'metal_parts', outputCount: 1, description: '拆解废金属并分类成标准零件。' },
  { id: 'r_reinforced_frame', name: '加固框架', ingredients: [{ itemId: 'metal_plate', count: 1 }, { itemId: 'metal_parts', count: 1 }], outputItemId: 'reinforced_frame', outputCount: 1, description: '把零件与金属板组合成承重骨架。' },
  { id: 'r_processed_wood', name: '处理木材', ingredients: [{ itemId: 'wood', count: 2 }], outputItemId: 'processed_wood', outputCount: 1, description: '削平并烘干木料。' },
  { id: 'r_wooden_handle', name: '木制握柄', ingredients: [{ itemId: 'processed_wood', count: 1 }, { itemId: 'rope_bundle', count: 1 }], outputItemId: 'wooden_handle', outputCount: 1, description: '用绳束加固处理木材。' },
  { id: 'r_bow_limb', name: '弓臂', ingredients: [{ itemId: 'processed_wood', count: 1 }, { itemId: 'rope_bundle', count: 1 }], outputItemId: 'bow_limb', outputCount: 1, description: '把处理木材弯成有弹性的弓臂。' },
  { id: 'r_cloth_roll', name: '布卷', ingredients: [{ itemId: 'cloth', count: 2 }], outputItemId: 'cloth_roll', outputCount: 1, description: '裁切并整理布料。' },
  { id: 'r_reinforced_cloth', name: '加固布层', ingredients: [{ itemId: 'cloth_roll', count: 1 }, { itemId: 'rope_bundle', count: 1 }], outputItemId: 'reinforced_cloth', outputCount: 1, description: '缝合并捆扎多层布料。' },
  { id: 'r_rope_bundle', name: '绳束', ingredients: [{ itemId: 'rope', count: 2 }], outputItemId: 'rope_bundle', outputCount: 1, description: '把散绳整理成高强度绳束。' },
  { id: 'r_wire', name: '导线', ingredients: [{ itemId: 'scrap', count: 1 }, { itemId: 'glass', count: 1 }], outputItemId: 'wire', outputCount: 1, description: '剥离废金属并用玻璃片绝缘。' },
  { id: 'r_circuit', name: '电路板', ingredients: [{ itemId: 'wire', count: 1 }, { itemId: 'battery', count: 1 }], outputItemId: 'circuit', outputCount: 1, description: '把导线接入可复用电池控制板。' },
  { id: 'r_battery_pack', name: '电池组', ingredients: [{ itemId: 'battery', count: 2 }, { itemId: 'circuit', count: 1 }], outputItemId: 'battery_pack', outputCount: 1, description: '用电路板串联并稳定电源。' },
  { id: 'r_antiseptic', name: '消毒液', ingredients: [{ itemId: 'herb', count: 1 }, { itemId: 'alcohol', count: 1 }], outputItemId: 'antiseptic', outputCount: 1, description: '用酒精处理药草。' },
  { id: 'r_chemical_mix', name: '药剂混合物', ingredients: [{ itemId: 'antiseptic', count: 1 }, { itemId: 'glass', count: 1 }], outputItemId: 'chemical_mix', outputCount: 1, description: '在玻璃容器中完成调配。' },
  { id: 'r_medical_kit_parts', name: '医疗包组件', ingredients: [{ itemId: 'cloth_roll', count: 1 }, { itemId: 'chemical_mix', count: 1 }], outputItemId: 'medical_kit_parts', outputCount: 1, description: '把布卷与复合药剂分装。' },

  { id: 'r_reinforced_pipe', name: '加固铁管', ingredients: [{ itemId: 'metal_parts', count: 1 }, { itemId: 'wooden_handle', count: 1 }], outputItemId: 'reinforced_pipe', outputCount: 1, description: '把通用金属零件装上稳定握柄。' },
  { id: 'r_machete', name: '砍刀', ingredients: [{ itemId: 'sharpened_metal', count: 1 }, { itemId: 'wooden_handle', count: 1 }], outputItemId: 'machete', outputCount: 1, description: '磨利金属配上木制握柄。' },
  { id: 'r_war_axe', name: '战斧', ingredients: [{ itemId: 'sharpened_metal', count: 1 }, { itemId: 'reinforced_frame', count: 1 }], outputItemId: 'war_axe', outputCount: 1, description: '把锋利刃口固定到重型框架。' },
  { id: 'r_reinforced_bow', name: '加固弓', ingredients: [{ itemId: 'bow_limb', count: 1 }, { itemId: 'rope_bundle', count: 1 }], outputItemId: 'reinforced_bow', outputCount: 1, description: '弓臂与绳束组成稳定弓体。' },
  { id: 'r_composite_bow_upgrade', name: '复合弓升级件', ingredients: [{ itemId: 'reinforced_bow', count: 1 }, { itemId: 'glass', count: 1 }], outputItemId: 'composite_bow_upgrade', outputCount: 1, description: '用玻璃片进一步加固弓身。' },
  { id: 'r_improvised_spear', name: '改装投矛', ingredients: [{ itemId: 'sharpened_metal', count: 1 }, { itemId: 'wooden_handle', count: 1 }, { itemId: 'rope_bundle', count: 1 }], outputItemId: 'improvised_spear', outputCount: 1, description: '把刃口、握柄和绳束组合成投矛。' },
  { id: 'r_shock_baton', name: '冲击电棍', ingredients: [{ itemId: 'metal_parts', count: 1 }, { itemId: 'battery_pack', count: 1 }, { itemId: 'circuit', count: 1 }], outputItemId: 'shock_baton', outputCount: 1, description: '把金属骨架接入稳定电源和控制电路。' },
  { id: 'r_light_vest', name: '轻型背心', ingredients: [{ itemId: 'reinforced_cloth', count: 1 }, { itemId: 'cloth_roll', count: 1 }], outputItemId: 'light_vest', outputCount: 1, description: '加固布层叠出轻型防护。' },
  { id: 'r_reinforced_armor', name: '强化护甲', ingredients: [{ itemId: 'reinforced_frame', count: 1 }, { itemId: 'reinforced_cloth', count: 1 }], outputItemId: 'reinforced_armor', outputCount: 1, description: '框架与布层组成中型护甲。' },
  { id: 'r_heavy_armor', name: '重型护甲', ingredients: [{ itemId: 'metal_plate', count: 1 }, { itemId: 'reinforced_frame', count: 1 }], outputItemId: 'heavy_armor', outputCount: 1, description: '把板件固定在重型框架上。' },
  { id: 'r_field_kit', name: '野外工具包', ingredients: [{ itemId: 'circuit', count: 1 }, { itemId: 'cloth_roll', count: 1 }, { itemId: 'rope_bundle', count: 1 }], outputItemId: 'field_kit', outputCount: 1, description: '把控制件、布卷和绳束整理为搜索工具。' },
  { id: 'r_trauma_kit', name: '创伤急救包', ingredients: [{ itemId: 'medical_kit_parts', count: 1 }, { itemId: 'chemical_mix', count: 1 }], outputItemId: 'trauma_kit', outputCount: 1, description: '完成复合药剂与医疗包组件的组合。' },
];
