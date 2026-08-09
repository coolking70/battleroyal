# Phase 4C-3 报告：零体力遭遇死锁修复

## 结论

PASS。修复了“最后一个安全区 + 体力 0 + 无消耗品”时的零体力遭遇死局，
并保持玩家与 NPC 使用同一套逃跑、防御和体力成本路径。

## 缺陷复现与修复

复现状态为：玩家与一名敌人在最后一个安全区、所有相邻区域均为
`restricted`、玩家体力为 0、背包为空。修复前，`fleeDestinations` 返回空数组，
`attemptFlee` 返回 `no_exit` 失败；随后 `fleeActor` 仍可进入追击分支，造成每次
尝试都白送敌人一次攻击。

本轮选择 C 的“原地脱离”方案：

- `fleeDestinations` 继续排除禁区，不把玩家送入规则禁止的目的地；
- 无可退区域时，`attemptFlee` 记录 `CHARACTER_ESCAPED`，标记
  `success: true, reason: "no_exit", stationary: true`，返回成功但不改变区域；
- 因为返回成功，`fleeActor` 不进入追击分支；该命令仍按 `FLEE` 规则推进一个时间单位；
- 没有新增遭遇动作类型、没有被动体力恢复、没有新增 state 字段。

这比允许逃入禁区更小、更可解释：不会绕过禁区状态规则，也不会把“脱离接触”
与“移动到禁区”混成同一件事。

## 零体力防御与防刷约束

`GUARD` 仅在 `actor.stamina === 0` 时成本为 0；体力为 1 时仍按配置需要 2 点，
继续被拒绝。这样零资源角色有一个有意义的减伤选择，同时不会把免费防御扩展到
任意低体力值。防御仍然只减免下一次受击，并在出手或受击后解除；未引入额外的
连续防御 state 字段或存档迁移。

## NPC 对称性验证

玩家和 NPC 均通过 `executeActorCommand` → `guardActor` / `fleeActor` → 共享的
`canPayActionCost` / `getActionStaminaCost`。新增测试实际分别以玩家和 NPC 身份验证：

- 两者在 0 体力时都能以 0 成本进入防御姿态；
- 两者在无相邻可退区域时都能原地脱离，均不发生追击；
- 玩家在 1 体力时防御仍被拒绝。

这不是仅依据代码结构推断，断言位于
`tests/phase4c3ZeroStaminaDeadlock.test.ts`。

## UI 与信息边界

遭遇面板文案已修正：

- 0 体力显示“防御本回合免费，或免费原地脱离”；
- 1 体力显示速攻/免费脱离可用，并明确防御需要 2 点；
- 逃跑的可访问名称区分“有可退区域时失败可能被追击”和“无可退区域时原地脱离”。

本轮没有改动日志过滤、合成图鉴或信息边界；没有新增 NPC、隐藏装备、未来行动、
未公布禁区或其他不可见信息。

## 验证结果

| 门禁 | 结果 |
| --- | --- |
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS，67 files / 1281 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS，74/74 损坏用例拒绝 |
| `npm run audit:deps` | PASS |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS |
| `npm run art:security:browser` | PASS |
| `npm run art:security:repo` | PASS |
| `simulate --games 500 --seed-prefix PHASE4C3 --regression` | PASS，500/500 |
| `npm audit --omit=dev` | PASS，0 vulnerabilities |

500 局回归健康指标：请求局数 500、实际局数 500；timeout 0、illegalState 0、
hard-limit 0。胜率 4.8% 仅作为观察数据，不作为本阶段 PASS/FAIL 条件。

`tests/determinism.test.ts`、`tests/phase3a1Stats.test.ts`、战斗与 NPC 测试均通过；
没有更新任何固定 RNG 期望值，因此没有需要逐条解释的期望值改动。

## 生产预览证据

证据目录：`output/phase4c3-browser/`。

- `01-desktop-zero-stamina-deadlock.png/json`：1280×720，遭遇 active，防御和逃跑
  均 enabled，显示“防御免费 / 原地脱离”；
- `02-desktop-after-stationary-flee.png/json`：点击逃跑后时间推进到 1，遭遇消失，
  玩家区域不变且显示原地脱离结果；
- `03-mobile-zero-stamina-deadlock.png/json`：390×844，同样两条出口可用，
  `bodyScrollWidth === documentScrollWidth === 390`；
- `runtime-errors.json`：console errors 0，page errors 0。

证据分级：上述 DOM、状态、宽度和错误计数属于 `RUNTIME-VERIFIED`；
“真机触控连续操作手感”仍属于 `HUMAN-PLAYTEST-NEEDED`。

## Scope 与版本声明

- `src/core/**` 仅改动与本任务直接相关的体力成本、逃跑结算及其说明注释；
  未改动战斗公式、技能、掉落、配方、事件、禁区推进、RNG 或 Save schema；
- `src/data/**` 未改动；
- `src/ui/components/EncounterPanel.tsx` 仅修正本任务涉及的行动可用性文案；
- 0 图像生成 API 调用，0 正式 PNG 修改，35 张图逐字节保持不变；
- `art/approved-assets.json`、Candidates、Manifest 未改动；
- `GAME_VERSION` 保持 `0.3.2`。本轮没有新增 state 字段，旧存档审计 74/74 通过，
  不需要 bump 版本；
- 没有引入新依赖。

审计工具重写的时间戳报告已恢复；工作区原有的
`reports/save-validation-audit.json` 与 `.md` 用户改动保留且未纳入本轮提交。
