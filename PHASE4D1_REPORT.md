# Phase 4D-1 实施报告

**版本：** v0.3.2 → v0.3.2-phase4d1  
**基准提交：** `21aa0b7`（main，CI 绿）  
**分支状态：** 从 `main` 新建，未合并  
**日期：** 2026-08-10

---

## 1. 目标与范围

本阶段只处理三件有明确验收标准的事，**不**做界面重构（布局重构属 Phase 4D-2）。

| 编号 | 事项 | 范围限制 |
|------|------|----------|
| A | 逃跑成功后的遭遇终止态一致性 | 只改终止态呈现；不改逃跑成功率、成本、追击 |
| B | 战斗中四类动作必须写入日志 | 只写玩家侧动作；不泄露敌方 HP / 物品 / 技能 / 意图 |
| C | 合成目标引导提权 | 只在中栏 stage 顶部做 sticky 单行增补；不动 ActionBar 偏移、不遮挡 P0 |

**核心解冻范围：** 仅允许改动 `src/core/commandHandlers.ts` 与遭遇生命周期 / 日志写入相关的最少代码。以下项目**未**改动：

- 战斗公式、命中率、伤害、逃跑概率、体力成本、掉落、配方
- 世界事件、禁区时序、RNG、存档 schema、NPC 决策逻辑
- 五视口基线 4B-5 布局

---

## 2. 关键决策（会话内已确认）

1. **敌方日志粒度 — 最保守方案**
   - 仅玩家四类动作（GUARD / USE_SKILL / USE_ITEM / EQUIP）+ NPC 可见脱离（`CHARACTER_ESCAPED`）入遭遇日志。
   - 敌方 guard / skill / useItem **一律不写**，不开新的可见性接缝。

2. **合成目标条落点 — 中栏 sticky 顶栏**
   - 作为 `.stage` 滚动容器内 `position: sticky` 的一行，纯增补。
   - 不动 ActionBar 偏移，五视口零风险。

---

## 3. 代码变更

### 3.1 缺陷 A：逃跑成功后走 resolved 结算态

**文件：** `src/core/commandHandlers.ts`

旧行为：

```ts
if (res.escaped) {
  state.encounter = null; // 面板凭空消失
  return { ok: true, message: res.message };
}
```

新行为：

- 原地脱离（`toZoneId === null`）：`resolved = true`，结算文案明确告知「敌方仍在本区域，可能再次交火」。
- 转移脱离（`toZoneId !== null`）：`resolved = true`，文案告知「已经离开该区域，当前位于 X」。
- 无正式遭遇时主动脱离：同样建立结算态，避免静默行为。

逻辑入口：

```ts
state.encounter.log.push(res.message);
state.encounter.log.push(
  res.toZoneId
    ? `你已经离开该区域，脱离接触，当前位于${getZoneDef(res.toZoneId).name}。`
    : `你已脱离接触，但 ${enemy.name} 仍在本区域，可能再次交火。`,
);
state.encounter.resolved = true;
```

### 3.2 缺陷 B：四类动作写遭遇日志

**文件：** `src/core/commandHandlers.ts`

新增辅助函数：

```ts
export function logEncounterAction(state: GameState, line: string): void {
  if (!state.encounter) return;
  state.encounter.log.push(line);
}
```

- `handleGuard`：成功时写入 `res.message`。
- `handleUseSkill`：成功时写入 `res.message`。
- `handleUseItem`（新增）：从 gameEngine switch 收编到此。取消费前物品名，成功后写入「你使用了 X（生命 +Y / 体力 +Z）。」。
- `handleEquip`（新增）：从 gameEngine switch 收编到此。成功后 `pushEvent(ITEM_EQUIPPED)` + 写入「你换上了 X。」。

**文件：** `src/core/gameEngine.ts`

- 删除 import `useConsumable`、`equipItem`、`findStack`。
- 新增 import `handleEquip`、`handleUseItem` from `'./commandHandlers'`。
- `USE_ITEM` / `EQUIP` cases 改调 handler。

### 3.3 改进 C：合成目标引导提权

**文件：** `src/ui/craftPathPresentation.ts`

新增：

- `CraftGoalBannerGap` / `CraftGoalBanner` 类型
- `bannerFromPath`：从 `craftPathSummary` 取缺口材料、取来源区域、按 `getZoneDistance` 排序
- `craftGoalBanner(state, player)`：优先玩家手动目标，否则返回系统建议

信息边界：只读玩家背包 + 静态配方 + 区域公开池（`basePool` / `rarePool`），不读 `zone.loot`。

**文件：** `src/ui/components/CraftGoalBar.tsx`（新建）

- `CraftGoalBar({ banner, onOpenCraft })`
- 属性：`data-craft-goal-bar`、`data-craft-goal-recipe` 便于测试
- 渲染：icon、kind label、目标名、下一步、缺口、去哪找、合成面板按钮

**文件：** `src/ui/screens/GameScreen.tsx`

- 接入 `craftGoalBanner` 与 `CraftGoalBar`
- 在 `.stage` 内、`.zone-hero` 前插入：

```tsx
{!inActiveEncounter && !pending && (
  <CraftGoalBar
    banner={goalBanner}
    onOpenCraft={() => { setTab('craft'); setPlanningOpen(true); }}
  />
)}
```

遭遇中 / 待处理拾取时收起，让位 P0。

**文件：** `src/ui/styles.css`

新增 `.craft-goal-bar` 及其子元素样式：

- `position: sticky; top: 0; z-index: 3`
- 在 `.stage` 内吸顶，不影响 ActionBar 与移动端硬编码偏移
- 包含桌面端与 `@media (max-width: 760px)` 移动端适配

### 3.4 静态资源处理

**文件：** `index.html`

为消除浏览器自动请求 `/favicon.ico` 导致的 404 控制台错误，添加空 data-URI 图标：

```html
<link rel="icon" href="data:," />
```

该改动与游戏逻辑 / 平衡无关，仅用于满足「console errors = 0」的浏览器门禁。

---

## 4. 测试

### 4.1 新增测试文件

**`tests/phase4d1EncounterResolutionAndLog.test.ts`**（15 用例）

| 分组 | 用例数 | 覆盖点 |
|------|--------|--------|
| 缺陷 A | 6 | 原地/转移脱离 resolved 态、文案、CLOSE_ENCOUNTER、逃跑失败不 resolved、无遭遇主动脱离 |
| 缺陷 B | 5 | guard / skill / useItem / equip 写入日志、非遭遇态不污染 |
| 信息边界 | 2 | 敌方动作不写日志、日志不含敌方 HP / 物品 / 技能 / 意图 |
| 4C-3 不变量 | 2 | 零体力原地脱离成功、脱离动作本身不触发追击 / 不伤血 |

**4C-3 不变量细节**

- `FLEE` 是 `advancesTime` 命令，`executeCommand` 会跑完整 `advanceTime`，期间的世界事件 / 终局衰竭可能按时间推进掉血。
- 测试分两段验证：
  1. 用 `executeActorCommand`（不推进时间）直接验证 `fleeActor` 本身不修改玩家 HP。
  2. 端到端用同种子 GUARD 控制组隔离「环境掉血」，确认逃跑本身不额外掉血。

**`tests/phase4b3SearchInventory.test.tsx`**（修复）

- 原信息边界断言把「玻璃」误判为泄露（实际 `glass` 是合法配方材料）。
- 改用 `energy_drink`（不参与任何配方）作为真正的 zone.loot 泄露探测器；若目标条显示「玻璃」则先校验其来自配方缺口，再移除目标条后断言。

### 4.2 全量测试结果

```text
Test Files  71 passed (71)
     Tests  1311 passed (1311)
```

基线 1296 → 当前 1311，新增 15 个测试，**未减少**。

---

## 5. 门禁结果

| 门禁 | 命令 | 结果 |
|------|------|------|
| 类型检查 | `npm run typecheck` | ✓ 通过 |
| 单元测试 | `npx vitest run` | ✓ 1311 / 1311 |
| 生产构建 | `npm run build` | ✓ 成功 |
| 存档审计 | `npm run audit:save` | ✓ PASS |
| 依赖审计 | `npm run audit:deps` | ✓ PASS（0 违例） |
| 美术资源审计 | `npm run art:validate` | ✓ PASS |
| 平衡模拟 | `npm run simulate` | ✓ PASS（1000 局，≥500） |
| 安全审计 | `npm audit` | ✓ 0 vulnerabilities |

### 5.1 浏览器采证

- **URL：** `http://localhost:4173/`
- **视口：** 1280×720（桌面）、390×844（移动）
- **控制台错误：** 0
- **页面错误：** 0
- **CraftGoalBar：** 在两个视口均可见

输出文件：

- `output/evidence-phase4d1/desktop-1280x720.png`
- `output/evidence-phase4d1/mobile-390x844.png`
- `output/evidence-phase4d1/evidence-report.json`

---

## 6. 4C-3 不变量结论

- **零体力出口仍然免费：** 原地脱离不做成功率判定、不触发追击，命令本身不扣玩家 HP。
- **resolved 态是新增信息层：** 逃跑成功不再静默清空 `encounter`，而是给出结算面板与「继续探索」按钮（`CLOSE_ENCOUNTER`）。
- **无死锁 / 无硬上限：** resolved 态下 `legalActions` 提供 `CLOSE_ENCOUNTER`，模拟器 1000 局无 hardLimit 触发。

---

## 7. NPC 原地脱离 syncEncounter 行为确认

- NPC 原地脱离后，敌我双方仍在**同一区域**。
- `syncEncounter` 只在「玩家死亡 / 敌方死亡 / 敌方离开区域」时设置 `resolved = true`。
- 因此 NPC 原地脱离**不会**被 `syncEncounter` 自动结束遭遇，也不会被自动置位 resolved。
- 这是一个符合现有状态机语义的行为：敌我同区、都存活时，遭遇保持 unresolved，双方仍有继续交火的可能。
- 本次改动未改变 `syncEncounter`；玩家侧的逃跑路径已统一走 `resolved = true` 结算，不会导致软锁。

---

## 8. 交付物

- `PHASE4D1_REPORT.md`（本文件）
- `reports/phase4d1-balance.json`
- `output/evidence-phase4d1/desktop-1280x720.png`
- `output/evidence-phase4d1/mobile-390x844.png`
- `output/evidence-phase4d1/evidence-report.json`

---

## 9. 变更文件清单

```
index.html
src/core/commandHandlers.ts
src/core/gameEngine.ts
src/ui/craftPathPresentation.ts
src/ui/screens/GameScreen.tsx
src/ui/styles.css
src/ui/components/CraftGoalBar.tsx（新建）
tests/phase4d1EncounterResolutionAndLog.test.ts（新建）
tests/phase4b3SearchInventory.test.tsx（修复信息边界断言）
```

---

## 10. 后续建议

- Phase 4D-2 如需进一步美化合成目标条或做布局重构，应在此基础上进行，保留当前 `position: sticky` 单行语义。
- 当前 `CraftGoalBar` 仅显示目标 / 建议与缺口；若后续需要点击缺口直接跳转对应搜索区域，可在 4D-2 作为增强交互加入。
