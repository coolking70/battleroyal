import type { WildDropTable, WildEcologyEntry, WildEnemyDef } from '../core/types';
import { PHASE4N_WILD_MATERIAL_IDS } from './phase4nItems';
import { PHASE4P_SIGNATURE_IDS, PHASE4P_WILD_MATERIAL_IDS } from './phase4pItems';
import { WILD_SPECIAL_ABILITIES } from './wildApexAbilities';
import { ZONE_IDS } from './zones';

/** Modern urban-survival threats. None are contestants or fantasy creatures. */
/** Phase 4N compatibility export: common ecology remains a ten-threat list. */
export const WILD_ENEMIES: WildEnemyDef[] = [
  { id: 'feral_dog', name: '野化猎犬', description: '饥饿的城市犬，听到动静就会扑上来。', maxHp: 34, attack: 9, defense: 2, speed: 11, encounterWeight: 10, behavior: 'aggressive', threat: 'medium', tier: 'common', dropCategory: 'animal', dropTableId: 'drop_feral_dog', abilityId: 'enrage', specialAbilityId: 'none', fallbackEmoji: '🐕', fallbackColor: '#8b6a45' },
  { id: 'tusked_boar', name: '獠牙野猪', description: '冲进城区觅食的成年野猪。', maxHp: 52, attack: 12, defense: 5, speed: 7, encounterWeight: 6, behavior: 'defensive', threat: 'high', tier: 'common', dropCategory: 'animal', dropTableId: 'drop_tusked_boar', abilityId: 'charge', specialAbilityId: 'none', fallbackEmoji: '🐗', fallbackColor: '#705442' },
  { id: 'venom_snake', name: '毒蛇', description: '藏在废墟缝隙中的毒蛇。', maxHp: 22, attack: 7, defense: 1, speed: 12, encounterWeight: 8, behavior: 'skittish', threat: 'medium', tier: 'common', dropCategory: 'animal', dropTableId: 'drop_venom_snake', abilityId: 'venom', specialAbilityId: 'none', fallbackEmoji: '🐍', fallbackColor: '#58783f' },
  { id: 'rat_swarm', name: '鼠群', description: '被食物气味吸引来的成群城市鼠。', maxHp: 28, attack: 8, defense: 1, speed: 10, encounterWeight: 9, behavior: 'aggressive', threat: 'low', tier: 'common', dropCategory: 'animal', dropTableId: 'drop_rat_swarm', abilityId: 'evasive', specialAbilityId: 'none', fallbackEmoji: '🐀', fallbackColor: '#6f6a62' },
  { id: 'carrion_crow', name: '腐食乌鸦', description: '在高处盘旋、俯冲抢食的乌鸦。', maxHp: 20, attack: 7, defense: 1, speed: 14, encounterWeight: 7, behavior: 'skittish', threat: 'low', tier: 'common', dropCategory: 'animal', dropTableId: 'drop_carrion_crow', abilityId: 'evasive', specialAbilityId: 'none', fallbackEmoji: '🐦‍⬛', fallbackColor: '#343946' },
  { id: 'security_hound', name: '安保机器犬', description: '失去网络后仍执行巡逻协议的机器犬。', maxHp: 44, attack: 11, defense: 6, speed: 10, encounterWeight: 5, behavior: 'aggressive', threat: 'high', tier: 'common', dropCategory: 'mechanical', dropTableId: 'drop_security_hound', abilityId: 'armored', specialAbilityId: 'none', fallbackEmoji: '🤖', fallbackColor: '#546b78' },
  { id: 'patrol_drone', name: '巡逻无人机', description: '低空巡航并锁定移动目标的安保无人机。', maxHp: 30, attack: 10, defense: 3, speed: 13, encounterWeight: 7, behavior: 'defensive', threat: 'medium', tier: 'common', dropCategory: 'mechanical', dropTableId: 'drop_patrol_drone', abilityId: 'evasive', specialAbilityId: 'none', fallbackEmoji: '🛸', fallbackColor: '#51788f' },
  { id: 'maintenance_bot', name: '失控维修机', description: '把活物误判为障碍物的工业维修机。', maxHp: 48, attack: 9, defense: 7, speed: 5, encounterWeight: 6, behavior: 'defensive', threat: 'medium', tier: 'common', dropCategory: 'mechanical', dropTableId: 'drop_maintenance_bot', abilityId: 'armored', specialAbilityId: 'none', fallbackEmoji: '🦾', fallbackColor: '#776b56' },
  { id: 'escaped_subject', name: '逃逸实验体', description: '研究事故后闯入街区的强化动物实验体。', maxHp: 46, attack: 13, defense: 4, speed: 11, encounterWeight: 4, behavior: 'aggressive', threat: 'high', tier: 'common', dropCategory: 'experimental', dropTableId: 'drop_escaped_subject', abilityId: 'enrage', specialAbilityId: 'none', fallbackEmoji: '🐾', fallbackColor: '#7b4359' },
  { id: 'resin_stalker', name: '树脂寄生兽', description: '被实验树脂包覆、行动迟缓却异常坚韧的动物。', maxHp: 58, attack: 11, defense: 8, speed: 6, encounterWeight: 3, behavior: 'defensive', threat: 'high', tier: 'common', dropCategory: 'experimental', dropTableId: 'drop_resin_stalker', abilityId: 'armored', specialAbilityId: 'none', fallbackEmoji: '🧬', fallbackColor: '#66528a' },
];

export const ELITE_WILD_ENEMY_IDS = [
  'feral_alpha_hound', 'riot_control_unit', 'hunter_killer_drone', 'toxic_experiment', 'scavenger_boar', 'armored_repair_bot',
] as const;

export const APEX_WILD_ENEMY_IDS = ['prototype_aegis', 'subject_07', 'iron_tusk'] as const;

export const ALL_WILD_ENEMIES: WildEnemyDef[] = [...WILD_ENEMIES];
ALL_WILD_ENEMIES.push(
  { id: 'feral_alpha_hound', name: '阿尔法猎犬', description: '带有战术项圈、会压迫猎物退路的野化猎犬。', maxHp: 92, attack: 18, defense: 8, speed: 15, encounterWeight: 3, behavior: 'aggressive', threat: 'high', tier: 'elite', dropCategory: 'animal', dropTableId: 'drop_feral_alpha_hound', abilityId: 'enrage', specialAbilityId: 'overcharge', eligibleZones: ['residential', 'commercial', 'forest'], fallbackEmoji: '🐕', fallbackColor: '#a34f36' },
  { id: 'riot_control_unit', name: '镇暴控制单元', description: '保留着镇暴协议和弹性护盾的失控安保单位。', maxHp: 110, attack: 16, defense: 14, speed: 7, encounterWeight: 2, behavior: 'defensive', threat: 'high', tier: 'elite', dropCategory: 'mechanical', dropTableId: 'drop_riot_control_unit', abilityId: 'armored', specialAbilityId: 'shield_cycle', eligibleZones: ['station', 'commercial', 'factory'], fallbackEmoji: '🛡️', fallbackColor: '#4c6274' },
  { id: 'hunter_killer_drone', name: '猎杀无人机', description: '专门针对高噪声目标的重型猎杀无人机。', maxHp: 86, attack: 21, defense: 9, speed: 18, encounterWeight: 2, behavior: 'aggressive', threat: 'high', tier: 'elite', dropCategory: 'mechanical', dropTableId: 'drop_hunter_killer_drone', abilityId: 'evasive', specialAbilityId: 'suppression_fire', eligibleZones: ['construction', 'factory', 'station'], fallbackEmoji: '🛸', fallbackColor: '#4b718e' },
  { id: 'toxic_experiment', name: '毒性实验体', description: '能把污染液体甩向近距离目标的强化实验体。', maxHp: 98, attack: 20, defense: 10, speed: 12, encounterWeight: 2, behavior: 'aggressive', threat: 'high', tier: 'elite', dropCategory: 'experimental', dropTableId: 'drop_toxic_experiment', abilityId: 'venom', specialAbilityId: 'toxic_burst', eligibleZones: ['hospital', 'lab', 'underground'], fallbackEmoji: '🧪', fallbackColor: '#7f4c77' },
  { id: 'scavenger_boar', name: '回收场巨獠', description: '在工业废料里长大的巨型野猪，冲锋前会刨地蓄力。', maxHp: 128, attack: 23, defense: 13, speed: 9, encounterWeight: 2, behavior: 'defensive', threat: 'high', tier: 'elite', dropCategory: 'animal', dropTableId: 'drop_scavenger_boar', abilityId: 'charge', specialAbilityId: 'massive_charge', eligibleZones: ['forest', 'warehouse', 'construction'], fallbackEmoji: '🐗', fallbackColor: '#765239' },
  { id: 'armored_repair_bot', name: '装甲维修机', description: '把维修工具改造成压制武器的重型工业机器人。', maxHp: 120, attack: 19, defense: 16, speed: 6, encounterWeight: 2, behavior: 'defensive', threat: 'high', tier: 'elite', dropCategory: 'mechanical', dropTableId: 'drop_armored_repair_bot', abilityId: 'armored', specialAbilityId: 'shield_cycle', eligibleZones: ['factory', 'warehouse', 'construction'], fallbackEmoji: '🦾', fallbackColor: '#756b58' },
  { id: 'prototype_aegis', name: '原型 Aegis', description: '被遗弃的城市防线原型，只接受一次正式挑战。', maxHp: 240, attack: 30, defense: 22, speed: 11, encounterWeight: 1, behavior: 'defensive', threat: 'high', tier: 'apex', dropCategory: 'mechanical', dropTableId: 'drop_prototype_aegis', abilityId: 'armored', specialAbilityId: 'shield_cycle', eligibleZones: ['factory', 'station', 'warehouse'], signatureDropItemId: PHASE4P_SIGNATURE_IDS[0], fallbackEmoji: '🛡️', fallbackColor: '#2f7180' },
  { id: 'subject_07', name: '命名实验体 07', description: '研究区记录中唯一的 07 号存活样本。', maxHp: 220, attack: 34, defense: 17, speed: 16, encounterWeight: 1, behavior: 'aggressive', threat: 'high', tier: 'apex', dropCategory: 'experimental', dropTableId: 'drop_subject_07', abilityId: 'venom', specialAbilityId: 'toxic_burst', eligibleZones: ['lab', 'hospital', 'underground'], signatureDropItemId: PHASE4P_SIGNATURE_IDS[1], fallbackEmoji: '🧬', fallbackColor: '#914f72' },
  { id: 'iron_tusk', name: '铁牙', description: '在城市边缘留下多起冲撞痕迹的命名野猪。', maxHp: 280, attack: 38, defense: 24, speed: 10, encounterWeight: 1, behavior: 'aggressive', threat: 'high', tier: 'apex', dropCategory: 'animal', dropTableId: 'drop_iron_tusk', abilityId: 'charge', specialAbilityId: 'massive_charge', eligibleZones: ['forest', 'park', 'construction'], signatureDropItemId: PHASE4P_SIGNATURE_IDS[2], fallbackEmoji: '🐗', fallbackColor: '#8a4c35' },
);

export const WILD_DROP_TABLES: WildDropTable[] = [
  { id: 'drop_feral_dog', entries: [{ itemId: 'animal_hide', probability: 1, min: 1, max: 1 }, { itemId: 'sinew', probability: 1, min: 1, max: 1 }] },
  { id: 'drop_tusked_boar', entries: [{ itemId: 'animal_hide', probability: 1, min: 1, max: 2 }, { itemId: 'animal_bone', probability: 0.75, min: 1, max: 1 }] },
  { id: 'drop_venom_snake', entries: [{ itemId: 'venom_gland', probability: 1, min: 1, max: 1 }, { itemId: 'sinew', probability: 0.45, min: 1, max: 1 }] },
  { id: 'drop_rat_swarm', entries: [{ itemId: 'animal_bone', probability: 1, min: 1, max: 1 }, { itemId: 'sinew', probability: 0.5, min: 1, max: 1 }] },
  { id: 'drop_carrion_crow', entries: [{ itemId: 'feral_fang', probability: 1, min: 1, max: 1 }, { itemId: 'animal_bone', probability: 0.55, min: 1, max: 1 }] },
  { id: 'drop_security_hound', entries: [{ itemId: 'mechanical_core', probability: 1, min: 1, max: 1 }, { itemId: 'optical_sensor', probability: 0.65, min: 1, max: 1 }] },
  { id: 'drop_patrol_drone', entries: [{ itemId: 'optical_sensor', probability: 1, min: 1, max: 1 }, { itemId: 'mechanical_core', probability: 0.5, min: 1, max: 1 }] },
  { id: 'drop_maintenance_bot', entries: [{ itemId: 'mechanical_core', probability: 1, min: 1, max: 1 }, { itemId: 'optical_sensor', probability: 0.4, min: 1, max: 1 }] },
  { id: 'drop_escaped_subject', entries: [{ itemId: 'bio_resin', probability: 1, min: 1, max: 1 }, { itemId: 'venom_gland', probability: 0.55, min: 1, max: 1 }] },
  { id: 'drop_resin_stalker', entries: [{ itemId: 'bio_resin', probability: 1, min: 1, max: 2 }, { itemId: 'animal_hide', probability: 0.5, min: 1, max: 1 }] },
  { id: 'drop_feral_alpha_hound', entries: [{ itemId: 'hardened_hide', probability: 1, min: 1, max: 1 }, { itemId: 'reinforced_servo', probability: 0.7, min: 1, max: 1 }] },
  { id: 'drop_riot_control_unit', entries: [{ itemId: 'composite_plate', probability: 1, min: 1, max: 1 }, { itemId: 'reinforced_servo', probability: 0.8, min: 1, max: 1 }] },
  { id: 'drop_hunter_killer_drone', entries: [{ itemId: 'targeting_module', probability: 1, min: 1, max: 1 }, { itemId: 'tactical_sensor', probability: 0.8, min: 1, max: 1 }] },
  { id: 'drop_toxic_experiment', entries: [{ itemId: 'toxin_core', probability: 1, min: 1, max: 1 }, { itemId: 'tactical_sensor', probability: 0.5, min: 1, max: 1 }] },
  { id: 'drop_scavenger_boar', entries: [{ itemId: 'hardened_hide', probability: 1, min: 1, max: 2 }, { itemId: 'composite_plate', probability: 0.6, min: 1, max: 1 }] },
  { id: 'drop_armored_repair_bot', entries: [{ itemId: 'reinforced_servo', probability: 1, min: 1, max: 2 }, { itemId: 'composite_plate', probability: 0.6, min: 1, max: 1 }] },
  { id: 'drop_prototype_aegis', entries: [{ itemId: 'aegis_core', probability: 1, min: 1, max: 1 }, { itemId: 'composite_plate', probability: 1, min: 1, max: 1 }, { itemId: 'reinforced_servo', probability: 1, min: 1, max: 1 }, { itemId: 'targeting_module', probability: 0.75, min: 1, max: 1 }] },
  { id: 'drop_subject_07', entries: [{ itemId: 'subject07_tissue', probability: 1, min: 1, max: 1 }, { itemId: 'toxin_core', probability: 1, min: 1, max: 1 }, { itemId: 'tactical_sensor', probability: 0.7, min: 1, max: 1 }] },
  { id: 'drop_iron_tusk', entries: [{ itemId: 'iron_tusk', probability: 1, min: 1, max: 1 }, { itemId: 'hardened_hide', probability: 1, min: 1, max: 1 }, { itemId: 'composite_plate', probability: 0.7, min: 1, max: 1 }] },
];

export const WILD_ECOLOGY: Readonly<Record<string, readonly WildEcologyEntry[]>> = {
  school: [{ enemyId: 'feral_dog', weight: 8 }, { enemyId: 'carrion_crow', weight: 5 }, { enemyId: 'patrol_drone', weight: 3 }],
  hospital: [{ enemyId: 'rat_swarm', weight: 7 }, { enemyId: 'escaped_subject', weight: 3 }, { enemyId: 'security_hound', weight: 2 }],
  residential: [{ enemyId: 'feral_dog', weight: 8 }, { enemyId: 'rat_swarm', weight: 6 }, { enemyId: 'carrion_crow', weight: 4 }],
  factory: [{ enemyId: 'maintenance_bot', weight: 7 }, { enemyId: 'security_hound', weight: 4 }, { enemyId: 'rat_swarm', weight: 3 }],
  forest: [{ enemyId: 'tusked_boar', weight: 7 }, { enemyId: 'venom_snake', weight: 6 }, { enemyId: 'feral_dog', weight: 4 }],
  lab: [{ enemyId: 'escaped_subject', weight: 6 }, { enemyId: 'resin_stalker', weight: 4 }, { enemyId: 'patrol_drone', weight: 3 }],
  commercial: [{ enemyId: 'feral_dog', weight: 7 }, { enemyId: 'carrion_crow', weight: 5 }, { enemyId: 'patrol_drone', weight: 4 }],
  station: [{ enemyId: 'rat_swarm', weight: 7 }, { enemyId: 'security_hound', weight: 4 }, { enemyId: 'patrol_drone', weight: 4 }],
  park: [{ enemyId: 'tusked_boar', weight: 6 }, { enemyId: 'venom_snake', weight: 5 }, { enemyId: 'carrion_crow', weight: 5 }],
  warehouse: [{ enemyId: 'maintenance_bot', weight: 6 }, { enemyId: 'feral_dog', weight: 5 }, { enemyId: 'rat_swarm', weight: 4 }],
  construction: [{ enemyId: 'maintenance_bot', weight: 6 }, { enemyId: 'patrol_drone', weight: 5 }, { enemyId: 'venom_snake', weight: 3 }],
  underground: [{ enemyId: 'rat_swarm', weight: 7 }, { enemyId: 'resin_stalker', weight: 4 }, { enemyId: 'escaped_subject', weight: 3 }],
};

const ENEMY_MAP = Object.fromEntries(ALL_WILD_ENEMIES.map((enemy) => [enemy.id, enemy]));
const DROP_MAP = Object.fromEntries(WILD_DROP_TABLES.map((table) => [table.id, table]));

export function tryGetWildEnemy(id: string): WildEnemyDef | null { return ENEMY_MAP[id] ?? null; }
export function getWildEnemy(id: string): WildEnemyDef {
  const enemy = tryGetWildEnemy(id);
  if (!enemy) throw new Error(`未知野外敌人 id: ${id}`);
  return enemy;
}
export function getWildDropTable(id: string): WildDropTable {
  const table = DROP_MAP[id];
  if (!table) throw new Error(`未知野外掉落表 id: ${id}`);
  return table;
}
export function commonZonesForEnemy(enemyId: string): string[] {
  const ecologyZones = ZONE_IDS.filter((zoneId) => WILD_ECOLOGY[zoneId]?.some((entry) => entry.enemyId === enemyId));
  if (ecologyZones.length > 0) return ecologyZones;
  return getWildEnemy(enemyId).eligibleZones ? [...getWildEnemy(enemyId).eligibleZones!] : [];
}

export const zonesForWildEnemy = commonZonesForEnemy;

export function validateWildRegistries(): string[] {
  const errors: string[] = [];
  const enemyIds = new Set<string>();
  const names = new Set<string>();
  const tableIds = new Set<string>();
  const materialIds = new Set<string>([...PHASE4N_WILD_MATERIAL_IDS, ...PHASE4P_WILD_MATERIAL_IDS]);
  const sourcedMaterials = new Set<string>();
  for (const table of WILD_DROP_TABLES) {
    if (!table.id || tableIds.has(table.id)) errors.push(`重复或空掉落表 id：${table.id}`);
    tableIds.add(table.id);
    if (table.entries.length === 0) errors.push(`掉落表 ${table.id} 为空`);
    for (const entry of table.entries) {
      if (!materialIds.has(entry.itemId)) errors.push(`掉落表 ${table.id} 引用未知野外材料 ${entry.itemId}`);
      if (!(entry.probability > 0 && entry.probability <= 1)) errors.push(`掉落表 ${table.id} 概率非法`);
      if (!Number.isInteger(entry.min) || !Number.isInteger(entry.max) || entry.min <= 0 || entry.max < entry.min) errors.push(`掉落表 ${table.id} 数量非法`);
      sourcedMaterials.add(entry.itemId);
    }
  }
  for (const enemy of ALL_WILD_ENEMIES) {
    if (!enemy.id || enemyIds.has(enemy.id)) errors.push(`重复或空野外敌人 id：${enemy.id}`);
    if (!enemy.name || names.has(enemy.name)) errors.push(`重复或空野外敌人名称：${enemy.name}`);
    enemyIds.add(enemy.id); names.add(enemy.name);
    for (const value of [enemy.maxHp, enemy.attack, enemy.defense, enemy.speed, enemy.encounterWeight]) if (!Number.isFinite(value) || value <= 0) errors.push(`野外敌人 ${enemy.id} 数值非法`);
    if (!tableIds.has(enemy.dropTableId)) errors.push(`野外敌人 ${enemy.id} 引用未知掉落表`);
    if (!['common', 'elite', 'apex'].includes(enemy.tier)) errors.push(`野外敌人 ${enemy.id} tier 非法`);
    if (!WILD_SPECIAL_ABILITIES[enemy.specialAbilityId]) errors.push(`野外敌人 ${enemy.id} 特殊技不存在`);
    if (enemy.tier !== 'common' && commonZonesForEnemy(enemy.id).length === 0) errors.push(`高阶野外敌人 ${enemy.id} 没有候选区域`);
    if (enemy.tier === 'apex' && !enemy.signatureDropItemId) errors.push(`Apex ${enemy.id} 缺少签名掉落`);
    if (enemy.tier !== 'apex' && enemy.signatureDropItemId) errors.push(`非 Apex ${enemy.id} 不得拥有签名掉落`);
    if (enemy.signatureDropItemId && !PHASE4P_SIGNATURE_IDS.includes(enemy.signatureDropItemId as typeof PHASE4P_SIGNATURE_IDS[number])) errors.push(`Apex ${enemy.id} 签名掉落不是 Phase4P 材料`);
    if (!enemy.fallbackEmoji || !/^#[0-9a-f]{6}$/i.test(enemy.fallbackColor)) errors.push(`野外敌人 ${enemy.id} fallback 非法`);
  }
  for (const enemy of ALL_WILD_ENEMIES.filter((entry) => entry.tier === 'apex')) {
    const signature = enemy.signatureDropItemId;
    const signatureEntries = WILD_DROP_TABLES.flatMap((table) => table.entries.filter((entry) => entry.itemId === signature));
    if (signatureEntries.length !== 1 || signatureEntries[0]?.probability !== 1 || signatureEntries[0]?.min !== 1 || signatureEntries[0]?.max !== 1) {
      errors.push(`Apex ${enemy.id} 的签名材料必须在掉落表中唯一且必掉 1 个`);
    }
  }
  for (const zoneId of ZONE_IDS) {
    const entries = WILD_ECOLOGY[zoneId];
    if (!entries?.length) errors.push(`区域 ${zoneId} 缺少生态表`);
    for (const entry of entries ?? []) {
      if (!enemyIds.has(entry.enemyId) || !Number.isFinite(entry.weight) || entry.weight <= 0) errors.push(`区域 ${zoneId} 生态引用非法`);
    }
  }
  for (const enemyId of enemyIds) if (commonZonesForEnemy(enemyId).length === 0) errors.push(`野外敌人 ${enemyId} 没有生态区域`);
  for (const materialId of materialIds) if (!sourcedMaterials.has(materialId)) errors.push(`野外材料 ${materialId} 没有掉落来源`);
  return [...new Set(errors)].sort();
}

const registryErrors = validateWildRegistries();
if (registryErrors.length > 0) throw new Error(registryErrors.join('；'));
