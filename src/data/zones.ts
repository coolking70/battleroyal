import type { ZoneDef } from '../core/types';

/**
 * 固定世界区域，连接关系写死（不做程序化生成）。
 * 相邻关系必须双向对称，模块加载时会做一次自检。
 *
 * 地图规则只依赖这份数据；新增固定区域不需要修改移动、搜索、禁区、
 * 出生或制作路线的核心逻辑。
 */
export const ZONES: ZoneDef[] = [
  {
    id: 'school',
    name: '学校',
    description:
      '课桌翻倒在走廊上，黑板还留着没擦掉的板书。这里空间开阔，藏不住人。',
    adjacent: ['residential', 'hospital', 'commercial'],
    basePool: ['wood', 'cloth', 'rope', 'water', 'stone'],
    rarePool: ['stick', 'cloth_armor', 'energy_drink'],
    color: '#4a6fa5',
  },
  {
    id: 'hospital',
    name: '医院',
    description:
      '走廊灯管间歇性闪烁，消毒水味道压不住底下的血腥味。药品柜大多被翻过了。',
    adjacent: ['school', 'lab', 'commercial'],
    // 医院保留医疗特色；rarePool 的 stick 只提供低概率直接武器保底，
    // 避免“这里永远出不了武器”的死角，而不抢占普通医疗物资权重。
    basePool: ['herb', 'alcohol', 'cloth', 'bandage', 'water'],
    rarePool: ['medkit', 'herb_remedy', 'simple_armor', 'stick'],
    color: '#3f8f7a',
  },
  {
    id: 'residential',
    name: '住宅区',
    description:
      '成排的旧居民楼，多数门锁已被撬开。物资杂而不精，但路口很多。',
    adjacent: ['school', 'factory', 'forest', 'commercial'],
    basePool: ['cloth', 'rope', 'water', 'wood', 'glass'],
    rarePool: ['energy_drink', 'cloth_armor', 'stone_axe'],
    color: '#8a6b4f',
  },
  {
    id: 'factory',
    name: '工厂',
    description:
      '停摆的流水线上还挂着零件，地面油污反着光。金属材料在这里最多。',
    adjacent: ['residential', 'lab', 'station', 'warehouse'],
    basePool: ['scrap', 'iron', 'wood', 'stone', 'rope'],
    rarePool: ['iron_pipe', 'simple_armor', 'plate_armor'],
    color: '#8c5b3f',
  },
  {
    id: 'forest',
    name: '森林',
    description:
      '林线之外一片漆黑，脚下厚厚一层落叶。视野差，但自然材料充足。',
    adjacent: ['residential', 'lab', 'park'],
    basePool: ['wood', 'stone', 'herb', 'rope', 'water'],
    rarePool: ['stone_axe', 'herb_remedy', 'simple_bow'],
    color: '#4f7a44',
  },
  {
    id: 'lab',
    name: '研究所',
    description:
      '门禁失效后所有房间都敞着，实验台上仪器还在低鸣。危险，但回报也高。',
    adjacent: ['hospital', 'factory', 'forest', 'underground'],
    basePool: ['glass', 'battery', 'alcohol', 'scrap', 'iron'],
    rarePool: ['stun_rod', 'plate_armor', 'medkit'],
    color: '#6a5b9a',
  },
  {
    id: 'commercial',
    name: '商业街',
    description:
      '卷帘门半落的商铺连成一片，破碎橱窗里还留着日用品和少量饮料。',
    adjacent: ['school', 'hospital', 'residential', 'station'],
    basePool: ['cloth', 'water', 'glass', 'alcohol'],
    rarePool: ['bandage', 'energy_drink', 'cloth_armor', 'simple_bow'],
    color: '#a06b4f',
  },
  {
    id: 'station',
    name: '车站',
    description:
      '停运的站台通向几条黑暗隧道，售票厅和检修间里散落着综合材料。',
    adjacent: ['commercial', 'factory', 'warehouse', 'underground'],
    basePool: ['scrap', 'battery', 'rope', 'water'],
    rarePool: ['iron_pipe', 'simple_bow', 'energy_drink'],
    color: '#697b8d',
  },
  {
    id: 'park',
    name: '公园',
    description:
      '荒废的步道被灌木重新占据，长椅、石景和旧急救箱藏着自然资源。',
    adjacent: ['forest', 'warehouse', 'construction'],
    basePool: ['wood', 'herb', 'stone', 'water'],
    rarePool: ['herb_remedy', 'stone_axe', 'bandage'],
    color: '#527b61',
  },
  {
    id: 'warehouse',
    name: '仓库',
    description:
      '高大的货架已经倾倒，捆扎材料和木箱堆在通往后场的通道两侧。',
    adjacent: ['factory', 'station', 'park', 'construction'],
    basePool: ['rope', 'wood', 'scrap', 'cloth'],
    rarePool: ['simple_armor', 'iron_pipe', 'cloth_armor'],
    color: '#806a4a',
  },
  {
    id: 'construction',
    name: '建筑工地',
    description:
      '未完工的楼体像一排空骨架，钢筋、石料和木模板都暴露在风里。',
    adjacent: ['park', 'warehouse', 'underground'],
    basePool: ['stone', 'iron', 'wood', 'scrap'],
    rarePool: ['plate_armor', 'steel_axe', 'simple_armor'],
    color: '#9a7445',
  },
  {
    id: 'underground',
    name: '地下通道',
    description:
      '废弃的地下连廊没有信号，积水旁的配电箱和玻璃指示牌仍可拆取。',
    adjacent: ['lab', 'station', 'construction'],
    basePool: ['battery', 'scrap', 'glass', 'iron'],
    rarePool: ['stun_rod', 'composite_bow', 'insulated_pipe'],
    color: '#465d73',
  },
];

/** Phase 4K compatibility set: the six zones that existed in 0.4.0 saves. */
export const LEGACY_ZONE_IDS = [
  'school',
  'hospital',
  'residential',
  'factory',
  'forest',
  'lab',
] as const;

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

/**
 * 通用固定图完整性检查，供模块自检与正式测试复用。
 * 不包含区域数量判断，使地图可以继续扩张到 16 / 20 / 24 区。
 */
export function validateZoneGraph(zoneDefs: readonly ZoneDef[] = ZONES): string[] {
  const errors: string[] = [];
  const byId = new Map<string, ZoneDef>();
  for (const zone of zoneDefs) {
    if (byId.has(zone.id)) errors.push(`重复区域 id：${zone.id}`);
    byId.set(zone.id, zone);
  }

  for (const zone of zoneDefs) {
    const seen = new Set<string>();
    for (const other of zone.adjacent) {
      if (seen.has(other)) errors.push(`区域 ${zone.id} 存在重复邻接：${other}`);
      seen.add(other);
      if (other === zone.id) errors.push(`区域 ${zone.id} 存在 self-loop`);
      const otherDef = byId.get(other);
      if (!otherDef) {
        errors.push(`区域 ${zone.id} 指向了不存在的区域 ${other}`);
      } else if (!otherDef.adjacent.includes(zone.id)) {
        errors.push(`区域连接不对称：${zone.id} -> ${other}`);
      }
    }
  }

  const first = zoneDefs[0];
  if (first) {
    const visited = new Set<string>([first.id]);
    const queue = [first.id];
    while (queue.length > 0) {
      const zoneId = queue.shift()!;
      for (const other of byId.get(zoneId)?.adjacent ?? []) {
        if (!visited.has(other) && byId.has(other)) {
          visited.add(other);
          queue.push(other);
        }
      }
    }
    for (const zone of zoneDefs) {
      if (!visited.has(zone.id)) errors.push(`区域图存在孤立区域：${zone.id}`);
    }
  }
  return errors;
}

const graphErrors = validateZoneGraph();
if (graphErrors.length > 0) throw new Error(graphErrors.join('；'));
