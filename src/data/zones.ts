import type { ZoneDef } from '../core/types';

/**
 * 6 个固定区域，连接关系写死（不做程序化生成）。
 * 相邻关系必须双向对称，模块加载时会做一次自检。
 */
export const ZONES: ZoneDef[] = [
  {
    id: 'school',
    name: '学校',
    description:
      '课桌翻倒在走廊上，黑板还留着没擦掉的板书。这里空间开阔，藏不住人。',
    adjacent: ['residential', 'hospital'],
    basePool: ['wood', 'cloth', 'rope', 'water', 'stone'],
    rarePool: ['stick', 'cloth_armor', 'energy_drink'],
    color: '#4a6fa5',
  },
  {
    id: 'hospital',
    name: '医院',
    description:
      '走廊灯管间歇性闪烁，消毒水味道压不住底下的血腥味。药品柜大多被翻过了。',
    adjacent: ['school', 'lab'],
    basePool: ['herb', 'alcohol', 'cloth', 'bandage', 'water'],
    rarePool: ['medkit', 'herb_remedy', 'simple_armor'],
    color: '#3f8f7a',
  },
  {
    id: 'residential',
    name: '住宅区',
    description:
      '成排的旧居民楼，多数门锁已被撬开。物资杂而不精，但路口很多。',
    adjacent: ['school', 'factory', 'forest'],
    basePool: ['cloth', 'rope', 'water', 'wood', 'glass'],
    rarePool: ['energy_drink', 'cloth_armor', 'stone_axe'],
    color: '#8a6b4f',
  },
  {
    id: 'factory',
    name: '工厂',
    description:
      '停摆的流水线上还挂着零件，地面油污反着光。金属材料在这里最多。',
    adjacent: ['residential', 'lab'],
    basePool: ['scrap', 'iron', 'wood', 'stone', 'rope'],
    rarePool: ['iron_pipe', 'simple_armor', 'plate_armor'],
    color: '#8c5b3f',
  },
  {
    id: 'forest',
    name: '森林',
    description:
      '林线之外一片漆黑，脚下厚厚一层落叶。视野差，但自然材料充足。',
    adjacent: ['residential', 'lab'],
    basePool: ['wood', 'stone', 'herb', 'rope', 'water'],
    rarePool: ['stone_axe', 'herb_remedy', 'simple_bow'],
    color: '#4f7a44',
  },
  {
    id: 'lab',
    name: '研究所',
    description:
      '门禁失效后所有房间都敞着，实验台上仪器还在低鸣。危险，但回报也高。',
    adjacent: ['hospital', 'factory', 'forest'],
    basePool: ['glass', 'battery', 'alcohol', 'scrap', 'iron'],
    rarePool: ['stun_rod', 'plate_armor', 'medkit'],
    color: '#6a5b9a',
  },
];

const ZONE_MAP: Record<string, ZoneDef> = Object.fromEntries(
  ZONES.map((z) => [z.id, z]),
);

export function getZoneDef(zoneId: string): ZoneDef {
  const def = ZONE_MAP[zoneId];
  if (!def) {
    throw new Error(`未知区域 id: ${zoneId}`);
  }
  return def;
}

export function tryGetZoneDef(zoneId: string): ZoneDef | null {
  return ZONE_MAP[zoneId] ?? null;
}

export function areAdjacent(a: string, b: string): boolean {
  const def = tryGetZoneDef(a);
  if (!def) return false;
  return def.adjacent.includes(b);
}

export const ZONE_IDS: string[] = ZONES.map((z) => z.id);

/** 开发期自检：相邻关系必须对称，避免出现单向通路 */
function assertSymmetric(): void {
  for (const zone of ZONES) {
    for (const other of zone.adjacent) {
      const otherDef = ZONE_MAP[other];
      if (!otherDef) {
        throw new Error(`区域 ${zone.id} 指向了不存在的区域 ${other}`);
      }
      if (!otherDef.adjacent.includes(zone.id)) {
        throw new Error(`区域连接不对称：${zone.id} -> ${other}`);
      }
    }
  }
}
assertSymmetric();
