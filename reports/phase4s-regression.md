# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-14T20:15:54.195Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4S

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

- encounters=7435, kills=1864, flees=5867, playerDeaths=42
- damageTaken=94689, groundDrops=2998, pickups=3264, wildCrafts=122
- eliteEncounters=383, eliteKills=0, apexSpawned=318, apexEncounters=7, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"maintenance_bot":870,"feral_dog":1053,"resin_stalker":338,"tusked_boar":623,"rat_swarm":1208,"escaped_subject":550,"carrion_crow":651,"security_hound":386,"patrol_drone":824,"hunter_killer_drone":70,"armored_repair_bot":80,"venom_snake":542,"scavenger_boar":100,"feral_alpha_hound":81,"riot_control_unit":35,"subject_07":4,"toxic_experiment":17,"prototype_aegis":2,"iron_tusk":1}
- encounterByZone: {"warehouse":616,"school":495,"commercial":515,"underground":586,"park":672,"lab":561,"residential":662,"forest":780,"station":621,"factory":654,"construction":834,"hospital":439}
- killsByType: {"feral_dog":365,"tusked_boar":90,"patrol_drone":200,"carrion_crow":272,"venom_snake":288,"maintenance_bot":90,"rat_swarm":469,"resin_stalker":10,"security_hound":31,"escaped_subject":49}
- killsByZone: {"school":183,"commercial":171,"park":207,"station":149,"forest":232,"warehouse":130,"residential":239,"construction":200,"lab":52,"factory":84,"hospital":112,"underground":105}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 6.7% |
| 最低非零胜率 | 1.5% |
| 比值 | 4.33 |
| 阈值 | 2.5 |
| 0 胜率角色 | engineer |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3344 | 4.6% | 2.0% | **PASS** |
| normal | 51279 | 70.3% | - | - |
| heavy | 18295 | 25.1% | 2.0% | **PASS** |
| 合计 | 72918 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2873 | - | - |
| GUARD 使用率（占全部命令） | 10.6% | 2.0% | **PASS** |
| 防御成功减免次数 | 506 | - | - |
| EXPOSED 施加（重击挥空） | 8275 | - | - |
| EXPOSED 兑现（破绽被击中） | 2443 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| prepare_ambush | 542 |
| scavenge_focus | 503 |
| track_target | 414 |
| escape_plan | 377 |
| emergency_treatment | 355 |
| scout_recon | 341 |
| sort_rare | 296 |
| camp_routine | 283 |
| engineer_reinforce | 278 |
| second_wind | 270 |
| adrenaline | 254 |
| scout_smoke | 250 |
| steady_aim | 208 |
| fighter_focus | 167 |
| medic_regen | 165 |
| field_craft | 56 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 532 | 50 | ✓ |
| rain | 527 | 50 | ✓ |
| emergency_broadcast | 501 | 50 | ✓ |
| medical_alert | 552 | 50 | ✓ |
| research_anomaly | 529 | 50 | ✓ |
| citywide_unrest | 551 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3344 | 2609 | 735 | 78.0% | 76.3% | 1.69 | ✓ | 10135 | 3.9 |
| normal | 51279 | 34927 | 16352 | 68.1% | 67.6% | 0.54 | ✓ | 201702 | 5.8 |
| heavy | 18295 | 10020 | 8275 | 54.8% | 54.1% | 0.71 | ✓ | 101036 | 10.1 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2873 |
| 防御成功触发（减免伤害） | 506 |
| 减免伤害总量 | 2017 |
| 平均每次减免 | 4.0 |
| 重击落空（Heavy Miss） | 8275 |
| EXPOSED 施加 | 8275 |
| EXPOSED 兑现（被击中） | 2443 |
| EXPOSED 未兑现失效 | 2720 |
| EXPOSED 兑现时额外伤害总量 | 2041 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 66 | 275 | 遭遇先手次数：0 |
| 肾上腺素 | 42 | 212 | 覆盖攻击 327 · 额外伤害 318 · 省体力 327 · 自伤 18 |
| 现场加工 | 56 | 0 | 免费合成 3 · 省体力 3 |
| 应急处理 | 64 | 291 | 即时治疗 846 · 治疗品额外 11 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 532 | 受影响搜索 1436 · 遭遇权重降低 1303 · 空手权重提高 1436 |
| 暴雨 | 527 | 受影响移动 1688 · 额外体力 1688 · 远程攻击 3571 |
| 广播 | 501 | 广播区域数：500 |
| 医疗警报 | 552 | 受影响治疗 7 · 额外治疗 26 |
| 研究异常 | 529 | 伤害 tick 794 · 总伤害 2375 · 致死 10 |
| 全域骚动 | 551 | 阻止噪音衰减 7543 · 搜索噪音加成 641 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 495849 |
| memory evictions | 77088 (15.5%) |
| intent commit / preserve | 18763 / 133804 |
| intent reevaluate / complete / invalidate | 15845 / 9737 / 6526 |
| commit ratio per observed NPC intent turn | 12.3% |
| remembered source failures | 5552 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 27 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 3.4% |
| 败率 | 87.2% |
| 平局率 | 9.4% |
| 超时率 | 0.0% |
| 存活率 | 3.4% |
| 胜利路线 | {"last_survivor":453,"none":47} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 74.1 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 54.1 |
| 平均承受伤害 | 178.3 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 回收场巨獠攻击 | 2 |
| 安保机器犬攻击 | 4 |
| 战斗 | 295 |
| 树脂寄生兽攻击 | 1 |
| 毒蛇攻击 | 3 |
| 猎杀无人机攻击 | 2 |
| 獠牙野猪攻击 | 2 |
| 禁区侵蚀 | 84 |
| 腐食乌鸦攻击 | 2 |
| 衰竭 | 59 |
| 巡逻无人机攻击 | 4 |
| 逃逸实验体攻击 | 8 |
| 野化猎犬攻击 | 9 |
| 野外毒伤 | 3 |
| 阿尔法猎犬攻击 | 1 |
| 鼠群攻击 | 4 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 68.7 |
| 侦察员 | cautious | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 5.0 | 0.0 | 76.2 |
| 侦察员 | collector | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 3.7 | 0.2 | 79.0 |
| 侦察员 | opportunist | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 69.9 |
| 侦察员 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 69.8 |
| 斗士 | aggressive | 13 | 2 | 8 | 3 | 0 | 15.4% | 100.0% | 0 | 0 | 4.2 | 0.0 | 72.2 |
| 斗士 | cautious | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 74.5 |
| 斗士 | collector | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 65.8 |
| 斗士 | opportunist | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 73.5 |
| 斗士 | random | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.1 | 74.0 |
| 工程师 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.0 | 76.1 |
| 工程师 | cautious | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 72.8 |
| 工程师 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.2 | 71.8 |
| 工程师 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 69.7 |
| 工程师 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 69.8 |
| 医学生 | aggressive | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 79.8 |
| 医学生 | cautious | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 3.6 | 0.0 | 72.7 |
| 医学生 | collector | 13 | 1 | 9 | 3 | 0 | 7.7% | 100.0% | 0 | 0 | 3.9 | 0.2 | 70.4 |
| 医学生 | opportunist | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 74.8 |
| 医学生 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 77.1 |
| 生存专家 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.3 | 78.0 |
| 生存专家 | cautious | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.3 | 72.7 |
| 生存专家 | collector | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 3.6 | 0.1 | 73.7 |
| 生存专家 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.1 | 73.0 |
| 生存专家 | random | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 72.6 |
| 拾荒者 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.0 | 73.8 |
| 拾荒者 | cautious | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.1 | 0.2 | 78.9 |
| 拾荒者 | collector | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.3 | 0.0 | 81.8 |
| 拾荒者 | opportunist | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.8 | 0.2 | 78.8 |
| 拾荒者 | random | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 67.8 |
| 猎人 | aggressive | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.9 | 0.1 | 79.5 |
| 猎人 | cautious | 12 | 0 | 8 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 3.7 | 0.1 | 76.0 |
| 猎人 | collector | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 3.5 | 0.3 | 76.2 |
| 猎人 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.1 | 73.7 |
| 猎人 | random | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.1 | 68.2 |
| 陷阱师 | aggressive | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.5 | 0.0 | 78.3 |
| 陷阱师 | cautious | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.0 | 76.0 |
| 陷阱师 | collector | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 3.0 | 0.3 | 81.6 |
| 陷阱师 | opportunist | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 70.6 |
| 陷阱师 | random | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.9 | 0.0 | 75.0 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 3.1% | 3.1% | 100.0% | 4.5 | 0.1 | 168.2 |
| 斗士 | 65 | 4.6% | 4.6% | 100.0% | 4.5 | 0.1 | 180.9 |
| 工程师 | 65 | 0.0% | 0.0% | 100.0% | 4.5 | 0.1 | 172.2 |
| 医学生 | 65 | 1.5% | 1.5% | 100.0% | 4.3 | 0.1 | 225.7 |
| 生存专家 | 60 | 3.3% | 3.3% | 100.0% | 4.0 | 0.1 | 174.8 |
| 拾荒者 | 60 | 3.3% | 3.3% | 100.0% | 4.8 | 0.1 | 165.5 |
| 猎人 | 60 | 5.0% | 5.0% | 100.0% | 4.2 | 0.1 | 166.4 |
| 陷阱师 | 60 | 6.7% | 6.7% | 100.0% | 3.7 | 0.1 | 170.1 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 4.0% | 4.0% | 100.0% | 4.4 | 0.1 | 171.7 |
| cautious | 100 | 2.0% | 2.0% | 100.0% | 4.1 | 0.1 | 178.5 |
| collector | 100 | 9.0% | 9.0% | 100.0% | 4.1 | 0.2 | 190.7 |
| opportunist | 100 | 1.0% | 1.0% | 100.0% | 4.3 | 0.1 | 177.5 |
| random | 100 | 1.0% | 1.0% | 100.0% | 4.6 | 0.1 | 173.3 |

################################################################