# 交付清单（DELIVERY_MANIFEST.md）

Phase 2A-1 交付包内容核对表。

## 文档（规格 §十四）

- [x] `PHASE2A1_REPORT.md` — 阶段总结报告（验收条目对照）
- [x] `PHASE2A1_AUDIT_FIXES.md` — 审计发现与修复记录
- [x] `SIMULATOR_DESIGN.md` — 模拟器设计（统一入口 / 健康红线 / 报告字段）
- [x] `SAVE_VALIDATION_SPEC.md` — 存档深度校验规格（13 组不变量）
- [x] `BALANCE_CHANGELOG.md` — 平衡调整日志（两轮调整 + 权威确认）
- [x] `DELIVERY_MANIFEST.md` — 本文件

## 报告（reports/）

- [x] `reports/phase2a1-balance.json` — 权威平衡报告（20000 局，含 characterBalance）
- [x] `reports/phase2a1-balance.md` — 平衡报告 Markdown 版
- [x] `reports/save-validation-audit.json` — 存档独立验收（60 损坏用例）
- [x] `reports/save-validation-audit.md`
- [x] `reports/phase2a1-manual-tests.md` — 真实手动测试记录（5 局 / 4 角色）
- [x] `reports/phase2a1-command-results.txt` — 真实命令输出摘要

## 代码（src/core/saveValidation/）

- [x] `types.ts` / `structure.ts` / `numbers.ts` / `references.ts` / `consistency.ts` / `index.ts`
  —— 四层深度校验（13 组不变量）
- [x] 引擎端不变量：`gameEngine.ts` / `phase.ts` 对局结束清空 encounter
- [x] `src/core/npcDecide.ts` — 五种人格长期规划重写（评分 / 重规划 / 调试字段）
- [x] `src/core/craftGuide.ts` — 路线推荐升级（BFS 距离 / 禁区 / 公开资源）
- [x] `src/core/info.ts` — `zonePresence` 区域存在感（替代 visibleRivals）
- [x] `src/core/legalActions.ts` / `commands.ts` / `commandHandlers.ts` / `gameEngine.ts` —
  `ATTACK_NEARBY` 泛化攻击
- [x] `src/core/types.ts` — `ATTACK_NEARBY` 命令、NPC 计划调试字段
- [x] `src/data/characters.ts` / `gameConfig.ts` / `gameState.ts` / `search.ts` / `combat.ts`
  — 平衡调整
- [x] `src/ui/components/DebugPanel.tsx` / `CraftPanel.tsx` / `screens/GameScreen.tsx` /
  `screens/ResultScreen.tsx` — 调试面板 / 推荐面板 / 同区域提示 / 结算页

## 工具（tools/）

- [x] `tools/simulateBalance.ts` — 统一模拟入口（帮助 / 参数错误 exit 1 / characterBalance）
- [x] `tools/auditSaveValidation.ts` — 存档独立验收（60 用例 / exit 1 门禁）
- [x] `tools/manualTests.ts` — 真实手测记录器（5 局）
- [x] `tools/autoPlayer.ts` — 自动对局控制器（ATTACK_NEARBY 适配）

## 测试（tests/）

- [x] `tests/saveValidationAudit.test.ts`（62）
- [x] `tests/npcPlanPhase2a1.test.ts`（12）
- [x] `tests/craftGuidePhase2a1.test.ts`（11）
- [x] `tests/balanceReport.test.ts`（5）
- [x] 既有测试全保留（含 128 基线），全量 358 通过

## 脚本（package.json）

- [x] `npm run simulate` / `simulate:balance` — 统一平衡模拟
- [x] `npm run audit:save` — 存档独立验收
- [x] `npm run manual:tests` — 真实手测记录

## 交付包卫生（规格 §十七）

- [x] 无 `__MACOSX/`
- [x] 无 `.DS_Store`
- [x] 无 `node_modules/`、`.git/`、`.workbuddy/`、`coverage/`、`.vite/`
- [x] 无 `*.timestamp-*.mjs`
- [x] 无旧 zip

## Phase 3 修订（P3-P3 · 命名正名 · 不冒充人工测试）

> 以下为 Phase 3-P3 对本清单的更正，不改动上方 Phase 2A-1 原始验收项。

- `tools/manualTests.ts`（真实手测记录器）**已重命名**为
  `tools/scriptedPlaythroughs.ts`（脚本化完整对局）。
- `npm run manual:tests`（真实手测记录）**已重命名**为
  `npm run scripted:playthroughs`（脚本化完整对局）。
- 原「真实手动测试 / 真实手测」的叫法**不准确**：跑的是脚本，无人坐在屏幕前操作，
  不能证明可用性 / 手感。Phase 3 起统一改称 **Scripted Playthrough / 脚本化完整对局**，
  它只验证「引擎能否被从头到尾完整驱动完」。
- 真正需要人类执行的可用性清单见仓库根目录 `HUMAN_PLAYTEST_CHECKLIST.md`，
  **其结论只能由人类填写**，AI / 脚本不得代填。
- 历史产物 `reports/phase2a1-manual-tests.md` 仍保留，但自 Phase 3 起不再新生成；
  新增产物为 `reports/phase3-scripted-playthroughs.md`。

## Phase 3 交付（2026-08-08 · 版本保持 0.2.0）

> 在「不推倒重写、不扩大功能范围」前提下，增量完成 Phase 3 的 10 个步骤：
> 战斗风格系统、四角色技能系统、动态事件框架、存档四层校验升级、
> 视觉升级、调试面板增强、8 局脚本化对局、2000 局平衡调优、最终交付。

### 新增 / 修改代码

- `src/core/combat.ts` — 攻击风格（quick/normal/heavy）命中与伤害倍率、防守反击倍率
- `src/core/actorActions.ts` / `commandHandlers.ts` / `gameEngine.ts` — `ATTACK` 风格落地
- `src/core/skills.ts` — 四角色签名技能（疾影/破甲/应急修理/急救）+ 状态效果
- `src/core/npcDecide.ts` / `legalActions.ts` / `npcAi.ts` / `autoPlayer.ts` — AI 适配风格与技能
- `src/core/dynamicEvents.ts`（新建）— 风暴 / 空投 / 伏击三类动态事件（确定性、复用既有机制）
- `src/core/types.ts` / `gameState.ts` / `zoneLoot.ts` / `events.ts` / `data/gameConfig.ts` —
  动态事件字段与配置
- `src/core/saveValidation/{types,structure,numbers,references,consistency}.ts` —
  四层校验显式覆盖 `guarding` / `skillCooldowns` / `activeEvents` / `nextDynamicEventTime` 等新字段
- `src/data/characters.ts` / `gameConfig.ts` — 平衡调优（技能强度 / 防御收益 / 攻防基础值）
- `src/ui/components/{Bar,StatusBar,EncounterPanel,DebugPanel}.tsx` — 视觉升级 / 徽章 / 调试增强
- `src/ui/styles.css` — 状态条脉动、按钮/面板质感、事件横幅、遭遇悬停

### 新增报告（reports/）

- [x] `reports/phase3-balance.json` / `.md` — 2000 局权威平衡报告（比值 2.2 < 2.5，多种子稳健）
- [x] `reports/phase3-scripted-playthroughs.md` — 8 局脚本化完整对局（覆盖技能 / 动态事件）

### 测试与工具

- [x] `tests/skills.test.ts`（12）/ `tests/dynamicEvents.test.ts`（8）/ `tests/saveValidation.test.ts`（9）
- [x] `tools/scriptedPlaythroughs.ts` — 8 局脚本化对局 + 技能/事件覆盖汇总
- [x] 全量测试 **424** 通过（32 文件）；`tsc -p tsconfig.app.json` 干净；`vite build` 通过
- [x] `npm run simulate -- --games 2000` 整体判定 PASS（引擎健康 + 角色平衡）
- [x] `BALANCE_CHANGELOG.md` — 新增「Phase 3 Step 9 平衡调优」记录

### 收尾重构：核心文件 500 行红线复位（零行为变更）

Phase 3 的功能增量让 4 个核心文件突破了「`core/` 单文件 < 500 行」这条自
Phase 1 起就写在 README 与自检表里的硬约束。收尾时按**纯机械拆分**复位：
只挪代码、不改一行逻辑，原文件保留再导出出口，因此**所有调用方的 import 路径完全不变**。

| 原文件 | 拆分前 | 拆分后 | 拆出的新文件 |
| --- | --- | --- | --- |
| `src/core/npcDecide.ts` | 807 | 466 | `npcGoalPlan.ts`（353） |
| `src/core/legalActions.ts` | 526 | 272 | `legalActionBuilders.ts`（282） |
| `src/core/actorActions.ts` | 524 | 302 | `actorActionBase.ts`（65）+ `actorCombatActions.ts`（205） |
| `src/core/types.ts` | 505 | 459 | `commandTypes.ts`（69） |

拆分后当前最大核心文件为 `npcDecide.ts` 466 行，红线恢复满足。

**零行为变更的证据**：拆分后重跑 `--seed-prefix PHASE3-FINAL` 的 2000 局模拟，
四角色胜率与拆分前**逐个完全一致**（侦察员 2.0% / 斗士 2.0% / 工程师 4.4% /
医学生 2.8%，比值 2.20），且 424 项测试、类型检查、生产构建全部通过。
确定性 RNG 下胜率完全复现，说明重构没有引入任何可观测的行为差异。

### 版本号

- 保持 **0.2.0**（第二阶段 / Phase 2 以来的统一版本，Phase 3 仅增量修订，不升级主版本号）。
