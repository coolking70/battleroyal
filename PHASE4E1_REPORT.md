# Phase 4E-1 交付报告：击杀战报、可合成提示与状态槽快捷使用

> 分支 `phase4e1`，基线 `main @ 7c97461`（v0.3.2，CI green）。
> 核心解冻范围：仅 `src/core/vitals.ts`（缺陷 A 战报写入）；B/C 全部在 `src/ui`。
> `src/core/**`（vitals.ts 解冻除外）与 `src/data/**` 全程冻结，未触碰。

---

## 1. 三项实现

### 1.1 缺陷 A：击杀写进遭遇战报（`src/core/vitals.ts`）

**问题**：`killCharacter` 从不向 `encounter.log` 写入死亡信息，导致 4D-3
`EncounterHero`「战斗记录」能看到每一击的伤害明细，却看不到最后一击的击杀结果。

**修法**（唯一核心改动，+15 行 / -4 行）：在 `killCharacter` 内、`pushEvent`
之前，构造 `deathLine` 并条件性地写入当前遭遇的 `encounter.log`。

- 仅当 `state.encounter` 存在且死者是本次遭遇的参与方（`enemyId === victim.id`
  或 `victim.id === playerId`）时写入——其他区域 NPC 互杀不计入本次战报。
- 死因分两种：
  - 玩家/NPC 击杀 → `「{死者} 被 {击杀者} 击杀（{区域}）。」`
  - 环境死（`killerId === null`，如禁区侵蚀）→ `「{死者} 在{区域}死亡（{cause}）。」`
- **不改变**死亡结算、掉落、`resolved` 时机、事件流内容；仅复用已有的
  `deathLine` 字符串传给 `pushEvent`（消除重复构造）。

### 1.2 改进 B：可合成提示与一键合成（`src/ui/craftableHint.ts` + `CraftableHint.tsx`）

**触发条件**（纯函数 `detectCraftableHint`）：
1. 某配方从上一帧的不可合成 → 当前帧可合成（`craftable` 翻转）；
2. 且同一帧背包获得了新物品（`inventory` 条目数增加）。
3. 首帧（`prevCraftableIds === null`）不触发——避免开局刷屏。

**优先级**：若当前合成目标（`goalRecipeId`）命中则优先提示；否则取产出物品
`value` 最高的新可合成配方。

**呈现**（`CraftableHint.tsx`）：复用 4B-3 搜索结果卡片范式
（`aside.craftable-hint`），含图标 + 名称 + 「可合成」meta + 「合成」按钮
（`data-craftable-hint-craft`）+ 「忽略」按钮（`data-craftable-hint-dismiss`）。
- **无阻塞模态**：卡片是 inline `aside`，渲染在 stage-content 上下文区域。
- **非常驻占位**：当配方不再可合成、进入遭遇、或有待处理动作时自动隐藏。
- **走既有命令通道**：点击「合成」直接 `dispatch({ type: 'CRAFT', recipeId })`，
  与 CraftPanel 完全相同的通道，无新命令类型。

### 1.3 改进 C：状态槽快捷使用（`src/ui/quickRestore.ts` + `QuickRestoreMenu.tsx` + `Bar.tsx` + `StatusBar.tsx`）

**§3 规则映射**（`decideQuickRestore` 纯函数）：

| 规则 | 实现 |
|------|------|
| §3.1 候选集 | `quickRestoreCandidates`：按物品种类聚合，取点击槽恢复量 > 0 的物品（HP→`healHp>0`；体力→`healStamina>0`） |
| §3.2 自动使用 | 候选**恰好一种**且其在点击槽的恢复量 ≤ 当前空缺 → `mode:'auto'`，直接 `onUseItem(uid)`，不弹窗 |
| §3.3 选择窗 | 候选为多种 / 唯一候选会溢出 / 候选为空 → `mode:'choose'`，弹出小型选择窗 |
| §3.4 双效物品 | 自动使用**仅按点击槽的恢复量**判定（草药点 HP 时只看 `healHp=10`，不因体力溢出而排除）；选择窗中双效物品**同时显示两项效果**（`生命 +10` + `体力 +10`） |

> **§3.4 分歧判定**：规格要求「若认为双效物品应排除出自动使用，须 STOP 并询问」。
> 本实现**未排除**——双效物品的自动使用仅由点击槽恢复量决定，符合规格默认语义，
> 无需停止询问。

**Bar 交互化**：`Bar` 组件新增可选 `onActivate` / `activateLabel` /
`buttonRef`。当传入 `onActivate` 时渲染 `<button class="bar bar-button">`
（`aria-label` + `:focus-visible` 3px 轮廓），键盘可达。

**QuickRestoreMenu**：
- `role="dialog"` 小型浮层，锚定在触发槽下方（`getBoundingClientRect` 定位），
  **无全屏遮罩**——通过 `document.pointerdown` 监听在「点击浮层与触发器之外」
  时关闭，P0 生存信息与战斗动作始终可点。
- `useDrawerFocus(open, onClose, triggerRef)`：Esc 关闭 + 焦点陷阱 + 卸载时
  焦点还回触发槽。
- 空候选 → `.quick-restore-empty` 明确说明「没有可恢复{槽}的道具」。
- 满槽使用 → `.quick-restore-note` 提示「{槽}已满，使用会浪费」。
- 走既有 `USE_ITEM` 命令（`onUseItem` → `dispatch({ type:'USE_ITEM', uid })`）。

---

## 2. vitals.ts 逐行改动说明

```diff
   const killerName = killerId ? state.characters[killerId]?.name ?? '未知' : null;
+  const zoneName = getZoneDef(victim.currentZoneId).name;
+  const deathLine = killerName
+    ? `${victim.name} 被 ${killerName} 击杀（${zoneName}）。`
+    : `${victim.name} 在${zoneName}死亡（${cause}）。`;
```
- 提取 `zoneName` 避免重复调用 `getZoneDef`。
- 构造 `deathLine` 供战报与事件流共用，消除原内联三元表达式的重复。

```diff
+  if (
+    state.encounter &&
+    (state.encounter.enemyId === victim.id || victim.id === state.playerId)
+  ) {
+    state.encounter.log.push(deathLine);
+  }
```
- **唯一新增副作用**：向当前遭遇的 `log` 数组 push 一条死亡战报。
- 守卫条件确保**仅本次遭遇的参与方死亡**才写入——其他区域 NPC 互杀不会污染
  玩家看到的战报（信息边界）。
- `state.encounter` 可能不存在（非遭遇期间死亡），此时跳过。

```diff
   pushEvent(state, {
     type: 'CHARACTER_DIED',
     ...
-    message: killerName
-      ? `${victim.name} 被 ${killerName} 击杀（${getZoneDef(victim.currentZoneId).name}）。`
-      : `${victim.name} 在${getZoneDef(victim.currentZoneId).name}死亡（${cause}）。`,
+    message: deathLine,
```
- 事件流的 `message` 改为复用 `deathLine`，**内容不变**（字符串完全一致），
  只是消除了重复构造。

**未改变**：`state.engagedWithPlayer` 过滤、掉落结算、`resolved` 设置、
事件 `type`/`importance`/`metadata`、HP 归零逻辑。

---

## 3. 约束合规

| 约束 | 合规 |
|------|------|
| §0 仅 vitals.ts 解冻核心 | ✅ B/C 全在 `src/ui`；`src/core/**`（vitals.ts 外）与 `src/data/**` 未触碰 |
| §5 禁止改 `public/assets/**/*.png` | ✅ 未触碰 |
| §5 禁止改 `art/approved-assets.json` | ✅ 未触碰 |
| §5 禁止图像生成 API | ✅ 未使用 |
| §5 禁止新命令类型 | ✅ 仅复用 `USE_ITEM` 与 `CRAFT` |
| §5 禁止新依赖 | ✅ `package.json` 无变化 |
| §5 禁止阻塞模态 | ✅ 可合成提示是 inline `aside`；快捷恢复是无遮罩小浮层 |
| §6 4C-3 零体力不死锁不变量 | ✅ `tests/phase4c3ZeroStaminaDeadlock.test.ts` 断言未改，全绿 |
| §6 五视口无横向溢出 | ✅ 浏览器证据在 1280×720 + 390×844 复查 `scrollWidth ≤ clientWidth` |
| §6 六战斗动作无滚动 | ✅ 未改 ActionBar 布局；快捷恢复浮层不遮挡行动栏 |
| §6 `[title]=0` | ✅ 新增组件均未使用 `title` 属性 |
| §6 `:focus-visible` 覆盖新控件 | ✅ Bar 按钮 + 选择窗项 + 合成提示按钮均有 `:focus-visible` 样式 |
| §6 `prefers-reduced-motion` | ✅ 未新增动画；复用既有样式系统 |
| §6 状态非仅靠颜色 | ✅ 选择窗双效物品有文字标注；Bar 按钮有 `aria-label` |
| §6 信息边界 | ✅ 战报仅写名字+区域+死因；不泄露敌方精确 HP、隐藏装备/技能；仅限本次遭遇参与方 |
| §4 不做 XP/等级/新物品/新配方/新美术 | ✅ 未触碰 |
| §4 不改 4D-2/4D-3 布局 | ✅ 未改信息架构或遭遇主视觉布局 |

---

## 4. 门禁结果（§7）

| 门禁 | 结果 |
|------|------|
| `rm -rf node_modules && npm ci` | ✅ 干净安装成功 |
| `tsc -b --force`（typecheck） | ✅ 0 错误 |
| `npm test`（vitest） | ✅ **78 文件 / 1359 用例全绿**（基线 72/1328，+6 文件 +31 用例） |
| `vite build` | ✅ 构建成功（376 KB JS / 60 KB CSS gzip 后 115 KB / 12.6 KB） |
| `audit:save` | ✅ PASS（74 损坏用例拒绝 74，通过 74） |
| `audit:deps` | ✅ PASS（R1–R4 = 0，扫描 66 文件） |
| `art:doctor --offline` | ✅ PASS（36 tasks） |
| `art:validate` | ✅ PASS（published manifest） |
| `art:audit:phase4a` | ✅ PASS（provenance / hygiene / runtime 全通过） |
| `art:security:browser` | ✅ PASS（199 文件，无密钥泄露） |
| `art:security:repo` | ✅ PASS（817 tracked 文件，无密钥泄露） |
| 500 局模拟 `PHASE4E1` | ✅ PASS（请求 500 = 实际 500，引擎健康，回归门槛达标） |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |

---

## 5. 浏览器证据（§8）

**7 个 Playwright 测试全绿**（1280×720 desktop + 390×844 phone-portrait），
console 错误 = 0，page 错误 = 0。

| 证据 | desktop | phone-portrait |
|------|---------|----------------|
| 击杀战报含最后一击 | `desktop-02-kill-battle-log.png` | `phone-portrait-02-kill-battle-log.png` |
| 遭遇中快捷恢复 | `desktop-01-quick-restore-in-encounter.png` | `phone-portrait-01-...` |
| 可合成提示出现前（基线无提示） | `desktop-03-hint-before.png` | `phone-portrait-03-...` |
| 可合成提示可见 + 一键合成 | `desktop-04/05-*.png` | `phone-portrait-04/05-...` |
| 快捷恢复自动使用（不弹窗） | `desktop-06-quick-restore-auto.png` | `phone-portrait-06-...` |
| 快捷恢复选择窗（多候选+双效） | `desktop-07-quick-restore-menu.png` | `phone-portrait-07-...` |
| 选择窗使用后收起 | `desktop-08-quick-restore-used.png` | `phone-portrait-08-...` |
| 候选减少后再次打开 | `desktop-09-quick-restore-remaining.png` | `phone-portrait-09-...` |

击杀战报文本样本（desktop）：
```
你与 寒星 正面遭遇。
你使用了 医疗包（生命 +40）。
寒星 被 战报验证者 击杀（森林）。
战报验证者 命中 寒星，造成 12 点伤害。
```
- 含「击杀」与死者名字 ✅
- 不含 `数字/数字` 形式的精确 HP ✅

---

## 6. 新增测试覆盖

| 文件 | 用例数 | 覆盖 |
|------|--------|------|
| `tests/phase4e1KillReport.test.ts` | 5 | 缺陷 A：玩家击杀、被击杀、环境死、非参与方不计入、仅加战报不改事件流 |
| `tests/phase4e1CraftableHint.test.ts` | 4 | 改进 B：基线不提示、目标优先、最高价值、无物品获得不提示 |
| `tests/phase4e1QuickRestore.test.ts` | 9 | 改进 C：§3.1–§3.4 候选集/自动/选择/双效全路径 |
| `tests/phase4e1QuickRestoreUi.test.tsx` | 7 | C UI：真按钮+aria、自动使用、多候选弹窗、关闭、空候选说明、双效双显示 |
| `tests/phase4e1CraftableHintUi.test.tsx` | 2 | B UI：基线无提示、获得材料后提示+一键合成、忽略 |
| `tests/phase4e1Fixtures.test.ts` | 4 | 浏览器夹具通过存档校验 |
| `tests/browser/phase4e1-*.spec.ts` | 7 | 浏览器证据（见上表） |

---

## 7. 交付物清单

- 生产代码：`src/core/vitals.ts`（缺陷 A）、`src/ui/quickRestore.ts`、
  `src/ui/craftableHint.ts`、`src/ui/components/QuickRestoreMenu.tsx`、
  `src/ui/components/CraftableHint.tsx`、`src/ui/components/Bar.tsx`、
  `src/ui/components/StatusBar.tsx`、`src/ui/screens/GameScreen.tsx`、
  `src/ui/styles.css`
- 测试：6 个单元测试文件 + 1 个浏览器证据 spec + 1 个夹具文件
- `reports/phase4e1-balance.json` + `.md`：500 局平衡模拟报告
- 浏览器证据：`output/phase4e1-browser/`（18 截图 + 2 战报文本 + runtime-errors.json）
- 本报告：`PHASE4E1_REPORT.md`
- `progress.md` 已更新

> `reports/save-validation-audit.*` 与 `reports/phase4a451-*.json` 为门禁再生产物
> （仅时间戳变化），按 4D-2 惯例保持 unstaged。
