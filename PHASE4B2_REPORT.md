# Phase 4B-2 验收报告

## 结论

技术验收：PASS，READY FOR PHASE 4B-3。

基线为 Phase 4B-1 提交 `69791c3`。本阶段只处理 UX-003（玩家侧战斗视觉）与 UX-004（Combat / Injured 状态不可感知），没有重做 4B-1 的 Zone Hero、路线规划、StatusBar 或探索 ActionBar。

## 改动摘要

- `EncounterPanel` 改为 Player / 遭遇反馈与行动 / Enemy 三段式构图。
- 玩家侧复用 `resolveCharacterVisualState(player, { activeEncounter })` 和现有 `VisualImage`，渲染正式 Combat / Injured / Portrait 图并保留三级降级路径；敌方继续使用同一解析器和正式图路径。
- 新增纯展示层 `src/ui/combatPresentation.ts`，只承载遭遇状态、三态、行动分组和 Guard / EXPOSED / 技能状态的 label/icon/description。
- 即时反馈区突出最近一条战斗结果，战斗日志仍保留短历史；攻击和次级行动分组展示，命中率、体力成本、重击风险、脱离率和技能状态常驻可见。
- StatusBar 增加“遭遇战进行中 / 遭遇已结束”P0 状态 cue；普通探索行动在 active encounter 时继续由既有锁定逻辑禁用。
- 窄屏采用紧凑三列敌我/中央行动排布，外层 `.board` 承担主要滚动；不引入 bottom sheet、drawer 或 4B-5 固定行动栏。

## 实测对比

| 指标 | 4B-0 基线 | 4B-2 干净 preview 实测 | 结论 |
| --- | ---: | ---: | --- |
| 玩家遭遇视觉 | 无玩家侧视觉；仅顶栏 `.status-visual` 18×18 | 1280px：102.4×140.8；1024px：81.9×112.6；390px：58×78 | 玩家视觉达到可感知尺寸 |
| 敌方遭遇视觉 | `.encounter-character-visual` 42×56 | 与玩家同尺寸档位 | 敌我权重平衡 |
| 1280×720 遭遇区块 | 原型形态 | 686×493.2 | 桌面主焦点明确 |
| 1024×720 遭遇区块 | 未完成三段式 | 760×482.4，`scrollWidth=1024` | 中等桌面无横溢出 |
| 390×844 遭遇区块 | 约 505px | 559.7px | 增长约 10.8%，在紧凑布局护栏内 |
| 390×844 横向宽度 | 390 | `bodyScrollWidth=documentScrollWidth=390` | 无横向溢出 |
| 390×844 行动可达 | 需向下滚动 | browser 证据断言 6 个遭遇按钮完整进入视口 | 攻击 / 侦察 / 防御 / 逃跑均可达 |

## 信息边界自查

- [x] 玩家自身 HP、体力、状态、攻防仍可见。
- [x] 敌方身份、角色、无数字 HP 状态条/描述、武器、脱离率仍可见。
- [x] Guard、EXPOSED、技能就绪/冷却和战斗日志仍可见，并同时使用 icon + 文字。
- [x] 敌方精确 HP 数值未渲染；测试将 `enemy.hp=17`、`enemy.maxHp=100` 后断言遭遇 DOM 不含 `17/100` 或“生命 17”。
- [x] 未增加敌方隐藏装备、隐藏技能、下一步行动/意图或远处 NPC 数据。

## 三态与状态切换证据

- `CODE-VERIFIED`：测试覆盖 Combat、Injured、Resolved 后 Portrait 三态，断言正式图片路径分别为 `combat.png`、`injured.png`、`portrait.png`。
- `RUNTIME-VERIFIED`：`output/phase4b2-browser-final/` 为 `npm run build` 后的 `npm run preview` 生产构建证据；1280×720 覆盖健康 Combat、玩家 Injured、Guard/EXPOSED、Resolved；1024×720 覆盖桌面回归；390×844 覆盖紧凑遭遇与行动可达。
- `HUMAN-PLAYTEST-NEEDED`：仍需人工在真实设备上确认窄屏字体舒适度、触控滚动手感和长文本阅读体验；这些主观事项未被写成 runtime fact。

证据目录中的关键文件：

- `01-desktop-encounter-healthy.png`
- `01b-desktop-1024-encounter.png`
- `02-mobile-encounter.png`
- `03-mobile-encounter-actions-reachable.png`
- `04-desktop-encounter-injured-or-after-actions.png`
- `05-desktop-exposed-feedback.png`
- `06-desktop-encounter-ended.png`
- `runtime-errors.json`（console errors / page errors 均为空）

## 门禁结果

- `npm run typecheck`：PASS
- `npm test`：59 files / 1246 tests，全部 PASS
- `npm run build`：PASS
- `npm run audit:save`：PASS（74 / 74）
- `npm run audit:deps`：PASS（R1–R4 全 0）
- `npm run art:doctor -- --offline`：PASS
- `npm run art:validate`：PASS
- `npm run art:audit:phase4a`：PASS（manifest / provenance / candidate hygiene / runtime usage）
- `npm run art:security:browser`：PASS
- `npm run art:security:repo`：PASS
- `npm run simulate -- --games 500 --seed-prefix PHASE4B2 --regression`：整体 PASS（请求/实际均 500，引擎健康 PASS；回归模式下角色平衡为观察项，本次观察 ratio=3.00，但不构成 regression FAIL）
- `npm audit --omit=dev`：0 vulnerabilities
- `PHASE4B2_BASE_URL=http://127.0.0.1:4174 npx playwright test tests/browser/phase4b2-encounter-evidence.spec.ts`：PASS，1 test；生产 preview console/page errors 均为 0。

## Scope 声明

- 图像生成 API：0 次调用。
- `public/assets/**/*.png`：0 修改；35 张正式图逐字节保持不变。
- `art/approved-assets.json` / Candidate 状态：0 修改。
- `src/core/**` / `src/data/**`：0 修改。
- 命中率、伤害、体力成本、逃跑概率、技能、NPC AI、RNG、Save schema：0 修改。
- `package.json` version 与 `GAME_VERSION`：保持 `0.3.2`。
- 未实现 4B-3 搜索/物品/Craft、4B-4 世界事件/禁区最终表现、4B-5 drawer/bottom sheet、4B-6 全局 polish；4B-1 冻结 shell 未重做。
