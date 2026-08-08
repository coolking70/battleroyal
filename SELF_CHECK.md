# 自检清单（区域式大逃杀 · 第三阶段）

收尾时逐项核对，全部通过方可交付。第 1–23 项为第二阶段既有项（Phase 3 重跑复核），
第 24–30 项为第三阶段新增项。

| # | 检查项 | 命令 / 方法 | 结果 |
| --- | --- | --- | --- |
| 1 | 依赖安装无致命错误 | `npm install` | ✅ |
| 2 | 开发服务器可启动并响应 | `npm run dev` → `http://localhost:5173/` | ✅ |
| 3 | 生产构建零错误（含类型检查） | `npm run build` / `npx tsc -p tsconfig.app.json --noEmit` + `npx vite build` | ✅ |
| 4 | 全部测试通过 | `npx vitest run` → 424 passed (32 files) | ✅ |
| 5 | 核心逻辑层无 React 依赖 | 审计 `src/core` import | ✅ |
| 6 | 所有 `core/` 单文件 < 500 行 | `wc -l src/core/*.ts`（最大 `npcDecide.ts` 466） | ✅ |
| 7 | 确定性 RNG，同种子可复现 | `random.test.ts` | ✅ |
| 8 | `Math.random()` 仅用于 `generateRandomSeed` | 审计 `src` | ✅ |
| 9 | `src` 中无 `any`、无 `console.*`（调试面板导出除外） | 审计 | ✅ |
| 10 | TypeScript 严格模式全开 | `tsconfig.app.json` | ✅ |
| 11 | localStorage 自动存档 + 继续对局 | `save.test.ts` + `useGame.ts` | ✅ |
| 12 | v2 存档；旧 v1 存档检测 + 提示删除（不静默迁移） | `saveMgmt.test.ts` + `MenuScreen` | ✅ |
| 13 | 调试面板 `?debug=1` 可用（含导出存档） | `DebugPanel.tsx` | ✅ |
| 14 | 有限物资：开局一次性生成、搜空即广播 | `loot.test.ts` + `zoneLoot.ts` | ✅ |
| 15 | 0 体力无法移动/攻击（逃跑为免费出口） | `phase2-hardening.test.ts` | ✅ |
| 16 | 终局必然结束（硬上限 180） | `phase.test.ts` + `victory.test.ts` | ✅ |
| 17 | 信息不完全：地图噪音 + 情报 + 模糊同区 | `info.test.ts` + `ZoneMap`/`GameScreen` | ✅ |
| 18 | 制作目标（玩家 SET_CRAFT_GOAL + NPC 规划） | `craftGoal.test.ts` + `npcPlan.test.ts` | ✅ |
| 19 | 自动平衡模拟工具存在且通过 | `npm run simulate -- --games 2000`（比值 2.20 < 2.5） | ✅ |
| 20 | 1 玩家 + 5 NPC / 6 区域 / 4 角色 / 5 人格 | 数据文件 | ✅ |
| 21 | 保留既有测试并持续增长（71 → 128 → 424） | `npx vitest run` → 424 | ✅ |
| 22 | 文档齐备 | `README.md` / `PHASE2_REPORT.md` / `AUDIT_FIXES.md` / `BALANCE_CHANGELOG.md` / `DELIVERY_MANIFEST.md` / `reports/` | ✅ |
| 23 | 无禁用功能（联机/登录/商城/抽卡/重型引擎/外部 AI） | 架构审计 | ✅ |
| 24 | 战斗风格（迅捷/标准/强攻）玩家与 NPC 同规则 | `combatStyle` 相关测试 + `legalActionBuilders.ts` / `npcDecide.ts` | ✅ |
| 25 | 4 角色专属技能：体力 + 冷却双重闸门 | `skills.ts` + 技能测试 | ✅ |
| 26 | 动态事件（风暴/空投/伏击）对双方同等生效 | `dynamicEvents` 相关测试 | ✅ |
| 27 | 调试面板新增四区（技能冷却/风格概率/事件/RNG 状态） | `ui.test.tsx` 断言四区文案 | ✅ |
| 28 | 脚本化对局 8 局全部收束、无卡死，技能与三类事件覆盖齐全 | `reports/phase3-scripted-playthroughs.md`（技能 8/8、事件 8/8） | ✅ |
| 29 | 平衡收敛：胜率比 5.88 → 2.20，多种子稳健 | 4 独立种子（BAL 1.24 / VERIFY 1.90 / CHECK 1.50 / FINAL 2.20）全 PASS，无 0 胜率角色 | ✅ |
| 30 | 引擎健康红线：超时 / 非法状态 / 触顶均为 0 | `reports/phase3-balance.json` | ✅ |

**结论**：30/30 通过。第三阶段在**不推倒重写、不扩大功能范围**的前提下，
完成战斗风格、角色技能、动态事件、视觉升级、调试增强、脚本化对局验证与平衡收敛；
版本号保持 `0.2.0`，构建 / 类型检查 / 测试（424） / 模拟（2000 局）四链路均验证通过，可交付。

---

### 附：文件行数（验证第 6 项）

Phase 3 功能增量一度让 4 个核心文件突破 500 行红线，收尾时按**纯机械拆分**
（只挪代码、不改逻辑、原文件保留再导出出口，调用方 import 路径完全不变）复位：

| 原文件 | 拆分前 | 拆分后 | 拆出的新文件 |
| --- | --- | --- | --- |
| `npcDecide.ts` | 807 | 466 | `npcGoalPlan.ts`（353，制作目标规划） |
| `legalActions.ts` | 526 | 272 | `legalActionBuilders.ts`（282，合法动作子集枚举） |
| `actorActions.ts` | 524 | 302 | `actorActionBase.ts`（65）+ `actorCombatActions.ts`（205） |
| `types.ts` | 505 | 459 | `commandTypes.ts`（69，命令与动态事件类型） |

拆分后当前最大核心文件：

```
src/core/npcDecide.ts        466   ← 最大核心文件，< 500
src/core/types.ts            459
src/core/gameEngine.ts       435
src/core/combat.ts           371
src/core/commandHandlers.ts  359
src/core/npcGoalPlan.ts      353
```

拆分后 424 项测试全部通过、类型检查零错误、2000 局模拟结论不变，
证明这是零行为变更的重构。
