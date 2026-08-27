# Simulation Regression Report

- 版本：0.5.0
- mode：formal
- 生成时间：2026-08-26T04:14:53.819Z
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

- encounters=45154, kills=12117, flees=33008, playerDeaths=271
- damageTaken=559442, groundDrops=19649, pickups=21539, wildCrafts=904
- eliteEncounters=2425, eliteKills=2, apexSpawned=2122, apexEncounters=57, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"venom_snake":3242,"hunter_killer_drone":453,"rat_swarm":7667,"maintenance_bot":5165,"escaped_subject":3160,"security_hound":2601,"feral_dog":7026,"patrol_drone":4578,"carrion_crow":3874,"tusked_boar":3362,"resin_stalker":1997,"scavenger_boar":633,"feral_alpha_hound":506,"armored_repair_bot":455,"riot_control_unit":245,"toxic_experiment":133,"subject_07":18,"iron_tusk":24,"prototype_aegis":15}
- encounterByZone: {"forest":4905,"construction":4876,"underground":3240,"factory":4102,"lab":3516,"residential":3958,"park":3470,"warehouse":3657,"commercial":3666,"station":3761,"hospital":2972,"school":3031}
- killsByType: {"venom_snake":1637,"escaped_subject":386,"feral_dog":2558,"tusked_boar":575,"patrol_drone":1226,"carrion_crow":1731,"rat_swarm":3183,"resin_stalker":106,"maintenance_bot":496,"security_hound":217,"hunter_killer_drone":1,"feral_alpha_hound":1}
- killsByZone: {"forest":1521,"lab":398,"residential":1614,"construction":1132,"hospital":841,"school":1095,"park":1198,"warehouse":861,"commercial":1175,"station":997,"factory":548,"underground":737}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 6.9% |
| 最低非零胜率 | 2.9% |
| 比值 | 2.36 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **PASS** |

**整体判定：PASS**（= 引擎健康 ✓ && 角色平衡 ✓ && Phase 3A 玩法 ✓）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 21514 | 4.6% | 2.0% | **PASS** |
| normal | 333108 | 70.9% | - | - |
| heavy | 115201 | 24.5% | 2.0% | **PASS** |
| 合计 | 469823 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 17363 | - | - |
| GUARD 使用率（占全部命令） | 10.0% | 2.0% | **PASS** |
| 防御成功减免次数 | 3151 | - | - |
| EXPOSED 施加（重击挥空） | 51580 | - | - |
| EXPOSED 兑现（破绽被击中） | 15324 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 3524 |
| prepare_ambush | 2830 |
| scout_recon | 2242 |
| sort_rare | 2197 |
| track_target | 2197 |
| escape_plan | 2024 |
| emergency_treatment | 2023 |
| camp_routine | 2012 |
| second_wind | 1954 |
| engineer_reinforce | 1934 |
| scout_smoke | 1830 |
| adrenaline | 1493 |
| steady_aim | 1198 |
| medic_regen | 1116 |
| fighter_focus | 1030 |
| field_craft | 354 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 3309 | 50 | ✓ |
| rain | 3305 | 50 | ✓ |
| emergency_broadcast | 3288 | 50 | ✓ |
| medical_alert | 3297 | 50 | ✓ |
| research_anomaly | 3396 | 50 | ✓ |
| citywide_unrest | 3372 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 21514 | 16694 | 4820 | 77.6% | 77.1% | 0.51 | ✓ | 63296 | 3.8 |
| normal | 333108 | 228344 | 104764 | 68.5% | 68.0% | 0.55 | ✓ | 1260465 | 5.5 |
| heavy | 115201 | 63621 | 51580 | 55.2% | 54.4% | 0.80 | ✓ | 584795 | 9.2 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 17363 |
| 防御成功触发（减免伤害） | 3151 |
| 减免伤害总量 | 11629 |
| 平均每次减免 | 3.7 |
| 重击落空（Heavy Miss） | 51580 |
| EXPOSED 施加 | 51580 |
| EXPOSED 兑现（被击中） | 15324 |
| EXPOSED 未兑现失效 | 17406 |
| EXPOSED 兑现时额外伤害总量 | 11607 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 387 | 1855 | 遭遇先手次数：0 |
| 肾上腺素 | 288 | 1205 | 覆盖攻击 1960 · 额外伤害 1961 · 省体力 1960 · 自伤 130 |
| 现场加工 | 354 | 0 | 免费合成 18 · 省体力 18 |
| 应急处理 | 381 | 1642 | 即时治疗 5066 · 治疗品额外 252 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 3309 | 受影响搜索 7916 · 遭遇权重降低 7194 · 空手权重提高 7916 |
| 暴雨 | 3305 | 受影响移动 10342 · 额外体力 10342 · 远程攻击 22516 |
| 广播 | 3288 | 广播区域数：3288 |
| 医疗警报 | 3297 | 受影响治疗 40 · 额外治疗 228 |
| 研究异常 | 3396 | 伤害 tick 4984 · 总伤害 14902 · 致死 59 |
| 全域骚动 | 3372 | 阻止噪音衰减 47805 · 搜索噪音加成 4160 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 3344314 |
| memory evictions | 524562 (15.7%) |
| intent commit / preserve | 120326 / 843629 |
| intent reevaluate / complete / invalidate | 101194 / 70122 / 34207 |
| commit ratio per observed NPC intent turn | 12.5% |
| remembered source failures | 34018 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 193 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 12000 / 10948 |
| incident resolved / expired | 345 / 8459 |
| incident public broadcasts | 5320 |
| incident local discoveries | 96389 |
| incident responses | 478 |
| incident rewards claimed | 283 |
| incident contention failures | 0 |
| incident intent commits / preserves | 6351 / 7340 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 3000 |
| 可信对局率 | 100.0% |
| 胜率 | 4.1% |
| 败率 | 85.1% |
| 平局率 | 10.9% |
| 超时率 | 0.0% |
| 存活率 | 4.1% |
| 胜利路线 | {"last_survivor":2674,"none":326} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 77.1 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 59.0 |
| 平均承受伤害 | 181.7 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 命名实验体 07攻击 | 2 |
| 回收场巨獠攻击 | 5 |
| 失控维修机攻击 | 14 |
| 安保机器犬攻击 | 27 |
| 战斗 | 1665 |
| 树脂寄生兽攻击 | 8 |
| 毒性实验体攻击 | 7 |
| 毒蛇攻击 | 7 |
| 猎杀无人机攻击 | 19 |
| 獠牙野猪攻击 | 13 |
| 研究设施异常 | 13 |
| 禁区侵蚀 | 641 |
| 腐食乌鸦攻击 | 7 |
| 衰竭 | 279 |
| 装甲维修机攻击 | 2 |
| 巡逻无人机攻击 | 29 |
| 逃逸实验体攻击 | 53 |
| 野化猎犬攻击 | 40 |
| 野外毒伤 | 9 |
| 铁牙攻击 | 5 |
| 阿尔法猎犬攻击 | 7 |
| 鼠群攻击 | 26 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 75 | 4 | 63 | 8 | 0 | 5.3% | 100.0% | 0 | 0 | 4.3 | 0.1 | 75.5 |
| 侦察员 | cautious | 75 | 7 | 59 | 9 | 0 | 9.3% | 100.0% | 0 | 0 | 4.0 | 0.1 | 80.0 |
| 侦察员 | collector | 75 | 8 | 59 | 8 | 0 | 10.7% | 100.0% | 0 | 0 | 3.9 | 0.1 | 77.3 |
| 侦察员 | opportunist | 75 | 4 | 66 | 5 | 0 | 5.3% | 100.0% | 0 | 0 | 4.3 | 0.1 | 75.0 |
| 侦察员 | random | 75 | 3 | 64 | 8 | 0 | 4.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 76.2 |
| 斗士 | aggressive | 75 | 3 | 65 | 7 | 0 | 4.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 73.7 |
| 斗士 | cautious | 75 | 1 | 67 | 7 | 0 | 1.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 78.8 |
| 斗士 | collector | 75 | 3 | 63 | 9 | 0 | 4.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 76.7 |
| 斗士 | opportunist | 75 | 2 | 63 | 10 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.1 | 74.1 |
| 斗士 | random | 75 | 2 | 66 | 7 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 74.9 |
| 工程师 | aggressive | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 77.7 |
| 工程师 | cautious | 75 | 4 | 67 | 4 | 0 | 5.3% | 100.0% | 0 | 0 | 4.3 | 0.1 | 77.3 |
| 工程师 | collector | 75 | 6 | 63 | 6 | 0 | 8.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 77.2 |
| 工程师 | opportunist | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.9 | 0.1 | 77.1 |
| 工程师 | random | 75 | 0 | 68 | 7 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 75.1 |
| 医学生 | aggressive | 75 | 0 | 71 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 79.5 |
| 医学生 | cautious | 75 | 4 | 64 | 7 | 0 | 5.3% | 100.0% | 0 | 0 | 4.0 | 0.0 | 79.6 |
| 医学生 | collector | 75 | 7 | 60 | 8 | 0 | 9.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 77.2 |
| 医学生 | opportunist | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 77.8 |
| 医学生 | random | 75 | 2 | 63 | 10 | 0 | 2.7% | 100.0% | 0 | 0 | 4.5 | 0.0 | 76.3 |
| 生存专家 | aggressive | 75 | 1 | 67 | 7 | 0 | 1.3% | 100.0% | 0 | 0 | 4.3 | 0.1 | 78.9 |
| 生存专家 | cautious | 75 | 6 | 57 | 12 | 0 | 8.0% | 100.0% | 0 | 0 | 4.1 | 0.0 | 79.3 |
| 生存专家 | collector | 75 | 3 | 64 | 8 | 0 | 4.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 76.8 |
| 生存专家 | opportunist | 75 | 3 | 66 | 6 | 0 | 4.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 81.1 |
| 生存专家 | random | 75 | 0 | 65 | 10 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.7 |
| 拾荒者 | aggressive | 75 | 3 | 63 | 9 | 0 | 4.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.5 |
| 拾荒者 | cautious | 75 | 3 | 60 | 12 | 0 | 4.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 74.3 |
| 拾荒者 | collector | 75 | 3 | 61 | 11 | 0 | 4.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 77.6 |
| 拾荒者 | opportunist | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.1 | 76.9 |
| 拾荒者 | random | 75 | 1 | 69 | 5 | 0 | 1.3% | 100.0% | 0 | 0 | 4.9 | 0.0 | 77.6 |
| 猎人 | aggressive | 75 | 2 | 66 | 7 | 0 | 2.7% | 100.0% | 0 | 0 | 4.1 | 0.1 | 76.1 |
| 猎人 | cautious | 75 | 4 | 59 | 12 | 0 | 5.3% | 100.0% | 0 | 0 | 4.1 | 0.1 | 79.5 |
| 猎人 | collector | 75 | 3 | 62 | 10 | 0 | 4.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 78.1 |
| 猎人 | opportunist | 75 | 2 | 62 | 11 | 0 | 2.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.3 |
| 猎人 | random | 75 | 1 | 65 | 9 | 0 | 1.3% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.6 |
| 陷阱师 | aggressive | 75 | 4 | 64 | 7 | 0 | 5.3% | 100.0% | 0 | 0 | 4.3 | 0.0 | 76.5 |
| 陷阱师 | cautious | 75 | 7 | 59 | 9 | 0 | 9.3% | 100.0% | 0 | 0 | 3.9 | 0.0 | 77.9 |
| 陷阱师 | collector | 75 | 4 | 65 | 6 | 0 | 5.3% | 100.0% | 0 | 0 | 4.3 | 0.0 | 78.9 |
| 陷阱师 | opportunist | 75 | 3 | 62 | 10 | 0 | 4.0% | 100.0% | 0 | 0 | 4.1 | 0.0 | 76.1 |
| 陷阱师 | random | 75 | 1 | 65 | 9 | 0 | 1.3% | 100.0% | 0 | 0 | 4.1 | 0.0 | 76.7 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 375 | 6.9% | 6.9% | 100.0% | 4.2 | 0.1 | 181.3 |
| 斗士 | 375 | 2.9% | 2.9% | 100.0% | 4.5 | 0.1 | 180.7 |
| 工程师 | 375 | 3.7% | 3.7% | 100.0% | 4.4 | 0.1 | 170.4 |
| 医学生 | 375 | 4.0% | 4.0% | 100.0% | 4.4 | 0.0 | 232.9 |
| 生存专家 | 375 | 3.5% | 3.5% | 100.0% | 4.3 | 0.1 | 176.7 |
| 拾荒者 | 375 | 3.2% | 3.2% | 100.0% | 4.4 | 0.1 | 173.0 |
| 猎人 | 375 | 3.2% | 3.2% | 100.0% | 4.3 | 0.1 | 168.5 |
| 陷阱师 | 375 | 5.1% | 5.1% | 100.0% | 4.1 | 0.0 | 169.9 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 600 | 3.2% | 3.2% | 100.0% | 4.4 | 0.1 | 178.2 |
| cautious | 600 | 6.0% | 6.0% | 100.0% | 4.1 | 0.1 | 179.9 |
| collector | 600 | 6.2% | 6.2% | 100.0% | 4.2 | 0.1 | 189.3 |
| opportunist | 600 | 3.3% | 3.3% | 100.0% | 4.5 | 0.1 | 184.1 |
| random | 600 | 1.7% | 1.7% | 100.0% | 4.5 | 0.0 | 176.9 |

################################################################