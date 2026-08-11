# Phase 4E-2 报告：战斗结局并入伤害反馈、合成后装备提示

日期：2026-08-11
分支：`codex/phase4e2`
基线：`main @ 9e773e8` / v0.3.2

## 根因与实现

4E-1 的 `vitals.ts` 已经正确把击杀事实写入 `encounter.log`，但 `handleAttack()` 随后又追加伤害行；`EncounterHero` 的即时反馈取日志最后一行，所以击杀行被遮住。本轮没有重复写死亡事件，也没有改动 `vitals.ts`：全局 `CHARACTER_DIED`、掉落、`resolved`、事件流均保持原状。

`src/core/commandHandlers.ts` 的解冻改动仅限战报文本组装：

- 63–73 行新增 `attackBattleReport()`，把原有换行压成同一行；命中落空时补“攻击落空”，并把已由结算结果确定的击杀 / 玩家死亡事实接到同一行。它不重新计算命中或伤害。
- 182–199 行、228–244 行让普通攻击和附近袭击把组合后的行同时写入遭遇日志并作为命令消息返回，确保即时反馈就是本回合最终结果。
- 400–418 行把 4D-1 两类脱离文案和原有 `res.message` 组合为一行；失败反击死亡也复用同一组装函数。

对方成功离开时，`EncounterHero` 只依据已落入公开状态的 `enemy.currentZoneId !== encounter.zoneId` 补充“已经离开该区域，脱离接触”，不读取 NPC 意图、不改变核心状态。玩家转移脱离仍使用 4D-1 的“当前位于……”文案，原地脱离仍保留“敌人仍在本区域，可能再次交火”。

装备提示位于 UI 层：`equipmentPresentation.ts` 使用已有 `weaponAttackOf()` / `armorDefenseOf()` 比较玩家自己的装备。空槽或严格更强才是 `ready`，否则为 `backup` 且不弹合成装备提示；耐久度按 §2.5 不纳入判定。`CraftEquipmentHint` 是内联、可忽略的 `aria-live` 提示，点击只通过父层派发既有 `EQUIP` 命令，不直接改 state，也不自动装备。

## 浏览器实拍证据

以下均来自干净生产构建 `npm run build` 后的 `npm run preview -- --host 127.0.0.1 --port 4173`，Playwright 通过真实 UI 点击攻击、脱离、拾取和合成。固定种子 / 存档夹具只用于稳定构造难以自然触发的结果；核心命令仍走真实命令通道。

| 场景 | 证据 |
| --- | --- |
| 命中击杀：同一行含伤害与击杀 | [01-kill-immediate-feedback.png](output/phase4e2-browser/01-kill-immediate-feedback.png) |
| 重击落空：同一行含“重击落空，露出破绽” | [02-heavy-miss-immediate-feedback.png](output/phase4e2-browser/02-heavy-miss-immediate-feedback.png) |
| 玩家被击杀：最终反馈 toast 含同一行结局 | [03-player-killed-feedback.png](output/phase4e2-browser/03-player-killed-feedback.png) |
| 原地脱离：保留“敌人仍在本区域，可能再次交火” | [04-stationary-flee-feedback.png](output/phase4e2-browser/04-stationary-flee-feedback.png) |
| 转移脱离：含“当前位于……” | [05-transfer-flee-feedback.png](output/phase4e2-browser/05-transfer-flee-feedback.png) |
| 对方离开交手区域 | [06-opponent-escape-feedback.png](output/phase4e2-browser/06-opponent-escape-feedback.png) |
| 合成石斧后空武器槽提示“当前空槽 · 攻击 +6” | [07-craft-weapon-equip-hint.png](output/phase4e2-browser/07-craft-weapon-equip-hint.png) |
| 已有更强武器时不出现提示 | [08-craft-not-stronger-no-hint.png](output/phase4e2-browser/08-craft-not-stronger-no-hint.png) |
| 运行时错误采集 | [runtime-errors.json](output/phase4e2-browser/runtime-errors.json) |

夹具说明：击杀使用 1 HP 敌人；重击落空和玩家死亡用固定种子探测后重新生成未执行过命令的合法存档；原地 / 转移脱离固定敌人体力并探测成功路径；对方逃走构造为已 resolved 且敌人已进入另一合法区域，UI 只展示公开位置事实。

## 测试覆盖

- `phase4e2CombatFeedback.test.ts`：命中击杀、重击落空、玩家被击杀、两类脱离、最终日志行顺序；并回归伤害 / 掉落 / `resolved`。
- `phase4e2CraftEquipmentHint.test.tsx`：武器空槽触发、武器严格更强触发并点击派发 `EQUIP`、不更强不触发，以及护甲空槽防御对比。
- `phase4e2EncounterHero.test.tsx`：对方移动到其他区域后的即时反馈。
- 4C-3 零体力不变量继续通过；既有命中、事件流、掉落、信息边界测试继续通过。

本轮新增 9 个测试，当前单元测试总数为 **81 files / 1368 tests**，没有减少基线测试。

## 约束逐条核对

- `src/core/**`：仅 `src/core/commandHandlers.ts` 改动；`src/core/vitals.ts` 本轮不改，因为 4E-1 写入已经正确。
- `src/data/**`、`public/assets/**/*.png`、`art/approved-assets.json`、Candidate 状态：未改；未调用图像生成 API。
- 未改战斗公式、命中率、伤害、死亡结算、掉落、配方、经济、RNG、存档 schema、NPC 决策、遭遇状态机、装备规则或 `resolved` 时机；未新增命令类型。
- 历史日志继续经 `visibleEventsForPlayer`；战报不展示敌方精确 HP、隐藏装备、技能或意图。
- 合成提示为内联非阻塞，可忽略；装备只派发 `EQUIP`，不自动装备；未添加依赖。
- 五视口测试通过：无横向溢出，6 个战斗动作全部可见；既有无障碍测试保持实时 DOM `[title] = 0`，新增按钮使用全局 `:focus-visible` 规则。
- 耐久度未纳入本轮判定，严格遵循 §2.5。

## 门禁结果

| 门禁 | 结果 |
| --- | --- |
| `rm -rf node_modules && npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm test -- --testTimeout=20000` | PASS：81 files / 1368 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS |
| `npm run audit:deps` | PASS：R1–R4 均为 0；`commandHandlers.ts` 498 行 |
| `npm run art:doctor -- --offline` / `art:validate` / `art:audit:phase4a` | PASS |
| `npm run art:security:browser` / `art:security:repo` | PASS |
| 500 局 `PHASE4E2` regression simulation | PASS：500/500，engine PASS；角色平衡只记录观察值 |
| `npm audit --omit=dev` | PASS：0 vulnerabilities |
| 生产预览 Playwright 证据 | PASS：3/3，0 console/page errors；五视口可达性通过 |

Vitest 默认 5 秒单测试超时在当前受限执行环境中会让 4 个既有长时随机 / 守恒用例偶发超时，但没有断言失败；提高测试超时仅用于验证执行后 81/1368 全部通过。CI 应按仓库现有执行环境运行，不改变测试断言或生产配置。
