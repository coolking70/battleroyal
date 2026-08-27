# Simulation Regression Report

- 版本：0.5.0
- mode：formal
- 生成时间：2026-08-25T17:04:47.473Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：P4X-BASE

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

- encounters=44810, kills=11329, flees=35240, playerDeaths=356
- damageTaken=584714, groundDrops=18250, pickups=19905, wildCrafts=870
- eliteEncounters=2378, eliteKills=3, apexSpawned=1950, apexEncounters=38, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"tusked_boar":3188,"maintenance_bot":5152,"carrion_crow":3879,"rat_swarm":7573,"feral_dog":6814,"security_hound":2764,"patrol_drone":4753,"riot_control_unit":270,"venom_snake":3208,"resin_stalker":2001,"hunter_killer_drone":444,"armored_repair_bot":431,"escaped_subject":3062,"toxic_experiment":131,"scavenger_boar":589,"feral_alpha_hound":513,"iron_tusk":15,"subject_07":11,"prototype_aegis":12}
- encounterByZone: {"forest":4673,"construction":4676,"park":3418,"hospital":2852,"warehouse":3682,"residential":4110,"factory":4256,"underground":3090,"station":3822,"school":3155,"commercial":3615,"lab":3461}
- killsByType: {"rat_swarm":3016,"carrion_crow":1688,"patrol_drone":1143,"venom_snake":1592,"feral_dog":2250,"escaped_subject":315,"resin_stalker":105,"maintenance_bot":501,"tusked_boar":478,"security_hound":238,"hunter_killer_drone":1,"feral_alpha_hound":2}
- killsByZone: {"hospital":795,"residential":1587,"underground":689,"station":990,"construction":1059,"forest":1392,"lab":334,"factory":538,"warehouse":782,"school":1022,"park":1081,"commercial":1060}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 7.2% |
| 最低非零胜率 | 1.9% |
| 比值 | 3.86 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **FAIL** |

**整体判定：FAIL**（= 引擎健康 ✓ && 角色平衡 ✗ && Phase 3A 玩法 ✓）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 20163 | 4.5% | 2.0% | **PASS** |
| normal | 315153 | 70.9% | - | - |
| heavy | 109395 | 24.6% | 2.0% | **PASS** |
| 合计 | 444711 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 16768 | - | - |
| GUARD 使用率（占全部命令） | 10.2% | 2.0% | **PASS** |
| 防御成功减免次数 | 2935 | - | - |
| EXPOSED 施加（重击挥空） | 49226 | - | - |
| EXPOSED 兑现（破绽被击中） | 14691 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 3366 |
| prepare_ambush | 3030 |
| emergency_treatment | 2195 |
| scout_recon | 2189 |
| track_target | 2156 |
| escape_plan | 2085 |
| sort_rare | 2044 |
| camp_routine | 1958 |
| second_wind | 1885 |
| engineer_reinforce | 1759 |
| scout_smoke | 1600 |
| adrenaline | 1427 |
| steady_aim | 1064 |
| medic_regen | 1001 |
| fighter_focus | 925 |
| field_craft | 324 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 3183 | 50 | ✓ |
| rain | 3244 | 50 | ✓ |
| emergency_broadcast | 3380 | 50 | ✓ |
| medical_alert | 3331 | 50 | ✓ |
| research_anomaly | 3216 | 50 | ✓ |
| citywide_unrest | 3184 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 20163 | 15579 | 4584 | 77.3% | 76.5% | 0.81 | ✓ | 60759 | 3.9 |
| normal | 315153 | 214626 | 100527 | 68.1% | 67.5% | 0.64 | ✓ | 1230264 | 5.7 |
| heavy | 109395 | 60169 | 49226 | 55.0% | 53.9% | 1.06 | ✓ | 574881 | 9.6 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 16768 |
| 防御成功触发（减免伤害） | 2935 |
| 减免伤害总量 | 11453 |
| 平均每次减免 | 3.9 |
| 重击落空（Heavy Miss） | 49226 |
| EXPOSED 施加 | 49226 |
| EXPOSED 兑现（被击中） | 14691 |
| EXPOSED 未兑现失效 | 16422 |
| EXPOSED 兑现时额外伤害总量 | 11358 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 381 | 1808 | 遭遇先手次数：0 |
| 肾上腺素 | 260 | 1167 | 覆盖攻击 1807 · 额外伤害 1754 · 省体力 1807 · 自伤 117 |
| 现场加工 | 324 | 0 | 免费合成 12 · 省体力 12 |
| 应急处理 | 371 | 1824 | 即时治疗 4990 · 治疗品额外 226 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 3183 | 受影响搜索 7874 · 遭遇权重降低 7262 · 空手权重提高 7874 |
| 暴雨 | 3244 | 受影响移动 10216 · 额外体力 10216 · 远程攻击 21220 |
| 广播 | 3380 | 广播区域数：3377 |
| 医疗警报 | 3331 | 受影响治疗 51 · 额外治疗 237 |
| 研究异常 | 3216 | 伤害 tick 4873 · 总伤害 14556 · 致死 58 |
| 全域骚动 | 3184 | 阻止噪音衰减 44316 · 搜索噪音加成 3843 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 3169600 |
| memory evictions | 504807 (15.9%) |
| intent commit / preserve | 115025 / 817038 |
| intent reevaluate / complete / invalidate | 98478 / 66584 / 32469 |
| commit ratio per observed NPC intent turn | 12.3% |
| remembered source failures | 33548 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 160 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 12000 / 10765 |
| incident resolved / expired | 358 / 8110 |
| incident public broadcasts | 5253 |
| incident local discoveries | 90165 |
| incident responses | 511 |
| incident rewards claimed | 324 |
| incident contention failures | 0 |
| incident intent commits / preserves | 6226 / 7379 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 3000 |
| 可信对局率 | 100.0% |
| 胜率 | 3.8% |
| 败率 | 84.9% |
| 平局率 | 11.3% |
| 超时率 | 0.0% |
| 存活率 | 3.8% |
| 胜利路线 | {"last_survivor":2660,"none":339,"extraction":1} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 75.2 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 56.1 |
| 平均承受伤害 | 181.3 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 回收场巨獠攻击 | 5 |
| 失控维修机攻击 | 9 |
| 安保机器犬攻击 | 33 |
| 战斗 | 1701 |
| 树脂寄生兽攻击 | 13 |
| 毒性实验体攻击 | 9 |
| 毒蛇攻击 | 9 |
| 猎杀无人机攻击 | 22 |
| 獠牙野猪攻击 | 17 |
| 研究设施异常 | 13 |
| 禁区侵蚀 | 526 |
| 腐食乌鸦攻击 | 17 |
| 衰竭 | 278 |
| 装甲维修机攻击 | 1 |
| 巡逻无人机攻击 | 52 |
| 逃逸实验体攻击 | 61 |
| 野化猎犬攻击 | 57 |
| 野外毒伤 | 11 |
| 铁牙攻击 | 3 |
| 镇暴控制单元攻击 | 3 |
| 阿尔法猎犬攻击 | 11 |
| 鼠群攻击 | 34 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 75 | 0 | 59 | 16 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.2 | 73.3 |
| 侦察员 | cautious | 75 | 1 | 67 | 7 | 0 | 1.3% | 100.0% | 0 | 0 | 4.7 | 0.1 | 75.9 |
| 侦察员 | collector | 75 | 6 | 63 | 6 | 0 | 8.0% | 100.0% | 0 | 0 | 4.3 | 0.2 | 76.6 |
| 侦察员 | opportunist | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.8 | 0.0 | 72.0 |
| 侦察员 | random | 75 | 0 | 67 | 8 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 73.1 |
| 斗士 | aggressive | 75 | 3 | 67 | 5 | 0 | 4.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 72.5 |
| 斗士 | cautious | 75 | 3 | 63 | 9 | 0 | 4.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 74.3 |
| 斗士 | collector | 75 | 4 | 63 | 8 | 0 | 5.3% | 100.0% | 0 | 0 | 4.5 | 0.1 | 73.5 |
| 斗士 | opportunist | 75 | 0 | 68 | 7 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 73.3 |
| 斗士 | random | 75 | 1 | 64 | 10 | 0 | 1.3% | 100.0% | 0 | 0 | 4.9 | 0.1 | 73.5 |
| 工程师 | aggressive | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 74.9 |
| 工程师 | cautious | 75 | 8 | 60 | 7 | 0 | 10.7% | 100.0% | 0 | 0 | 3.9 | 0.1 | 77.3 |
| 工程师 | collector | 75 | 2 | 61 | 12 | 0 | 2.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 74.5 |
| 工程师 | opportunist | 75 | 0 | 69 | 6 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 76.5 |
| 工程师 | random | 75 | 3 | 66 | 6 | 0 | 4.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 73.3 |
| 医学生 | aggressive | 75 | 1 | 62 | 12 | 0 | 1.3% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.7 |
| 医学生 | cautious | 75 | 8 | 54 | 13 | 0 | 10.7% | 100.0% | 0 | 0 | 4.1 | 0.0 | 77.3 |
| 医学生 | collector | 75 | 5 | 59 | 11 | 0 | 6.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.5 |
| 医学生 | opportunist | 75 | 0 | 65 | 10 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 73.3 |
| 医学生 | random | 75 | 2 | 66 | 7 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 74.1 |
| 生存专家 | aggressive | 75 | 2 | 67 | 6 | 0 | 2.7% | 100.0% | 0 | 0 | 4.2 | 0.1 | 73.1 |
| 生存专家 | cautious | 75 | 9 | 54 | 12 | 0 | 12.0% | 100.0% | 0 | 0 | 3.8 | 0.1 | 79.7 |
| 生存专家 | collector | 75 | 5 | 60 | 10 | 0 | 6.7% | 100.0% | 0 | 0 | 3.9 | 0.1 | 75.9 |
| 生存专家 | opportunist | 75 | 2 | 63 | 10 | 0 | 2.7% | 100.0% | 0 | 0 | 4.5 | 0.0 | 73.7 |
| 生存专家 | random | 75 | 2 | 67 | 6 | 0 | 2.7% | 100.0% | 0 | 0 | 4.1 | 0.1 | 77.3 |
| 拾荒者 | aggressive | 75 | 2 | 65 | 8 | 0 | 2.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.8 |
| 拾荒者 | cautious | 75 | 2 | 63 | 10 | 0 | 2.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 73.7 |
| 拾荒者 | collector | 75 | 1 | 67 | 7 | 0 | 1.3% | 100.0% | 0 | 0 | 4.7 | 0.1 | 76.1 |
| 拾荒者 | opportunist | 75 | 3 | 65 | 7 | 0 | 4.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 72.2 |
| 拾荒者 | random | 75 | 2 | 66 | 7 | 0 | 2.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.0 |
| 猎人 | aggressive | 75 | 1 | 66 | 8 | 0 | 1.3% | 100.0% | 0 | 0 | 4.5 | 0.1 | 73.8 |
| 猎人 | cautious | 75 | 4 | 64 | 7 | 0 | 5.3% | 100.0% | 0 | 0 | 4.2 | 0.2 | 73.5 |
| 猎人 | collector | 75 | 1 | 70 | 4 | 0 | 1.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 74.5 |
| 猎人 | opportunist | 75 | 0 | 63 | 12 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 72.9 |
| 猎人 | random | 75 | 1 | 67 | 7 | 0 | 1.3% | 100.0% | 0 | 0 | 4.6 | 0.1 | 74.2 |
| 陷阱师 | aggressive | 75 | 1 | 71 | 3 | 0 | 1.3% | 100.0% | 0 | 0 | 3.6 | 0.1 | 79.9 |
| 陷阱师 | cautious | 75 | 10 | 58 | 7 | 0 | 13.3% | 100.0% | 0 | 0 | 3.2 | 0.1 | 80.7 |
| 陷阱师 | collector | 75 | 8 | 59 | 8 | 0 | 10.7% | 100.0% | 0 | 0 | 3.2 | 0.1 | 80.2 |
| 陷阱师 | opportunist | 75 | 4 | 57 | 14 | 0 | 5.3% | 100.0% | 0 | 0 | 3.8 | 0.1 | 77.7 |
| 陷阱师 | random | 75 | 4 | 61 | 10 | 0 | 5.3% | 100.0% | 0 | 0 | 3.7 | 0.1 | 78.6 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 375 | 2.4% | 2.4% | 100.0% | 4.5 | 0.1 | 169.7 |
| 斗士 | 375 | 2.9% | 2.9% | 100.0% | 4.6 | 0.1 | 181.6 |
| 工程师 | 375 | 4.0% | 4.0% | 100.0% | 4.4 | 0.1 | 171.8 |
| 医学生 | 375 | 4.3% | 4.3% | 100.0% | 4.5 | 0.0 | 233.4 |
| 生存专家 | 375 | 5.3% | 5.3% | 100.0% | 4.1 | 0.1 | 182.2 |
| 拾荒者 | 375 | 2.7% | 2.7% | 100.0% | 4.5 | 0.1 | 169.8 |
| 猎人 | 375 | 1.9% | 1.9% | 100.0% | 4.5 | 0.1 | 174.8 |
| 陷阱师 | 375 | 7.2% | 7.2% | 100.0% | 3.5 | 0.1 | 167.0 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 600 | 2.0% | 2.0% | 100.0% | 4.3 | 0.1 | 175.2 |
| cautious | 600 | 7.5% | 7.5% | 100.0% | 4.1 | 0.1 | 180.5 |
| collector | 600 | 5.3% | 5.3% | 100.0% | 4.2 | 0.1 | 188.8 |
| opportunist | 600 | 1.8% | 1.8% | 100.0% | 4.6 | 0.1 | 185.8 |
| random | 600 | 2.5% | 2.5% | 100.0% | 4.4 | 0.1 | 176.1 |

################################################################