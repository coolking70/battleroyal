import type { FacilityInteractionDef, LandmarkDef } from '../core/types';
import { tryGetItem } from './items';
import { tryGetZoneDef } from './zones';

const facility = (
  id: string,
  label: string,
  effectType: FacilityInteractionDef['effectType'],
  maxCharges = 1,
  extra: Partial<FacilityInteractionDef> = {},
): FacilityInteractionDef => ({ id, label, effectType, chargeCost: 1, maxCharges, ...extra });

/**
 * Static landmark knowledge. Exact finite loot is instantiated into GameState
 * at match creation; this registry never contains runtime depletion state.
 */
export const LANDMARKS: readonly LandmarkDef[] = [
  { id: 'school_gym', zoneId: 'school', name: '学校体育馆', description: '看台下的储物柜还没有被彻底翻过。', icon: '🏟️', kind: 'landmark', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'cloth', count: 1 }, { itemId: 'rope', count: 1 }, { itemId: 'water', count: 1 }], searchProfile: { preferredItemIds: ['cloth', 'rope'], encounterChance: 0.08, riskDamage: 0 } },
  { id: 'school_science_classroom', zoneId: 'school', name: '科学教室', description: '实验桌下散落着器皿与残留实验材料。', icon: '🧪', kind: 'landmark', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'glass', count: 1 }, { itemId: 'battery', count: 1 }, { itemId: 'alcohol', count: 1 }], searchProfile: { preferredItemIds: ['glass', 'battery'], encounterChance: 0.16, riskDamage: 0, riskStatus: 'wild' } },
  { id: 'hospital_pharmacy', zoneId: 'hospital', name: '医院药房', description: '药柜里仍有有限的医疗用品。', icon: '💊', kind: 'landmark', searchable: true, maxSearches: 4, initialLoot: [{ itemId: 'bandage', count: 1 }, { itemId: 'bandage', count: 1 }, { itemId: 'antiseptic', count: 1 }, { itemId: 'herb', count: 1 }], searchProfile: { preferredItemIds: ['bandage', 'antiseptic', 'herb'], encounterChance: 0.1, riskDamage: 0 } },
  { id: 'hospital_operating_room', zoneId: 'hospital', name: '手术室', description: '无菌灯还能亮，有限的手术设备可以帮助处理伤口。', icon: '🩺', kind: 'facility', searchable: true, maxSearches: 2, initialLoot: [{ itemId: 'cloth', count: 1 }, { itemId: 'alcohol', count: 1 }], searchProfile: { preferredItemIds: ['cloth', 'alcohol'], encounterChance: 0.2, riskDamage: 2, riskStatus: 'wild' }, interaction: facility('treat_wounds', '处理伤口', 'treat_wounds', 3) },
  { id: 'residential_apartment_block', zoneId: 'residential', name: '公寓楼', description: '地下储藏室的入口记录被确认后，几间住宅才值得继续搜索。', icon: '🏢', kind: 'landmark', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'cloth', count: 1 }, { itemId: 'water', count: 1 }, { itemId: 'glass', count: 1 }], searchProfile: { preferredItemIds: ['cloth', 'water'], encounterChance: 0.12, riskDamage: 0 }, access: { initial: 'locked', prerequisites: [{ kind: 'landmark_state', landmarkId: 'residential_basement_storage', state: 'discovered' }], hint: '先搜索地下储藏室，确认公寓入口。' } },
  { id: 'residential_basement_storage', zoneId: 'residential', name: '地下储藏室', description: '潮湿的储藏间里仍有杂物，也可能惊动躲藏的野物。', icon: '🧱', kind: 'landmark', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'wood', count: 1 }, { itemId: 'rope', count: 1 }, { itemId: 'scrap', count: 1 }], searchProfile: { preferredItemIds: ['wood', 'rope'], encounterChance: 0.24, riskDamage: 3, riskStatus: 'wild' } },
  { id: 'factory_machine_shop', zoneId: 'factory', name: '机修车间', description: '工具台仍可短暂提供一次标准化加工协助。', icon: '⚙️', kind: 'facility', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'metal_parts', count: 1 }, { itemId: 'scrap', count: 1 }, { itemId: 'iron', count: 1 }], searchProfile: { preferredItemIds: ['metal_parts', 'scrap', 'iron'], encounterChance: 0.26, riskDamage: 2, riskStatus: 'wild' }, interaction: facility('use_workbench', '使用工作台', 'workbench', 1) },
  { id: 'factory_assembly_line', zoneId: 'factory', name: '装配线', description: '机修车间重新启用后，停摆的流水线上还能拆出少量完整零件。', icon: '🏭', kind: 'landmark', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'metal_parts', count: 1 }, { itemId: 'wire', count: 1 }, { itemId: 'iron', count: 1 }], searchProfile: { preferredItemIds: ['metal_parts', 'wire'], encounterChance: 0.22, riskDamage: 2, riskStatus: 'wild' }, access: { initial: 'locked', prerequisites: [{ kind: 'landmark_state', landmarkId: 'factory_machine_shop', state: 'activated' }], hint: '先启用机修车间，装配线才会恢复供料。' } },
  { id: 'forest_ranger_cabin', zoneId: 'forest', name: '护林员小屋', description: '旧炉台和地图桌提供一次短暂的野外整备。', icon: '🛖', kind: 'facility', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'wood', count: 1 }, { itemId: 'herb', count: 1 }, { itemId: 'rope', count: 1 }], searchProfile: { preferredItemIds: ['wood', 'herb'], encounterChance: 0.28, riskDamage: 2, riskStatus: 'wild' }, interaction: facility('field_prep', '野外整备', 'field_prep', 2) },
  { id: 'forest_deep_grove', zoneId: 'forest', name: '深林空地', description: '林下材料丰富，但动静会吸引野外威胁。', icon: '🌲', kind: 'landmark', searchable: true, maxSearches: 4, initialLoot: [{ itemId: 'wood', count: 1 }, { itemId: 'herb', count: 1 }, { itemId: 'rope', count: 1 }, { itemId: 'stone', count: 1 }], searchProfile: { preferredItemIds: ['wood', 'herb'], encounterChance: 0.36, riskDamage: 4, riskStatus: 'wild' } },
  { id: 'lab_isolation_chamber', zoneId: 'lab', name: '隔离舱', description: '警报灯熄灭了，但残留实验品让这里极其危险。', icon: '☣️', kind: 'landmark', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'chemical_mix', count: 1 }, { itemId: 'glass', count: 1 }, { itemId: 'battery', count: 1 }], searchProfile: { preferredItemIds: ['chemical_mix', 'battery'], encounterChance: 0.42, riskDamage: 5, riskStatus: 'wild' } },
  { id: 'lab_analysis_terminal', zoneId: 'lab', name: '分析终端', description: '终端需要野外工具包接入，修复后才能解析有限的研究线索。', icon: '🖥️', kind: 'facility', searchable: true, maxSearches: 2, initialLoot: [{ itemId: 'battery', count: 1 }, { itemId: 'circuit', count: 1 }], searchProfile: { preferredItemIds: ['battery', 'circuit'], encounterChance: 0.3, riskDamage: 3, riskStatus: 'wild' }, interaction: facility('analyze', '分析样本', 'analyze', 2, { requiresRepair: true, requiredItemId: 'field_kit', requiredItemConsumes: false }) },
  { id: 'commercial_convenience_store', zoneId: 'commercial', name: '便利店', description: '货架倾倒后仍有少量可用补给。', icon: '🏪', kind: 'landmark', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'water', count: 1 }, { itemId: 'water', count: 1 }, { itemId: 'cloth', count: 1 }], searchProfile: { preferredItemIds: ['water', 'cloth'], encounterChance: 0.14, riskDamage: 0 } },
  { id: 'commercial_electronics_shop', zoneId: 'commercial', name: '电子商店', description: '展示柜后的组件仍可拆取。', icon: '🔌', kind: 'landmark', searchable: true, maxSearches: 4, initialLoot: [{ itemId: 'battery', count: 1 }, { itemId: 'battery', count: 1 }, { itemId: 'wire', count: 1 }, { itemId: 'circuit', count: 1 }], searchProfile: { preferredItemIds: ['battery', 'wire', 'circuit'], encounterChance: 0.22, riskDamage: 2, riskStatus: 'wild' } },
  { id: 'station_control_room', zoneId: 'station', name: '控制室', description: '修复控制台后，车站会公开恢复部分运行能力。', icon: '🎛️', kind: 'facility', searchable: true, maxSearches: 2, initialLoot: [{ itemId: 'battery', count: 1 }, { itemId: 'wire', count: 1 }], searchProfile: { preferredItemIds: ['battery', 'wire'], encounterChance: 0.3, riskDamage: 3, riskStatus: 'wild' }, interaction: facility('restore_control', '恢复控制', 'restore_control', 1, { requiresRepair: true, requiredItemId: 'battery' }) },
  { id: 'station_platform', zoneId: 'station', name: '旧站台', description: '站台边的检修箱藏着少量综合物资。', icon: '🚉', kind: 'landmark', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'scrap', count: 1 }, { itemId: 'rope', count: 1 }, { itemId: 'battery', count: 1 }], searchProfile: { preferredItemIds: ['scrap', 'battery'], encounterChance: 0.24, riskDamage: 2, riskStatus: 'wild' } },
  { id: 'park_maintenance_shed', zoneId: 'park', name: '维护棚', description: '园林维护棚已半塌，仍值得小心搜索。', icon: '🧰', kind: 'landmark', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'wood', count: 1 }, { itemId: 'stone', count: 1 }, { itemId: 'scrap', count: 1 }], searchProfile: { preferredItemIds: ['wood', 'stone'], encounterChance: 0.18, riskDamage: 0 } },
  { id: 'park_greenhouse', zoneId: 'park', name: '温室', description: '温室结构尚未稳定，搜索时要留意坠落风险。', icon: '🌿', kind: 'facility', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'herb', count: 1 }, { itemId: 'herb', count: 1 }, { itemId: 'glass', count: 1 }], searchProfile: { preferredItemIds: ['herb', 'glass'], encounterChance: 0.25, riskDamage: 3, riskStatus: 'damage' }, interaction: facility('greenhouse_prep', '温室整备', 'field_prep', 2) },
  { id: 'warehouse_loading_bay', zoneId: 'warehouse', name: '装卸区', description: '货箱缝隙里还能找到绳束和金属零件。', icon: '📦', kind: 'landmark', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'rope', count: 1 }, { itemId: 'scrap', count: 1 }, { itemId: 'metal_parts', count: 1 }], searchProfile: { preferredItemIds: ['rope', 'metal_parts'], encounterChance: 0.2, riskDamage: 2, riskStatus: 'wild' } },
  { id: 'warehouse_secure_storage', zoneId: 'warehouse', name: '安全仓', description: '电子锁尚未解除，里面的有限物资不能被远程预览。', icon: '🔒', kind: 'facility', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'battery_pack', count: 1 }, { itemId: 'reinforced_frame', count: 1 }, { itemId: 'medical_kit_parts', count: 1 }], searchProfile: { preferredItemIds: ['battery_pack', 'reinforced_frame', 'medical_kit_parts'], encounterChance: 0.32, riskDamage: 3, riskStatus: 'wild' }, interaction: facility('open_secure_storage', '开启安全仓', 'open_secure_storage', 1, { requiresUnlock: true, requiredItemId: 'field_kit' }) },
  { id: 'construction_tool_container', zoneId: 'construction', name: '工具集装箱', description: '施工工具和紧固件被锁在集装箱里。', icon: '🧱', kind: 'landmark', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'iron', count: 1 }, { itemId: 'scrap', count: 1 }, { itemId: 'rope', count: 1 }], searchProfile: { preferredItemIds: ['iron', 'scrap'], encounterChance: 0.22, riskDamage: 2, riskStatus: 'wild' } },
  { id: 'construction_upper_scaffold', zoneId: 'construction', name: '高层脚手架', description: '高处材料较完整，但失足和噪音风险都更高。', icon: '🏗️', kind: 'landmark', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'metal_plate', count: 1 }, { itemId: 'reinforced_frame', count: 1 }, { itemId: 'wood', count: 1 }], searchProfile: { preferredItemIds: ['metal_plate', 'reinforced_frame'], encounterChance: 0.34, riskDamage: 5, riskStatus: 'damage' } },
  { id: 'underground_service_room', zoneId: 'underground', name: '服务机房', description: '维修系统可以恢复一处封锁通路，但备用电力有限。', icon: '🛠️', kind: 'facility', searchable: true, maxSearches: 3, initialLoot: [{ itemId: 'battery', count: 1 }, { itemId: 'circuit', count: 1 }, { itemId: 'wire', count: 1 }], searchProfile: { preferredItemIds: ['battery', 'circuit', 'wire'], encounterChance: 0.38, riskDamage: 4, riskStatus: 'wild' }, interaction: facility('service_system', '维修系统', 'service_system', 1, { requiresRepair: true, requiredItemId: 'wire' }) },
  { id: 'underground_sealed_passage', zoneId: 'underground', name: '封闭通路', description: '服务机房维修完成后，通往深处的闸门才会开放。', icon: '🚪', kind: 'landmark', searchable: true, maxSearches: 2, initialLoot: [{ itemId: 'scrap', count: 1 }, { itemId: 'chemical_mix', count: 1 }], searchProfile: { preferredItemIds: ['scrap', 'chemical_mix'], encounterChance: 0.48, riskDamage: 6, riskStatus: 'wild' }, access: { initial: 'locked', prerequisites: [{ kind: 'landmark_state', landmarkId: 'underground_service_room', state: 'repaired' }], hint: '先维修服务机房，封闭通路才会开放。' }, interaction: facility('sealed_passage', '开启封闭通路', 'start_generator', 1, { requiresUnlock: true }) },
];

export const LANDMARK_IDS = LANDMARKS.map((landmark) => landmark.id);
const BY_ID = new Map(LANDMARKS.map((landmark) => [landmark.id, landmark]));

export function getLandmarkDef(id: string): LandmarkDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`未知地标 id: ${id}`);
  return def;
}

export function tryGetLandmarkDef(id: string): LandmarkDef | null {
  return BY_ID.get(id) ?? null;
}

export function landmarksForZone(zoneId: string): LandmarkDef[] {
  return LANDMARKS.filter((landmark) => landmark.zoneId === zoneId);
}

export function validateLandmarkRegistry(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const landmark of LANDMARKS) {
    if (ids.has(landmark.id)) errors.push(`重复地标 id：${landmark.id}`);
    ids.add(landmark.id);
    if (!tryGetZoneDef(landmark.zoneId)) errors.push(`地标 ${landmark.id} 引用了未知区域`);
    if (landmark.maxSearches < 0) errors.push(`地标 ${landmark.id} 的 maxSearches 非法`);
    if (landmark.searchProfile.encounterChance < 0 || landmark.searchProfile.encounterChance > 1) errors.push(`地标 ${landmark.id} 的 encounterChance 越界`);
    for (const loot of landmark.initialLoot) {
      if (loot.count <= 0) errors.push(`地标 ${landmark.id} 的初始 loot 数量非法`);
      if (!tryGetItem(loot.itemId)) errors.push(`地标 ${landmark.id} 引用了未知物品 ${loot.itemId}`);
    }
    if (landmark.access) {
      if (landmark.access.prerequisites.length === 0) errors.push(`地标 ${landmark.id} 的访问链缺少前置条件`);
      for (const requirement of landmark.access.prerequisites) {
        if (requirement.kind === 'item') {
          if (!tryGetItem(requirement.itemId)) errors.push(`地标 ${landmark.id} 引用了未知访问物品 ${requirement.itemId}`);
          if (requirement.count !== undefined && (!Number.isInteger(requirement.count) || requirement.count <= 0)) errors.push(`地标 ${landmark.id} 的访问物品数量非法`);
        } else if (!tryGetLandmarkDef(requirement.landmarkId)) {
          errors.push(`地标 ${landmark.id} 引用了未知访问前置 ${requirement.landmarkId}`);
        } else if (requirement.landmarkId === landmark.id) {
          errors.push(`地标 ${landmark.id} 不能依赖自身访问状态`);
        }
      }
    }
    if (landmark.interaction) {
      if (landmark.interaction.maxCharges <= 0) errors.push(`设施 ${landmark.id} 的 maxCharges 非法`);
      if (landmark.interaction.requiredItemId && !tryGetItem(landmark.interaction.requiredItemId)) errors.push(`设施 ${landmark.id} 引用了未知工具 ${landmark.interaction.requiredItemId}`);
      if (landmark.interaction.requiredItemCount !== undefined && (!Number.isInteger(landmark.interaction.requiredItemCount) || landmark.interaction.requiredItemCount <= 0)) errors.push(`设施 ${landmark.id} 的 requiredItemCount 非法`);
    }
  }
  return errors;
}

const REGISTRY_ERRORS = validateLandmarkRegistry();
if (REGISTRY_ERRORS.length > 0) throw new Error(REGISTRY_ERRORS.join('；'));
