# Phase 4K — World Scale Expansion

日期：2026-08-13  
分支：`agent/phase4k-world-scale-expansion`  
范围：固定世界从 6 区扩展到 12 区；保持确定性、信息边界、物品守恒和既有战斗/数值规则。

## 1. Executive Summary

原正式地图有 6 个固定区域。本阶段保留学校、医院、住宅区、工厂、森林、研究所，新增商业街、车站、公园、仓库、建筑工地、地下通道，最终为 12 个真正可进入、可搜索、可成为出生点和禁区候选的区域。

地图仍是固定拓扑，不使用 procedural generation。移动、搜索、禁区、制作路线、出生、UI 和存档均通过区域数据或通用图逻辑承载；没有修改战斗、体力、伤害、经验、禁区伤害或角色数值。

## 2. Previous World

旧世界由 6 个 legacy zone 组成：

`school` 学校、`hospital` 医院、`residential` 住宅区、`factory` 工厂、`forest` 森林、`lab` 研究所。

旧区域、搜索池、NPC 移动和禁区流程本来主要已经是 `ZONES` 数据驱动；风险集中在 UI 文案/测试夹具、区域资产审计、制作引导注释以及旧存档缺少新区状态时的加载兼容。

## 3. New Zones

| id | 名称 | 目的 / loot identity | adjacency |
| --- | --- | --- | --- |
| `commercial` | 商业街 | 日用品与消耗资源：`cloth`、`water`、`glass`、`alcohol`；稀有布料护甲、绷带、能量饮料、简易弓 | school, hospital, residential, station |
| `station` | 车站 | 综合材料与工具：`scrap`、`battery`、`rope`、`water`；稀有铁管、简易弓、能量饮料 | commercial, factory, warehouse, underground |
| `park` | 公园 | 自然资源：`wood`、`herb`、`stone`、`water`；稀有草药、石斧、绷带 | forest, warehouse, construction |
| `warehouse` | 仓库 | 大宗基础制作资源：`rope`、`wood`、`scrap`、`cloth`；稀有简易护甲、铁管、布衣 | factory, station, park, construction |
| `construction` | 建筑工地 | 重型工业材料：`stone`、`iron`、`wood`、`scrap`；稀有铁板护甲、钢斧、简易护甲 | park, warehouse, underground |
| `underground` | 地下通道 | 电子 / 工业资源：`battery`、`scrap`、`glass`、`iron`；稀有电击棒、复合弓、绝缘管 | lab, station, construction |

每个新区均有唯一 id、中文名称、description、独立 base/rare loot pool、视觉 fallback、可进入/搜索/预警/禁区状态和合法邻接关系。所有 pool item id 通过 `validateZoneLootPools()` 检查，未知物品不会被静默忽略。

## 4. World Topology

以下是代码中的实际无向边；每行 `A -- B` 同时代表 `A -> B` 和 `B -> A`，与 `src/data/zones.ts` 一致：

```text
school       -- hospital
school       -- residential
school       -- commercial
hospital     -- lab
hospital     -- commercial
residential  -- factory
residential  -- forest
residential  -- commercial
factory      -- lab
factory      -- station
factory      -- warehouse
forest       -- lab
forest       -- park
lab          -- underground
commercial   -- station
station      -- warehouse
station      -- underground
park         -- warehouse
park         -- construction
warehouse    -- construction
construction -- underground
```

所有节点度数为 2–4，存在多个替代路线和环路，不是单纯直线；图校验没有发现孤立节点、自环、重复边或单向边。

## 5. Six-Zone Assumption Audit

### 找到并修改

- `src/data/zones.ts`：区域定义、id 列表和图校验改为可扩展数据驱动；保留 `LEGACY_ZONE_IDS` 仅用于同版本旧存档和视觉资产兼容。
- 地图 UI：`ZoneMap`、`MapDrawer`、`ZoneIndicator`、`GameScreen` 不再使用“六区/六按钮”文案或固定数量，按 `ZONES` 渲染 12 区。
- UI 与浏览器证据测试：固定 `toHaveLength(6)` 改为 `ZONES.length`；正式旧区资产测试仍明确只检查 legacy 六区，新增区域使用受控 fallback。
- `craftGuide` 的区域说明改为通用地图规模表述；路线继续调用已有通用距离/邻接逻辑。
- `tools/art/phase4a45Audit.ts`：正式美术资产只对 legacy 六区设为 Phase 4A base-art blocker；新区记录为明确 `fallbackOnly`，因此不会被误判为缺失正式 PNG。未修改批准的 PNG 或 `art/approved-assets.json`。
- `src/core/saveMigration.ts`：同版本 0.4.0 的旧六区存档加载时补齐新区状态和确定性 loot，不消耗原存档主 RNG 流。

### 合法业务规则，按要求保留

- `totalContestants = 6` 是参赛者数量，不是地图区域数量。
- `lab` 的研究异常目标、医院医疗特色、角色/世界事件列表属于内容规则，不是六区架构依赖。
- 历史 Phase 文档中的“6 区”作为历史记录保留；当前 README 已更新为 12 区并注明 legacy 基线。
- `commandHandlers.ts` 未修改，文件规模门禁继续通过；没有进行行为重构或战斗抽取。

## 6. Graph Validation

`validateZoneGraph()` 同时供模块加载自检和正式测试使用，检查：

- 12 个唯一 id；
- adjacency 目标存在；
- adjacency 对称；
- 无 self-loop；
- 无 duplicate adjacency；
- BFS 全图连通；

每个节点 2–4 个邻接点由 `tests/phase4kWorldScale.test.ts` 单独验证；这是内容拓扑约束，不是 `validateZoneGraph()` 的通用图结构检查。

`tests/phase4kWorldScale.test.ts` 的 graph integrity 用例通过，结果为 `validateZoneGraph() = []`。

## 7. UI Adaptation

地图节点来自 `ZONES`，使用 `data-zone-id` 和通用状态计算：当前区、相邻可移动区、远端不可移动区、warning、restricted。地图抽屉保留现有桌面双栏与移动端可滚动布局，移动端使用两列区域列表，避免把 12 区强行压成原六按钮布局。

新区没有新增正式 PNG；`visualAssets.ts` 为新区注册颜色/emoji fallback，正式图片失败时仍遵循现有 formal → SVG → emoji/color 降级链。自动 UI 测试确认 12 区全部渲染、当前/可达/远端状态和 warning/restricted cues；真实可读性仍需人工验收，见 `PHASE4K_HUMAN_PLAYTEST.md`。

## 8. Restricted Zone Compatibility

禁区算法继续遍历 `ZONE_IDS` 和区域状态，不读取固定六区列表。Phase 4K 测试覆盖 3 个固定 seed 的 warning → restricted 推进、`minSafeZones` 安全区下限、确定性选择和 finale 可达性；新区可以成为候选，且不会一次封闭全部区域。

## 9. Search / Loot Compatibility

每个新区均初始化独立 loot 状态并可执行 `SEARCH`，搜索结果进入既有 inventory / pending pickup / ground drop 流程。新池全部经过 item identity 校验，且 6 个新区的 base pool 身份互不重复。既有 item conservation 测试与 Phase 4K 全区域搜索测试均通过。

为保持旧 seed 的行为序列，新区 loot 使用按 `seed + zone id` 派生的独立 RNG；旧六区仍使用原主 RNG 流。这是确定性兼容处理，不是平衡调参。

## 10. Craft Route Compatibility

没有重新设计 Craft Guide；现有缺料 → 来源区域 → BFS 路线逻辑继续使用 `ZONE_IDS`、`getZoneDistance()` 和 adjacency。测试覆盖 melee（木棍）、ranged（简易弓）、armor（布衣）和 healing（绷带），并验证推荐区域真实存在、材料在该区 base/rare pool 中、路径每一步合法且有限。

## 11. Spawn Compatibility

player 和 NPC 都通过同一个 `SPAWN_ZONE_IDS = ZONE_IDS` 完整候选池出生。已移除 legacy-first、5% 新区切换和旧 seed 出生位置兼容路径；当前版本只保证同版本、同 seed、同角色和同输入可确定复现。1024 个固定 seed 已验证 player 与 NPC 都覆盖全部 12 区，没有人为压低新区概率，也没有加入出生公平性调参。

## 12. Save Compatibility

- 新区 round-trip：玩家位于 `underground`，含 inventory、equipment、stats、NPC、warning/restricted 状态时 serialize → deserialize 后状态一致，并可继续执行确定性移动。
- 旧存档：只有 `state.zones` key 集合精确等于 legacy 六区时才迁移；迁移会为每个新区补建 safe 状态和确定性初始 loot，并保持原 `state.rngState`。
- 部分缺失新区的当前存档、7–11 区部分存档、legacy 六区加新区、unknown zone 均不会迁移，正式 save validation 会拒绝并给出缺失/未知区域错误。
- 其他版本仍由原有版本闸门拒绝，没有扩大静默迁移范围。

## 13. Information Boundary

地图 UI 只显示当前公开区域状态、邻接可移动状态和当前区域地面可见信息；没有为了显示 12 区而读取或显示未发现 NPC 的精确位置、NPC inventory/equipment/intention、隐藏事件、远端 ground item 或未公开搜索结果。现有 `visibleEventsForPlayer` / projection 边界保持不变，信息架构回归测试通过。

## 14. Acceptance Fix

本轮独立验收发现并修复三个阻断问题：

1. **legacy-first 5% new-zone spawn bias**：根因是旧六区抽样后仅以 0.05 概率切换新区；修复为 player/NPC 共用完整 `ZONE_IDS` 候选池。出生测试覆盖全部 12 区及同 seed 确定性。
2. **partial-current-save incorrectly treated as legacy migration**：根因是迁移器只检查 legacy 六区存在；修复为 exact legacy key signature，任何当前存档缺区或 unknown zone 均由 validation 拒绝。新增 5 类损坏/非 legacy 迁移测试，并扩展 `audit:save` 缺区/未知区用例。
3. **Phase 4K regression overwrote historical Phase 3 evidence**：根因是模拟命令使用默认 `reports/phase3-balance.*` 输出；已恢复 base commit 的历史 Phase 3 文件，并将本轮回归写入独立 `reports/phase4k-regression.json` / `.md`。

## 15. Regression Simulation

执行：`npm run simulate -- --games 500 --seed-prefix PHASE4K --regression --output reports/phase4k-regression.json`

| 指标 | 结果 |
| --- | ---: |
| requested games | 500 |
| actual games | 500 |
| trustworthy games | 500 / 500（100%） |
| wins / losses | 43 / 457 |
| win rate | 8.6% |
| illegal commands | 0 |
| deadlock / livelock / stalled | 0 |
| hard limit | 0 |
| average duration | 64.156 时间单位 |

玩家死亡原因（452 个失败对局）：

- 战斗：276
- 禁区侵蚀：93
- 衰竭：88

结果文件：[reports/phase4k-regression.json](/Users/coolking70/Documents/同步空间/battleroyal/reports/phase4k-regression.json)、[reports/phase4k-regression.md](/Users/coolking70/Documents/同步空间/battleroyal/reports/phase4k-regression.md)。Regression gate 和引擎健康 gate 通过。角色平衡仅作观察，不影响本轮 PASS/FAIL；**BALANCE OBSERVATION ONLY — BALANCE DEFERRED**。胜率和角色胜率不作为 Phase 4K 验收标准，本阶段没有进行 balance tuning。

## 16. Human Playtest

### VERIFIED

- 数据、图完整性、移动、搜索、禁区、制作路线、出生、存档、信息边界：自动测试通过。
- 12 区 React UI 节点、当前/相邻/远端、warning/restricted 状态：自动 UI 测试通过。
- 类型检查、全量测试、生产构建及所有项目门禁：见下表。

### NEEDS-HUMAN-PLAYTEST

自动测试不能证明真实桌面/移动端的视觉密度、文字覆盖、节点可读性和手指点击舒适度。请按 `PHASE4K_HUMAN_PLAYTEST.md` 完成 Desktop、Mobile 和实际 MOVE/SEARCH/PICKUP/CRAFT/restricted transition 验收。

## 17. Regression Gates

| Gate | 结果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 90 files, 1472 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS — damaged 91, rejected 91, construction failures 0 |
| `npm run audit:deps` | PASS — 78 scans, core/data max 500 lines, R1/R2/R3/R4 = 0 |
| `npm run art:doctor -- --offline` | PASS — 36 tasks |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS — manifest/provenance/candidate/runtime all PASS |
| `npm run art:security:browser` | PASS — 213 files |
| `npm run art:security:repo` | PASS — 905 tracked files |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| 500-game regression | PASS — 独立 `reports/phase4k-regression.*`，requested/actual一致、引擎健康通过 |

## 18. Deferred Work

本阶段明确没有提前实现：

- Phase 4L 新职业 / 新角色体系；
- Phase 4M Equipment & Crafting 2.0、大型合成树、品质/套装/新装备槽；
- Phase 4N PvE 野怪、Boss 和 PvE 专属掉落生态；
- Phase 4O 多胜利条件；
- content-complete balance pass。

## 19. Roadmap

- **Phase 4L — Expanded Character / Profession Roster**：扩充至约 8–10 个具有明显职业、被动和技能身份的角色。
- **Phase 4M — Equipment & Crafting 2.0**：建立多层、多分支 crafting graph，扩充材料、中间件、武器、防具和 utility equipment。
- **Phase 4N — PvE Wild Enemies & Drop Ecology**：基于区域身份、风险和 loot identity 加入野外敌人及 PvE 掉落。
- **Phase 4O — Multiple Victory Conditions**：建立 last survivor、evacuation、objective、special/boss victory framework。
- **Later — Content-Complete Balance Pass**：世界、角色、装备、合成、PvE、胜利条件稳定后，再进行系统数值平衡；Phase 4J 统计仅作历史记录。

推荐下一阶段：**Phase 4L — Expanded Character / Profession Roster**。
