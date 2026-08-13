# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-13T13:20:02.991Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4P-AF

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

- encounters=7789, kills=1725, flees=6746, playerDeaths=68
- damageTaken=96655, groundDrops=2805, pickups=3154, wildCrafts=109
- eliteEncounters=123, eliteKills=0, apexSpawned=342, apexEncounters=3, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"rat_swarm":1433,"venom_snake":491,"feral_dog":1246,"feral_alpha_hound":13,"escaped_subject":554,"carrion_crow":688,"patrol_drone":891,"security_hound":526,"maintenance_bot":932,"tusked_boar":536,"resin_stalker":366,"scavenger_boar":34,"hunter_killer_drone":21,"armored_repair_bot":25,"toxic_experiment":18,"riot_control_unit":12,"prototype_aegis":1,"subject_07":1,"iron_tusk":1}
- encounterByZone: {"underground":593,"forest":592,"school":632,"warehouse":730,"factory":728,"hospital":525,"park":626,"commercial":588,"residential":741,"lab":627,"construction":751,"station":656}
- killsByType: {"rat_swarm":515,"venom_snake":182,"patrol_drone":146,"maintenance_bot":78,"escaped_subject":51,"carrion_crow":274,"feral_dog":391,"tusked_boar":38,"resin_stalker":6,"security_hound":44}
- killsByZone: {"underground":105,"forest":150,"construction":120,"factory":97,"park":129,"hospital":120,"school":205,"warehouse":158,"residential":278,"commercial":164,"station":148,"lab":51}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 13.3% |
| 最低非零胜率 | 3.1% |
| 比值 | 4.33 |
| 阈值 | 2.5 |
| 0 胜率角色 | fighter |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3642 | 4.7% | 2.0% | **PASS** |
| normal | 55079 | 70.4% | - | - |
| heavy | 19529 | 25.0% | 2.0% | **PASS** |
| 合计 | 78250 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2972 | - | - |
| GUARD 使用率（占全部命令） | 10.3% | 2.0% | **PASS** |
| 防御成功减免次数 | 497 | - | - |
| EXPOSED 施加（重击挥空） | 8920 | - | - |
| EXPOSED 兑现（破绽被击中） | 2772 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 571 |
| prepare_ambush | 525 |
| camp_routine | 397 |
| second_wind | 382 |
| emergency_treatment | 375 |
| track_target | 370 |
| sort_rare | 368 |
| scout_recon | 367 |
| escape_plan | 350 |
| engineer_reinforce | 319 |
| scout_smoke | 309 |
| adrenaline | 259 |
| medic_regen | 201 |
| fighter_focus | 183 |
| steady_aim | 167 |
| field_craft | 62 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 523 | 50 | ✓ |
| rain | 518 | 50 | ✓ |
| emergency_broadcast | 560 | 50 | ✓ |
| medical_alert | 534 | 50 | ✓ |
| research_anomaly | 560 | 50 | ✓ |
| citywide_unrest | 558 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3642 | 2828 | 814 | 77.6% | 76.6% | 1.08 | ✓ | 10365 | 3.7 |
| normal | 55079 | 37164 | 17915 | 67.5% | 67.4% | 0.03 | ✓ | 205191 | 5.5 |
| heavy | 19529 | 10609 | 8920 | 54.3% | 53.4% | 0.93 | ✓ | 94726 | 8.9 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2972 |
| 防御成功触发（减免伤害） | 497 |
| 减免伤害总量 | 1795 |
| 平均每次减免 | 3.6 |
| 重击落空（Heavy Miss） | 8920 |
| EXPOSED 施加 | 8920 |
| EXPOSED 兑现（被击中） | 2772 |
| EXPOSED 未兑现失效 | 2988 |
| EXPOSED 兑现时额外伤害总量 | 2215 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 65 | 302 | 遭遇先手次数：0 |
| 肾上腺素 | 47 | 212 | 覆盖攻击 344 · 额外伤害 341 · 省体力 344 · 自伤 17 |
| 现场加工 | 62 | 0 | 免费合成 2 · 省体力 2 |
| 应急处理 | 63 | 312 | 即时治疗 819 · 治疗品额外 67 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 523 | 受影响搜索 1701 · 遭遇权重降低 1566 · 空手权重提高 1701 |
| 暴雨 | 518 | 受影响移动 1645 · 额外体力 1645 · 远程攻击 2452 |
| 广播 | 560 | 广播区域数：560 |
| 医疗警报 | 534 | 受影响治疗 6 · 额外治疗 24 |
| 研究异常 | 560 | 伤害 tick 978 · 总伤害 2924 · 致死 11 |
| 全域骚动 | 558 | 阻止噪音衰减 8070 · 搜索噪音加成 939 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 5.4% |
| 败率 | 85.0% |
| 平局率 | 9.6% |
| 超时率 | 0.0% |
| 存活率 | 5.4% |
| 胜利路线 | {"last_survivor":452,"none":48} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 75.8 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 63.3 |
| 平均承受伤害 | 180.5 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 失控维修机攻击 | 4 |
| 安保机器犬攻击 | 10 |
| 战斗 | 249 |
| 树脂寄生兽攻击 | 3 |
| 毒性实验体攻击 | 1 |
| 毒蛇攻击 | 1 |
| 猎杀无人机攻击 | 2 |
| 獠牙野猪攻击 | 5 |
| 研究设施异常 | 2 |
| 禁区侵蚀 | 106 |
| 腐食乌鸦攻击 | 4 |
| 衰竭 | 45 |
| 巡逻无人机攻击 | 6 |
| 逃逸实验体攻击 | 9 |
| 野化猎犬攻击 | 15 |
| 野外毒伤 | 3 |
| 阿尔法猎犬攻击 | 1 |
| 鼠群攻击 | 7 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.2 | 76.4 |
| 侦察员 | cautious | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 72.1 |
| 侦察员 | collector | 13 | 2 | 9 | 2 | 0 | 15.4% | 100.0% | 0 | 0 | 3.9 | 0.4 | 79.0 |
| 侦察员 | opportunist | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.0 | 73.4 |
| 侦察员 | random | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.0 | 71.1 |
| 斗士 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 77.0 |
| 斗士 | cautious | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 77.8 |
| 斗士 | collector | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 5.2 | 0.1 | 80.8 |
| 斗士 | opportunist | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 69.9 |
| 斗士 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 77.1 |
| 工程师 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 70.4 |
| 工程师 | cautious | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 80.6 |
| 工程师 | collector | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.8 | 0.1 | 76.5 |
| 工程师 | opportunist | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.4 | 0.0 | 74.0 |
| 工程师 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 70.9 |
| 医学生 | aggressive | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.0 | 75.8 |
| 医学生 | cautious | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 73.8 |
| 医学生 | collector | 13 | 1 | 9 | 3 | 0 | 7.7% | 100.0% | 0 | 0 | 4.2 | 0.0 | 74.8 |
| 医学生 | opportunist | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 77.6 |
| 医学生 | random | 13 | 2 | 9 | 2 | 0 | 15.4% | 100.0% | 0 | 0 | 4.5 | 0.0 | 70.5 |
| 生存专家 | aggressive | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 3.4 | 0.1 | 66.9 |
| 生存专家 | cautious | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.0 | 0.0 | 83.7 |
| 生存专家 | collector | 12 | 2 | 8 | 2 | 0 | 16.7% | 100.0% | 0 | 0 | 3.8 | 0.1 | 79.8 |
| 生存专家 | opportunist | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.1 | 73.5 |
| 生存专家 | random | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.3 | 0.1 | 75.5 |
| 拾荒者 | aggressive | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.1 | 69.5 |
| 拾荒者 | cautious | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 73.1 |
| 拾荒者 | collector | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 4.2 | 0.7 | 79.7 |
| 拾荒者 | opportunist | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 78.1 |
| 拾荒者 | random | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 67.5 |
| 猎人 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 75.0 |
| 猎人 | cautious | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.3 | 81.0 |
| 猎人 | collector | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 4.4 | 0.3 | 79.5 |
| 猎人 | opportunist | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.8 | 0.0 | 71.8 |
| 猎人 | random | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.3 | 75.9 |
| 陷阱师 | aggressive | 12 | 2 | 10 | 0 | 0 | 16.7% | 100.0% | 0 | 0 | 3.1 | 0.0 | 77.3 |
| 陷阱师 | cautious | 12 | 2 | 10 | 0 | 0 | 16.7% | 100.0% | 0 | 0 | 3.3 | 0.2 | 80.8 |
| 陷阱师 | collector | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 3.6 | 0.3 | 84.8 |
| 陷阱师 | opportunist | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.0 | 0.0 | 83.2 |
| 陷阱师 | random | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.7 | 0.1 | 75.3 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 4.6% | 4.6% | 100.0% | 4.5 | 0.1 | 167.9 |
| 斗士 | 65 | 0.0% | 0.0% | 100.0% | 4.6 | 0.1 | 184.1 |
| 工程师 | 65 | 3.1% | 3.1% | 100.0% | 4.6 | 0.0 | 169.9 |
| 医学生 | 65 | 6.2% | 6.2% | 100.0% | 4.3 | 0.0 | 235.7 |
| 生存专家 | 60 | 10.0% | 10.0% | 100.0% | 3.6 | 0.1 | 176.2 |
| 拾荒者 | 60 | 3.3% | 3.3% | 100.0% | 4.3 | 0.1 | 167.4 |
| 猎人 | 60 | 3.3% | 3.3% | 100.0% | 4.5 | 0.2 | 177.9 |
| 陷阱师 | 60 | 13.3% | 13.3% | 100.0% | 3.5 | 0.1 | 162.0 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 4.0% | 4.0% | 100.0% | 4.0 | 0.1 | 176.7 |
| cautious | 100 | 4.0% | 4.0% | 100.0% | 4.2 | 0.1 | 181.3 |
| collector | 100 | 11.0% | 11.0% | 100.0% | 4.3 | 0.2 | 192.6 |
| opportunist | 100 | 3.0% | 3.0% | 100.0% | 4.5 | 0.0 | 183.8 |
| random | 100 | 5.0% | 5.0% | 100.0% | 4.3 | 0.1 | 168.2 |

################################################################