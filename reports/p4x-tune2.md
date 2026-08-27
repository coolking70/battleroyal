# Simulation Regression Report

- 版本：0.5.0
- mode：formal
- 生成时间：2026-08-25T17:35:44.588Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：P4X-TUNE2

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

- encounters=45129, kills=11842, flees=33743, playerDeaths=274
- damageTaken=557342, groundDrops=19097, pickups=20943, wildCrafts=864
- eliteEncounters=2459, eliteKills=3, apexSpawned=2043, apexEncounters=63, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"patrol_drone":4764,"maintenance_bot":5345,"armored_repair_bot":466,"resin_stalker":2047,"carrion_crow":3861,"feral_dog":6719,"rat_swarm":7636,"tusked_boar":3204,"security_hound":2760,"escaped_subject":2957,"venom_snake":3314,"scavenger_boar":612,"riot_control_unit":297,"hunter_killer_drone":430,"feral_alpha_hound":513,"toxic_experiment":141,"iron_tusk":19,"subject_07":27,"prototype_aegis":17}
- encounterByZone: {"commercial":3526,"construction":4793,"underground":3191,"school":3175,"factory":4215,"residential":4007,"hospital":2907,"forest":4621,"lab":3447,"warehouse":3752,"park":3552,"station":3943}
- killsByType: {"carrion_crow":1714,"tusked_boar":541,"rat_swarm":3152,"patrol_drone":1207,"escaped_subject":329,"venom_snake":1648,"security_hound":211,"feral_dog":2429,"maintenance_bot":513,"resin_stalker":95,"feral_alpha_hound":3}
- killsByZone: {"school":1142,"forest":1452,"hospital":825,"residential":1573,"construction":1124,"underground":719,"factory":554,"station":998,"park":1198,"commercial":1045,"warehouse":832,"lab":380}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 6.9% |
| 最低非零胜率 | 2.1% |
| 比值 | 3.25 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **FAIL** |

**整体判定：FAIL**（= 引擎健康 ✓ && 角色平衡 ✗ && Phase 3A 玩法 ✓）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 20612 | 4.4% | 2.0% | **PASS** |
| normal | 329644 | 71.0% | - | - |
| heavy | 114016 | 24.6% | 2.0% | **PASS** |
| 合计 | 464272 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 17669 | - | - |
| GUARD 使用率（占全部命令） | 10.2% | 2.0% | **PASS** |
| 防御成功减免次数 | 3188 | - | - |
| EXPOSED 施加（重击挥空） | 51006 | - | - |
| EXPOSED 兑现（破绽被击中） | 15439 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 3554 |
| prepare_ambush | 2955 |
| sort_rare | 2220 |
| emergency_treatment | 2198 |
| track_target | 2163 |
| scout_recon | 2120 |
| escape_plan | 2062 |
| engineer_reinforce | 1987 |
| camp_routine | 1940 |
| second_wind | 1908 |
| scout_smoke | 1739 |
| adrenaline | 1503 |
| steady_aim | 1147 |
| fighter_focus | 1079 |
| medic_regen | 1019 |
| field_craft | 330 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 3268 | 50 | ✓ |
| rain | 3282 | 50 | ✓ |
| emergency_broadcast | 3355 | 50 | ✓ |
| medical_alert | 3336 | 50 | ✓ |
| research_anomaly | 3295 | 50 | ✓ |
| citywide_unrest | 3268 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 20612 | 16067 | 4545 | 77.9% | 77.3% | 0.65 | ✓ | 62014 | 3.9 |
| normal | 329644 | 226232 | 103412 | 68.6% | 68.0% | 0.62 | ✓ | 1254627 | 5.5 |
| heavy | 114016 | 63010 | 51006 | 55.3% | 54.4% | 0.88 | ✓ | 583461 | 9.3 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 17669 |
| 防御成功触发（减免伤害） | 3188 |
| 减免伤害总量 | 11721 |
| 平均每次减免 | 3.7 |
| 重击落空（Heavy Miss） | 51006 |
| EXPOSED 施加 | 51006 |
| EXPOSED 兑现（被击中） | 15439 |
| EXPOSED 未兑现失效 | 17257 |
| EXPOSED 兑现时额外伤害总量 | 11649 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 383 | 1737 | 遭遇先手次数：1 |
| 肾上腺素 | 282 | 1221 | 覆盖攻击 1985 · 额外伤害 2099 · 省体力 1985 · 自伤 117 |
| 现场加工 | 330 | 0 | 免费合成 17 · 省体力 17 |
| 应急处理 | 366 | 1832 | 即时治疗 4862 · 治疗品额外 298 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 3268 | 受影响搜索 7822 · 遭遇权重降低 7188 · 空手权重提高 7822 |
| 暴雨 | 3282 | 受影响移动 10465 · 额外体力 10465 · 远程攻击 22736 |
| 广播 | 3355 | 广播区域数：3352 |
| 医疗警报 | 3336 | 受影响治疗 41 · 额外治疗 245 |
| 研究异常 | 3295 | 伤害 tick 4957 · 总伤害 14807 · 致死 64 |
| 全域骚动 | 3268 | 阻止噪音衰减 46301 · 搜索噪音加成 4227 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 3294298 |
| memory evictions | 516691 (15.7%) |
| intent commit / preserve | 119157 / 834658 |
| intent reevaluate / complete / invalidate | 100016 / 69117 / 34077 |
| commit ratio per observed NPC intent turn | 12.5% |
| remembered source failures | 33572 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 175 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 12000 / 10870 |
| incident resolved / expired | 307 / 8319 |
| incident public broadcasts | 5252 |
| incident local discoveries | 93582 |
| incident responses | 435 |
| incident rewards claimed | 253 |
| incident contention failures | 0 |
| incident intent commits / preserves | 6139 / 6981 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 3000 |
| 可信对局率 | 100.0% |
| 胜率 | 3.8% |
| 败率 | 85.1% |
| 平局率 | 11.2% |
| 超时率 | 0.0% |
| 存活率 | 3.8% |
| 胜利路线 | {"last_survivor":2663,"none":335,"extraction":2} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 76.5 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 57.7 |
| 平均承受伤害 | 181.2 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 原型 Aegis攻击 | 1 |
| 回收场巨獠攻击 | 6 |
| 失控维修机攻击 | 9 |
| 安保机器犬攻击 | 25 |
| 战斗 | 1696 |
| 树脂寄生兽攻击 | 8 |
| 毒性实验体攻击 | 8 |
| 毒蛇攻击 | 5 |
| 猎杀无人机攻击 | 14 |
| 獠牙野猪攻击 | 18 |
| 研究设施异常 | 13 |
| 禁区侵蚀 | 595 |
| 腐食乌鸦攻击 | 17 |
| 衰竭 | 297 |
| 装甲维修机攻击 | 3 |
| 巡逻无人机攻击 | 30 |
| 逃逸实验体攻击 | 55 |
| 野化猎犬攻击 | 37 |
| 野外毒伤 | 12 |
| 铁牙攻击 | 3 |
| 阿尔法猎犬攻击 | 17 |
| 鼠群攻击 | 18 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 75 | 2 | 64 | 9 | 0 | 2.7% | 100.0% | 0 | 0 | 4.1 | 0.1 | 76.2 |
| 侦察员 | cautious | 75 | 2 | 66 | 7 | 0 | 2.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 75.2 |
| 侦察员 | collector | 75 | 7 | 62 | 6 | 0 | 9.3% | 100.0% | 0 | 0 | 4.0 | 0.2 | 76.2 |
| 侦察员 | opportunist | 75 | 3 | 63 | 9 | 0 | 4.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 71.6 |
| 侦察员 | random | 75 | 1 | 62 | 12 | 0 | 1.3% | 100.0% | 0 | 0 | 4.6 | 0.1 | 73.7 |
| 斗士 | aggressive | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.9 |
| 斗士 | cautious | 75 | 4 | 62 | 9 | 0 | 5.3% | 100.0% | 0 | 0 | 4.5 | 0.0 | 74.2 |
| 斗士 | collector | 75 | 3 | 70 | 2 | 0 | 4.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 76.3 |
| 斗士 | opportunist | 75 | 2 | 64 | 9 | 0 | 2.7% | 100.0% | 0 | 0 | 4.8 | 0.1 | 75.0 |
| 斗士 | random | 75 | 0 | 70 | 5 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 73.0 |
| 工程师 | aggressive | 75 | 3 | 63 | 9 | 0 | 4.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 77.3 |
| 工程师 | cautious | 75 | 3 | 65 | 7 | 0 | 4.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 77.4 |
| 工程师 | collector | 75 | 0 | 65 | 10 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 78.2 |
| 工程师 | opportunist | 75 | 1 | 67 | 7 | 0 | 1.3% | 100.0% | 0 | 0 | 4.5 | 0.0 | 76.4 |
| 工程师 | random | 75 | 1 | 66 | 8 | 0 | 1.3% | 100.0% | 0 | 0 | 4.2 | 0.0 | 77.5 |
| 医学生 | aggressive | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 78.0 |
| 医学生 | cautious | 75 | 4 | 62 | 9 | 0 | 5.3% | 100.0% | 0 | 0 | 4.7 | 0.0 | 77.2 |
| 医学生 | collector | 75 | 2 | 62 | 11 | 0 | 2.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 75.1 |
| 医学生 | opportunist | 75 | 4 | 66 | 5 | 0 | 5.3% | 100.0% | 0 | 0 | 4.8 | 0.0 | 75.2 |
| 医学生 | random | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.7 | 0.0 | 77.9 |
| 生存专家 | aggressive | 75 | 3 | 67 | 5 | 0 | 4.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 76.3 |
| 生存专家 | cautious | 75 | 3 | 61 | 11 | 0 | 4.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 79.3 |
| 生存专家 | collector | 75 | 4 | 66 | 5 | 0 | 5.3% | 100.0% | 0 | 0 | 4.1 | 0.0 | 76.6 |
| 生存专家 | opportunist | 75 | 3 | 66 | 6 | 0 | 4.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 75.1 |
| 生存专家 | random | 75 | 2 | 68 | 5 | 0 | 2.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 77.1 |
| 拾荒者 | aggressive | 75 | 0 | 65 | 10 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 77.3 |
| 拾荒者 | cautious | 75 | 1 | 64 | 10 | 0 | 1.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 77.3 |
| 拾荒者 | collector | 75 | 4 | 60 | 11 | 0 | 5.3% | 100.0% | 0 | 0 | 4.2 | 0.1 | 78.6 |
| 拾荒者 | opportunist | 75 | 3 | 61 | 11 | 0 | 4.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 75.9 |
| 拾荒者 | random | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.1 | 76.5 |
| 猎人 | aggressive | 75 | 3 | 61 | 11 | 0 | 4.0% | 100.0% | 0 | 0 | 4.1 | 0.0 | 76.1 |
| 猎人 | cautious | 75 | 3 | 64 | 8 | 0 | 4.0% | 100.0% | 0 | 0 | 4.0 | 0.2 | 76.6 |
| 猎人 | collector | 75 | 3 | 60 | 12 | 0 | 4.0% | 100.0% | 0 | 0 | 3.6 | 0.2 | 79.7 |
| 猎人 | opportunist | 75 | 3 | 64 | 8 | 0 | 4.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 74.3 |
| 猎人 | random | 75 | 2 | 66 | 7 | 0 | 2.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 75.1 |
| 陷阱师 | aggressive | 75 | 3 | 60 | 12 | 0 | 4.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 77.3 |
| 陷阱师 | cautious | 75 | 9 | 52 | 14 | 0 | 12.0% | 100.0% | 0 | 0 | 3.5 | 0.1 | 79.2 |
| 陷阱师 | collector | 75 | 8 | 60 | 7 | 0 | 10.7% | 100.0% | 0 | 0 | 3.7 | 0.1 | 77.7 |
| 陷阱师 | opportunist | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.3 | 0.0 | 78.5 |
| 陷阱师 | random | 75 | 4 | 63 | 8 | 0 | 5.3% | 100.0% | 0 | 0 | 4.1 | 0.1 | 78.5 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 375 | 4.0% | 4.0% | 100.0% | 4.3 | 0.1 | 176.3 |
| 斗士 | 375 | 2.9% | 2.9% | 100.0% | 4.6 | 0.1 | 178.5 |
| 工程师 | 375 | 2.1% | 2.1% | 100.0% | 4.2 | 0.1 | 172.1 |
| 医学生 | 375 | 3.7% | 3.7% | 100.0% | 4.6 | 0.0 | 232.7 |
| 生存专家 | 375 | 4.0% | 4.0% | 100.0% | 4.2 | 0.0 | 176.8 |
| 拾荒者 | 375 | 2.7% | 2.7% | 100.0% | 4.4 | 0.1 | 172.0 |
| 猎人 | 375 | 3.7% | 3.7% | 100.0% | 4.1 | 0.1 | 172.2 |
| 陷阱师 | 375 | 6.9% | 6.9% | 100.0% | 4.0 | 0.1 | 169.3 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 600 | 3.0% | 3.0% | 100.0% | 4.4 | 0.1 | 175.2 |
| cautious | 600 | 4.8% | 4.8% | 100.0% | 4.2 | 0.1 | 180.3 |
| collector | 600 | 5.2% | 5.2% | 100.0% | 4.1 | 0.1 | 190.2 |
| opportunist | 600 | 3.5% | 3.5% | 100.0% | 4.5 | 0.0 | 183.5 |
| random | 600 | 2.3% | 2.3% | 100.0% | 4.5 | 0.1 | 177.1 |

################################################################