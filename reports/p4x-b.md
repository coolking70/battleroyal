# Simulation Regression Report

- 版本：0.5.0
- mode：formal
- 生成时间：2026-08-25T17:52:29.318Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：P4X-B

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

- encounters=45560, kills=11989, flees=33497, playerDeaths=258
- damageTaken=562284, groundDrops=19373, pickups=21285, wildCrafts=900
- eliteEncounters=2393, eliteKills=3, apexSpawned=2064, apexEncounters=47, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"venom_snake":3434,"hunter_killer_drone":464,"rat_swarm":7838,"carrion_crow":3909,"escaped_subject":3085,"security_hound":2613,"maintenance_bot":5025,"patrol_drone":4704,"feral_dog":7218,"resin_stalker":2038,"scavenger_boar":602,"tusked_boar":3256,"armored_repair_bot":441,"riot_control_unit":252,"toxic_experiment":126,"feral_alpha_hound":508,"prototype_aegis":15,"iron_tusk":16,"subject_07":16}
- encounterByZone: {"forest":4813,"construction":4923,"underground":3128,"park":3630,"lab":3599,"station":3708,"factory":4055,"warehouse":3671,"hospital":3137,"commercial":3660,"residential":4094,"school":3142}
- killsByType: {"venom_snake":1677,"rat_swarm":3185,"carrion_crow":1687,"escaped_subject":353,"patrol_drone":1214,"feral_dog":2514,"resin_stalker":84,"maintenance_bot":473,"tusked_boar":567,"security_hound":232,"riot_control_unit":1,"feral_alpha_hound":2}
- killsByZone: {"forest":1522,"underground":739,"park":1186,"factory":517,"lab":387,"warehouse":848,"construction":1135,"residential":1604,"commercial":1174,"hospital":826,"school":1076,"station":975}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 5.1% |
| 最低非零胜率 | 2.7% |
| 比值 | 1.90 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **PASS** |

**整体判定：PASS**（= 引擎健康 ✓ && 角色平衡 ✓ && Phase 3A 玩法 ✓）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 21034 | 4.5% | 2.0% | **PASS** |
| normal | 329924 | 71.0% | - | - |
| heavy | 113631 | 24.5% | 2.0% | **PASS** |
| 合计 | 464589 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 17064 | - | - |
| GUARD 使用率（占全部命令） | 10.0% | 2.0% | **PASS** |
| 防御成功减免次数 | 3198 | - | - |
| EXPOSED 施加（重击挥空） | 50817 | - | - |
| EXPOSED 兑现（破绽被击中） | 15129 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 3563 |
| prepare_ambush | 2823 |
| scout_recon | 2227 |
| sort_rare | 2213 |
| track_target | 2197 |
| emergency_treatment | 2088 |
| escape_plan | 1995 |
| camp_routine | 1993 |
| engineer_reinforce | 1978 |
| second_wind | 1949 |
| scout_smoke | 1798 |
| adrenaline | 1504 |
| steady_aim | 1200 |
| fighter_focus | 1040 |
| medic_regen | 997 |
| field_craft | 360 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 3270 | 50 | ✓ |
| rain | 3246 | 50 | ✓ |
| emergency_broadcast | 3328 | 50 | ✓ |
| medical_alert | 3312 | 50 | ✓ |
| research_anomaly | 3316 | 50 | ✓ |
| citywide_unrest | 3321 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 21034 | 16235 | 4799 | 77.2% | 77.2% | 0.00 | ✓ | 62509 | 3.9 |
| normal | 329924 | 226434 | 103490 | 68.6% | 68.0% | 0.61 | ✓ | 1260383 | 5.6 |
| heavy | 113631 | 62814 | 50817 | 55.3% | 54.4% | 0.83 | ✓ | 583099 | 9.3 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 17064 |
| 防御成功触发（减免伤害） | 3198 |
| 减免伤害总量 | 11684 |
| 平均每次减免 | 3.7 |
| 重击落空（Heavy Miss） | 50817 |
| EXPOSED 施加 | 50817 |
| EXPOSED 兑现（被击中） | 15129 |
| EXPOSED 未兑现失效 | 17173 |
| EXPOSED 兑现时额外伤害总量 | 11246 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 382 | 1845 | 遭遇先手次数：0 |
| 肾上腺素 | 291 | 1213 | 覆盖攻击 1958 · 额外伤害 2021 · 省体力 1958 · 自伤 145 |
| 现场加工 | 360 | 0 | 免费合成 19 · 省体力 19 |
| 应急处理 | 379 | 1709 | 即时治疗 5161 · 治疗品额外 238 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 3270 | 受影响搜索 8017 · 遭遇权重降低 7362 · 空手权重提高 8017 |
| 暴雨 | 3246 | 受影响移动 10369 · 额外体力 10369 · 远程攻击 22405 |
| 广播 | 3328 | 广播区域数：3327 |
| 医疗警报 | 3312 | 受影响治疗 58 · 额外治疗 342 |
| 研究异常 | 3316 | 伤害 tick 4967 · 总伤害 14860 · 致死 39 |
| 全域骚动 | 3321 | 阻止噪音衰减 46674 · 搜索噪音加成 4118 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 3308574 |
| memory evictions | 519798 (15.7%) |
| intent commit / preserve | 120274 / 834758 |
| intent reevaluate / complete / invalidate | 99496 / 70116 / 34150 |
| commit ratio per observed NPC intent turn | 12.6% |
| remembered source failures | 33832 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 197 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 12000 / 10880 |
| incident resolved / expired | 359 / 8385 |
| incident public broadcasts | 5279 |
| incident local discoveries | 92462 |
| incident responses | 512 |
| incident rewards claimed | 295 |
| incident contention failures | 0 |
| incident intent commits / preserves | 6346 / 7610 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 3000 |
| 可信对局率 | 100.0% |
| 胜率 | 3.6% |
| 败率 | 85.9% |
| 平局率 | 10.5% |
| 超时率 | 0.0% |
| 存活率 | 3.6% |
| 胜利路线 | {"last_survivor":2684,"none":315,"extraction":1} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 76.6 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 58.8 |
| 平均承受伤害 | 181.3 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 原型 Aegis攻击 | 1 |
| 命名实验体 07攻击 | 3 |
| 回收场巨獠攻击 | 5 |
| 失控维修机攻击 | 8 |
| 安保机器犬攻击 | 23 |
| 战斗 | 1722 |
| 树脂寄生兽攻击 | 13 |
| 毒性实验体攻击 | 7 |
| 毒蛇攻击 | 7 |
| 猎杀无人机攻击 | 15 |
| 獠牙野猪攻击 | 14 |
| 研究设施异常 | 7 |
| 禁区侵蚀 | 629 |
| 腐食乌鸦攻击 | 8 |
| 衰竭 | 262 |
| 装甲维修机攻击 | 1 |
| 巡逻无人机攻击 | 34 |
| 逃逸实验体攻击 | 52 |
| 野化猎犬攻击 | 27 |
| 野外毒伤 | 14 |
| 铁牙攻击 | 3 |
| 阿尔法猎犬攻击 | 13 |
| 鼠群攻击 | 24 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 75 | 1 | 65 | 9 | 0 | 1.3% | 100.0% | 0 | 0 | 4.2 | 0.2 | 73.8 |
| 侦察员 | cautious | 75 | 3 | 65 | 7 | 0 | 4.0% | 100.0% | 0 | 0 | 3.9 | 0.1 | 76.1 |
| 侦察员 | collector | 75 | 5 | 59 | 11 | 0 | 6.7% | 100.0% | 0 | 0 | 4.1 | 0.1 | 78.1 |
| 侦察员 | opportunist | 75 | 2 | 68 | 5 | 0 | 2.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.4 |
| 侦察员 | random | 75 | 1 | 68 | 6 | 0 | 1.3% | 100.0% | 0 | 0 | 4.8 | 0.1 | 74.7 |
| 斗士 | aggressive | 75 | 1 | 67 | 7 | 0 | 1.3% | 100.0% | 0 | 0 | 4.6 | 0.1 | 75.3 |
| 斗士 | cautious | 75 | 3 | 67 | 5 | 0 | 4.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 78.7 |
| 斗士 | collector | 75 | 6 | 59 | 10 | 0 | 8.0% | 100.0% | 0 | 0 | 4.0 | 0.2 | 75.4 |
| 斗士 | opportunist | 75 | 3 | 66 | 6 | 0 | 4.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 75.1 |
| 斗士 | random | 75 | 1 | 63 | 11 | 0 | 1.3% | 100.0% | 0 | 0 | 4.8 | 0.1 | 74.7 |
| 工程师 | aggressive | 75 | 1 | 68 | 6 | 0 | 1.3% | 100.0% | 0 | 0 | 4.3 | 0.1 | 77.7 |
| 工程师 | cautious | 75 | 2 | 69 | 4 | 0 | 2.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 76.4 |
| 工程师 | collector | 75 | 3 | 59 | 13 | 0 | 4.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 77.5 |
| 工程师 | opportunist | 75 | 3 | 65 | 7 | 0 | 4.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 75.3 |
| 工程师 | random | 75 | 1 | 68 | 6 | 0 | 1.3% | 100.0% | 0 | 0 | 4.6 | 0.1 | 75.0 |
| 医学生 | aggressive | 75 | 1 | 68 | 6 | 0 | 1.3% | 100.0% | 0 | 0 | 4.7 | 0.0 | 77.2 |
| 医学生 | cautious | 75 | 8 | 57 | 10 | 0 | 10.7% | 100.0% | 0 | 0 | 4.3 | 0.0 | 77.0 |
| 医学生 | collector | 75 | 7 | 60 | 8 | 0 | 9.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 77.5 |
| 医学生 | opportunist | 75 | 1 | 69 | 5 | 0 | 1.3% | 100.0% | 0 | 0 | 4.7 | 0.0 | 74.9 |
| 医学生 | random | 75 | 2 | 64 | 9 | 0 | 2.7% | 100.0% | 0 | 0 | 4.7 | 0.0 | 75.5 |
| 生存专家 | aggressive | 75 | 3 | 62 | 10 | 0 | 4.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 76.4 |
| 生存专家 | cautious | 75 | 4 | 67 | 4 | 0 | 5.3% | 100.0% | 0 | 0 | 4.2 | 0.1 | 75.9 |
| 生存专家 | collector | 75 | 5 | 66 | 4 | 0 | 6.7% | 100.0% | 0 | 0 | 4.2 | 0.1 | 75.8 |
| 生存专家 | opportunist | 75 | 2 | 59 | 14 | 0 | 2.7% | 100.0% | 0 | 0 | 4.2 | 0.1 | 79.9 |
| 生存专家 | random | 75 | 1 | 68 | 6 | 0 | 1.3% | 100.0% | 0 | 0 | 4.3 | 0.1 | 77.4 |
| 拾荒者 | aggressive | 75 | 1 | 67 | 7 | 0 | 1.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.0 |
| 拾荒者 | cautious | 75 | 3 | 62 | 10 | 0 | 4.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 77.3 |
| 拾荒者 | collector | 75 | 2 | 60 | 13 | 0 | 2.7% | 100.0% | 0 | 0 | 4.2 | 0.1 | 75.2 |
| 拾荒者 | opportunist | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 76.2 |
| 拾荒者 | random | 75 | 2 | 62 | 11 | 0 | 2.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 78.8 |
| 猎人 | aggressive | 75 | 1 | 65 | 9 | 0 | 1.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.2 |
| 猎人 | cautious | 75 | 7 | 62 | 6 | 0 | 9.3% | 100.0% | 0 | 0 | 3.9 | 0.1 | 76.7 |
| 猎人 | collector | 75 | 1 | 64 | 10 | 0 | 1.3% | 100.0% | 0 | 0 | 4.2 | 0.1 | 77.6 |
| 猎人 | opportunist | 75 | 1 | 66 | 8 | 0 | 1.3% | 100.0% | 0 | 0 | 4.4 | 0.0 | 75.3 |
| 猎人 | random | 75 | 1 | 66 | 8 | 0 | 1.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.5 |
| 陷阱师 | aggressive | 75 | 1 | 67 | 7 | 0 | 1.3% | 100.0% | 0 | 0 | 4.0 | 0.1 | 75.2 |
| 陷阱师 | cautious | 75 | 5 | 58 | 12 | 0 | 6.7% | 100.0% | 0 | 0 | 4.0 | 0.0 | 79.6 |
| 陷阱师 | collector | 75 | 7 | 64 | 4 | 0 | 9.3% | 100.0% | 0 | 0 | 4.0 | 0.1 | 78.8 |
| 陷阱师 | opportunist | 75 | 3 | 66 | 6 | 0 | 4.0% | 100.0% | 0 | 0 | 3.9 | 0.0 | 79.3 |
| 陷阱师 | random | 75 | 1 | 67 | 7 | 0 | 1.3% | 100.0% | 0 | 0 | 4.1 | 0.0 | 77.7 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 375 | 3.2% | 3.2% | 100.0% | 4.3 | 0.1 | 176.9 |
| 斗士 | 375 | 3.7% | 3.7% | 100.0% | 4.5 | 0.1 | 179.2 |
| 工程师 | 375 | 2.7% | 2.7% | 100.0% | 4.4 | 0.1 | 171.9 |
| 医学生 | 375 | 5.1% | 5.1% | 100.0% | 4.6 | 0.0 | 235.3 |
| 生存专家 | 375 | 4.0% | 4.0% | 100.0% | 4.2 | 0.1 | 179.7 |
| 拾荒者 | 375 | 2.7% | 2.7% | 100.0% | 4.4 | 0.1 | 168.5 |
| 猎人 | 375 | 2.9% | 2.9% | 100.0% | 4.2 | 0.1 | 167.6 |
| 陷阱师 | 375 | 4.5% | 4.5% | 100.0% | 4.0 | 0.0 | 171.6 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 600 | 1.7% | 1.7% | 100.0% | 4.4 | 0.1 | 177.0 |
| cautious | 600 | 5.8% | 5.8% | 100.0% | 4.2 | 0.1 | 178.9 |
| collector | 600 | 6.0% | 6.0% | 100.0% | 4.2 | 0.1 | 190.5 |
| opportunist | 600 | 2.8% | 2.8% | 100.0% | 4.4 | 0.0 | 183.6 |
| random | 600 | 1.7% | 1.7% | 100.0% | 4.5 | 0.1 | 176.7 |

################################################################