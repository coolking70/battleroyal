# Simulation Regression Report

- 版本：0.5.0
- mode：formal
- 生成时间：2026-08-26T04:14:53.475Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：P4X-A

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

- encounters=45721, kills=11785, flees=32948, playerDeaths=230
- damageTaken=550977, groundDrops=19016, pickups=20688, wildCrafts=894
- eliteEncounters=2481, eliteKills=4, apexSpawned=2070, apexEncounters=68, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"tusked_boar":3170,"escaped_subject":3174,"maintenance_bot":5326,"rat_swarm":7640,"feral_dog":7046,"carrion_crow":3853,"scavenger_boar":663,"venom_snake":3268,"resin_stalker":2129,"patrol_drone":4684,"hunter_killer_drone":531,"security_hound":2882,"feral_alpha_hound":515,"riot_control_unit":224,"armored_repair_bot":423,"iron_tusk":31,"subject_07":15,"toxic_experiment":125,"prototype_aegis":22}
- encounterByZone: {"forest":4820,"lab":3527,"warehouse":3726,"construction":4969,"factory":4445,"residential":4207,"school":3019,"hospital":2879,"commercial":3515,"park":3345,"underground":3306,"station":3963}
- killsByType: {"maintenance_bot":526,"rat_swarm":2967,"venom_snake":1654,"feral_dog":2443,"patrol_drone":1216,"carrion_crow":1787,"security_hound":250,"escaped_subject":331,"tusked_boar":527,"resin_stalker":80,"feral_alpha_hound":3,"hunter_killer_drone":1}
- killsByZone: {"warehouse":849,"residential":1582,"construction":1159,"commercial":1101,"forest":1501,"station":1026,"underground":649,"park":1164,"hospital":752,"factory":533,"school":1100,"lab":369}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 4.5% |
| 最低非零胜率 | 2.7% |
| 比值 | 1.70 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **PASS** |

**整体判定：PASS**（= 引擎健康 ✓ && 角色平衡 ✓ && Phase 3A 玩法 ✓）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 21448 | 4.5% | 2.0% | **PASS** |
| normal | 335094 | 70.9% | - | - |
| heavy | 115931 | 24.5% | 2.0% | **PASS** |
| 合计 | 472473 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 17358 | - | - |
| GUARD 使用率（占全部命令） | 9.9% | 2.0% | **PASS** |
| 防御成功减免次数 | 3125 | - | - |
| EXPOSED 施加（重击挥空） | 51720 | - | - |
| EXPOSED 兑现（破绽被击中） | 15639 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 3536 |
| prepare_ambush | 2863 |
| scout_recon | 2230 |
| sort_rare | 2209 |
| track_target | 2200 |
| emergency_treatment | 2123 |
| escape_plan | 2038 |
| engineer_reinforce | 1964 |
| camp_routine | 1938 |
| second_wind | 1876 |
| scout_smoke | 1831 |
| adrenaline | 1459 |
| steady_aim | 1242 |
| medic_regen | 1198 |
| fighter_focus | 1046 |
| field_craft | 341 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 3352 | 50 | ✓ |
| rain | 3272 | 50 | ✓ |
| emergency_broadcast | 3338 | 50 | ✓ |
| medical_alert | 3334 | 50 | ✓ |
| research_anomaly | 3410 | 50 | ✓ |
| citywide_unrest | 3281 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 21448 | 16615 | 4833 | 77.5% | 77.3% | 0.21 | ✓ | 62068 | 3.7 |
| normal | 335094 | 230026 | 105068 | 68.6% | 68.1% | 0.58 | ✓ | 1259840 | 5.5 |
| heavy | 115931 | 64211 | 51720 | 55.4% | 54.5% | 0.90 | ✓ | 588207 | 9.2 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 17358 |
| 防御成功触发（减免伤害） | 3125 |
| 减免伤害总量 | 11591 |
| 平均每次减免 | 3.7 |
| 重击落空（Heavy Miss） | 51720 |
| EXPOSED 施加 | 51720 |
| EXPOSED 兑现（被击中） | 15639 |
| EXPOSED 未兑现失效 | 17418 |
| EXPOSED 兑现时额外伤害总量 | 11648 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 387 | 1843 | 遭遇先手次数：1 |
| 肾上腺素 | 274 | 1185 | 覆盖攻击 1927 · 额外伤害 1964 · 省体力 1927 · 自伤 97 |
| 现场加工 | 341 | 0 | 免费合成 23 · 省体力 23 |
| 应急处理 | 364 | 1759 | 即时治疗 4683 · 治疗品额外 261 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 3352 | 受影响搜索 8346 · 遭遇权重降低 7643 · 空手权重提高 8346 |
| 暴雨 | 3272 | 受影响移动 10533 · 额外体力 10533 · 远程攻击 22867 |
| 广播 | 3338 | 广播区域数：3338 |
| 医疗警报 | 3334 | 受影响治疗 47 · 额外治疗 268 |
| 研究异常 | 3410 | 伤害 tick 5002 · 总伤害 14945 · 致死 52 |
| 全域骚动 | 3281 | 阻止噪音衰减 46494 · 搜索噪音加成 4008 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 3354419 |
| memory evictions | 520779 (15.5%) |
| intent commit / preserve | 121408 / 842862 |
| intent reevaluate / complete / invalidate | 100795 / 71058 / 34360 |
| commit ratio per observed NPC intent turn | 12.6% |
| remembered source failures | 33655 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 195 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 12000 / 10971 |
| incident resolved / expired | 341 / 8448 |
| incident public broadcasts | 5330 |
| incident local discoveries | 95644 |
| incident responses | 484 |
| incident rewards claimed | 275 |
| incident contention failures | 0 |
| incident intent commits / preserves | 6570 / 7420 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 3000 |
| 可信对局率 | 100.0% |
| 胜率 | 3.7% |
| 败率 | 86.7% |
| 平局率 | 9.6% |
| 超时率 | 0.0% |
| 存活率 | 3.7% |
| 胜利路线 | {"last_survivor":2709,"none":289,"extraction":2} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 77.0 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 57.9 |
| 平均承受伤害 | 181.9 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 命名实验体 07攻击 | 2 |
| 回收场巨獠攻击 | 7 |
| 失控维修机攻击 | 10 |
| 安保机器犬攻击 | 17 |
| 战斗 | 1727 |
| 树脂寄生兽攻击 | 11 |
| 毒性实验体攻击 | 8 |
| 毒蛇攻击 | 8 |
| 猎杀无人机攻击 | 15 |
| 獠牙野猪攻击 | 11 |
| 研究设施异常 | 10 |
| 禁区侵蚀 | 602 |
| 腐食乌鸦攻击 | 15 |
| 衰竭 | 314 |
| 装甲维修机攻击 | 1 |
| 巡逻无人机攻击 | 29 |
| 逃逸实验体攻击 | 41 |
| 野化猎犬攻击 | 23 |
| 野外毒伤 | 6 |
| 铁牙攻击 | 3 |
| 阿尔法猎犬攻击 | 8 |
| 鼠群攻击 | 21 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 75 | 1 | 65 | 9 | 0 | 1.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.5 |
| 侦察员 | cautious | 75 | 6 | 60 | 9 | 0 | 8.0% | 100.0% | 0 | 0 | 3.8 | 0.2 | 78.5 |
| 侦察员 | collector | 75 | 1 | 69 | 5 | 0 | 1.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.7 |
| 侦察员 | opportunist | 75 | 1 | 69 | 5 | 0 | 1.3% | 100.0% | 0 | 0 | 4.5 | 0.0 | 78.5 |
| 侦察员 | random | 75 | 1 | 67 | 7 | 0 | 1.3% | 100.0% | 0 | 0 | 4.7 | 0.1 | 76.8 |
| 斗士 | aggressive | 75 | 3 | 63 | 9 | 0 | 4.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 75.8 |
| 斗士 | cautious | 75 | 4 | 67 | 4 | 0 | 5.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.8 |
| 斗士 | collector | 75 | 8 | 65 | 2 | 0 | 10.7% | 100.0% | 0 | 0 | 4.4 | 0.2 | 74.7 |
| 斗士 | opportunist | 75 | 1 | 63 | 11 | 0 | 1.3% | 100.0% | 0 | 0 | 4.7 | 0.1 | 75.0 |
| 斗士 | random | 75 | 0 | 66 | 9 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 74.4 |
| 工程师 | aggressive | 75 | 1 | 70 | 4 | 0 | 1.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.5 |
| 工程师 | cautious | 75 | 5 | 63 | 7 | 0 | 6.7% | 100.0% | 0 | 0 | 4.1 | 0.1 | 80.7 |
| 工程师 | collector | 75 | 4 | 63 | 8 | 0 | 5.3% | 100.0% | 0 | 0 | 4.1 | 0.1 | 76.8 |
| 工程师 | opportunist | 75 | 0 | 69 | 6 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 77.5 |
| 工程师 | random | 75 | 1 | 63 | 11 | 0 | 1.3% | 100.0% | 0 | 0 | 4.7 | 0.1 | 76.8 |
| 医学生 | aggressive | 75 | 4 | 58 | 13 | 0 | 5.3% | 100.0% | 0 | 0 | 4.1 | 0.0 | 78.8 |
| 医学生 | cautious | 75 | 3 | 66 | 6 | 0 | 4.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 78.4 |
| 医学生 | collector | 75 | 4 | 63 | 8 | 0 | 5.3% | 100.0% | 0 | 0 | 4.2 | 0.1 | 77.6 |
| 医学生 | opportunist | 75 | 2 | 64 | 9 | 0 | 2.7% | 100.0% | 0 | 0 | 4.5 | 0.0 | 76.2 |
| 医学生 | random | 75 | 2 | 69 | 4 | 0 | 2.7% | 100.0% | 0 | 0 | 4.5 | 0.0 | 77.0 |
| 生存专家 | aggressive | 75 | 3 | 65 | 7 | 0 | 4.0% | 100.0% | 0 | 0 | 3.8 | 0.0 | 77.3 |
| 生存专家 | cautious | 75 | 3 | 69 | 3 | 0 | 4.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 77.6 |
| 生存专家 | collector | 75 | 6 | 59 | 10 | 0 | 8.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 76.9 |
| 生存专家 | opportunist | 75 | 2 | 68 | 5 | 0 | 2.7% | 100.0% | 0 | 0 | 4.4 | 0.0 | 76.8 |
| 生存专家 | random | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 76.9 |
| 拾荒者 | aggressive | 75 | 4 | 64 | 7 | 0 | 5.3% | 100.0% | 0 | 0 | 4.0 | 0.1 | 76.7 |
| 拾荒者 | cautious | 75 | 1 | 65 | 9 | 0 | 1.3% | 100.0% | 0 | 0 | 3.9 | 0.0 | 76.8 |
| 拾荒者 | collector | 75 | 6 | 66 | 3 | 0 | 8.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 78.2 |
| 拾荒者 | opportunist | 75 | 0 | 69 | 6 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.1 | 75.7 |
| 拾荒者 | random | 75 | 2 | 67 | 6 | 0 | 2.7% | 100.0% | 0 | 0 | 4.8 | 0.0 | 76.2 |
| 猎人 | aggressive | 75 | 4 | 67 | 4 | 0 | 5.3% | 100.0% | 0 | 0 | 3.9 | 0.2 | 75.0 |
| 猎人 | cautious | 75 | 3 | 61 | 11 | 0 | 4.0% | 100.0% | 0 | 0 | 4.2 | 0.2 | 76.3 |
| 猎人 | collector | 75 | 6 | 62 | 7 | 0 | 8.0% | 100.0% | 0 | 0 | 3.6 | 0.2 | 75.6 |
| 猎人 | opportunist | 75 | 0 | 66 | 9 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 77.6 |
| 猎人 | random | 75 | 0 | 63 | 12 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 74.4 |
| 陷阱师 | aggressive | 75 | 0 | 68 | 7 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 81.7 |
| 陷阱师 | cautious | 75 | 6 | 58 | 11 | 0 | 8.0% | 100.0% | 0 | 0 | 3.9 | 0.1 | 79.7 |
| 陷阱师 | collector | 75 | 4 | 65 | 6 | 0 | 5.3% | 100.0% | 0 | 0 | 4.1 | 0.1 | 78.2 |
| 陷阱师 | opportunist | 75 | 5 | 63 | 7 | 0 | 6.7% | 100.0% | 0 | 0 | 4.1 | 0.1 | 78.5 |
| 陷阱师 | random | 75 | 2 | 68 | 5 | 0 | 2.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 75.6 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 375 | 2.7% | 2.7% | 100.0% | 4.3 | 0.1 | 182.1 |
| 斗士 | 375 | 4.3% | 4.3% | 100.0% | 4.5 | 0.1 | 181.3 |
| 工程师 | 375 | 2.9% | 2.9% | 100.0% | 4.3 | 0.1 | 170.7 |
| 医学生 | 375 | 4.0% | 4.0% | 100.0% | 4.3 | 0.0 | 230.5 |
| 生存专家 | 375 | 4.3% | 4.3% | 100.0% | 4.2 | 0.0 | 178.3 |
| 拾荒者 | 375 | 3.5% | 3.5% | 100.0% | 4.3 | 0.1 | 171.2 |
| 猎人 | 375 | 3.5% | 3.5% | 100.0% | 4.1 | 0.2 | 170.0 |
| 陷阱师 | 375 | 4.5% | 4.5% | 100.0% | 4.1 | 0.1 | 171.0 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 600 | 3.3% | 3.3% | 100.0% | 4.2 | 0.1 | 176.1 |
| cautious | 600 | 5.2% | 5.2% | 100.0% | 4.1 | 0.1 | 183.9 |
| collector | 600 | 6.5% | 6.5% | 100.0% | 4.1 | 0.1 | 188.9 |
| opportunist | 600 | 1.8% | 1.8% | 100.0% | 4.5 | 0.0 | 185.8 |
| random | 600 | 1.7% | 1.7% | 100.0% | 4.5 | 0.1 | 174.7 |

################################################################