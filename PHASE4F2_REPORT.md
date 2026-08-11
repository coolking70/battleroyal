# Phase 4F-2：成长系统的玩家呈现

## 结论

本阶段只做展示层：玩家自己的等级 / 经验并入既有顶栏 P0 生存资源组，升级通过现有 Toast 以非阻塞方式反馈，尸体掉落通过已经公开且可见的死亡事件 `dropCount` 标记为击杀战利品。未修改 `src/core/**`、`src/data/**`、战斗规则、事件流、存档、正式图片或依赖。

## 实施与逐项理由

- `src/ui/components/GrowthProgress.tsx`：在既有 `.survival-metrics` 内增加第三个成长子格。未新增常驻面板；非满级使用带文字数字的 `role=progressbar`，Lv.5 显示“已满级”并移除进度条。
- `src/ui/components/StatusBar.tsx`：把成长子格接入现有顶栏，不改 HP / 体力、危险区或其他 P0 信息。
- `src/utils/growthPresentation.ts`、`src/utils/useGame.ts`：只比较命令前后的玩家自身 `level/exp/attack/defense/maxHp/kills`，把已有命令结果拼接为 Toast。helper 与命令胶水保持在同一 utils 分层，避免 utils 反向依赖 UI。攻击、击杀、合成、搜索 / 移动、休息分别有可感知文案；升级文案包含三项实际收益。没有新增事件、命令或随机抽取。
- `src/ui/components/Toast.tsx`、`src/ui/styles.css`：升级 Toast 增加金色非阻塞视觉、`role=status`、`aria-live=polite`、`aria-atomic=true`；遭遇态上移到 6 个战斗动作之上，reduced-motion 继续沿用全局关闭动画规则。
- `src/ui/screens/GameScreen.tsx`：仅从 `visibleEventsForPlayer` 中查找玩家造成的公开 `CHARACTER_DIED`，用其合法 `dropCount` 渲染“击杀战利品”提示；不读取 `zone.loot` 或 NPC 意图。
- `src/ui/components/EncounterHero.tsx`：保留原有敌方合法可见字段；对战报字符串增加展示层成长数字兜底过滤，避免未来的 `等级 / 经验 / level / exp + 数字` 沿战报泄露。正常核心战报不含这些字段。
- `src/App.tsx`：`render_game_to_text` 只补充玩家自己的成长 / 属性字段，未补充敌方成长字段。

## 玩家体验与来源文案

| 来源 | 玩家可感知提示 |
| --- | --- |
| 攻击结算 | `战斗结算 +N EXP` |
| 击杀 | 追加 `击杀额外奖励` |
| 合成 | `合成成长 +N EXP` |
| 搜索 / 移动 | `探索成长 +N EXP` |
| 休息 | `休息不会获得经验` |

`N` 从玩家自身命令前后的累计成长状态推导；达到等级上限后不伪造继续增长。经验数值、升级效果与排序仍完全来自 4F-1 核心。

## 证据

固定状态证据脚本：`tests/browser/phase4f2-growth-presentation-evidence.spec.ts`。夹具只固定已有状态 / NPC 输入，未修改生产决策：升级遭遇夹具让 NPC 体力为 0，使其执行既有免费休息出口，从而保持遭遇画面；尸体夹具调用既有 `killCharacter` 生成真实掉落。

截图保存在被忽略的 `output/phase4f2-browser/`，不提交仓库：

- `01-desktop-level-exp.png`：1280×720 顶栏 Lv.1 / 0/20 EXP。
- `02-desktop-encounter-level-up.png`：活跃遭遇中升级；Toast 显示 `升级 Lv.2！攻击 +1 · 防御 +1 · 最大生命 +10`，6 个战斗动作仍在视口底部。
- `03-desktop-corpse-loot.png`：击杀后显示“击杀战利品”、3 件战利品和地面上的 3 件物品。
- `04-mobile-max-level.png`：390×844 显示 Lv.5 / 已满级，无永不填满的进度条。

已实际打开生产预览并通过 web-game 短操作回归；截图均已人工检查。浏览器证据 1/1 通过，console errors / page errors 均为 0。

## 4D / 4B 硬指标

### 1280×720 与 390×844

| 指标 | 目标 | 实测 |
| --- | ---: | ---: |
| 常驻信息块 | 5 | 5 |
| 首屏空态文案 | 0 | 0 |
| 实时 `[title]` | 0 | 0 |
| 6 战斗动作所需滚动 | 0 | 0（生产浏览器 DOM 均可见） |

`reports/phase4f2-runtime.json` 记录了 390×844 的最终生产测量：`bodyScrollWidth=390`、`documentScrollWidth=390`、`titleCount=0`、行动栏底边 `844`。

### 五视口横向溢出对照

来自生产预览上的既有 4B-2 五视口回归，叠加本轮顶栏 / Toast 变更后重跑通过：

| 视口 | body scrollWidth | document scrollWidth | 横向溢出 | 战斗动作 |
| --- | ---: | ---: | --- | ---: |
| 1280×720 | 1280 | 1280 | 否 | 6 |
| 1024×768 | 1024 | 1024 | 否 | 6 |
| 768×1024 | 768 | 768 | 否 | 6 |
| 844×390 | 844 | 844 | 否 | 6 |
| 390×844 | 390 | 390 | 否 | 6 |

4D-2 信息架构回归仍报告常驻块 5、首屏空态 0、`[title]` 0；4C-3 零体力生产证据继续通过。

## 信息边界自查

- 顶栏成长组件只接收 `player`。
- `render_game_to_text` 只新增玩家自身成长字段；没有敌方 `level/exp`。
- `EncounterHero` 只显示既有合法敌方身份、描述性生命状态、武器、EXPOSED、共享命中 / 脱离率与玩家攻防；不显示敌方等级 / 经验 / 精确 HP。
- 遭遇战报和日志仍经 `visibleEventsForPlayer`；击杀战利品标识只消费公开 `CHARACTER_DIED.dropCount`。
- 新增边界测试用含“敌人等级 / 经验”恶意战报验证渲染结果不泄露。

## 约束声明

- `src/core/**`：零修改。
- `src/data/**`：零修改；版本保持 `0.4.0`。
- `public/assets/**/*.png`：零修改，35 张逐字节不变。
- `art/approved-assets.json` 与 Candidate 状态：零修改。
- 无新增命令、弹窗、依赖、随机数、自动装备或玩法数值。
- 4F-1 的 DebugPanel 仍是唯一允许暴露 NPC 成长的开发工具；普通遭遇 UI 不显示 NPC 等级 / 经验。

## 测试与门禁

最终门禁结果：

- 干净 `npm ci`：PASS；`npm run typecheck`：PASS。
- `npm test`：PASS，83 test files / 1405 tests（较基线增加 6 tests，未削弱既有断言）。
- `npm run build`：PASS。
- `npm run audit:save`：PASS，83 / 83；新增 level / exp 缺失、类型、越界、阈值与满级状态用例均拒绝非法存档。
- `npm run audit:deps`：PASS，R1–R4 均为 0；`npm audit --omit=dev`：PASS，0 vulnerabilities。
- `art:doctor -- --offline`、`art:validate`、`art:audit:phase4a`、`art:security:browser`、`art:security:repo`：全部 PASS。正式图片与 Manifest 未改动。
- 500 局回归：请求 / 实际均为 500，engine health PASS；胜率观察值按项目规则不作为门禁（报告中的 balance observation 为 FAIL 不影响本轮结论）。
- 生产预览浏览器证据：本轮 spec 1 / 1 PASS；console errors / page errors 均为 0。4B-2 五视口、4D-2 信息架构、4C-3 零体力回归继续通过。

新增 `tests/phase4f2GrowthPresentation.test.tsx` 覆盖顶栏进度、满级、来源文案、升级收益、战报边界、战利品标识与 `[title]`；浏览器 spec 覆盖生产截图、ARIA、五块结构、溢出与 console/page errors。

机器快照：`reports/phase4f2-runtime.json`、`reports/phase4f2-balance.json`。
