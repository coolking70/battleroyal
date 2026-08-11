# Phase 4G-2 报告：战利品归属与世界事件横幅归位

## 结果摘要

本轮完成了两项展示/规则衔接：击杀战利品不再显示历史件数，且击杀者优先看到并拾取；其他角色（包括 NPC）必须在击杀发生后搜索该区域，才会看到并拾取这批遗物。世界事件横幅已移到主视觉区域名称旁，严重度、紧迫度、图标和文字均保留。

`GAME_VERSION` 保持 `0.4.0`。没有改动 `src/data/**`、战斗/掉落内容与数量、经验、配方、世界事件规则、禁区时序或 RNG；正式 PNG 与 `art/approved-assets.json` 未改动。

## 根因与设计选择

原问题是死亡事件中的 `dropCount` 是死亡瞬间的历史值，而 UI 用当前 `groundItems.length` 判断是否仍有掉落；NPC 拾取后两者失配。现在两个战利品提示都改为无数量文案「该对手遗留了物资，可拾取」，实际物品与当前可见集合只由「地面掉落」列表呈现。

归属信息选择直接放在 `ItemStack`：

- 尸体掉落写 `droppedBy` 和 `revealedTo: []`；普通丢弃/替换物品不写这两个字段。
- 可见与可拾取统一使用 `viewer === droppedBy || revealedTo.includes(viewer)`，玩家列表、合法命令、玩家拾取处理、NPC `autoLoot` 共用同一门槛。
- `performSearch` 在支付搜索行动后，把当前区域每个未揭示遗物加入搜索者 id；字段最多 6 个，重复搜索幂等。击杀前的搜索不会记录在尚未产生的物品上。
- 物品进入背包或装备时经过既有 `addItem` 重建，字段被清除；测试同时覆盖玩家拾取与 NPC 拾取/自动装备路径。

这样不需要 `gameState.ts` 初始化，也没有角色级或全局搜索状态。旧存档中缺少可选字段的地面物品按普通公开掉落处理；这是向后兼容的默认迁移，无法从旧档恢复历史击杀者时不会伪造归属，也不会读出非法状态。因此无需版本 bump。若新字段出现于错误位置、类型错误、非法角色引用、重复 id 或超过 6 个，存档审计拒绝。

## 核心改动清单

| 文件 | 理由 |
| --- | --- |
| `src/core/types.ts` | 为 `ItemStack` 增加可选 `droppedBy/revealedTo` 字段。 |
| `src/core/vitals.ts` | 沿用原有掉落选择、数量上限和 UID，仅在已选尸体掉落写归属。死亡结算、事件流和 `resolved` 时机不变。 |
| `src/core/search.ts` | 搜索完成后按角色 id 揭示当前区域未揭示遗物；不调用新 RNG。 |
| `src/core/legalActions.ts` | 提供唯一 `canAccessGroundItem` 门槛，并过滤玩家合法拾取集合。 |
| `src/core/commandHandlers.ts` | 玩家直接拾取再次执行同一门槛；未探索时返回通用拒绝信息。 |
| `src/core/npcAi.ts` | NPC 自动拾取执行同一门槛，未搜索不会捡走他人遗物。 |
| `src/core/saveValidation/numbers.ts` | 校验归属字段位置、类型、角色引用、6 人上限和重复 id。 |
| `src/core/saveValidation/references.ts` | 禁止搜索发现的 pending 物品携带尸体归属字段。 |

UI 侧 `GameScreen`/`EncounterHero`/`ZoneMap` 只渲染统一的可见集合；`WorldEventBanner` 增加紧凑主视觉形态，瞬时世界事件公告保持原位。

## 测试与执行验证

新增 `tests/phase4g2LootOwnership.test.ts` 和 `tests/phase4g2Presentation.test.tsx`，并同步更新受数量文案影响的历史测试。最终全量单元回归为 **86 test files / 1422 tests，全部通过**（基线 84 / 1408，未减少）。

关键执行验证：

- 击杀者：归属为空时立即出现在合法拾取集合，拾取成功后地面移除、背包/装备字段清除。
- 第三方：未搜索前 `canAccessGroundItem=false`、合法命令无拾取、UI 无地面列表与物品内容；A 搜索后 A 可见，B 仍不可见。
- NPC：`runNpcTurn` 在未搜索前保持他人遗物在地面；同一 NPC 搜索后下一回合自动拾取，字段不随物品进入 NPC 背包/装备。
- 普通非尸体地面掉落仍可被 NPC 无搜索拾取。
- 同种子、同操作序列的搜索结果与地面状态一致；`auditItemIntegrity` 在这些路径继续通过。
- 存档审计新增归属字段缺失、类型错误、非法角色、超过 6 个及背包携带归属字段用例；最终 **89/89 损坏用例拒绝，PASS**。

## 浏览器证据

证据 spec：`tests/browser/phase4g2-loot-world-banner-evidence.spec.ts`。截图保存在被 `.gitignore` 忽略的 `output/phase4g2-browser/`，机器快照为 `reports/phase4g2-runtime.json`。

在干净生产构建 + `npm run preview` 上：

- 1280×720：击杀者即时反馈行含「击杀战利品：该对手遗留了物资，可拾取」，无数字，主视觉内可见地面列表。
- 1280×720：第三方视角不显示地面列表、遗物内容或件数。
- 1280×720 与 390×844：两条世界事件横幅位于 `.zone-hero-event-banners`，不在 `.stage-content`；严重度/紧迫度/图标/文字均可读。
- 390×844：`bodyScrollWidth=390`、`documentScrollWidth=390`、`[title]=0`、常驻块 5 个。
- 390×844 遭遇态：6 个战斗动作，横向滚动宽度 390，`[title]=0`。
- 浏览器证据 console errors / page errors 均为 0。

## 门禁

- `rm -rf node_modules && npm ci`：PASS，安装后生产依赖 0 vulnerabilities。
- `npm run typecheck`：PASS。
- `npm test`：PASS，86 / 1422。
- `npm run build`：PASS。
- `npm run audit:save`：PASS，89/89 损坏用例拒绝。
- `npm run audit:deps`：PASS，R1/R2/R3/R4 全 0；行数门禁最终最大文件为 `commandHandlers.ts` 500 行。
- `npm run art:doctor -- --offline` / `art:validate` / `art:audit:phase4a`：PASS。
- `npm run art:security:browser` / `art:security:repo`：PASS。
- `npm run simulate -- --games 500 --seed-prefix PHASE4G2 --regression`：请求 500、实际 500；超时、非法状态、硬上限均为 0，引擎健康 PASS。胜率/角色平衡只记录观察，不作为门禁。
- `npm audit --omit=dev`：0 vulnerabilities。
- 完整生产 Playwright 回归：**31/31 passed**；4C-3、4D-2、4D-3、4E-2、4F-1、4F-2、4G-1 历史浏览器证据与本轮证据均通过。
