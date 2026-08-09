# Phase 4C-2 报告：合成引导增强与公开合成图鉴

## 1. 结论

Phase 4C-2 的代码、测试和干净生产预览证据已完成。`src/core/**` 未改动，
版本保持 `0.3.2`，35 张正式 PNG 未改动；本地门禁全部通过。

本阶段测试为 **66 files / 1277 tests**（基线 65 / 1272）。500 局回归按本阶段
规定只判引擎健康：请求 500 = 实际 500，0 超时、死锁、非法行动和硬上限；
模拟器报告中的角色平衡观察 FAIL 不参与本阶段 PASS/FAIL。

## 2. 第一步小修：医院掉率与措辞

医院的 `stick` 已从 `basePool` 移出，保留在 `rarePool`。这样医院仍有低概率的
直接武器保底，但不会用普通池权重压过医疗物资。CraftPanel 保留既有公开的
`supplyLabel`，仅将说明改为“建议搜索区域（静态来源 + 已公开物资分档）”，
不再把运行时公开分档称作静态物资池。

| 区域 | 修复前直接武器估计 | 修复后直接武器估计 | 修复后武器池构成 |
| --- | ---: | ---: | --- |
| 学校 | 3.6% | 3.6% | rare 1/3（木棍） |
| 医院 | 10.9% | 2.7% | rare 1/4（木棍） |
| 住宅区 | 3.6% | 3.6% | rare 1/3（石斧） |
| 工厂 | 3.6% | 3.6% | rare 1/3（铁管） |
| 森林 | 7.2% | 7.2% | rare 2/3（石斧、简易弓） |
| 研究所 | 3.6% | 3.6% | rare 1/3（电击棒） |

这里沿用 4C-1/验收方口径：有限库存仍会被搜空，表中是池构成推导的单次估计，
不是独立重复抽样保证。第一步以独立提交 `3e6bebc` 完成。

## 3. 主线改造

### 自动建议与持续目标

- 新增纯展示层 `getCraftGoalSuggestion`：综合玩家自有材料、当前装备武器攻击、
  目标攻击增益、依赖树已完成步数、原始材料缺口和当前位置到静态来源区的距离。
- 自动建议只在 `craftGoalRecipeId === null` 时出现；手动目标优先，不会被覆盖。
- “采纳建议”只调用现有 `onSetGoal`，由 `GameScreen` 继续派发
  `SET_CRAFT_GOAL`；没有绕过命令通道写入 state。
- 目标路径现在包含 `complete / ready / blocked` 步骤状态和 `nextStep`。
  中间部件即使随后被下一步消耗，也会通过玩家自己的 `ITEM_CRAFTED` 事件保持已完成
  记录，不会把子目标错误退回第一步。
- 最近一次玩家合成以非阻塞的原地进度卡显示，复用既有结果卡的视觉语义；未新增
  弹窗或事件类型。

### 公开合成图鉴

- `PlanningDrawer` 增加 `图鉴` tab，桌面端和 4B-5 的移动抽屉共用同一入口。
- `CraftingCodex` 展示全部 17 条当前公开配方；依赖节点按深度呈现，包含
  基础材料 → 中间部件 → 高阶武器的关系、物品静态摘要、当前玩家缺口和静态
  来源区域。
- 来源只来自 `basePool` / `rarePool` 的静态定义，图鉴与引导均不读取 `zone.loot`、
  `remainingLootCount`、地面未发现掉落、NPC 背包或 NPC 规划信息。
- `src/data/recipes.ts` 增加 `RECIPE_VISIBILITY` / `recipeVisibility` 接缝；17 条
  配方全部显式为 `visible`。本轮没有隐藏配方、解锁逻辑或未使用的半成品 UI。
- 新增武器没有正式 PNG，图鉴和引导继续通过 `VisualImage` 使用既有 emoji fallback。

## 4. 可达性观察（非平衡门禁）

沿用 `tools/observeCraftReachability.ts` 的 10 组种子 × 4 角色 × 5 策略 = 200 局
矩阵。工具新增环境变量只用于更换输出文件和种子前缀，默认 4C-1 行为不变。

| 高阶武器 | 4C-1 全体 / 玩家 | 4C-2 全体 / 玩家 | 玩家频次变化 |
| --- | ---: | ---: | ---: |
| 野外长矛 | 5 / 3 | 2 / 2 | 1.5% → 1.0% |
| 钢刃斧 | 15 / 2 | 12 / 3 | 1.0% → 1.5% |
| 复合弓 | 22 / 4 | 25 / 8 | 2.0% → 4.0% |
| 绝缘铁管 | 11 / 3 | 8 / 4 | 1.5% → 2.0% |
| 绝缘电击棒 | 7 / 5 | 3 / 1 | 2.5% → 0.5% |
| 五类玩家频次合计 | 17 / 200 | 18 / 200 | 8.5% → 9.0% |

这是随机样本下的观察，不是概率保证，也不是 PASS/FAIL 条件。玩家侧合计略有
上升，复合弓和钢刃斧的玩家参与度提高；绝缘电击棒和野外长矛下降，说明引导
没有改变底层掉落、配方或平衡数值，效果仍受有限库存、路径和自动策略影响。

数据文件：

- `reports/phase4c1-craft-reachability.json`
- `reports/phase4c2-craft-reachability.json`
- `reports/phase4c2-balance.json`（500 局健康回归）

NPC 评估结论：未改 `src/core/npcDecide.ts` 或其他 core。现有
`findUpgradeRecipe` 会按当前背包重新扫描可支付升级配方；4C-1 已有的正式测试
继续验证木棍 → 加固握把 → 野外长矛的逐步完成，因此不需要 core 多步规划改动。

## 5. 门禁结果

| 门禁 | 结果 |
| --- | --- |
| `npm ci` | PASS，干净安装 |
| `npm run typecheck` | PASS |
| `npm test` | PASS，66 files / 1277 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS，74/74 损坏用例拒绝；用户原有 save audit 改动已恢复 |
| `npm run audit:deps` | PASS，R1/R2/R3/R4 均 0 |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS，provenance / manifest / runtime usage 均 PASS |
| `npm run art:security:browser` | PASS |
| `npm run art:security:repo` | PASS |
| `npm run simulate -- --games 500 --seed-prefix PHASE4C2 --regression --output reports/phase4c2-balance.json` | PASS，500/500；引擎健康指标全通过 |
| `npm audit --omit=dev` | PASS，0 vulnerabilities |

确定性测试因第一步调整医院物资池而改变 RNG 后续序列；仅把
`tests/phase3a1Stats.test.ts` 的固定观察种子从 `STAT-11` 调整为仍触发
`research_anomaly` 的 `STAT-1`，原有伤害/统计断言没有削弱。其余确定性与物品守恒
断言保持通过。没有 bump `GAME_VERSION`：仅有数据层展示/配方可见性扩展，旧存档
结构和既有物品 id 不变，74 例存档审计通过。

## 6. 浏览器证据

证据均由 `npm run build` 后的 `npm run preview` 干净生产构建采集，console errors
和 page errors 均为 0：

- [1280×720 自动建议](output/phase4c2-browser/01-desktop-auto-suggestion.png)
- [1280×720 三级子目标起始](output/phase4c2-browser/02-desktop-subgoal-start.png)
- [1280×720 子目标推进](output/phase4c2-browser/03-desktop-subgoal-advanced.png)
- [390×844 移动端图鉴](output/phase4c2-browser/04-mobile-codex.png)
- [runtime-errors.json](output/phase4c2-browser/runtime-errors.json)

运行时快照包含 viewport、横向宽度、建议/子目标/图鉴节点数量和
`render_game_to_text`。证据分级：

- `CODE-VERIFIED`：可见性接缝、依赖树深度、自动建议不覆盖手动目标、命令回调、
  子目标推进、信息边界、VisualImage fallback、物品守恒和全部门禁。
- `RUNTIME-VERIFIED`：生产预览中的自动建议与采纳、三级子目标推进、图鉴展开、
  新武器 emoji fallback、390px 无横向溢出、0 console/page errors。
- `HUMAN-PLAYTEST-NEEDED`：真实触控下图鉴长列表的滚动手感、玩家对推荐优先级的
  主观理解，以及跨区域取材的可玩性。

## 7. Scope 与信息边界自查

- 0 次图像生成 API 调用；0 张新增或修改的 `public/assets/**/*.png`。
- `art/approved-assets.json`、Candidate 状态和 manifest 未改。
- `src/core/**` 未改；本轮仅改 `src/data/recipes.ts`，以及 UI 展示层、测试和观察工具。
- 未改战斗公式、命中率、伤害、技能、NPC AI、掉落、RNG 实现、世界事件、禁区规则或 Save schema。
- 图鉴公开的是静态配方构成、静态物品摘要和静态来源池；不显示真实剩余库存、未发现地面掉落、
  他人背包、NPC 位置/意图或未来事件。
- 4B-1～4B-6 的既有视觉决策未重排；仅在现有 PlanningDrawer 中增加图鉴入口和合成引导内容。
- 工作区原有 `reports/save-validation-audit.json` 与 `.md` 用户改动保留为未提交状态，
  未混入本阶段提交。
