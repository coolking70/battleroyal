# Simulation Regression Report

- 版本：0.5.0
- mode：ci
- 生成时间：2026-08-25T17:42:20.572Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：CI

## 局数分配（P3-P1）

| 字段 | 值 |
| --- | --- |
| gamesMode | total（--games = 总对局数） |
| requestedTotalGames | 100 |
| actualTotalGames | 100 |
| gamesPerCell（基准） | 2 |
| cellCount | 40 |
| 请求 = 实际 | ✓ |

<details><summary>distribution（每格实际局数）</summary>

| # | 角色 | 策略 | 局数 |
| ---: | --- | --- | ---: |
| 1 | scout | aggressive | 3 |
| 2 | scout | cautious | 3 |
| 3 | scout | collector | 3 |
| 4 | scout | opportunist | 3 |
| 5 | scout | random | 3 |
| 6 | fighter | aggressive | 3 |
| 7 | fighter | cautious | 3 |
| 8 | fighter | collector | 3 |
| 9 | fighter | opportunist | 3 |
| 10 | fighter | random | 3 |
| 11 | engineer | aggressive | 3 |
| 12 | engineer | cautious | 3 |
| 13 | engineer | collector | 3 |
| 14 | engineer | opportunist | 3 |
| 15 | engineer | random | 3 |
| 16 | medic | aggressive | 3 |
| 17 | medic | cautious | 3 |
| 18 | medic | collector | 3 |
| 19 | medic | opportunist | 3 |
| 20 | medic | random | 3 |
| 21 | survivor | aggressive | 2 |
| 22 | survivor | cautious | 2 |
| 23 | survivor | collector | 2 |
| 24 | survivor | opportunist | 2 |
| 25 | survivor | random | 2 |
| 26 | scavenger | aggressive | 2 |
| 27 | scavenger | cautious | 2 |
| 28 | scavenger | collector | 2 |
| 29 | scavenger | opportunist | 2 |
| 30 | scavenger | random | 2 |
| 31 | hunter | aggressive | 2 |
| 32 | hunter | cautious | 2 |
| 33 | hunter | collector | 2 |
| 34 | hunter | opportunist | 2 |
| 35 | hunter | random | 2 |
| 36 | trapper | aggressive | 2 |
| 37 | trapper | cautious | 2 |
| 38 | trapper | collector | 2 |
| 39 | trapper | opportunist | 2 |
| 40 | trapper | random | 2 |

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

- encounters=1456, kills=376, flees=1100, playerDeaths=12
- damageTaken=18958, groundDrops=614, pickups=675, wildCrafts=28
- eliteEncounters=76, eliteKills=0, apexSpawned=69, apexEncounters=2, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"carrion_crow":142,"escaped_subject":125,"maintenance_bot":144,"rat_swarm":226,"resin_stalker":69,"feral_alpha_hound":16,"patrol_drone":162,"security_hound":77,"hunter_killer_drone":10,"feral_dog":220,"tusked_boar":109,"venom_snake":104,"scavenger_boar":18,"iron_tusk":1,"subject_07":1,"toxic_experiment":8,"armored_repair_bot":18,"riot_control_unit":6}
- encounterByZone: {"commercial":106,"hospital":96,"warehouse":105,"lab":123,"residential":158,"park":110,"underground":119,"station":103,"forest":168,"construction":152,"factory":116,"school":100}
- killsByType: {"rat_swarm":86,"carrion_crow":54,"escaped_subject":15,"feral_dog":72,"venom_snake":53,"security_hound":9,"tusked_boar":21,"patrol_drone":47,"maintenance_bot":16,"resin_stalker":3}
- killsByZone: {"residential":51,"commercial":35,"hospital":34,"station":21,"underground":22,"forest":59,"construction":43,"factory":14,"warehouse":18,"school":29,"park":33,"lab":17}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 13.3% |
| 最低非零胜率 | 6.7% |
| 比值 | 2.00 |
| 阈值 | 2.5 |
| 0 胜率角色 | fighter、medic、scavenger、hunter、trapper |
| 判定 | **FAIL** |

**整体判定：FAIL**（= 引擎健康 ✓ && 角色平衡 ✗ && Phase 3A 玩法 ✓）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 703 | 4.5% | 2.0% | **PASS** |
| normal | 10942 | 70.7% | - | - |
| heavy | 3821 | 24.7% | 2.0% | **PASS** |
| 合计 | 15466 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 567 | - | - |
| GUARD 使用率（占全部命令） | 10.6% | 2.0% | **PASS** |
| 防御成功减免次数 | 117 | - | - |
| EXPOSED 施加（重击挥空） | 1664 | - | - |
| EXPOSED 兑现（破绽被击中） | 517 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 125 |
| camp_routine | 90 |
| second_wind | 85 |
| sort_rare | 80 |
| prepare_ambush | 78 |
| scout_recon | 71 |
| emergency_treatment | 70 |
| scout_smoke | 68 |
| engineer_reinforce | 64 |
| track_target | 59 |
| escape_plan | 53 |
| adrenaline | 47 |
| fighter_focus | 35 |
| medic_regen | 34 |
| steady_aim | 32 |
| field_craft | 11 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 122 | 50 | ✓ |
| rain | 103 | 50 | ✓ |
| emergency_broadcast | 98 | 50 | ✓ |
| medical_alert | 123 | 50 | ✓ |
| research_anomaly | 99 | 50 | ✓ |
| citywide_unrest | 97 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 703 | 545 | 158 | 77.5% | 77.5% | 0.01 | ✓ | 2125 | 3.9 |
| normal | 10942 | 7518 | 3424 | 68.7% | 68.0% | 0.72 | ✓ | 41500 | 5.5 |
| heavy | 3821 | 2157 | 1664 | 56.5% | 54.5% | 1.96 | ✓ | 19751 | 9.2 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 567 |
| 防御成功触发（减免伤害） | 117 |
| 减免伤害总量 | 455 |
| 平均每次减免 | 3.9 |
| 重击落空（Heavy Miss） | 1664 |
| EXPOSED 施加 | 1664 |
| EXPOSED 兑现（被击中） | 517 |
| EXPOSED 未兑现失效 | 549 |
| EXPOSED 兑现时额外伤害总量 | 409 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 15 | 56 | 遭遇先手次数：0 |
| 肾上腺素 | 11 | 36 | 覆盖攻击 71 · 额外伤害 94 · 省体力 71 · 自伤 5 |
| 现场加工 | 11 | 0 | 免费合成 1 · 省体力 1 |
| 应急处理 | 15 | 55 | 即时治疗 209 · 治疗品额外 11 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 122 | 受影响搜索 360 · 遭遇权重降低 327 · 空手权重提高 360 |
| 暴雨 | 103 | 受影响移动 348 · 额外体力 348 · 远程攻击 737 |
| 广播 | 98 | 广播区域数：98 |
| 医疗警报 | 123 | 受影响治疗 4 · 额外治疗 22 |
| 研究异常 | 99 | 伤害 tick 153 · 总伤害 458 · 致死 3 |
| 全域骚动 | 97 | 阻止噪音衰减 1414 · 搜索噪音加成 125 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 108506 |
| memory evictions | 16958 (15.6%) |
| intent commit / preserve | 3941 / 27561 |
| intent reevaluate / complete / invalidate | 3290 / 2294 / 1108 |
| commit ratio per observed NPC intent turn | 12.5% |
| remembered source failures | 1101 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 6 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 400 / 360 |
| incident resolved / expired | 12 / 269 |
| incident public broadcasts | 173 |
| incident local discoveries | 3100 |
| incident responses | 17 |
| incident rewards claimed | 10 |
| incident contention failures | 0 |
| incident intent commits / preserves | 217 / 254 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 100 |
| 可信对局率 | 100.0% |
| 胜率 | 4.0% |
| 败率 | 86.0% |
| 平局率 | 10.0% |
| 超时率 | 0.0% |
| 存活率 | 4.0% |
| 胜利路线 | {"last_survivor":90,"none":10} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 74.9 时间单位 |
| 平均名次 | 4.6（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 54.4 |
| 平均承受伤害 | 183.1 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 回收场巨獠攻击 | 1 |
| 安保机器犬攻击 | 2 |
| 战斗 | 63 |
| 毒性实验体攻击 | 1 |
| 猎杀无人机攻击 | 1 |
| 獠牙野猪攻击 | 1 |
| 研究设施异常 | 1 |
| 禁区侵蚀 | 14 |
| 衰竭 | 6 |
| 巡逻无人机攻击 | 1 |
| 逃逸实验体攻击 | 2 |
| 鼠群攻击 | 3 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 3 | 0 | 3 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 88.0 |
| 侦察员 | cautious | 3 | 1 | 2 | 0 | 0 | 33.3% | 100.0% | 0 | 0 | 4.0 | 0.0 | 71.0 |
| 侦察员 | collector | 3 | 1 | 2 | 0 | 0 | 33.3% | 100.0% | 0 | 0 | 2.7 | 1.0 | 78.7 |
| 侦察员 | opportunist | 3 | 0 | 3 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.3 | 91.7 |
| 侦察员 | random | 3 | 0 | 3 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 72.7 |
| 斗士 | aggressive | 3 | 0 | 3 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 71.3 |
| 斗士 | cautious | 3 | 0 | 3 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.3 | 0.7 | 79.7 |
| 斗士 | collector | 3 | 0 | 2 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 82.0 |
| 斗士 | opportunist | 3 | 0 | 2 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.3 | 0.0 | 64.7 |
| 斗士 | random | 3 | 0 | 3 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.7 | 0.0 | 73.7 |
| 工程师 | aggressive | 3 | 0 | 3 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.3 | 0.0 | 73.0 |
| 工程师 | cautious | 3 | 1 | 2 | 0 | 0 | 33.3% | 100.0% | 0 | 0 | 3.0 | 0.3 | 64.3 |
| 工程师 | collector | 3 | 0 | 3 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 75.3 |
| 工程师 | opportunist | 3 | 0 | 3 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 6.0 | 0.0 | 72.0 |
| 工程师 | random | 3 | 0 | 2 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 64.7 |
| 医学生 | aggressive | 3 | 0 | 2 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.3 | 0.0 | 79.3 |
| 医学生 | cautious | 3 | 0 | 2 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.0 | 78.3 |
| 医学生 | collector | 3 | 0 | 3 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.3 | 0.0 | 77.0 |
| 医学生 | opportunist | 3 | 0 | 3 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 91.0 |
| 医学生 | random | 3 | 0 | 2 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.7 | 0.0 | 77.3 |
| 生存专家 | aggressive | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 84.5 |
| 生存专家 | cautious | 2 | 0 | 1 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 80.0 |
| 生存专家 | collector | 2 | 1 | 1 | 0 | 0 | 50.0% | 100.0% | 0 | 0 | 3.0 | 0.0 | 84.0 |
| 生存专家 | opportunist | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 75.0 |
| 生存专家 | random | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.5 | 0.0 | 61.5 |
| 拾荒者 | aggressive | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.5 | 0.0 | 79.5 |
| 拾荒者 | cautious | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 63.0 |
| 拾荒者 | collector | 2 | 0 | 1 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.5 | 0.0 | 73.5 |
| 拾荒者 | opportunist | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.0 | 70.5 |
| 拾荒者 | random | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.0 | 0.0 | 71.0 |
| 猎人 | aggressive | 2 | 0 | 1 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.5 | 76.0 |
| 猎人 | cautious | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 6.0 | 0.0 | 75.0 |
| 猎人 | collector | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.5 | 66.5 |
| 猎人 | opportunist | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.5 | 0.0 | 69.5 |
| 猎人 | random | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 6.0 | 0.0 | 65.0 |
| 陷阱师 | aggressive | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.0 | 90.0 |
| 陷阱师 | cautious | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 68.0 |
| 陷阱师 | collector | 2 | 0 | 1 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.5 | 0.0 | 73.0 |
| 陷阱师 | opportunist | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 6.0 | 0.0 | 66.5 |
| 陷阱师 | random | 2 | 0 | 2 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 6.0 | 0.0 | 65.0 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 15 | 13.3% | 13.3% | 100.0% | 4.0 | 0.3 | 171.9 |
| 斗士 | 15 | 0.0% | 0.0% | 100.0% | 4.7 | 0.1 | 172.7 |
| 工程师 | 15 | 6.7% | 6.7% | 100.0% | 4.7 | 0.1 | 165.4 |
| 医学生 | 15 | 0.0% | 0.0% | 100.0% | 5.1 | 0.0 | 244.1 |
| 生存专家 | 10 | 10.0% | 10.0% | 100.0% | 4.1 | 0.0 | 184.6 |
| 拾荒者 | 10 | 0.0% | 0.0% | 100.0% | 4.6 | 0.0 | 173.5 |
| 猎人 | 10 | 0.0% | 0.0% | 100.0% | 5.2 | 0.2 | 170.0 |
| 陷阱师 | 10 | 0.0% | 0.0% | 100.0% | 4.8 | 0.0 | 171.2 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 20 | 0.0% | 0.0% | 100.0% | 5.0 | 0.1 | 183.8 |
| cautious | 20 | 10.0% | 10.0% | 100.0% | 4.2 | 0.1 | 181.3 |
| collector | 20 | 10.0% | 10.0% | 100.0% | 4.2 | 0.2 | 185.3 |
| opportunist | 20 | 0.0% | 0.0% | 100.0% | 5.1 | 0.1 | 185.5 |
| random | 20 | 0.0% | 0.0% | 100.0% | 4.8 | 0.0 | 179.5 |

################################################################