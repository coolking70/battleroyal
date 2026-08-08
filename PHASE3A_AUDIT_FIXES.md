# PHASE3A_AUDIT_FIXES.md — Phase 3A 审计修复记录

> 记录 Phase 3A 开发过程中发现的问题与修复方式，按严重度排序。

## 1. BUG-01 · 攻击风格漏传导致 UI 命中率 ≠ 核心概率（P0，Step 2 修复）

- **现象**：`resolveAttack` 未把 `style` 传入命中率计算，核心实际按 `'normal'` 掷骰，而 UI 显示的是带风格的概率 —— 三种风格的命中差异在真实战斗中完全不存在。
- **影响**：违反红线 #20（UI 命中率 === core 实际概率），quick/heavy 沦为摆设。
- **修复**：`hitChanceIn(state, attacker, defender, style)` 成为判定唯一入口；`resolveAttack` 显式传 style；事件 `metadata` 记录 `style` 与 `chance`（百分数），UI 与模拟统计共用同一字段。
- **守护**：`tests/combatStyleIntegration.test.ts`（失败用例先行）；`tests/worldEventInvariants.test.ts` 新增「UI 不得 import 裸 hitChanceOf/fleeChanceOf」结构红线。

## 2. 存档校验事件名单缺漏 `GUARD`（P1，Step 6 顺带修复）

- **现象**：`saveValidation/types.ts` 的 `EVENT_TYPE_SET` 手写数组漏了 `GUARD` 事件类型 —— 含 `GUARD` 事件的合法存档可能被误拒。
- **修复**：改为编译期穷举 `const EVENT_TYPE_TABLE: Record<GameEventType, true>` 再取键，联合类型新增事件时名单自动同步，杜绝漂移。
- **守护**：`tests/saveValidation.test.ts` 对照组覆盖。

## 3. `pickZoneId` 字段名写错（P1，Step 6 修复）

- **现象**：`z.restricted` 不存在（正确字段为 `z.status !== 'restricted'`），区域事件可能选到禁区或直接异常。
- **修复**：改为 `z.status !== 'restricted'`。
- **守护**：`auditWorldEventInvariants` 校验区域事件 zoneId 必须为合法区域。

## 4. 存档校验的 statusEffects/skillCooldowns 块被嵌进 NPC 计划 else 分支（P1，Step 8 修复）

- **现象**：Step 8 新增的状态效果（EXPOSED 红线）与技能键名校验被错误地放在「有制作目标」的 `else` 分支内 —— 无目标的玩家永远不会触发校验，EXPOSED 篡改检测形同虚设。
- **修复**：把校验移到 `saveValidation/numbers.ts` 的角色循环体（对所有角色生效，与既有 skillCooldowns 值校验同处），并用 node 脚本安全删除 references.ts 中误置的块（含括号平衡校验）。
- **守护**：`tests/saveValidation.test.ts` 新增 8 个用例（未知状态 / EXPOSED hpPerTick / damageTakenMult 不符 / 重复 EXPOSED / 未知技能 / 负冷却）+ `audit:save` 74 用例。

## 5. UI 遭遇面板仍用裸 `hitChanceOf` / `fleeChanceOf`（P1，Step 12 修复）

- **现象**：Step 6 给 core 加了 `hitChanceIn`（含世界事件修正），但 `EncounterPanel` 仍用裸函数 —— 雨天/停电时 UI 显示的命中率与核心掷骰不一致，违反红线 #20。
- **修复**：`EncounterPanel` 增加 `state` prop，全部切换为 `hitChanceIn` / `fleeChanceIn`；顺带补 EXPOSED / 防御标签与 heavy 挥空风险标注。
- **守护**：结构红线测试（见 #1）。

## 6. `npcDecide.ts` 超过 500 行不变量（P2，Step 13 修复）

- **现象**：Phase 3A 新增 NPC 技能决策后 `npcDecide.ts` 涨到 501 行，违反不变量 #15（core 单文件 < 500）。
- **修复**：技能决策整块（`readySkill` / `hasHealingConsumable` / `npcSurvivalSkill` / `npcCombatSkill`）抽到新模块 `core/npcSkillDecide.ts`；主文件回落至 4xx 行。
- **守护**：`npm run audit:deps`（R4）常驻 CI；当前 core/data 最大文件 `types.ts` 486 行。

## 7. 探针 import 名不匹配（P3，Step 6 收尾）

- **现象**：临时探针引用了不存在的 `newGame` / `legalActions` 导出名，导致验证脚本跑不起来。
- **修复**：改用 `createGame` / `getTimeAdvancingActions`；120 局随机走子确认 6 种世界事件全部真实触发（各 39~51 次），随后清理探针。
