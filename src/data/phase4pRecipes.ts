import type { Recipe } from '../core/types';

export const PHASE4P_RECIPES: Recipe[] = [
  { id: 'r_servo_housing', name: '伺服承力架', ingredients: [{ itemId: 'reinforced_servo', count: 1 }, { itemId: 'scrap', count: 1 }], outputItemId: 'servo_housing', outputCount: 1, description: '把强化伺服组固定到废金属承力架。' },
  { id: 'r_hardened_laminate', name: '硬化层压片', ingredients: [{ itemId: 'hardened_hide', count: 1 }, { itemId: 'cloth', count: 1 }], outputItemId: 'hardened_laminate', outputCount: 1, description: '将硬化兽皮与布料叠压成柔性护层。' },
  { id: 'r_toxin_filter', name: '毒素滤芯', ingredients: [{ itemId: 'toxin_core', count: 1 }, { itemId: 'glass', count: 1 }], outputItemId: 'toxin_filter', outputCount: 1, description: '把浓缩毒素芯封装为可控滤芯。' },
  { id: 'r_composite_chassis', name: '复合底盘', ingredients: [{ itemId: 'composite_plate', count: 1 }, { itemId: 'servo_housing', count: 1 }], outputItemId: 'composite_chassis', outputCount: 1, description: '用伺服承力架固定复合防护板。' },
  { id: 'r_apex_circuit', name: 'Apex 火控回路', ingredients: [{ itemId: 'tactical_sensor', count: 1 }, { itemId: 'targeting_module', count: 1 }], outputItemId: 'apex_circuit', outputCount: 1, description: '将传感器和火控模块校准为统一回路。' },
  { id: 'r_tusk_counterweight', name: '獠牙配重', ingredients: [{ itemId: 'iron_tusk', count: 1 }, { itemId: 'hardened_resin', count: 1 }], outputItemId: 'tusk_counterweight', outputCount: 1, description: '用硬化树脂平衡命名獠牙的高密度芯材。' },
  { id: 'r_bio_lattice', name: '生物晶格', ingredients: [{ itemId: 'subject07_tissue', count: 1 }, { itemId: 'hardened_resin', count: 1 }], outputItemId: 'bio_lattice', outputCount: 1, description: '把 07 号组织样本隔离进硬化树脂晶格。' },
  { id: 'r_aegis_plate', name: 'Aegis 防护板', ingredients: [{ itemId: 'composite_chassis', count: 1 }, { itemId: 'aegis_core', count: 1 }, { itemId: 'plate_armor', count: 1 }], outputItemId: 'aegis_plate', outputCount: 1, description: '以 Aegis 核心驱动复合底盘。' },
  { id: 'r_adaptive_bio_suit', name: '自适应生化服', ingredients: [{ itemId: 'bio_lattice', count: 1 }, { itemId: 'toxin_filter', count: 1 }, { itemId: 'hardened_laminate', count: 1 }], outputItemId: 'adaptive_bio_suit', outputCount: 1, description: '将组织晶格、毒素滤芯和层压片缝合。' },
  { id: 'r_tuskbreaker', name: '破獠重锤', ingredients: [{ itemId: 'tusk_counterweight', count: 1 }, { itemId: 'sharpened_metal', count: 1 }, { itemId: 'iron_pipe', count: 1 }], outputItemId: 'tuskbreaker', outputCount: 1, description: '把獠牙配重装入工业铁管并加装破障刃。' },
  { id: 'r_apex_carbine', name: 'Apex 卡宾枪', ingredients: [{ itemId: 'apex_circuit', count: 1 }, { itemId: 'composite_chassis', count: 1 }, { itemId: 'simple_bow', count: 1 }], outputItemId: 'apex_carbine', outputCount: 1, description: '将 Apex 火控回路接入复合底盘。' },
  { id: 'r_riot_shell', name: '复合镇暴壳', ingredients: [{ itemId: 'servo_housing', count: 1 }, { itemId: 'hardened_laminate', count: 1 }, { itemId: 'composite_chassis', count: 1 }], outputItemId: 'riot_shell', outputCount: 1, description: '用复合底盘做出城区推进用外壳。' },
  { id: 'r_targeting_rig', name: '战术锁定架', ingredients: [{ itemId: 'apex_circuit', count: 1 }, { itemId: 'targeting_module', count: 1 }, { itemId: 'bio_lattice', count: 1 }], outputItemId: 'targeting_rig', outputCount: 1, description: '把火控回路固定进可穿戴锁定架。' },
];
