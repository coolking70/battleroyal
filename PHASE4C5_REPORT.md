# Phase 4C-5 报告：Player Build & Equipment Handoff Closure

## 结论

Phase 4C-5 已完成。本轮把“搜索 / 合成得到物品”与“决定是否装备”连接起来，
但没有替玩家自动装备，也没有改变游戏规则。玩家可以在结果焦点中通过明确的
“装备 / 立即装备”按钮派发正式 `EQUIP` 命令；装备完成后，原结果仍保留并显示
“已装备”。

本轮没有修改 `src/core/**`、`src/data/**`、掉落/配方/战斗数值、存档 schema
或正式美术资产。

## 完成内容

### 1. 装备交接展示层

新增 `src/ui/equipmentPresentation.ts`，只读取玩家自身的背包和装备，以及物品
静态攻击/防御值，输出 `none / equipped / ready / backup` 展示状态。它不修改
`Combatant`，也不替代 core 的合法性检查。

- 搜索结果卡：物品可提升装备位时显示“装备”，已经装备时显示“已装备”。
- 合成结果卡：成品可用时显示“立即装备”，装备后保留“成品已装备”反馈。
- 背包装备槽：同一槽位不再取第一件候选，而是展示玩家背包中数值最高的候选。
- 交互仍由 `GameScreen` 的父层派发 `{ type: 'EQUIP', uid }`，没有旁路写 state。

### 2. 搜索结果生命周期

`ITEM_EQUIPPED` 是搜索结果的非阻塞后续动作。`latestPlayerSearchFeedback` 现在
会保留刚刚发现的物品结果，使玩家可以看到“发现 → 装备 → 已装备”的完整闭环；
其他新的玩家行动仍会正确清除旧搜索结果。

### 3. 诊断闭环

`tools/autoPlayer.ts` 增加了可选的 `representativeBuildLoop` 诊断模式：
采纳公开合成建议、追踪当前子目标、在合法时合成和装备。该模式只选择
`SET_CRAFT_GOAL`、`CRAFT`、`MOVE`、`EQUIP` 合法命令，默认自动玩家行为不变。

这不是新的游戏规则，也不把模拟器行为冒充真实玩家行为。

## 同口径观察数据（非平衡门禁）

观察工具运行 4 个角色 × 5 个策略 × 20 个种子，共 400 局；两组均请求 400、
实际 400，且均为 400/400 健康局。

| 指标 | 基线策略 `PHASE4C5-BASE` | 代表性闭环 `PHASE4C5-REP` |
| --- | ---: | ---: |
| 设定合成目标的对局 | 0 / 400 | 400 / 400 |
| 完成合成目标的对局 | 0 / 400 | 13 / 400 |
| 玩家发生装备事件的对局 | 0 / 400 | 100 / 400 |
| 玩家装备事件 | 0 | 123（武器 66、防具 57） |
| 至少获得一件武器 | 156 / 400 = 39.0% | 59 / 400 = 14.75% |
| 首件武器来自合成 | 90 | 26 |
| 首件武器来自拾取 | 66 | 33 |
| 玩家完成任一高阶武器 | 29 / 400 = 7.25% | 13 / 400 = 3.25% |

代表性模式在目标设定和装备命令覆盖上达成了诊断目的，但当前“优先推荐区域移动”
策略尚未校准，导致材料获取指标低于基线。该结果只能说明模拟策略需要继续校准，
不能证明本轮 UI 交接降低了游戏经济，也不能作为调低/调高掉率、配方或战斗数值的
理由。原始文件：

- [`reports/phase4c5-baseline-diagnosis.json`](reports/phase4c5-baseline-diagnosis.json)
- [`reports/phase4c5-representative-diagnosis.json`](reports/phase4c5-representative-diagnosis.json)

## 信息边界自查

- 装备建议只读取当前玩家自己的背包与装备。
- 没有读取或渲染 NPC 背包、NPC 装备、NPC 位置或 NPC 意图。
- 没有读取或渲染区域实际剩余库存、未发现掉落或未来事件。
- 装备评分只使用物品静态攻击/防御属性，不推导隐藏战斗信息。
- `SearchResultFeedback` 与 `CraftPanel` 的测试断言回调只收到玩家自己的物品
  `uid`，组件本身不直接改变装备状态。
- 4B-4 的日志可见性过滤未被绕过。

## 浏览器证据

证据在 `npm run build` + `npm run preview` 的干净生产构建上采集：

- 1280×720：搜索得到铁管，结果卡显示装备位可升级；点击后结果保留并显示“已装备”，
  右栏武器位显示铁管。
- 390×844：合成木棍，移动端规划抽屉中的合成结果显示“立即装备”；点击后显示
  “成品已装备”。
- 两个视口的 `body/document scrollWidth` 均等于视口宽度；移动端为 390。
- `output/phase4c5-browser/runtime-errors.json`：console errors = 0，page errors = 0。
- 证据目录：[`output/phase4c5-browser`](output/phase4c5-browser)。

使用 `develop-web-game` 技能的开发烟测也成功进入探索态，截图和状态快照位于
`output/phase4c5-client`；该烟测没有产生 console error。

证据分级：

- `CODE-VERIFIED`：所有装备交接通过正式 `EQUIP` 命令；信息边界与单元测试通过。
- `RUNTIME-VERIFIED`：生产预览下 1280×720 / 390×844 结果卡交互与 0 错误。
- `HUMAN-PLAYTEST-NEEDED`：真机触控手感、屏幕阅读器朗读、长时间路线决策和
  真实玩家装备选择频率仍需人工测试。

## 门禁结果

| 门禁 | 结果 |
| --- | --- |
| `npm ci` | PASS，干净安装完成 |
| `npm run typecheck` | PASS |
| `npm test` | PASS，69 files / 1287 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS，损坏用例 74/74 拒绝，有效用例 74/74 通过 |
| `npm run audit:deps` | PASS，R1/R2/R3/R4 均 0 |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS，manifest / provenance / candidate hygiene / runtime usage 均通过 |
| `npm run art:security:browser` | PASS，190 files |
| `npm run art:security:repo` | PASS，754 tracked files |
| `npm run simulate -- --games 500 --seed-prefix PHASE4C5 --regression --output reports/phase4c5-balance.json` | PASS，500/500，0 timeout / illegal state / hard-limit |
| `npm audit --omit=dev` | PASS，0 vulnerabilities |
| 干净生产预览 Playwright | PASS，1 test；console/page errors 均 0 |

500 局模拟的胜率、存活率和角色平衡仅作观察数据，没有作为本阶段 PASS/FAIL 依据。
原始回归文件：[`reports/phase4c5-balance.json`](reports/phase4c5-balance.json)。

## Scope / 资产 / 版本声明

- `src/core/**`：0 个文件修改。
- `src/data/**`：0 个文件修改。
- `public/assets/**/*.png`：0 个文件修改，35 张正式图逐字节不变。
- `art/approved-assets.json` / Candidate 状态：未修改。
- package 依赖：未新增；版本保持 `0.3.2`。
- `GAME_VERSION`：不需要 bump。本轮只增加展示层和可选诊断能力，没有改变存档
  结构或规则语义。
- `reports/save-validation-audit.json/.md`：保留工作区已有用户改动，不纳入本轮提交。

## 下一阶段建议

不要根据本轮代表性策略的低武器率直接调经济。下一阶段建议进入
**Phase 4C-6：真实玩家核心循环与路线经济复验**：

1. 先用 10–20 局人工/半人工路线记录“目标采纳 → 推荐区域 → 中间件 → 装备 →
   遭遇”的断点，并区分 UI 理解问题、路线策略问题和材料供给问题。
2. 校准代表性自动玩家，使其消费公开路线信息但不把推荐区当成无条件强制移动；
   重新比较首件武器、装备交接和高阶武器完成率。
3. 只有当真实或校准后的证据仍显示固定路径不可达，才对单条跨区域材料路径做
   最小数据层调整；不先改战斗公式、全局掉率或胜率目标。

这个顺序符合黑色幸存者式的核心原则：路线与构筑必须先让玩家理解并能执行，
之后才用数据修正局部资源节奏。
