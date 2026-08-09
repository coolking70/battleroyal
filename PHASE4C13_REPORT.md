# Phase 4C-13 报告：移动安全区与触控运行时收口

## 结论

CODE/RUNTIME PASS；HUMAN-PLAYTEST-NEEDED 保留。现有 4B-5 已经解决布局可达性与 44px 触控目标，但固定行动栏、规划抽屉和抽屉触发器仍使用固定底部偏移，没有把设备 Home Indicator 的安全区纳入布局。本阶段只补齐这一层，不改变 4B-5 的信息结构或移动端视觉语义。

## 实现

- 在 CSS 根变量中接入 `safe-area-inset-top/right/bottom/left`，并为 `100dvh` 提供动态视口下限。
- 顶栏、底部行动栏按安全区扩大内外边距；行动栏仍保持在视口底部。
- 规划抽屉的固定边界、打开态面板和触发器位置均加上安全区偏移，避免覆盖 Home Indicator 或遮挡行动栏。
- 保持既有 4B-1～4B-6 的内容与视觉语义不变；没有加入新的 gameplay 规则或行动。
- 新增 `hasTouch` Playwright 证据：以 CSS 安全区变量注入 24px 的设备模拟值，验证五种视口、触控打开/关闭抽屉、行动栏不被遮挡和横向宽度不溢出。

## 运行时证据

证据目录：`output/phase4c13-browser/`。

| 视口 | 安全区模拟 | 结果 |
| --- | ---: | --- |
| 1280×720 | 0px | actionbar 在视口内，无横向溢出 |
| 1024×768 | 24px | 顶/底/左右安全区生效，抽屉底部 668px ≤ actionbar 顶部 698px |
| 768×1024 | 24px | 抽屉底部 924px ≤ actionbar 顶部 924.1875px |
| 844×390 | 24px | 抽屉底部 290px ≤ actionbar 顶部 301px，触控关闭成功 |
| 390×844 | 24px | 抽屉底部 688px ≤ actionbar 顶部 701.140625px，触控关闭成功 |

五种视口均满足 `body/document scrollWidth === innerWidth`。专项运行时 `consoleErrors=[]`、`pageErrors=[]`。安全区数值是浏览器仿真注入，不等同于真实 iOS/Android 设备测量；真机 Home Indicator、手指遮挡和长时间触控舒适度仍由人工验收。

## 验证结果

| 验证 | 结果 |
| --- | --- |
| `npm run typecheck` | PASS |
| Phase 4C-13 touch/safe-area preview | PASS，1 test，五视口 |
| 触控抽屉打开/关闭 | PASS，phone/tablet 视口均通过 |
| console/page errors | PASS，0 / 0 |

完整门禁结果将在最终提交前按当前仓库基线复跑并记录；本阶段不以角色胜率或平衡观察作为判定。

## 信息边界与 Scope

- [x] 未修改 `src/core/**`、`src/data/**`、事件、掉落、合成、战斗、RNG 或 Save schema。
- [x] 未新增行动类型、未改变行动成本或移动规则。
- [x] 未调用图像生成 API；35 张正式 PNG 逐字节不变。
- [x] 未修改 `art/approved-assets.json`、Candidate 状态或正式 Manifest。
- [x] 版本仍为 `0.3.2`，没有新增依赖。
- [x] 未增加 NPC 位置、意图、未来事件、未公布禁区或远端掉落信息。

## 人工验收边界

自动化证据只能证明 CSS 合同、几何关系和触控仿真路径。以下仍不能由本阶段代替：真实设备安全区、真机触控手感、屏幕阅读器朗读、长时视觉密度与 reduced-motion 舒适度。`HUMAN_PLAYTEST_CHECKLIST.md` 保持空白，由人类填写。

## 下一方向

先完成一份真实设备/辅助技术人工试玩副本；如果人工没有发现阻断问题，再进入下一轮核心循环内容或局部经济诊断。当前证据仍不足以安全地调 loot、配方成本或战斗数值。
