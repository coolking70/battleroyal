# Phase 4C-9 报告：远处地面掉落信息边界硬化

## 结论

本阶段修复一个既有的展示层信息泄露：`ZoneMap` 之前对六个区域都读取并显示
`zone.groundItems.length`，导致玩家可以从路线地图得知远处区域存在多少地面掉落。
现在地图只在玩家当前所在区域显示“掉落 N”；远处地面库存不再进入玩家地图，
当前区域的地面掉落列表和拾取操作保持不变。

这符合 4C-2 已冻结的信息边界：静态物资来源可以公开，但未发现的地面掉落、
区域实际剩余库存、他人背包和装备不得公开。DebugPanel 仍保留完整调试信息。

## 实现与边界

- 修改仅在 `src/ui/components/ZoneMap.tsx`，使用 `isCurrent` 作为展示门槛。
- 没有修改 `src/core/**`、`src/data/**`、事件、掉落、RNG、存档或游戏规则。
- 当前区域仍显示掉落数量，中心舞台仍展示当前区域的具体地面物品和“拾取”按钮；
  玩家不会因为地图隐私收口而失去当前区域的合法操作。

## 回归覆盖

新增单元回归：同时在当前区域放置木材、远处区域放置铁块，断言当前区域显示
“掉落 1”，远处区域不出现“掉落”文本。

新增干净生产预览 Playwright 证据：同一合法存档在 1280×720 下验证当前/远处
两种状态、当前物品可拾取、远处物品不泄露、无横向溢出和 0 console/page errors。

证据目录：[`output/phase4c9-browser`](output/phase4c9-browser)

## 证据分级

### CODE-VERIFIED

- 地图只为 `isCurrent` 区域渲染地面掉落提示。
- 全量 UI/核心回归测试通过，信息边界单测通过。

### RUNTIME-VERIFIED

- `npm run build` + `npm run preview` 的 Playwright 证据通过。
- 1280×720：当前区域显示“掉落 1”与当前木材拾取项；远处区域没有掉落提示。
- `body.scrollWidth` 与 `document.documentElement.scrollWidth` 均为 1280；console/page errors 均为 0。
- `develop-web-game` 技能客户端烟测正常，截图与 `render_game_to_text` 输出正常。

### HUMAN-PLAYTEST-NEEDED

- 真人是否理解“当前区域可拾取、远处区域需移动后确认”的信息节奏；
- 真机触控、长局路线规划和屏幕阅读器体验。

## 门禁结果

| 门禁 | 结果 |
| --- | --- |
| `npm ci` | PASS，干净安装 165 packages |
| `npm run typecheck` | PASS |
| `npm test` | PASS，70 files / 1294 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS，74/74 损坏存档拒绝、74/74 有效存档通过 |
| `npm run audit:deps` | PASS，R1/R2/R3/R4 均 0 |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS |
| `npm run art:security:browser` | PASS |
| `npm run art:security:repo` | PASS |
| 500 局引擎健康回归 | PASS，500/500；0 timeout/deadlock/illegal/hard-limit |
| `npm audit --omit=dev` | PASS，0 vulnerabilities |

500 局报告保存在 [`reports/phase4c9-balance.json`](reports/phase4c9-balance.json)
及其 Markdown 版本中。角色平衡字段本次为 observation-only，ratio=3.50 的
观察性 FAIL 不影响本阶段展示层/引擎健康判定。

## Scope 声明

- 未调用图像生成 API；35 张正式 PNG 逐字节不变。
- 未修改 Manifest / Candidate 状态、package 依赖、`GAME_VERSION`（仍为 `0.3.2`）。
- 用户原有 `reports/save-validation-audit.json/.md` 改动未纳入提交。

## 下一方向

继续做展示层信息边界审计和可验证的核心循环收口；经济、掉率与战斗数值仍等待
人工试玩清单后再决定，不用自动回归胜率代替真人决策证据。
