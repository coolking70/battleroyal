# COMBAT_DESIGN.md — 战斗系统设计（Phase 3A）

> 版本 0.3.0 · 本文档描述 Phase 3A 战斗系统的**最终形态**，与 `src/core/combat.ts` 实现一一对应。

## 1. 概览

战斗发生在「遭遇战」内：1 名玩家 vs 1 名 NPC（5 名 NPC 同场生存，逐个遭遇）。每次攻击由玩家或 NPC 发起，走同一条 `resolveAttack` 管线，规则只写一遍。

```
发起攻击
  ├─ 选风格 quick / normal / heavy（各有命中率、伤害、体力成本）
  ├─ 命中率 = hitChanceIn(state, attacker, defender, style)
  │     = 基础命中率 × 世界事件命中修正（雨 ×0.9 / 大停电 ×0.85）
  │     × 闪避修正，夹在 [minHitChance, maxHitChance] 之间
  ├─ 掷骰：命中 → 结算伤害（防御姿态减免 → EXPOSED 加成 → 肾上腺素自伤）
  │        未命中 → 若是 heavy，攻击方自己露出破绽（EXPOSED）
  └─ 伤害走 applyDamage 唯一入口（可致死、计入击杀）
```

## 2. 攻击风格（Phase 3 Step 1，保留）

| 风格 | 命中倍率 | 体力成本 | 定位 |
| --- | --- | --- | --- |
| quick | 高 | 低 | 速攻：体力紧张 / 求稳时用 |
| normal | 基准 1.0 | 基准 | 默认选项 |
| heavy | 低 | 高 | 高伤求速杀，**挥空 = 露出破绽** |

风格选择由 `npcDecide.chooseAttackStyle` 按人格决策（aggressive 占优时 heavy、cautious 体力紧时 quick、random 均匀随机）；玩家侧由 UI 按钮选择。

## 3. EXPOSED（露出破绽）— Phase 3A Step 3

重击挥空的代价：**自己**被挂上「露出破绽」，下一次受到**攻击类战斗伤害** +20%（`exposedDamageMult`）。

### 三条红线

| # | 红线 | 保证方式 |
| --- | --- | --- |
| 1 | **只由 heavy miss 产生** | `applyExposed` 只在 `resolveAttack` 的 `style === 'heavy' && !hit` 分支调用 |
| 2 | **只影响攻击类战斗伤害** | 伤害加成只写在 `resolveAttack` 内；禁区 / 世界事件 / DoT / 终局衰竭走 `applyDamage` 不经过此处，天然吃不到 |
| 3 | **不可叠加** | 重复获得只刷新，永远最多一层 |

### 生命周期（两个互斥失效条件）

- **条件A**：受到一次成功的战斗伤害 → 立即移除（破绽被兑现，`consumeExposedOnDamage`）。
- **条件B**：一直没挨打 → 自己完成**下一次**有效行动后移除（`noteOwnActionCompleted`）。

条件B 的坑：heavy miss 发生在角色自己这次行动的**中途**，若不处理，行动结束时会把刚生成的 EXPOSED 立刻清掉。因此创建时带 `skipOwnActionClearOnce = true`，由产生它的那次行动消费掉，从下一次行动起才真正计数。

### 存档与 UI

- 存档：`Combatant.statusEffects` 里 `id === 'exposed'`，`hpPerTick === 0`（绝不通过 DoT 扣血）、`damageTakenMult === exposedDamageMult`。`saveValidation/numbers.ts` 校验这些不变量。
- UI：遭遇面板与状态栏显示「露出破绽」标签；重击按钮标注「挥空破绽」风险。

## 4. 命中率同源（Phase 3A 不变量 #20）

**UI 显示的命中率必须 === core 实际掷骰概率。**

- 判定入口：`hitChanceIn(state, attacker, defender, style)`（含世界事件修正）。
- 展示入口：UI 只允许 import `hitChanceIn` / `fleeChanceIn`，**禁止**裸 `hitChanceOf` / `fleeChanceOf`（`tests/worldEventInvariants.test.ts` 有结构红线测试守护）。
- 历史教训（BUG-01）：Phase 3 曾漏传 style，导致 UI 显示带风格概率、核心实际按 normal 掷骰 —— 三种风格差异在真实战斗中完全不存在。Phase 3A 修复为「style 必须传入，UI 概率与核心概率是同一个数」。

## 5. 防御姿态

- `GUARD` 通常消耗配置中的体力；角色恰好为 0 体力时由共享成本层提供一次应急免费防御，
  体力为 1 时仍不足以支付完整成本。防御下一击减免 `guardDamageReduction`，被命中或自己出手后解除。
- 事件 `ATTACK_HIT.metadata.guarded` 记录是否成功减免，供模拟统计 `guardResolves`。

## 6. 肾上腺素自伤（斗士技能联动）

斗士开启「肾上腺素」后，自身承受攻击类战斗伤害 ×`skillAdrenalineSelfDamageMult`。与 EXPOSED 一样只作用在 `resolveAttack` 路径上（红线 #19 的姊妹规则）。

## 7. 战斗相关配置（gameConfig）

| 键 | 含义 |
| --- | --- |
| `minHitChance` / `maxHitChance` | 命中率夹取区间 |
| `exposedDamageMult` / `exposedMaxDuration` | EXPOSED 伤害倍率 / 兜底剩余时长 |
| `attackStyleStaminaCost` | 三种风格的体力成本 |
| `guardDamageReduction` | 防御姿态减免比例 |

## 8. 模拟统计口径（Step 9）

`AutoGameResult` 从对局事件扫描出：`attackStyleCounts`（quick/normal/heavy 次数）、`exposedApplied`（重击挥空挂破绽）、`exposedConsumed`（破绽被兑现）、`guardResolves`（防御成功减免）。这些与 UI、存档共用 `state.events` 作为唯一数据源。
