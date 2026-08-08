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
