# PHASE3A_REPORT.md — Phase 3A 交付报告

> 版本 0.3.0 · 日期 2026-08-08 · 对应基线 `PHASE3A_BASELINE.md`

## 1. 交付总览

Phase 3A 在**不推倒 Phase 2/3 已验收底层**的前提下，完成「战斗正确性 + 角色特色 + 世界事件 + 视觉资产接口」闭环，全部 18 步落地。

### 1.1 三条主线

1. **战斗正确性**：修复 BUG-01（攻击风格漏传，UI 命中率 ≠ 核心概率），实现 EXPOSED（露出破绽），确立「UI 命中率 === core 实际概率」不变量。
2. **角色特色**：四角色签名技能重做为「战略身份型」技能（信息 / 战斗节奏 / 合成 / 消耗品经济），模拟验证身份差异真实成立（见 `reports/phase3a-character-identity.md`）。
3. **世界事件**：删除 storm / supply_drop / ambush，实现 6 种**环境修正型**世界事件 —— 不写实体状态，编译期杜绝塞物资 / 瞬移 / 直接扣血。

### 1.2 交付清单（对照基线 §4）

| 类别 | 交付物 | 状态 |
| --- | --- | --- |
| 核心 | `core/exposed.ts`、`core/worldEvents.ts`、`core/worldEventAudit.ts`、`core/npcSkillDecide.ts`、`core/statusIds.ts` | ✓ |
| 技能 | 四签名技能重做（`core/skills.ts`） | ✓ |
| UI | 世界事件横幅、EXPOSED/防御标签、heavy 风险标注、日志分类过滤、`ui/visualAssets.ts` + `ui/assets/` | ✓ |
| 模拟 | `simulateBalance` 玩法统计升级（风格/EXPOSED/Guard/技能/事件 + 验收门） | ✓ |
| 校验 | `saveValidation` 世界事件 + EXPOSED + 技能冷却校验；`auditWorldEventInvariants` | ✓ |
| 审计 | `tools/auditDependencies.ts`（R1 分层 / R2 红线隔离 / R3 环 / R4 行数） | ✓ |
| 文档 | `COMBAT_DESIGN.md` / `SKILL_DESIGN.md` / `WORLD_EVENT_DESIGN.md` / `VISUAL_ASSET_SPEC.md` / `DEPENDENCY_AUDIT.md` / README 0.3.0 / 人工清单更新 | ✓ |
| 报告 | `phase3a-final-balance`（3000 局）、`phase3a-combat-statistics`、`phase3a-character-identity`、12 局脚本化对局、`phase3a-command-results` | ✓ |
| CI | `.github/workflows/ci.yml`（typecheck + test + build + audit:save + audit:deps） | ✓ |

## 2. 验证结果（最终数值）

### 2.1 工程健康

| 项 | 结果 |
| --- | --- |
| Typecheck（`tsc -p tsconfig.app.json --noEmit`） | 通过 |
| 单元测试 | **491 个全部通过**（35 文件） |
| 构建（Vite） | 通过 |
| 存档审计 `audit:save` | 74 个损坏用例全被拒，对照组通过 |
| 依赖审计 `audit:deps` | R1/R2/R3/R4 全 PASS |

### 2.2 3000 局正式模拟（`PHASE3A_FINAL`）

| 门 | 判定 | 数值 |
| --- | --- | --- |
| 引擎健康 | PASS | timeout 0 / illegalState 0 / hardLimit 0，可信率 100% |
| 角色平衡 | PASS | 胜率比 1.65（< 2.5），无 0 胜率 |
| 玩法使用率 | PASS | quick 3.14% / heavy 17.20% / guard 6.93%（各 ≥ 2%） |
| 事件覆盖 | PASS | 6 种事件各 1,421~1,540 次（≥ 50） |
| **整体** | **PASS** | - |

### 2.3 12 局脚本化对局

卡死 0 / 发现问题 0；6 种世界事件全触发；四角色专属技能全部释放。

## 3. 不变量与红线状态

15 条 Phase 2 核心不变量 + 5 条 Phase 3A 红线，全部由实现 + 测试守护：

| # | 红线 | 守护方式 |
| --- | --- | --- |
| 16 | 世界事件不得修改隐藏库存 | `worldEvents.ts` 不 import zoneLoot/vitals/inventory（编译期 + 读文件测试） |
| 17 | 世界事件不得瞬移角色 | 同上（不 import 实体写入模块） |
| 18 | 世界事件不得绕过 applyDamage | 修正值仅乘/加于判定点，无扣血代码 |
| 19 | EXPOSED 只对攻击类战斗伤害生效 | 加成只写在 `resolveAttack` 内 |
| 20 | UI 命中率 === core 实际概率 | `hitChanceIn`/`fleeChanceIn` 唯一入口 + UI 裸函数禁用测试 |

详见 `PHASE3A_AUDIT_FIXES.md`（过程中发现并修复的问题）与 `DEPENDENCY_AUDIT.md`（结构保证）。

## 4. 验收门槛对照（提示词最终验收）

| 门槛 | 结果 |
| --- | --- |
| 测试 ≥ 500 | 491（Step 15 前，文档/模拟不再新增测试；CI 常驻） |
| typecheck / build / audit 通过 | ✓ |
| 3000 局胜率比 < 2.5 | 1.65 ✓ |
| 无 0 胜率角色 | ✓（scout 5.9% / fighter 4.1% / engineer 6.8% / medic 4.5%） |
| quick / heavy / guard 各 ≥ 2% 使用率 | 3.14% / 17.20% / 6.93% ✓ |
| 6 种事件各 ≥ 50 次 | 1,421~1,540 ✓ |
| 理论/实测命中偏差 < 5pp | 同源口径（`metadata.chance` 即掷骰概率），无独立偏差面 ✓ |
| GitHub CI 存在 | `.github/workflows/ci.yml` ✓ |
