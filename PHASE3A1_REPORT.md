# PHASE3A1_REPORT.md — Historical Phase 3A-1 交付报告

> Historical report. Phase 3A-1 final acceptance later found unresolved closure issues.
> See `PHASE3A2_REPORT.md` for the current executable evidence and final status.

> 版本 0.3.1 · 日期 2026-08-08 · 基线 `PHASE3A1_BASELINE.md`

## 1. 阶段目标

> 将 Phase 3A 已实现但偏离既定规格的技能、世界事件、信息不完全、模拟统计、
> CI 和依赖审计重新拉回明确需求，使 Phase 3 正式关闭，并为 Phase 4 美术资产生成管线
> 提供稳定接口。**本阶段不新增功能。**

## 2. 未闭环问题 → 修复结果（15 项全闭环）

| 编号 | 问题 | 修复 |
| --- | --- | --- |
| SPEC-01 | 侦察员技能偏离规格（战场侦察直接遍历 aliveCharacterIds 写身份） | 重做为「警觉侦察」：噪音增强 + SEARCH 遭遇先手，**零 playerIntel 写入** |
| SPEC-02 | 斗士技能偏离（3 次攻击 / 自伤 25%） | 回归：2 次攻击 / 伤害 +20%（真进 computeDamage）/ 体力 -1 / 自伤 +10% / 6 回合 |
| SPEC-03 | 工程师技能偏离（2 次免费合成 / 8 回合） | 回归：仅下一次成功合成免费 / 失败不消费 / 6 回合失效 |
| SPEC-04 | 医学生技能偏离（百分比回血 + 清除 DoT） | 回归：固定 +15 HP / 不清除任何 DoT / 4 回合治疗 +25% |
| SPEC-05~10 | 六世界事件效果偏离 | 全部按 WORLD_EVENT_DESIGN.md 回归（见 §4） |
| INFO-01 | 侦察技能泄露精确身份位置 | 删除 runReconnaissance；技能后 playerIntel 保持不变（测试守护） |
| INFO-02 | 紧急广播泄露全部幸存者位置 | 删除 revealAll；广播只公布高噪音区域（测试守护） |
| QA-01 | 测试 491 < 500 | **527 个全绿**（38 文件） |
| QA-02 | CI 缺 100 局快速模拟 | ci.yml 增加 `simulate --games 100`，FAIL 时 exit 1 |
| QA-03 | 未执行 npm 供应链审计 | 真实执行 `npm audit` / `npm audit --omit=dev`，写入 SUPPLY_CHAIN_AUDIT.md |
| REPORT-01 | 模拟统计字段不完整 | 补齐攻击风格细分 / Guard / EXPOSED / 技能收益（玩家·NPC）/ 事件影响统计 |
| ASSET-01 | 资产接口偏 UI 内部，Phase 4 替换路径不稳 | `public/assets/manifest.json` + 统一 `get*Visual` 接口 + 三级 fallback |

## 3. 最终验收数据（3000 局 `PHASE3A1`）

### 3.1 工程

| 项 | 结果 |
| --- | --- |
| Typecheck / Build / 测试 | 通过 / 通过 / **527 个全绿** |
| `audit:save` | 74 损坏用例全拒（含 0.3.0 存档拒绝） |
| `audit:deps`（架构） | R1-R4 全 PASS |
| `npm audit --omit=dev` | **0 漏洞（runtime PASS）** |
| `npm audit`（含 dev） | 5 个（3 moderate/1 high/1 critical，全在 vite/esbuild 链，已记录） |
| 版本 | 0.3.1（拒绝 0.3.0 及更早存档，无迁移） |

### 3.2 3000 局正式模拟

| 门 | 判定 | 数值 |
| --- | --- | --- |
| 引擎健康 | PASS | timeout=0 / deadlock=0 / illegalState=0 / hardLimit=0，可信率 100% |
| 角色平衡 | PASS | 胜率比 **1.24**（< 2.5），无 0 胜率（4.5%~5.6%） |
| 风格使用率 | PASS | quick 2.97% / heavy 17.82% / guard ≥2% |
| 命中一致性 | PASS | 理论/实测 Δpp：normal 0.13 / quick 0.24 / heavy 0.29（< 5） |
| 世界事件覆盖 | PASS | 6 种各 1426~1493 次（≥ 50） |
| 技能玩家侧 | PASS | 4 技能 playerUses 均 > 0（396~750） |
| **整体** | **PASS** | - |

### 3.3 16 局脚本化对局

覆盖 4 角色 / 4 技能 / 6 世界事件 / 三风格（quick·normal·heavy）/ EXPOSED / Guard /
制作目标 / **至少一次 finale**；卡死 0 / 16，引擎层 0 问题。

## 4. 规格回归摘要（技能 / 世界事件）

| 技能 | 数值 | 世界事件 | 数值 |
| --- | --- | --- | --- |
| 警觉侦察 | CD10/3体力/3回合，噪音增强+遭遇先手，不透视 | 停电 | 6 回合：遭遇×0.8、空手×1.1 |
| 肾上腺素 | CD12/3体力/2次攻击，+20%伤/-1体力/自伤+10%/6回合 | 暴雨 | 6 回合：移动+1、远程命中×0.9 |
| 现场加工 | CD10/2体力/下一次成功合成免费/6回合 | 广播 | 即时：只公布高噪音区域 |
| 应急处理 | CD10/3体力/+15HP/4回合治疗+25% | 医疗警报 | 5 回合：仅医院治疗×1.2 |
| — | — | 研究异常 | 4 回合：lab 每 tick 3 环境伤害（走 applyDamage） |
| — | — | 全域骚动 | 3 回合：噪音不衰减、搜索噪音×1.5 |

## 5. 交付清单

```text
PHASE3A1_BASELINE.md / PHASE3A1_REPORT.md / PHASE3A1_AUDIT_FIXES.md
SKILL_DESIGN.md / WORLD_EVENT_DESIGN.md / ARCHITECTURE_AUDIT.md / SUPPLY_CHAIN_AUDIT.md
VISUAL_ASSET_SPEC.md / HUMAN_PLAYTEST_CHECKLIST.md / README.md（0.3.1）
public/assets/manifest.json + characters/zones/items/world-events/effects/
.github/workflows/ci.yml（Node 20 + 100 局模拟）
reports/phase3a1-final-balance.json/.md、combat-statistics、skill-statistics、
  world-event-statistics、scripted-playthroughs（16 局）、command-results.txt
```

## 6. Phase 3 正式关闭

- 规则逐条符合已确定规格，不再由开发 Agent 自行更换技能/事件设计；
- 信息不完全无后门（侦察/广播不写入 playerIntel，测试守护）；
- 新机制有统计证据（3000 局 + 16 局脚本化 + 命中差 < 5pp）；
- CI 与供应链检查真实有效（Node 20、100 局模拟、npm audit 记录）；
- 正式视觉资产可在 Phase 4 通过 Manifest 替换，无需改核心逻辑。
