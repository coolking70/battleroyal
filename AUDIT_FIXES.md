# 审计修复清单（Phase 2）

记录第二阶段针对第一阶段「优先级验收问题」所做的硬化修复，以及开发过程中被发现并修正的破坏性改动。

验收原则：**只硬化、不推倒重写**；核心纯函数结构、React 分离、确定性 RNG 全部保留。

---

## 1. 7 项优先级缺陷（全部已修复）

| # | 缺陷 | 现象 | 修复位置 | 修复方式 |
| --- | --- | --- | --- | --- |
| P0-1 | 体力可被耗到 0 后仍无限移动/攻击/逃跑 | 玩家或 NPC 在 0 体力时仍可 MOVE/ATTACK/FLEE | `actionCosts.ts` + `commandHandlers.ts` | 统一体力成本层：`canPayActionCost` / `payActionCost` 在进入变更前拦截；MOVE/ATTACK/FLEE 各自校验体力 |
| P0-2 | 持续伤害（DoT）可能留下「血量为 0 的活人」 | 禁区/衰竭把 hp 打到 0 但未触发死亡结算 | `vitals.ts` + `gameEngine.ts` | `updateStatusEffects` 改走 `applyHpChange`，由它统一结算死亡 |
| P0-3 | 被手改坏的存档能加载进游戏后才崩 | 角色处在不存在区域、遭遇指向死人也能读入 | `saveLoad.ts` | 三层深度校验（结构 / 数值 / 交叉引用），失败时拒绝加载并展示错误 |
| P0-4 | 未解决的遭遇可被「点叉」逃掉 | CLOSE_ENCOUNTER 在战斗未结束时仍清空遭遇 | `gameEngine.ts` | CLOSE_ENCOUNTER 校验 `encounter.resolved`，否则拒绝 |
| P0-5 | 未知配方 / 未知物品导致界面抛异常 | 存档被改、UI 传错 id 时 `getItem` 抛错 | `crafting.ts` / `commandHandlers.ts` | 全部改用 `tryGetRecipe` / `tryGetItem`，未知情况返回失败而非抛错 |
| P0-6 | 搜索物资无限（无搜空概念） | 同区域可无限刷出物品，战略搜集失效 | `zoneLoot.ts` + `search.ts` | 开局一次性生成有限物资清单，每次搜索递减，扣空即 `ZONE_EXHAUSTED` 全场广播 |
| P0-7 | 全图上帝视角（信息无损耗） | 地图直接显示每区人数与对手精确 HP/武器 | `info.ts` + `ZoneMap.tsx` / `GameScreen.tsx` | 地图只显示噪音分档 + 最后已知位置情报；同区对手仅「遭遇中」暴露精确数值 |

---

## 2. 破坏性改动（必须记录，避免后续误判为回归）

### 2.1 移除 `supplyFloor` 字段

第一阶段 `gameConfig.ts` 曾存在 `supplyFloor`（物资地板值），用于搜索结果的下限保底。
第二阶段改为**真正的有限物资库存**（`ZoneLootEntry[]` + `remainingLootCount` +
`supply = remainingLootCount / initialLootCount`），`supplyFloor` 已删除。

凡是依赖「物资永远不会低于某比例」的旧逻辑都必须改写；任何残留的 `supplyFloor`
引用都会在当前类型检查下报错，属预期。

### 2.2 `tests/search.test.ts` 同步改写

由于 `supplyFloor` 被移除、`zone.supply` 的含义从「保底比例」变为「真实剩余比例」，
原 `search.test.ts` 中基于 `supplyFloor` 的断言已失效，改写为：

- `zone.supply` 单调非增，且取值落在 `[0, 1]`；
- 开局 `remainingLootCount` 等于各条目件数之和；
- `supply === remainingLootCount / initialLootCount`（与有限库存同步）；
- 扣空后再次搜索返回 `null`，且 `isZoneExhausted` 为真。

> 该改动是**刻意且可预期的**，不属于回归；类型检查（`npm run typecheck`）在移除
> `supplyFloor` 后曾因旧测试引用该字段而失败，改写后恢复通过。

---

## 3. 配套硬化（非验收项，但顺带完成）

- `executeCommand` 增加错误边界：可预期错误与未预期异常一律转成
  `{ state（未被修改）, ok: false, message }`，界面永不拿到半改坏的 state。
- `decideNpcAction` 的常规行动（search/move/rest）接入有限物资感知：
  已被广播搜空的区域权重归零，逼 NPC 去别处争抢。
- 阶段系统与终局收束接入 `advanceTime`：阶段推进 → NPC 行动 → 状态效果 →
  禁区更新 → 终局衰竭 → 噪音衰减 → 视野刷新 → 遭遇同步 → 胜负判定 → 硬上限。
- NPC 制作目标规划（`planNpcGoal`）：按 `npcPlanTtl` 过期自动重规划，
  搜集型 NPC 会为「差一点材料」的配方定下长期目标。

---

## 4. 验证

- `npm run typecheck`：零错误（含 2.1 / 2.2 改动后）。
- `npm test`：128 passed / 17 files（见 `DELIVERY_MANIFEST.md`）。
- 存档深度校验与旧版本提示见 `saveMgmt.test.ts`。
