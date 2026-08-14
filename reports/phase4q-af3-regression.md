# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-14T11:30:34.770Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4Q-AF3

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

- encounters=8039, kills=2027, flees=6344, playerDeaths=49
- damageTaken=101273, groundDrops=3231, pickups=3588, wildCrafts=167
- eliteEncounters=377, eliteKills=1, apexSpawned=329, apexEncounters=11, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"rat_swarm":1437,"maintenance_bot":1012,"feral_dog":1308,"carrion_crow":697,"security_hound":421,"escaped_subject":504,"venom_snake":510,"patrol_drone":841,"resin_stalker":384,"tusked_boar":537,"toxic_experiment":21,"riot_control_unit":30,"armored_repair_bot":68,"hunter_killer_drone":87,"feral_alpha_hound":70,"scavenger_boar":101,"subject_07":4,"iron_tusk":2,"prototype_aegis":5}
- encounterByZone: {"station":632,"hospital":535,"warehouse":697,"residential":792,"construction":936,"factory":721,"school":542,"lab":594,"underground":602,"forest":766,"park":629,"commercial":593}
- killsByType: {"rat_swarm":526,"feral_dog":425,"carrion_crow":312,"venom_snake":268,"patrol_drone":189,"escaped_subject":57,"security_hound":31,"resin_stalker":17,"tusked_boar":93,"maintenance_bot":108,"feral_alpha_hound":1}
- killsByZone: {"station":144,"residential":276,"school":195,"forest":226,"hospital":111,"underground":126,"park":226,"lab":64,"construction":203,"commercial":197,"warehouse":167,"factory":92}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 10.0% |
| 最低非零胜率 | 1.5% |
| 比值 | 6.50 |
| 阈值 | 2.5 |
| 0 胜率角色 | fighter |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3493 | 4.7% | 2.0% | **PASS** |
| normal | 53255 | 71.0% | - | - |
| heavy | 18283 | 24.4% | 2.0% | **PASS** |
| 合计 | 75031 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2820 | - | - |
| GUARD 使用率（占全部命令） | 10.2% | 2.0% | **PASS** |
| 防御成功减免次数 | 481 | - | - |
| EXPOSED 施加（重击挥空） | 8172 | - | - |
| EXPOSED 兑现（破绽被击中） | 2314 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 594 |
| prepare_ambush | 534 |
| escape_plan | 373 |
| emergency_treatment | 366 |
| sort_rare | 364 |
| engineer_reinforce | 346 |
| track_target | 338 |
| camp_routine | 334 |
| scout_recon | 333 |
| second_wind | 326 |
| scout_smoke | 252 |
| adrenaline | 223 |
| medic_regen | 171 |
| steady_aim | 159 |
| fighter_focus | 150 |
| field_craft | 56 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 567 | 50 | ✓ |
| rain | 538 | 50 | ✓ |
| emergency_broadcast | 520 | 50 | ✓ |
| medical_alert | 519 | 50 | ✓ |
| research_anomaly | 548 | 50 | ✓ |
| citywide_unrest | 558 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3493 | 2709 | 784 | 77.6% | 76.9% | 0.64 | ✓ | 10305 | 3.8 |
| normal | 53255 | 35946 | 17309 | 67.5% | 67.2% | 0.34 | ✓ | 206698 | 5.8 |
| heavy | 18283 | 10111 | 8172 | 55.3% | 53.9% | 1.42 | ✓ | 96653 | 9.6 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2820 |
| 防御成功触发（减免伤害） | 481 |
| 减免伤害总量 | 1927 |
| 平均每次减免 | 4.0 |
| 重击落空（Heavy Miss） | 8172 |
| EXPOSED 施加 | 8172 |
| EXPOSED 兑现（被击中） | 2314 |
| EXPOSED 未兑现失效 | 2747 |
| EXPOSED 兑现时额外伤害总量 | 1854 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 67 | 266 | 遭遇先手次数：0 |
| 肾上腺素 | 48 | 175 | 覆盖攻击 279 · 额外伤害 297 · 省体力 279 · 自伤 27 |
| 现场加工 | 56 | 0 | 免费合成 2 · 省体力 2 |
| 应急处理 | 66 | 300 | 即时治疗 878 · 治疗品额外 66 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 567 | 受影响搜索 1474 · 遭遇权重降低 1371 · 空手权重提高 1474 |
| 暴雨 | 538 | 受影响移动 1677 · 额外体力 1677 · 远程攻击 3480 |
| 广播 | 520 | 广播区域数：520 |
| 医疗警报 | 519 | 受影响治疗 6 · 额外治疗 24 |
| 研究异常 | 548 | 伤害 tick 813 · 总伤害 2426 · 致死 10 |
| 全域骚动 | 558 | 阻止噪音衰减 7897 · 搜索噪音加成 736 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 4.2% |
| 败率 | 83.6% |
| 平局率 | 12.2% |
| 超时率 | 0.0% |
| 存活率 | 4.2% |
| 胜利路线 | {"last_survivor":438,"none":61,"extraction":1} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 75.3 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 58.0 |
| 平均承受伤害 | 180.5 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 命名实验体 07攻击 | 1 |
| 安保机器犬攻击 | 2 |
| 战斗 | 263 |
| 毒性实验体攻击 | 1 |
| 毒蛇攻击 | 1 |
| 猎杀无人机攻击 | 2 |
| 獠牙野猪攻击 | 2 |
| 研究设施异常 | 5 |
| 禁区侵蚀 | 107 |
| 腐食乌鸦攻击 | 6 |
| 衰竭 | 53 |
| 巡逻无人机攻击 | 9 |
| 逃逸实验体攻击 | 13 |
| 野化猎犬攻击 | 7 |
| 野外毒伤 | 2 |
| 阿尔法猎犬攻击 | 2 |
| 鼠群攻击 | 3 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.1 | 72.6 |
| 侦察员 | cautious | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 3.7 | 0.0 | 72.9 |
| 侦察员 | collector | 13 | 1 | 9 | 3 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.2 | 76.8 |
| 侦察员 | opportunist | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.8 | 0.2 | 77.6 |
| 侦察员 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.2 | 0.2 | 72.8 |
| 斗士 | aggressive | 13 | 0 | 8 | 5 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.0 | 68.3 |
| 斗士 | cautious | 13 | 0 | 9 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 70.8 |
| 斗士 | collector | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 74.5 |
| 斗士 | opportunist | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.1 | 77.1 |
| 斗士 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.1 | 70.2 |
| 工程师 | aggressive | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 76.5 |
| 工程师 | cautious | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.3 | 0.0 | 77.4 |
| 工程师 | collector | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.1 | 0.2 | 78.6 |
| 工程师 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.2 | 75.6 |
| 工程师 | random | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.0 | 69.5 |
| 医学生 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.2 | 76.2 |
| 医学生 | cautious | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.0 | 0.0 | 77.2 |
| 医学生 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.3 | 0.0 | 80.3 |
| 医学生 | opportunist | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.2 | 0.0 | 75.4 |
| 医学生 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 71.5 |
| 生存专家 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.0 | 77.6 |
| 生存专家 | cautious | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.4 | 0.1 | 80.3 |
| 生存专家 | collector | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 3.6 | 0.3 | 78.0 |
| 生存专家 | opportunist | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 4.0 | 0.0 | 74.3 |
| 生存专家 | random | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.8 | 0.2 | 75.3 |
| 拾荒者 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.1 | 78.3 |
| 拾荒者 | cautious | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.0 | 74.8 |
| 拾荒者 | collector | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.9 | 0.2 | 72.3 |
| 拾荒者 | opportunist | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 75.8 |
| 拾荒者 | random | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.0 | 71.7 |
| 猎人 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 74.7 |
| 猎人 | cautious | 12 | 3 | 4 | 5 | 0 | 25.0% | 100.0% | 0 | 0 | 3.9 | 0.2 | 71.4 |
| 猎人 | collector | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.9 | 0.3 | 72.9 |
| 猎人 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.3 | 73.6 |
| 猎人 | random | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 76.1 |
| 陷阱师 | aggressive | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 2.9 | 0.3 | 81.2 |
| 陷阱师 | cautious | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 3.2 | 0.0 | 75.4 |
| 陷阱师 | collector | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.7 | 0.2 | 79.4 |
| 陷阱师 | opportunist | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.8 | 0.0 | 78.8 |
| 陷阱师 | random | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 77.9 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 4.6% | 4.6% | 100.0% | 4.6 | 0.1 | 166.9 |
| 斗士 | 65 | 0.0% | 0.0% | 100.0% | 4.9 | 0.0 | 178.7 |
| 工程师 | 65 | 4.6% | 4.6% | 100.0% | 4.4 | 0.1 | 169.5 |
| 医学生 | 65 | 1.5% | 1.5% | 100.0% | 4.7 | 0.1 | 242.2 |
| 生存专家 | 60 | 5.0% | 5.0% | 100.0% | 3.8 | 0.1 | 177.7 |
| 拾荒者 | 60 | 1.7% | 1.7% | 100.0% | 4.3 | 0.1 | 167.3 |
| 猎人 | 60 | 6.7% | 6.7% | 100.0% | 4.3 | 0.1 | 169.1 |
| 陷阱师 | 60 | 10.0% | 10.0% | 100.0% | 3.6 | 0.1 | 169.8 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 1.0% | 1.0% | 100.0% | 4.3 | 0.1 | 176.0 |
| cautious | 100 | 9.0% | 9.0% | 100.0% | 3.9 | 0.0 | 179.6 |
| collector | 100 | 5.0% | 5.0% | 100.0% | 4.3 | 0.1 | 191.7 |
| opportunist | 100 | 3.0% | 3.0% | 100.0% | 4.5 | 0.1 | 183.6 |
| random | 100 | 3.0% | 3.0% | 100.0% | 4.7 | 0.1 | 171.7 |

################################################################