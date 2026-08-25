# Simulation Regression Report

- 版本：0.5.0
- mode：formal
- 生成时间：2026-08-25T17:45:30.750Z
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

- encounters=45496, kills=11852, flees=33555, playerDeaths=275
- damageTaken=555462, groundDrops=19151, pickups=21064, wildCrafts=886
- eliteEncounters=2407, eliteKills=3, apexSpawned=2004, apexEncounters=56, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"tusked_boar":3270,"escaped_subject":3040,"maintenance_bot":5484,"rat_swarm":7556,"carrion_crow":3888,"feral_dog":6845,"scavenger_boar":637,"venom_snake":3333,"riot_control_unit":259,"patrol_drone":4687,"security_hound":2834,"hunter_killer_drone":482,"feral_alpha_hound":493,"resin_stalker":2096,"armored_repair_bot":416,"toxic_experiment":120,"iron_tusk":22,"prototype_aegis":21,"subject_07":13}
- encounterByZone: {"forest":4746,"lab":3619,"warehouse":3736,"construction":5043,"factory":4247,"hospital":2890,"park":3564,"residential":4083,"school":2977,"commercial":3474,"station":3846,"underground":3271}
- killsByType: {"rat_swarm":3073,"escaped_subject":364,"maintenance_bot":526,"feral_dog":2506,"carrion_crow":1736,"patrol_drone":1120,"venom_snake":1670,"security_hound":240,"tusked_boar":533,"resin_stalker":81,"feral_alpha_hound":3}
- killsByZone: {"hospital":774,"lab":375,"warehouse":872,"commercial":1088,"station":1000,"residential":1619,"school":1081,"construction":1130,"forest":1519,"underground":716,"factory":514,"park":1164}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 6.4% |
| 最低非零胜率 | 2.1% |
| 比值 | 3.00 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **FAIL** |

**整体判定：FAIL**（= 引擎健康 ✓ && 角色平衡 ✗ && Phase 3A 玩法 ✓）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 21009 | 4.5% | 2.0% | **PASS** |
| normal | 329807 | 71.1% | - | - |
| heavy | 113363 | 24.4% | 2.0% | **PASS** |
| 合计 | 464179 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 17368 | - | - |
| GUARD 使用率（占全部命令） | 10.1% | 2.0% | **PASS** |
| 防御成功减免次数 | 3067 | - | - |
| EXPOSED 施加（重击挥空） | 50619 | - | - |
| EXPOSED 兑现（破绽被击中） | 15124 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 3504 |
| prepare_ambush | 2867 |
| scout_recon | 2216 |
| track_target | 2187 |
| sort_rare | 2184 |
| emergency_treatment | 2126 |
| escape_plan | 1995 |
| engineer_reinforce | 1948 |
| camp_routine | 1919 |
| second_wind | 1892 |
| scout_smoke | 1786 |
| adrenaline | 1518 |
| steady_aim | 1222 |
| fighter_focus | 1042 |
| medic_regen | 1004 |
| field_craft | 356 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 3400 | 50 | ✓ |
| rain | 3230 | 50 | ✓ |
| emergency_broadcast | 3409 | 50 | ✓ |
| medical_alert | 3206 | 50 | ✓ |
| research_anomaly | 3249 | 50 | ✓ |
| citywide_unrest | 3316 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 21009 | 16433 | 4576 | 78.2% | 77.3% | 0.95 | ✓ | 62276 | 3.8 |
| normal | 329807 | 226286 | 103521 | 68.6% | 68.1% | 0.53 | ✓ | 1262600 | 5.6 |
| heavy | 113363 | 62744 | 50619 | 55.3% | 54.4% | 0.91 | ✓ | 590139 | 9.4 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 17368 |
| 防御成功触发（减免伤害） | 3067 |
| 减免伤害总量 | 11886 |
| 平均每次减免 | 3.9 |
| 重击落空（Heavy Miss） | 50619 |
| EXPOSED 施加 | 50619 |
| EXPOSED 兑现（被击中） | 15124 |
| EXPOSED 未兑现失效 | 16894 |
| EXPOSED 兑现时额外伤害总量 | 11381 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 383 | 1833 | 遭遇先手次数：1 |
| 肾上腺素 | 285 | 1233 | 覆盖攻击 1999 · 额外伤害 2036 · 省体力 1999 · 自伤 113 |
| 现场加工 | 356 | 0 | 免费合成 19 · 省体力 19 |
| 应急处理 | 364 | 1762 | 即时治疗 4786 · 治疗品额外 294 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 3400 | 受影响搜索 8302 · 遭遇权重降低 7597 · 空手权重提高 8302 |
| 暴雨 | 3230 | 受影响移动 10585 · 额外体力 10585 · 远程攻击 22619 |
| 广播 | 3409 | 广播区域数：3407 |
| 医疗警报 | 3206 | 受影响治疗 46 · 额外治疗 229 |
| 研究异常 | 3249 | 伤害 tick 4901 · 总伤害 14638 · 致死 61 |
| 全域骚动 | 3316 | 阻止噪音衰减 46763 · 搜索噪音加成 4115 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 3299513 |
| memory evictions | 518496 (15.7%) |
| intent commit / preserve | 120366 / 832335 |
| intent reevaluate / complete / invalidate | 99316 / 70233 / 34161 |
| commit ratio per observed NPC intent turn | 12.6% |
| remembered source failures | 33529 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 179 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 12000 / 10893 |
| incident resolved / expired | 348 / 8344 |
| incident public broadcasts | 5298 |
| incident local discoveries | 95833 |
| incident responses | 474 |
| incident rewards claimed | 281 |
| incident contention failures | 0 |
| incident intent commits / preserves | 6360 / 7114 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 3000 |
| 可信对局率 | 100.0% |
| 胜率 | 4.3% |
| 败率 | 84.4% |
| 平局率 | 11.3% |
| 超时率 | 0.0% |
| 存活率 | 4.3% |
| 胜利路线 | {"last_survivor":2661,"none":339} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 76.5 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 58.0 |
| 平均承受伤害 | 181.7 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 命名实验体 07攻击 | 2 |
| 回收场巨獠攻击 | 7 |
| 失控维修机攻击 | 8 |
| 安保机器犬攻击 | 27 |
| 战斗 | 1712 |
| 树脂寄生兽攻击 | 10 |
| 毒性实验体攻击 | 6 |
| 毒蛇攻击 | 3 |
| 猎杀无人机攻击 | 17 |
| 獠牙野猪攻击 | 13 |
| 研究设施异常 | 15 |
| 禁区侵蚀 | 573 |
| 腐食乌鸦攻击 | 9 |
| 衰竭 | 291 |
| 装甲维修机攻击 | 2 |
| 巡逻无人机攻击 | 25 |
| 逃逸实验体攻击 | 64 |
| 野化猎犬攻击 | 41 |
| 野外毒伤 | 6 |
| 铁牙攻击 | 4 |
| 镇暴控制单元攻击 | 3 |
| 阿尔法猎犬攻击 | 13 |
| 鼠群攻击 | 21 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 75 | 2 | 63 | 10 | 0 | 2.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.3 |
| 侦察员 | cautious | 75 | 6 | 61 | 8 | 0 | 8.0% | 100.0% | 0 | 0 | 3.9 | 0.1 | 79.4 |
| 侦察员 | collector | 75 | 0 | 66 | 9 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 74.6 |
| 侦察员 | opportunist | 75 | 0 | 71 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 78.8 |
| 侦察员 | random | 75 | 0 | 66 | 9 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.1 | 75.1 |
| 斗士 | aggressive | 75 | 2 | 64 | 9 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 75.9 |
| 斗士 | cautious | 75 | 4 | 59 | 12 | 0 | 5.3% | 100.0% | 0 | 0 | 4.3 | 0.1 | 75.5 |
| 斗士 | collector | 75 | 3 | 64 | 8 | 0 | 4.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 76.9 |
| 斗士 | opportunist | 75 | 2 | 67 | 6 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 75.0 |
| 斗士 | random | 75 | 2 | 64 | 9 | 0 | 2.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 73.6 |
| 工程师 | aggressive | 75 | 2 | 68 | 5 | 0 | 2.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 74.2 |
| 工程师 | cautious | 75 | 5 | 59 | 11 | 0 | 6.7% | 100.0% | 0 | 0 | 3.9 | 0.1 | 77.9 |
| 工程师 | collector | 75 | 2 | 64 | 9 | 0 | 2.7% | 100.0% | 0 | 0 | 4.2 | 0.0 | 76.9 |
| 工程师 | opportunist | 75 | 2 | 64 | 9 | 0 | 2.7% | 100.0% | 0 | 0 | 4.3 | 0.0 | 75.4 |
| 工程师 | random | 75 | 2 | 64 | 9 | 0 | 2.7% | 100.0% | 0 | 0 | 4.5 | 0.0 | 77.0 |
| 医学生 | aggressive | 75 | 1 | 65 | 9 | 0 | 1.3% | 100.0% | 0 | 0 | 4.6 | 0.0 | 75.4 |
| 医学生 | cautious | 75 | 5 | 63 | 7 | 0 | 6.7% | 100.0% | 0 | 0 | 4.2 | 0.1 | 77.5 |
| 医学生 | collector | 75 | 5 | 65 | 5 | 0 | 6.7% | 100.0% | 0 | 0 | 4.4 | 0.0 | 75.7 |
| 医学生 | opportunist | 75 | 3 | 64 | 8 | 0 | 4.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 75.8 |
| 医学生 | random | 75 | 1 | 64 | 10 | 0 | 1.3% | 100.0% | 0 | 0 | 4.6 | 0.0 | 76.9 |
| 生存专家 | aggressive | 75 | 5 | 63 | 7 | 0 | 6.7% | 100.0% | 0 | 0 | 4.0 | 0.0 | 77.4 |
| 生存专家 | cautious | 75 | 4 | 66 | 5 | 0 | 5.3% | 100.0% | 0 | 0 | 4.1 | 0.0 | 77.8 |
| 生存专家 | collector | 75 | 8 | 56 | 11 | 0 | 10.7% | 100.0% | 0 | 0 | 3.8 | 0.1 | 77.3 |
| 生存专家 | opportunist | 75 | 1 | 67 | 7 | 0 | 1.3% | 100.0% | 0 | 0 | 4.5 | 0.0 | 76.9 |
| 生存专家 | random | 75 | 2 | 63 | 10 | 0 | 2.7% | 100.0% | 0 | 0 | 4.5 | 0.0 | 78.1 |
| 拾荒者 | aggressive | 75 | 7 | 55 | 13 | 0 | 9.3% | 100.0% | 0 | 0 | 4.3 | 0.1 | 76.9 |
| 拾荒者 | cautious | 75 | 3 | 62 | 10 | 0 | 4.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 75.4 |
| 拾荒者 | collector | 75 | 5 | 61 | 9 | 0 | 6.7% | 100.0% | 0 | 0 | 4.1 | 0.1 | 75.7 |
| 拾荒者 | opportunist | 75 | 0 | 67 | 8 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 76.1 |
| 拾荒者 | random | 75 | 1 | 61 | 13 | 0 | 1.3% | 100.0% | 0 | 0 | 4.7 | 0.1 | 75.9 |
| 猎人 | aggressive | 75 | 4 | 61 | 10 | 0 | 5.3% | 100.0% | 0 | 0 | 4.1 | 0.1 | 74.9 |
| 猎人 | cautious | 75 | 6 | 67 | 2 | 0 | 8.0% | 100.0% | 0 | 0 | 3.9 | 0.2 | 75.0 |
| 猎人 | collector | 75 | 10 | 57 | 8 | 0 | 13.3% | 100.0% | 0 | 0 | 3.8 | 0.2 | 76.6 |
| 猎人 | opportunist | 75 | 2 | 59 | 14 | 0 | 2.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 77.1 |
| 猎人 | random | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 73.4 |
| 陷阱师 | aggressive | 75 | 1 | 63 | 11 | 0 | 1.3% | 100.0% | 0 | 0 | 4.2 | 0.0 | 78.0 |
| 陷阱师 | cautious | 75 | 6 | 66 | 3 | 0 | 8.0% | 100.0% | 0 | 0 | 3.8 | 0.1 | 81.8 |
| 陷阱师 | collector | 75 | 7 | 61 | 7 | 0 | 9.3% | 100.0% | 0 | 0 | 3.9 | 0.1 | 78.9 |
| 陷阱师 | opportunist | 75 | 3 | 64 | 8 | 0 | 4.0% | 100.0% | 0 | 0 | 4.1 | 0.0 | 75.6 |
| 陷阱师 | random | 75 | 2 | 64 | 9 | 0 | 2.7% | 100.0% | 0 | 0 | 4.3 | 0.0 | 76.8 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 375 | 2.1% | 2.1% | 100.0% | 4.4 | 0.1 | 179.0 |
| 斗士 | 375 | 3.5% | 3.5% | 100.0% | 4.5 | 0.1 | 183.4 |
| 工程师 | 375 | 3.5% | 3.5% | 100.0% | 4.2 | 0.1 | 171.2 |
| 医学生 | 375 | 4.0% | 4.0% | 100.0% | 4.5 | 0.0 | 231.1 |
| 生存专家 | 375 | 5.3% | 5.3% | 100.0% | 4.1 | 0.0 | 179.0 |
| 拾荒者 | 375 | 4.3% | 4.3% | 100.0% | 4.3 | 0.1 | 167.8 |
| 猎人 | 375 | 6.4% | 6.4% | 100.0% | 4.1 | 0.1 | 169.3 |
| 陷阱师 | 375 | 5.1% | 5.1% | 100.0% | 4.1 | 0.0 | 173.0 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 600 | 4.0% | 4.0% | 100.0% | 4.3 | 0.1 | 175.4 |
| cautious | 600 | 6.5% | 6.5% | 100.0% | 4.0 | 0.1 | 181.2 |
| collector | 600 | 6.7% | 6.7% | 100.0% | 4.1 | 0.1 | 190.5 |
| opportunist | 600 | 2.2% | 2.2% | 100.0% | 4.4 | 0.1 | 185.6 |
| random | 600 | 2.0% | 2.0% | 100.0% | 4.5 | 0.1 | 176.1 |

################################################################