# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-13T20:48:22.576Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4Q

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

- encounters=7502, kills=1683, flees=6190, playerDeaths=58
- damageTaken=93683, groundDrops=2694, pickups=3087, wildCrafts=109
- eliteEncounters=100, eliteKills=0, apexSpawned=309, apexEncounters=6, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"rat_swarm":1486,"feral_dog":1114,"maintenance_bot":947,"security_hound":449,"venom_snake":417,"carrion_crow":669,"patrol_drone":831,"escaped_subject":547,"tusked_boar":521,"resin_stalker":415,"hunter_killer_drone":10,"riot_control_unit":22,"iron_tusk":4,"armored_repair_bot":13,"scavenger_boar":15,"feral_alpha_hound":19,"toxic_experiment":21,"subject_07":1,"prototype_aegis":1}
- encounterByZone: {"underground":623,"commercial":553,"warehouse":683,"station":748,"park":534,"school":565,"factory":688,"residential":689,"lab":634,"construction":652,"hospital":508,"forest":625}
- killsByType: {"rat_swarm":528,"feral_dog":346,"maintenance_bot":69,"carrion_crow":286,"venom_snake":174,"patrol_drone":160,"escaped_subject":36,"tusked_boar":50,"security_hound":24,"resin_stalker":10}
- killsByZone: {"underground":120,"commercial":159,"warehouse":161,"residential":266,"station":143,"school":177,"forest":142,"factory":88,"construction":115,"lab":51,"park":159,"hospital":102}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 10.0% |
| 最低非零胜率 | 1.5% |
| 比值 | 6.50 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3428 | 4.4% | 2.0% | **PASS** |
| normal | 54371 | 70.4% | - | - |
| heavy | 19458 | 25.2% | 2.0% | **PASS** |
| 合计 | 77257 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2899 | - | - |
| GUARD 使用率（占全部命令） | 10.4% | 2.0% | **PASS** |
| 防御成功减免次数 | 489 | - | - |
| EXPOSED 施加（重击挥空） | 8759 | - | - |
| EXPOSED 兑现（破绽被击中） | 2761 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 655 |
| prepare_ambush | 522 |
| sort_rare | 417 |
| scout_recon | 376 |
| escape_plan | 364 |
| emergency_treatment | 364 |
| camp_routine | 360 |
| track_target | 356 |
| second_wind | 350 |
| engineer_reinforce | 322 |
| scout_smoke | 298 |
| adrenaline | 259 |
| fighter_focus | 186 |
| steady_aim | 168 |
| medic_regen | 166 |
| field_craft | 54 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 563 | 50 | ✓ |
| rain | 503 | 50 | ✓ |
| emergency_broadcast | 548 | 50 | ✓ |
| medical_alert | 562 | 50 | ✓ |
| research_anomaly | 550 | 50 | ✓ |
| citywide_unrest | 522 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3428 | 2643 | 785 | 77.1% | 76.4% | 0.75 | ✓ | 9963 | 3.8 |
| normal | 54371 | 37091 | 17280 | 68.2% | 67.5% | 0.69 | ✓ | 204651 | 5.5 |
| heavy | 19458 | 10699 | 8759 | 55.0% | 53.8% | 1.16 | ✓ | 93912 | 8.8 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2899 |
| 防御成功触发（减免伤害） | 489 |
| 减免伤害总量 | 1803 |
| 平均每次减免 | 3.7 |
| 重击落空（Heavy Miss） | 8759 |
| EXPOSED 施加 | 8759 |
| EXPOSED 兑现（被击中） | 2761 |
| EXPOSED 未兑现失效 | 2999 |
| EXPOSED 兑现时额外伤害总量 | 2189 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 68 | 308 | 遭遇先手次数：0 |
| 肾上腺素 | 47 | 212 | 覆盖攻击 316 · 额外伤害 262 · 省体力 316 · 自伤 17 |
| 现场加工 | 54 | 0 | 免费合成 2 · 省体力 2 |
| 应急处理 | 65 | 299 | 即时治疗 909 · 治疗品额外 28 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 563 | 受影响搜索 1901 · 遭遇权重降低 1738 · 空手权重提高 1901 |
| 暴雨 | 503 | 受影响移动 1712 · 额外体力 1712 · 远程攻击 2677 |
| 广播 | 548 | 广播区域数：548 |
| 医疗警报 | 562 | 受影响治疗 10 · 额外治疗 45 |
| 研究异常 | 550 | 伤害 tick 950 · 总伤害 2834 · 致死 11 |
| 全域骚动 | 522 | 阻止噪音衰减 7772 · 搜索噪音加成 951 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 5.6% |
| 败率 | 86.0% |
| 平局率 | 8.4% |
| 超时率 | 0.0% |
| 存活率 | 5.6% |
| 胜利路线 | {"last_survivor":458,"none":42} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 75.5 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 59.2 |
| 平均承受伤害 | 180.4 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 失控维修机攻击 | 3 |
| 安保机器犬攻击 | 5 |
| 战斗 | 258 |
| 毒性实验体攻击 | 1 |
| 毒蛇攻击 | 2 |
| 猎杀无人机攻击 | 1 |
| 獠牙野猪攻击 | 5 |
| 研究设施异常 | 3 |
| 禁区侵蚀 | 106 |
| 腐食乌鸦攻击 | 4 |
| 衰竭 | 43 |
| 巡逻无人机攻击 | 13 |
| 逃逸实验体攻击 | 17 |
| 野化猎犬攻击 | 3 |
| 野外毒伤 | 4 |
| 铁牙攻击 | 1 |
| 镇暴控制单元攻击 | 1 |
| 鼠群攻击 | 2 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 77.9 |
| 侦察员 | cautious | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.6 | 0.1 | 73.6 |
| 侦察员 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 77.8 |
| 侦察员 | opportunist | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 71.6 |
| 侦察员 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 75.9 |
| 斗士 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 79.1 |
| 斗士 | cautious | 13 | 1 | 9 | 3 | 0 | 7.7% | 100.0% | 0 | 0 | 4.1 | 0.2 | 75.7 |
| 斗士 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.0 | 68.2 |
| 斗士 | opportunist | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 71.3 |
| 斗士 | random | 13 | 1 | 8 | 4 | 0 | 7.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 75.3 |
| 工程师 | aggressive | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.2 | 0.0 | 75.3 |
| 工程师 | cautious | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.2 | 0.2 | 69.5 |
| 工程师 | collector | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.2 | 0.1 | 75.2 |
| 工程师 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 73.3 |
| 工程师 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 74.3 |
| 医学生 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.0 | 68.5 |
| 医学生 | cautious | 13 | 2 | 10 | 1 | 0 | 15.4% | 100.0% | 0 | 0 | 4.0 | 0.0 | 73.8 |
| 医学生 | collector | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 77.2 |
| 医学生 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.0 | 78.6 |
| 医学生 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 73.2 |
| 生存专家 | aggressive | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.7 | 0.2 | 77.5 |
| 生存专家 | cautious | 12 | 2 | 8 | 2 | 0 | 16.7% | 100.0% | 0 | 0 | 3.3 | 0.0 | 80.7 |
| 生存专家 | collector | 12 | 2 | 8 | 2 | 0 | 16.7% | 100.0% | 0 | 0 | 3.8 | 0.1 | 74.9 |
| 生存专家 | opportunist | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 74.3 |
| 生存专家 | random | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.3 | 0.0 | 78.0 |
| 拾荒者 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 71.0 |
| 拾荒者 | cautious | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.8 | 0.0 | 69.6 |
| 拾荒者 | collector | 12 | 3 | 7 | 2 | 0 | 25.0% | 100.0% | 0 | 0 | 3.6 | 0.3 | 80.5 |
| 拾荒者 | opportunist | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.6 | 0.1 | 75.7 |
| 拾荒者 | random | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.7 | 0.1 | 76.0 |
| 猎人 | aggressive | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 84.9 |
| 猎人 | cautious | 12 | 2 | 8 | 2 | 0 | 16.7% | 100.0% | 0 | 0 | 4.2 | 0.2 | 73.3 |
| 猎人 | collector | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 69.0 |
| 猎人 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 71.8 |
| 猎人 | random | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 74.9 |
| 陷阱师 | aggressive | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.5 | 0.1 | 81.3 |
| 陷阱师 | cautious | 12 | 3 | 6 | 3 | 0 | 25.0% | 100.0% | 0 | 0 | 3.1 | 0.0 | 86.3 |
| 陷阱师 | collector | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 3.4 | 0.0 | 84.0 |
| 陷阱师 | opportunist | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.1 | 75.3 |
| 陷阱师 | random | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.3 | 0.1 | 77.5 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 1.5% | 1.5% | 100.0% | 4.6 | 0.1 | 167.6 |
| 斗士 | 65 | 3.1% | 3.1% | 100.0% | 4.6 | 0.1 | 183.2 |
| 工程师 | 65 | 4.6% | 4.6% | 100.0% | 4.5 | 0.0 | 174.2 |
| 医学生 | 65 | 3.1% | 3.1% | 100.0% | 4.7 | 0.0 | 239.8 |
| 生存专家 | 60 | 10.0% | 10.0% | 100.0% | 3.8 | 0.1 | 176.8 |
| 拾荒者 | 60 | 10.0% | 10.0% | 100.0% | 4.4 | 0.1 | 161.2 |
| 猎人 | 60 | 3.3% | 3.3% | 100.0% | 4.6 | 0.1 | 166.5 |
| 陷阱师 | 60 | 10.0% | 10.0% | 100.0% | 3.4 | 0.1 | 170.5 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 3.0% | 3.0% | 100.0% | 4.3 | 0.1 | 177.6 |
| cautious | 100 | 13.0% | 13.0% | 100.0% | 4.0 | 0.1 | 176.8 |
| collector | 100 | 8.0% | 8.0% | 100.0% | 4.3 | 0.1 | 187.8 |
| opportunist | 100 | 1.0% | 1.0% | 100.0% | 4.5 | 0.1 | 185.0 |
| random | 100 | 3.0% | 3.0% | 100.0% | 4.5 | 0.1 | 174.9 |

################################################################