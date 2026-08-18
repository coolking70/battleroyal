# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-18T04:26:38.384Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4T-AF1

## 局数分配（P3-P1）

| 字段 | 值 |
| --- | --- |
| gamesMode | total（--games = 总对局数） |
| requestedTotalGames | 500 |
| actualTotalGames | 500 |
| gamesPerCell（基准） | 12 |
| cellCount | 40 |
| 请求 = 实际 | ✓ |

<details><summary>distribution（每格实际局数）</summary>

| # | 角色 | 策略 | 局数 |
| ---: | --- | --- | ---: |
| 1 | scout | aggressive | 13 |
| 2 | scout | cautious | 13 |
| 3 | scout | collector | 13 |
| 4 | scout | opportunist | 13 |
| 5 | scout | random | 13 |
| 6 | fighter | aggressive | 13 |
| 7 | fighter | cautious | 13 |
| 8 | fighter | collector | 13 |
| 9 | fighter | opportunist | 13 |
| 10 | fighter | random | 13 |
| 11 | engineer | aggressive | 13 |
| 12 | engineer | cautious | 13 |
| 13 | engineer | collector | 13 |
| 14 | engineer | opportunist | 13 |
| 15 | engineer | random | 13 |
| 16 | medic | aggressive | 13 |
| 17 | medic | cautious | 13 |
| 18 | medic | collector | 13 |
| 19 | medic | opportunist | 13 |
| 20 | medic | random | 13 |
| 21 | survivor | aggressive | 12 |
| 22 | survivor | cautious | 12 |
| 23 | survivor | collector | 12 |
| 24 | survivor | opportunist | 12 |
| 25 | survivor | random | 12 |
| 26 | scavenger | aggressive | 12 |
| 27 | scavenger | cautious | 12 |
| 28 | scavenger | collector | 12 |
| 29 | scavenger | opportunist | 12 |
| 30 | scavenger | random | 12 |
| 31 | hunter | aggressive | 12 |
| 32 | hunter | cautious | 12 |
| 33 | hunter | collector | 12 |
| 34 | hunter | opportunist | 12 |
| 35 | hunter | random | 12 |
| 36 | trapper | aggressive | 12 |
| 37 | trapper | cautious | 12 |
| 38 | trapper | collector | 12 |
| 39 | trapper | opportunist | 12 |
| 40 | trapper | random | 12 |

</details>

## 引擎健康红线（FAIL 条件）

- timeout（跑到步数上限仍未结束）：0  →  OK
- illegalState（合法集合被拒 / 死锁 / livelock / 空集合）：0  →  OK
- hardLimitReached（触及 180 硬上限）：0  →  OK
- terminalWithoutWinner：0  →  OK
- invalidVictoryTuple：0  →  OK
- duplicateApexSpawn：0  →  OK
- invalidApexSpawnZone：0  →  OK

**引擎整体判定：PASS**

> 说明：timeout 在 Step 13 的 `enforceTimeLimit` 落地后会由 `playing → draw` 收束而归零；
> Regression 门槛只要求请求/实际局数一致且引擎健康；角色平衡与 Phase 3A 结果仅作为观察。

## Phase 4N PvE ecology observations

- encounters=7481, kills=1884, flees=5673, playerDeaths=52
- damageTaken=97558, groundDrops=3047, pickups=3320, wildCrafts=138
- eliteEncounters=429, eliteKills=0, apexSpawned=323, apexEncounters=15, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"feral_dog":1198,"venom_snake":569,"escaped_subject":505,"rat_swarm":1160,"feral_alpha_hound":88,"maintenance_bot":913,"patrol_drone":784,"security_hound":390,"carrion_crow":697,"resin_stalker":302,"tusked_boar":519,"riot_control_unit":41,"toxic_experiment":26,"scavenger_boar":114,"hunter_killer_drone":76,"prototype_aegis":6,"armored_repair_bot":84,"iron_tusk":9}
- encounterByZone: {"commercial":681,"construction":811,"lab":613,"hospital":427,"residential":657,"factory":721,"underground":460,"warehouse":595,"forest":871,"school":534,"park":540,"station":571}
- killsByType: {"feral_dog":406,"rat_swarm":459,"patrol_drone":183,"venom_snake":279,"tusked_boar":82,"maintenance_bot":88,"carrion_crow":282,"security_hound":42,"escaped_subject":53,"resin_stalker":10}
- killsByZone: {"commercial":190,"residential":251,"factory":90,"underground":99,"warehouse":136,"lab":58,"forest":268,"school":160,"construction":183,"park":187,"station":138,"hospital":124}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 8.3% |
| 最低非零胜率 | 1.5% |
| 比值 | 5.42 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3351 | 4.5% | 2.0% | **PASS** |
| normal | 51962 | 70.5% | - | - |
| heavy | 18393 | 25.0% | 2.0% | **PASS** |
| 合计 | 73706 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2810 | - | - |
| GUARD 使用率（占全部命令） | 10.2% | 2.0% | **PASS** |
| 防御成功减免次数 | 469 | - | - |
| EXPOSED 施加（重击挥空） | 8309 | - | - |
| EXPOSED 兑现（破绽被击中） | 2422 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 566 |
| prepare_ambush | 519 |
| track_target | 368 |
| emergency_treatment | 367 |
| scout_recon | 365 |
| escape_plan | 355 |
| sort_rare | 344 |
| camp_routine | 321 |
| second_wind | 320 |
| engineer_reinforce | 280 |
| scout_smoke | 268 |
| adrenaline | 234 |
| steady_aim | 188 |
| medic_regen | 167 |
| fighter_focus | 148 |
| field_craft | 50 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 523 | 50 | ✓ |
| rain | 528 | 50 | ✓ |
| emergency_broadcast | 524 | 50 | ✓ |
| medical_alert | 542 | 50 | ✓ |
| research_anomaly | 561 | 50 | ✓ |
| citywide_unrest | 554 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3351 | 2619 | 732 | 78.2% | 77.4% | 0.76 | ✓ | 9958 | 3.8 |
| normal | 51962 | 35380 | 16582 | 68.1% | 67.6% | 0.50 | ✓ | 202984 | 5.7 |
| heavy | 18393 | 10084 | 8309 | 54.8% | 54.0% | 0.80 | ✓ | 95897 | 9.5 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2810 |
| 防御成功触发（减免伤害） | 469 |
| 减免伤害总量 | 1802 |
| 平均每次减免 | 3.8 |
| 重击落空（Heavy Miss） | 8309 |
| EXPOSED 施加 | 8309 |
| EXPOSED 兑现（被击中） | 2422 |
| EXPOSED 未兑现失效 | 2730 |
| EXPOSED 兑现时额外伤害总量 | 1928 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 66 | 299 | 遭遇先手次数：0 |
| 肾上腺素 | 50 | 184 | 覆盖攻击 276 · 额外伤害 275 · 省体力 276 · 自伤 23 |
| 现场加工 | 50 | 0 | 免费合成 1 · 省体力 1 |
| 应急处理 | 67 | 300 | 即时治疗 877 · 治疗品额外 55 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 523 | 受影响搜索 1259 · 遭遇权重降低 1145 · 空手权重提高 1259 |
| 暴雨 | 528 | 受影响移动 1728 · 额外体力 1728 · 远程攻击 3661 |
| 广播 | 524 | 广播区域数：522 |
| 医疗警报 | 542 | 受影响治疗 9 · 额外治疗 41 |
| 研究异常 | 561 | 伤害 tick 901 · 总伤害 2691 · 致死 10 |
| 全域骚动 | 554 | 阻止噪音衰减 7830 · 搜索噪音加成 744 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 523954 |
| memory evictions | 84372 (16.1%) |
| intent commit / preserve | 18996 / 136090 |
| intent reevaluate / complete / invalidate | 16115 / 9839 / 6576 |
| commit ratio per observed NPC intent turn | 12.2% |
| remembered source failures | 5521 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 33 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 2000 / 1776 |
| incident resolved / expired | 43 / 1350 |
| incident public broadcasts | 864 |
| incident local discoveries | 13640 |
| incident responses | 57 |
| incident rewards claimed | 24 |
| incident contention failures | 0 |
| incident intent commits / preserves | 308 / 851 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 4.6% |
| 败率 | 83.2% |
| 平局率 | 12.2% |
| 超时率 | 0.0% |
| 存活率 | 4.6% |
| 胜利路线 | {"last_survivor":439,"none":61} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 74.9 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 56.1 |
| 平均承受伤害 | 181.5 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 回收场巨獠攻击 | 1 |
| 失控维修机攻击 | 3 |
| 安保机器犬攻击 | 6 |
| 战斗 | 258 |
| 树脂寄生兽攻击 | 3 |
| 毒性实验体攻击 | 1 |
| 毒蛇攻击 | 1 |
| 猎杀无人机攻击 | 4 |
| 獠牙野猪攻击 | 1 |
| 研究设施异常 | 4 |
| 禁区侵蚀 | 109 |
| 腐食乌鸦攻击 | 1 |
| 衰竭 | 50 |
| 巡逻无人机攻击 | 5 |
| 逃逸实验体攻击 | 9 |
| 野化猎犬攻击 | 10 |
| 野外毒伤 | 4 |
| 阿尔法猎犬攻击 | 1 |
| 鼠群攻击 | 6 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.2 | 76.3 |
| 侦察员 | cautious | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 5.2 | 0.1 | 74.2 |
| 侦察员 | collector | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.0 | 0.2 | 68.2 |
| 侦察员 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 77.5 |
| 侦察员 | random | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.0 | 71.1 |
| 斗士 | aggressive | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 71.6 |
| 斗士 | cautious | 13 | 1 | 9 | 3 | 0 | 7.7% | 100.0% | 0 | 0 | 4.0 | 0.1 | 74.0 |
| 斗士 | collector | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.2 | 74.5 |
| 斗士 | opportunist | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.2 | 80.7 |
| 斗士 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.0 | 76.5 |
| 工程师 | aggressive | 13 | 1 | 7 | 5 | 0 | 7.7% | 100.0% | 0 | 0 | 4.9 | 0.0 | 78.5 |
| 工程师 | cautious | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 73.5 |
| 工程师 | collector | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 3.5 | 0.2 | 73.0 |
| 工程师 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 72.9 |
| 工程师 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.3 | 0.0 | 75.2 |
| 医学生 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.2 | 76.7 |
| 医学生 | cautious | 13 | 3 | 9 | 1 | 0 | 23.1% | 100.0% | 0 | 0 | 4.0 | 0.1 | 77.0 |
| 医学生 | collector | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.1 | 0.3 | 72.5 |
| 医学生 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 75.3 |
| 医学生 | random | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 75.0 |
| 生存专家 | aggressive | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 4.3 | 0.1 | 77.6 |
| 生存专家 | cautious | 12 | 2 | 10 | 0 | 0 | 16.7% | 100.0% | 0 | 0 | 3.9 | 0.0 | 75.4 |
| 生存专家 | collector | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.4 | 0.1 | 73.0 |
| 生存专家 | opportunist | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 78.5 |
| 生存专家 | random | 12 | 1 | 8 | 3 | 0 | 8.3% | 100.0% | 0 | 0 | 4.2 | 0.0 | 78.6 |
| 拾荒者 | aggressive | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.1 | 70.3 |
| 拾荒者 | cautious | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.6 | 0.0 | 73.8 |
| 拾荒者 | collector | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 73.9 |
| 拾荒者 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.1 | 65.4 |
| 拾荒者 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 71.4 |
| 猎人 | aggressive | 12 | 2 | 7 | 3 | 0 | 16.7% | 100.0% | 0 | 0 | 3.0 | 0.3 | 71.6 |
| 猎人 | cautious | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 3.7 | 0.0 | 75.1 |
| 猎人 | collector | 12 | 2 | 7 | 3 | 0 | 16.7% | 100.0% | 0 | 0 | 4.0 | 0.3 | 76.4 |
| 猎人 | opportunist | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.3 | 0.1 | 69.1 |
| 猎人 | random | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 4.9 | 0.1 | 74.9 |
| 陷阱师 | aggressive | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.2 | 82.7 |
| 陷阱师 | cautious | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 2.4 | 0.3 | 77.9 |
| 陷阱师 | collector | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.5 | 0.1 | 77.7 |
| 陷阱师 | opportunist | 12 | 2 | 10 | 0 | 0 | 16.7% | 100.0% | 0 | 0 | 3.5 | 0.2 | 75.8 |
| 陷阱师 | random | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 81.6 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 3.1% | 3.1% | 100.0% | 4.8 | 0.1 | 165.3 |
| 斗士 | 65 | 1.5% | 1.5% | 100.0% | 4.5 | 0.1 | 185.2 |
| 工程师 | 65 | 3.1% | 3.1% | 100.0% | 4.6 | 0.0 | 179.1 |
| 医学生 | 65 | 6.2% | 6.2% | 100.0% | 4.3 | 0.1 | 232.8 |
| 生存专家 | 60 | 8.3% | 8.3% | 100.0% | 4.0 | 0.0 | 182.6 |
| 拾荒者 | 60 | 1.7% | 1.7% | 100.0% | 4.8 | 0.1 | 172.5 |
| 猎人 | 60 | 8.3% | 8.3% | 100.0% | 4.2 | 0.2 | 167.6 |
| 陷阱师 | 60 | 5.0% | 5.0% | 100.0% | 3.6 | 0.1 | 164.2 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 4.0% | 4.0% | 100.0% | 4.4 | 0.1 | 178.5 |
| cautious | 100 | 8.0% | 8.0% | 100.0% | 4.0 | 0.1 | 178.8 |
| collector | 100 | 7.0% | 7.0% | 100.0% | 4.0 | 0.2 | 191.1 |
| opportunist | 100 | 2.0% | 2.0% | 100.0% | 4.6 | 0.1 | 182.3 |
| random | 100 | 2.0% | 2.0% | 100.0% | 4.7 | 0.0 | 176.9 |

################################################################