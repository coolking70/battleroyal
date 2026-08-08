# 开发报告（区域式大逃杀 · 第一阶段）

记录第一阶段的实现路径、关键决策、验证结果与自查结论。配合 `README.md` 阅读。

---

## 1. 概览与交付物

| 交付物 | 路径 | 状态 |
| --- | --- | --- |
| 可运行项目 | 整个仓库（`src/`、`index.html`、`package.json` 等） | ✅ |
| 说明文档 | `README.md`（12 节） | ✅ |
| 开发报告 | `DEVELOPMENT_REPORT.md`（本文件，7 节） | ✅ |
| 自检清单 | 第 7 节 + `SELF_CHECK.md` | ✅ |
| 测试 | `tests/`（10 文件，71 用例，全绿） | ✅ |

**验证状态（本阶段收尾时）**

- `npx tsc -p tsconfig.app.json --noEmit`：零错误。
- `npm run build`：成功（67 模块，~213KB JS / 14.5KB CSS）。
- `npm test`：**71 passed (71)**，10 个测试文件全过。
- `npm run dev`：开发服务器正常响应 `http://localhost:5173/`（200）。

---

## 2. 需求实现对照

| 需求（来自规格） | 实现位置 | 满足 |
| --- | --- | --- |
| 纯前端、零后端、零数据库、零 WebSocket | 全项目无服务端依赖 | ✅ |
| TS + React + Vite + CSS + Vitest | `package.json` / `vite.config.ts` / `vitest.config.ts` | ✅ |
| 核心逻辑与 React 分离 | `src/core`、`src/data` vs `src/ui`、`src/utils/useGame.ts` | ✅ |
| 确定性种子 RNG，默认 `BR-DEMO-001` | `src/core/random.ts`，`DEFAULT_SEED` | ✅ |
| `Math.random()` 仅用于 `generateRandomSeed` | 审计确认仅此一处 | ✅ |
| 1 玩家 + 5 NPC、6 区域、4 角色、5 人格 | `gameConfig.ts` / `characters.ts` / `zones.ts` | ✅ |
| ~20 物品、~8 配方 | 实际 23 物品 / 11 配方 | ✅ |
| 离散时间：玩家动作 +1，再 NPC 行动 | `advanceTime` | ✅ |
| 禁区：首禁 8、间隔 6、预警 2、伤害 20 | `restrictedZones.ts` / `GAME_CONFIG` | ✅ |
| localStorage 自动存档 | `saveLoad.ts` + `useGame.ts` | ✅ |
| 调试面板 `?debug=1` | `DebugPanel.tsx` + `App.tsx` | ✅ |
| 8+ 类 Vitest 测试 | 实际 10 个测试文件 | ✅ |
| 单 core 文件 < 500 行 | 最大 `combat.ts` 387 行 | ✅ |
| 严格模式、避免 `any` | `tsconfig.app.json` 全开，审计无 `any` | ✅ |
| 四脚本零错误 | install / dev / build / test | ✅ |

---

## 3. 架构设计决策

1. **纯函数命令引擎**
   `executeCommand(state, command): CommandResult` 是全局唯一入口。它先 `cloneState` 深拷贝，再在副本上结算，绝不修改调用方传入的对象——这让「重放」「测试」「撤销」在结构上天然可行。

2. **核心层零 React 依赖**
   所有规则、RNG、状态变更都在 `src/core`、`src/data`。React 只负责把状态画出来、把按钮变成 `Command`。这样核心可被 Vitest 在无浏览器环境下完整覆盖。

3. **单一粘合层 `useGame`**
   仅 `src/utils/useGame.ts` 知道 React 的 `useState` / `useEffect`。它封装 `dispatch → executeCommand → setState → 自动存档 → toast`，避免核心逻辑被 React 细节污染。

4. **NPC 决策与执行分离**
   决策（`npcDecide.ts`，纯判断：硬编码优先级 1–7 + 人格权重）与执行（`npcAi.ts`，改状态、触发交手、写事件）拆成两个文件，各自 < 500 行，且决策函数可被单测直接断言。

5. **玩家命令处理抽离**
   7 个 `handle*` 玩家命令结算函数集中到 `commandHandlers.ts`，保持 `gameEngine.ts` 只负责「入口分发 + 时间推进 + 结局判定」，提升可读性并满足行数约束。

6. **可注入的存储抽象**
   `saveLoad.ts` 暴露 `setStorage / getStorage / createMemoryStorage`，测试可注入内存实现，避免触碰真实 `localStorage`。

---

## 4. 关键机制实现说明

- **确定性**：`SeededRandom` 由 `xmur3(seed)` 派生初始状态，再经 `mulberry32` 产出序列；`getState()/fromState()` 让命令执行前后可无损保存/恢复 RNG 游标，因此「同种子 + 同操作 = 同结果」可严格保证。
- **离散时间闭环**：玩家动作 → `finish()` 判定是否 `advancesTime` → 若是则 `advanceTime`（NPC 依次行动）→ 状态效果结算 → 禁区收缩 → 遭遇同步 → 胜负检查 → 清空 `engagedWithPlayer`（防止同一时间单位内 NPC 对玩家二次出手）。
- **NPC AI 优先级**：①已死不行动 ②禁区/预警优先撤离 ③低血且有治疗品/配方→治疗 ④低体力→补/休 ⑤可合成更强装备→合成 ⑥同区域敌人→按人格与战力决定攻/逃 ⑦常规行动（搜/移/休加权）。`engagedWithPlayer` 会过滤掉本时间单位已与玩家交过手的 NPC，避免玩家被「连击」。
- **禁区收缩**：`firstZoneEventTime=8`、`zoneEventInterval=6`、`zoneWarningDuration=2`、`zoneDamagePerTick=20`、`minSafeZones=1`，由 `updateRestrictedZones` 在每时间单位推进时计算并广播。
- **遭遇战**：玩家搜索/休息可能触发遭遇；遭遇期间命令被限制为「攻击 / 逃跑 / 使用物品」，由 `EncounterPanel` 承接。NPC 攻击玩家时玩家不自动反击，留待玩家下一操作决定。

---

## 5. 测试策略与结果

- **分层**：纯逻辑走 node 环境（快、无依赖）；UI 走 jsdom（验证渲染不崩、关键交互推进时间、存档可读回）。
- **覆盖维度**：RNG 确定性、区域对称性、移动、战斗（命中/伤害/反击/逃跑）、搜索、合成、NPC 决策与人格差异、存档、胜负与排名、UI 流程。
- **结果**：`npm test` → **Test Files 10 passed / Tests 71 passed**。
- **纪律回归**：拆分 `gameEngine.ts`(567→319) 与 `npcAi.ts`(549→275) 后，重跑 `tsc --noEmit` 与 `npm test`，71 用例依旧全绿，确认重构未引入行为变化。

---

## 6. 已知限制与后续规划

**已知限制（第一阶段刻意保留）**

- 角色仅有 1 个被动，无主动技能树。
- 物品/配方为原创占位内容，数值未经大规模平衡。
- 无音效、无动画、无地图缩放（以列表/色条呈现区域）。
- NPC 决策为「规则 + 权重」，非机器学习。
- 仅为单机；无联机与云存档。

**后续规划（非本阶段）**

- 第二阶段可引入：技能系统、更多区域与动态连接、可视化地图、平衡调参面板、对局回放（得益于纯函数命令引擎，回放成本低）。
- 若需要联机，可在 `executeCommand` 之上叠加服务端权威 + 状态同步，核心逻辑无需重写。

---

## 7. 自检清单

| # | 检查项 | 结果 |
| --- | --- | --- |
| 1 | `npm install` 无致命错误 | ✅ |
| 2 | `npm run dev` 可启动并响应 | ✅ |
| 3 | `npm run build` 零错误（含 tsc 类型检查） | ✅ |
| 4 | `npm test` 全部通过（71/71） | ✅ |
| 5 | 核心逻辑与 React 分离（核心层无 React import） | ✅ |
| 6 | `core/` 单文件均 < 500 行 | ✅（最大 387） |
| 7 | 确定性 RNG；同种子可复现 | ✅ |
| 8 | `Math.random()` 仅 `generateRandomSeed` 使用 | ✅ |
| 9 | 无 `any`、无 `console.*` 于 `src` | ✅ |
| 10 | 严格模式全开 | ✅ |
| 11 | localStorage 自动存档 + 继续对局 | ✅ |
| 12 | 调试面板 `?debug=1` 可用 | ✅ |
| 13 | 禁区机制参数与规格一致 | ✅ |
| 14 | 1 玩家 + 5 NPC / 6 区域 / 4 角色 / 5 人格 | ✅ |
| 15 | 文档齐备（README 12 节 / 本报告 7 节 / 自检） | ✅ |
| 16 | 无禁用功能（联机/登录/商城/抽卡/重型引擎/外部 AI） | ✅ |

> 结论：第一阶段竖切已满足规格全部硬性要求，构建、测试、运行三链路均验证通过，可交付。
