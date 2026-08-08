# 模拟器设计（SIMULATOR_DESIGN.md）

Phase 2A-1 统一了模拟入口：`npm run simulate` 与 `npm run simulate:balance`
都指向 `tools/simulateBalance.ts`，废弃了「simulate.ts 冒烟 / simulateBalance.ts
权威」的双入口语义不一致。

## 一、唯一正式入口

```bash
# P3-P1 起：--games 表示「总对局数」，会平均分配到 4 角色 × 5 策略 = 20 格
npm run simulate -- --games 1000          # 1000 总局 → 20 格各 50 局
npm run simulate -- --games 1003          # 1003 总局 → 前 3 格 51 局、余 50 局
npm run simulate -- --games-per-cell 100  # 旧语义：每格 100 局 → 共 2000 局
npm run simulate -- --games 1000 --seed-prefix PHASE3
npm run simulate -- --games 100 --character scout
npm run simulate -- --games 100 --policy cautious
npm run simulate -- --games 50 --character fighter --policy aggressive
npm run simulate -- 1000                 # 旧式位置参数（兼容，= --games 总对局数）
npm run simulate -- --help / -h          # 帮助
```

- `--games`（总对局数）与 `--games-per-cell`（每格局数）**互斥**，二者只能给其一；
- 参数错误：打印帮助并以 **exit code 1** 退出（规格 §七）。
- 旧位置参数形式（单个数字 = 总对局数）保留兼容。
- `npm run audit:save` → `tools/auditSaveValidation.ts`（存档独立验收）。
- `npm run scripted:playthroughs` → `tools/scriptedPlaythroughs.ts`（脚本化完整对局）。

## 二、权威性保证

模拟器**只**调用自动对局控制器 `tools/autoPlayer.ts`，而 autoPlayer 全程只走
正式命令通道 `executeCommand`，且每一步先向 `getLegalPlayerCommands` 要合法集合、
只能从集合里出牌。因此：

- 报告中的胜率 / 存活 / 死因全部来自引擎真实结论，没有任何一手伪造；
- `playing ⇒ timeout`，绝不按血量 / 击杀数推断胜者（`tests/phase2a-acceptance.test.ts`
  的 [2A-I] 长期看守）。

## 三、矩阵与 CLI

- 矩阵：4 角色（scout / fighter / engineer / medic）× 5 策略
  （aggressive / cautious / collector / opportunist / random），默认 20 格；
- `--character / --policy` 做白名单校验；
- `--output` 支持 `=value` 与空格两种写法；同时生成 `.json` 与同名 `.md`。

### 局数分配（P3-P1）

`--games`（总对局数）用 `planGames` 分配到 20 格：

- `base = floor(total / cellCount)`，`remainder = total % cellCount`；
- **前 `remainder` 个 cell 各 +1**，其余给 `base`，保证 `Σ games === requestedTotalGames`；
- 报告 `meta.config` 同时给出
  `requestedTotalGames / actualTotalGames / gamesPerCell / distribution`；
- 当 `actualTotalGames ≠ requestedTotalGames` 时即暴露分配或跑批异常（不再像旧版那样
  把 `--games 1000` 静默展开成 4×5×1000 = 20000 局）。

## 四、健康红线（FAIL 条件）

| 红线 | 说明 | 驱动目标 |
| --- | --- | --- |
| timeout | 跑到步数上限仍是 playing | 0 |
| illegalState | 合法集合命令被拒 / 死锁 / livelock / 空集合 | 0 |
| hardLimitReached | 触及 180 硬上限才结束 | 0 |
| characterBalance | 最高/最低非零胜率比 ≥ 2.5，或存在 0 胜率角色 | passed=true |

整体判定：`overallPassed = engineHealthy && characterBalance.passed`。
任一 FAIL 时进程以 exit code 1 退出。

## 五、报告字段

- 每格（cell）44 字段：胜负平超时、存活率、可信率、硬上限、非法/死锁/停滞/空集合
  计数、平均名次/击杀/伤害/物资/时长/步数等；
- `meta.health`：timeout / illegalState / hardLimitReached + engineHealthy；
- `meta.characterBalance`（Phase 2A-1 新增）：
  `perCharacterWinRate / highestWinRate / lowestNonZeroWinRate / ratio / threshold: 2.5 / zeroWinCharacters / passed`；
- `meta.overallPassed`：整体判定；
- `characterSummary / policySummary / matrix`：角色 / 策略汇总与全矩阵。

## 六、确定性与复现

- 每格种子 = `${seedPrefix}${characterId}-${policy}-${i}`，同参数同结果；
- 自动玩家策略 RNG 与引擎 RNG 完全隔离（`${seed}::policy::${policy}`），
  保证「同种子 + 同角色 + 同策略」严格可复现；
- 随机型 NPC 规划在规划器内使用 `SeededRandom`，严禁 `Math.random()`。
