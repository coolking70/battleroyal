# Phase 3A 开发基线

> 本文件在 Phase 3A 任何代码修改**之前**建立，用于事后对照「改了什么、有没有越界」。
> 记录时间：2026-08-08

---

## 1. 基线坐标

| 项目 | 值 |
| --- | --- |
| 仓库 | https://github.com/coolking70/battleroyal |
| 分支 | `main` |
| 基线 commit | `c01bc80986196bac623fee97d2613880757c65c8` |
| commit 标题 | `feat: 区域式大逃杀网页游戏 v0.2.0（Phase 1-3 完整交付）` |
| 版本号 | `0.2.0` |
| 测试数 | **424 passed**（32 个文件） |
| 类型检查 | `tsc -p tsconfig.app.json --noEmit` 零错误 |
| 构建 | `vite build` 通过 |
| 存档 schema 版本 | `0.2.0`（`GameState.version`） |

> **验证陷阱备忘**：根 `tsconfig.json` 只是 references 壳，`npx tsc --noEmit` 是**假阴性**。
> 真类型检查必须用 `npx tsc -p tsconfig.app.json --noEmit`（或 `npm run typecheck`，即 `tsc -b --force`）。

---

## 2. 当前 Phase 3 实现

Phase 3 共 10 步，已交付内容：

| 模块 | 实现位置 | 说明 |
| --- | --- | --- |
| 攻击风格 | `core/combat.ts`、`data/gameConfig.ts` | quick / normal / heavy 三种，各有体力、伤害倍率、命中倍率、反击易伤倍率 |
| 防御姿态 | `core/combat.ts`、`core/actorCombatActions.ts` | `guarding` 布尔位，减免一次伤害后解除 |
| 四角色技能 | `core/skills.ts` | dash / sunder / field_repair / first_aid |
| 动态事件 | `core/dynamicEvents.ts` | storm / supply_drop / ambush |
| 视觉升级 | `ui/styles.css`、`ui/components/Bar.tsx` 等 | 状态条脉动、按钮质感、角色徽章 |
| 调试面板 | `ui/components/DebugPanel.tsx` | `?debug=1`：技能冷却 / 战斗风格概率 / 事件 / RNG 状态 |
| 脚本化对局 | `tools/scriptedPlaythroughs.ts` | 8 局，含技能与事件覆盖汇总 |
| 平衡 | `data/characters.ts`、`data/gameConfig.ts` | 2000 局胜率比 2.20 < 2.5 |

### 2.1 当前动态事件类型

```ts
// src/core/commandTypes.ts
export type DynamicEventType = 'storm' | 'supply_drop' | 'ambush';
```

| 事件 | 持续 | 效果 | 实现方式 |
| --- | --- | --- | --- |
| `storm` 风暴 | 3 | 区域内每回合 5 点伤害 | `StatusEffect{hpPerTick:-5}` + `applyHpChange` |
| `supply_drop` 空投 | 1（瞬时） | 向区域投放 3 件物资 | **`addLootItem()` 直接写隐藏库存** ← 违规 |
| `ambush` 伏击 | 1（瞬时） | NPC 突入玩家区域 + 8 点伤害 | **`attacker.currentZoneId = ...` 直接瞬移** ← 违规 |

调度字段：`state.activeEvents`、`state.nextDynamicEventTime`、`GAME_CONFIG.firstDynamicEventTime = 12`、间隔 9~15。

### 2.2 当前四角色技能

```ts
// src/core/skills.ts
export type SkillId = 'dash' | 'sunder' | 'field_repair' | 'first_aid';
```

| 角色 | 技能 | 体力 | CD | 效果 |
| --- | --- | --- | --- | --- |
| scout 侦察员 | `dash` 疾影 | 3 | 5 | 2 时间单位内 `evasionHitMult = 0.5` |
| fighter 斗士 | `sunder` 破甲 | 5 | 5 | 3 时间单位内 命中 ×1.12、伤害 ×1.6 |
| engineer 工程师 | `field_repair` 应急修理 | 3 | 5 | 体力回满 + 武器耐久 +25 + 回 20% maxHp |
| medic 医学生 | `first_aid` 急救 | 4 | 5 | 回 30% maxHp |

**问题**：四个技能全是纯战斗数值增益，与「搜索 / 路线 / 合成 / 信息」的战略身份无关。

### 2.3 当前 combat resolve 流程

`resolveAttack(state, attacker, defender, rng, style)`（`core/combat.ts:145`）：

```text
1. attacker.stats.attacks += 1 / state.stats.attacks += 1
2. spendStamina(attacker, attackStyleStaminaCost[style])
3. attacker.guarding = false            ← 出手即解除自身防御
4. zone.lastCombatTime = state.time / addNoise(combat)
5. 双方 knownEnemies 互相登记
6. const chance = hitChanceOf(attacker, defender)   ← ✗ style 未传入
7. const hit = rng.chance(chance)
8. 武器耐久 -1（命中与否都磨损），归零则销毁
9. miss → pushEvent(ATTACK_MISSED, metadata:{chance})   ← 无 style
10. hit  → computeDamage(attacker, defender, rng, style)
11.        defender.guarding → 伤害 ×(1-0.5)，解除 guarding
12.        applyDamage(state, defender, damage, attacker.id, '战斗')
13.        pushEvent(ATTACK_HIT, metadata:{damage, remainingHp})   ← 无 style/chance
```

`hitChanceOf(attacker, defender, style='normal')` 本身**是正确的**，公式：

```text
raw = baseHitChance + perception×0.012 + (speedA - speedD)×0.02 + rangedBonus
adjusted = raw × attackStyleHitMult[style]      // quick 1.15 / normal 1.0 / heavy 0.8
再乘攻击方 hitChanceMult、防御方 evasionHitMult
夹在 [minHitChance, maxHitChance]
```

也就是说：**UI 调 `hitChanceOf(a,b,style)` 拿到的是带风格的概率，而 core 实际掷骰用的是 `style='normal'` 的默认值** —— 这就是 BUG-01。

### 2.4 当前 simulate 报告字段

`tools/simulateBalance.ts` 的 `CellResult` 已有：

```text
games / wins / losses / draws / timeouts
winRate / lossRate / drawRate / timeoutRate
survivalCount / survivalRate
trustworthyCount / trustworthyRate
hardLimitCount / hardLimitRate
illegalCount / illegalRate / deadlockCount / stalledCount
emptyLegalSetCount / illegalCommandCount
avgTimeUsed / bestRank / worstRank / avgPlayerRank
avgKills / avgDamageDealt / avgDamageTaken / avgSearches
```

**缺失**：攻击风格分项（count / hit / hitRate / avgDamage）、Heavy 风险（heavyMiss / exposed*）、
Guard（count / triggered / damagePrevented）、每技能使用统计、每事件统计。

---

## 3. 当前已知 Phase 3 验收问题

| 编号 | 问题 | 位置 | 严重度 |
| --- | --- | --- | --- |
| BUG-01 | `resolveAttack` 未将 `style` 传入 `hitChanceOf` | `core/combat.ts:169` | **P0** — UI 显示概率与实际结算不符 |
| BUG-02 | Heavy miss 不产生 EXPOSED | `core/combat.ts` 无该逻辑 | P1 — Heavy 只有收益没有风险 |
| SPEC-01 | 四角色技能与既定规格不同 | `core/skills.ts` | P1 — 技能是纯数值增益，非战略身份 |
| SPEC-02 | 动态事件只有 storm / supply_drop / ambush | `core/dynamicEvents.ts` | P1 — 规格要求 6 种正式世界事件 |
| RULE-01 | `supply_drop` 直接修改隐藏库存 | `dynamicEvents.ts:159` `addLootItem()` | **P0** — 破坏「有限区域库存」不变量 |
| RULE-02 | `ambush` 直接瞬移 NPC | `dynamicEvents.ts:182` `attacker.currentZoneId=` | **P0** — 绕过统一移动规则 |
| REPORT-01 | 模拟报告缺攻击风格 / guard / skill / event 指标 | `tools/simulateBalance.ts` | P1 — 无法证明新玩法真被使用 |
| ASSET-01 | 缺 `visualAssets.ts` | 不存在 | P2 — Phase 4 资产管线无接口 |
| DOC-01 | 缺 Phase 3 设计文档 | 不存在 | P2 |

### 3.1 BUG-01 复现路径

```text
UI（ActionBar / EncounterPanel）
  → hitChanceOf(player, enemy, 'heavy')  → 显示「重击 命中 60%」
玩家点击重击
  → ATTACK 命令 → attackActor(..., 'heavy')
  → resolveAttack(..., 'heavy')
  → 内部 hitChanceOf(attacker, defender)   ← style 缺省为 'normal'
  → 实际按 75% 掷骰
```

结果：**玩家看到 60%，实际按 75% 结算**。三种风格的命中差异在实际战斗中**完全不存在**，
只有伤害倍率与反击易伤生效 —— 等于 heavy 是无脑最优解。

---

## 4. 预计修改文件

### 4.1 核心（必改）

```text
src/core/combat.ts              BUG-01 修复 + EXPOSED 触发 + 事件 metadata
src/core/vitals.ts              EXPOSED 伤害修正入口（仅战斗伤害）
src/core/skills.ts              四技能全部重写
src/core/worldEvents.ts         新建，取代 dynamicEvents.ts
src/core/dynamicEvents.ts       删除
src/core/types.ts               WorldEventState / EXPOSED 相关字段
src/core/commandTypes.ts        WorldEventType 取代 DynamicEventType
src/core/gameState.ts           activeWorldEvents / worldEventHistory / nextWorldEventTime
src/core/gameEngine.ts          事件调度接入
src/core/actionCosts.ts         rain 移动 +1 体力、field_craft 合成体力 0
src/core/search.ts              blackout 遇敌 -20% / 空手 +10%
src/core/consumables.ts         medical_alert +20% / MEDICAL_FOCUS +25%
src/core/info.ts                citywide_unrest 噪音不衰减 ×1.5
src/core/npcDecide.ts           四技能的 NPC 触发条件
src/core/saveValidation/*.ts    世界事件 + EXPOSED 字段校验
```

### 4.2 数据

```text
src/data/gameConfig.ts          删除 storm/supply/ambush 配置，新增 6 事件 + EXPOSED + 新技能配置
src/data/visualAssets.ts        新建
```

### 4.3 UI

```text
src/ui/components/EventLog.tsx        分类过滤
src/ui/components/StatusBar.tsx       EXPOSED 提示 + 世界事件横幅
src/ui/components/ActionBar.tsx       真实命中率
src/ui/components/EncounterPanel.tsx  战斗反馈
src/ui/styles.css                     EXPOSED / 事件 / 战斗反馈 / fallback 视觉
```

### 4.4 工具与测试

```text
tools/simulateBalance.ts        统计升级
tools/scriptedPlaythroughs.ts   8 局 → 12 局
tests/combatStyleIntegration.test.ts   新建
tests/exposed.test.ts                  新建
tests/worldEvents.test.ts              新建（取代 dynamicEvents.test.ts）
tests/worldEventInvariants.test.ts     新建
tests/skills.test.ts                   重写
tests/visualAssets.test.ts             新建
```

### 4.5 文档

```text
PHASE3A_REPORT.md / PHASE3A_AUDIT_FIXES.md
COMBAT_DESIGN.md / SKILL_DESIGN.md / WORLD_EVENT_DESIGN.md
VISUAL_ASSET_SPEC.md / DEPENDENCY_AUDIT.md
README.md（0.3.0）/ HUMAN_PLAYTEST_CHECKLIST.md（更新名称，保持未填写）
.github/workflows/ci.yml
```

---

## 5. 明确禁止修改的 Phase 2 核心

以下机制**已验收通过**，Phase 3A 不得重新设计。新功能必须服从这些不变量：

| # | 不变量 | 守护位置 |
| --- | --- | --- |
| 1 | 确定性 Seeded RNG（同种子完全重放） | `core/random.ts` |
| 2 | 有限区域库存（物资不会凭空增加） | `core/zoneLoot.ts`、`core/itemIntegrity.ts` |
| 3 | 玩家 / NPC 统一行动服务 | `core/actorActions.ts`、`core/actorActionBase.ts`、`core/actorCombatActions.ts` |
| 4 | 统一体力成本 | `core/actionCosts.ts` |
| 5 | 统一伤害 / 死亡流程（唯一入口 `applyHpChange`） | `core/vitals.ts` |
| 6 | 遭遇防死锁 | `core/legalActions.ts`（`MAX_RESOLUTION_LOOKAHEAD`） |
| 7 | 逃跑免费但推进时间 | `core/actorCombatActions.ts` |
| 8 | 深度存档校验（structure/numbers/references/consistency 四层） | `core/saveValidation/` |
| 9 | NPC 制作规划 | `core/npcGoalPlan.ts` |
| 10 | 信息不完全（不读隐藏状态作弊） | `core/info.ts` |
| 11 | 自动模拟矩阵（4 角色 × 5 策略） | `tools/simulateBalance.ts` |
| 12 | 终局收敛 | `core/phase.ts` |
| 13 | `--games` 表示**总**对局数 | `tools/simulateBalance.ts`、`tests/simulatorGamesSemantics.test.ts` |
| 14 | Scripted Playthrough 与人工试玩严格区分 | `tools/scriptedPlaythroughs.ts`、`HUMAN_PLAYTEST_CHECKLIST.md` |
| 15 | `core/` 单文件 < 500 行 | Phase 3 Step 10 已复位，当前最大 466 |

### 5.1 Phase 3A 新增的红线

| # | 红线 |
| --- | --- |
| 16 | **世界事件不得修改隐藏库存**（禁止 `addLootItem` 等） |
| 17 | **世界事件不得瞬移角色**（禁止直接写 `currentZoneId`） |
| 18 | **世界事件不得绕过 `applyDamage`**（禁止 `hp -= n`） |
| 19 | **EXPOSED 只对攻击类战斗伤害生效**（禁区 / 世界事件 / DoT / 终局衰竭不吃 +20%） |
| 20 | **UI 显示的命中率必须 === core 实际掷骰概率** |

---

## 6. 验收前后对照表（待 Phase 3A 结束填写）

| 指标 | 基线（Phase 3） | 目标（Phase 3A） |
| --- | --- | --- |
| 版本 | 0.2.0 | 0.3.0 |
| 测试数 | 424 | ≥ 500 |
| 模拟局数 | 2000 | 3000 |
| 胜率比 | 2.20 | < 2.5 |
| 世界事件种类 | 3（含 2 个违规） | 6（全部合规） |
| quick / heavy / guard 使用率 | 未统计 | 各 ≥ 2% |
| 理论 vs 实测命中偏差 | **无意义**（style 未生效） | < 5 个百分点 |
| GitHub CI | 无 | 有 |
