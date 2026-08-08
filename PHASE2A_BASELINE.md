# PHASE 2A 返修基线（Rework Baseline）

> 本文件在 Phase 2A 任何代码改动**之前**建立，用于冻结返修起点。
> Phase 2A 的目标不是增加新内容，而是修复第二阶段验收中发现的
> **真实性（truthfulness）、稳定性（no deadlock）与交付完整性（delivery）** 问题。
>
> - 建立时间：2026-08-07
> - 基线提交状态：Phase 2 交付完成后、Phase 2A 第一行代码之前
> - 版本号：**0.2.0**（Phase 2A 不升版本号）
> - 原则：**禁止推倒重写**，全部在现有代码上增量返修。

---

## 一、基线事实（Frozen Facts）

### 1.1 版本与构建

| 项目 | 基线值 |
| --- | --- |
| `package.json` version | `0.2.0` |
| `GAME_VERSION` | `0.2.0` |
| `SAVE_KEY` | `zone-br.save.v2` |
| `npm run typecheck` | ✅ 通过（`tsc -b --force`，0 error） |
| `npm run build` | ✅ 通过（`tsc -b && vite build`） |
| `npm run test` | ✅ 通过 |

### 1.2 测试基线

| 项目 | 基线值 |
| --- | --- |
| 测试文件数 | **17** |
| 测试用例数 | **128 passed / 128** |
| 运行耗时 | ≈ 6.3s |

基线测试文件清单：

```
tests/combat.test.ts          tests/npcPlan.test.ts
tests/craftGoal.test.ts       tests/phase.test.ts
tests/crafting.test.ts        tests/phase2-hardening.test.ts
tests/helpers.ts (工具)        tests/random.test.ts
tests/info.test.ts            tests/save.test.ts
tests/loot.test.ts            tests/saveMgmt.test.ts
tests/movement.test.ts        tests/search.test.ts
tests/npc.test.ts             tests/ui.test.tsx
                              tests/victory.test.ts
                              tests/zones.test.ts
```

**Phase 2A 硬性要求：这 128 个用例一个都不能删、不能跳过，最终总数 ≥ 170。**

### 1.3 代码规模基线（7783 行）

| 文件 | 行数 | Phase 2A 是否预期改动 |
| --- | --- | --- |
| `src/core/types.ts` | 448 | ✅ 改（新增 `draw` 状态、合法行动、目标推荐类型） |
| `src/core/saveLoad.ts` | 446 | ✅ 拆分为 `src/core/saveValidation/` |
| `src/core/npcDecide.ts` | 428 | ✅ 改（五人格长期目标 / 重规划） |
| `src/core/gameEngine.ts` | 409 | ✅ 改（接入统一行动服务、draw 判定） |
| `src/core/inventory.ts` | 307 | ✅ 改（物品守恒） |
| `src/core/combat.ts` | 302 | ✅ 改（逃跑免费 / 追击） |
| `src/ui/screens/GameScreen.tsx` | 293 | ✅ 改（信息隐藏、制作目标面板） |
| `src/core/gameState.ts` | 287 | ⚪ 可能小改 |
| `src/core/commandHandlers.ts` | 282 | ✅ 改（复用统一行动服务） |
| `src/core/npcAi.ts` | 278 | ✅ **重点重构**（消除直接赋值） |
| `src/core/search.ts` | 249 | ⚪ 可能小改 |
| `tools/simulate.ts` | 241 | ✅ **重写**（→ `tools/autoPlayer.ts` + 新报告） |
| `src/ui/components/DebugPanel.tsx` | 217 | ✅ 改（导出 / 复制种子 / 完整性检查） |
| `src/core/crafting.ts` | 215 | ✅ 改（目标推荐） |
| `src/ui/screens/ResultScreen.tsx` | 199 | ✅ 改（完整结算字段） |
| `src/core/info.ts` | 183 | ✅ **重点改**（收紧信息隐藏） |
| `src/core/vitals.ts` | 174 | ⚪ 保持 |
| `src/core/phase.ts` | 168 | ✅ **重点改**（硬时限 → draw） |
| `src/core/actionCosts.ts` | 116 | ✅ 改（FLEE = 0） |
| `src/data/gameConfig.ts` | 143 | ✅ 改（`fleeStaminaCost` / 终局衰减调参） |

**Phase 2A 新增文件（预期）：**

```
src/core/legalActions.ts              # 合法行动 / 死锁防护
src/core/actorActions.ts              # 玩家与 NPC 统一行动服务
src/core/itemIntegrity.ts             # 物品守恒不变量
src/core/saveValidation/index.ts
src/core/saveValidation/validateTopLevel.ts
src/core/saveValidation/validateCharacters.ts
src/core/saveValidation/validateZones.ts
src/core/saveValidation/validateEvents.ts
src/core/saveValidation/validateReferences.ts
tools/autoPlayer.ts                   # 模拟器控制器（只用 executeCommand）
tools/simulateBalance.ts              # 批量模拟与报告（替代 tools/simulate.ts）
```

---

## 二、当前模拟器算法（基线快照）

文件：`tools/simulate.ts`（241 行）

```
入口         main() → process.argv[2] 位置参数（唯一参数：局数）
玩家角色     固定 'scout'（4 个角色只覆盖 1 个）
玩家策略     createGame 默认给 player 的 personality = 'random'
驱动方式     autoPlayerCommand() 把 decideNpcAction 的结果翻译成 Command
循环上限     hardTimeLimit + 200 = 380 次迭代
失败兜底     if (!res.ok) → 有 pendingPickup 就 RESOLVE_PICKUP{accept:true}
                          → 否则强行 SEARCH
胜者判定     alive.length === 0 → null
             alive.length === 1 → 该角色 personality
             alive.length >  1 → 取血量最高者的 personality   ← 伪造胜者
统计口径     只统计「胜者性格」，random 直接丢弃（continue）
             games 字段 = counted（所有性格共用同一分母）
输出         reports/phase2-balance.json / .md（9 个顶层字段）
退出码       passed ? 0 : 1
```

**当前报告字段（仅 9 个顶层字段）：**

```
generatedAt, totalGames, gamesPerPersonality, version,
personalities[{personality, games, wins, winRate}],
maxWinRate, minWinRate, balanceRatio, threshold, passed
```

---

## 三、当前存档校验基线

文件：`src/core/saveLoad.ts`（单文件 446 行）

```
SaveData = { version, savedAt, seed, time, rngState, state }

validateSaveData() 三层：
  第 1 层 结构：顶层字段类型、characters/zones/events 为对象或数组
  第 2 层 数值：hp 边界、stamina 边界、time ≥ 0、alive 与 hp===0 的一致性
  第 3 层 引用：zone 成员关系、turnOrder 引用、encounter 引用、pendingPickup 引用

导出函数：validateSaveData / loadGame / saveGame / clearSave /
         findLegacySaves / clearLegacySaves / hasResumableSave / hasAnySave
```

**已覆盖的损坏场景（约 12 种）**，**未覆盖**的包括但不限于：
物品 UID 重复、turnOrder 重复、turnOrder 缺人、`remainingLootCount` 与实际掉落池不符、
补给比例越界、`phase` 非法值、`endReason` 与 `status` 矛盾、`rngState` 非法、
`plannedRecipeId` 指向不存在配方、装备 UID 不在背包内、区域邻接不对称、
`restrictedZones` 引用不存在区域、`pendingPickup.dropUid` 不在背包内 等。

---

## 四、当前玩家 / NPC 执行路径（不统一，Phase 2A 要合一）

```
玩家：UI → executeCommand(state, cmd)        [gameEngine.ts]
        → cloneState → executeCommandInner
        → commandHandlers.ts  handleMove / handleSearch / handleAttack /
                              handleFlee / handleRest / handleCraft ...
        → actionCosts.canPayActionCost + payActionCost   ← 有体力门槛
        → vitals.applyDamage                              ← 统一生死
        → events.push                                     ← 有事件
        → advanceTime()

NPC ：advanceTime → runNpcTurn(state, npc, rng)   [npcAi.ts]
        → decideNpcAction (npcDecide.ts)
        → **直接改状态**：
             npc.currentZoneId = target;                       ← 违规
             npc.stamina = Math.max(0, npc.stamina - cost);    ← 违规
        → resolveNpcEngagement → resolveAttack()              ← 未过 canAttack 体力门槛
        → autoEquip / autoLoot（自有实现，不走 inventory 命令）
```

---

## 五、Phase 2A 必须修复的问题清单

| # | 问题 | 证据位置 | 对应步骤 |
| --- | --- | --- | --- |
| P1 | 遭遇战可能死锁：体力为 0 时 FLEE 需 2 点体力、ATTACK 需体力，玩家无任何可推进时间的行动 | `actionCosts.ts` + `gameConfig.fleeStaminaCost = 2` | Step 3 / 4 |
| P2 | 无「合法行动」统一服务，UI 与模拟器各自判断可做什么 | 无 `legalActions.ts` | Step 4 |
| P3 | NPC 绕过规则直接改状态 | `npcAi.ts:146-147` | Step 5 |
| P4 | NPC 攻击不过体力门槛（玩家过） | `npcAi.ts` `resolveNpcEngagement` → `resolveAttack` | Step 5 |
| P5 | 模拟器伪造胜者：多个存活时取血量最高者 | `tools/simulate.ts:75-76` | Step 6 |
| P6 | 模拟器只跑 1 个角色（scout），未覆盖 4 个角色 × 5 种策略 | `tools/simulate.ts:58` | Step 6 / 7 |
| P7 | 报告分母共用（`games: counted`），4 个"胜率"实为分布，和恒为 1 | `tools/simulate.ts:123-128` | Step 7 |
| P8 | 报告静默丢弃 `random` 胜者（1000 局中 213 局被丢弃） | `tools/simulate.ts:118` | Step 7 |
| P9 | 模拟器失败兜底盲目 SEARCH / RESOLVE_PICKUP，可能空转 | `tools/simulate.ts:65-69` | Step 6 |
| P10 | 存档校验为单文件，覆盖不足 30 种损坏 | `saveLoad.ts` | Step 8 |
| P11 | 无物品守恒不变量，替换 / 拒绝 / 放弃可能凭空产生或吞掉物品 | 无 `auditItemIntegrity` | Step 9 |
| P12 | 制作目标只有目标本身，无路线指引 | `CraftPanel.tsx` | Step 10 |
| P13 | NPC 无「首次行动即设定长期目标」，目标靠 TTL 懒惰生成 | `npcDecide.ts` `npcPlanTtl = 10` | Step 11 |
| P14 | 信息隐藏过松：同区域即自动识别所有角色；非遭遇战仍显示姓名 | `info.ts:85-92` `refreshPlayerSight`；`visibleRivals` | Step 12 |
| P15 | 硬时限 180 用血量比较直接判胜负 | `phase.ts:138-168` `enforceTimeLimit` | Step 13 |
| P16 | 调试面板无导出 / 复制种子 / 完整性检查 | `DebugPanel.tsx` | Step 14 |
| P17 | 结算界面字段不完整（无种子/策略/伤害统计/事件时间线） | `ResultScreen.tsx` | Step 15 |
| P18 | 交付目录含系统与工具临时文件（`*.timestamp-*.mjs` 等） | 项目根目录 9 个 timestamp 文件 | 清理阶段 |

---

## 六、Phase 2A 完成判定标准

本阶段完成的标志**不是「增加了很多代码」**，而是：

1. **对局不存在死锁** —— 任何合法状态下存活玩家都至少有一个能推进时间的行动。
2. **NPC 与玩家遵守同一规则** —— 同一套校验、同一套消耗、同一套事件。
3. **模拟报告能够被信任** —— 不伪造胜者，`playing` 一律计 `timeout`，出现 timeout 即 FAIL。
4. **存档损坏无法进入游戏** —— ≥ 30 种损坏用例全部被拒绝。
5. **所有验收结论均由真实运行数据支持** —— 报告 / 手工验收记录 / 命令输出三者可交叉验证。

---

## 七、历史报告处置

`reports/phase2-balance.json` 与 `reports/phase2-balance.md` **保留作为历史证据，不删除**，
但已在文件头部标注 `NON_AUTHORITATIVE`，理由：

> 原模拟器可能在对局仍为 `playing` 时退出循环，并把生命值最高角色当作胜者；
> 且四个性格共用同一分母、静默丢弃 `random` 胜局，报告不能作为有效平衡结论。

Phase 2A 的权威报告为 `reports/phase2a-balance.json` / `reports/phase2a-balance.md`。
