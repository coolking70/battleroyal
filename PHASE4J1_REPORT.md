# Phase 4J-1 自动玩家装备测量修复报告

## 结论

4J-0 的核心测量缺陷已修复：标准五策略现在会在 `getLegalPlayerCommands`
返回严格更强的 `EQUIP` 动作时，使用既有 `chooseEquipmentUpgradeAction` 选择该
合法命令；命令仍通过 `executeCommand` 执行。没有修改 `src/core/**`、
`src/data/**`、UI、玩法规则、数值、RNG 或资源。

同一 20 组种子 × 5 策略矩阵重跑后，玩家装备率从 0% 变为 35%。100 局胜率从
2% 变为 6%，平均击杀从 0.06 变为 0.15，战斗死亡从 89 例降为 64 例。500 局
回归胜率从 1.6% 变为 9.0%；这只是对照记录，不是本轮平衡门禁。

aggressive 的相对结论发生变化但没有完全反转：100 局中 aggressive 5% 与
cautious 5% 持平、低于 collector 15%；500 局中 aggressive 3% 仍低于 cautious
13% 和 collector 19%。因此“aggressive 低于 collector”保留，“aggressive 必然
低于 cautious”在 100 局上被推翻、在 500 局上仍成立。

## 1. 根因与修复

### 根因

`chooseEquipmentUpgradeAction` 已经存在，但只在
`options.representativeBuildLoop === true` 时通过
`chooseRepresentativeBuildAction` 到达。标准五策略从
`decideAutoPlayerCommand` 直接选择搜索、移动、战斗等命令，该函数不产生
`EQUIP`，所以标准测量一直是“玩家不装备、NPC 会装备”。

此外，4J-0 诊断工具把玩家 `ITEM_EQUIPPED` 事件误按
`metadata.slot === 'weapon'` 识别；正式玩家装备事件只保证写入 `itemId`，不写
`slot`。本轮一并在 `tools/phase4j0BalanceDiagnosis.ts` 修正为按 `itemId` 对应
物品类别识别武器装备。这是测量器修复，不是引擎行为修改。

### 最小修复

`tools/autoPlayer.ts` 主循环在非代表性闭环路径加入：

```text
legal = getLegalPlayerCommands(state)
equipmentUpgrade = chooseEquipmentUpgradeAction(player, legal)
若存在：将该 LegalAction 作为本回合首选
否则：继续原有策略决策
executeCommand(state, chosen.command)
```

代表性闭环路径保持原有目标/合成优先级，不被本轮改写。装备选择仍然：

- 只读取合法动作集合；
- 只选择武器/护甲且严格高于当前槽位属性的候选；
- 不直接改 state；
- 不增加 RNG 消耗；
- 无候选时不产生装备命令。

## 2. 验证覆盖

新增 `tests/phase4j1AutoEquip.test.ts`，共 13 个断言场景（Vitest 报告为 13
个测试）：

- aggressive / cautious / collector / opportunist / random 五策略逐一验证在
  合法升级候选存在时选择 `EQUIP`；
- 使用真实 `getLegalPlayerCommands` 集合，并通过 `executeCommand` 验证执行成功；
- 五个固定矩阵种子逐一验证标准对局实际发出 `EQUIP`，无非法命令；
- 已装备更强物品后，较弱候选不被选择；
- 同种子、角色、策略重复运行，最终状态、事件流、命令计数和结局一致。

## 3. 100 局矩阵对照

口径保持 4J-0：20 个种子组 × 5 策略 = 100 局，角色按种子组固定轮转；修复前
读取提交中的 `reports/phase4j0-diagnosis.json`，修复后使用相同生成规则和
`PHASE4J1` 前缀重跑。完整机器数据见
[`reports/phase4j1-comparison.json`](reports/phase4j1-comparison.json) 与
[`reports/phase4j1-diagnosis.json`](reports/phase4j1-diagnosis.json)。

### 总体

| 指标 | 4J-0 修复前 | 4J-1 修复后 |
| --- | ---: | ---: |
| 胜率 / 存活率 | 2% / 2% | 6% / 6% |
| 平均击杀 | 0.06 | 0.15 |
| 平均承伤 | 139.51 | 141.27 |
| 平均时长 | 41.21 | 49.52 |
| 最终 Lv.2 / Lv.3 / Lv.4 / Lv.5 | 3 / 46 / 41 / 10 | 5 / 35 / 44 / 16 |
| 武器获得对局率 | 45% | 35% |
| 武器装备对局率 | 0% | 35% |
| 装备后进入遭遇率 | 0% | 6% |
| 高阶武器合成对局率 | 10% | 0% |

高阶武器率下降是本次标准策略行为变化后的观测值，不对它进行参数解释或调平；
本轮只修复装备行为。

### 死因

| 死因 | 4J-0 | 4J-1 |
| --- | ---: | ---: |
| 战斗 | 89 | 64 |
| 禁区侵蚀 | 2 | 13 |
| 衰竭 | 7 | 16 |
| 其他 | 0 | 1 |
| 总死亡 | 98 | 94 |

战斗仍是最大单项，但占死亡比例从 90.8% 降为 68.1%；禁区和衰竭在更长的存活
时间中重新出现。所有 100 局均可信。

### 五策略对比

| 策略 | 修复前胜率 | 修复后胜率 | 修复前平均击杀 | 修复后平均击杀 | 修复后平均承伤 | 修复后平均时长 | 修复后装备对局 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 0% | 5% | 0.00 | 0.10 | 136.80 | 48.85 | 5/20 |
| cautious | 5% | 5% | 0.20 | 0.10 | 138.55 | 51.50 | 7/20 |
| collector | 0% | 15% | 0.05 | 0.45 | 149.05 | 58.45 | 9/20 |
| opportunist | 0% | 0% | 0.05 | 0.00 | 140.60 | 39.90 | 8/20 |
| random | 5% | 5% | 0.00 | 0.10 | 141.35 | 48.90 | 6/20 |

在这个 100 局样本中，aggressive 不再低于 cautious，但仍低于 collector。
collector 的承伤最高，却有更高存活/击杀，说明装备后路线长度和战斗完成度发生
了变化；这不是本轮平衡判断。

### 500 局回归对照

| 指标 | 4J-0 `PHASE4J0` | 4J-1 `PHASE4J1` |
| --- | ---: | ---: |
| 请求 / 实际 | 500 / 500 | 500 / 500 |
| 胜率 / 存活率 | 1.6% / 1.6% | 9.0% / 9.0% |
| 平均击杀 | 0.058 | 0.166 |
| 平均承伤 | 141.536 | 139.770 |
| 平均时长 | 42.772 | 51.532 |
| timeout / illegal / hard limit | 0 / 0 / 0 | 0 / 0 / 0 |

修复后 500 局策略胜率为：aggressive 3%、cautious 13%、collector 19%、
opportunist 8%、random 2%。因此在较大样本上 aggressive 仍劣于 cautious 和
collector；4J-0 的“aggressive 低于 cautious/collector”应改写为：collector
差异保留，cautious 差异需要足够样本才稳定判断。

## 4. 对 4J-0 六项测量逐条重评

### 4.1 死因分布

**保留部分结论，修正强度。** 战斗仍是最大死因（64/94，68.1%），所以“战斗
风险重要”仍成立；“战斗占 90.8% 的压倒性结构”被测量器缺陷放大，不能保留。
禁区/衰竭从 2%/7% 升到 13%/16%，说明修复装备延长了部分对局，暴露出此前被
早期战斗死亡截断的其他死因。

证据：`MEASURED`。关于真人是否和自动玩家一样使用装备：
`NEEDS-HUMAN-PLAYTEST`。

### 4.2 战斗参与度

**平均击杀结论被推翻。** 平均击杀从 0.06 升到 0.15，不能再说“经验上线后
仍未变化”；平均攻击结算从 34.93 升到 37.93，遭遇开始从 0.13 升到 0.14。
平均承伤从 139.51 到 141.27，风险仍高，战斗不一定划算的候选解释保留但不
能只归因于经验系统。

证据：`MEASURED`；对真人战斗选择的解释：`NEEDS-HUMAN-PLAYTEST`。

### 4.3 成长曲线

**来源排序保留，具体分布需重测。** 参战来源仍约占 95.87%，探索 3.30%，合成
0.50%，击杀额外 0.33%；参战仍是主要实际来源。Lv.5 从 10% 变为 16%，二技能
解锁从 97% 变为 95%，说明装备行为改变了对局时长与经验累计，4J-0 的等级分布
不能直接作为无装备条件下的成长结论。

经验来源仍是基于公开事件/命令和冻结配置的重建，而非逐笔 EXP 事件。证据：
`MEASURED`（重建口径）+ `INFERRED`（收益是否足以抵险）。

### 4.4 策略对比

**部分推翻。** 4J-0 100 局中 aggressive 0%、cautious 5%、collector 0%，
无法区分测量缺陷与策略差异。修复后 aggressive 5%、cautious 5%、collector
15%；500 局则为 3%、13%、19%。因此 aggressive 仍低于 collector，且大样本中
低于 cautious；100 局的“低于 cautious”被推翻。

证据：`MEASURED`；策略与真人行为的外推：`NEEDS-HUMAN-PLAYTEST`。

### 4.5 装备与合成转化

**装备转化结论推翻。** 4J-0 的玩家装备率 0% 是控制器缺陷，不是玩家或引擎
转化率。修复后 100 局获得武器 35%、装备 35%，五种策略均有装备对局；500 局
五策略分别发出 60 / 75 / 122 / 85 / 65 次 `EQUIP`。高阶武器 100 局修复后
为 0%，这是修复后策略路径的实际观测，不据此调数值。

“标准自动玩家未装备”结论完全失效；“真人会如何把武器带入遭遇”仍需真人测试。
证据：装备命令/事件 `MEASURED`；真人转化 `NEEDS-HUMAN-PLAYTEST`。

### 4.6 时间经济

**方向保留，比例需更新。** 平均时长由 41.21 升到 49.52，战斗时间占比由
69.16% 升到 73.55%，休息占比由 1.70% 升到 2.26%。休息仍不是主要时间去向，
但 4J-0 的低休息比例受短命对局截断影响，不能作为完整时间经济结论。

证据：`MEASURED`；“真人会用消耗品替代休息”的动机判断：
`NEEDS-HUMAN-PLAYTEST`。

## 5. 确定性与范围审计

- 相同 seed + character + policy 重跑：最终状态、事件流、命令计数、结局一致。
- 标准策略均只从 `getLegalPlayerCommands` 返回集合中选择 `EQUIP`。
- `executeCommand` 是唯一执行入口；没有直接改写游戏 state。
- `src/core/**`：零改动。
- `src/data/**`：零改动。
- UI：零改动。
- `public/assets/**/*.png`、`art/approved-assets.json`：零改动。
- 没有实施 4J-0 的任何平衡调整选项。

## 6. 门禁

全部通过：

- 干净 `npm ci`：PASS，126 packages，0 vulnerabilities。
- `npm run typecheck`：PASS。
- `npm test`：PASS，88 test files / 1446 tests。
- `npm run build`：PASS。
- `npm run audit:save`：PASS，89/89；`npm run audit:deps`：PASS，R1/R2/R3/R4
  均为 0。
- `art:doctor -- --offline`、`art:validate`、`art:audit:phase4a`、浏览器/仓库
  安全审计：全部 PASS。
- `npm run simulate -- --games 500 --seed-prefix PHASE4J1 --regression`：PASS，
  请求=实际 500，可信率 100%，0 timeout / illegal / hard-limit；胜率 9.0%
  仅作记录。
- `npm audit --omit=dev`：PASS，0 vulnerabilities。

## 7. 交付物

- 工具修复：`tools/autoPlayer.ts`、`tools/phase4j0BalanceDiagnosis.ts`
- 测试：`tests/phase4j1AutoEquip.test.ts`
- 诊断快照：`reports/phase4j1-diagnosis.json`
- 500 局快照：`reports/phase4j1-balance.json`
- 完整对照：`reports/phase4j1-comparison.json`
- 本报告：`PHASE4J1_REPORT.md`
