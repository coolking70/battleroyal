# VISUAL_ASSET_SPEC.md — 视觉资产接口规范（Phase 3A Step 11）

> 版本 0.3.2 · 与 `src/ui/visualAssets.ts` + `src/ui/assetManifestLoader.ts` + `src/ui/assets/` + `public/assets/manifest.json` 一一对应。

## 1. 目标

把「该长什么样」的展示决策集中到一层，达成三个目标：

1. **统一入口**：区域 / 角色 / 世界事件 / 物品类别都有唯一的视觉规格来源；
2. **缺图不坏**：图片缺失时 UI 自动退回 emoji + 色块（fallback 是默认行为）；
3. **UI/core 解耦**：core 不感知图片，UI 组件不写死图标。

## 2. 文件布局

```
src/ui/visualAssets.ts          注册表 + fallback 逻辑 + 查询入口
src/ui/assets/
  manifest.json                 全部资产文件清单（生成物）
  fallback.svg                  兜底图（❓ 灰块）
  zones/<id>.svg                legacy 六区正式资产；新区使用受控 fallback
  characters/<id>.svg           4 个角色
  events/<id>.svg               6 个世界事件
```

每个 SVG 为 64×64：主题色圆角块 + emoji 主图形 + 中文名标签，可由
`node .tmp/gen_svgs.cjs` 重新生成（生成脚本不属交付物，仅维护用）。

## 3. 核心类型

```ts
interface VisualSpec {
  emoji: string;      // 图形 emoji（fallback 与无障碍文本）
  color: string;      // 主题色（色块/边框）
  image: string | null; // 相对 src/ui/assets/ 的路径；文件不存在时为 null
  fallbackImage?: string | null; // 正式图失败时只尝试一次的本地 SVG
  label: string;      // 人类可读名称
}
```

## 4. Fallback 规则

1. `visualFor(kind, key)` 是**唯一**查询入口；未知 key 一律返回 `FALLBACK_VISUAL`（❓ 灰块），**绝不抛异常**。
2. `image` 字段只在文件登记于 `VISUAL_ASSET_MANIFEST` 时才非 null —— 即使 SVG 文件被删，界面仍正常显示 emoji + 色块。
3. `FALLBACK_VISUAL.image` 指向 `fallback.svg`（同样受 manifest 约束，缺失则 null）。
4. `VisualImage` 的浏览器状态机严格按「正式图 → SVG → emoji」单向降级；图片错误不会触发无限重试。

## 5. 注册表覆盖

| 注册表 | 覆盖 | 与数据表一致性 |
| --- | --- | --- |
| `ZONE_VISUALS` | 6 区域 | color/label 以 `data/zones.ts` 为准（`visualFor` 运行时回填，防漂移） |
| `CHARACTER_VISUALS` | 4 角色 | label 以 `data/characters.ts` 为准 |
| `WORLD_EVENT_VISUALS` | 6 世界事件（`Record<WorldEventId, ...>` 编译期穷举） | — |
| `ITEM_CATEGORY_VISUALS` | material / consumable / weapon / armor | 类别来自 `data/items.ts` |

`Record<WorldEventId, VisualSpec>` 之类的写法保证新增事件类型时 TypeScript 强制补齐图标，不会「新事件掉进兜底」。

## 6. 查询入口

```ts
visualFor('zone', zoneId)        // 区域视觉（含数据表回填）
visualFor('character', charId)   // 角色视觉
visualFor('worldEvent', eventId) // 事件视觉
visualFor('itemCategory', cat)   // 物品类别视觉
itemEmoji(itemId)                // 物品图标（按类别）
worldEventEmoji(eventId)         // 事件 emoji（横幅用）
```

## 7. UI 接入点

| 组件 | 使用 |
| --- | --- |
| `MenuScreen` / `StatusBar` | 角色正式图 / SVG / emoji |
| `GameScreen` | 当前区域头图、世界事件横幅图标 |
| `ZoneMap` | 区域图标 + `--zone-color`（颜色来自注册表，与数据表一致） |
| `Inventory` | 物品正式图（当前提供 bandage 测试资产）或类别 fallback |
| `EncounterPanel` | （后续扩展） |

## 8. 测试守护（tests/visualAssets.test.ts）

- manifest 登记的每个文件必须真实存在；
- 所有区域/角色/事件 key 都有视觉规格（不掉进兜底）；
- 未知 key 一律返回 `FALLBACK_VISUAL`；
- 区域 color/label 与数据表一致（防漂移）；
- `itemEmoji` 覆盖全部物品类别，未知物品返回 ❓。

## 9. Phase 4 正式资产 Manifest（Phase 3A-2 runtime closure）

### 9.1 目录与解析顺序

```
public/assets/
  characters/  zones/  items/  world-events/  effects/  manifest.json
```

**解析顺序（必须遵守）**：
1. `public/assets/manifest.json` 指定的正式资产（Phase 4 AI 生成后写入）；
2. 空 / 缺失 → `src/ui/assets/` 的 SVG（development fallback）；
3. SVG 不存在 → emoji + color fallback。

游戏启动由 `src/main.tsx` 先执行 `loadAssetManifest()`，成功后再 render App。
Manifest 404、网络错误、坏 JSON、错误 schema 或危险路径都会清空注册表并继续启动。
正式图在 `VisualImage` 中失败后只尝试本地 SVG；SVG 也失败则显示 emoji/色块，任何时候不保留 broken img。

### 9.2 统一接口（React 只能调用这些）

```ts
getCharacterVisual(id)  // 优先 manifest.characters[id].portrait
getZoneVisual(id)       // 优先 manifest.zones[id].background
getItemVisual(id)       // 优先 manifest.items[id]
getWorldEventVisual(id) // 优先 manifest.worldEvents[id]
```

Phase 4 替换资产生成后，只需更新 `public/assets/` 与 manifest.json，
**无需修改任何 React 组件**（组件不得硬编码 `/assets/xxx.png`）。

### 9.3 manifest 结构（version 1）

```json
{
  "version": 1,
  "characters": { "scout": { "portrait": null, "injured": null, "combat": null }, ... },
  "zones": { "school": { "background": null, "warning": null, "restricted": null }, ... },
  "items": {},
  "worldEvents": {}
}
```

### 9.4 测试契约（`tests/assetManifestLoader.test.ts`、`tests/visualImage.test.tsx`）

manifest 缺失 → fallback；manifest 为空 → fallback；正式 portrait 存在 → 优先正式图；
正式图不存在 → SVG fallback；SVG 不存在 → emoji fallback；未知角色/区域 → fallback。

`tests/assetManifestLoader.test.ts` 还验证启动 loader 的 200 / 404 / 网络失败 / 坏 JSON /
错误版本 / 危险路径；`tests/visualImage.test.tsx` 验证 onError 只沿三级状态机前进。
