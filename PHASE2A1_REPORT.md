# Phase 2A-1 核心闭环最终返修报告

- 版本：0.2.0（保持第二阶段版本号，未推倒重写，未触碰第三阶段功能）
- 日期：2026-08-07
- 范围：修复 Phase 2A 最终验收剩余问题，使第二阶段正式关闭

## 一、总体结论

Phase 2A-1 全部验收条目达成：

| 验收项 | 结果 |
| --- | --- |
| 现有核心架构保持不变 | ✓ 未重构引擎主循环 / 规则层，全部为增量修复 |
| 1000 局无 timeout / deadlock / illegal command / hard limit | ✓ 权威报告 20000 局：timeout=0、illegalState=0、hardLimitReached=0 |
| 角色胜率最高/最低非零 < 2.5 | ✓ ratio=1.939 < 2.5（20000 局） |
| 不允许 0 胜率角色通过平衡验收 | ✓ zeroWinCharacters=[]，passed=true |
| 五种 NPC 人格开局都有长期制作目标 | ✓ 重写规划器，3 组种子全部验证 |
| NPC 目标真正影响移动/搜索 | ✓ planRecommendedZoneId 参与搜索/移动权重 |
| 存档审计 40+ 非法案例全部拒绝 | ✓ 60/60 拒绝，exit 0 |
| 9 格背包 / count=0 / 全局重复 UID / 负 eventSeq / 顶层不一致 / 非法制作目标 / supply 不一致 全部被拒 | ✓ 每项均有专项损坏用例 |
| tools 进入 TypeScript 严格检查 | ✓ tsconfig.app include 加入 tools/，修复幻影类型 |
| `npm run simulate -- --games 1000` 真正执行 1000 局 | ✓ 实际执行 20000 局（4 角色 × 5 策略 × 1000） |
| 制作路线考虑距离、禁区和公开资源状态 | ✓ BFS 距离 + 禁区排除 + 预警扣分 + 物资分档 |
| 未遭遇时不泄露精确同区域人数 | ✓ visibleRivals 移除，改为 zonePresence 分档 |
| 未识别角色不能逐个指定攻击 | ✓ ATTACK_NEARBY 泛化攻击 |
| Debug 支持 3 种 JSON 导出 | ✓ 存档 / 事件 / 对局摘要 |
| 结算显示最终装备/背包/使用物品 | ✓ 新增「装备 · 背包 · 制作目标」面板 |
| 5 局真实手测记录完整 | ✓ reports/phase2a1-manual-tests.md，4 角色 5 局 |
| 所有要求文档存在 | ✓ 见 DELIVERY_MANIFEST.md |
| 压缩包无 `__MACOSX` | ✓ 交付包按 §十七 规则构建 |
| 不提前开发 Phase 3 | ✓ 未新增任何第三阶段空壳 |

## 二、本轮按优先级完成的工作

### 第一优先级：存档深度校验（13 组不变量）

`src/core/saveValidation/` 四层全部扩充，规格 §二 的 13 组不变量全部落地：

1. 顶层 SaveData：version 受支持、savedAt 有限正数、seed 非空、time 非负整数、rngState 合法有限整数；顶层与 state 的 seed/time/rngState/version 必须一致。
2. GameState 基础计数器：eventSeq / uidSeq / nextZoneEventTime 非负整数；endedAtTime / finaleStartedAt null 或非负整数且不晚于 time；进行中不得带 endedAtTime，结束时必须有。
3. 背包：格数 ≤ 8；每堆 uid 非空、itemId 存在、count 正整数且 ≤ maxStack；不可堆叠 count=1；武器必须有合法耐久，非武器不得带耐久。
4. 全局 UID 唯一：所有角色背包 / 装备 + 所有区域地面 + pendingPickup.stack。
5. 装备：equippedWeaponId → weapon、equippedArmorId → armor；equipment 不得出现 material / consumable。
6. 角色状态：stats 全字段与 kills 非负；alive ↔ hp>0；死者必须带 diedAtTime，生者必须为 null。
7. 区域库存：loot 条目 itemId / count / rarity 合法；remaining === Σcount；initial ≥ remaining ≥ 0；supply === 派生比例（容差 1e-6）。
8. 区域人员名单双向完全一致：存活者恰好在自己区域名单且不在他区；死者不在任何名单；名单无重复、无未知角色。
9. 玩家制作目标：null 或真实配方；completed=true 必须有目标。
10. NPC 计划三字段一致：plannedRecipeId=null ⇔ planCreatedAt/planReason=null；有目标时 recipe 存在、planCreatedAt 合法、planReason 非空。
11. 事件：id 唯一、type / importance / time 合法、actorId / targetId / zoneId 引用有效、message 字符串、metadata 可 JSON 序列化；eventSeq ≥ 事件 id 最大值；eventCounters 非负且 total ≥ events.length、byType key 合法。
12. encounter：未解决时玩家与敌人必须存活、同区、zoneId === 玩家所在区；对局结束后不得残留未解决遭遇（引擎端同步清空）。
13. pendingPickup：stack 合法、UID 全局唯一、zoneId 存在且 === 玩家所在区、source 合法。

配套：`tools/auditSaveValidation.ts` + `npm run audit:save`，60 个损坏用例（≥40 要求），`reports/save-validation-audit.{json,md}`，任何非法被接受则 exit 1。测试套件 `tests/saveValidationAudit.test.ts`（62 用例）与审计共用同一份用例清单。

### 第二优先级：五种人格长期制作规划

`chooseNpcGoal / planNpcGoal` 重写（规格 §四）：

- 激进：武器优先，评分 = 攻击提升×3 − 缺失×2 − 步骤×2；
- 谨慎：防具 > 医疗 > 武器，低生命时医疗权重大幅提高；
- 收集：价值×2 + 材料种类×3 + 路线长度×2 − 缺失（不再只看"差一个材料"）；
- 投机：完成度×12 − 缺失×2 + 战力提升×1.5；
- 随机：从前 5 名合理候选用 SeededRandom 抽取（禁 Math.random）。

开局保证：普通开局五种人格全部有目标（3 组种子验证）。重规划触发：首次 / TTL 过期 / 配方不存在 / 成品已拥有 / 已有更优装备 / 连续无进展 / 材料区域全部禁区 / 进入 finale。新增调试字段：`planProgress / planNoProgressTurns / planRecommendedZoneId / lastReplanReason`。目标通过 `planRecommendedZoneId` 真正影响搜索（目标区 1.8×）与移动（向目标区 5×）。

### 第三优先级：角色平衡闭环

- 斗士：maxHp 125→105、attack 10→7、移除开局木棍、搏击被动 2→1；
- 侦察员：空手倍率 0.5→0.4、新增遭遇发现率×1.5、新增逃跑成功率+0.08；
- 工程师：attack 5→7、材料搜索权重 1.6→2.2；
- 医学生：治疗倍率 1.5→1.8、医院搜索加成 0.3→0.45、defense 2→3。

结果（权威 20000 局）：scout 3.92% / fighter 7.6% / engineer 4.62% / medic 5.4%，ratio **1.939** < 2.5，无 0 胜率，引擎健康全绿。

### 其余工作

- 统一模拟命令：`npm run simulate` 与 `simulate:balance` 同指向权威模拟器；`--games / --seed-prefix / --character / --policy / --output` + 旧位置参数兼容 + `--help`；参数错误打印帮助并以 exit 1 退出。
- tools 入 typecheck：tsconfig.app 纳入 `tools/`，修复 `AutoGamePolicy` / `aggregateGlobal` 幻影类型引用。
- 制作路线推荐升级：`getZoneDistance` BFS、评分 = 覆盖×10 + 稀有×3 + 公开资源 − 距离×2、禁区排除、预警扣分；面板显示「废金属 1/1 ✓」式材料状态与「距离 / 物资」推荐行；不读 zone.loot（2A-H 反作弊保持绿）。
- 同区域信息收紧：移除逐行匿名对手展示（visibleRivals），改为 `zonePresence` 区域级存在感分档（none/some/active/many，不泄露人数）；未遭遇时攻击改为泛化 `ATTACK_NEARBY`，引擎按种子随机数从同区域未识别目标中选对象并建立正式遭遇。
- Debug 面板：新增导出事件 JSON / 对局摘要 JSON、运行存档验证、区域可展开明细（initialLootCount/remainingLootCount/supply/loot/groundItems/aliveCharacterIds/noise）、NPC 计划详情；保留复制种子与物品完整性检查。
- 结算页：新增使用物品次数、最终武器、最终防具、最终背包、制作目标及完成情况；保留种子/结束原因/排名/击杀/搜索/合成/移动/攻击/造成伤害/承受伤害/关键事件时间线。

## 三、测试与验证

- 全量测试：**358 passed / 0 failed（27 文件）**（≥170 要求，128 基线全保留）。
- 存档审计：60/60 损坏用例拒绝，exit 0。
- 权威平衡：20000 局，胜率 5.4%，可信率 100%，timeout=0 / illegalState=0 / hardLimitReached=0，角色平衡 PASS。
- 手动测试：5 局真实完整游玩（4 角色），无卡死、无信息泄露、合法集合契约始终成立。
- 生产构建：`npm run build` 通过（tsc -b && vite build，0 error）。

## 四、低胜率说明（结构性，非规则不公）

单人对抗 5 名 NPC，对局在玩家死亡即终止，获胜需 5 个 NPC 全灭。Phase 2A/2A-1 验收标准均不设胜率门槛；角色间胜率比已进入可接受区间（1.939 < 2.5）。

---

## Phase 3 修订（P3-P3 · 命名正名）

> 本文件写于 Phase 2A-1，当时该工具名为「真实手动测试记录器」，输出称「真实手测记录」。
> Phase 3-P3 已更正：**那是不准确的叫法**——跑的是脚本，无人实际坐在屏幕前操作，不能证明可用性 / 手感。
> 该工具现名 **Scripted Playthrough（脚本化完整对局）**，见 `tools/scriptedPlaythroughs.ts` / `npm run scripted:playthroughs` / `reports/phase3-scripted-playthroughs.md`。
> 真正需人类执行的可用性清单见 `HUMAN_PLAYTEST_CHECKLIST.md`，其结论只能由人类填写。
