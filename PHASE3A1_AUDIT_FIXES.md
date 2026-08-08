# PHASE3A1_AUDIT_FIXES.md — Phase 3A-1 审计修复记录

> 逐项记录 §55 要求的 15 项未闭环问题的 原问题 / 根因 / 修改文件 / 修复方式 / 新测试 / 验证结果。

## SPEC-01 · 侦察员技能偏离规格（精确位置泄露）

- **原问题**：`战场侦察`（scout_recon）直接遍历当前+相邻区域 `aliveCharacterIds`，
  对玩家写 `playerIntel`（身份+精确区域），违反信息不完全核心原则。
- **根因**：Phase 3A 把技能设计成「一次性身份快照」，与「身份只能靠交手换取」冲突。
- **修改文件**：`src/core/skills.ts`、`src/core/info.ts`、`src/core/search.ts`、`src/core/npcAi.ts`。
- **修复方式**：重做为「警觉侦察」——只挂 `SCOUT_AWARENESS`（3 回合）：噪音情报增强 +
  SEARCH 遭遇先手（`EncounterState.reconInitiative`）；删除 `runReconnaissance`；
  NPC 侧只获得搜索权重加成。
- **新测试**：`tests/skills.test.ts`（使用前后 playerIntel 为空、不更新旧情报）、
  `tests/infoIncompleteness.test.ts`（§27 全套）。
- **验证**：技能后 `playerIntel` 零新增；`EncounterPanel` 只显示遭遇对象。

## SPEC-02 · 斗士技能数值偏离

- **原问题**：3 次攻击 / 自伤 25%，且伤害 +20% 未真正进入 computeDamage（仅文案）。
- **根因**：Phase 3A 配置 `skillAdrenalineAttacks=3`、`selfDamageMult=1.25`，状态未带 damageMult。
- **修改文件**：`src/data/gameConfig.ts`、`src/core/skills.ts`、`src/core/combat.ts`。
- **修复方式**：`remainingAttacks=2`、`selfDamageTakenMult=1.10`、`damageMult=1.20` 写入
  状态，computeDamage 已乘 statusEffects.damageMult → +20% 真正落地；体力 -1 下限 1。
- **新测试**：`tests/skills.test.ts`（伤害 +20% 进 computeDamage、仅 2 次、自伤 +10%、6 回合）。
- **验证**：单测全绿；模拟肾上腺素覆盖攻击 5068 次、加成伤害 5085。

## SPEC-03 · 工程师技能充能次数偏离

- **原问题**：2 次免费合成 / 8 回合。
- **根因**：`skillFieldCraftCharges=2`、`Duration=8`。
- **修改文件**：`src/data/gameConfig.ts`、`src/core/skills.ts`、`src/core/crafting.ts`、`src/core/actionCosts.ts`。
- **修复方式**：`remainingCrafts=1`、`Duration=6`；`consumeFieldCraftCharge` 成功合成后立即移除；
  失败合成不消费（原有守卫保留）。
- **新测试**：`tests/skills.test.ts`（仅 1 次、成功消失、失败不消费、6 回合失效）。
- **验证**：全绿。

## SPEC-04 · 医学生技能额外净化与百分比回血

- **原问题**：按最大 HP 百分比回血 + 清除所有 DoT。
- **根因**：`skillTreatmentInstantHealRatio=0.12` + 过滤 hpPerTick<0 的状态。
- **修改文件**：`src/data/gameConfig.ts`、`src/core/skills.ts`。
- **修复方式**：固定 `+15 HP`（`applyHealing(..., 15)`），**不**清除任何状态；
  MEDICAL_FOCUS 持续 4 回合、治疗 +25%。
- **新测试**：`tests/skills.test.ts`（固定 15、不超 maxHp、不清 DoT、+25%、4 回合结束）。
- **验证**：全绿。

## SPEC-05 · 停电 blackout 偏离

- **原问题**：区域级、命中 ×0.85、搜索 ×0.7、屏蔽情报。
- **根因**：Phase 3A 设计为「环境修正型」命中/搜索双乘。
- **修改文件**：`src/core/worldEvents.ts`、`src/core/search.ts`、`src/core/combat.ts`。
- **修复方式**：全局 6 回合；`searchEnemyMult=0.8`、`searchNothingMult=1.1`；命中不受影响。
- **新测试**：`tests/worldEventInvariants.test.ts`（enemy 低、nothing 高、命中不变）。
- **验证**：全绿。

## SPEC-06 · 暴雨 rain 偏离

- **原问题**：命中 ×0.9 全局、逃跑 +0.1。
- **根因**：旧 `rainHitMult` / `rainFleeBonus`。
- **修改文件**：`src/core/worldEvents.ts`、`src/core/actionCosts.ts`、`src/core/combat.ts`、`src/core/actorActions.ts`、`src/core/actorActionBase.ts`、`src/core/legalActionBuilders.ts`。
- **修复方式**：移动 +1（`moveStaminaCostFor` 统一接入，玩家/NPC 共用）；远程命中 ×0.9（近战/逃跑不变）。
- **新测试**：`tests/worldEventInvariants.test.ts`（玩家/NPC MOVE+1、远程低、近战/逃跑不变）。
- **验证**：全绿。

## SPEC-07 · 紧急广播泄露全场位置

- **原问题**：revealAll → refreshPlayerSight 广播全部存活者位置。
- **根因**：`WorldEventModifiers.revealAll`。
- **修改文件**：`src/core/worldEvents.ts`、`src/core/info.ts`。
- **修复方式**：删除 `revealAll` 与广播全量写入；改为即时事件 `pickBroadcastZone`（高噪音区域）。
- **新测试**：`tests/worldEventInvariants.test.ts`、`tests/infoIncompleteness.test.ts`（广播不新增 playerIntel）。
- **验证**：全绿。

## SPEC-08 · 医疗警报反向效果

- **原问题**：全局治疗 -25% + 医疗搜索 +0.35。
- **根因**：`medicalAlertHealMult=0.75`。
- **修改文件**：`src/core/worldEvents.ts`、`src/data/gameConfig.ts`。
- **修复方式**：仅医院 `healMultiplier=1.2`（zone-scope hospital）。
- **新测试**：`tests/worldEventInvariants.test.ts`（医院 +20%、其他区域不变）。
- **验证**：全绿。

## SPEC-09 · 研究异常换机制

- **原问题**：材料搜索 +0.6、装备损耗 +1（无伤害）。
- **根因**：Phase 3A 禁止实体伤害的错误红线。
- **修改文件**：`src/core/worldEvents.ts`、`src/core/worldEventTick.ts`、`src/core/gameEngine.ts`、`src/core/types.ts`。
- **修复方式**：固定 lab、每 tick 3 环境伤害走 `applyDamage`（`worldEventTick.ts` 断环），
  写 `WORLD_EVENT_DAMAGE` 事件；删除材料/耐久修正。
- **新测试**：`tests/worldEventInvariants.test.ts`（lab -3、其他 0、可致死、死亡流程正确）。
- **验证**：全绿；模拟 3000 局研究异常伤害 20038、致死 52。

## SPEC-10 · 全域骚动换机制

- **原问题**：NPC 攻击倾向 +0.25、遭遇权重 ×1.3。
- **根因**：旧 `unrestAggressionBonus` / `unrestEncounterMult`。
- **修改文件**：`src/core/worldEvents.ts`、`src/core/info.ts`、`src/core/npcDecide.ts`、`src/core/types.ts`。
- **修复方式**：噪音停止衰减（`noiseDecayBlocked`，计入 `stats.noiseDecayBlockedTicks`）+ 搜索噪音 ×1.5。
- **新测试**：`tests/worldEventInvariants.test.ts`（噪音不衰减、搜索噪音增、结束恢复）。
- **验证**：全绿。

## QA-01 · 测试数 491 < 500

- **根因**：规格回归需要新增技能/事件/信息/统计/资产/确定性测试。
- **修改文件**：`tests/skills.test.ts`、`tests/worldEventInvariants.test.ts`、`tests/infoIncompleteness.test.ts`、
  `tests/phase3a1Stats.test.ts`、`tests/determinism.test.ts`、`tests/visualAssets.test.ts`、`tests/save.test.ts`。
- **验证**：**527 个全绿**（38 文件）；未删除旧测试（仅修改测旧规格的断言）。

## QA-02 · CI 缺 100 局快速模拟

- **修改文件**：`.github/workflows/ci.yml`。
- **修复方式**：增加 `npm run simulate -- --games 100 --seed-prefix CI`；Node 统一 20。
- **验证**：simulate 整体 FAIL 时 `process.exitCode=1`（`simulateBalance.ts` 已具备）。

## QA-03 · npm 供应链审计未执行

- **修改文件**：新增 `SUPPLY_CHAIN_AUDIT.md`；`DEPENDENCY_AUDIT.md → ARCHITECTURE_AUDIT.md`。
- **验证**：`npm audit --omit=dev` = 0 漏洞；`npm audit` 5 个 dev 漏洞全部记录。

## REPORT-01 · 模拟统计不完整

- **修改文件**：`tools/autoPlayer.ts`、`tools/simulateBalance.ts`、`src/core/combat.ts`、
  `src/core/search.ts`、`src/core/crafting.ts`、`src/core/consumables.ts`、`src/core/actorActions.ts`。
- **修复方式**：攻击风格细分（attempts/hits/misses/hitRate/damage/avgShownChance/deltaPP）、
  Guard 4 项、EXPOSED 5 项、技能收益（玩家/NPC 分列）、世界事件影响统计；
  修复**事件裁剪导致的命中率高估**（pruneEvents 丢 minor miss 事件 → 全量事件 id 去重收集）。
- **新测试**：`tests/phase3a1Stats.test.ts`。
- **验证**：3000 局 Δpp 0.13~0.29 < 5。

## ASSET-01 · 正式资产替换层缺失

- **修改文件**：`src/ui/visualAssets.ts`、新增 `public/assets/`（manifest + 5 目录）、
  `src/ui/screens/GameScreen.tsx`、`src/ui/components/ZoneMap.tsx/StatusBar.tsx/Inventory.tsx`。
- **修复方式**：`getCharacterVisual/getZoneVisual/getItemVisual/getWorldEventVisual` 统一接口 +
  三级 fallback（正式 > SVG > emoji）；React 组件全部切换，不硬编码图片路径。
- **新测试**：`tests/visualAssets.test.ts`（manifest 缺失/为空/正式图存在/SVG 缺失 → 对应 fallback）。
- **验证**：全绿；`public/assets/manifest.json` 存在且 version=1。
