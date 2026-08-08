/**
 * 视觉资产注册表（Phase 3A Step 11）。
 *
 * 项目里所有「该长什么样」的展示决策集中在这一层：
 *  - 区域 / 角色 / 世界事件 / 物品类别 → emoji + 主题色 + 可选 SVG 图片路径；
 *  - 图片路径只在 `VISUAL_ASSET_MANIFEST` 里存在时才被启用，否则 UI 一律退回
 *    emoji + 色块 —— **fallback 是默认行为**，缺图永远不应该让界面坏掉；
 *  - `visualFor` / `itemEmoji` 是唯一入口：core 不感知图片，UI 组件不写死图标。
 *
 * 规则：
 *  1. 未知 key 一律返回 `FALLBACK_VISUAL`（❓ 灰块），绝不抛异常；
 *  2. 图片路径用相对 `src/ui/assets/` 的写法，供 Vite 直接引用；
 *  3. 本文件为纯数据 + 纯函数，不依赖 React，可被 vitest 直接导入。
 */

import { tryGetItem } from '../data/items';
import { tryGetCharacterDef } from '../data/characters';
import { getZoneDef } from '../data/zones';
import type { ItemCategory, WorldEventId } from '../core/types';

/* ------------------------------------------------------------------ */
/* 类型                                                                */
/* ------------------------------------------------------------------ */

export type VisualKind = 'zone' | 'character' | 'worldEvent' | 'itemCategory';

export interface VisualSpec {
  /** 图形 emoji（fallback 与无障碍文本都靠它） */
  emoji: string;
  /** 主题色（色块/边框），无图片时作为主视觉 */
  color: string;
  /** 可选图片路径（相对 src/ui/assets/），仅当文件存在于 MANIFEST 时非 null */
  image: string | null;
  /** 人类可读名称 */
  label: string;
}

/* ------------------------------------------------------------------ */
/* Manifest（与 src/ui/assets/manifest.json 同步；测试会校验一致性）     */
/* ------------------------------------------------------------------ */

/** 当前确实存在的资产文件（相对 src/ui/assets/）。新增文件必须同时登记。 */
export const VISUAL_ASSET_MANIFEST: readonly string[] = [
  'fallback.svg',
  'zones/school.svg',
  'zones/hospital.svg',
  'zones/residential.svg',
  'zones/factory.svg',
  'zones/forest.svg',
  'zones/lab.svg',
  'characters/scout.svg',
  'characters/fighter.svg',
  'characters/engineer.svg',
  'characters/medic.svg',
  'events/blackout.svg',
  'events/rain.svg',
  'events/emergency_broadcast.svg',
  'events/medical_alert.svg',
  'events/research_anomaly.svg',
  'events/citywide_unrest.svg',
] as const;

/** 某资产文件是否存在（决定走图片还是 fallback） */
export function hasAsset(path: string): boolean {
  return (VISUAL_ASSET_MANIFEST as readonly string[]).includes(path);
}

/** 组装 VisualSpec：image 仅在文件真实存在时启用 */
function spec(
  emoji: string,
  color: string,
  label: string,
  imagePath: string | null,
): VisualSpec {
  return { emoji, color, label, image: imagePath && hasAsset(imagePath) ? imagePath : null };
}

/* ------------------------------------------------------------------ */
/* 注册表                                                              */
/* ------------------------------------------------------------------ */

/** 兜底视觉：任何未知 key 都落在这里 */
export const FALLBACK_VISUAL: VisualSpec = {
  emoji: '❓',
  color: '#555555',
  label: '未知',
  image: hasAsset('fallback.svg') ? 'fallback.svg' : null,
};

/** 区域视觉（颜色与 data/zones.ts 保持一致，防止两处漂移） */
export const ZONE_VISUALS: Record<string, VisualSpec> = {
  school: spec('🏫', '#4a6fa5', '学校', 'zones/school.svg'),
  hospital: spec('🏥', '#3f8f7a', '医院', 'zones/hospital.svg'),
  residential: spec('🏘️', '#8a6b4f', '住宅区', 'zones/residential.svg'),
  factory: spec('🏭', '#8c5b3f', '工厂', 'zones/factory.svg'),
  forest: spec('🌲', '#4f7a44', '森林', 'zones/forest.svg'),
  lab: spec('🧪', '#6a5b9a', '研究所', 'zones/lab.svg'),
};

/** 角色视觉（四名可选角色） */
export const CHARACTER_VISUALS: Record<string, VisualSpec> = {
  scout: spec('🔭', '#2f6f8f', '侦察员', 'characters/scout.svg'),
  fighter: spec('⚔️', '#a04030', '斗士', 'characters/fighter.svg'),
  engineer: spec('🔧', '#7a6a2f', '工程师', 'characters/engineer.svg'),
  medic: spec('💉', '#2f7a5a', '医学生', 'characters/medic.svg'),
};

/** 世界事件视觉（GameScreen 横幅与图例共用，取代原先散落的本地 map） */
export const WORLD_EVENT_VISUALS: Record<WorldEventId, VisualSpec> = {
  blackout: spec('🔌', '#2b2b3a', '大停电', 'events/blackout.svg'),
  rain: spec('🌧️', '#4a6a8a', '连绵阴雨', 'events/rain.svg'),
  emergency_broadcast: spec('📢', '#8a5a2a', '紧急广播', 'events/emergency_broadcast.svg'),
  medical_alert: spec('🏥', '#7a4a6a', '医疗管制', 'events/medical_alert.svg'),
  research_anomaly: spec('🧪', '#4a6a5a', '研究异常', 'events/research_anomaly.svg'),
  citywide_unrest: spec('🔥', '#a04040', '全城骚动', 'events/citywide_unrest.svg'),
};

/** 物品类别视觉（背包 / 合成面板的物品图标） */
export const ITEM_CATEGORY_VISUALS: Record<ItemCategory, VisualSpec> = {
  material: spec('🔩', '#8a7a4a', '材料', null),
  consumable: spec('🧪', '#3f8f7a', '消耗品', null),
  weapon: spec('⚔️', '#a04030', '武器', null),
  armor: spec('🛡️', '#4a6fa5', '防具', null),
};

/* ------------------------------------------------------------------ */
/* 查询入口（唯一）                                                     */
/* ------------------------------------------------------------------ */

/**
 * 按 kind + key 取视觉规格；未知 key 一律回落 FALLBACK_VISUAL。
 *
 * zone / character 的 label 与 color 以数据表为准（防止注册表与数据漂移），
 * 注册表只提供 emoji 与图片路径。
 */
export function visualFor(kind: VisualKind, key: string): VisualSpec {
  switch (kind) {
    case 'zone': {
      const v = ZONE_VISUALS[key];
      const def = safeZoneDef(key);
      if (!v || !def) return FALLBACK_VISUAL;
      return { ...v, label: def.name, color: def.color };
    }
    case 'character': {
      const v = CHARACTER_VISUALS[key];
      const def = tryGetCharacterDef(key);
      if (!v || !def) return FALLBACK_VISUAL;
      return { ...v, label: def.name };
    }
    case 'worldEvent': {
      const v = (WORLD_EVENT_VISUALS as Record<string, VisualSpec>)[key];
      return v ? { ...v } : FALLBACK_VISUAL;
    }
    case 'itemCategory': {
      const v = (ITEM_CATEGORY_VISUALS as Record<string, VisualSpec>)[key];
      return v ? { ...v } : FALLBACK_VISUAL;
    }
    default:
      return FALLBACK_VISUAL;
  }
}

/** 某件物品的展示图标：按类别取，未知类别回退兜底 */
export function itemEmoji(itemId: string): string {
  const def = tryGetItem(itemId);
  if (!def) return FALLBACK_VISUAL.emoji;
  return ITEM_CATEGORY_VISUALS[def.category]?.emoji ?? FALLBACK_VISUAL.emoji;
}

/** 世界事件 emoji（GameScreen 横幅用，纯糖衣函数） */
export function worldEventEmoji(id: WorldEventId): string {
  return WORLD_EVENT_VISUALS[id]?.emoji ?? FALLBACK_VISUAL.emoji;
}

/* ------------------------------------------------------------------ */
/* 内部：不抛异常的 getter（data 表应保证存在，这里做防御）              */
/* ------------------------------------------------------------------ */

function safeZoneDef(zoneId: string): { name: string; color: string } | null {
  try {
    return getZoneDef(zoneId);
  } catch {
    return null;
  }
}
