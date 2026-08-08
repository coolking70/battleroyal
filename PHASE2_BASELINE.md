# PHASE2_BASELINE.md — 第二阶段开工基线

> 本文件在**写任何代码之前**生成，用于冻结第一阶段的真实现状，作为第二阶段全部改动的对照基准。
> 生成时间：2026-08-07 · 记录者：Phase 2 开发流程第一步

---

## 1. 当前项目版本

| 项 | 值 |
| --- | --- |
| `package.json` name | `zone-battle-royale` |
| `package.json` version | **`0.1.0`** |
| `src/data/gameConfig.ts` → `GAME_VERSION` | **`'0.1.0'`** |
| `src/data/gameConfig.ts` → `SAVE_KEY` | **`'zone-br.save.v1'`** |
| Node（验证环境） | v22.22.2 |
| npm | 10.9.7 |
| Vitest | v2.1.9 |

依赖（`devDependencies` / `dependencies`）：react 18、react-dom 18、vite 5、@vitejs/plugin-react、typescript、vitest 2、jsdom、@testing-library/react、@testing-library/user-event、@types/*。
**当前没有** `tsx` / `ts-node`，也**没有** `simulate` 脚本 —— 第二阶段需要新增。

现有 npm scripts：

```
dev        vite
build      tsc -b && vite build
preview    vite preview
test       vitest run
typecheck  tsc -b --noEmit  (经 tsconfig 引用 app/node 两份配置)
```

---

## 2. 当前测试数量

`npm test` 实测结果（本机重跑确认，非引用旧文档）：

```
 ✓ tests/random.test.ts    (7 tests)
 ✓ tests/zones.test.ts     (6 tests)
 ✓ tests/movement.test.ts  (7 tests)
 ✓ tests/search.test.ts    (6 tests)
 ✓ tests/crafting.test.ts  (8 tests)
 ✓ tests/combat.test.ts    (9 tests)
 ✓ tests/save.test.ts      (9 tests)
 ✓ tests/npc.test.ts       (8 tests)
 ✓ tests/victory.test.ts   (5 tests)
 ✓ tests/ui.test.tsx       (6 tests)

 Test Files  10 passed (10)
      Tests  71 passed (71)
```

**基线 = 71 个测试 / 10 个文件 / 全部通过。**
第二阶段硬要求：这 71 个**一个都不能删、不能改成"只要不报错就算过"**，最终总数 ≥ 105。

测试辅助：`tests/helpers.ts`（44 行）提供 `TEST_SEED = 'BR-DEMO-001'`、`newGame()`、`give()`、`clearInventory()`、`player()`、`npcs()`。

---

## 3. 当前目录结构

```
battleroyal/
├── index.html
├── package.json / package-lock.json
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts / vitest.config.ts
├── README.md / DEVELOPMENT_REPORT.md / SELF_CHECK.md
├── dist/                        # 第一阶段构建产物
├── src/
│   ├── App.tsx                  # ?debug=1 解析 + 三屏路由
│   ├── main.tsx
│   ├── core/                    # 纯逻辑层，零 React 依赖
│   │   ├── types.ts            (328)  类型总表
│   │   ├── gameEngine.ts       (319)  executeCommand / advanceTime / checkGameEnd
│   │   ├── commandHandlers.ts  (260)  handleMove/Search/Rest/Attack/Flee/Pickup...
│   │   ├── combat.ts           (387)  命中/伤害/死亡/反击/逃跑/战力估算
│   │   ├── inventory.ts        (307)  背包增删/装备/堆叠/材料检查
│   │   ├── npcDecide.ts        (276)  NPC 决策（优先级 + 人格权重）
│   │   ├── npcAi.ts            (275)  NPC 回合执行 / 自动装备 / 自动拾取
│   │   ├── gameState.ts        (256)  建局 / 选择器 / cloneState
│   │   ├── search.ts           (209)  搜索权重 / 物资衰减 / 掉落
│   │   ├── crafting.ts         (205)  配方结算
│   │   ├── saveLoad.ts         (175)  localStorage 存读档
│   │   ├── restrictedZones.ts  (172)  禁区预警/封锁/伤害
│   │   ├── consumables.ts      (131)  治疗 / 恢复体力 / 休息
│   │   ├── random.ts           (119)  SeededRandom (xmur3 + mulberry32)
│   │   ├── commands.ts         (102)  命令合法性 / 标签 / 是否推进时间
│   │   └── events.ts            (51)  事件写入与读取
│   ├── data/
│   │   ├── items.ts            (268)  23 件物品（10 材料/5 武器/3 防具/5 消耗品）
│   │   ├── recipes.ts          (145)  11 个配方
│   │   ├── zones.ts            (108)  6 个区域 + 相邻表 + 对称性自检
│   │   ├── characters.ts       (108)  4 个角色模板 + 12 个 NPC 名字池
│   │   └── gameConfig.ts        (84)  版本/存档 key/全部数值常量
│   ├── ui/
│   │   ├── screens/  GameScreen(238) / ResultScreen(163) / MenuScreen(109)
│   │   ├── components/  DebugPanel(169) / Inventory(131) / EncounterPanel(89)
│   │   │                StatusBar(86) / ZoneMap(80) / CraftPanel(63)
│   │   │                EventLog(60) / ActionBar(54) / PendingPickupPanel(45)
│   │   │                Toast(20) / Bar(16)
│   │   └── styles.css
│   └── utils/  useGame.ts (95) / format.ts (84)
└── tests/  combat(157) npc(155) save(129) crafting(124) ui.tsx(123)
          zones(110) victory(83) random(77) search(76) movement(75) helpers(44)
```

`src` 合计约 6940 行（含测试）。所有 `core/` 单文件均 < 500 行（最大 `combat.ts` 387）。

根目录另有 9 个 `vite.config.ts.timestamp-*.mjs` / `vitest.config.ts.timestamp-*.mjs` 临时残留文件（Vite 生成的瞬时产物），第二阶段会清理并加入 `.gitignore` 语义范围。

---

## 4. 当前核心命令类型

`Command` 联合类型共 **18 种**（`src/core/types.ts`）：

| 分类 | 命令 | 推进时间 | 备注 |
| --- | --- | --- | --- |
| 移动 | `MOVE` | ✅ | 仅相邻区域，耗 3 体力 |
| 搜索 | `SEARCH` | ✅ | 耗 5 体力，可能触发遭遇 |
| 休息 | `REST` | ✅ | 恢复体力，可能被 NPC 偷袭 |
| 战斗 | `ATTACK` | ✅ | 遭遇内可用，可能被反击 |
| 战斗 | `FLEE` | ✅ | 逃跑判定 |
| 物品 | `USE_ITEM` | ✅ | 消耗品 |
| 物品 | `EQUIP` | ❌ | 装备武器/防具 |
| 物品 | `UNEQUIP` | ❌ | 卸下 |
| 物品 | `DROP` | ❌ | 丢弃 |
| 物品 | `PICKUP_GROUND` | ✅ | 拾取地面掉落 |
| 物品 | `RESOLVE_PICKUP` | ❌ | 背包满时的替换/放弃抉择 |
| 合成 | `CRAFT` | ✅ | 耗材料 + 体力 |
| 遭遇 | `CLOSE_ENCOUNTER` | ❌ | **当前存在缺陷，见 §6** |
| 调试 | `DEBUG_ADVANCE_TIME` | ✅ | |
| 调试 | `DEBUG_GRANT_ITEM` | ❌ | |
| 调试 | `DEBUG_FULL_RESTORE` | ❌ | |
| 调试 | `DEBUG_FORCE_ZONE_LOCK` | ❌ | |
| 调试 | `DEBUG_WEAKEN_NPCS` | ❌ | |

统一入口：`executeCommand(state, command): CommandResult`，其中
`CommandResult = { ok: boolean; state: GameState; message?: string; events: GameEvent[] }`。
先 `cloneState` 再在副本上结算，**绝不修改入参**。

---

## 5. 当前 GameState 主要字段

```ts
interface GameState {
  version: string;              // '0.1.0'
  seed: string;                 // 种子字符串
  rngState: number;             // 序列化的 RNG 游标
  time: number;                 // 离散时间单位
  status: 'playing' | 'won' | 'lost';
  playerId: string;
  turnOrder: string[];          // 角色行动顺序
  characters: Record<string, Combatant>;
  zones: Record<string, ZoneState>;
  events: GameEvent[];          // 全局公开事件流
  eventSeq: number;
  uidSeq: number;               // 物品堆栈 uid 自增
  encounter: EncounterState | null;
  pendingPickup: PendingPickup | null;
  engagedWithPlayer: string[];  // 本时间单位已与玩家交手的 NPC
  nextZoneEventTime: number;
  deathOrder: string[];         // 出局顺序（用于排名）
  stats: GameStats;
  endedAtTime: number | null;
}

interface ZoneState {
  id: string;
  status: 'safe' | 'warning' | 'restricted';
  searchCount: number;
  supply: number;               // 物资系数，随搜索衰减，下限 0.15 → 无限刷新根源
  warningAtTime: number | null;
  restrictedAtTime: number | null;
  groundItems: ItemStack[];
  aliveCharacterIds: string[];
  lastCombatTime: number | null;
}

interface Combatant {
  id / name / isPlayer / templateId / personality / alive
  hp / maxHp / stamina / maxStamina
  attack / defense / perception / speed / crafting / medical
  zoneId / inventory: ItemStack[] / weapon / armor
  kills / lastActionTime / lastDecisionReason / statusEffects
}
```

**第二阶段规格要求、但当前完全不存在的字段：**

- `GameState.phase`（`'opening' | 'midgame' | 'finale'`）、`finaleStartedAt`
- `GameState.craftGoalRecipeId`、`eventCounters`
- `ZoneState.loot`（`ZoneLootEntry[]`）、`initialLootCount`、`remainingLootCount`、`searchedEmptyCount`
- `ZoneState.lastNoiseTime`、`noiseLevel`
- `Combatant.plannedRecipeId`、`planCreatedAt`、`planReason`
- `GameEvent.importance`（重要度分级）

---

## 6. 当前已知问题（第二阶段必须先修）

按规格 §3 的四个高优先级缺陷 + 其他审计发现，全部为**已定位到具体代码行**的真实问题，不是猜测。

### P0-1 体力检查分散、存在零体力仍可行动的路径
- `handleMove`（`commandHandlers.ts`）内联扣体力；`handleSearch` 走 `canSearch`；`resolveAttack`（`combat.ts`）内联扣体力；`performCraft` 又是另一套。
- 四套逻辑各自为政，缺乏统一的"先校验后扣费"闸门，边界（`stamina === 0`、`stamina < cost`）在不同路径上行为不一致。
- **修法**：新增 `src/core/actionCosts.ts`，提供 `getActionStaminaCost() / canPayActionCost() / payActionCost()`，所有耗体力动作强制走这一层。

### P0-2 死亡判定与状态一致性未统一
- `combat.ts` 的 `killCharacter` 有 `if (!victim.alive) return;` 守卫（不会重复死亡），但**掉血入口有多条**：`applyDamage`（战斗）、`applyZoneDamage`（禁区）、状态效果（`updateStatusEffects`）。
- 缺少统一的 `applyHpChange / applyHealing`，持续伤害（DoT）路径未保证一定汇入死亡结算，且 `hp` 未强制夹在 `[0, maxHp]`。
- **修法**：所有 HP 变化收敛到单一函数，死亡后立刻清空 `encounter`/`engagedWithPlayer` 关联、刷新 `aliveCharacterIds`、写 `deathOrder`。

### P0-3 命令层对预期错误直接抛异常
- `getItem`（`items.ts`）、`getRecipe`（`recipes.ts`）在 id 不存在时 `throw`；`executeCommand`（`gameEngine.ts`）**没有 try/catch**。
- 结果：非法配方 / 非法物品 / 非法区域 / 非法角色会让整个引擎抛出，UI 层崩溃。
- **修法**：定义 `GameRuleError` / `SaveValidationError`；`executeCommand` 捕获**预期领域错误**并返回 `{ ok: false, state: 原状态, message }`；非预期错误仍然向上抛。

### P0-4 未解决的遭遇可以被直接关闭
- `commands.ts` 的 `isEncounterBlocking()` 对 `'CLOSE_ENCOUNTER'` 返回 `false`；
- `gameEngine.ts` 的 `CLOSE_ENCOUNTER` 分支直接 `draft.encounter = null;`，**不检查 `resolved`**。
- 结果：玩家可以在遭遇未结算时一键消掉遭遇，绕过战斗。
- **修法**：仅当 `encounter.resolved === true`（或对手已死亡/已离开区域）才允许关闭，否则返回 `ok:false` + 提示。

### P1-5 物资无限（本阶段核心玩法缺陷）
- `search.ts` 的 `performSearch` 用 `zone.supply *= supplyDecayPerSearch(0.85)`，并有 `supplyFloor = 0.15` 兜底。
- 结果：区域**永远搜得出东西**，只是变慢 —— 没有"搜空"，策略循环失效，对局可无限拖延。
- **修法**：改为**有限 loot 库存**：开局按种子为每区域生成 18~28 件普通 + 2~5 件稀有，搜索从库存中扣减，搜空后只出"一无所获/遭遇"。

### P1-6 存档校验过浅
- `isValidSaveData`（`saveLoad.ts`）只检查 `version / seed / rngState / time / playerId / turnOrder / events / characters / zones / status` 是否存在及基础类型。
- 结果：字段类型错乱、区域引用不存在的角色、`hp > maxHp`、`turnOrder` 含未知 id 等**损坏存档会被静默接受**，读档后行为不可预测。
- **修法**：深度校验（含交叉引用一致性），失败抛 `SaveValidationError`，主菜单提示"存档损坏"并提供删除。

### P1-7 全图信息泄露
- `ZoneMap.tsx` 直接渲染每个区域的 `others` 人数；`GameScreen.tsx` 列出同区域全部角色的 HP 与武器。
- 结果：玩家掌握上帝视角，无侦察博弈。
- **修法**：常规地图只给"噪音等级 / 最后已知位置"，精确信息仅在遭遇时揭示；调试面板保留全知。

### P1-8 对局可能无限拖延
- 无 `phase` 阶段概念、无终局收束、无时间硬上限。禁区虽然收缩但 `minSafeZones = 1` 保底，双方都苟着就永远打不完。
- **修法**：`phase` 三阶段 + 终局广播 + 衰竭 + 环境伤害递增 + 180 时间单位硬上限。

### P1-9 事件日志无重要度、无体积控制
- `GameEvent` 没有 `importance`；`events` 数组只增不减。
- 结果：长局存档会膨胀，规格要求单份存档 < 500KB。
- **修法**：事件分级 + 低重要度归档裁剪 + `eventCounters` 统计保留。

### P2-10 UI 缺口
- 主菜单：无"删除存档"、无损坏存档提示、无存档版本/时间显示。
- 调试面板：无导出 JSON。
- 结算页：缺 使用物品次数 / 最终武器防具 / 造成与承受伤害 / 最远存活阶段 / 制作目标是否完成 / 关键事件时间线 / 对局时长 / 种子 / 角色排名。

### P2-11 工具链缺口
- 无 `tools/simulate.ts`，无 `npm run simulate`，无 `tsx` 依赖 —— 无法做自动平衡验证。

---

## 7. 本阶段预计修改的文件

**新增**

| 文件 | 用途 |
| --- | --- |
| `src/core/actionCosts.ts` | 统一体力成本校验与扣除 |
| `src/core/errors.ts` | `GameRuleError` / `SaveValidationError` |
| `src/core/zoneLoot.ts` | 有限物资库存生成与扣减 |
| `src/core/phase.ts` | 阶段推进与终局收束 |
| `src/core/craftGoal.ts` | 玩家/NPC 制作目标与路线规划 |
| `src/core/info.ts` | 信息可见性（噪音、最后已知位置） |
| `src/core/saveValidate.ts` | 深度存档校验（若 `saveLoad.ts` 过长则拆出） |
| `tools/simulate.ts` | 批量模拟与平衡报告 |
| `src/ui/components/CraftGoalPanel.tsx` | 制作目标/路线面板 |
| `tests/` 新增若干 | 硬化 / 有限物资 / 终局 / 目标 / 信息 / 存档校验 / 模拟 |
| `PHASE2_REPORT.md` / `AUDIT_FIXES.md` / `BALANCE_CHANGELOG.md` / `DELIVERY_MANIFEST.md` | 交付文档 |
| `reports/phase2-balance.json` / `.md` / `phase2-manual-tests.md` | 平衡与手测报告 |

**修改**

`src/core/types.ts`（新字段）、`gameEngine.ts`（错误边界 + 阶段推进）、`commandHandlers.ts`（走统一成本层）、`combat.ts`（统一 HP 变更）、`search.ts`（改用有限库存）、`restrictedZones.ts`（环境伤害递增）、`gameState.ts`（建局初始化新字段）、`commands.ts`（遭遇校验）、`saveLoad.ts`（深度校验 + v2 key）、`events.ts`（重要度 + 归档）、`npcAi.ts` / `npcDecide.ts`（目标导向 + 有限物资感知）、`crafting.ts`（目标联动）、`data/gameConfig.ts`（版本 0.2.0 / SAVE_KEY v2 / 新常量）、`package.json`（版本 + `simulate` 脚本 + `tsx`）、全部 UI 屏与相关组件、`README.md` / `SELF_CHECK.md`（同步更新）。

---

## 8. 本阶段明确不修改的内容

- **技术栈不变**：React 18 + TypeScript + Vite + Vitest + 原生 CSS。不引入 UI 组件库、状态管理库、游戏引擎。
- **架构不变**：`executeCommand` 纯函数命令引擎、核心层零 React 依赖、单一 `useGame` 粘合层。**禁止推倒重写**。
- **确定性契约不变**：`SeededRandom`（xmur3 + mulberry32）算法本身不动；`Math.random()` 仍仅允许出现在 `generateRandomSeed()`。
- **规模常量不变**：仍为 1 玩家 + 5 NPC、6 个区域、4 个角色模板、5 种 NPC 人格。
- **区域拓扑不变**：`src/data/zones.ts` 的 6 区域及相邻关系不改（只在其上叠加 loot 与噪音）。
- **物品与配方集合不新增**：保持 23 物品 / 11 配方；仅允许调整**数值**用于平衡，不新增品类。
- **现有 71 个测试不删不弱化**：只允许因新规格必须调整断言（须在 `AUDIT_FIXES.md` 中逐条说明理由）。
- **不做旧存档迁移**：`0.1.0` 存档一律不静默迁移，只提示 + 可删除。
- **第三阶段内容一律不做**：不提前开发未在本阶段规格中的功能。
- **明令禁止项**：多人联机、WebSocket、服务端、数据库、登录/账号、云存档、商城/内购/抽卡、外部 AI 或 LLM 参与对局、3D/粒子/音效、地图缩放、技能树、剧情任务系统。

---

## 9. 开工前状态快照（可复现校验点）

```
版本            0.1.0
存档 key        zone-br.save.v1
测试            71 passed / 10 files
core 最大文件   combat.ts 387 行
typecheck       零错误
build           成功
默认种子        BR-DEMO-001
```

第二阶段的每一步都以此为对照；任何回归都必须能定位到与本快照的差异。
