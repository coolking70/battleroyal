# Phase 4C-6 报告：核心循环路线复验与经济诊断

## 结论

Phase 4C-6 已完成。本轮定位并修复了一个真实的多步合成路线缺口：路线推荐
只读取目标配方的直接材料，导致“野外长矛”这类三级目标会推荐不可搜索的
“加固握把”，而不是木材、石头、绳子、铁块等公开原始材料。

修复后，路线推荐会在只读计算中展开可见配方依赖，优先消耗玩家自己持有的
中间部件，再推荐仍缺失的原始材料及其静态公开来源区域。没有改变掉落池、
配方、体力成本、战斗公式、RNG 或存档结构。

## 缺陷与修复

### 缺陷复现

目标：`r_field_spear`（加固握把 → 野外长矛），玩家没有中间部件。

旧逻辑把目标配方的直接 ingredient `reinforced_handle` 当作搜索材料。它不在
任何区域的静态物资池中，因此推荐路线无法告诉玩家从哪里开始。

### 现在的行为

`src/core/craftGuide.ts` 新增只读依赖展开：

- 递归展开当前可见配方；
- 先消耗玩家背包中已有的中间部件；
- 将缺口归一化为原始材料；
- 从 `basePool` / `rarePool` 计算公开来源和区域评分；
- 永不读取 `zone.loot` 或其他角色状态；
- 未来若配方标为 hidden，不会借路线推荐反向展开其依赖。

示例：

| 玩家状态 | 推荐原始材料 |
| --- | --- |
| 空背包 | 木材、石头、绳子、铁块 |
| 已有木棍 | 绳子、铁块 |

### 代表性路线策略校准

Phase 4C-5 的诊断策略还存在第二个工具层问题：它每回合按当前位置重新选
推荐区，导致住宅区/工厂之间来回移动，并且到达区域后没有优先搜索。本轮仅在
可选诊断工具中修正：

- 一局内保持当前路线目标；
- 到达目标区域后优先 `SEARCH`；
- 连续两次没有玩家可见的 `ITEM_FOUND` 才轮换目标；
- 选择最短的合法下一步移动；
- 装备升级优先于下一次移动；
- 全部动作仍通过正式 `SET_CRAFT_GOAL` / `CRAFT` / `EQUIP` / `MOVE` / `SEARCH`
  命令执行。

这部分不影响默认自动玩家，也不进入游戏规则结算。

## 同种子配对观察（非平衡门禁）

使用同一 `PHASE4C5-REP` 种子前缀、4 个角色 × 5 个策略 × 20 个种子，共 400 局，
对比 Phase 4C-5 原始诊断和本轮修复后诊断。两组均为请求 400、实际 400、健康
400/400；胜率、存活率和角色平衡仍只作观察。

| 指标 | Phase 4C-5 | Phase 4C-6 | 变化 |
| --- | ---: | ---: | ---: |
| 目标设定对局 | 400 / 400 | 400 / 400 | — |
| 目标完成对局 | 13 / 400 = 3.25% | 140 / 400 = 35.0% | +126.75pp |
| 玩家至少获得一件武器 | 59 / 400 = 14.75% | 315 / 400 = 78.75% | +64.0pp |
| 首件武器来自合成 | 26 | 201 | +175 |
| 首件武器来自拾取 | 33 | 114 | +81 |
| 完成中间部件的对局 | 29 / 400 = 7.25% | 260 / 400 = 65.0% | +57.75pp |
| 发生玩家装备事件的对局 | 100 / 400 = 25.0% | 341 / 400 = 85.25% | +60.25pp |
| 玩家装备事件 | 123 | 681 | +558 |
| 玩家完成任一高阶武器 | 13 / 400 = 3.25% | 142 / 400 = 35.5% | +32.25pp |

这是一组同种子、同矩阵的诊断对照，强烈支持“路线可执行性是主要瓶颈”这一判断；
它仍不是对真实玩家胜率或正式经济平衡的证明。原始文件：

- 修复前：[`reports/phase4c5-representative-diagnosis.json`](reports/phase4c5-representative-diagnosis.json)
- 修复后配对：[`reports/phase4c6-representative-paired.json`](reports/phase4c6-representative-paired.json)
- 本轮新种子矩阵：[`reports/phase4c6-representative-diagnosis.json`](reports/phase4c6-representative-diagnosis.json)
- 默认基线：[`reports/phase4c6-baseline-diagnosis.json`](reports/phase4c6-baseline-diagnosis.json)

## 信息边界与不变量

- 路线只公开静态 `basePool` / `rarePool` 来源和玩家自己持有的材料数量。
- 不读取 `zone.loot`、`remainingLootCount` 或未发现地面掉落。
- 不读取 NPC 位置、背包、装备或 planner 意图。
- 同一种子下将所有区域 `loot` 清空，嵌套路线推荐结果保持一致。
- hidden 配方不会被路线展开，预留的可见性接缝仍然有效。
- 已有中间部件的玩家不会被重复引导去找它的原材料。

## 浏览器证据

在 `npm run build` + `npm run preview` 的干净生产构建上采证：

- 1280×720：规划区合成目标显示野外长矛、原始材料缺口、公开来源和推荐区域。
- 390×844：移动端规划抽屉的合成页同样显示木材、石头、绳子、铁块及来源；
  当前子目标显示木棍 → 加固握把 → 野外长矛。
- 桌面 `body/document scrollWidth = 1280`；移动端 `body/document scrollWidth = 390`。
- `output/phase4c6-browser/runtime-errors.json`：console errors = 0，page errors = 0。
- 截图及 runtime 快照：[`output/phase4c6-browser`](output/phase4c6-browser)。

证据分级：

- `CODE-VERIFIED`：递归路线计算、隐藏库存边界和正式命令闭环测试通过。
- `RUNTIME-VERIFIED`：生产预览的桌面/移动端路线信息可见、无横向溢出、无运行时错误。
- `HUMAN-PLAYTEST-NEEDED`：真人是否会按推荐路线行动、路线信息的理解速度、
  真机触控和长局资源取舍仍需人工验证。

## 门禁结果

| 门禁 | 结果 |
| --- | --- |
| `npm ci` | PASS，干净安装完成 |
| `npm run typecheck` | PASS |
| `npm test` | PASS，69 files / 1290 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS，损坏用例 74/74 拒绝，有效用例 74/74 通过 |
| `npm run audit:deps` | PASS，R1/R2/R3/R4 均 0 |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS，manifest / provenance / candidate hygiene / runtime usage 均通过 |
| `npm run art:security:browser` | PASS，190 files |
| `npm run art:security:repo` | PASS，762 tracked files |
| `npm run simulate -- --games 500 --seed-prefix PHASE4C6 --regression --output reports/phase4c6-balance.json` | PASS，500/500，0 timeout / illegal state / hard-limit |
| `npm audit --omit=dev` | PASS，0 vulnerabilities |
| 干净生产预览 Playwright | PASS，C6 路线证据通过，console/page errors 均 0 |

回归报告：[`reports/phase4c6-balance.json`](reports/phase4c6-balance.json)。500 局的
胜率、存活率和角色平衡不作为本阶段 PASS/FAIL 条件。

## Scope / 资产 / 版本声明

- `src/core/**`：仅修改 `src/core/craftGuide.ts`，理由是修复既有公共制作路线
  推荐的权威计算；未修改任何结算、掉落、配方、成本、战斗、RNG 或存档逻辑。
- `src/data/**`：0 个文件修改。
- `public/assets/**/*.png`：0 个文件修改，35 张正式图逐字节不变。
- `art/approved-assets.json` / Candidate 状态：未修改。
- package 依赖：未新增；版本保持 `0.3.2`。
- `GAME_VERSION`：不需要 bump；没有 state/schema 变化。
- 用户自有 `reports/save-validation-audit.json/.md` 改动保留在工作区，不纳入提交。

## 下一方向

Phase 4C-6 证明当前主要瓶颈是“路线能否被执行”，而不是先调资源数值。下一大阶段
建议做 **Phase 4C-7：真实玩家路线 Playtest 与局部经济复验**：

1. 记录 10–20 局真人或明确标注的半人工路线，验证玩家是否能理解并使用公开来源、
   中间件顺序和装备交接。
2. 以同口径记录目标采纳、每个原始材料首获时间、合成完成、装备、首次遭遇和死亡
   原因，区分 UI/策略失败与供给失败。
3. 只有当人工与校准后的路线都证明某个固定路径在合理时限内不可达，才做单条数据
   层材料路径的最小调整；不以胜率目标反向调数值。

这个顺序符合黑色幸存者的核心循环：先让玩家看懂并执行一条路线，再用局部数据
校准路线长度与风险，而不是把所有材料粗暴地放进每个区域。
