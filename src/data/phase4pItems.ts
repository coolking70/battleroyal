import type { ItemDef } from '../core/types';

/** Phase 4P materials are finite elite/apex drops, never starting grants. */
export const PHASE4P_WILD_MATERIAL_IDS = [
  'reinforced_servo', 'hardened_hide', 'tactical_sensor', 'toxin_core',
  'composite_plate', 'targeting_module', 'aegis_core', 'subject07_tissue', 'iron_tusk',
] as const;

export const PHASE4P_SIGNATURE_IDS = ['aegis_core', 'subject07_tissue', 'iron_tusk'] as const;

export const PHASE4P_ITEMS: ItemDef[] = [
  { id: 'reinforced_servo', name: '强化伺服组', category: 'material', craftTier: 'raw', description: '精英安保单位仍可用的强化伺服组。', value: 26, stackable: true, maxStack: 5 },
  { id: 'hardened_hide', name: '硬化兽皮', category: 'material', craftTier: 'raw', description: '高应力实验动物留下的防护皮层。', value: 24, stackable: true, maxStack: 5 },
  { id: 'tactical_sensor', name: '战术传感器', category: 'material', craftTier: 'raw', description: '能在城市噪声中锁定移动目标的传感器。', value: 30, stackable: true, maxStack: 5 },
  { id: 'toxin_core', name: '浓缩毒素芯', category: 'material', craftTier: 'raw', description: '必须隔离保存的实验毒素芯。', value: 28, stackable: true, maxStack: 5 },
  { id: 'composite_plate', name: '复合防护板', category: 'material', craftTier: 'raw', description: '精英单位外壳中的复合防护板。', value: 32, stackable: true, maxStack: 5 },
  { id: 'targeting_module', name: '火控模块', category: 'material', craftTier: 'raw', description: '残存的城市安保火控模块。', value: 31, stackable: true, maxStack: 5 },
  { id: 'aegis_core', name: 'Aegis 核心', category: 'material', craftTier: 'raw', description: '命名原型 Aegis 的唯一签名核心。', value: 80, stackable: false, maxStack: 1 },
  { id: 'subject07_tissue', name: '07 号组织样本', category: 'material', craftTier: 'raw', description: '命名实验体 07 的唯一稳定组织样本。', value: 78, stackable: false, maxStack: 1 },
  { id: 'iron_tusk', name: '铁牙芯材', category: 'material', craftTier: 'raw', description: '命名獠牙个体的唯一高密度芯材。', value: 76, stackable: false, maxStack: 1 },

  { id: 'servo_housing', name: '伺服承力架', category: 'component', craftTier: 'component', description: '把强化伺服组固定进可维护的承力架。', value: 40, stackable: true, maxStack: 5 },
  { id: 'hardened_laminate', name: '硬化层压片', category: 'component', craftTier: 'component', description: '硬化兽皮与布料叠压成的柔性护层。', value: 38, stackable: true, maxStack: 5 },
  { id: 'toxin_filter', name: '毒素滤芯', category: 'component', craftTier: 'component', description: '将浓缩毒素芯封装为可控过滤组件。', value: 44, stackable: true, maxStack: 5 },
  { id: 'composite_chassis', name: '复合底盘', category: 'component', craftTier: 'component', description: '伺服承力架与复合防护板组成的底盘。', value: 52, stackable: true, maxStack: 5 },
  { id: 'apex_circuit', name: 'Apex 火控回路', category: 'component', craftTier: 'component', description: '战术传感器与火控模块的高阶回路。', value: 56, stackable: true, maxStack: 5 },
  { id: 'tusk_counterweight', name: '獠牙配重', category: 'component', craftTier: 'component', description: '铁牙芯材加工出的重型武器配重。', value: 45, stackable: true, maxStack: 5 },
  { id: 'bio_lattice', name: '生物晶格', category: 'component', craftTier: 'component', description: '07 号组织样本与硬化树脂形成的隔离晶格。', value: 50, stackable: true, maxStack: 5 },

  { id: 'aegis_plate', name: 'Aegis 防护板', category: 'armor', craftTier: 'final', equipmentSlot: 'armor', armorClass: 'heavy', defense: 12, description: '以 Aegis 核心驱动的城市重型防护板。', value: 110, stackable: false, maxStack: 1 },
  { id: 'adaptive_bio_suit', name: '自适应生化服', category: 'armor', craftTier: 'final', equipmentSlot: 'armor', armorClass: 'medium', defense: 10, description: '隔离 07 号组织样本的可调节生化服。', value: 104, stackable: false, maxStack: 1 },
  { id: 'tuskbreaker', name: '破獠重锤', category: 'weapon', craftTier: 'final', equipmentSlot: 'weapon', weaponType: 'melee', weaponFamily: 'heavy', attack: 24, durability: 45, description: '以铁牙芯材配重的近距离破障武器。', value: 108, stackable: false, maxStack: 1 },
  { id: 'apex_carbine', name: 'Apex 卡宾枪', category: 'weapon', craftTier: 'final', equipmentSlot: 'weapon', weaponType: 'ranged', weaponFamily: 'improvised_ranged', attack: 23, durability: 40, description: '把 Apex 火控回路接入改装卡宾枪。', value: 112, stackable: false, maxStack: 1 },
  { id: 'riot_shell', name: '复合镇暴壳', category: 'armor', craftTier: 'final', equipmentSlot: 'armor', armorClass: 'heavy', defense: 11, description: '面向城区推进的复合镇暴外壳。', value: 98, stackable: false, maxStack: 1 },
  { id: 'targeting_rig', name: '战术锁定架', category: 'utility', craftTier: 'final', equipmentSlot: 'utility', searchFindMult: 1.2, description: '用 Apex 火控回路提高搜索锁定效率。', value: 101, stackable: false, maxStack: 1 },
];
