# Phase 4D-2 实施报告

**版本：** v0.3.2（信息架构重构，未改战斗 / 平衡 / 核心数据）
**基准提交：** `main @ ce508cf`（Phase 4D-1 合并点，CI 绿）
**分支：** `phase4d2`（从 `main` 新建，未合并）
**日期：** 2026-08-10

---

## 1. 目标与范围

本阶段是对 §2 已冻结决策的工程落地：**信息架构重构 + 合成式主视觉**。目标是把首屏常驻区块从 9 个压到 ≤5，消除首屏空态文案，把装备+背包+地图的屏占比显著降下来，并把可见可交互控件数量显著减少——**不改变任何战斗公式、平衡数值、核心数据或存档 schema**。

| 冻结决策 | 落地方式 |
|----------|----------|
| 5 个常驻区块 | StatusBar / ZoneRail / MapIndicator（小型常驻）/ CraftGoalBar / PlanningZone+ActionBar |
| 按需抽拉抽屉 | MapDrawer、PlanningDrawer 在所有视口均为 off-canvas 抽屉 |
| 上下文触发区块 | `.presence`（同区域）等仅在世界状态满足时出现的区块，放进预留的 `.stage-content` 滚动区，条件渲染 `presence !== 'none'` |
| 合成式主视觉 | `VisualImage` 在 Zone 背景上叠加角色肖像；`resolveCharacterVisualState` → `portrait` / `injured` / `combat` |
| 小型地图指示器 | 桌面端用常驻小型 ZoneRail 取代常驻大地图面板；详情进 MapDrawer |

**未改动：** `src/core/**` 战斗公式、命中/伤害/掉落/配方、RNG、世界事件时序、禁区规则、NPC 决策、`src/data/**`、美术资产 / Manifest、`save` schema、GAME_VERSION。

---

## 2. 关键设计规则（§4）

1. **常驻 = 无条件渲染的结构外壳**；**上下文 = 内容驱动**（仅在世界状态满足时出现）。§7 口径据此拆分——基线把 `.presence`（同区域）算作常驻；4D-2 把它改为条件渲染，因此必须按版本分类，否则基线/4D-2 不可比。
2. 抽屉触发按钮为 `position: fixed` 浮层，不在文档流中抢占 ActionBar 命中区。
3. 主视觉为纯呈现层，复用既有 `VisualImage` 官方→打包 SVG→emoji 回退链路，不新增任何美术资产。
4. 所有新增/修改的 CSS 类独立命名（`.zone-rail` / `.map-indicator` / `.planning-drawer-trigger` 等），共享 `drawer-backdrop` / `drawer-header` 仅做视觉统一。

---

## 3. 代码变更

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/ui/screens/GameScreen.tsx` | 改 | 接入 ZoneRail / MapIndicator / 条件渲染 `.presence`；`.presence` 包在 `{presence !== 'none' && (…)}` |
| `src/ui/components/ZoneIndicator.tsx` | 改/新 | 常驻小型地图指示器 + 桌面 ZoneRail |
| `src/ui/components/MapDrawer.tsx` | 新 | 按需地图抽屉（全视口） |
| `src/ui/components/PlanningDrawer.tsx` | 改 | 规划抽屉独立类名，抽屉内 tab 切换 |
| `src/ui/useDrawerFocus.ts` | 新 | `useDrawerFocus(open, onClose, externalTriggerRef?)` → `{triggerRef, closeRef, panelRef}`，集中管理焦点环/返回 |
| `src/ui/styles.css` | 改 | 新增 `.zone-rail` / `.map-indicator` / 抽屉样式；**修复 `.planning-drawer-trigger:focus-visible` 的 `position` 回归**（见 §6） |
| `tests/browser/infoArchitectureMetrics.ts` | 改 | 版本感知的 §7 度量模块（`RESIDENT_CANDIDATES` / `CONTEXTUAL_CANDIDATES` / `isPhase4d2 = Boolean(document.querySelector('.zone-rail'))`） |
| `tests/browser/scrollHelpers.ts` | 改 | `scrollEncounterIntoView` / `scrollEncounterActionsIntoView` 自包含（向上找首个真正可滚动祖先，兼容 `.stage`→`.stage-content` 的滚动容器迁移） |
| `tests/browser/phase4d2-info-architecture-evidence.spec.ts` | 改 | 基线模式只采集不断言；4D-2 模式断言硬约束；新增 actionbarReachable 命中测试回归守卫 |
| `tests/phase4d2InfoArchitecture.test.tsx` | 改 | 断言共享 focus-visible 规则不含 `.planning-drawer-trigger`、专用规则重申 `position: fixed`、`.presence` 仍为条件区块、度量模块含分类常量 |
| 4B-2 / 4B-3 / 4B-5 / 4B-6 / 4C-3 浏览器证据 spec | 改 | 接入 `scrollHelpers`，修复旧硬编码 `.board`/`.stage` 滚动导致的可见性误判 |

---

## 4. §5 约束满足情况

| 约束 | 验证方式 | 结果 |
|------|----------|------|
| 信息边界 | 审计 `state.events` 全部 UI 读取路径 | ✅ 全部经玩家作用域过滤：`latestPlayerHazardFeedback(state.events, playerId, time)`、`latestInstantWorldEvent(events)`（仅 `WORLD_EVENT`）、`latestPlayerSearchFeedback`（按 `event.actorId === state.playerId` 过滤）、`hasCraftedOutput`（`event.actorId === player.id`）、`visibleEventsForPlayer(state.events, playerId)`（EventLog / ResultScreen）。无未过滤 `state.events` 泄漏到玩家 UI；DebugPanel 读取为 debug-only |
| 无障碍（a11y） | 焦点环回归守卫 + 命中测试 | ✅ 修复后共享 `:focus-visible { position: relative }` 不再破坏固定定位浮层（见 §6） |
| 无横向溢出 | `scrollWidth === viewport`（390px） | ✅ baseline 与 4D-2 桌面/手机均无横向溢出 |
| `[title]=0` | `titleAttributeCount` 度量 | ✅ baseline 与 4D-2 均为 0 |
| 美术字节一致性 | `art:validate` / `art:audit:phase4a` | ✅ 资产树、Manifest/provenance、candidateHygiene、runtimeUsage 全 PASS，无新增/修改资产 |

---

## 5. §7 验收度量（基线 vs 4D-2，实测）

度量由自包含模块 `tests/browser/infoArchitectureMetrics.ts` 经 `page.evaluate` 在真实生产预览上跑出，基线与 4D-2 用同一口径（版本感知分类），可直接比较。

| 度量 | 基线 桌面 | 4D-2 桌面 | 基线 手机 | 4D-2 手机 | 目标 | 达成 |
|------|-----------|-----------|-----------|-----------|------|------|
| 常驻区块数 | 9 | **5** | 6 | **5** | ≤5 | ✅ |
| 首屏空态文案数 | 7 | **0** | 1 | **0** | →0 | ✅ |
| 装备+背包+地图 屏占比 | 18.5% | **6.3%** | 27.7% | **5.1%** | 显著下降 | ✅ |
| 可见可交互控件数 | 22 | **11** | 7 | 13 | 显著下降 | ✅（桌面）/ ⚠手机见注） |

> 注：手机 4D-2 可见控件为 13，高于基线的 7，原因是基线手机把规划/历史/地图全部折叠隐藏（baseline 手机只露出少量 P0 控件），而 4D-2 手机通过抽屉显式暴露了搜索/合成/规划/地图等可达入口——其“可见控件”统计包含了抽屉关闭态下仍计入的可聚焦触发按钮。首屏常驻区块仍为 5（达成），抽屉为按需、不占首屏。手机视图下真正的首屏噪音（空态、常驻面板）已清零。桌面控件 22→11 为硬下降。

**常驻区块明细（4D-2 桌面）：** 状态栏 / 地图指示器（4D-2 常驻小型）/ 合成目标条 / 主视觉 / 行动栏 = 5。
**首屏空态清零（4D-2）：** 基线桌面的 7 条空态文案（情报空、同区域空、地面掉落空、空槽×2、暂无可装备候选×2）在 4D-2 中不再作为首屏常驻空态出现——情报/同区域/地面掉落改为上下文触发区块，装备槽空态随抽屉收起。

---

## 6. 真实缺陷修复（a11y / 可用性回归）

**问题：** 4D-2 之前，Escape 关闭规划抽屉后焦点返回 `.planning-drawer-trigger`（浮动触发按钮）。该按钮命中了共享规则 `:focus-visible { position: relative; z-index: 2; }`，把本是 `position: fixed` 的浮层拖入文档流，变成一条横跨视口的满宽条（`left:-10; right:380; z-index:2`），覆盖 ActionBar 并拦截 搜索/休息 点击——键盘用户在关闭抽屉后无法点击搜索/休息。这是一个会真实阻断键盘用户的缺陷。

**验证：** 临时探针脚本确认触发按钮在 focus-visible 时变为 `left:-10, right:380, z-index:2`，且搜索按钮的命中测试点落入触发按钮。

**修复（`src/ui/styles.css`）：** 从共享规则中移除 `.planning-drawer-trigger:focus-visible`，新增专用规则保持固定定位：
```css
.planning-drawer-trigger:focus-visible {
  position: fixed;
  z-index: 95;
  border-color: #f4d37d;
}
```
**回归守卫：** 单元测试断言共享 focus-visible 规则不含 `.planning-drawer-trigger` 且专用规则重申 `position: fixed`；浏览器证据 spec 在关闭规划抽屉后新增 `actionbarReachable` 命中测试，断言所有 `.actionbar-actions button` 中心命中各自按钮而非触发按钮。探针脚本已删除。

---

## 7. §8 门禁结果

| 门禁 | 命令 | 结果 |
|------|------|------|
| 干净安装 | `rm -rf node_modules && npm ci` | ✅ 126 包，0 漏洞 |
| 类型检查 | `npm run typecheck` | ✅ 通过 |
| 单元测试 | `npm test` | ✅ 1328 / 1328 PASS（未下降） |
| 生产构建 | `npm run build` | ✅ 成功 |
| 存档审计 | `npm run audit:save` | ✅ PASS |
| 依赖审计 | `npm run audit:deps` | ✅ PASS |
| 美术离线体检 | `npm run art:doctor --offline` | ✅ PASS |
| 美术 Manifest 校验 | `npm run art:validate` | ✅ PASS（已发布 Manifest） |
| 美术 Phase4A 审计 | `npm run art:audit:phase4a` | ✅ `passed: true`（manifest / provenance / candidateHygiene / runtimeUsage 全 true） |
| 浏览器资产边界扫描 | `npm run art:security:browser` | ✅ PASS（194 文件，0 泄露） |
| 仓库密钥扫描 | `npm run art:security:repo` | ✅ PASS（803 跟踪文件，0 密钥） |
| 平衡模拟（回归） | `npm run simulate --games 500 --seed-prefix PHASE4D2 --regression --output reports/phase4d2-balance.json` | ✅ PASS（请求 500 = 实际 500，20 格全 PASS，引擎健康 PASS，角色平衡仅观察） |
| 生产依赖审计 | `npm audit --omit=dev` | ✅ 0 vulnerabilities |

**浏览器证据套件：** 17/17 绿灯，桌面（1280×720）与手机（390×844）首屏 / 地图抽屉 / 规划抽屉 / 搜索后 / 遭遇态均 0 console/page error（见 `output/phase4d2-browser/{phase4d2,baseline}/runtime-errors.json`）。

---

## 8. §9 证据（浏览器）

4D-2 证据（`output/phase4d2-browser/phase4d2/`）：
- `desktop-01-first-screen.png/.json`、`desktop-02-map-open`、`desktop-03-planning-open`、`desktop-04-after-search`、`desktop-05-encounter`
- `phone-portrait-01-first-screen`、`phone-portrait-02-map-open`、`phone-portrait-03-planning-open`、`phone-portrait-04-after-search`
- `summary.json`（§7 度量）、`runtime-errors.json`（0/0）

基线证据（`output/phase4d2-browser/baseline/`，仅采集用于对照）：
- `desktop-01-first-screen`、`desktop-04-after-search`、`desktop-05-encounter`
- `phone-portrait-01-first-screen`、`phone-portrait-04-after-search`
- `summary.json`、`runtime-errors.json`（0/0）

---

## 9. §10 交付物

- ✅ 生产代码 + 测试（见 §3 文件清单）
- ✅ `PHASE4D2_REPORT.md`（本文件）
- ✅ `reports/phase4d2-balance.json` + `reports/phase4d2-balance.md` + 浏览器证据（`output/phase4d2-browser/`）
- ✅ `progress.md` 已更新（回填缺失的 4D-1 条目 + 新增 4D-2 条目）

---

## 10. 后续建议

- 真实设备 / 屏幕阅读器 / 长时舒适度的验证仍标记为 `HUMAN-PLAYTEST-NEEDED`；本阶段的自动化证据不替代人工体验评审。
- 命中测试回归守卫已覆盖「关闭抽屉后 ActionBar 可达」，建议人工补测真实键盘 Tab 顺序与屏幕阅读器播报。
- 若后续要增强合成目标条（如点击缺口直接跳转对应搜索区域），应在现有 `.craft-goal-bar` 单行语义上叠加，不回归到多面板常驻布局。
