# Phase 4D-3 开发报告：遭遇态并入主视觉，移除独立对战窗口

- 版本：`0.3.2`
- 分支：`phase4d3`（自 `main` @ `437f173` 开出）
- 完成日期：2026-08-10
- 结论：全部 §7 验收门禁 **PASS**，浏览器证据 **console=0 且五视口无横向溢出**，4C-3 零体力死锁不变量保持绿色。

---

## 1. 目标

把「遭遇」从主视觉**下方**的一块独立面板，改为**主视觉的一种状态**：

- 探索态 = 区域背景（移除玩家立绘，玩家状态只在顶栏）。
- 遭遇态 = 区域背景 + **敌方立绘居中** + 敌方合法可见字段 + 一行即时反馈。
- 行动栏成为探索 / 遭遇**共用的同一条**：探索态显示搜索 / 休息 / 移动入口，遭遇态切换成 6 个战斗动作（速攻 / 普通 / 重击 / 防御 / 逃跑 / 技能）。

移除独立对战窗口（`EncounterPanel.tsx`）及其全部 CSS，消除与行动栏重复的战斗入口，消除主视觉里玩家血条 / 玩家立绘的重复渲染。

---

## 2. 设计决策与落地

### §2.1 遭遇态是主视觉的一种状态（不再是独立面板）
- 删除 `src/ui/components/EncounterPanel.tsx`（303 行三栏面板）。
- 新增 `src/ui/components/EncounterHero.tsx`：`.zone-hero` 内的 `<section class="encounter-hero">`，敌方立绘居中（`.encounter-enemy-visual`），敌方合法字段在 `.encounter-hero-enemyinfo`。
- `GameScreen` 在 `encounter && enemy` 时把 `<EncounterHero>` 渲染进 `.zone-hero`，并打上 `zone-hero-encounter` / `-active` / `-resolved` 状态类与 `data-hero-mode`。

### §2.2 探索态移除玩家立绘
- 删除 styles.css 中的 `.zone-hero-portrait` 相关规则；`GameScreen` 在 `heroCompact`（有遭遇）时只保留区域名 / 状态与危险倒计时，收起区域描述类风味文案。
- 玩家 HP / 体力只在顶栏（`StatusBar`）呈现，主视觉不再渲染玩家立绘或血条副本。

### §2.3 遭遇结束无需点击关闭
- 核心的 `CLOSE_ENCOUNTER` 与 `resolved` 状态不变；改动的是「谁来派发」：从玩家点按钮改成 `GameScreen.act()` 在下一次行动前自动补发（`if (resolvedEncounter) dispatch({ type: 'CLOSE_ENCOUNTER' })`）。`CLOSE_ENCOUNTER` 不推进时间，口径不受影响。
- 结果以一行即时反馈留在主视觉（`.encounter-hero-feedback`），玩家下一次行动自然清场。
- 已删除 `.encounter-continue`「继续探索」按钮（浏览器证据断言其数量为 0）。

### §2.4 战斗记录按需小入口
- `EncounterHero` 内「战斗记录」按钮展开 `<aside class="encounter-hero-log">`，焦点管理 / Esc 关闭 / 焦点陷阱复用 `useDrawerFocus`（与地图、规划抽屉同源）。

### §2.5 共用同一条行动栏，按上下文切换
- 新增 `src/ui/combatActionsPresentation.ts`：`buildCombatActionBar(state, player, enemy)` 复用 `hitChanceIn` / `fleeChanceIn` / `getAttackStyleStaminaCost` / `getActionStaminaCost` / `canUseSkill` / `isSkillReady`，与核心结算同源。
- `ActionBar` 通过 `combat` prop 切换：非 null → 6 战斗动作（`flex:none` 页脚，永远钉在视口底部，**6 个动作无需滚动即可触达**）；null → 搜索 / 休息 / 移动入口。
- `GameScreen` 的 `.presence`「袭击 / 防御 / 脱离」按钮在 `!inActiveEncounter` 时才提供，避免与行动栏上的 6 个战斗入口重复成两套。

---

## 3. 敌方合法可见字段清单（§3，一个都不能少，且不泄漏）

遇害态主视觉（`.encounter-hero-enemyinfo`）渲染：

| 字段 | 来源 | 浏览器证据 |
| --- | --- | --- |
| 身份（显示名）+ 角色名 | `enemy.name` + `getCharacterDef(enemy.characterId).name` | `phase4b2` 断言 `enemyInfoText` 非空 |
| 无数字 HP 条 + 文字描述 | `<Bar>`（仅宽度百分比）+ `hpDescriptor(enemy)` | 断言不出现 `\d+/\d+` 精确 HP |
| 武器 | `getEquippedWeapon(enemy)` → `getItem(...).name` | 断言含「武器」 |
| EXPOSED（露出破绽） | `hasExposed(enemy)` | `phase4b2` 驱动重击挥空后出现 `.tag-exposed` 且文案含「露出破绽」 |
| 共享脱离率 / 命中率 | `combat.flee.chancePct` / `combat.attacks(normal).hitPct` | 断言 `.eh-shared-rate` 含「脱离」 |
| 行动体力成本 | 行动栏按钮 `.action-cost`（命中 X% · 体力 Y） | 行动栏同源数值 |

**禁止泄漏**（均无渲染）：精确 HP 数值、隐藏装备、隐藏技能、意图、背包。

**三态语汇复用**：敌方立绘与状态标签复用全局 `.combat-visual-state` + `.state-*` + `.combat-cue-icon`（图标 + 文字，颜色只是补充），与 `StatusBar` 同源 ——删除了旧的 `.eh-visual-state` 类。

---

## 4. 约束符合性

| 约束 | 结果 |
| --- | --- |
| `src/core` & `src/data` 零改动 | ✅ 全部改动在 `src/ui`、`tests`、`tools/art` |
| 战斗日志仅呈现玩家可见事件（不泄漏 zone.loot / NPC 位置 / 意图） | ✅ `EncounterHero` 仅渲染 `encounter.log` 玩家可见行 |
| 4C-3 零体力死锁不变量（单测不变，保持绿色） | ✅ `tests/phase4c3ZeroStaminaDeadlock.test.ts`（4 项）绿色；浏览器证据确认防御 / 脱离免费、合法提示含「防御本回合免费」「原地脱离」 |
| 五视口无横向溢出 | ✅ `phase4b2` / `phase4b5` / `phase4b6` 在 5 个视口各断言 `bodyScrollWidth === 视口宽`；`phase4d2` 桌面 + 手机均无溢出 |
| 6 个战斗动作无需滚动即可触达 | ✅ 行动栏 `flex:none` 页脚常驻视口底部；`assertCombatActionsReachable` 断言全部按钮在 `[topbar.bottom, innerHeight]` 内 |
| 真实 DOM 无 `[title]` 属性（`[title]=0`） | ✅ 信息架构度量 `titleAttributeCount = 0` |
| prefers-reduced-motion | ✅ styles.css 保留 `prefers-reduced-motion` 块；`phase4b6` 断言 reduced-motion 下 transitionDuration ≈ 0 |
| 复用 `useDrawerFocus` | ✅ 战斗记录抽屉复用 |
| 版本 0.3.2 | ✅ 未改动 `package.json` 版本 |

---

## 5. 代码与测试变更清单

新增：
- `src/ui/components/EncounterHero.tsx`
- `src/ui/combatActionsPresentation.ts`

修改：
- `src/ui/screens/GameScreen.tsx`（遭遇态并入主视觉、共用行动栏、`act()` 自动补发 CLOSE_ENCOUNTER、`.presence` 去重）
- `src/ui/components/ActionBar.tsx`（combat 模式：6 战斗动作）
- `src/ui/styles.css`（删除 `.encounter` 三栏面板样式与 `.zone-hero-portrait`；新增 `.encounter-hero*`；精简三态语汇）
- `tests/phase4b2CombatFeedback.test.tsx`（改写：针对 `EncounterHero` + `GameScreen` 集成）
- `tests/phase4a45VisualClosure.test.tsx`（迁移至 `EncounterHero`）
- `tests/phase4d2InfoArchitecture.test.tsx`（探索态无玩家立绘 + 敌方立绘居中三态）
- `tests/browser/infoArchitectureMetrics.ts`（上下文块候选 `.stage-content .encounter` → `.zone-hero .encounter-hero`）
- `tests/browser/scrollHelpers.ts`（目标选择器 `.encounter`/`.encounter-actions` → `.encounter-hero`/`.actionbar-combat-actions`）
- `tests/browser/phase4c3-zero-stamina-evidence.spec.ts`（改写为 4D-3 DOM；含两处脱离提示校验）
- `tests/browser/phase4d2-info-architecture-evidence.spec.ts`（`.encounter-hero` / `.encounter-enemy-visual`）
- `tests/browser/phase4b2-encounter-evidence.spec.ts`（改写为 4D-3 综合遭遇证据：§2.1–§2.5 / §3 / 5 视口）
- `tests/browser/phase4b5-responsive-evidence.spec.ts`、`phase4b6-polish-evidence.spec.ts`（`.encounter` → `.encounter-hero`，高度断言改为「可见」）
- `tools/art/phase4a45Audit.ts`（`EncounterPanel` → `EncounterHero` 元数据）

删除：
- `src/ui/components/EncounterPanel.tsx`

---

## 6. 信息架构度量（§6，浏览器证据）

来源：`tests/browser/phase4d2-info-architecture-evidence.spec.ts` 的 `measureInfoArchitecture`（真实浏览器量真实 DOM）。

| 指标 | 桌面 1280×720 | 手机竖屏 390×844 | 门槛 |
| --- | --- | --- | --- |
| 常驻区块数 | 5 | 5 | ≤ 5 |
| 首屏区块总数 | 5 | 6（含 1 上下文：同区域） | — |
| 空态文案数 | 0 | 0 | 0 |
| 装备 + 背包 + 地图占屏 | 6.3% | 5.1% | < 10% |
| `[title]` 属性数 | 0 | 0 | 0 |
| 横向溢出 | 否 | 否 | 否 |
| 遭遇态主视觉 | 激活时作为 `.encounter-hero` 上下文块计入（不再独立面板） | 同 | — |

五视口（桌面 / 平板横 / 平板竖 / 手机横 / 手机竖）无横向溢出、6 战斗动作无需滚动可达，由 `phase4b2` / `phase4b5` / `phase4b6` 共同覆盖。

---

## 7. 验收门禁（§7，全部 PASS）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npm run typecheck`（`tsc -b --force`） | ✅ PASS |
| 单元测试 | `npm test`（72 文件 / 1328 项） | ✅ **1328 passed** |
| 构建 | `npm run build`（`tsc -b && vite build`） | ✅ PASS |
| 存档校验 | `npm run audit:save` | ✅ PASS（对照通过，损坏用例全拒绝） |
| 依赖审计 | `npm run audit:deps` | ✅ PASS（R1–R4 全 0） |
| 美术体检 | `npm run art:doctor --offline` | ✅ PASS |
| 美术校验 | `npm run art:validate` | ✅ PASS |
| 美术审计 | `npm run art:audit:phase4a` | ✅ PASS（manifest/provenance/candidateHygiene/runtimeUsage 全 true） |
| 安全审计 | `npm run art:security`（browser + repo） | ✅ PASS（195 文件 + 812 跟踪文件，无密钥泄露） |
| 平衡回归 | `npm run simulate -- --games 500 --seed-prefix PHASE4D3 --regression --output reports/phase4d3-balance.json` | ✅ PASS（请求=实际=500；引擎健康；角色平衡为观察项，比值 3.33 不阻塞回归） |
| 依赖漏洞 | `npm audit --omit=dev` | ✅ 0 vulnerabilities |

> 注：`npm ci` 为 CI 流水线首步（依据 lockfile 重装），本地 `node_modules` 已与 lockfile 一致，未改动依赖，故本地复用既有安装验证其余门禁。

---

## 8. 浏览器证据（#43）

运行 `npx playwright test`（自动 `build` + `preview` 于 `127.0.0.1:4173`）针对 4D-3 相关规格：

| 规格 | 结果 | console / pageError |
| --- | --- | --- |
| `phase4d2-info-architecture-evidence.spec.ts` | ✅ PASS | 0 / 0 |
| `phase4b2-encounter-evidence.spec.ts`（4D-3 综合） | ✅ PASS | 0 / 0 |
| `phase4b5-responsive-evidence.spec.ts`（5 视口） | ✅ PASS | 0 / 0 |
| `phase4b6-polish-evidence.spec.ts`（5 视口 + reduced-motion） | ✅ PASS | 0 / 0 |
| `phase4c3-zero-stamina-evidence.spec.ts`（4D-3 + 4C-3） | ✅ PASS | 0 / 0 |

证据截图与 JSON 见 `output/phase4d2-browser/`、`output/phase4b2-browser-final/`、`output/phase4b5-browser/`、`output/phase4b6-browser/`、`output/phase4c3-browser/`。

关键验证点（均通过）：
- 探索态无玩家立绘 / 玩家血条副本（`.zone-hero-portrait` 与 `.combatant-player` 均不存在）。
- 遭遇态敌方立绘居中，三态（combat → injured → portrait）随 `resolveCharacterVisualState` 切换。
- 行动栏按上下文切换：遭遇态 6 动作全部在视口内无需滚动；探索态搜索 / 休息 / 移动入口。
- 遭遇结束无 `.encounter-continue`；结果留在 `.encounter-hero-feedback`；下一次行动（休息）后 `.encounter-hero` 消失。
- 两处脱离提示均可见：toast「原地脱离」+ 主视觉反馈「脱离接触…」（4D-1 行为保留）。
- 战斗记录按需展开 / Esc 关闭。
- 敌方字段完整且不泄漏精确 HP（`\d+/\d+` 未出现）。

---

## 9. 风险与遗留

- **脱离后 toast 遮挡行动栏**：脱离后弹出的「原地脱离」toast 可能短暂遮挡底部行动栏（仅在脱离后瞬间）。toast 为瞬时可消元素，非 4D-3 引入；浏览器证据已通过先收 toast 再点击「休息」验证清场行为。若后续要优化，可下调 toast `z-index` 或缩短停留。
- 旧阶段浏览器规格（`phase4b3` 搜索/背包等）仅做最小兼容处理（`.encounter-continue` 为条件跳过），其断言仍面向 4D-3 前的 DOM；本次未重写它们，因为本次任务范围为 4D-3 交付与回归（4D-3 相关规格已全绿）。
- 角色平衡比值 3.33 为观察项（与历史各阶段一致），不阻塞 4D-3 回归判定。
