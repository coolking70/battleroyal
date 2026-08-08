# ARCHITECTURE_AUDIT.md — 架构审计报告（Phase 3A-2）

> 版本 0.3.2 · 审计入口：`npm run audit:deps`（`tools/auditDependencies.ts`）
> 本文件只覆盖**代码架构**审计（import 层级 / 循环依赖 / 文件行数 / 模块红线）。
> npm 供应链审计请见 `SUPPLY_CHAIN_AUDIT.md`，两者刻意分开，避免概念混淆。

## 1. 审计规则

| 规则 | 内容 | 判定 |
| --- | --- | --- |
| R1 | 分层方向：`ui/` 可依赖 `core/ data/ utils/`；`core/ data/` 不得依赖 `ui/` | 违例 → FAIL |
| R2 | 红线隔离：`worldEvents.ts` 不得 import 实体写入模块（`zoneLoot` / `vitals` / `inventory`） | 违例 → FAIL |
| R3 | 环依赖：`core/` 与 `data/` 内部 import 环 | 只告警（type-only import 可断环） |
| R4 | 单文件体量：`core/ data/` 每个 .ts ≤ 500 行（Phase 2 不变量 #15） | 违例 → FAIL |

## 2. 当前结果（2026-08-08，最终命令重新执行）

```
[audit:deps] 依赖审计
  扫描文件数：54
  core/data 最大文件：core/types.ts（496 行）
  R1 分层违例：0
  R2 红线隔离违例：0
  R3 环告警：0
  R4 超行告警：0
[audit:deps] 判定：PASS
```

## 3. 关键设计决策（支撑以上结果）

### 3.1 红线隔离的结构性保证（R2）

`worldEvents.ts` 只 import 以下模块，**从根上**杜绝「事件直接改实体状态」：

```
data/gameConfig · data/zones · core/events · core/gameState（只读查询）
core/types · core/random（type-only）
```

没有 `zoneLoot` / `vitals` / `inventory` 的 import，编译期就写不出塞物资 / 瞬移 / 扣血的代码。

### 3.2 断环：`statusIds.ts`

Phase 3A 引入「技能状态（肾上腺素/工造/专注）+ EXPOSED」后，`skills.ts` 与 `combat.ts` / `actionCosts.ts` 之间出现互相引用的风险。解法是抽出**只依赖 `types.ts` 的纯查询层** `core/statusIds.ts`：

```
actionCosts.ts ──┐
combat.ts ───────┼─→ statusIds.ts ──→ types.ts
skills.ts ───────┘
```

它只含 id 常量与只读函数，不产生副作用，环就此断开（R3 = 0）。

### 3.3 体量复位：`npcDecide.ts`（R4）

Phase 3A 的技能决策已抽到 `core/npcSkillDecide.ts`；当前 `combat.ts` 为 398 行、`core/` + `data/` 最大文件为 `types.ts`（496 行），全部 ≤ 500。历史 Phase 3A-1 曾记录 `combat.ts` 515 行，但当前基线已真实恢复 PASS。

### 3.4 单向依赖示例（关键路径）

```
GameScreen / EncounterPanel / ZoneMap（ui/）
   └─ visualAssets.ts（ui/）—— 只依赖 data/ 与 core/types（type-only）
   └─ core/combat.hitChanceIn ── worldModifiersAt（core/worldEvents）
   └─ core/worldEvents ── core/events · core/gameState（只读）
```

## 4. 维护约定

- 新增 core 模块时如出现环：优先把共享常量/纯查询抽到 `statusIds` 式的底层模块，而不是互相 import。
- 新增世界事件：只往 `WORLD_EVENT_DEFS` / `applyModifier` 加条目，**不得**为此给 `worldEvents.ts` 引入任何实体写入模块。
- 任何把 `core/ data/` 文件推过 500 行的提交，`audit:deps` 会在 CI 拦截。
