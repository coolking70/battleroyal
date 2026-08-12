# Phase 4H-0 报告：阶段收束与遗留项清理

## 范围与分支

- 基线：`main @ 5ea871e`，版本 `0.4.0`。
- 分支：`codex/phase4h0-types-cleanup`。
- 玩法规则、`src/data/**`、图片、存档字段和 `GAME_VERSION` 均未改动。

## 1. `types.ts` 结构收束

原 `src/core/types.ts` 集中了物品、角色、区域、配方、事件、遭遇和游戏状态声明，
已到依赖审计 R4 的 500 行上限。现在它只保留兼容出口，具体声明按语义拆到：

| 文件 | 内容 |
| --- | --- |
| `src/core/types/itemTypes.ts` | 物品定义与实例 |
| `src/core/types/characterTypes.ts` | 角色定义、状态效果、战斗者与统计 |
| `src/core/types/zoneTypes.ts` | 区域定义、库存与地面物品容器 |
| `src/core/types/recipeTypes.ts` | 配方与材料 |
| `src/core/types/eventTypes.ts` | 游戏事件与事件统计 |
| `src/core/types/encounterTypes.ts` | 遭遇与待拾取交互 |
| `src/core/types/sharedTypes.ts` | 无依赖的阶段与状态基础类型 |
| `src/core/types/gameTypes.ts` | `GameState` 与全局统计 |

`src/core/types.ts` 通过 `export *` 保持既有 `from './types'` 和
`from '../core/types'` 引用不变；`src/core/commandTypes.ts` 保持原有出口。
这是纯结构调整，字段、联合类型、可选性和运行时常量语义未改变。拆分后最大核心类型文件
为 `characterTypes.ts`（139 行），兼容桶为 15 行。

## 2. 死属性展示清理

`src/ui/screens/MenuScreen.tsx` 的角色卡移除了 `制作 {c.crafting}` 与
`医疗 {c.medical}` 两个没有核心引用的数值展示；真正生效的被动名称与说明继续保留。
`CharacterDef` / `Combatant` 字段、存档结构和任何机制均未改动。`tests/ui.test.tsx`
增加回归断言，确保角色卡的统计行不再出现这两项。

## 3. 证据留存约定

新增 [`CONTRIBUTING.md`](./CONTRIBUTING.md)：截图、录屏等二进制证据留在本地
`output/`，仓库只提交 JSON 数值快照、文字报告和测试。

## 4. 浏览器烟测

基于当前生产构建的 Playwright smoke：

- 菜单截图：`output/phase4h0-browser-current/shot-0.png`（本地忽略，不提交）。
- 对局状态：`mode=playing`、时间 0、玩家 Lv.1 / 0 EXP。
- 游戏截图确认角色卡不显示制作/医疗数值，初始对局正常渲染。
- 未生成 `errors-*.json`，console/page error 为 0。

## 5. 门禁结果

以下结果均在 `rm -rf node_modules && npm ci` 后取得：

| 门禁 | 结果 |
| --- | --- |
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS（86 files / 1423 tests） |
| `npm run build` | PASS |
| `npm run audit:save` | PASS（89 / 89） |
| `npm run audit:deps`（R1–R4） | PASS |
| art doctor / validate / audit / security | PASS（35 张正式图未变） |
| `simulate --games 500 --seed-prefix PHASE4H0 --regression` | PASS（请求/实际 500；timeout/illegal/hard-limit 0） |
| `npm audit --omit=dev` | PASS（0 vulnerabilities） |

## 6. 约束自查

- `src/data/**`：无改动；`src/core/**`：仅类型结构拆分，未改变核心行为。
- `GAME_VERSION` 保持 `0.4.0`；35 张正式 PNG 未改动。
- 未增加玩法、数值、依赖、阻塞式弹窗或美术。
- 4C-3、物品守恒、信息边界、五块常驻架构、空态 0、`[title]=0` 与战斗动作可达性由全量测试和既有浏览器回归覆盖。
