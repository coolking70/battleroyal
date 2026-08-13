import type { Recipe } from '../core/types';

export const PHASE4N_RECIPES: Recipe[] = [
  { id: 'r_treated_hide', name: '鞣制兽皮', ingredients: [{ itemId: 'animal_hide', count: 1 }, { itemId: 'cloth', count: 1 }], outputItemId: 'treated_hide', outputCount: 1, description: '用布料清理并加固兽皮。' },
  { id: 'r_bone_handle', name: '骨制握柄', ingredients: [{ itemId: 'animal_bone', count: 1 }, { itemId: 'sinew', count: 1 }], outputItemId: 'bone_handle', outputCount: 1, description: '用筋腱固定打磨后的兽骨。' },
  { id: 'r_toxin_extract', name: '毒素提取液', ingredients: [{ itemId: 'venom_gland', count: 1 }, { itemId: 'glass', count: 1 }], outputItemId: 'toxin_extract', outputCount: 1, description: '把毒腺提取物封入玻璃容器。' },
  { id: 'r_advanced_circuit', name: '追踪电路', ingredients: [{ itemId: 'mechanical_core', count: 1 }, { itemId: 'optical_sensor', count: 1 }], outputItemId: 'advanced_circuit', outputCount: 1, description: '连接驱动核心与光学传感器。' },
  { id: 'r_reinforced_sinew', name: '强化筋索', ingredients: [{ itemId: 'sinew', count: 1 }, { itemId: 'rope_bundle', count: 1 }], outputItemId: 'reinforced_sinew', outputCount: 1, description: '把天然筋腱并入高强度绳束。' },
  { id: 'r_hardened_resin', name: '硬化树脂', ingredients: [{ itemId: 'bio_resin', count: 1 }, { itemId: 'feral_fang', count: 1 }], outputItemId: 'hardened_resin', outputCount: 1, description: '用锐牙骨料让树脂稳定固化。' },
  { id: 'r_hunting_armor', name: '猎行护甲', ingredients: [{ itemId: 'treated_hide', count: 1 }, { itemId: 'reinforced_sinew', count: 1 }], outputItemId: 'hunting_armor', outputCount: 1, description: '把兽皮缝合到强化筋索骨架上。' },
  { id: 'r_venom_spear', name: '毒刃长矛', ingredients: [{ itemId: 'toxin_extract', count: 1 }, { itemId: 'bone_handle', count: 1 }, { itemId: 'sharpened_metal', count: 1 }], outputItemId: 'venom_spear', outputCount: 1, description: '在骨柄金属矛刃上完成毒素处理。' },
  { id: 'r_predator_bow', name: '猎食者弓', ingredients: [{ itemId: 'reinforced_sinew', count: 1 }, { itemId: 'bone_handle', count: 1 }, { itemId: 'bow_limb', count: 1 }], outputItemId: 'predator_bow', outputCount: 1, description: '用骨柄稳定高张力弓体。' },
  { id: 'r_tracker_scope', name: '追踪瞄具', ingredients: [{ itemId: 'advanced_circuit', count: 1 }, { itemId: 'hardened_resin', count: 1 }], outputItemId: 'tracker_scope', outputCount: 1, description: '把追踪电路封装在树脂壳体中。' },
];
