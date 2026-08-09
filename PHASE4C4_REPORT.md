# Phase 4C-4 报告：Core Loop Playtest & Economy Diagnosis

## 结论

Phase 4C-4 的诊断目标已完成。本轮没有修改游戏规则、经济数值、
`src/core/**`、`src/data/**`、存档 schema 或正式美术资产。

当前结论是：**暂不做掉率、配方成本或战斗数值调整**。自动诊断显示基本武器
获取并非只有直接掉落，合成已经承担主要来源；但玩家高阶武器完成率仍低，且
死亡主要发生在战斗。由于现有自动玩家不会主动发出 `EQUIP`，死亡时“已装备”
字段不能直接作为真实玩家战斗能力的经济证据。因此下一步应先完成真实玩家/更
代表性的自动玩家闭环（设定目标 → 搜集 → 合成 → 装备 → 遭遇），再决定是否
需要经济调节。

## 本轮完成项

- 扩展 `tools/autoPlayer.ts` 的可选诊断能力：保留未被日志裁剪的完整事件流、
  首件武器来源、玩家死亡前装备/携带物品快照，以及零体力防御/逃跑计数。
- 新增 `tools/observeCoreLoopDiagnosis.ts`，固定运行 4 角色 × 5 策略 ×
  20 种子的 400 局矩阵。它只经由 `executeCommand` 正式命令通道运行；健康性
  与胜率/角色平衡分离。
- 新增诊断回归测试，确认开启完整事件追踪不会改变同种子最终状态、结局或命令
  序列，并约束应急动作计数与死亡快照口径。
- 新增干净生产预览证据：1280×720 探索与合成引导、390×844 零体力遭遇。
- 修正 `COMBAT_DESIGN.md`、`README.md` 和自动玩家注释中关于零体力防御与
  无出口逃跑的过时说明。

## 诊断方法与健康性

输入参数：

```text
seed prefix: PHASE4C4-CORE
seed count: 20
matrix: 4 characters × 5 policies
requested games: 400
actual games: 400
```

| 健康指标 | 结果 | 判定 |
| --- | ---: | --- |
| 请求局数 = 实际局数 | 400 = 400 | PASS |
| timeout / deadlock / illegal / hard-limit | 0 | PASS |
| healthy games | 400 / 400 | PASS |
| 胜率、存活率、角色平衡 | 仅记录 | 不作门禁 |

原始数据：[`reports/phase4c4-core-loop-diagnosis.json`](reports/phase4c4-core-loop-diagnosis.json)

## 核心循环观察

| 指标 | 结果 | 解读 |
| --- | ---: | --- |
| 至少获得一件武器 | 160 / 400 = 40.0% | 仍有 60% 对局未获得武器 |
| 首件武器来自合成 | 93 / 160 = 58.1% | 合成已是首件武器的主要来源 |
| 首件武器来自拾取 | 67 / 160 = 41.9% | 直接/地面拾取仍提供补充路径 |
| 首件武器获得时间 | 中位 9，平均 10.79 | 早期并非完全没有武器反馈 |
| 玩家完成中间部件的对局 | 113 / 400 = 28.25% | 中间层已被实际走到，但不是主流每局路径 |
| 玩家完成任一高阶武器 | 32 / 400 = 8.0% | 与 4C-2 的 200 局约 8.5% 同量级，未见自动增长 |

高阶武器分项：

| 高阶武器 | 玩家对局数 | 玩家率 | 全体合成事件 |
| --- | ---: | ---: | ---: |
| 野外长矛 | 1 | 0.25% | 2 |
| 钢刃斧 | 5 | 1.25% | 21 |
| 复合弓 | 11 | 2.75% | 32 |
| 绝缘铁管 | 12 | 3.00% | 18 |
| 绝缘电击棒 | 3 | 0.75% | 13 |

`高阶武器玩家对局数`按对局去重；分项相加可能大于去重总数。

## 遭遇、逃跑与死亡诊断

| 指标 | 结果 |
| --- | ---: |
| 玩家进入遭遇的对局 | 36 / 400 |
| 玩家遭遇开始事件 | 39 |
| 玩家攻击事件 | 4,675 |
| 玩家防御事件 | 1,082 |
| 玩家逃跑事件 | 6,762 |
| 其中原地脱离 | 2,198 |
| 零体力防御/逃跑（自动玩家） | 0 / 0 |

零体力计数为 0 不代表 C3 修复未生效，而是本矩阵中的自动策略没有在遭遇中
恰好落到该边界；C3 的最后安全区不变量已由专门的核心测试与生产预览 fixture
覆盖。

死亡共 383 局，原因分布：

| 死亡原因 | 次数 | 死亡占比 |
| --- | ---: | ---: |
| 战斗 | 313 | 81.7% |
| 衰竭 | 34 | 8.9% |
| 禁区侵蚀 | 33 | 8.6% |
| 研究设施异常 | 3 | 0.8% |

死亡前快照显示 149 局携带武器、128 局携带护甲；已装备武器/护甲均为 0，
原因是 `tools/autoPlayer.ts` 当前不主动发出 `EQUIP` 命令。这个工具事实已被
单独记录，不能误读成“玩家获得装备后仍无法战斗”的结论。

## 经济诊断与下一方向

### 当前判断

1. 不直接调 loot pool：首件武器中合成占 58.1%，说明“武器主要靠合成”的设计
   在命令层已经成立；把武器普遍放入 basePool 会混淆本轮刚修正的获取路径。
2. 不直接调配方成本或战斗数值：高阶武器 8.0% 与 4C-2 观察值同量级，
   但自动玩家没有完整执行“目标采纳与装备”闭环，当前数据不足以区分引导问题、
   装备操作问题和经济供给问题。
3. 优先补齐诊断代表性：让自动玩家可选地模拟公开 UI 意图（采纳建议、保留并
   执行目标、合成后装备），或采集真实玩家 playtest 的同口径数据；这些应先做
   在工具/证据层，不改变规则。
4. 下一轮若真实闭环仍显示 60% 无武器或高阶完成率过低，再按最小范围评估：
   先调引导/目标采纳与装备可见性；只有证据显示材料供给不足时，才针对单条
   跨区域材料路径做局部经济调整，并重新跑健康回归。

## 证据分级

### CODE-VERIFIED

- 诊断工具只通过 `runAutoGame` → `executeCommand`，没有旁路改写规则。
- 完整事件追踪为可选项；诊断模式与非诊断模式同种子最终 state、结局和命令
  计数一致。
- C3 零体力逃跑/防御测试仍通过，玩家与 NPC 共享同一套规则。

### RUNTIME-VERIFIED

- `npm run build` + `npm run preview` 下的专用 Playwright 证据通过。
- 1280×720：探索态可启动；合成面板显示“武器主要靠合成”和自动建议。
- 390×844：最后安全区零体力遭遇中，防御与逃跑按钮均可用；快照显示无横向
  溢出（`body/document scrollWidth = 390`）。
- `output/phase4c4-browser/runtime-errors.json`：console errors = 0，page errors = 0。

证据目录：[`output/phase4c4-browser`](output/phase4c4-browser)

### HUMAN-PLAYTEST-NEEDED

这些项目不能由当前 headless 浏览器事实替代：

- 真机触控、底部安全区、抽屉/行动栏的手指可达性；
- 屏幕阅读器对 live feedback、合成建议、战斗行动名称和 disabled 原因的朗读；
- 长时间游玩时的视觉密度、行动成本是否容易理解；
- 胜利、失败、平局 ResultScreen 的完整真实游玩路径；
- 键盘 + 辅助技术的完整 Tab 顺序；
- 如要进入性能优化，再单独做低端设备性能 profile。

候选清单仍保留在 [`PHASE4C_CANDIDATES.md`](PHASE4C_CANDIDATES.md)，本轮不把
主观人测项目伪装成自动化 PASS。

## 门禁结果

| 门禁 | 结果 |
| --- | --- |
| `npm ci` | PASS，干净安装完成 |
| `npm run typecheck` | PASS |
| `npm test` | PASS，68 files / 1283 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS，损坏用例 74/74 拒绝、有效用例 74/74 通过 |
| `npm run audit:deps` | PASS，R1/R2/R3/R4 均 0 |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS，Manifest / provenance / candidate hygiene / runtime usage 均通过 |
| `npm run art:security:browser` | PASS，189 files |
| `npm run art:security:repo` | PASS，747 tracked files |
| `npm run simulate -- --games 500 --seed-prefix PHASE4C4 --regression --output reports/phase4c4-balance.json` | PASS，500/500，可信率 100% |
| `npm audit --omit=dev` | PASS，0 vulnerabilities |

500 局回归的胜率为 3.8%，仅作为观察数据；本阶段没有把它作为经济或角色
平衡的 PASS/FAIL 条件。回归原始报告：
[`reports/phase4c4-balance.json`](reports/phase4c4-balance.json)。

## Scope / 资产 /版本声明

- `src/core/**`：0 个文件修改。
- `src/data/**`：0 个文件修改。
- `public/assets/**/*.png`：0 个文件修改，35 张正式图逐字节不变。
- `art/approved-assets.json` / Candidate 状态：未修改。
- package 依赖：未新增。
- `GAME_VERSION` / package version：保持 `0.3.2`；本轮只有诊断工具和文档，
  不涉及存档兼容性变化，不需要 bump。
- `reports/save-validation-audit.json/.md`：保留工作区既有用户改动，不纳入本轮提交。
