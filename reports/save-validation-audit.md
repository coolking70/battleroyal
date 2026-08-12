# 存档独立验收报告（Phase 3）

- 版本：0.4.0
- 生成时间：2026-08-12T17:11:28.773Z
- 对照组：1 个正常存档
- 损坏用例：91 个
- 通过：91 / 91
- 构造失败：0 个（P3-P2：任意一个即整轮 FAIL）

- 正常存档被接受：PASS

## 损坏用例明细

| # | 用例 | 期望 | 实际 | 通过 | 首个错误 |
| --- | --- | --- | --- | --- | --- |
| 1 | 缺 savedAt | 拒绝 | 拒绝 | ✓ | savedAt 必须是有限正数（时间戳） |
| 2 | savedAt 为 NaN | 拒绝 | 拒绝 | ✓ | savedAt 必须是有限正数（时间戳） |
| 3 | savedAt 为负数 | 拒绝 | 拒绝 | ✓ | savedAt 必须是有限正数（时间戳） |
| 4 | 顶层 seed 为空串 | 拒绝 | 拒绝 | ✓ | seed 必须是非空字符串 |
| 5 | 顶层 time 为负数 | 拒绝 | 拒绝 | ✓ | time 必须是非负整数 |
| 6 | 顶层 time 与 state 不一致 | 拒绝 | 拒绝 | ✓ | state.time 与顶层 time 不一致 |
| 7 | 顶层 seed 与 state 不一致 | 拒绝 | 拒绝 | ✓ | state.seed 与顶层 seed 不一致 |
| 8 | 顶层 rngState 与 state 不一致 | 拒绝 | 拒绝 | ✓ | state.rngState 与顶层 rngState 不一致 |
| 9 | 顶层 rngState 为字符串 | 拒绝 | 拒绝 | ✓ | rngState 必须是合法的有限非负整数 |
| 10 | 版本不受支持 | 拒绝 | 拒绝 | ✓ | 版本不受支持（9.9.9，当前 0.4.0） |
| 11 | 背包 9 格（超上限） | 拒绝 | 拒绝 | ✓ | 角色 p0 的背包超过 8 格（9 格） |
| 12 | 物品 count=0 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 inventory 的物品数量必须为正整数（0） |
| 13 | 物品 count 超过 maxStack | 拒绝 | 拒绝 | ✓ | 角色 p0 的 inventory 的物品数量超过 maxStack（99 > 5） |
| 14 | 不可堆叠物品 count=2 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 inventory 的物品数量超过 maxStack（2 > 1） |
| 15 | 武器缺少耐久 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 inventory 的武器缺少合法耐久（undefined） |
| 16 | 武器耐久越界 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 inventory 的武器耐久越界（999，应在 [0, 20]） |
| 17 | 非武器带耐久字段 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 inventory 的非武器物品出现了耐久字段 |
| 18 | 负 eventSeq | 拒绝 | 拒绝 | ✓ | state.eventSeq 必须是非负整数（实际 -1） |
| 19 | 负 uidSeq | 拒绝 | 拒绝 | ✓ | state.uidSeq 必须是非负整数（实际 -3） |
| 20 | 负 nextZoneEventTime | 拒绝 | 拒绝 | ✓ | state.nextZoneEventTime 必须是非负整数（实际 -2） |
| 21 | endedAtTime 晚于 state.time | 拒绝 | 拒绝 | ✓ | state.endedAtTime（5）晚于 state.time（0） |
| 22 | 进行中对局带 endedAtTime | 拒绝 | 拒绝 | ✓ | state.endedAtTime（3）晚于 state.time（0） |
| 23 | 负 stats.searches | 拒绝 | 拒绝 | ✓ | 角色 p0 的 stats.searches 必须为非负数（实际 -1） |
| 24 | 负 stats.damageDealt | 拒绝 | 拒绝 | ✓ | 角色 p0 的 stats.damageDealt 必须为非负数（实际 -5.5） |
| 25 | 负 kills | 拒绝 | 拒绝 | ✓ | 角色 p0 的 kills 必须为非负数（实际 -1） |
| 26 | 角色缺 level | 拒绝 | 拒绝 | ✓ | 角色 p0 的 level 必须是整数（实际 undefined） |
| 27 | 角色缺 exp | 拒绝 | 拒绝 | ✓ | 角色 p0 的 exp 必须是整数（实际 undefined） |
| 28 | level 为字符串 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 level 必须是整数（实际 2） |
| 29 | exp 为字符串 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 exp 必须是整数（实际 8） |
| 30 | level 低于 1 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 level 越界（0，应在 [1, 5]） |
| 31 | level 超过上限 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 level 越界（6，应在 [1, 5]） |
| 32 | exp 为负数 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 exp 不得为负（-1） |
| 33 | exp 达阈值但未升级 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 exp 已达到升级阈值却未升级（30 / 30） |
| 34 | 满级仍保留 exp | 拒绝 | 拒绝 | ✓ | 角色 p0 已满级但 exp 不为 0（1） |
| 35 | 已死亡但 hp>0 | 拒绝 | 拒绝 | ✓ | 角色 n1 已死亡但 hp 不为 0（50） |
| 36 | 存活却带 diedAtTime | 拒绝 | 拒绝 | ✓ | 角色 p0 存活却带有 diedAtTime |
| 37 | 已死亡但缺 diedAtTime | 拒绝 | 拒绝 | ✓ | 角色 n1 已死亡但缺少 diedAtTime |
| 38 | 区域 loot count=0 | 拒绝 | 拒绝 | ✓ | 区域 school 的物资数量必须为正整数（0） |
| 39 | 区域 loot 未知物品 | 拒绝 | 拒绝 | ✓ | 区域 school 的物资引用了未知物品（no_such_item） |
| 40 | 区域 loot 稀有度非法 | 拒绝 | 拒绝 | ✓ | 区域 school 的物资稀有度非法（epic） |
| 41 | remainingLootCount 为负 | 拒绝 | 拒绝 | ✓ | 区域 school 的 remainingLootCount（-1）与实际物资清单之和（21）不符 |
| 42 | initialLootCount 为负 | 拒绝 | 拒绝 | ✓ | 区域 school 的 initialLootCount 为负数 |
| 43 | remaining > initial | 拒绝 | 拒绝 | ✓ | 区域 school 的 remainingLootCount（41）与实际物资清单之和（31）不符 |
| 44 | supply 与派生比例不符 | 拒绝 | 拒绝 | ✓ | 区域 school 的 supply（0.42）与派生比例（1.000000）不符 |
| 45 | supply 越界 | 拒绝 | 拒绝 | ✓ | 区域 school 的 supply（2.5）与派生比例（1.000000）不符 |
| 46 | 当前版本存档缺少区域 park | 拒绝 | 拒绝 | ✓ | 缺少当前版本区域：park |
| 47 | 当前版本存档包含未知区域 | 拒绝 | 拒绝 | ✓ | 存档包含未知区域：unknown_zone |
| 48 | equippedWeaponId 指向非武器 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 equippedWeaponId 指向的不是武器（cloth_armor） |
| 49 | equipment 出现 material | 拒绝 | 拒绝 | ✓ | 角色 p0 的 equipment 里出现了不可装备物品（木材） |
| 50 | 尸体掉落缺 revealedTo | 拒绝 | 拒绝 | ✓ | 区域 commercial 的地面 的尸体掉落缺少合法 revealedTo 数组 |
| 51 | 尸体掉落 droppedBy 类型错误 | 拒绝 | 拒绝 | ✓ | 区域 warehouse 的地面 的 droppedBy 不是合法角色引用（42） |
| 52 | 尸体掉落 revealedTo 类型错误 | 拒绝 | 拒绝 | ✓ | 区域 forest 的地面 的尸体掉落缺少合法 revealedTo 数组 |
| 53 | 尸体掉落 revealedTo 非法角色 | 拒绝 | 拒绝 | ✓ | 区域 forest 的地面 的 revealedTo 含非法角色引用（ghost） |
| 54 | 尸体掉落 revealedTo 超过上限 | 拒绝 | 拒绝 | ✓ | 区域 forest 的地面 的 revealedTo 超过 6 个角色（7） |
| 55 | 背包物品携带尸体归属字段 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 inventory 不得携带尸体掉落归属字段 |
| 56 | 重复事件 ID | 拒绝 | 拒绝 | ✓ | 事件 id 重复：e0 |
| 57 | 事件类型非法 | 拒绝 | 拒绝 | ✓ | 事件类型非法：HACKED |
| 58 | 事件时间晚于当前 | 拒绝 | 拒绝 | ✓ | 事件 e0 的时间晚于 state.time |
| 59 | 错误事件 actor | 拒绝 | 拒绝 | ✓ | 事件 e0 的 actorId 引用了不存在的角色（ghost） |
| 60 | 事件 message 非字符串 | 拒绝 | 拒绝 | ✓ | 事件 e0 的 message 必须是字符串 |
| 61 | 事件 metadata 不可序列化 | 拒绝 | 拒绝 | ✓ | 事件 e0 的 metadata.nested 不可 JSON 序列化 |
| 62 | NPC 有目标但缺 planCreatedAt | 拒绝 | 拒绝 | ✓ | 角色 n1 有制作目标但 planCreatedAt 非法 |
| 63 | NPC 有目标但 planReason 为空 | 拒绝 | 拒绝 | ✓ | 角色 n1 有制作目标但 planReason 必须为非空字符串 |
| 64 | 非法玩家制作目标 | 拒绝 | 拒绝 | ✓ | 玩家制作目标指向不存在的配方（recipe_does_not_exist） |
| 65 | craftGoalCompleted=true 但无目标 | 拒绝 | 拒绝 | ✓ | craftGoalCompleted 为 true 但未设定制作目标 |
| 66 | 未解决遭遇敌人已死亡 | 拒绝 | 拒绝 | ✓ | 存在未解决的遭遇，但敌人已死亡 |
| 67 | 未解决遭遇 zoneId 与玩家区域不符 | 拒绝 | 拒绝 | ✓ | 存在未解决的遭遇，但敌人已不在玩家所在区域 |
| 68 | 对局已结束仍有未解决遭遇 | 拒绝 | 拒绝 | ✓ | 存在未解决的遭遇，但敌人已不在玩家所在区域 |
| 69 | pendingPickup zoneId 与玩家区域不符 | 拒绝 | 拒绝 | ✓ | pendingPickup.zoneId 与玩家当前区域不一致 |
| 70 | pendingPickup source 非法 | 拒绝 | 拒绝 | ✓ | pendingPickup.source 非法（cheat） |
| 71 | 全局重复 UID（跨角色） | 拒绝 | 拒绝 | ✓ | 物品 UID「i0」全局重复：角色 p0 的 inventory 与 角色 n1 的 inventory |
| 72 | 区域存活名单重复 ID | 拒绝 | 拒绝 | ✓ | 区域 hospital 的存活名单存在重复 ID |
| 73 | 存活角色出现在其他区域名单 | 拒绝 | 拒绝 | ✓ | 存活角色 p0 却出现在非所在区域 school 的存活名单中 |
| 74 | eventSeq 小于事件 id 最大值 | 拒绝 | 拒绝 | ✓ | state.eventSeq（1）必须大于现存事件 id 的最大值（1） |
| 75 | eventCounters.total 小于事件数 | 拒绝 | 拒绝 | ✓ | eventCounters.total（1）小于现存事件数（2） |
| 76 | eventCounters.byType 非法 key | 拒绝 | 拒绝 | ✓ | eventCounters.byType 包含非法事件类型（HACKED） |
| 77 | 负 eventCounters.total | 拒绝 | 拒绝 | ✓ | eventCounters.total 必须为非负数 |
| 78 | nextWorldEventTime 为负 | 拒绝 | 拒绝 | ✓ | state.nextWorldEventTime 不得为负（-3） |
| 79 | activeWorldEvents 非数组 | 拒绝 | 拒绝 | ✓ | state.activeWorldEvents 必须是数组 |
| 80 | activeWorldEvents 含非法 eventId | 拒绝 | 拒绝 | ✓ | activeWorldEvents 事件 id 非法：quake |
| 81 | 全局世界事件带 zoneId | 拒绝 | 拒绝 | ✓ | 全局世界事件的 zoneId 必须为 null（school） |
| 82 | 区域世界事件指向非法区域 | 拒绝 | 拒绝 | ✓ | activeWorldEvents 引用了不存在的区域（no_such_zone） |
| 83 | activeWorldEvents remaining=0 | 拒绝 | 拒绝 | ✓ | activeWorldEvents 的 remaining 非法（0） |
| 84 | 同一种世界事件重复生效 | 拒绝 | 拒绝 | ✓ | activeWorldEvents 中同种事件重复生效（rain） |
| 85 | worldEventHistory 结束早于开始 | 拒绝 | 拒绝 | ✓ | worldEventHistory 的时间区间非法（结束早于开始） |
| 86 | statusEffects 含未知状态 id | 拒绝 | 拒绝 | ✓ | 角色 p0 的 statusEffects 含有未知状态（panic） |
| 87 | EXPOSED 带 hpPerTick 伤害（红线） | 拒绝 | 拒绝 | ✓ | 角色 p0 的 EXPOSED 不应带 hpPerTick 伤害（-3） |
| 88 | EXPOSED damageTakenMult 与配置不符 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 EXPOSED damageTakenMult 应为 1.2 |
| 89 | statusEffects 重复 EXPOSED | 拒绝 | 拒绝 | ✓ | 角色 p0 的 EXPOSED damageTakenMult 应为 1.2 |
| 90 | skillCooldowns 含未知技能 | 拒绝 | 拒绝 | ✓ | 角色 p0 的 skillCooldowns 含有未知技能（fake_skill） |
| 91 | skillCooldowns 负值 | 拒绝 | 拒绝 | ✓ | 角色 p0 的技能冷却 adrenaline 非法（-1） |

**结论：PASS（全部损坏存档均被拒绝，且无用例构造失败）**

################################################################