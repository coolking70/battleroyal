# WORLD_EVENT_DESIGN.md — 世界事件系统设计（Phase 3A）

> 版本 0.3.0 · 与 `src/core/worldEvents.ts` 一一对应。取代 Phase 3 已删除的 `dynamicEvents.ts`（storm / supply_drop / ambush）。

## 1. 为什么推翻旧动态事件

旧的三种动态事件各踩一条 Phase 3A 红线：

| 旧事件 | 违反的红线 | 具体表现 |
| --- | --- | --- |
| `supply_drop` | 不得修改隐藏库存 | 直接 `addLootItem()` 往区域库存塞物资，玩家不必付出搜索成本 |
| `ambush` | 不得瞬移角色 | 直接改写 `attacker.currentZoneId`，凭空把 NPC 挪到玩家脚下 |
| `storm` | 不得绕过 applyDamage | 事件直接扣血（坏范例） |

## 2. 替代设计：环境修正型事件

6 种世界事件**一律不直接改变任何角色/区域的实体状态**，只提供一组 `WorldEventModifiers` 修正值，由各系统在**自己的判定点**主动查询 `worldModifiersAt(state, zoneId)`。

```
修正值（乘数/加成/布尔）
  命中率 ×0.9（雨）  搜索 ×0.7（停电）  治疗 ×0.75（医疗管制）
  材料搜索 +0.6（研究异常）  遭遇权重 ×1.3（骚动）  逃跑 +0.1（雨）
  intelBlocked（停电屏蔽视线情报）  revealAll（广播公开位置）
```

三个结构性好处：

1. **红线不可能被违反**：`worldEvents.ts` 不 import `zoneLoot` / `vitals` / `inventory`，没有任何写实体状态的能力，编译期杜绝塞物资 / 瞬移 / 直接扣血（`tests/worldEventInvariants.test.ts` 用读文件方式守护）。
2. **确定性**：修正值是 state 的纯函数，存档只需序列化事件列表即可完整复现。
3. **UI 与 core 同源**：UI 显示「雨天命中 -10%」与核心掷骰用同一个 `worldModifiersAt`。

## 3. 事件一览

| id | 范围 | 效果 |
| --- | --- | --- |
| `blackout` 大停电 | 区域 | 命中 ×0.85、搜索 ×0.7、屏蔽该区域情报 |
| `rain` 连绵阴雨 | 全局 | 命中 ×0.9、逃跑 +0.1 |
| `emergency_broadcast` 紧急广播 | 全局 | 公开全部存活者所在区域（广播情报） |
| `medical_alert` 医疗管制 | 全局 | 治疗品效果 ×0.75、医疗物资搜索 +0.35 |
| `research_anomaly` 研究异常 | 区域 | 材料搜索 +0.6、装备耐久损耗 +1 |
| `citywide_unrest` 全城骚动 | 全局 | NPC 攻击倾向 +0.25、遭遇权重 ×1.3 |

## 4. 调度与并发

- `nextWorldEventTime` 首次在 `firstWorldEventTime`，之后每隔 `[worldEventIntervalMin, worldEventIntervalMax]` 时间单位触发一次。
- **同事件不叠加**：`pickWorldEventId` 排除当前已生效的 eventId（修正值最多由 `maxConcurrentWorldEvents=2` 种不同事件相乘）。
- 区域事件只落在**未被禁区吞掉**的区域（`z.status !== 'restricted'`）。
- 触发/结束都广播事件：`WORLD_EVENT`（`metadata.worldEventId`）/ `WORLD_EVENT_ENDED`（写 `worldEventHistory`）。

## 5. 各系统接入点

| 系统 | 查询的修正 | 位置 |
| --- | --- | --- |
| 战斗命中 | `hitMultiplier` | `combat.hitChanceIn` |
| 逃跑 | `fleeBonus` | `combat.fleeChanceIn` |
| 搜索 | `searchFindMultiplier` / `encounterMultiplier` / `materialFindBonus` / `medicalFindBonus` | `search.computeSearchWeights`、`zoneLoot.takeLootItem` |
| 治疗 | `healMultiplier` | `consumables.healMultiplierOf` |
| 装备损耗 | `durabilityLossBonus` | `combat.resolveAttack` |
| NPC 决策 | `npcAggressionBonus` | `npcDecide` |
| 情报 | `intelBlocked` / `revealAll` | `info.recordIntel` / `info.refreshPlayerSight` |

## 6. 不变量与审计

- `auditWorldEventInvariants(state)`（`core/worldEventAudit.ts`）纯函数审计：
  1. active 实例字段自洽（id/eventId/scope/zoneId/startedAtTime/remaining/label/description）；
  2. 范围 ↔ zoneId 自洽（全局不带区域、区域指向合法区域）；
  3. 同事件不叠加；4. 并发 ≤ `maxConcurrentWorldEvents`；
  5. history 时间区间合法；6. `nextWorldEventTime` 非负；
  7. `worldModifiersAt` 无 NaN/Infinity 污染。
- 行为层红线：跑 `runWorldEvents` 后角色血量/库存/地面/位置快照不变（测试覆盖）。
- 存档校验：`saveValidation/references.ts` 逐字段校验 active/history（Step 6/8）。

## 7. 模拟统计

`AutoGameResult.worldEventCounts` 从 `WORLD_EVENT` 事件扫描 6 种 id 的触发次数；正式 3000 局规模下每种 ≥ 50 次为验收门槛（`simulateBalance` 的 `phase3a.worldEventCoveragePassed`）。
