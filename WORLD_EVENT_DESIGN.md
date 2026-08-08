# WORLD_EVENT_DESIGN.md — 世界事件设计（Phase 3A-1 严格回归规格）

> 版本 0.3.1 · 与 `src/core/worldEvents.ts` + `src/core/worldEventTick.ts` 逐字一致。
> 数值与本文档不一致即视为缺陷。

## 1. 事件一览（禁止加入未授权额外效果）

| ID | 名称 | 范围 | 持续 | 效果 |
| --- | --- | --- | ---: | --- |
| `blackout` | 停电 | 全局 | 6 | 搜索遭遇敌人权重 ×0.8、空手权重 ×1.1（搜索与发现变得不可靠；**不碰战斗命中**） |
| `rain` | 连绵阴雨 | 全局 | 6 | 移动体力成本 +1（走 `actionCosts`）；远程武器命中率 ×0.9（近战命中、逃跑率不变） |
| `emergency_broadcast` | 紧急广播 | 全局 | 即时 | 只公布「最近噪音最高」的区域之一；无持续时间、不进入 active |
| `medical_alert` | 医疗警报 | 医院 | 5 | 医院内治疗类消耗品最终治疗量 ×1.2（其他区域不受影响） |
| `research_anomaly` | 研究异常 | 研究所（固定） | 4 | 每时间单位对仍在 lab 的存活角色造成 3 点环境伤害（走 `applyDamage`） |
| `citywide_unrest` | 全域骚动 | 全局 | 3 | 区域噪音停止自然衰减；搜索产生的噪音 ×1.5 |

## 2. 各事件详述

### 2.1 停电 blackout

- MUST：`enemyWeight *= 0.8`、`nothingWeight *= 1.1`（`computeSearchWeights` 内，再统一归一化）。
- 禁止：所有攻击命中率 -15%、屏蔽情报、把 findWeight 降到 0.7。
- 设计目标：**搜索与发现变得不可靠**，不是「所有人突然不会战斗」。

### 2.2 连绵阴雨 rain

- MUST：移动体力成本 +1（**玩家与 NPC 同时生效**，必须通过 `actionCosts.moveStaminaCostFor`
  统一实现，禁止在 player MOVE / NPC MOVE 两处分别硬编码）；远程武器攻击命中率 ×0.9
  （优先乘数，保持现有概率框架一致）。
- 禁止：影响近战命中、逃跑概率；删除旧的 `fleeBonus +0.1`。

### 2.3 紧急广播 emergency_broadcast

- 类型：**即时**，不需要持续 3 回合；不进入 activeWorldEvents。
- 内容：从公开 noise 数据中选择**最近噪音最高**的区域之一：
  「监控发现『研究所』近期活动频繁。」或「『工厂』近期传出明显动静。」
  无有效噪音时输出「监控暂未发现明显集中活动。」等泛化提示。
- 绝对禁止：公布幸存者姓名 / NPC ID / 每人所在区域 / 精确存活人数 / 装备 / HP；
  删除 `revealAll` 修正与 `refreshPlayerSight` 的广播全量写入。

### 2.4 医疗警报 medical_alert

- 作用区域：**hospital**（固定区域）。
- MUST：角色位于医院且使用治疗类消耗品 → 最终治疗量 ×1.2（`healMultiplier = 1.20`），
  仅医院生效（`worldModifiersAt(state,'hospital')`）。
- 禁止：全局治疗 -25%、提高医疗物资搜索率。

### 2.5 研究异常 research_anomaly

- 固定区域：**lab**（不是随机区域）。
- MUST：每时间单位对**仍在 lab 中**的存活角色造成 3 点环境伤害，必须走
  `applyDamage(state, actor, 3, null, '研究设施异常')` 统一入口；
  能正确致死、死亡只发生一次、写 `damageTaken`、写 `WORLD_EVENT_DAMAGE` 事件。
- 禁止：增加材料搜索率、额外损耗装备耐久。

### 2.6 全域骚动 citywide_unrest

- MUST 1：区域噪音停止自然衰减（`decayNoise` 期间不降低 noiseLevel，计入
  `stats.noiseDecayBlockedTicks`）。
- MUST 2：搜索产生的噪音 ×1.5（`addNoise` 对 search 源放大；noiseLevel 允许取整说明：
  本实现 `Math.ceil` 向上取整）。
- 结束后恢复正常衰减。
- 禁止：直接增加 NPC 攻击倾向、增加搜索遭遇率（旧 `unrestAggressionBonus` /
  `unrestEncounterMult` 已删除）。

## 3. 世界事件红线（RULE-WE-01 ~ 08）

| # | 红线 |
| --- | --- |
| WE-01 | 不得直接 `actor.hp -= x` |
| WE-02 | 不得直接 `actor.alive = false` |
| WE-03 | 不得直接修改 `currentZoneId` |
| WE-04 | 不得增加隐藏 `zone.loot` |
| WE-05 | 不得创建未登记物品 UID |
| WE-06 | 环境伤害必须走 `applyDamage`（研究异常经 `worldEventTick.ts`，行为层测试保证） |
| WE-07 | 移动成本必须走 `actionCosts` |
| WE-08 | 信息事件不得读取隐藏人物信息（广播只读公开噪音） |

说明：上一轮「worldEvents.ts 绝对不能 import vitals」的结构限制已取消；
为规避 `vitals → info → worldEvents` 循环依赖，环境伤害放在 `worldEventTick.ts`，
行为上仍走 `applyDamage` 唯一入口。

## 4. 行为规则测试契约（tests/worldEventInvariants.test.ts）

| 事件 | 必须测试 |
| --- | --- |
| Blackout | enemyWeight 变低、nothingWeight 变高、不改变战斗命中 |
| Rain | 玩家/NPC MOVE +1、远程命中降低、近战命中不变、逃跑率不变 |
| Broadcast | 选高 noise 区域、不写所有 NPC playerIntel、不显示精确人数 |
| Medical Alert | 医院治疗 +20%、其他区域不受影响 |
| Research Anomaly | lab 每 tick -3、其他区域 0、可致死且死亡流程正确 |
| Citywide Unrest | noise 不衰减、search 噪音增加、结束后恢复正常衰减 |
