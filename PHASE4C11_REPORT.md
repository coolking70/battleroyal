# Phase 4C-11 报告：证据可靠性与规划抽屉可访问性收口

## 结论

PASS（代码、自动化回归与生产预览证据）。本阶段处理了两份已失效的历史浏览器证据，并收口规划抽屉的键盘焦点与读屏语义。没有改变游戏规则、经济、信息边界、存档结构或正式美术资产。

## 发现的问题

1. Phase 4B-3 与 4B-5 都用 `PENDING-0` 依赖真实搜索自然撞满背包。当前版本在该路径上可能先因战斗/禁区进入结算页，证据脚本随后无限等待探索按钮；这不是待处理拾取产品路径的有效证明。
2. Phase 4B-5 仍断言规划面板只有 2 个 tab，而 Phase 4C-2 已增加公开图鉴；关闭按钮也用不可匹配的旧 accessible name 定位。

## 实现

- 新增 `tests/browser/pendingPickupFixture.ts`：构造通过真实存档加载校验的满背包 + `pendingPickup` 状态，浏览器仍通过真实 UI 完成“放弃该物品”决策，不旁路调用命令。
- 更新 Phase 4B-3/4B-5 证据：使用确定性夹具、当前 3 个规划 tab 和稳定的关闭按钮定位。
- `PlanningDrawer` 在打开状态下限制 Tab/Shift+Tab 在抽屉内部循环，Escape 关闭，关闭后继续回焦触发按钮；新增 `aria-labelledby`。
- 规划 tab 增加 `aria-controls`，当前内容增加对应 `role="tabpanel"` 与 `aria-labelledby`；同步调整容器 CSS，保持桌面与窄屏布局。

## 验证结果

| 验证 | 结果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS，70 files / 1295 tests |
| `npm run build` | PASS，Vite 8.2.1 |
| 全部生产浏览器证据 | PASS，14/14，0 console errors / 0 page errors |
| Phase 4B-3 搜索/背包证据 | PASS，确定性待处理拾取夹具通过 |
| Phase 4B-5 五视口证据 | PASS，3-tab 规划面板与待处理拾取通过 |
| Phase 4C-11 抽屉可访问性证据 | PASS，390×844；焦点循环、Escape、回焦和 tabpanel 关系通过 |
| `npm run audit:save` | PASS，74/74 损坏用例拒绝，构造失败 0 |
| `npm run audit:deps` | PASS，R1/R2/R3/R4 全为 0 |
| art doctor / validate / provenance | PASS |
| browser/repository secret audit | PASS |
| 500 局引擎健康回归 | PASS，requested=actual=500，timeout/deadlock/illegal/hard-limit 全为 0 |
| `npm audit` / `npm audit --omit=dev` | PASS，0 vulnerabilities |

回归报告：[`reports/phase4c11-balance.json`](reports/phase4c11-balance.json) / [`reports/phase4c11-balance.md`](reports/phase4c11-balance.md)。胜率与角色差异仅作观察，不作为本阶段判定。

## 生产预览证据

- `output/phase4c11-browser/`：390×844 抽屉焦点与 tabpanel 运行时快照，`body/document scrollWidth = 390`，console/page errors 均为空。
- 全部 `tests/browser/*.spec.ts` 在 `npm run build` + `npm run preview` 上通过；既有 4B-2～4B-6、4C-1～4C-9 证据均未回归。

## Scope 声明

- 未修改 `src/core/**`、`src/data/**`、战斗/掉落/合成/事件/RNG/Save schema。
- 未调用图像生成 API；35 张正式 PNG 逐字节不变；未修改 Manifest、Candidate 状态或 `art/approved-assets.json`。
- `GAME_VERSION` 与应用版本仍为 `0.3.2`。
- `reports/save-validation-audit.json` 与 `.md` 是用户已有工作区改动，未纳入提交。

## 尚需人工验收

真机触控、屏幕阅读器实际朗读、长时游玩密度和完整胜利/失败/平局体验仍必须由人类填写 `HUMAN_PLAYTEST_CHECKLIST.md` 的复制件；本阶段不伪造这些证据。

## 下一方向

先完成一次真实人工核心循环验收，再根据人工反馈决定是否做局部经济/路线调整。当前自动回归没有为改动掉率、配方成本或战斗数值提供依据。
