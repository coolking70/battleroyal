# Phase 4F-1 开发报告：经验与等级系统（核心层）

## 1. 交付结论

Phase 4F-1 已按冻结设计实现。`Combatant` 现在持久化 `level` 与 `exp`；玩家和
NPC 共用同一个确定性成长入口。攻击结算、击杀、合成、搜索与探索均按配置发放
经验，休息及所有实际体力成本为 0 的动作不发经验。升级提升 attack、defense、
maxHp，存活角色的当前 HP 同量增加，等级封顶为 5。

`GAME_VERSION` 已从 `0.3.2` 升至 `0.4.0`。旧档采用“明确失效、不迁移、不删除”
策略；存档审计由 74 个损坏样本扩展为 83 个，全部被拒绝。干净安装后的类型检查、
82 个测试文件 / 1399 个测试、生产构建、全部审计、500 局健康回归、28 项生产浏览器
回归和 npm 漏洞审计均通过。

## 2. 经验来源与数值

| 来源 | 经验 | 实现条件 |
| --- | ---: | --- |
| 攻击结算参与 | 攻击者与承受者各 8 | 该次攻击实际支付了正体力 |
| 击杀额外奖励 | 击杀者额外 7 | 与参与经验叠加，总计 15 |
| 合成 | 2–6 | `clamp(ceil(成品既有 value / 6), 2, 6)`，且实际支付正体力 |
| 搜索 | 1 | 搜索成功结算且实际支付正体力 |
| 探索 / 移动 | 1 | 合法移动且实际支付正体力 |
| 休息 | 0 | 无经验钩子 |

严格排序为：攻击参与 8 > 击杀额外 7 > 最高合成 6 > 搜索/探索 1 > 休息 0。
一次击杀实际获得参与 8 + 击杀 7 = 15。合成档次复用已经存在的 `ItemDef.value`，
没有为物品或配方新增分级字段，也没有改动任何 `src/data` 结构；木棍为 2 EXP，
电击棒为 6 EXP。

## 3. 升级规则实测

- 当前级升级阈值：20 / 30 / 40 / 50。
- 最高等级：5；满级后 `exp` 固定为 0，不再累计经验或属性。
- 每级：attack +1、defense +1、maxHp +10。
- 存活角色升级时当前 HP +10；死亡角色不会因升级复活。
- 不改 crafting、medical、maxStamina、速度、感知或任何装备规则。

生产预览运行时快照：斗士从 `Lv.1, 12/20 EXP, atk 8, def 5, HP 105/105`
经一次真实攻击结算后变为
`Lv.2, 0/30 EXP, atk 9, def 6, HP 115/115`。详细数据见
`reports/phase4f1-runtime.json`。

## 4. 防刷取验证

经验发放没有挂在“进入遭遇”“防御”“脱离”或通用自由动作上，而是挂在各自真实
结算点，并通过“实际体力支出 > 0”统一兜底。

- 零体力免费防御连续执行 5 次：`0 EXP → 0 EXP`。
- 免费脱离：`0 EXP → 0 EXP`；若脱离失败后敌人付费追击，只有那次真实攻击结算
  可以获得战斗参与经验。
- 工程师现场加工的 0 成本合成：合成成功但 `0 EXP → 0 EXP`。
- 三次木棍合成合计 6 EXP，仍低于一次攻击参与的 8 EXP；高阶电击棒单次 6 EXP
  严格高于木棍单次 2 EXP。
- 休息没有经验入口。

专门回归位于 `tests/phase4f1Progression.test.ts`，4C-3 的四条零体力断言原文件未改，
仍全部通过。

## 5. NPC 同步执行验证

成长规则没有判断 `isPlayer`。攻击使用 `resolveAttack`、搜索/移动使用共享 actor
action、合成使用 `performCraft`，因此玩家与 NPC 走同一组发放和升级函数，没有新增
NPC 决策分支，也没有改变原优先级。

测试不是直接调用升级助手来“证明”NPC 会升级，而是让 NPC 通过真实
`attackActor` 路径完成一次攻击。运行时快照中工程师 NPC 从
`Lv.1, 12/20 EXP, atk 7, def 5, HP 100/100` 变为
`Lv.2, 0/30 EXP, atk 8, def 6, HP 110/110`。

NPC 的 level/exp 只出现在 `?debug=1` 的 DebugPanel；正式玩家界面、可见事件、遭遇
信息与全局日志均未新增 NPC 成长数值。战斗事件的回归断言确认没有写入 `level` 或
`exp` 字段。

## 6. 存档与版本策略

### 6.1 旧档策略

采用明确失效，不做迁移。理由是 0.3.2 进行中存档没有历史行动数据，无法可靠还原
玩家和每个 NPC 本应已经获得的经验、等级与属性成长；补 `level=1, exp=0` 会把一局
中途状态伪装成合法迁移，并造成不可解释的不公平。

`loadGame` 在深度校验前识别版本差异并返回：

> 存档版本不匹配（存档 0.3.2，当前 0.4.0）；旧档不会自动迁移或删除。

原 localStorage 内容保持不变，玩家可以自行保留或导出；不会静默崩溃、读出半迁移
状态或自动清档。

### 6.2 新字段审计

每个角色的 `level` 必须是 1–5 的整数；`exp` 必须是非负整数；未满级时 `exp` 必须
低于当前级阈值；满级 `exp` 必须为 0。新增的 9 个独立损坏样本覆盖：字段缺失、
字符串类型、level 下界/上界、负 exp、达到阈值但未升级、满级仍有 exp。

`npm run audit:save`：正常对照档通过，83 / 83 个损坏档被拒绝，构造失败 0。

## 7. `src/core` 改动清单与逐项理由

| 文件 | 最小改动与理由 |
| --- | --- |
| `src/core/types.ts` | 给 `Combatant` 增加持久化 `level/exp`，落实 schema。 |
| `src/core/gameState.ts` | 玩家和所有 NPC 创建时统一初始化为 1 / 0。 |
| `src/core/progression.ts` | 新增唯一成长入口、阈值查询、合成 value→经验派生、正体力门禁、攻击双方与击杀奖励。纯确定性，不读 RNG。 |
| `src/core/combat.ts` | 保存攻击实际体力支出；命中或未命中完成既有事件写入后，统一发攻击参与经验；死亡、伤害、命中与掉落调用均未改。 |
| `src/core/actorActions.ts` | 合法移动、搜索结算后按实际正体力支出发最低档经验；不触碰防御、脱离、休息。 |
| `src/core/crafting.ts` | 成功合成并完成既有物品/统计结算后，按成品 value 与实际成本发经验；免费合成发 0。 |
| `src/core/saveLoad.ts` | 在深度校验前给旧版本返回可读的明确失效提示，不删除原始存档。 |
| `src/core/saveValidation/numbers.ts` | 深度拒绝 level/exp 缺失、类型、范围和阈值错误。 |

此外仅改 `src/data/gameConfig.ts` 的版本与新增成长配置；DebugPanel 是唯一 UI 改动。
没有修改命中/伤害公式、掉落、配方、世界事件、禁区时序、RNG、NPC 决策优先级或
其他数据文件。

## 8. 确定性与期望更新

- 新成长模块没有随机调用；同种子、同动作序列测试对完整状态与 RNG 后续状态做
  深相等断言并通过。
- 单元测试中只有 `state.version` 的精确期望从 0.3.2 更新为 0.4.0，这是规定的版本
  bump；现有确定性数值断言没有删除或放宽。
- 4E-1 的击杀浏览器夹具原先会在快捷恢复推进时间后让敌人参与多次攻击。4F-1 下
  该敌人会合法升级并把夹具 HP 从 1 提到 11。修正为把该证据敌人固定到满级，仍要求
  真实 UI 攻击、真实击杀和日志包含击杀，断言未削弱。
- 4B-3 的“合成状态”段原先依赖最多 80 次随机搜索攒木材/石头；成长改变后续战斗
  结果，使旧种子可能在材料齐前结束。该段改用隔离的木材/石头存档夹具；同一测试
  前半部对 item / nothing / pending 的三条真实搜索路径保持不变，合成与装备仍走
  真实 UI 命令，覆盖没有减少。

## 9. 生产浏览器证据

截图保存在忽略目录 `output/phase4f1-browser/`，未提交仓库：

| 文件 | 证据 |
| --- | --- |
| `01-initial-level-exp.png` | 初始 Lv.1 / 0/20，atk 8 / def 5，HP 105/105。 |
| `02-combat-participation-exp.png` | 一次攻击后玩家与 NPC 都从 0 增至 8 EXP。 |
| `03-player-level-up-stats.png` | 玩家升级后 Lv.2 / 0/30，atk 9 / def 6，HP 115/115。 |
| `04-npc-level-up-stats.png` | DebugPanel 的 NPC 行显示真实执行升级后的 Lv.2、atk/def/HP。 |
| `05-zero-stamina-guard-no-exp.png` | 顶栏 stamina=0 且防御生效，DebugPanel 仍为 Lv.1 / 0/20。 |

构造方式：使用固定种子创建合法 0.4.0 状态；战斗、玩家升级和 NPC 升级都由
`attackActor` 真实结算；升级场景只把前置经验放到距阈值 8 点的位置；零体力场景
真实连续执行 5 次 `guardActor`。生产预览测试将结果作为合法存档载入 `?debug=1`。

最终完整生产浏览器回归 28 / 28 通过，包含五视口、6 个战斗动作免滚动可见、无横向
溢出、抽屉键盘语义和历史 4E 证据。新增快照视口 1280×720，`scrollWidth =
clientWidth = 1280`，实时 DOM `[title] = 0`，console errors = 0，page errors = 0。

## 10. 约束核对

- 35 张 `public/assets/**/*.png` 数量保持，字节文件无改动；没有调用图像 API。
- `art/approved-assets.json`、Candidate 状态无改动。
- `src/data/**` 只改允许的 `gameConfig.ts`；没有新增玩家面向 UI。
- DebugPanel 沿用现有控件，没有新增需补 `:focus-visible` 的控件。
- 没有新增命令类型、随机抽取或依赖。
- 没有经验事件，日志仍走既有可见性边界；不读取 `zone.loot` 或 NPC 意图来发经验。
- `tests/phase4c3ZeroStaminaDeadlock.test.ts` 原断言未改，4 / 4 通过。
- `itemIntegrity.test.ts` 的完整对局逐 tick 审计继续通过；新增击杀成长测试也执行
  `auditItemIntegrity` 并通过。

## 11. 门禁结果

| 门禁 | 结果 |
| --- | --- |
| `rm -rf node_modules && npm ci` | PASS，干净安装 126 packages |
| `npm run typecheck` | PASS |
| `npm test` | PASS，82 files / 1399 tests（基线 81 / 1368，未减少） |
| `npm run build` | PASS，Vite 生产构建 |
| `npm run audit:save` | PASS，83 / 83 损坏档拒绝 |
| `npm run audit:deps` | PASS，R1–R4 均 0 |
| `art:doctor -- --offline` / `art:validate` / `art:audit:phase4a` | PASS |
| `art:security:browser` / `art:security:repo` | PASS，201 / 841 文件，无泄漏 |
| `simulate 500 PHASE4F1 --regression` | PASS，请求=实际=500，timeout/illegal/deadlock/hard-limit 均 0 |
| `npm audit --omit=dev` | PASS，0 vulnerabilities |
| 完整生产 Playwright | PASS，28 / 28，console/page errors 0 |

500 局胜率与角色差异只记录：总玩家胜率 3.2%，各角色 2.4%–4.0%。这些数据未作为
门禁，也没有据此反向调整成长、伤害、命中或经济数值。
