# Simulation Regression Report

- 版本：0.5.0
- mode：formal
- 生成时间：2026-08-25T17:24:34.828Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：P4X-TUNE1

## 局数分配（P3-P1）

| 字段 | 值 |
| --- | --- |
| gamesMode | total（--games = 总对局数） |
| requestedTotalGames | 3000 |
| actualTotalGames | 3000 |
| gamesPerCell（基准） | 75 |
| cellCount | 40 |
| 请求 = 实际 | ✓ |

<details><summary>distribution（每格实际局数）</summary>

| # | 角色 | 策略 | 局数 |
| ---: | --- | --- | ---: |
| 1 | scout | aggressive | 75 |
| 2 | scout | cautious | 75 |
| 3 | scout | collector | 75 |
| 4 | scout | opportunist | 75 |
| 5 | scout | random | 75 |
| 6 | fighter | aggressive | 75 |
| 7 | fighter | cautious | 75 |
| 8 | fighter | collector | 75 |
| 9 | fighter | opportunist | 75 |
| 10 | fighter | random | 75 |
| 11 | engineer | aggressive | 75 |
| 12 | engineer | cautious | 75 |
| 13 | engineer | collector | 75 |
| 14 | engineer | opportunist | 75 |
| 15 | engineer | random | 75 |
| 16 | medic | aggressive | 75 |
| 17 | medic | cautious | 75 |
| 18 | medic | collector | 75 |
| 19 | medic | opportunist | 75 |
| 20 | medic | random | 75 |
| 21 | survivor | aggressive | 75 |
| 22 | survivor | cautious | 75 |
| 23 | survivor | collector | 75 |
| 24 | survivor | opportunist | 75 |
| 25 | survivor | random | 75 |
| 26 | scavenger | aggressive | 75 |
| 27 | scavenger | cautious | 75 |
| 28 | scavenger | collector | 75 |
| 29 | scavenger | opportunist | 75 |
| 30 | scavenger | random | 75 |
| 31 | hunter | aggressive | 75 |
| 32 | hunter | cautious | 75 |
| 33 | hunter | collector | 75 |
| 34 | hunter | opportunist | 75 |
| 35 | hunter | random | 75 |
| 36 | trapper | aggressive | 75 |
| 37 | trapper | cautious | 75 |
| 38 | trapper | collector | 75 |
| 39 | trapper | opportunist | 75 |
| 40 | trapper | random | 75 |

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

- encounters=45167, kills=11570, flees=35195, playerDeaths=276
- damageTaken=573118, groundDrops=18762, pickups=20473, wildCrafts=940
- eliteEncounters=2438, eliteKills=5, apexSpawned=2069, apexEncounters=62, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"patrol_drone":4694,"carrion_crow":3856,"resin_stalker":2105,"escaped_subject":2965,"tusked_boar":3176,"rat_swarm":7662,"feral_dog":7006,"security_hound":2586,"scavenger_boar":656,"maintenance_bot":5188,"venom_snake":3429,"feral_alpha_hound":507,"riot_control_unit":277,"hunter_killer_drone":458,"armored_repair_bot":421,"toxic_experiment":119,"subject_07":19,"iron_tusk":28,"prototype_aegis":15}
- encounterByZone: {"construction":4807,"school":3213,"underground":3220,"lab":3490,"forest":4723,"warehouse":3929,"station":3750,"residential":4038,"hospital":2825,"commercial":3476,"factory":4188,"park":3508}
- killsByType: {"carrion_crow":1674,"tusked_boar":522,"feral_dog":2451,"security_hound":220,"rat_swarm":3003,"venom_snake":1620,"patrol_drone":1153,"escaped_subject":309,"maintenance_bot":518,"resin_stalker":95,"feral_alpha_hound":3,"toxic_experiment":1,"scavenger_boar":1}
- killsByZone: {"school":1081,"forest":1477,"station":902,"residential":1586,"underground":671,"park":1121,"factory":546,"lab":367,"hospital":767,"commercial":1142,"construction":1068,"warehouse":842}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 6.9% |
| 最低非零胜率 | 2.4% |
| 比值 | 2.89 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **FAIL** |

**整体判定：FAIL**（= 引擎健康 ✓ && 角色平衡 ✗ && Phase 3A 玩法 ✓）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 21102 | 4.6% | 2.0% | **PASS** |
| normal | 322993 | 71.0% | - | - |
| heavy | 111094 | 24.4% | 2.0% | **PASS** |
| 合计 | 455189 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 17192 | - | - |
| GUARD 使用率（占全部命令） | 10.1% | 2.0% | **PASS** |
| 防御成功减免次数 | 3037 | - | - |
| EXPOSED 施加（重击挥空） | 50005 | - | - |
| EXPOSED 兑现（破绽被击中） | 14557 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 3437 |
| prepare_ambush | 2878 |
| track_target | 2223 |
| scout_recon | 2180 |
| emergency_treatment | 2140 |
| sort_rare | 2133 |
| escape_plan | 2012 |
| engineer_reinforce | 1965 |
| camp_routine | 1900 |
| second_wind | 1899 |
| scout_smoke | 1674 |
| adrenaline | 1558 |
| steady_aim | 1197 |
| fighter_focus | 1068 |
| medic_regen | 978 |
| field_craft | 363 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 3270 | 50 | ✓ |
| rain | 3239 | 50 | ✓ |
| emergency_broadcast | 3299 | 50 | ✓ |
| medical_alert | 3278 | 50 | ✓ |
| research_anomaly | 3276 | 50 | ✓ |
| citywide_unrest | 3356 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 21102 | 16222 | 4880 | 76.9% | 76.8% | 0.08 | ✓ | 60953 | 3.8 |
| normal | 322993 | 220648 | 102345 | 68.3% | 67.7% | 0.62 | ✓ | 1244977 | 5.6 |
| heavy | 111094 | 61089 | 50005 | 55.0% | 54.0% | 0.94 | ✓ | 569435 | 9.3 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 17192 |
| 防御成功触发（减免伤害） | 3037 |
| 减免伤害总量 | 11820 |
| 平均每次减免 | 3.9 |
| 重击落空（Heavy Miss） | 50005 |
| EXPOSED 施加 | 50005 |
| EXPOSED 兑现（被击中） | 14557 |
| EXPOSED 未兑现失效 | 16811 |
| EXPOSED 兑现时额外伤害总量 | 11216 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 378 | 1802 | 遭遇先手次数：1 |
| 肾上腺素 | 280 | 1278 | 覆盖攻击 2051 · 额外伤害 1956 · 省体力 2051 · 自伤 122 |
| 现场加工 | 363 | 0 | 免费合成 15 · 省体力 15 |
| 应急处理 | 365 | 1775 | 即时治疗 4825 · 治疗品额外 271 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 3270 | 受影响搜索 8002 · 遭遇权重降低 7348 · 空手权重提高 8002 |
| 暴雨 | 3239 | 受影响移动 10279 · 额外体力 10279 · 远程攻击 22145 |
| 广播 | 3299 | 广播区域数：3297 |
| 医疗警报 | 3278 | 受影响治疗 52 · 额外治疗 261 |
| 研究异常 | 3276 | 伤害 tick 5054 · 总伤害 15113 · 致死 51 |
| 全域骚动 | 3356 | 阻止噪音衰减 46835 · 搜索噪音加成 4055 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 3247429 |
| memory evictions | 511850 (15.8%) |
| intent commit / preserve | 117252 / 830606 |
| intent reevaluate / complete / invalidate | 99753 / 68027 / 33261 |
| commit ratio per observed NPC intent turn | 12.4% |
| remembered source failures | 33448 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 176 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 12000 / 10862 |
| incident resolved / expired | 331 / 8298 |
| incident public broadcasts | 5242 |
| incident local discoveries | 95331 |
| incident responses | 456 |
| incident rewards claimed | 281 |
| incident contention failures | 0 |
| incident intent commits / preserves | 6112 / 7352 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 3000 |
| 可信对局率 | 100.0% |
| 胜率 | 4.5% |
| 败率 | 85.1% |
| 平局率 | 10.4% |
| 超时率 | 0.0% |
| 存活率 | 4.5% |
| 胜利路线 | {"last_survivor":2689,"none":311} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 76.0 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 57.1 |
| 平均承受伤害 | 180.6 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 命名实验体 07攻击 | 1 |
| 回收场巨獠攻击 | 5 |
| 失控维修机攻击 | 12 |
| 安保机器犬攻击 | 17 |
| 战斗 | 1722 |
| 树脂寄生兽攻击 | 9 |
| 毒性实验体攻击 | 11 |
| 毒蛇攻击 | 9 |
| 猎杀无人机攻击 | 17 |
| 獠牙野猪攻击 | 11 |
| 研究设施异常 | 13 |
| 禁区侵蚀 | 555 |
| 腐食乌鸦攻击 | 14 |
| 衰竭 | 284 |
| 装甲维修机攻击 | 1 |
| 巡逻无人机攻击 | 41 |
| 逃逸实验体攻击 | 54 |
| 野化猎犬攻击 | 31 |
| 野外毒伤 | 15 |
| 镇暴控制单元攻击 | 3 |
| 阿尔法猎犬攻击 | 9 |
| 鼠群攻击 | 31 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 75 | 3 | 68 | 4 | 0 | 4.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 75.4 |
| 侦察员 | cautious | 75 | 3 | 60 | 12 | 0 | 4.0% | 100.0% | 0 | 0 | 4.7 | 0.1 | 73.7 |
| 侦察员 | collector | 75 | 2 | 66 | 7 | 0 | 2.7% | 100.0% | 0 | 0 | 4.7 | 0.1 | 74.5 |
| 侦察员 | opportunist | 75 | 0 | 65 | 10 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 74.5 |
| 侦察员 | random | 75 | 1 | 68 | 6 | 0 | 1.3% | 100.0% | 0 | 0 | 4.6 | 0.0 | 73.5 |
| 斗士 | aggressive | 75 | 1 | 66 | 8 | 0 | 1.3% | 100.0% | 0 | 0 | 4.8 | 0.1 | 74.3 |
| 斗士 | cautious | 75 | 2 | 64 | 9 | 0 | 2.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 72.5 |
| 斗士 | collector | 75 | 5 | 64 | 6 | 0 | 6.7% | 100.0% | 0 | 0 | 4.4 | 0.2 | 76.8 |
| 斗士 | opportunist | 75 | 2 | 71 | 2 | 0 | 2.7% | 100.0% | 0 | 0 | 4.8 | 0.1 | 74.2 |
| 斗士 | random | 75 | 1 | 65 | 9 | 0 | 1.3% | 100.0% | 0 | 0 | 4.8 | 0.1 | 73.9 |
| 工程师 | aggressive | 75 | 2 | 62 | 11 | 0 | 2.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 75.1 |
| 工程师 | cautious | 75 | 5 | 64 | 6 | 0 | 6.7% | 100.0% | 0 | 0 | 4.2 | 0.1 | 76.1 |
| 工程师 | collector | 75 | 7 | 61 | 7 | 0 | 9.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.1 |
| 工程师 | opportunist | 75 | 1 | 66 | 8 | 0 | 1.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 77.7 |
| 工程师 | random | 75 | 3 | 66 | 6 | 0 | 4.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 74.8 |
| 医学生 | aggressive | 75 | 3 | 67 | 5 | 0 | 4.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 77.3 |
| 医学生 | cautious | 75 | 11 | 54 | 10 | 0 | 14.7% | 100.0% | 0 | 0 | 4.0 | 0.1 | 76.9 |
| 医学生 | collector | 75 | 6 | 55 | 14 | 0 | 8.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 75.3 |
| 医学生 | opportunist | 75 | 5 | 65 | 5 | 0 | 6.7% | 100.0% | 0 | 0 | 4.2 | 0.1 | 75.5 |
| 医学生 | random | 75 | 1 | 66 | 8 | 0 | 1.3% | 100.0% | 0 | 0 | 4.9 | 0.0 | 75.5 |
| 生存专家 | aggressive | 75 | 4 | 61 | 10 | 0 | 5.3% | 100.0% | 0 | 0 | 3.8 | 0.1 | 76.7 |
| 生存专家 | cautious | 75 | 8 | 61 | 6 | 0 | 10.7% | 100.0% | 0 | 0 | 4.0 | 0.1 | 77.4 |
| 生存专家 | collector | 75 | 4 | 61 | 10 | 0 | 5.3% | 100.0% | 0 | 0 | 4.1 | 0.1 | 77.6 |
| 生存专家 | opportunist | 75 | 3 | 65 | 7 | 0 | 4.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 77.6 |
| 生存专家 | random | 75 | 2 | 66 | 7 | 0 | 2.7% | 100.0% | 0 | 0 | 4.2 | 0.0 | 77.5 |
| 拾荒者 | aggressive | 75 | 2 | 69 | 4 | 0 | 2.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 77.5 |
| 拾荒者 | cautious | 75 | 8 | 59 | 8 | 0 | 10.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 77.5 |
| 拾荒者 | collector | 75 | 5 | 61 | 9 | 0 | 6.7% | 100.0% | 0 | 0 | 3.9 | 0.2 | 76.8 |
| 拾荒者 | opportunist | 75 | 3 | 66 | 6 | 0 | 4.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 75.8 |
| 拾荒者 | random | 75 | 2 | 66 | 7 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.1 | 73.6 |
| 猎人 | aggressive | 75 | 1 | 69 | 5 | 0 | 1.3% | 100.0% | 0 | 0 | 4.1 | 0.1 | 75.9 |
| 猎人 | cautious | 75 | 5 | 64 | 6 | 0 | 6.7% | 100.0% | 0 | 0 | 3.9 | 0.3 | 75.1 |
| 猎人 | collector | 75 | 4 | 61 | 10 | 0 | 5.3% | 100.0% | 0 | 0 | 4.0 | 0.1 | 78.5 |
| 猎人 | opportunist | 75 | 3 | 59 | 13 | 0 | 4.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 75.9 |
| 猎人 | random | 75 | 0 | 65 | 10 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.2 | 75.8 |
| 陷阱师 | aggressive | 75 | 2 | 64 | 9 | 0 | 2.7% | 100.0% | 0 | 0 | 3.9 | 0.1 | 78.9 |
| 陷阱师 | cautious | 75 | 6 | 61 | 8 | 0 | 8.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 79.0 |
| 陷阱师 | collector | 75 | 7 | 60 | 8 | 0 | 9.3% | 100.0% | 0 | 0 | 3.8 | 0.1 | 77.3 |
| 陷阱师 | opportunist | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.2 | 0.0 | 77.2 |
| 陷阱师 | random | 75 | 0 | 68 | 7 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 76.6 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 375 | 2.4% | 2.4% | 100.0% | 4.6 | 0.1 | 174.9 |
| 斗士 | 375 | 2.9% | 2.9% | 100.0% | 4.6 | 0.1 | 181.2 |
| 工程师 | 375 | 4.8% | 4.8% | 100.0% | 4.3 | 0.1 | 171.9 |
| 医学生 | 375 | 6.9% | 6.9% | 100.0% | 4.3 | 0.1 | 231.8 |
| 生存专家 | 375 | 5.6% | 5.6% | 100.0% | 4.1 | 0.1 | 178.5 |
| 拾荒者 | 375 | 5.3% | 5.3% | 100.0% | 4.3 | 0.1 | 164.8 |
| 猎人 | 375 | 3.5% | 3.5% | 100.0% | 4.2 | 0.2 | 170.1 |
| 陷阱师 | 375 | 4.5% | 4.5% | 100.0% | 4.0 | 0.1 | 171.2 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 600 | 3.0% | 3.0% | 100.0% | 4.2 | 0.1 | 176.4 |
| cautious | 600 | 8.0% | 8.0% | 100.0% | 4.2 | 0.1 | 180.4 |
| collector | 600 | 6.7% | 6.7% | 100.0% | 4.2 | 0.1 | 187.2 |
| opportunist | 600 | 3.2% | 3.2% | 100.0% | 4.4 | 0.1 | 184.7 |
| random | 600 | 1.7% | 1.7% | 100.0% | 4.5 | 0.1 | 174.2 |

################################################################