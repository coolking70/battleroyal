# Phase 4C-7 报告：半自动核心路线观察与经济复验

## 结论

本阶段完成了 Phase 4C-6 建议的第一步：用明确标注的半自动路线观察器验证
“采纳目标 → 搜索原材料 → 合成依赖 → 获得武器 → 装备 → 遭遇”的闭环。

结论是：**当前没有足够证据修改掉率、配方成本或战斗数值。** 20 条路线全部
通过引擎健康检查；20/20 采纳了公开制作目标，20/20 观察到玩家拾取原材料，
19/20 获得武器，19/20 发生装备事件，9/20 完成当前制作目标。路线仍有中途
结束和目标未完成，但这不能直接归因于供给不足，必须由真人试玩进一步区分
目标理解、遭遇压力、策略选择与经济供给。

本报告**不是人工试玩报告**。没有修改或填写
`HUMAN_PLAYTEST_CHECKLIST.md`；真机触控、首次上手理解、长局取舍和屏幕阅读
器表现仍是 `HUMAN-PLAYTEST-NEEDED`。

## 观察方法

| 项目 | 口径 |
| --- | --- |
| 规模 | 20 条确定性路线 |
| 矩阵 | 4 个角色 × 5 个策略，每个组合 1 条路线 |
| 控制器 | `tools/autoPlayer.ts` 的 `representativeBuildLoop` |
| 规则通道 | `executeCommand`；没有直接改写 GameState |
| 记录内容 | 仅玩家 actor 的事件里程碑与玩家自身结局 |
| 未读取 | `zone.loot`、NPC 位置/背包/装备、planner 理由、未来事件 |
| 证据等级 | `SEMI_AUTOMATED_ROUTE_OBSERVATION`，不是 `HUMAN-VERIFIED` |

原始记录：[`reports/phase4c7-route-playtest.json`](reports/phase4c7-route-playtest.json)。
逐路线表：[`reports/phase4c7-route-playtest.md`](reports/phase4c7-route-playtest.md)。

## 里程碑结果

| 里程碑 | 对局数 | 比例 |
| --- | ---: | ---: |
| 请求数 = 实际数 | 20 = 20 | PASS |
| 健康路线 | 20 / 20 | 100% |
| 采纳公开制作目标 | 20 / 20 | 100% |
| 观察到玩家拾取原材料 | 20 / 20 | 100% |
| 完成目标依赖中的中间步骤 | 15 / 20 | 75% |
| 获得任一武器 | 19 / 20 | 95% |
| 发生装备事件 | 19 / 20 | 95% |
| 首次进入遭遇 | 18 / 20 | 90% |
| 完成当前制作目标 | 9 / 20 | 45% |
| 玩家死亡 | 17 / 20 | 85% |

健康标准为请求=实际、无超时/死锁/非法命令/硬上限。胜率、存活率、目标完成率
和角色差异均只作观察，不作为经济 PASS/FAIL。

## 诊断解释

| 分类 | 对局数 | 解释 |
| --- | ---: | --- |
| `target-completed` | 9 | 目标依赖与成品路线完整走通 |
| `equipped-before-encounter` | 3 | 先发生装备，再发生遭遇或尚未发生遭遇 |
| `encounter-before-equipment` | 0 | 本半自动样本没有观察到该顺序 |
| `weapon-not-converted` | 8 | 已有部分路线里程碑，但未完成当前目标；不等于库存为空 |
| `no-player-material-observed` | 0 | 所有路线至少观察到一件玩家拾取原材料 |
| `no-target-adopted` | 0 | 所有路线均通过公开建议采纳目标 |

“weapon-not-converted”是诊断标签，不是系统判定。它可能包含死亡、遭遇打断、
目标材料组合尚未齐全或策略没有继续完成目标等多种原因；不能据此直接调高掉率。

## 关键发现

1. **路线入口可被执行。** 20/20 路线都采纳了公开制作目标；这证明现有目标
   建议与正式 `SET_CRAFT_GOAL` 通道能够驱动路线观察，但不证明真人一定能看懂。
2. **供给不是“完全不可见”。** 20/20 路线都观察到至少一件玩家拾取的原材料，
   19/20 已获得武器，说明当前主要问题不能简单归结为“没有材料/没有武器”。
3. **中间步骤和高阶完成仍有损耗。** 15/20 完成目标依赖中的中间步骤，9/20
   完成最终目标。下一步应优先记录真人在看到“还缺什么/去哪里找”后是否真的按
   路线移动，以及遭遇是否在装备前打断路线。
4. **当前观察器没有发现装备前遭遇的样本。** 这只说明本策略样本中自动装备
   优先级有效，不代表真人操作同样有效，也不能替代人工测试。

## 经济决策

本阶段不修改：

- `src/core/**` 与 `src/data/**`；
- loot pool、配方、体力成本、战斗公式、RNG、世界事件、禁区规则；
- 存档 schema、`GAME_VERSION`、package version；
- `public/assets/**/*.png`、Manifest、Candidate 状态；
- `HUMAN_PLAYTEST_CHECKLIST.md`。

原因是当前 20 条路线同时观察到原材料、武器和装备，尚未证明某条固定材料路径
在合理时限内不可达。按黑色幸存者式路线设计，先验证“玩家能否看懂并执行路线”，
再对单条跨区材料路径做局部校准，避免用胜率或小样本死亡率粗暴调经济。

## 证据分级

### CODE-VERIFIED

- 路线观察器只通过 `runAutoGame` → `executeCommand` 驱动。
- 记录只保留玩家 actor 的材料/合成/装备/遭遇/死亡里程碑。
- 20 条路线的请求数与实际数一致，所有路线 `trustworthy` 且未达到硬上限。
- 人工清单没有被自动化工具填写。

### RUNTIME-VERIFIED

- 既有 C6 干净生产预览路线证据继续覆盖 1280×720 与 390×844 的原材料来源、
  子目标和规划抽屉，console/page errors 为 0；本轮未改变 UI。
- 本轮新增工具不读取当前运行时库存，因此不会把半自动诊断误写成玩家可见信息。

### HUMAN-PLAYTEST-NEEDED

- 新手能否在 60 秒内理解“武器主要靠合成”；
- 玩家是否会按静态来源和子目标执行移动/搜索；
- 真人触控、长局资源取舍、遭遇前装备操作、屏幕阅读器与键盘可达性；
- 20 条路线中 8 条未完成的真实原因。

## 门禁状态

本阶段生产代码与规则未变；提交前门禁已复跑并通过。500 局报告中的
`characterBalance.passed=false` 是既有观察字段，本阶段按约定不作为失败条件；
引擎健康字段为 true，且请求/实际均为 500。

| 门禁 | 结果 |
| --- | --- |
| `npm ci` | PASS，干净安装完成 |
| `npm run typecheck` | PASS |
| `npm test` | PASS，70 files / 1292 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS，损坏 74/74 拒绝、有效 74/74 通过 |
| `npm run audit:deps` | PASS，R1/R2/R3/R4 均 0 |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS，Manifest / provenance / candidate hygiene / runtime usage |
| `npm run art:security:browser` | PASS，190 files |
| `npm run art:security:repo` | PASS，769 tracked files |
| `npm run simulate -- --games 500 --seed-prefix PHASE4C7 --regression` | PASS，500/500 健康；0 timeout/deadlock/illegal/hard-limit |
| `npm audit --omit=dev` | PASS，0 vulnerabilities |
| 20 条半自动路线观察健康检查 | PASS，20 / 20 |
| C6 clean production preview evidence | PASS，1 test；桌面/移动端 console/page errors 0 |

用户原有的 `reports/save-validation-audit.json/.md` 改动保留在工作区，没有纳入本阶段
提交；艺术审计产生的历史 `generatedAt` 变化已恢复，未混入无关报告。

## 下一方向

先完成一份真实人工试玩副本（由人类填写，不由脚本代填），至少覆盖：

1. 新手首次采纳一个合成建议并查看公开来源；
2. 完成一个中间部件并观察子目标推进；
3. 在遭遇前确认装备交接；
4. 记录路线被打断时是材料、理解、移动还是战斗原因；
5. 记录 3–4 局完整结局和长局资源取舍。

若人工与半自动结果一致，再把问题拆成“路线推荐多样性”“遭遇压力”“局部材料
供给”三个独立议题，优先做最小、可归因的局部调整；不要直接以胜率调全局经济。
