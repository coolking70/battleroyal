/**
 * 视觉资产接口测试（Phase 3A Step 11）。
 *
 * 契约：
 *  1. manifest 里登记的每个文件都必须真实存在于 `src/ui/assets/`；
 *  2. 所有区域 / 角色 / 世界事件 key 都必须有视觉规格（不允许掉进 ❓ 兜底）；
 *  3. 区域 / 角色的 color 与 label 与数据表一致（防止注册表漂移）；
 *  4. 未知 key 一律回落 `FALLBACK_VISUAL`，绝不抛异常；
 *  5. `itemEmoji` 按类别给图标，未知物品返回 ❓；
 *  6. 有图时 image 非 null，没图时 image 为 null（fallback 语义）。
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { CHARACTERS } from '../src/data/characters';
import { ZONES } from '../src/data/zones';
import { ITEMS } from '../src/data/items';
import { WORLD_EVENT_IDS } from '../src/core/worldEvents';
import {
  FALLBACK_VISUAL,
  VISUAL_ASSET_MANIFEST,
  WORLD_EVENT_VISUALS,
  itemEmoji,
  visualFor,
} from '../src/ui/visualAssets';

const ASSETS_ROOT = resolve(__dirname, '../src/ui/assets');

describe('manifest 与磁盘文件一致性', () => {
  it('manifest 登记的每个文件都真实存在', () => {
    for (const rel of VISUAL_ASSET_MANIFEST) {
      expect(existsSync(resolve(ASSETS_ROOT, rel)), `缺失资产文件：${rel}`).toBe(true);
    }
  });
  it('manifest 至少包含 fallback 与全部区域/角色/事件', () => {
    const set = new Set(VISUAL_ASSET_MANIFEST);
    expect(set.has('fallback.svg')).toBe(true);
    for (const z of ZONES) expect(set.has(`zones/${z.id}.svg`), `缺 zones/${z.id}.svg`).toBe(true);
    for (const c of CHARACTERS) expect(set.has(`characters/${c.id}.svg`), `缺 characters/${c.id}.svg`).toBe(true);
    for (const id of WORLD_EVENT_IDS) expect(set.has(`events/${id}.svg`), `缺 events/${id}.svg`).toBe(true);
  });
});

describe('注册表覆盖与 fallback', () => {
  it('所有区域都有视觉规格，且与数据表 color/label 一致', () => {
    for (const def of ZONES) {
      const v = visualFor('zone', def.id);
      expect(v, `区域 ${def.id} 掉进兜底`).not.toBe(FALLBACK_VISUAL);
      expect(v.color).toBe(def.color);
      expect(v.label).toBe(def.name);
      expect(v.image, `区域 ${def.id} 应有图片`).not.toBeNull();
    }
  });

  it('所有角色都有视觉规格', () => {
    for (const def of CHARACTERS) {
      const v = visualFor('character', def.id);
      expect(v, `角色 ${def.id} 掉进兜底`).not.toBe(FALLBACK_VISUAL);
      expect(v.label).toBe(def.name);
      expect(v.image, `角色 ${def.id} 应有图片`).not.toBeNull();
    }
  });

  it('世界事件覆盖恰好 6 种，且都有图标', () => {
    expect(Object.keys(WORLD_EVENT_VISUALS).sort()).toEqual([...WORLD_EVENT_IDS].sort());
    for (const id of WORLD_EVENT_IDS) {
      expect(WORLD_EVENT_VISUALS[id]!.emoji.length).toBeGreaterThan(0);
      expect(WORLD_EVENT_VISUALS[id]!.image, `事件 ${id} 应有图片`).not.toBeNull();
    }
  });

  it('未知 key 一律回落 FALLBACK_VISUAL，不抛异常', () => {
    expect(visualFor('zone', 'no_such_zone')).toBe(FALLBACK_VISUAL);
    expect(visualFor('character', 'no_such_char')).toBe(FALLBACK_VISUAL);
    expect(visualFor('worldEvent', 'no_such_event')).toBe(FALLBACK_VISUAL);
    expect(visualFor('itemCategory', 'no_such_cat')).toBe(FALLBACK_VISUAL);
    expect(visualFor('whatever' as never, 'x')).toBe(FALLBACK_VISUAL);
  });
});

describe('物品图标', () => {
  it('已知物品按类别给图标', () => {
    // 取每种类别至少一件物品验证
    const byCat: Record<string, string[]> = {};
    for (const it of ITEMS) (byCat[it.category] ??= []).push(it.id);
    for (const [cat, ids] of Object.entries(byCat)) {
      for (const id of ids.slice(0, 3)) {
        const emoji = itemEmoji(id);
        expect(emoji, `物品 ${id}（${cat}）图标为空`).not.toBe('');
        expect(emoji).not.toBe(FALLBACK_VISUAL.emoji);
      }
    }
  });
  it('未知物品返回兜底 ❓', () => {
    expect(itemEmoji('no_such_item')).toBe(FALLBACK_VISUAL.emoji);
  });
  it('物品类别注册表与 items 数据类别一致', () => {
    const cats = new Set(ITEMS.map((i) => i.category));
    for (const cat of cats) {
      expect(visualFor('itemCategory', cat), `物品类别 ${cat} 缺视觉`).not.toBe(FALLBACK_VISUAL);
    }
  });
});
