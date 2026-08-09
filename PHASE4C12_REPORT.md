# Phase 4C-12 报告：结算页语义与结果可达性收口

## 结论

PASS（代码、自动化回归与干净生产预览证据）。本阶段修复了结算页在内容高于视口时被垂直居中布局推到视口上方的问题，并补齐胜利、失败、平局三种结局的标题语义、初始焦点和面板关联。没有改变游戏规则、经济、信息边界、存档结构或正式美术资产。

## 发现的问题

`ResultScreen` 原本使用视觉 `div` 表示结局，缺少稳定的结果主标题；结算面板也没有统一的 heading/landmark 关系。更重要的是，`.result` 使用 `align-items: center`，当结果内容超过视口高度时，Hero 和结局标题会被布局到视口上方。DOM 虽然存在，但玩家第一眼看不到结局结论。

## 实现

- 将结算根节点改为 `<main aria-labelledby="result-title">`，胜利、失败、平局统一使用可聚焦的 `h1#result-title`。
- 进入结算页时把焦点放到结果标题，使用 `preventScroll`，避免焦点管理再次改变视觉滚动位置。
- 装备/背包、最终排名、关键事件时间线改为带 `aria-labelledby` 的 `section`；排名表和时间线增加稳定的辅助标签。
- 将 `.result` 改为顶部对齐并允许自身纵向滚动，确保 Hero、结论和后续信息按自然顺序进入视口。
- 保持时间线继续使用既有 `visibleEventsForPlayer` 过滤；本阶段未扩大 NPC、planner 或远端信息可见范围。

## 验证结果

| 验证 | 结果 |
| --- | --- |
| `npm ci` | PASS，lockfile clean install；126 packages，0 vulnerabilities |
| `npm run typecheck` | PASS |
| `npm test` | PASS，70 files / 1296 tests |
| `npm run build` | PASS，Vite 8.2.1 |
| Phase 4C-12 结算单测 | PASS，8 tests |
| 全生产浏览器证据 | PASS，15/15；本阶段改动后专项结算证据仍 PASS |
| 结果专项运行时 | PASS，胜利 / 失败 / 平局均可达；console errors 0，page errors 0 |
| `npm run audit:save` | PASS，74/74 损坏用例拒绝，构造失败 0 |
| `npm run audit:deps` | PASS，R1/R2/R3/R4 全为 0 |
| art doctor / validate / Phase 4A provenance | PASS |
| browser/repository secret audit | PASS |
| 500 局引擎健康回归 | PASS，requested=actual=500，timeout/deadlock/illegal/hard-limit 全为 0 |
| `npm audit` / `npm audit --omit=dev` | PASS，0 vulnerabilities |

角色平衡观察值为最高/最低非零胜率比 2.75；本阶段只把模拟作为引擎健康检查，未以角色平衡作为 PASS/FAIL，也未调整任何数值。

## 生产预览证据

证据目录：`output/phase4c12-browser/`。

- 胜利：1280×720；失败：390×844；平局：1280×720。
- 三种结局均渲染 `main.result`、`h1#result-title`、3 个有标题关联的 section、排名表标签和时间线标签。
- 三个快照均记录 `scrollY=0`，结果 Hero 与结局标题位于视口内；`body/document scrollWidth` 分别等于 1280 或 390。
- `runtime-errors.json`：`consoleErrors=[]`、`pageErrors=[]`。
- 证据夹具通过真实存档校验与 UI 的“继续上次对局”路径加载；随后仅使用 debug 的“推进时间”触发真实终局判定，未直接注入 React state。Debug 面板在截图前关闭。

## 信息边界自查

- [x] 结果时间线仍通过 `visibleEventsForPlayer` 过滤。
- [x] 未新增敌方精确 HP、隐藏装备、隐藏技能、未来行动、NPC planner 输出。
- [x] 最终排名只呈现既有公开结算信息；玩家自身策略摘要保持原有范围。
- [x] 没有新增远端区域库存、未发现掉落或他人背包数据。

## Scope 声明

- 未修改 `src/core/**`、`src/data/**`、战斗/掉落/合成/事件/RNG 规则或 Save schema。
- 未调用图像生成 API；35 张正式 PNG 逐字节不变；未修改 Manifest、Candidate 状态或 `art/approved-assets.json`。
- `GAME_VERSION` 与应用版本仍为 `0.3.2`。
- `reports/save-validation-audit.json` 与 `.md` 是工作区已有的用户改动，未纳入本阶段提交。

## 尚需人工验收

真机触控、屏幕阅读器实际朗读、胜利/失败/平局完整体验和长时游玩密度仍标记为 `HUMAN-PLAYTEST-NEEDED`。不修改、不代填 `HUMAN_PLAYTEST_CHECKLIST.md`。

## 下一方向

先进行一次真实人工核心循环与三种结局验收，重点确认结果信息优先级、触控滚动和屏幕阅读器朗读顺序。只有人工反馈或新的可复现诊断明确指出问题后，才进入下一轮局部经济/路线调整；当前 500 局回归没有为改动掉率、配方成本或战斗数值提供依据。
