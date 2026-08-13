# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-13T12:02:51.631Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4P

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

**引擎整体判定：PASS**

> 说明：timeout 在 Step 13 的 `enforceTimeLimit` 落地后会由 `playing → draw` 收束而归零；
> Regression 门槛只要求请求/实际局数一致且引擎健康；角色平衡与 Phase 3A 结果仅作为观察。

## Phase 4N PvE ecology observations

- encounters=7595, kills=1782, flees=6456, playerDeaths=55
- damageTaken=97653, groundDrops=2857, pickups=3241, wildCrafts=118
- eliteEncounters=166, eliteKills=0, apexSpawned=638, apexEncounters=21, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={"carrion_crow":297,"feral_dog":419,"patrol_drone":153,"rat_swarm":533,"venom_snake":207,"maintenance_bot":66,"escaped_subject":42,"security_hound":23,"tusked_boar":30,"resin_stalker":12}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"carrion_crow":657,"security_hound":445,"patrol_drone":817,"tusked_boar":485,"resin_stalker":364,"rat_swarm":1395,"feral_dog":1259,"escaped_subject":506,"maintenance_bot":939,"venom_snake":541,"scavenger_boar":26,"hunter_killer_drone":28,"feral_alpha_hound":33,"toxic_experiment":23,"armored_repair_bot":29,"iron_tusk":9,"prototype_aegis":9,"riot_control_unit":27,"subject_07":3}
- encounterByZone: {"park":543,"factory":750,"station":646,"forest":655,"underground":575,"residential":722,"commercial":605,"warehouse":719,"school":650,"lab":638,"construction":626,"hospital":466}
- killsByType: {"carrion_crow":297,"feral_dog":419,"patrol_drone":153,"rat_swarm":533,"venom_snake":207,"maintenance_bot":66,"escaped_subject":42,"security_hound":23,"tusked_boar":30,"resin_stalker":12}
- killsByZone: {"park":140,"residential":296,"station":134,"warehouse":154,"construction":108,"hospital":122,"commercial":177,"forest":153,"lab":60,"underground":116,"school":220,"factory":102}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 6.2% |
| 最低非零胜率 | 3.1% |
| 比值 | 2.00 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **PASS** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3582 | 4.6% | 2.0% | **PASS** |
| normal | 55691 | 71.0% | - | - |
| heavy | 19166 | 24.4% | 2.0% | **PASS** |
| 合计 | 78439 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 3088 | - | - |
| GUARD 使用率（占全部命令） | 10.8% | 2.0% | **PASS** |
| 防御成功减免次数 | 1926 | - | - |
| EXPOSED 施加（重击挥空） | 8726 | - | - |
| EXPOSED 兑现（破绽被击中） | 2674 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 559 |
| prepare_ambush | 554 |
| emergency_treatment | 393 |
| escape_plan | 380 |
| sort_rare | 375 |
| scout_recon | 374 |
| camp_routine | 353 |
| track_target | 350 |
| second_wind | 321 |
| scout_smoke | 303 |
| engineer_reinforce | 303 |
| adrenaline | 267 |
| medic_regen | 200 |
| fighter_focus | 189 |
| steady_aim | 167 |
| field_craft | 53 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 560 | 50 | ✓ |
| rain | 573 | 50 | ✓ |
| emergency_broadcast | 550 | 50 | ✓ |
| medical_alert | 528 | 50 | ✓ |
| research_anomaly | 595 | 50 | ✓ |
| citywide_unrest | 519 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3582 | 2743 | 839 | 76.6% | 76.2% | 0.39 | ✓ | 10157 | 3.7 |
| normal | 55691 | 37910 | 17781 | 68.1% | 67.5% | 0.54 | ✓ | 208676 | 5.5 |
| heavy | 19166 | 10440 | 8726 | 54.5% | 53.4% | 1.12 | ✓ | 91219 | 8.7 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 3088 |
| 防御成功触发（减免伤害） | 1926 |
| 减免伤害总量 | 7088 |
| 平均每次减免 | 3.7 |
| 重击落空（Heavy Miss） | 8726 |
| EXPOSED 施加 | 8726 |
| EXPOSED 兑现（被击中） | 2674 |
| EXPOSED 未兑现失效 | 2840 |
| EXPOSED 兑现时额外伤害总量 | 2214 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 67 | 307 | 遭遇先手次数：0 |
| 肾上腺素 | 48 | 219 | 覆盖攻击 361 · 额外伤害 323 · 省体力 361 · 自伤 26 |
| 现场加工 | 53 | 0 | 免费合成 2 · 省体力 2 |
| 应急处理 | 65 | 328 | 即时治疗 812 · 治疗品额外 62 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 560 | 受影响搜索 1853 · 遭遇权重降低 1708 · 空手权重提高 1853 |
| 暴雨 | 573 | 受影响移动 1853 · 额外体力 1853 · 远程攻击 2921 |
| 广播 | 550 | 广播区域数：550 |
| 医疗警报 | 528 | 受影响治疗 6 · 额外治疗 31 |
| 研究异常 | 595 | 伤害 tick 842 · 总伤害 2519 · 致死 6 |
| 全域骚动 | 519 | 阻止噪音衰减 7412 · 搜索噪音加成 908 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 4.8% |
| 败率 | 86.2% |
| 平局率 | 9.0% |
| 超时率 | 0.0% |
| 存活率 | 4.8% |
| 胜利路线 | {"last_survivor":455,"none":45} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 76.8 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 59.1 |
| 平均承受伤害 | 181.7 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 失控维修机攻击 | 1 |
| 安保机器犬攻击 | 3 |
| 战斗 | 266 |
| 毒蛇攻击 | 2 |
| 猎杀无人机攻击 | 4 |
| 獠牙野猪攻击 | 6 |
| 研究设施异常 | 2 |
| 禁区侵蚀 | 97 |
| 腐食乌鸦攻击 | 2 |
| 衰竭 | 53 |
| 巡逻无人机攻击 | 8 |
| 逃逸实验体攻击 | 11 |
| 野化猎犬攻击 | 6 |
| 野外毒伤 | 3 |
| 铁牙攻击 | 1 |
| 阿尔法猎犬攻击 | 3 |
| 鼠群攻击 | 8 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 3.8 | 0.2 | 73.9 |
| 侦察员 | cautious | 13 | 2 | 11 | 0 | 0 | 15.4% | 100.0% | 0 | 0 | 4.0 | 0.1 | 77.7 |
| 侦察员 | collector | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 75.5 |
| 侦察员 | opportunist | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 73.1 |
| 侦察员 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.0 | 77.4 |
| 斗士 | aggressive | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 77.4 |
| 斗士 | cautious | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.8 | 0.0 | 71.2 |
| 斗士 | collector | 13 | 2 | 10 | 1 | 0 | 15.4% | 100.0% | 0 | 0 | 4.5 | 0.0 | 74.9 |
| 斗士 | opportunist | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 5.3 | 0.0 | 76.4 |
| 斗士 | random | 13 | 1 | 9 | 3 | 0 | 7.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 78.0 |
| 工程师 | aggressive | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.0 | 77.8 |
| 工程师 | cautious | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.3 | 0.0 | 71.0 |
| 工程师 | collector | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.2 | 79.3 |
| 工程师 | opportunist | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.0 | 79.3 |
| 工程师 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.1 | 77.2 |
| 医学生 | aggressive | 13 | 1 | 9 | 3 | 0 | 7.7% | 100.0% | 0 | 0 | 4.1 | 0.0 | 79.9 |
| 医学生 | cautious | 13 | 2 | 10 | 1 | 0 | 15.4% | 100.0% | 0 | 0 | 4.1 | 0.2 | 78.6 |
| 医学生 | collector | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.0 | 76.2 |
| 医学生 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 80.8 |
| 医学生 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 76.6 |
| 生存专家 | aggressive | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.2 | 75.5 |
| 生存专家 | cautious | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.9 | 0.0 | 77.7 |
| 生存专家 | collector | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.9 | 0.2 | 77.3 |
| 生存专家 | opportunist | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 81.5 |
| 生存专家 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.2 | 79.0 |
| 拾荒者 | aggressive | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.0 | 0.1 | 75.6 |
| 拾荒者 | cautious | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 4.1 | 0.0 | 73.5 |
| 拾荒者 | collector | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 4.0 | 0.1 | 80.5 |
| 拾荒者 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.2 | 0.2 | 74.6 |
| 拾荒者 | random | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 5.2 | 0.0 | 77.5 |
| 猎人 | aggressive | 12 | 0 | 8 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.9 |
| 猎人 | cautious | 12 | 2 | 10 | 0 | 0 | 16.7% | 100.0% | 0 | 0 | 3.8 | 0.3 | 78.3 |
| 猎人 | collector | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.0 | 76.2 |
| 猎人 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 73.6 |
| 猎人 | random | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.3 | 0.2 | 74.5 |
| 陷阱师 | aggressive | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.3 | 0.0 | 70.8 |
| 陷阱师 | cautious | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.3 | 0.2 | 76.5 |
| 陷阱师 | collector | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.5 | 0.1 | 84.9 |
| 陷阱师 | opportunist | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.0 | 81.6 |
| 陷阱师 | random | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 3.6 | 0.0 | 73.3 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 4.6% | 4.6% | 100.0% | 4.4 | 0.1 | 170.5 |
| 斗士 | 65 | 6.2% | 6.2% | 100.0% | 4.8 | 0.0 | 185.5 |
| 工程师 | 65 | 3.1% | 3.1% | 100.0% | 4.6 | 0.0 | 177.9 |
| 医学生 | 65 | 6.2% | 6.2% | 100.0% | 4.5 | 0.0 | 234.9 |
| 生存专家 | 60 | 3.3% | 3.3% | 100.0% | 3.9 | 0.1 | 177.2 |
| 拾荒者 | 60 | 5.0% | 5.0% | 100.0% | 4.5 | 0.1 | 171.8 |
| 猎人 | 60 | 5.0% | 5.0% | 100.0% | 4.4 | 0.1 | 168.9 |
| 陷阱师 | 60 | 5.0% | 5.0% | 100.0% | 3.5 | 0.1 | 163.7 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 4.0% | 4.0% | 100.0% | 4.1 | 0.1 | 175.5 |
| cautious | 100 | 11.0% | 11.0% | 100.0% | 4.0 | 0.1 | 184.6 |
| collector | 100 | 6.0% | 6.0% | 100.0% | 4.3 | 0.1 | 186.9 |
| opportunist | 100 | 1.0% | 1.0% | 100.0% | 4.7 | 0.1 | 182.4 |
| random | 100 | 2.0% | 2.0% | 100.0% | 4.6 | 0.1 | 179.2 |

################################################################