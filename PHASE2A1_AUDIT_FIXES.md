# Phase 2A-1 审计修复记录（PHASE2A1_AUDIT_FIXES.md）

记录本轮在独立审计中**发现并修复**的问题。审计手段：
1. 扩展 `src/core/saveValidation/` 四层校验并逐个击穿（60 个损坏用例）；
2. 全量回归 + 引擎端不变量核对。

## 一、存档校验缺检项（发现 → 修复）

| # | 缺检项 | 影响 | 修复位置 |
| --- | --- | --- | --- |
| 1 | 顶层 version 未校验是否为受支持版本 | 旧版本 / 任意字符串都能过结构层 | `structure.ts`：必须 === GAME_VERSION，否则「版本不受支持」 |
| 2 | 顶层 savedAt 未校验 | NaN / 负数时间戳可入档 | `structure.ts`：有限正数 |
| 3 | 顶层 seed / time / rngState 与 state 冗余不一致未校验 | 同档两份关键数据自相矛盾 | `structure.ts`：四处 `===` 交叉校验 |
| 4 | rngState 未校验为合法有限整数 | 字符串 / NaN / 负数状态可入档 | `structure.ts`：isRngState |
| 5 | eventSeq / uidSeq / nextZoneEventTime 未校验 | 负值可入档 | `numbers.ts`：非负整数 + nextZoneEventTime 上限 |
| 6 | endedAtTime / finaleStartedAt 与 time 矛盾未校验 | 结束时间晚于当前时间 | `numbers.ts`：null 或非负整数且 ≤ time；进行中不得带 endedAtTime |
| 7 | 背包格数上限未校验 | 9+ 格背包可入档（规格点名） | `numbers.ts`：inventory.length ≤ 8 |
| 8 | count=0 / count>maxStack / 不可堆叠 count≠1 未校验 | 违例堆可入档 | `numbers.ts` validateStack |
| 9 | 武器耐久缺失 / 越界、非武器带耐久 未校验 | 装备数据自相矛盾 | `numbers.ts` validateStack |
| 10 | 全局 UID 唯一只查"同一角色内部" | 跨角色 / 地面 / pendingPickup 重复 UID 漏网 | `consistency.ts`：全局收集去重 |
| 11 | equippedWeaponId 类型、equipment 含 material/consumable 未校验 | 装备位类型错配 | `references.ts` |
| 12 | 负 stats / 负 kills 未校验 | 统计数据可入档 | `numbers.ts` |
| 13 | alive↔hp、diedAtTime 一致性未校验 | 「已死亡但 hp>0 / 生者带 diedAtTime」可入档 | `numbers.ts` |
| 14 | 区域 loot 条目 itemId / count / rarity 未校验 | 坏物资可入档 | `numbers.ts` |
| 15 | initialLootCount ≥ remaining 未校验 | 剩余多于初始 | `numbers.ts` |
| 16 | supply 未校验为派生比例（只查 [0,1]） | supply 与库存矛盾可入档（规格点名） | `numbers.ts`：`abs(supply − remaining/initial) < 1e-6` |
| 17 | 区域名单只查单方向 | 「存活者出现在他区名单 / 名单重复」漏网 | `consistency.ts`：双向完全一致 + 去重 |
| 18 | 玩家 craftGoalRecipeId 未校验 | 未知配方 / completed=true 无目标 | `references.ts` |
| 19 | NPC planCreatedAt / planReason 与 plannedRecipeId 不一致未校验 | 半残计划可入档 | `references.ts` |
| 20 | 事件 id 重复 / type 非法 / time 晚于当前 / actor/target/zone 引用无效 / message 非字符串 / metadata 不可序列化 未校验 | 事件流可被污染 | `references.ts` |
| 21 | eventSeq ≥ 事件 id 最大值未校验 | 事件序号回拨 | `consistency.ts` |
| 22 | eventCounters 非负 / total ≥ events.length / byType key 合法未校验 | 统计与事件流矛盾 | `consistency.ts` |
| 23 | 未解决遭遇的存活 / 同区 / zoneId 一致未校验；对局结束残留未解决遭遇未校验 | 脏遭遇可入档 | `references.ts` + 引擎 `checkGameEnd` / `enforceTimeLimit` 结束时清空 encounter |
| 24 | pendingPickup zoneId === 玩家所在区、source 合法未校验 | 待决拾取与位置矛盾 | `references.ts` |

## 二、引擎端不变量修复

**对局结束后残留未解决遭遇**：`checkGameEnd`（lost/won）与 `enforceTimeLimit`（draw）原先不清理 `state.encounter`，会在终局边界产生「对局已结束却存在 resolved=false 的遭遇」。已在这三处结束时 `state.encounter = null`，保证「已结束的对局无未解决遭遇」这条存档不变量在引擎侧即成立。

## 三、测试契约更新（旧测试编码了已被规格取代的行为）

| 文件 | 更新 |
| --- | --- |
| `tests/saveMgmt.test.ts` | `wrap()` 夹具补全顶层 SaveData 契约字段（规格 §二-1 要求） |
| `tests/ruleSymmetry.test.ts` | S4 从「逐目标 ATTACK」改为「泛化 ATTACK_NEARBY + 遭遇内精确指定」新契约（规格 §十） |
| `tests/info.test.ts` / `2A-E` | `visibleRivals` 逐行展示被 `zonePresence` 区域级存在感取代（规格 §十） |
| `tests/ui.test.tsx` | 同区域标题「同区域人员」→「同区域」 |
| `tests/npcPlan.test.ts` | 收集型「差一点材料」断言改为新收集评分（价值/路线）契约（规格 §四） |
| `tests/phase.test.ts` | 硬时限 HP 比较结算断言已在 Phase 2A 改为平局（保持不变） |

## 四、工具链审计

- `tools/simulateBalance.ts`：`AutoGamePolicy`（不存在）→ `AutoPlayerPolicy`；`ReturnType<typeof aggregateGlobal>`（函数不存在）→ 显式 `GlobalSummary` 接口；未知参数报错 + 帮助 + exit 1。
- `tools/auditSaveValidation.ts`：60 个损坏用例，全部拒绝。
- 新增 `tools/manualTests.ts`：5 局真实完整游玩记录器。

---

## Phase 3 修订（P3-P3 · 命名正名）

> 本文件写于 Phase 2A-1，当时第 55 行记录的 `tools/manualTests.ts` 已重命名为 `tools/scriptedPlaythroughs.ts`（脚本化完整对局）。
> 旧名「真实完整游玩记录器 / 真实手测」不准确，Phase 3-P3 起统一改称 **Scripted Playthrough**，它只验证引擎可被完整驱动完，不证明可用性。
> 真正需人类执行的清单见 `HUMAN_PLAYTEST_CHECKLIST.md`。
