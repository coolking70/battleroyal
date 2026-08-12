# Phase 4I-1 报告：技能成长（等级解锁第二技能）

## 结论

Phase 4I-1 已完成。四个角色各增加一个 Lv.3 第二技能；解锁由已有的
`level` 纯函数推导，不新增存档字段、不改 `GAME_VERSION`（仍为 `0.4.0`）。
主技能查询保持兼容，玩家和 NPC 均通过同一个 `canUseSkill` / `useSkill` 通道。

最终门禁为 **87 test files / 1433 tests，全部通过**；基线 86 / 1423 未减少。

## 技能与互补性

| 角色 | 既有主技能 | Lv.3 第二技能 | 体力 / 冷却 | 效果与互补方向 |
| --- | --- | --- | --- | --- |
| 侦察员 | 警觉侦察 | 烟幕转位 `scout_smoke` | 3 / 10 | 复用 `evasionHitMult=0.75`，从信息优势补到生存转位 |
| 斗士 | 肾上腺素 | 精准节拍 `fighter_focus` | 3 / 12 | 复用 `hitChanceMult=1.15`，从攻击节奏补到命中稳定性 |
| 工程师 | 现场加工 | 临时加固 `engineer_reinforce` | 2 / 10 | 复用 `defenseBonus=2`，从合成优势补到承伤能力 |
| 医学生 | 应急处理 | 持续止血 `medic_regen` | 3 / 10 | 复用 `hpPerTick=4`，从治疗品增效补到持续恢复 |

所有第二技能都有正体力成本，零体力时统一被 `canPayStamina` 拒绝；没有新增
资源、状态机或随机抽取。现有 `StatusEffect` 的通用字段承担命中、闪避、防御和
持续恢复效果，战斗公式本身未改动。

## 解锁与调用兼容

新增 `src/core/skillDefinitions.ts`，把定义、角色技能集合和状态 id 从原
`skills.ts` 拆出后再加入第二技能，两个文件均低于 500 行。技能集合按“主技能、
第二技能”固定排序：

- `getCharacterSkills(characterId)` 返回完整集合；
- `getCharacterSkill(characterId)` 保留为主技能兼容函数，仍只返回第一项；
- `canUseSkill` 先校验拥有关系和 `actor.level >= def.unlockLevel`，再校验冷却与体力；
- 锁定技能不进入 `legalActions`，但由 UI 从同一组定义展示为可见、禁用并说明
  “达到 Lv.3 后解锁”。

没有新增解锁持久化字段。等级提升仍由 Phase 4F-1 的 `progression.ts` 处理，
本轮没有修改经验来源、升级数值、战斗公式、掉落、配方、世界事件、禁区时序或 RNG。

## NPC 同步的执行验证

`tests/phase4i1SkillGrowth.test.ts` 构造真实 `createGame` 状态，将 NPC 设为斗士
Lv.3、满体力并清空冷却，调用生产决策函数 `npcCombatSkill`，实际选择
`fighter_focus`；随后用 NPC 与玩家相同的 `useSkill` 执行通道释放，断言状态效果和
冷却均写入 NPC。不是只检查定义存在。

500 局回归中的技能使用计数也包含第二技能：

```text
scout_smoke 686       fighter_focus 606
engineer_reinforce 734  medic_regen 641
```

## 防刷与确定性

新增测试覆盖：

- Lv.2 的第二技能不可用，Lv.3 后可用，且不产生单独解锁状态；
- 四个第二技能分别写入正确效果字段、持续时间和冷却，并由实际命中率、伤害、持续恢复
  与时间推进回归验证其效果确实进入既有结算管线；
- 四个第二技能的冷却均在推进一个时间单位后按规则递减；
- 零体力第二技能返回失败，不扣体力、不写冷却、不写状态；
- 合法行动集合只枚举已解锁且可支付的 `USE_SKILL`，保持既有命令通道；
- 同种子、同操作序列的技能结果和 RNG 状态一致；
- 4C-3 零体力不变量、物品守恒、既有技能回归测试继续通过。

## 存档与版本

本轮没有新增 `Combatant`、`GameState` 或技能解锁字段。第二技能解锁完全由
`level` 推导；运行时状态继续位于已有 `statusEffects` 数组，存档校验只扩展了
四个合法状态 id 及其字段/持续时间约束。因此：

- `GAME_VERSION` 保持 `0.4.0`，无需迁移或旧档失效策略变更；
- `skillCooldowns` 通过新的 `SKILLS` 集合校验新技能 id；
- `saveValidation` 拒绝第二技能状态的未知 id、类型错误、错误数值和持续时间越界；
- `npm run audit:save`：89 个损坏用例拒绝 89 个，构造失败 0 个，PASS。

## UI 与可达性

行动栏保留原来的 3 个攻击、防御、逃跑和主技能六个独立动作格，不压缩它们。
第二技能作为第七个独立原生按钮占据下一行；因此实际测得原有动作 6 个、第二技能 1 个，
共 7 个可操作控件，
原有六个动作和新增技能入口都可见且各自带解锁/冷却状态。1280×720 与 390×844
均无需滚动即可触达全部控件；没有新增常驻块或阻塞式弹窗。

最终生产 preview 证据（截图留在被忽略的 `output/phase4i1-browser/`，不提交）：

- `01-desktop-locked-secondary-skill.png`：Lv.2 副技能可见、禁用、显示 Lv.3 解锁；
- `02-desktop-level-3-unlock-moment.png`：攻击结算后实际从 Lv.2 升到 Lv.3，副技能立即可用；
- `03-desktop-scout-secondary-used.png`、`04-desktop-fighter-secondary-used.png`、
  `05-desktop-engineer-secondary-used.png`、`06-desktop-medic-secondary-used.png`：
  四个角色的第二技能分别释放并进入冷却；
- `07-mobile-seven-action-controls.png`：390×844，七个控件全部在视口内，原有六动作未被挤出；
- [runtime JSON](/Users/coolking70/Documents/同步空间/battleroyal/reports/phase4i1-runtime.json)：
  1280×720 与 390×844 均为 existingActions=6、secondaryActions=1、controls=7、
  controlsInView=7，body/document scroll width 分别为 1280 与 390，
  `[title]` 为 0，console/page errors 均为空。

技能按钮为原生 `<button>`，保留既有 `:focus-visible` 规则；锁定原因通过可见文本
和 `aria-label` 提供，不依赖 hover 或 `[title]`。新增控件的最小高度为 44px。
UI 不读取或显示 NPC level/exp，遭遇主视觉和战报的信息边界保持不变。

## 改动清单与理由

- `src/core/skillDefinitions.ts`：纯定义拆分；新增 8 个技能定义、角色集合、主技能兼容查询。
- `src/core/skills.ts`：复用定义；增加等级解锁校验和四个第二技能的状态效果执行。
- `src/core/npcSkillDecide.ts`：保留既有主技能优先级，Lv.3 后增加第二技能可选决策。
- `src/core/legalActionBuilders.ts`：从单个主技能枚举为已解锁可执行技能集合。
- `src/core/saveValidation/numbers.ts`：白名单及四种新状态字段校验。
- `src/data/gameConfig.ts`：只新增第二技能的体力、冷却、持续时间和效果占位数值；既有经验、战斗和经济数值未动。
- `src/ui/combatActionsPresentation.ts`：提供完整技能集合、锁定状态、原因和兼容的主技能别名。
- `src/ui/components/ActionBar.tsx`：保留六个既有动作格，第二技能独立占下一行，并保持无障碍语义。
- `src/ui/styles.css`：仅调整遭遇态移动端规划触发器位置，避免其遮挡原有战斗动作；不改变玩法样式之外的布局架构。
- `src/ui/screens/GameScreen.tsx`：探索态技能入口同步呈现主/副技能并沿用 `USE_SKILL`。
- `tests/phase4i1SkillGrowth.test.ts`：解锁、四个实际效果、冷却递减、零体力、合法命令、NPC 执行、存档和确定性回归。
- `tests/browser/phase4i1-skill-growth-evidence.spec.ts`：生产 preview 的锁定/解锁、视口、触控和错误证据。
- 既有受行动栏数量断言影响的浏览器证据测试：改为断言七个独立控件，并新增桌面/移动
  全部控件在视口内的断言；原有六个动作保持独立格，不以技能嵌套压缩。

行数审计：`audit:deps` 扫描 77 个文件，R1/R2/R3 违例均 0，R4 超行 0；
core/data 最大文件仍为 `commandHandlers.ts` 500 行。

## 门禁结果

| 门禁 | 结果 |
| --- | --- |
| `rm -rf node_modules && npm ci` | PASS；126 packages，0 vulnerabilities |
| `npm run typecheck` | PASS |
| `npm test` | PASS，87 files / 1433 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS，89/89 |
| `npm run audit:deps` | PASS，R1~R4 全 0 |
| art doctor / validate / audit:phase4a | PASS |
| art security browser / repo | PASS |
| 500 局 `PHASE4I1` regression | 引擎健康 PASS；请求=实际 500，timeout/illegal/hard-limit 均 0 |
| `npm audit --omit=dev` | PASS，0 vulnerabilities |
| 生产 preview 浏览器证据 | PASS，1/1；console/page errors 0 |

模拟器报告见 [reports/phase4i1-balance.json](/Users/coolking70/Documents/同步空间/battleroyal/reports/phase4i1-balance.json)。
其中胜率、击杀和角色平衡仅按项目要求记录，不作为本轮门禁；该次观察到
  `medic` 与 `engineer` 各 0.8% 胜率、最高与最低非零胜率比 7.00，不反向调整任何数值。

35 张正式 PNG、`art/approved-assets.json`、`src/core/types/characterTypes.ts`、
`src/core/progression.ts` 和所有未列出的 core/data 规则文件均未改动。
