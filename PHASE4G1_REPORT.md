# Phase 4G-1：成长曲线重定、战利品可见性与顶栏热区

## 结论

本轮只调整了 `src/data/gameConfig.ts` 的 `levelExpThresholds`，并做了展示层修正：
击杀战利品并入遭遇主视觉即时反馈、经验条改为与生命 / 体力同规格、生命 / 体力整框变为快捷恢复按钮。未修改战斗公式、经验来源、掉落、RNG、存档结构或版本号。

最终阈值为 `[30, 275, 550, 900]`，`GAME_VERSION` 保持 `0.4.0`。

## 1. 成长曲线调整过程

口径固定为 20 组（4 角色 × 5 策略）× 每组 5 局，共 100 局；所有候选复用相同的种子前缀 `PHASE4G1-DISTRIBUTION`。模拟只在进程内替换候选数组，未改变经验收益或其他配置。

| 阈值 | Lv.1 | Lv.2 | Lv.3 | Lv.4 | Lv.5 | 结果 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `[20,30,40,50]` 基线 | 0% | 0% | 1% | 1% | 98% | 满级过密 |
| `[30,60,100,160]` 建议初始值 | 0% | 0% | 8% | 65% | 27% | Lv.2 不足 |
| `[35,75,125,190]` | 0% | 0% | 33% | 57% | 10% | Lv.2 为 57%，未达 60% |
| `[30,250,500,800]` | 0% | 59% | 41% | 0% | 0% | Lv.2 差 1 个百分点 |
| **`[30,275,550,900]` 最终** | **0%** | **70%** | **30%** | **0%** | **0%** | **通过** |

中间试验还包括：`[30,70,120,180]`（Lv.2 1%、Lv.3 21%、Lv.4 62%、Lv.5 16%）、
`[35,120,250,400]`（6%、83%、11%、0%）、`[40,140,300,500]`（16%、83%、1%、0%）、
`[30,100,250,450]`（4%、84%、12%、0%）、`[40,160,300,500]`（21%、77%、2%、0%）、
`[30,200,400,700]` 与 `[35,180,350,650]`（均为 Lv.2 35%、Lv.3 65%）、
`[30,160,350,600]`（14%、85%、1%、0%）、`[40,200,400,700]`（33%、67%、0%、0%）、
`[30,300,600,1000]`（80%、20%、0%、0%）、`[30,400,800,1200]`（97%、3%、0%、0%）、
`[40,300,600,1000]`（83%、17%、0%、0%）以及 `[25,300,600,1000]`（78%、22%、0%、0%）。
这些括号内依次为 Lv.2、Lv.3、Lv.4、Lv.5；它们用于定位“Lv.2 ≥60%且 Lv.5 ≤10%”的窄区间，
最终采用 `[30,275,550,900]`。

最终实测快照见 [`phase4g1-level-distribution.json`](reports/phase4g1-level-distribution.json)：100 / 100 局 trustworthy；Lv.5 达成率 0% ≤ 10%，Lv.2 达成率 70% ≥ 60%，Lv.1 滞留率 0% ≤ 20%。

除阈值外的成长数值保持原值：战斗参与 8、击杀额外 7、搜索 / 探索 1、合成 2–6、等级上限 5。没有通过降低单次经验收益来达成分布目标。

## 2. 击杀战利品即时可见

`GameScreen` 只从 `visibleEventsForPlayer` 中查找本次遭遇的公开 `CHARACTER_DIED` 事件，并读取已有合法公开字段 `metadata.dropCount`。它把“击杀战利品：N 件已落地，可拾取”追加到 `EncounterHero` 的即时反馈行；因此击杀结算态在主视觉内即可看到，无需滚动。原下方上下文提示保留，用于后续拾取阶段的上下文提醒。

未改动 `killCharacter`、掉落选择、掉落数量或事件流。生产截图：

- `output/phase4g1-browser/01-desktop-kill-loot-immediate.png`：1280×720，主视觉即时反馈显示 3 件战利品。
- `output/phase4g1-browser/02-mobile-kill-loot-and-actions.png`：390×844，遭遇态 6 个动作仍可见。

## 3. 顶栏与热区

- `GrowthProgress` 复用共享 `Bar`，新增的 `bar-growth` 与 HP / 体力条同为 6px 高度、同一三列 metric surface；满级仍显示“已满级”，不渲染进度条。
- 快捷恢复改为 `VitalMetric`：外层保留原 `.survival-metric` 结构，内层 button 包含标签、bar、数值，`ref`、按钮角色、`aria-label`、`:focus-visible` 与现有 `USE_ITEM` 通道均保持。
- 浏览器实测生命 / 体力触控目标 45px（≥44px），标签与数值中心点命中同一 button，热区 / 视觉框面积比 1.000。
- 为保持 4E-1 的 P0 不遮挡规则，选择菜单改为锚定整个顶栏下方，而不是只锚定生命槽下方；四条快捷恢复判定逻辑未改动。

## 4. 信息架构与边界

- 常驻信息块仍为 5：topbar、zone rail、zone hero、craft goal bar、actionbar。
- 首屏空态文案 0；实时 DOM `[title]` 0。
- 生产预览五视口均无横向溢出，遭遇态 6 个动作无需滚动：1280×720、1024×768、768×1024、844×390、390×844。
- `EncounterHero` 的敌方等级 / 经验战报过滤器保留；本轮没有新增 NPC 等级 / 经验 UI。
- `src/core/**` 零修改；`src/data/**` 仅 `gameConfig.ts` 的 `levelExpThresholds` 修改；`GAME_VERSION`、存档 schema、35 张 PNG、Manifest 与 Candidate 状态均未改变。

## 5. 确定性回归说明

阈值变更会改变升级时机；升级改变属性后，既有种子后续行动的 RNG 消费可能随之偏移。`tests/phase3a1Stats.test.ts` 的 `STAT-1` 原先假定该种子一定触发 `research_anomaly`，最终阈值下该假设不再成立。该测试改为保留完整事件流，严格断言实际 `WORLD_EVENT_DAMAGE` 事件数量与 `worldEventImpact.research_anomaly.ticks` 一致，并在事件存在时继续校验伤害和致死字段；没有削弱统计不变量。

4F-1 / 4F-2 浏览器中的固定经验文本也改为读取当前阈值配置，边界断言仍然是具体数值断言。

## 6. 门禁结果

- `rm -rf node_modules && npm ci`：PASS，126 packages，0 vulnerabilities。
- `npm run typecheck`：PASS。
- `npm test`：PASS，84 test files / 1408 tests。
- `npm run build`：PASS。
- `npm run audit:save`：PASS，83 / 83，构造失败 0。
- `npm run audit:deps`：PASS，R1–R4 均为 0。
- `npm run art:doctor -- --offline`、`art:validate`、`art:audit:phase4a`：PASS。
- `npm run art:security:browser`、`art:security:repo`：PASS。
- `npm run simulate -- --games 500 --seed-prefix PHASE4G1 --regression`：请求 / 实际 500，可信率 100%，engine PASS；角色平衡 ratio=4.00 仅作观察，不作为本轮门禁。
- `npm audit --omit=dev`：PASS，0 vulnerabilities。
- 生产预览浏览器：本轮 G1 证据 1/1，合并回归 11/11；4B-5 五视口、4D-2、4C-3、4E-1 回归均通过；console errors / page errors 0。

机器快照：[`phase4g1-balance.json`](reports/phase4g1-balance.json)、[`phase4g1-level-distribution.json`](reports/phase4g1-level-distribution.json)、[`phase4g1-runtime.json`](reports/phase4g1-runtime.json)。截图均保存在被忽略的 `output/phase4g1-browser/`，未提交。
