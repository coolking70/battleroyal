# SKILL_DESIGN.md — 四角色签名技能设计（Phase 3A-1 严格回归规格）

> 版本 0.3.1 · 与 `src/core/skills.ts` 逐字一致。本文档禁止与实现不一致。

## 1. 设计原则

四技能分别钉死四角色的战略身份，**数值严格按本表实现**，每个技能自带 `cooldown`
（禁止全局统一冷却）：

| 角色 | 技能 | ID | 体力 | 冷却 | 持续 | 核心效果 |
| --- | --- | --- | ---: | ---: | --- | --- |
| 侦察员 scout | 警觉侦察 | `scout_recon` | 3 | 10 | 3 时间单位 | 噪音情报增强 + SEARCH 遭遇先手；**不提供精确角色位置** |
| 斗士 fighter | 肾上腺素 | `adrenaline` | 3 | 12 | ≤6 时间单位 或 2 次攻击 | 攻击伤害 +20%、攻击体力 -1（下限 1）、自身受战斗攻击伤害 +10% |
| 工程师 engineer | 现场加工 | `field_craft` | 2 | 10 | 6 时间单位 | 下一次**成功**合成体力 0（失败不消费，成功即消失） |
| 医学生 medic | 应急处理 | `emergency_treatment` | 3 | 10 | 4 时间单位 | 立即恢复固定 15 HP；治疗类消耗品最终治疗量 +25% |

## 2. Scout · 警觉侦察（信息）

- **冷却 10 · 体力 3 · SCOUT_AWARENESS 持续 3 时间单位 · 技能使用本身推进 1 时间单位**
- **效果 1：噪音情报增强** —— 只提高公开噪音信息质量，绝对禁止读取
  `aliveCharacterIds` / NPC ID / 姓名 / 精确位置 / HP / 装备 / inventory：
  - 普通：quiet→安静 / active→有动静 / loud→嘈杂
  - 警觉：quiet→安静 / active→近期有人活动 / loud→近期活动频繁（可能发生过冲突）
  - 允许 `lastNoiseTime` 的**模糊**时间提示（刚刚 / 不久前 / 较早之前），禁止精确时间/人数/人物。
- **效果 2：SEARCH 遭遇先手** —— 警觉状态下 SEARCH 建立新遭遇时，
  该遭遇 `reconInitiative = true`：敌方在**遭遇建立瞬间**的首次立即反击/偷袭收益被抑制；
  玩家之后的正常攻击仍可触发正常反击（不是 3 回合免反击护盾）。
- **绝对禁止**：遍历 `aliveCharacterIds` 给玩家、写入所有相邻 NPC 身份、
  直接 `recordIntel` 所有 NPC、公开姓名/具体位置。技能执行后 `playerIntel` 不得新增任何记录。
- **NPC 使用**：只获得「对噪音区域的搜索权重提升」（`scoutAwarenessNpcSearchBoost` ×1.25），
  不得因此获得全图角色位置。

## 3. Fighter · 肾上腺素（战斗节奏）

- **冷却 12 · 体力 3 · 最多 6 时间单位 或 完成 2 次攻击（先发生者为准）**
- MUST 效果（`adrenaline` 状态字段）：
  - `remainingAttacks: 2`（第 3 次攻击起不再生效）
  - `damageMult: 1.20` —— **必须真正进入 `computeDamage`**（最终攻击伤害 +20%），不能只写 UI 描述
  - `attackStaminaDelta: -1`（攻击体力成本 -1，**下限 1**，走 `attackStaminaCostFor`）
  - `selfDamageTakenMult: 1.10`（状态期间受到**战斗攻击伤害** +10%；不得 1.25）
  - `remaining: 6`（6 时间单位兜底）
- 禁止：+25% 自伤、3 次攻击。

## 4. Engineer · 现场加工（合成）

- **冷却 10 · 体力 2 · 使用推进 1 时间单位 · FIELD_CRAFT 持续 6 时间单位**
- MUST 效果：仅**下一次成功合成**体力成本 0；合成仍推进正常 1 时间单位；
  成功合成后**立即移除** FIELD_CRAFT；6 时间单位未成功合成则失效。
- **失败合成不消费充能**（材料不足/体力不足被拒时充能保留）。
- 禁止：2 次免费合成、8 时间单位。

## 5. Medic · 应急处理（消耗品经济）

- **冷却 10 · 体力 3 · 使用推进 1 时间单位**
- MUST 效果：
  - 立即恢复 **固定 15 HP**（不是最大生命百分比），不超过 maxHp；
  - 获得 MEDICAL_FOCUS，持续 **4 时间单位**；
  - 期间治疗类消耗品最终治疗量 **+25%**（`consumableHealMult: 1.25`）。
- **明确禁止额外效果**：不清除流血 / DoT / 任何负面状态（本阶段无状态净化系统）。

## 6. 冷却与状态

- `SkillDef.cooldown` 每技能独立：scout_recon=10 / adrenaline=12 / field_craft=10 /
  emergency_treatment=10；删除全局 `skillCooldown`。
- 状态 id 常量在 `core/statusIds.ts`：`ADRENALINE_ID` / `FIELD_CRAFT_ID` /
  `MEDICAL_FOCUS_ID` / `SCOUT_AWARENESS_ID` / `EXPOSED_ID`。
- 存档：`skillCooldowns`（合法 id、非负）+ `statusEffects`（EXPOSED 红线）由
  `saveValidation/numbers.ts` 校验。

## 7. 测试契约（tests/skills.test.ts）

每技能至少覆盖：精确冷却 / 体力 / 持续 / 次数 / 数值 / 失效逻辑 / NPC 使用 / 存档冷却恢复；
Scout 额外：不暴露身份、不写 playerIntel、噪音增强、SEARCH 先手、普通攻击后仍可反击；
Fighter：+20% 真进 computeDamage、仅 2 次、体力 -1、自伤 +10%、6 回合兜底；
Engineer：仅 1 次、成功消失、失败不消费、6 回合失效；
Medic：固定 15HP、不超 maxHp、不清 DoT、+25%、4 回合结束。
