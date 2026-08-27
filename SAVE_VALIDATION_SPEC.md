# 存档深度校验规格（SAVE_VALIDATION_SPEC.md）

`src/core/saveValidation/` 四层编排（structure → numbers → references → consistency），
对外唯一入口 `validateSaveData(value): { ok, errors[] }`（`saveLoad.ts` 转发）。
以下 13 组不变量为本规格的权威契约；`tests/saveValidationAudit.test.ts`（62 用例）
与 `tools/auditSaveValidation.ts`（60 损坏用例）共同守住它。

## 1. 顶层 SaveData

```ts
{ version: string; savedAt: number; seed: string; time: number; rngState: number; state: GameState }
```

- `version` 必须是当前受支持的版本字符串（=== GAME_VERSION）；
  其他版本一律在校验前被 `loadGame` 拒绝，**不迁移、不删除**，原始内容保留在
  storage 里供玩家自行处理（同版本迁移见下方「同版本迁移」）；
- `savedAt` 必须是**有限正数**；
- `seed` 必须是非空字符串；
- `time` 必须是非负整数；
- `rngState` 必须是合法有限非负整数（uint32 形态）；
- 交叉一致：`save.seed === state.seed`、`save.time === state.time`、
  `save.rngState === state.rngState`、`save.version === state.version`，
  任何不一致直接拒绝。

## 2. GameState 基础计数器

`eventSeq / uidSeq / nextZoneEventTime`：非负整数；`nextZoneEventTime` 允许
`Number.MAX_SAFE_INTEGER`（禁区封完的哨兵值），否则不得明显超过硬上限。
`endedAtTime / finaleStartedAt`：null 或非负整数且 ≤ state.time。
`status==='playing'` 时不得带 `endedAtTime`；已结束时必须有。

## 3. 背包

- `inventory.length <= INVENTORY_SLOTS`（8 格）；
- 每堆：`uid` 非空字符串、`itemId` 存在、`count` 正整数且 `<= maxStack`；
- `stackable === false` → `count === 1`；
- 武器：`durability` 必须存在，为有限整数且 `0 <= durability <= 定义的最大耐久`；
- 非武器：不得出现耐久字段。

## 4. 全局 UID 唯一

所有角色 `inventory` + `equipment` + 所有区域 `groundItems` + `pendingPickup.stack`
中的 uid 在整个 GameState 内只能出现一次。

## 5. 装备

- `equippedWeaponId` 必须指向 `character.equipment` 里的实例，且物品类型为 weapon；
- `equippedArmorId` 同理，类型为 armor；
- `equipment` 中不得出现 material / consumable。

## 6. 角色状态

- `stats.searches / crafts / moves / itemsUsed / attacks / damageDealt / damageTaken`
  全部非负（有限数）；`kills` 非负；
- `alive === true → hp > 0`；`alive === false → hp === 0`；
- 死亡角色 `diedAtTime` 不得为 null；存活角色必须为 null。

## 7. 区域库存

- 每条 loot：`itemId` 有效、`count` 为正整数、`rarity ∈ {normal, rare}`；
- `remainingLootCount === Σ(loot.count)`；
- `initialLootCount >= remainingLootCount >= 0`；
- `supply` 必须满足派生比例（允许小浮点误差）：

```ts
expectedSupply = initialLootCount === 0 ? 0 : remainingLootCount / initialLootCount
abs(zone.supply - expectedSupply) < 0.000001
```

## 8. 区域人员名单（双向完全一致）

- 每个存活角色：恰好出现在 `currentZoneId` 的 `aliveCharacterIds` 中，且**不出现**
  在其他任何区域；
- 死亡角色：不出现在任何 `aliveCharacterIds`；
- 名单内不得重复 ID；不得包含不存在的角色；名单内角色必须存活。

## 9. 玩家制作目标

- `state.craftGoalRecipeId`：null 允许；非 null 必须指向真实 Recipe；
- `craftGoalCompleted === true` 时必须存在目标。

## 10. NPC 计划

`plannedRecipeId / planCreatedAt / planReason` 必须互相一致：

- `plannedRecipeId === null` → `planCreatedAt` 与 `planReason` 也必须为 null；
- 有目标时：recipe 必须存在、`planCreatedAt` 为合法时间（≤ state.time）、
  `planReason` 为非空字符串。

### 10b. 计划推荐对（Phase 4X）

`planRecommendedLandmarkId` 与 `planRecommendedZoneId` 是**一对**，必须同进同出：

- `planRecommendedLandmarkId !== null` → 该地标必须存在，且
  `planRecommendedZoneId === 该地标的 zoneId`；
- 角色死亡时两者与 `explorationObjective` 一起清空
  （`vitals.ts`；Phase 4X 之前只清了 zone，导致任何含阵亡者的存档都无法加载）。

### 10c. 地标 exhausted 语义（Phase 4X 修正）

`exhausted` 表示**搜索次数用尽**，**不**表示地标为空：

- `exhausted === true` → `remainingSearches === 0`；
- `exhausted === true` 时 **允许** `loot` 仍有存货。
  当 `maxSearches < 初始 loot 数`，或最后一次搜索以致命风险结束而非取得物品时，
  这是引擎的正常产物，且**有限物资守恒要求这些物品继续被记账**
  （见 `tests/phase4qAfAcceptanceFix.test.ts` AF-7 / AF-8）。
  Phase 4X 之前这里要求“exhausted ⇒ loot 为空”，与守恒规则直接冲突。

## 11. 事件

每个事件：`id` 唯一、`type` 合法、`time` 合法（≤ state.time）、`importance` 合法、
`actorId / targetId` 引用有效或 null、`zoneId` 引用有效或 null、`message` 为字符串、
`metadata` 可 JSON 序列化。
`state.eventSeq >= 现存事件 id 的最大值`。
`eventCounters`：`total` 非负且 `>= events.length`、`archived` 非负、
`byType` 的 key 必须是合法事件类型、值非负。

## 12. encounter

未解决遭遇（`resolved === false`）：

- 玩家必须存活；
- 敌人必须存活；
- 双方必须同一区域；
- `encounter.zoneId` 必须等于玩家当前区域。

对局已经结束：不得存在 `resolved === false` 的 encounter
（引擎在 `checkGameEnd` / `enforceTimeLimit` 结束对局时直接清空）。

## 13. pendingPickup

- `stack` 合法（见第 3 组）；
- UID 全局唯一（见第 4 组）；
- `zoneId` 存在且 === 玩家当前区域；
- `source ∈ {search, ground}`。

## 独立验收入口

```bash
npm run audit:save
```

自动生成一份正常状态 + 60 种损坏状态，输出 `reports/save-validation-audit.{json,md}`，
每项含 `case / expected / actual / passed / errorMessage`；
**任何非法存档被接受 → exit code 1**。


## 同版本迁移（Phase 4X / 4X-AF1）

`src/core/saveMigration.ts` 的 `migrateSameVersionSave()` 在 `loadGame` 中于
**校验之前**执行。下表就是**实际支持边界**，每一项都由
`tests/phase4xSaveMigration.test.ts` 端到端证明
（storage → `loadGame()` → migration → validation → 下一条 `executeCommand`）。

### SUPPORTED（当前 GAME_VERSION **且** 当前 schema）

| 场景 | 处理 | 为什么安全 | 用例 |
|---|---|---|---|
| 角色缺失 `equippedUtilityId` | 补 `null` | Phase 4M 新增的**可选**槽位，缺失只可能表示“空” | X-S3 |
| zone **表**仍为精确历史六区，其余子系统已是当前 schema 且引用完整地图 | 补齐缺失的固定地图区域 | 新区用独立迁移 RNG（`phase4k:<seed>:<zoneId>`）初始化，与 `state.rngState` 隔离；只在**完全等于**历史六区时触发，避免把部分损坏的 zone 表“修好” | X-S4 |

### UNSUPPORTED（拒绝加载，**原 storage 逐字节保留**，不删除、不静默重置）

| 场景 | 为什么不能迁移 | 用例 |
|---|---|---|
| 其他 `GAME_VERSION` | 版本闸在迁移之前拒绝 | X-S7 / X-S8 |
| **真正的旧 schema 存档**（pre-4K / pre-4N / pre-4Q）：完全没有 `wildEnemies` / `landmarks` / `incidents` / 角色 `knowledgeMemory` | 有限 Wild 种群**已被消耗多少**、哪些 incident 已经发生、每个角色**观测到过什么**，都无法从这类存档推导；伪造会静默改变这一局的难度与信息边界 | X-S4c |
| zone 表只是**部分**缺失（非精确六区） | 补齐等于凭空造出一个看似合理的世界 | X-S4b |

一句话：**zone 表被截断是可修的；缺失的子系统历史不可修。**

迁移不得推进 `state.rngState`，也不得改变加载后第一条命令的结果（X-S5）；
不需要迁移的存档原样返回（X-S6）。
