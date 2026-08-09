# Phase 4B-1 验收报告

## 结论

技术验收：PASS，READY FOR PHASE 4B-2。

本阶段基于 `7179ba9d8c6315d383eaf8b2899c386dd85ecc66`，只处理 Main Gameplay Visual Shell & Zone Visual Hierarchy，对应 UX-001、UX-002、UX-008，并保留移动端护栏。

## 改动摘要

- 中栏当前区域改为主视觉 Hero：正式区域背景通过 `VisualImage` 渲染，叠加区域名、当前状态、描述和状态说明；正式图失败时仍沿用 SVG / emoji 三级降级。
- 六区域地图改为两列紧凑导航层，六个区域、相邻关系、移动可用性、噪音、情报和掉落信息均保留。
- 顶部 StatusBar 重组为 P0 生存状态：HP、体力、当前区域状态、禁区倒计时、遭遇状态相关上下文常驻高对比显示。
- 底部 ActionBar 重组为 P1 行动区：搜索 / 休息成本和移动入口集中表达。
- SAFE / WARNING / RESTRICTED 均同时使用颜色、文字标签、icon 和图案 / 边缘处理；WARNING / RESTRICTED 仅使用 CSS overlay，没有新增美术图。
- 新增纯展示层 `src/ui/zonePresentation.ts` 及 UI 测试，不改 core、data、数值、AI、掉落、Craft、RNG 或 Save schema。

## 实测对比

| 项目 | 4B-0 基线 | 4B-1 实测 | 结论 |
| --- | ---: | ---: | --- |
| 1280×720 当前区域视觉 | `.stage-zone-visual` 30×30 | Hero 718×265 | 主视觉升级 |
| 行内区域缩略图 | `.zone-visual` 20×20 | 保留为导航缩略图 | 信息职责清晰 |
| 1280×720 区域项 | 六行纵向列表 | 6 项两列紧凑导航 | 六区完整、拓扑可用 |
| 390×844 `scrollWidth` | 390 | 390 | 无横向溢出 |
| 390×844 遭遇中栏可用高度 | 195px 基线 | 960px（最新浏览器运行） | 不低于基线 |
| 390×844 逃跑按钮 | 初始在视口外 | 初始 `y=1221.5`；滚动 `.board` 至 `scrollTop=960` 后 `y=261.5..297.5`，位于中栏和视口内 | 可通过滚动触达 |

移动端最新运行还观测到：`.board.clientHeight=519`、`.board.scrollHeight=1682`、`scrollWidth=innerWidth=390`，无 console/page error。

## 浏览器证据

证据目录：`output/phase4b1-browser/`

- `01-desktop-safe.png`：1280×720，初始探索、SAFE Hero、P0/P1、六区导航。
- `02-desktop-warning.png`：1280×720，地图中 WARNING 使用 `⚠ + 预警 + 条纹`。
- `03-desktop-restricted.png`：1280×720，地图中 RESTRICTED 使用 `✕ + 禁区 + 斜纹 / 红色边缘`。
- `04-desktop-encounter.png`：1280×720，遭遇中的主界面；未增加精确敌方 HP 或隐藏信息。
- `05-mobile-safe.png`：390×844，竖屏初始 Hero 与紧凑导航。
- `08-mobile-encounter-actions-final.png`：390×844，滚动后遭遇按钮进入视口。

运行快照 `runtime.json` 记录了：1280×720 下 Hero 718×265、6 个 zone item、WARNING cue 1 个、RESTRICTED cue 1 个；`mobile-runtime.json` 是首次修正前的历史快照，移动端最终数字以上述最新回归结果为准。

## 验证分级

- `CODE-VERIFIED`：`zoneStatusMeta` 为三态提供 label / icon / pattern；React UI 测试覆盖 Hero、六区保留、三态非颜色线索、VisualImage 类名和 P0 文本可见性。
- `RUNTIME-VERIFIED`：标准 Playwright client、1280×720 / 390×844 截图和 `render_game_to_text` 运行快照；无浏览器运行错误。
- `HUMAN-PLAYTEST-NEEDED`：需要人工在六张正式深色背景上确认个人偏好的视觉层级、长时间操作舒适度，以及真实设备触控滚动体验。这些主观项目未计入技术 PASS 的 runtime 事实。

## 门禁结果

- `npm run typecheck`：PASS
- `npm test`：58 files / 1240 tests，全部 PASS（基线 57 / 1236，未减少）
- `npm run build`：PASS
- `npm run audit:save`：PASS（74 / 74）
- `npm run audit:deps`：PASS（R1–R4 全 0）
- `npm run art:doctor -- --offline`：PASS
- `npm run art:validate`：PASS
- `npm run art:audit:phase4a`：PASS（manifest / provenance / candidate hygiene / runtime usage）
- `npm run art:security:browser`：PASS
- `npm run art:security:repo`：PASS
- `npm run simulate -- --games 500 --seed-prefix PHASE4B1 --regression`：PASS（requested = actual = 500）
- `npm audit --omit=dev`：0 vulnerabilities
- `git diff --check`：PASS

## Scope 声明

- 图像生成 API：0 次调用。
- 正式图变更：0；`public/assets/**/*.png` 未修改。
- `art/approved-assets.json` / Candidate 状态：未修改。
- `src/core/**` / `src/data/**`：未修改。
- 版本和 `GAME_VERSION`：保持 `0.3.2`。
- 未提前实现 4B-2（Encounter 重构）、4B-3（搜索 / Inventory / Craft）、4B-4（事件 / 禁区最终表现）、4B-5（移动端 bottom sheet / drawer 收尾）或 4B-6（全局 polish / focus / debug / Result 收尾）。

