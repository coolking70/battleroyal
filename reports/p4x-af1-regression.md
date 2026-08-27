# Simulation Regression Report

- 版本：0.5.0
- mode：formal
- 生成时间：2026-08-26T04:16:26.129Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：P4X-AF1-REG

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
> 引擎健康、角色平衡与 Phase 3A 玩法门槛分别验收；总体判定要求三者同时 PASS。

## Phase 4N PvE ecology observations

- encounters=7820, kills=2064, flees=5576, playerDeaths=36
- damageTaken=92053, groundDrops=3374, pickups=3631, wildCrafts=163
- eliteEncounters=426, eliteKills=0, apexSpawned=340, apexEncounters=12, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"rat_swarm":1312,"feral_dog":1258,"venom_snake":597,"patrol_drone":797,"tusked_boar":610,"maintenance_bot":918,"hunter_killer_drone":86,"carrion_crow":673,"security_hound":401,"armored_repair_bot":58,"resin_stalker":332,"escaped_subject":484,"riot_control_unit":47,"toxic_experiment":47,"feral_alpha_hound":76,"scavenger_boar":112,"subject_07":3,"prototype_aegis":5,"iron_tusk":4}
- encounterByZone: {"hospital":432,"residential":681,"forest":872,"commercial":599,"school":607,"factory":635,"park":640,"construction":820,"station":642,"underground":539,"warehouse":778,"lab":575}
- killsByType: {"feral_dog":462,"venom_snake":275,"maintenance_bot":94,"carrion_crow":276,"tusked_boar":98,"rat_swarm":559,"patrol_drone":198,"escaped_subject":60,"security_hound":35,"resin_stalker":7}
- killsByZone: {"residential":271,"forest":258,"school":215,"factory":89,"park":194,"commercial":205,"lab":59,"station":170,"construction":189,"underground":122,"hospital":144,"warehouse":148}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 9.2% |
| 最低非零胜率 | 3.1% |
| 比值 | 3.00 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **FAIL** |

**整体判定：FAIL**（= 引擎健康 ✓ && 角色平衡 ✗ && Phase 3A 玩法 ✓）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3491 | 4.4% | 2.0% | **PASS** |
| normal | 56139 | 71.3% | - | - |
| heavy | 19061 | 24.2% | 2.0% | **PASS** |
| 合计 | 78691 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2959 | - | - |
| GUARD 使用率（占全部命令） | 10.0% | 2.0% | **PASS** |
| 防御成功减免次数 | 540 | - | - |
| EXPOSED 施加（重击挥空） | 8450 | - | - |
| EXPOSED 兑现（破绽被击中） | 2549 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 585 |
| prepare_ambush | 498 |
| emergency_treatment | 375 |
| sort_rare | 362 |
| track_target | 360 |
| engineer_reinforce | 352 |
| scout_recon | 351 |
| escape_plan | 345 |
| second_wind | 322 |
| camp_routine | 309 |
| scout_smoke | 289 |
| adrenaline | 250 |
| steady_aim | 209 |
| medic_regen | 203 |
| fighter_focus | 175 |
| field_craft | 62 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 530 | 50 | ✓ |
| rain | 565 | 50 | ✓ |
| emergency_broadcast | 577 | 50 | ✓ |
| medical_alert | 592 | 50 | ✓ |
| research_anomaly | 531 | 50 | ✓ |
| citywide_unrest | 546 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3491 | 2698 | 793 | 77.3% | 77.1% | 0.14 | ✓ | 10517 | 3.9 |
| normal | 56139 | 38419 | 17720 | 68.4% | 67.9% | 0.58 | ✓ | 212303 | 5.5 |
| heavy | 19061 | 10611 | 8450 | 55.7% | 54.4% | 1.26 | ✓ | 98720 | 9.3 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2959 |
| 防御成功触发（减免伤害） | 540 |
| 减免伤害总量 | 2014 |
| 平均每次减免 | 3.7 |
| 重击落空（Heavy Miss） | 8450 |
| EXPOSED 施加 | 8450 |
| EXPOSED 兑现（被击中） | 2549 |
| EXPOSED 未兑现失效 | 2749 |
| EXPOSED 兑现时额外伤害总量 | 1846 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 66 | 285 | 遭遇先手次数：0 |
| 肾上腺素 | 49 | 201 | 覆盖攻击 322 · 额外伤害 337 · 省体力 322 · 自伤 22 |
| 现场加工 | 62 | 0 | 免费合成 4 · 省体力 4 |
| 应急处理 | 66 | 309 | 即时治疗 874 · 治疗品额外 44 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 530 | 受影响搜索 1238 · 遭遇权重降低 1151 · 空手权重提高 1238 |
| 暴雨 | 565 | 受影响移动 1819 · 额外体力 1819 · 远程攻击 3876 |
| 广播 | 577 | 广播区域数：577 |
| 医疗警报 | 592 | 受影响治疗 7 · 额外治疗 36 |
| 研究异常 | 531 | 伤害 tick 705 · 总伤害 2110 · 致死 9 |
| 全域骚动 | 546 | 阻止噪音衰减 7750 · 搜索噪音加成 685 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 558945 |
| memory evictions | 88782 (15.9%) |
| intent commit / preserve | 19966 / 140880 |
| intent reevaluate / complete / invalidate | 16932 / 11538 / 5777 |
| commit ratio per observed NPC intent turn | 12.4% |
| remembered source failures | 5721 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 47 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 2000 / 1822 |
| incident resolved / expired | 53 / 1385 |
| incident public broadcasts | 887 |
| incident local discoveries | 14955 |
| incident responses | 77 |
| incident rewards claimed | 40 |
| incident contention failures | 0 |
| incident intent commits / preserves | 1010 / 1238 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 5.6% |
| 败率 | 83.2% |
| 平局率 | 11.2% |
| 超时率 | 0.0% |
| 存活率 | 5.8% |
| 胜利路线 | {"last_survivor":443,"none":56,"extraction":1} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 77.2 时间单位 |
| 平均名次 | 4.2（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 60.4 |
| 平均承受伤害 | 183.1 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 回收场巨獠攻击 | 1 |
| 失控维修机攻击 | 1 |
| 安保机器犬攻击 | 5 |
| 战斗 | 275 |
| 树脂寄生兽攻击 | 1 |
| 毒性实验体攻击 | 1 |
| 猎杀无人机攻击 | 2 |
| 獠牙野猪攻击 | 2 |
| 研究设施异常 | 2 |
| 禁区侵蚀 | 98 |
| 腐食乌鸦攻击 | 3 |
| 衰竭 | 60 |
| 巡逻无人机攻击 | 4 |
| 逃逸实验体攻击 | 6 |
| 野化猎犬攻击 | 8 |
| 鼠群攻击 | 2 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 74.4 |
| 侦察员 | cautious | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.7 | 0.1 | 80.9 |
| 侦察员 | collector | 13 | 1 | 11 | 1 | 0 | 15.4% | 100.0% | 0 | 0 | 3.7 | 0.0 | 81.9 |
| 侦察员 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 73.5 |
| 侦察员 | random | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.2 | 0.3 | 74.2 |
| 斗士 | aggressive | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.6 | 0.2 | 78.0 |
| 斗士 | cautious | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 5.2 | 0.0 | 81.9 |
| 斗士 | collector | 13 | 4 | 9 | 0 | 0 | 30.8% | 100.0% | 0 | 0 | 3.0 | 0.2 | 78.1 |
| 斗士 | opportunist | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 74.6 |
| 斗士 | random | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 76.7 |
| 工程师 | aggressive | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 3.9 | 0.4 | 80.1 |
| 工程师 | cautious | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.0 | 0.1 | 77.9 |
| 工程师 | collector | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 3.7 | 0.1 | 72.5 |
| 工程师 | opportunist | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 79.7 |
| 工程师 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 77.1 |
| 医学生 | aggressive | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.4 | 0.2 | 77.8 |
| 医学生 | cautious | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.3 | 0.0 | 72.5 |
| 医学生 | collector | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 3.8 | 0.1 | 80.2 |
| 医学生 | opportunist | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.2 | 0.0 | 79.8 |
| 医学生 | random | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 75.0 |
| 生存专家 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.2 | 76.8 |
| 生存专家 | cautious | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 83.8 |
| 生存专家 | collector | 12 | 2 | 8 | 2 | 0 | 16.7% | 100.0% | 0 | 0 | 4.1 | 0.1 | 70.6 |
| 生存专家 | opportunist | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.2 | 82.3 |
| 生存专家 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 81.5 |
| 拾荒者 | aggressive | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 73.3 |
| 拾荒者 | cautious | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.8 | 0.3 | 77.9 |
| 拾荒者 | collector | 12 | 1 | 7 | 4 | 0 | 8.3% | 100.0% | 0 | 0 | 3.9 | 0.1 | 77.9 |
| 拾荒者 | opportunist | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.2 | 0.0 | 78.2 |
| 拾荒者 | random | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.8 | 0.0 | 81.7 |
| 猎人 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 77.5 |
| 猎人 | cautious | 12 | 2 | 8 | 2 | 0 | 16.7% | 100.0% | 0 | 0 | 3.4 | 0.2 | 71.7 |
| 猎人 | collector | 12 | 3 | 7 | 2 | 0 | 25.0% | 100.0% | 0 | 0 | 3.6 | 0.0 | 73.8 |
| 猎人 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.1 | 75.6 |
| 猎人 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 79.0 |
| 陷阱师 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.0 | 78.5 |
| 陷阱师 | cautious | 12 | 1 | 8 | 3 | 0 | 8.3% | 100.0% | 0 | 0 | 3.9 | 0.0 | 73.8 |
| 陷阱师 | collector | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.3 | 0.1 | 77.6 |
| 陷阱师 | opportunist | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.0 | 72.3 |
| 陷阱师 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 76.0 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 3.1% | 4.6% | 100.0% | 4.1 | 0.1 | 180.0 |
| 斗士 | 65 | 9.2% | 9.2% | 100.0% | 4.5 | 0.1 | 177.4 |
| 工程师 | 65 | 4.6% | 4.6% | 100.0% | 4.2 | 0.1 | 180.2 |
| 医学生 | 65 | 6.2% | 6.2% | 100.0% | 4.2 | 0.0 | 238.1 |
| 生存专家 | 60 | 3.3% | 3.3% | 100.0% | 4.3 | 0.1 | 187.4 |
| 拾荒者 | 60 | 6.7% | 6.7% | 100.0% | 4.0 | 0.1 | 167.4 |
| 猎人 | 60 | 8.3% | 8.3% | 100.0% | 4.2 | 0.1 | 168.6 |
| 陷阱师 | 60 | 3.3% | 3.3% | 100.0% | 4.0 | 0.0 | 162.1 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 3.0% | 3.0% | 100.0% | 4.3 | 0.1 | 177.0 |
| cautious | 100 | 7.0% | 7.0% | 100.0% | 4.0 | 0.1 | 179.0 |
| collector | 100 | 14.0% | 15.0% | 100.0% | 3.6 | 0.1 | 188.6 |
| opportunist | 100 | 2.0% | 2.0% | 100.0% | 4.4 | 0.1 | 191.7 |
| random | 100 | 2.0% | 2.0% | 100.0% | 4.4 | 0.1 | 179.2 |

################################################################