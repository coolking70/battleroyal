# PHASE3A1_BASELINE.md — Phase 3A-1 开发基线

> 建立时间：2026-08-08 · 基线 commit：`207f4a4`（Phase 3A 交付提交）

## 1. 基线状态

| 项 | 值 |
| --- | --- |
| 当前 commit SHA | `207f4a437d56489dafdf37224f2c3fb11625a0e5` |
| 当前测试数 | 491（35 文件） |
| 当前版本 | 0.3.0 |

### 1.1 当前四技能实现（基线）

| 技能 | 实现 |
| --- | --- |
| 战场侦察 scout_recon | 遍历 aliveCharacterIds 写 playerIntel（**偏离规格**） |
| 肾上腺素 adrenaline | 3 次攻击 / 自伤 25%（**偏离**） |
| 野外工造 field_craft | 2 次免费合成 / 8 回合（**偏离**） |
| 紧急处置 emergency_treatment | 12% 最大生命回血 + 清除 DoT（**偏离**） |
| 统一冷却 | `skillCooldown = 6`（**禁止，需删除**） |

### 1.2 当前六世界事件实现（基线）

| 事件 | 实现 | 偏离 |
| --- | --- | --- |
| blackout | 区域、命中 ×0.85、搜索 ×0.7、屏蔽情报 | 偏离 |
| rain | 命中 ×0.9、逃跑 +0.1 | 偏离 |
| emergency_broadcast | 全局 3 回合 revealAll 公开全部位置 | 偏离 |
| medical_alert | 全局治疗 ×0.75 + 医疗搜索 +0.35 | 反向 |
| research_anomaly | 材料搜索 +0.6、耐久损耗 +1 | 换机制 |
| citywide_unrest | NPC 攻击 +0.25、遭遇 ×1.3 | 换机制 |

### 1.3 当前信息系统

- `recordIntel` 有 `intelBlocked`（停电屏蔽 sight）；
- `refreshPlayerSight` 有 `revealAll` 广播全量写入；
- 侦察技能写 `playerIntel`（身份+精确位置）。

### 1.4 当前模拟报告字段

`attackStyleCounts / exposedApplied / exposedConsumed / guardResolves / skillUseCounts / worldEventCounts`
（缺攻击风格细分、Guard 4 项、EXPOSED 5 项、技能玩家/NPC 分列、事件影响统计）。

### 1.5 当前 CI / 审计 / 资产

- CI：`.github/workflows/ci.yml`（typecheck+test+build+audit:save+audit:deps，Node 22，无 simulate）。
- 架构审计：`tools/auditDependencies.ts`（R1-R4）+ `DEPENDENCY_AUDIT.md`（将更名 ARCHITECTURE_AUDIT）。
- npm 审计：**从未真实执行**。
- 资产：`src/ui/visualAssets.ts` + `src/ui/assets/`（SVG fallback），无 `public/assets/manifest.json`。

## 2. 本轮 15 项未闭环问题

```text
SPEC-01 侦察员技能偏离规格
SPEC-02 斗士技能偏离规格
SPEC-03 工程师技能偏离规格
SPEC-04 医学生技能偏离规格
SPEC-05 六世界事件效果偏离规格
INFO-01 侦察技能泄露精确身份位置
INFO-02 紧急广播泄露全部幸存者位置
QA-01 测试数491 < 500
QA-02 CI缺100局快速模拟
QA-03 未真正执行npm供应链审计
REPORT-01 Phase3A模拟统计字段不完整
ASSET-01 资产接口仍偏UI内部，Phase4替换路径不够稳定
```

## 3. 目标规格摘要（修复后必须逐字一致）

- 技能：警觉侦察（CD10/3体力/3回合/噪音增强+遭遇先手/不透视）、肾上腺素（CD12/3体力/2次攻击/
  伤害+20%/体力-1下限1/自伤+10%/6回合）、现场加工（CD10/2体力/下一次成功合成免费/6回合）、
  应急处理（CD10/3体力/固定+15HP/4回合治疗+25%）。
- 事件：停电（6/遭遇×0.8/空手×1.1）、暴雨（6/移动+1/远程×0.9）、广播（即时/高噪音区）、
  医疗警报（5/仅医院×1.2）、研究异常（4/lab每tick 3环境伤害）、骚动（3/噪音不衰减/搜索噪音×1.5）。
- 工程：版本 0.3.1；测试 ≥ 520；CI Node 20 + 100 局模拟；npm audit 真实执行；asset manifest 三级 fallback。
