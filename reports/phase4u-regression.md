# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-23T09:05:40.914Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4U

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

- encounters=7538, kills=1902, flees=6058, playerDeaths=54
- damageTaken=94014, groundDrops=3061, pickups=3370, wildCrafts=164
- eliteEncounters=395, eliteKills=0, apexSpawned=341, apexEncounters=11, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"venom_snake":554,"maintenance_bot":881,"carrion_crow":671,"feral_dog":1123,"rat_swarm":1314,"hunter_killer_drone":78,"escaped_subject":461,"tusked_boar":591,"security_hound":461,"patrol_drone":704,"resin_stalker":372,"scavenger_boar":99,"riot_control_unit":53,"feral_alpha_hound":73,"armored_repair_bot":73,"iron_tusk":3,"toxic_experiment":19,"prototype_aegis":2,"subject_07":6}
- encounterByZone: {"construction":881,"factory":603,"school":496,"warehouse":636,"station":678,"commercial":592,"residential":663,"hospital":507,"underground":519,"forest":781,"lab":565,"park":617}
- killsByType: {"carrion_crow":269,"feral_dog":386,"rat_swarm":521,"patrol_drone":182,"maintenance_bot":75,"venom_snake":278,"tusked_boar":93,"security_hound":37,"escaped_subject":48,"resin_stalker":13}
- killsByZone: {"school":179,"commercial":159,"residential":276,"station":164,"hospital":126,"lab":56,"factory":70,"forest":226,"underground":114,"construction":196,"warehouse":129,"park":207}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 6.7% |
| 最低非零胜率 | 1.7% |
| 比值 | 4.00 |
| 阈值 | 2.5 |
| 0 胜率角色 | hunter |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3245 | 4.4% | 2.0% | **PASS** |
| normal | 52725 | 71.5% | - | - |
| heavy | 17784 | 24.1% | 2.0% | **PASS** |
| 合计 | 73754 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2756 | - | - |
| GUARD 使用率（占全部命令） | 9.9% | 2.0% | **PASS** |
| 防御成功减免次数 | 495 | - | - |
| EXPOSED 施加（重击挥空） | 7969 | - | - |
| EXPOSED 兑现（破绽被击中） | 2271 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 553 |
| prepare_ambush | 520 |
| track_target | 391 |
| emergency_treatment | 371 |
| scout_recon | 350 |
| sort_rare | 344 |
| escape_plan | 340 |
| engineer_reinforce | 321 |
| camp_routine | 305 |
| second_wind | 303 |
| scout_smoke | 266 |
| adrenaline | 228 |
| steady_aim | 183 |
| fighter_focus | 157 |
| medic_regen | 147 |
| field_craft | 54 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 533 | 50 | ✓ |
| rain | 551 | 50 | ✓ |
| emergency_broadcast | 531 | 50 | ✓ |
| medical_alert | 514 | 50 | ✓ |
| research_anomaly | 559 | 50 | ✓ |
| citywide_unrest | 546 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3245 | 2484 | 761 | 76.5% | 76.0% | 0.53 | ✓ | 9746 | 3.9 |
| normal | 52725 | 35854 | 16871 | 68.0% | 67.5% | 0.49 | ✓ | 206432 | 5.8 |
| heavy | 17784 | 9815 | 7969 | 55.2% | 54.3% | 0.92 | ✓ | 94911 | 9.7 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2756 |
| 防御成功触发（减免伤害） | 495 |
| 减免伤害总量 | 2069 |
| 平均每次减免 | 4.2 |
| 重击落空（Heavy Miss） | 7969 |
| EXPOSED 施加 | 7969 |
| EXPOSED 兑现（被击中） | 2271 |
| EXPOSED 未兑现失效 | 2759 |
| EXPOSED 兑现时额外伤害总量 | 1802 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 66 | 284 | 遭遇先手次数：0 |
| 肾上腺素 | 45 | 183 | 覆盖攻击 286 · 额外伤害 288 · 省体力 286 · 自伤 14 |
| 现场加工 | 54 | 0 | 免费合成 5 · 省体力 5 |
| 应急处理 | 65 | 306 | 即时治疗 813 · 治疗品额外 81 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 533 | 受影响搜索 1244 · 遭遇权重降低 1124 · 空手权重提高 1244 |
| 暴雨 | 551 | 受影响移动 1823 · 额外体力 1823 · 远程攻击 3622 |
| 广播 | 531 | 广播区域数：531 |
| 医疗警报 | 514 | 受影响治疗 3 · 额外治疗 9 |
| 研究异常 | 559 | 伤害 tick 758 · 总伤害 2263 · 致死 10 |
| 全域骚动 | 546 | 阻止噪音衰减 7668 · 搜索噪音加成 721 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 527153 |
| memory evictions | 84870 (16.1%) |
| intent commit / preserve | 19243 / 135737 |
| intent reevaluate / complete / invalidate | 16293 / 11046 / 5549 |
| commit ratio per observed NPC intent turn | 12.4% |
| remembered source failures | 5778 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 26 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 2000 / 1795 |
| incident resolved / expired | 44 / 1337 |
| incident public broadcasts | 872 |
| incident local discoveries | 14237 |
| incident responses | 67 |
| incident rewards claimed | 43 |
| incident contention failures | 0 |
| incident intent commits / preserves | 958 / 1196 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 4.0% |
| 败率 | 84.4% |
| 平局率 | 11.6% |
| 超时率 | 0.0% |
| 存活率 | 4.0% |
| 胜利路线 | {"last_survivor":442,"none":58} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 75.1 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 55.3 |
| 平均承受伤害 | 180.9 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 命名实验体 07攻击 | 2 |
| 回收场巨獠攻击 | 1 |
| 失控维修机攻击 | 1 |
| 安保机器犬攻击 | 10 |
| 战斗 | 281 |
| 树脂寄生兽攻击 | 2 |
| 毒蛇攻击 | 2 |
| 獠牙野猪攻击 | 3 |
| 研究设施异常 | 5 |
| 禁区侵蚀 | 85 |
| 腐食乌鸦攻击 | 3 |
| 衰竭 | 55 |
| 巡逻无人机攻击 | 9 |
| 逃逸实验体攻击 | 7 |
| 野化猎犬攻击 | 10 |
| 阿尔法猎犬攻击 | 1 |
| 鼠群攻击 | 3 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 77.3 |
| 侦察员 | cautious | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.2 | 0.2 | 73.7 |
| 侦察员 | collector | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.3 | 72.8 |
| 侦察员 | opportunist | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.4 | 0.1 | 75.8 |
| 侦察员 | random | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 69.9 |
| 斗士 | aggressive | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.2 | 76.4 |
| 斗士 | cautious | 13 | 2 | 10 | 1 | 0 | 15.4% | 100.0% | 0 | 0 | 4.4 | 0.0 | 77.3 |
| 斗士 | collector | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.2 | 73.6 |
| 斗士 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 73.3 |
| 斗士 | random | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.0 | 0.0 | 70.1 |
| 工程师 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 76.8 |
| 工程师 | cautious | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 3.8 | 0.2 | 77.8 |
| 工程师 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 78.1 |
| 工程师 | opportunist | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.4 |
| 工程师 | random | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 78.6 |
| 医学生 | aggressive | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.2 | 69.9 |
| 医学生 | cautious | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.2 | 0.0 | 70.5 |
| 医学生 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 73.9 |
| 医学生 | opportunist | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 71.6 |
| 医学生 | random | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.4 | 0.0 | 73.3 |
| 生存专家 | aggressive | 12 | 1 | 8 | 3 | 0 | 8.3% | 100.0% | 0 | 0 | 3.2 | 0.0 | 78.2 |
| 生存专家 | cautious | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.1 | 79.3 |
| 生存专家 | collector | 12 | 3 | 8 | 1 | 0 | 25.0% | 100.0% | 0 | 0 | 3.8 | 0.2 | 74.6 |
| 生存专家 | opportunist | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 77.4 |
| 生存专家 | random | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 73.5 |
| 拾荒者 | aggressive | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.2 | 77.3 |
| 拾荒者 | cautious | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.3 | 0.2 | 76.9 |
| 拾荒者 | collector | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 71.5 |
| 拾荒者 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 67.3 |
| 拾荒者 | random | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.1 | 73.8 |
| 猎人 | aggressive | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 78.5 |
| 猎人 | cautious | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.0 | 74.8 |
| 猎人 | collector | 12 | 0 | 8 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 79.1 |
| 猎人 | opportunist | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.2 | 76.3 |
| 猎人 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.3 | 76.0 |
| 陷阱师 | aggressive | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.0 | 79.6 |
| 陷阱师 | cautious | 12 | 2 | 10 | 0 | 0 | 16.7% | 100.0% | 0 | 0 | 2.7 | 0.3 | 82.1 |
| 陷阱师 | collector | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.6 | 0.1 | 74.4 |
| 陷阱师 | opportunist | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.0 | 0.1 | 71.5 |
| 陷阱师 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.1 | 75.8 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 3.1% | 3.1% | 100.0% | 4.6 | 0.1 | 167.8 |
| 斗士 | 65 | 6.2% | 6.2% | 100.0% | 4.4 | 0.1 | 176.4 |
| 工程师 | 65 | 3.1% | 3.1% | 100.0% | 4.4 | 0.1 | 173.0 |
| 医学生 | 65 | 4.6% | 4.6% | 100.0% | 4.4 | 0.1 | 238.6 |
| 生存专家 | 60 | 6.7% | 6.7% | 100.0% | 3.9 | 0.1 | 185.9 |
| 拾荒者 | 60 | 1.7% | 1.7% | 100.0% | 4.7 | 0.1 | 165.9 |
| 猎人 | 60 | 0.0% | 0.0% | 100.0% | 4.2 | 0.1 | 172.8 |
| 陷阱师 | 60 | 6.7% | 6.7% | 100.0% | 3.6 | 0.1 | 164.5 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 2.0% | 2.0% | 100.0% | 4.2 | 0.1 | 175.7 |
| cautious | 100 | 8.0% | 8.0% | 100.0% | 3.9 | 0.1 | 182.3 |
| collector | 100 | 4.0% | 4.0% | 100.0% | 4.3 | 0.1 | 188.3 |
| opportunist | 100 | 3.0% | 3.0% | 100.0% | 4.5 | 0.1 | 180.5 |
| random | 100 | 3.0% | 3.0% | 100.0% | 4.4 | 0.1 | 177.8 |

################################################################