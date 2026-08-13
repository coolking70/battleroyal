# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-13T14:27:43.608Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4P-AF2

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

- encounters=7692, kills=1820, flees=6327, playerDeaths=55
- damageTaken=93151, groundDrops=2934, pickups=3289, wildCrafts=143
- eliteEncounters=130, eliteKills=0, apexSpawned=346, apexEncounters=8, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"feral_dog":1338,"maintenance_bot":890,"rat_swarm":1366,"venom_snake":580,"carrion_crow":759,"patrol_drone":764,"resin_stalker":357,"security_hound":474,"tusked_boar":463,"escaped_subject":563,"riot_control_unit":21,"hunter_killer_drone":16,"feral_alpha_hound":36,"toxic_experiment":16,"scavenger_boar":28,"armored_repair_bot":13,"prototype_aegis":3,"iron_tusk":4,"subject_07":1}
- encounterByZone: {"commercial":647,"school":625,"factory":746,"station":649,"construction":621,"forest":721,"residential":725,"lab":666,"hospital":444,"underground":605,"park":594,"warehouse":649}
- killsByType: {"feral_dog":410,"rat_swarm":551,"venom_snake":219,"carrion_crow":306,"security_hound":30,"patrol_drone":148,"maintenance_bot":65,"escaped_subject":42,"tusked_boar":42,"resin_stalker":7}
- killsByZone: {"school":222,"commercial":195,"station":148,"forest":147,"hospital":118,"factory":85,"residential":285,"park":155,"lab":54,"warehouse":166,"construction":126,"underground":119}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 13.3% |
| 最低非零胜率 | 1.5% |
| 比值 | 8.67 |
| 阈值 | 2.5 |
| 0 胜率角色 | fighter |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3462 | 4.4% | 2.0% | **PASS** |
| normal | 55799 | 70.6% | - | - |
| heavy | 19770 | 25.0% | 2.0% | **PASS** |
| 合计 | 79031 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2977 | - | - |
| GUARD 使用率（占全部命令） | 10.3% | 2.0% | **PASS** |
| 防御成功减免次数 | 551 | - | - |
| EXPOSED 施加（重击挥空） | 8966 | - | - |
| EXPOSED 兑现（破绽被击中） | 2849 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 592 |
| prepare_ambush | 531 |
| sort_rare | 393 |
| camp_routine | 374 |
| emergency_treatment | 368 |
| second_wind | 363 |
| track_target | 360 |
| escape_plan | 360 |
| scout_recon | 352 |
| engineer_reinforce | 333 |
| adrenaline | 284 |
| scout_smoke | 268 |
| fighter_focus | 198 |
| steady_aim | 194 |
| medic_regen | 180 |
| field_craft | 56 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 539 | 50 | ✓ |
| rain | 549 | 50 | ✓ |
| emergency_broadcast | 563 | 50 | ✓ |
| medical_alert | 548 | 50 | ✓ |
| research_anomaly | 547 | 50 | ✓ |
| citywide_unrest | 570 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3462 | 2699 | 763 | 78.0% | 76.7% | 1.28 | ✓ | 9548 | 3.5 |
| normal | 55799 | 38013 | 17786 | 68.1% | 67.5% | 0.66 | ✓ | 205948 | 5.4 |
| heavy | 19770 | 10804 | 8966 | 54.6% | 53.7% | 0.97 | ✓ | 94744 | 8.8 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2977 |
| 防御成功触发（减免伤害） | 551 |
| 减免伤害总量 | 1888 |
| 平均每次减免 | 3.4 |
| 重击落空（Heavy Miss） | 8966 |
| EXPOSED 施加 | 8966 |
| EXPOSED 兑现（被击中） | 2849 |
| EXPOSED 未兑现失效 | 3115 |
| EXPOSED 兑现时额外伤害总量 | 2287 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 67 | 285 | 遭遇先手次数：0 |
| 肾上腺素 | 50 | 234 | 覆盖攻击 378 · 额外伤害 339 · 省体力 378 · 自伤 17 |
| 现场加工 | 56 | 0 | 免费合成 2 · 省体力 2 |
| 应急处理 | 66 | 302 | 即时治疗 851 · 治疗品额外 55 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 539 | 受影响搜索 1861 · 遭遇权重降低 1736 · 空手权重提高 1861 |
| 暴雨 | 549 | 受影响移动 1838 · 额外体力 1838 · 远程攻击 2458 |
| 广播 | 563 | 广播区域数：563 |
| 医疗警报 | 548 | 受影响治疗 12 · 额外治疗 64 |
| 研究异常 | 547 | 伤害 tick 801 · 总伤害 2401 · 致死 11 |
| 全域骚动 | 570 | 阻止噪音衰减 8033 · 搜索噪音加成 969 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 4.2% |
| 败率 | 82.8% |
| 平局率 | 13.0% |
| 超时率 | 0.0% |
| 存活率 | 4.2% |
| 胜利路线 | {"last_survivor":435,"none":65} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 76.5 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 62.5 |
| 平均承受伤害 | 180.6 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 回收场巨獠攻击 | 1 |
| 安保机器犬攻击 | 3 |
| 战斗 | 263 |
| 树脂寄生兽攻击 | 2 |
| 毒蛇攻击 | 3 |
| 猎杀无人机攻击 | 1 |
| 獠牙野猪攻击 | 5 |
| 研究设施异常 | 4 |
| 禁区侵蚀 | 102 |
| 腐食乌鸦攻击 | 3 |
| 衰竭 | 52 |
| 巡逻无人机攻击 | 7 |
| 逃逸实验体攻击 | 9 |
| 野化猎犬攻击 | 7 |
| 野外毒伤 | 3 |
| 铁牙攻击 | 1 |
| 阿尔法猎犬攻击 | 6 |
| 鼠群攻击 | 7 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 5.2 | 0.1 | 74.1 |
| 侦察员 | cautious | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.7 | 0.0 | 75.8 |
| 侦察员 | collector | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.8 | 0.3 | 76.5 |
| 侦察员 | opportunist | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.3 |
| 侦察员 | random | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.0 | 74.6 |
| 斗士 | aggressive | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 74.2 |
| 斗士 | cautious | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 76.1 |
| 斗士 | collector | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 71.8 |
| 斗士 | opportunist | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 80.5 |
| 斗士 | random | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 75.1 |
| 工程师 | aggressive | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 76.6 |
| 工程师 | cautious | 13 | 2 | 10 | 1 | 0 | 15.4% | 100.0% | 0 | 0 | 4.1 | 0.0 | 77.8 |
| 工程师 | collector | 13 | 1 | 8 | 4 | 0 | 7.7% | 100.0% | 0 | 0 | 4.1 | 0.2 | 74.2 |
| 工程师 | opportunist | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.2 | 72.2 |
| 工程师 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 72.7 |
| 医学生 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 76.0 |
| 医学生 | cautious | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.0 | 74.4 |
| 医学生 | collector | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.2 | 77.3 |
| 医学生 | opportunist | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.4 | 0.0 | 69.8 |
| 医学生 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 79.4 |
| 生存专家 | aggressive | 12 | 0 | 8 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 3.6 | 0.0 | 80.9 |
| 生存专家 | cautious | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.3 | 0.1 | 81.8 |
| 生存专家 | collector | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.9 | 0.0 | 76.8 |
| 生存专家 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 79.6 |
| 生存专家 | random | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 77.2 |
| 拾荒者 | aggressive | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.0 | 74.3 |
| 拾荒者 | cautious | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 4.4 | 0.0 | 77.5 |
| 拾荒者 | collector | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 77.0 |
| 拾荒者 | opportunist | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 77.4 |
| 拾荒者 | random | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 4.8 | 0.0 | 75.1 |
| 猎人 | aggressive | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.3 | 77.4 |
| 猎人 | cautious | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.9 | 0.1 | 78.0 |
| 猎人 | collector | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.6 | 79.8 |
| 猎人 | opportunist | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.0 | 73.4 |
| 猎人 | random | 12 | 1 | 8 | 3 | 0 | 8.3% | 100.0% | 0 | 0 | 4.7 | 0.1 | 76.8 |
| 陷阱师 | aggressive | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 3.5 | 0.3 | 74.8 |
| 陷阱师 | cautious | 12 | 4 | 7 | 1 | 0 | 33.3% | 100.0% | 0 | 0 | 2.8 | 0.1 | 80.7 |
| 陷阱师 | collector | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.6 | 0.2 | 78.8 |
| 陷阱师 | opportunist | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.0 | 0.0 | 78.9 |
| 陷阱师 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.1 | 81.1 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 4.6% | 4.6% | 100.0% | 4.8 | 0.1 | 175.6 |
| 斗士 | 65 | 0.0% | 0.0% | 100.0% | 4.7 | 0.0 | 185.4 |
| 工程师 | 65 | 4.6% | 4.6% | 100.0% | 4.3 | 0.1 | 172.3 |
| 医学生 | 65 | 1.5% | 1.5% | 100.0% | 4.4 | 0.0 | 231.3 |
| 生存专家 | 60 | 3.3% | 3.3% | 100.0% | 3.9 | 0.0 | 179.4 |
| 拾荒者 | 60 | 3.3% | 3.3% | 100.0% | 4.7 | 0.0 | 167.6 |
| 猎人 | 60 | 3.3% | 3.3% | 100.0% | 4.3 | 0.2 | 169.5 |
| 陷阱师 | 60 | 13.3% | 13.3% | 100.0% | 3.5 | 0.1 | 160.4 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 2.0% | 2.0% | 100.0% | 4.3 | 0.1 | 174.4 |
| cautious | 100 | 10.0% | 10.0% | 100.0% | 4.0 | 0.0 | 176.3 |
| collector | 100 | 4.0% | 4.0% | 100.0% | 4.2 | 0.2 | 188.9 |
| opportunist | 100 | 3.0% | 3.0% | 100.0% | 4.5 | 0.0 | 186.3 |
| random | 100 | 2.0% | 2.0% | 100.0% | 4.7 | 0.0 | 177.2 |

################################################################