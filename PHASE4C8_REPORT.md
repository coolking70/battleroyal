# Phase 4C-8 报告：结算页信息边界收口

## 结论

本阶段完成一个独立的展示层安全收口：结算页关键事件时间线不再直接读取完整
事件流，而是复用主界面 `visibleEventsForPlayer` 的可见性边界；最终排名不再
展示 NPC 的 planner 性格标签。玩家自己的行动、玩家参与的战斗和公开死亡播报
仍然保留。

## 缺陷与修复

- 修复前：`ResultScreen` 的 `keyEvents` 直接遍历 `state.events`，可能把 NPC 的
  `CRAFT_GOAL_SET` 或非玩家 `ENCOUNTER_STARTED` 带到结算页。
- 修复后：时间线先通过 `visibleEventsForPlayer(state.events, player.id)`，再按
  原有关键事件白名单排序和截取；没有修改 core 事件、结算逻辑或存档结构。
- 修复后：排名仍展示公开的参赛者/角色、击杀数和结局，但移除 NPC 的内部
  planner 性格；玩家自己的“策略”统计保留，因为它描述玩家自身。

## 回归覆盖

新增 UI 回归测试构造了 NPC 隐藏制作目标、NPC 间遭遇、玩家自己的制作目标和
公开死亡播报，断言：

- NPC 隐藏目标与非当前遭遇不会出现在结算时间线；
- 玩家自己的目标与公开死亡播报仍可见；
- NPC planner 性格标签不出现在最终排名。

## 证据分级

### CODE-VERIFIED

- 结算时间线复用与常驻日志相同的可见性谓词。
- 6 个 UI 测试通过，包含新增信息边界回归。
- `npm run typecheck` 通过。

### RUNTIME-VERIFIED

- `npm run build` 通过。
- `develop-web-game` Playwright 客户端在当前生产预览启动页完成烟测，截图与
  `render_game_to_text` 状态均正常；未报告 console/page error。

### HUMAN-PLAYTEST-NEEDED

- 真人从完整对局进入胜利、失败、平局结算页的阅读顺序与信息负担；
- 屏幕阅读器对时间线与排名的朗读；
- 真机触控和长局体验。

## 门禁结果

| 门禁 | 结果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS，70 files / 1293 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS，损坏 74/74 拒绝、有效 74/74 通过 |
| `npm run audit:deps` | PASS，R1/R2/R3/R4 均 0 |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS |
| `npm run art:security:browser` | PASS |
| `npm run art:security:repo` | PASS |
| `npm run simulate -- --games 500 --regression` | PASS，500/500；0 timeout/deadlock/illegal/hard-limit |
| `npm audit --omit=dev` | PASS，0 vulnerabilities |

500 局报告保存在 [`reports/phase4c8-balance.json`](reports/phase4c8-balance.json)
及其 Markdown 版本中。胜率与角色平衡只作观察，不作为本展示层修复的判定依据。

## Scope 声明

- `src/core/**`：0 个文件修改。
- `src/data/**`：0 个文件修改。
- `public/assets/**/*.png`：0 个文件修改；没有调用图像生成 API。
- Manifest / Candidate 状态：未修改。
- package / `GAME_VERSION`：保持 `0.3.2`。
- 未修改规则、经济、RNG、事件产生、结算或存档 schema。
- 用户已有的 `reports/save-validation-audit.json/.md` 改动未纳入本阶段。

## 后续方向

本阶段只关闭了一个信息边界旁路，不代替人工试玩。下一步仍应由人类完成真实
试玩清单，重点观察首次路线理解、遭遇前装备、完整结局以及真机/辅助技术体验；
在此之前不以自动模拟胜率为依据调整经济或战斗数值。
