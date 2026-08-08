# SKILL_DESIGN.md — 四角色签名技能设计（Phase 3A）

> 版本 0.3.0 · 与 `src/core/skills.ts` 一一对应。

## 1. 设计原则

Phase 3 的四个技能全是「回血 / 加伤 / 闪避」纯数值增益，角色差异退化成**数字大小**。Phase 3A 把每个技能钉死在该角色的**战略身份**上：

| 角色 | 技能 | 战略维度 | 核心效果 |
| --- | --- | --- | --- |
| 侦察员 scout | `scout_recon` 战场侦察 | **信息** | 一次性看穿当前 + 相邻区域的人 |
| 斗士 fighter | `adrenaline` 肾上腺素 | **战斗节奏** | 接下来 N 次攻击省体力，代价是自己更脆 |
| 工程师 engineer | `field_craft` 野外工造 | **合成** | 接下来 N 次合成不要体力 |
| 医学生 medic | `emergency_treatment` 紧急处置 | **消耗品经济** | 止血，并让治疗品增效 |

`adrenaline` 是**唯一带负面代价**的技能 —— 刻意为之：斗士本来就是「主动开战换收益」的角色，纯增益会让 heavy + 技能变成无脑最优。

## 2. 通用规则（不变红线）

1. 玩家与 NPC 走同一个 `useSkill`，规则只写一遍（`actorCombatActions.useSkillActor` 与 NPC AI 共用）。
2. 技能有体力成本与冷却（`skillCooldowns`，每时间单位衰减），不能连放。
3. 本模块**不消耗 RNG** —— 同种子下技能结果完全确定。
4. 前置校验 `canUseSkill`：存活 + 拥有该技能 + 冷却就绪 + 体力足够。

## 3. 各技能详述

### scout_recon · 战场侦察

- **触发时机**：两眼一抹黑（不知道任何对手在哪）时。
- **效果**：立刻查明当前区域与所有相邻区域里还活着的对手位置（写入情报）。
- **维度**：信息。侦察员靠它盘活「情报驱动」打法，而不是堆伤害。

### adrenaline · 肾上腺素（唯一负面技能）

- **效果**：接下来 `skillAdrenalineAttacks` 次攻击体力 -1（`attackStaminaDelta`）；代价是这期间自身受到的**攻击类战斗伤害** ×`skillAdrenalineSelfDamageMult`。
- **维度**：战斗节奏。斗士用「更脆」换「连击节奏」，与 heavy + EXPOSED 的风险逻辑同构（只作用于 `resolveAttack` 路径，红线 #19）。
- **存档**：`statusEffects` 中 `id === 'adrenaline'`，字段 `attackStaminaDelta` / `selfDamageTakenMult` / `remainingAttacks`。

### field_craft · 野外工造

- **触发时机**：马上就要合成、但体力刚好不够时。
- **效果**：接下来 `skillFieldCraftCharges` 次合成不消耗体力（`remainingCrafts`）。
- **维度**：合成。把工程师的「免费野外合成」从固定次数改成「免体力充能」，逼迫玩家在正确时机开。

### emergency_treatment · 紧急处置

- **触发时机**：手里有治疗品且血量吃紧。
- **效果**：立即止血（回少量血），并在 `skillTreatmentDuration` 个时间单位内让治疗类消耗品效果 +`skillTreatmentConsumableMult`（状态 `medical_focus`）。
- **维度**：消耗品经济。空着背包开 = 浪费行动与冷却。

## 4. 冷却与状态

- `Combatant.skillCooldowns: Record<SkillId, number>` 每时间单位衰减，0 即就绪。
- `useSkill` 写入 `SKILL_USED` 事件（`metadata.skillId`），供 UI 日志与模拟统计（`skillUseCounts`）同源读取。
- 状态效果 id 常量集中在 `core/statusIds.ts`（`ADRENALINE_ID` / `FIELD_CRAFT_ID` / `MEDICAL_FOCUS_ID` / `EXPOSED_ID`），避免循环依赖。

## 5. 存档校验（Step 8）

- `skillCooldowns`：key 必须是合法技能 id（`SKILLS` 键集），value 为非负有限整数。
- `statusEffects`：id 必须在合法集合内、同一状态不重复、remaining 为正整数、hpPerTick 有限；EXPOSED 额外要求 `hpPerTick === 0` 且 `damageTakenMult === exposedDamageMult`。
- 守护位置：`core/saveValidation/numbers.ts`（Step 8 新增）。
