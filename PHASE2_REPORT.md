# 第二阶段开发报告（区域式大逃杀）

记录第二阶段「核心硬化与战略搜集循环」的实现路径、关键决策、验证结果与交付结论。
配合 `README.md`、`AUDIT_FIXES.md`、`BALANCE_CHANGELOG.md`、`DELIVERY_MANIFEST.md` 阅读。

---

## 1. 目标与约束

在**不推倒重写**第一阶段代码的前提下，完成：

1. 把第一阶段的 7 项优先级验收缺陷全部硬化；
2. 引入**有限物资**系统，让搜集成为有成本的战略选择；
3. 建立**体力 / 搜索 / 合成**的可持续循环，杜绝无限拖拽；
4. 降低**全图信息泄露**（噪音 + 最后已知位置 + 模糊同区）；
5. 终局**强制收束**，保证对局必然在有限时间内结束；
6. 提供**自动平衡模拟工具**并把 4 性格胜率比压到 < 2.2；
7. 保留全部 71 个测试并增长到 ≥ 105；
8. 严格按 9 步开发顺序推进。

约束：单人 / 客户端 / 确定性种子 / 可测；不新增物品或配方（仅调数值）。

---

## 2. 架构保持

- 核心纯函数层 `src/core` 不依赖 React；UI 仅通过 `useGame` 胶水层调用 `executeCommand`。
- 全部随机来源取自种子 RNG（`SeededRandom`：xmur3 + mulberry32），序列化 `rngState`，
  同种子 + 同操作序列 = 完全相同的一局。`Math.random()` 仅用于 `generateRandomSeed`。
- `executeCommand(state, command) => CommandResult` 对外表现为纯函数，内部先深拷贝再结算；
  错误边界保证异常不泄漏到界面。

---

## 3. 关键改动

### 3.1 状态与命令硬化（步骤 2）
- 统一体力成本层 `actionCosts.ts`：MOVE / ATTACK / FLEE 在变更前校验体力。
- `vitals.ts` 统一 HP 变更：`applyHpChange` 统一触发死亡结算，修复「血量为 0 的活人」。
- `crafting.ts` / `commandHandlers.ts` 全部改用 `tryGetRecipe` / `tryGetItem`，未知 id 返回失败而非抛错。
- `gameEngine.ts` 错误边界：可预期与未预期异常都转成 `{ state（未改）, ok:false, message }`。

### 3.2 有限物资（步骤 3）
- `zoneLoot.ts`：开局一次性生成有限清单，每次搜索递减，`remainingLootCount` 同步；
  `supply = remainingLootCount / initialLootCount`；扣空即 `ZONE_EXHAUSTED` 全场广播。
- NPC 决策感知有限物资：已搜空区域权重归零，逼 NPC 去别处争抢。

### 3.3 终局收束（步骤 4）
- `phase.ts`：opening → midgame（固定时点）→ finale（3 种触发：时间 / 存活人数 / 物资比例）。
- 终局衰竭每回合递增（封顶）；禁区伤害在终局额外 ×1.5 倍率。
- 硬上限 `hardTimeLimit = 180`：到达即强制结算，对局必然结束。

### 3.4 制作目标与 NPC 目标（步骤 5）
- 玩家：`SET_CRAFT_GOAL` 显式设定目标，合成达成时播报 `CRAFT_GOAL_SET`。
- NPC：`planNpcGoal` 按 `npcPlanTtl` 过期自动重规划；搜集型会为「差一点材料」的配方定下长期目标。

### 3.5 信息不完全（步骤 6）
- `info.ts`：噪音（搜索/战斗/死亡产生、随时间衰减）+ 最后已知位置情报（会过期）
  + 同区可见度（仅遭遇中暴露精确数值）。
- UI：`ZoneMap` 显示噪音分档而非精确人数；`GameScreen` 同区对手用模糊印象；新增情报面板。

### 3.6 UI 补全（步骤 7）
- 删除存档 / 损坏存档提示 + 旧版本存档提示（均提供删除按钮，不做静默迁移）。
- 调试面板「导出存档 JSON」。
- 结算页新增结束原因 / 死亡顺序 / 最远阶段。
- 合成页新增制作目标条。

### 3.7 模拟与平衡（步骤 8）
- `tools/simulate.ts` + `npm run simulate` + `tsx` 依赖。
- 1000 局自动对局，统计胜者性格分布；4 性格胜率比约 **1.5**，< 2.2 通过。

---

## 4. 验证结果

- `npm run typecheck`：零错误。
- `npm test`：**128 passed / 17 files**（较第一阶段 71 增长，满足 ≥ 105）。
- `npm run simulate`：4 性格胜率比 ≈ 1.5（阈值 2.2），PASS。
- `npm run build`：成功（未做破坏性改动，构建链路保持可用）。

---

## 5. 交付结论

第二阶段 9 步全部完成：7 项缺陷修复、有限物资、战略循环、终局收束、信息不完全、
制作目标、UI 补全、自动平衡模拟——均在**不推倒重写**的前提下落地，
测试与文档齐备，可交付。
