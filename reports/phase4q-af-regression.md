# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-13T22:05:26.417Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4Q-AF

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

- encounters=7543, kills=1758, flees=6078, playerDeaths=55
- damageTaken=95443, groundDrops=2830, pickups=3137, wildCrafts=128
- eliteEncounters=133, eliteKills=0, apexSpawned=329, apexEncounters=6, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"feral_dog":1179,"patrol_drone":812,"maintenance_bot":903,"rat_swarm":1379,"carrion_crow":706,"tusked_boar":436,"security_hound":471,"venom_snake":507,"escaped_subject":569,"resin_stalker":442,"scavenger_boar":18,"armored_repair_bot":21,"riot_control_unit":26,"hunter_killer_drone":20,"toxic_experiment":31,"feral_alpha_hound":17,"iron_tusk":3,"subject_07":1,"prototype_aegis":2}
- encounterByZone: {"commercial":606,"lab":672,"school":609,"construction":619,"hospital":453,"factory":737,"residential":734,"forest":605,"warehouse":653,"underground":637,"station":637,"park":581}
- killsByType: {"patrol_drone":146,"maintenance_bot":64,"rat_swarm":527,"carrion_crow":299,"feral_dog":376,"venom_snake":213,"escaped_subject":46,"resin_stalker":17,"security_hound":28,"tusked_boar":42}
- killsByZone: {"lab":56,"construction":98,"underground":131,"warehouse":140,"park":162,"residential":290,"forest":178,"school":213,"station":145,"commercial":161,"factory":87,"hospital":97}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 11.7% |
| 最低非零胜率 | 1.5% |
| 比值 | 7.58 |
| 阈值 | 2.5 |
| 0 胜率角色 | scavenger |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3552 | 4.6% | 2.0% | **PASS** |
| normal | 55006 | 70.5% | - | - |
| heavy | 19432 | 24.9% | 2.0% | **PASS** |
| 合计 | 77990 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2921 | - | - |
| GUARD 使用率（占全部命令） | 10.2% | 2.0% | **PASS** |
| 防御成功减免次数 | 507 | - | - |
| EXPOSED 施加（重击挥空） | 8821 | - | - |
| EXPOSED 兑现（破绽被击中） | 2730 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 527 |
| prepare_ambush | 511 |
| emergency_treatment | 395 |
| scout_recon | 373 |
| track_target | 368 |
| engineer_reinforce | 365 |
| escape_plan | 356 |
| sort_rare | 350 |
| scout_smoke | 316 |
| camp_routine | 310 |
| second_wind | 306 |
| adrenaline | 281 |
| fighter_focus | 213 |
| medic_regen | 199 |
| steady_aim | 180 |
| field_craft | 50 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 518 | 50 | ✓ |
| rain | 525 | 50 | ✓ |
| emergency_broadcast | 533 | 50 | ✓ |
| medical_alert | 580 | 50 | ✓ |
| research_anomaly | 522 | 50 | ✓ |
| citywide_unrest | 565 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3552 | 2767 | 785 | 77.9% | 77.2% | 0.66 | ✓ | 9940 | 3.6 |
| normal | 55006 | 37514 | 17492 | 68.2% | 67.5% | 0.68 | ✓ | 207753 | 5.5 |
| heavy | 19432 | 10611 | 8821 | 54.6% | 53.8% | 0.76 | ✓ | 92393 | 8.7 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2921 |
| 防御成功触发（减免伤害） | 507 |
| 减免伤害总量 | 1662 |
| 平均每次减免 | 3.3 |
| 重击落空（Heavy Miss） | 8821 |
| EXPOSED 施加 | 8821 |
| EXPOSED 兑现（被击中） | 2730 |
| EXPOSED 未兑现失效 | 3022 |
| EXPOSED 兑现时额外伤害总量 | 2177 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 69 | 304 | 遭遇先手次数：0 |
| 肾上腺素 | 54 | 227 | 覆盖攻击 359 · 额外伤害 344 · 省体力 359 · 自伤 15 |
| 现场加工 | 50 | 0 | 免费合成 3 · 省体力 3 |
| 应急处理 | 64 | 331 | 即时治疗 779 · 治疗品额外 22 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 518 | 受影响搜索 1697 · 遭遇权重降低 1549 · 空手权重提高 1697 |
| 暴雨 | 525 | 受影响移动 1775 · 额外体力 1775 · 远程攻击 2537 |
| 广播 | 533 | 广播区域数：532 |
| 医疗警报 | 580 | 受影响治疗 7 · 额外治疗 38 |
| 研究异常 | 522 | 伤害 tick 856 · 总伤害 2565 · 致死 5 |
| 全域骚动 | 565 | 阻止噪音衰减 8194 · 搜索噪音加成 938 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 5.2% |
| 败率 | 85.0% |
| 平局率 | 9.8% |
| 超时率 | 0.0% |
| 存活率 | 5.2% |
| 胜利路线 | {"last_survivor":451,"none":49} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 75.4 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 61.8 |
| 平均承受伤害 | 181.4 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 失控维修机攻击 | 1 |
| 安保机器犬攻击 | 1 |
| 战斗 | 252 |
| 树脂寄生兽攻击 | 1 |
| 毒性实验体攻击 | 3 |
| 毒蛇攻击 | 1 |
| 猎杀无人机攻击 | 4 |
| 獠牙野猪攻击 | 3 |
| 研究设施异常 | 2 |
| 禁区侵蚀 | 121 |
| 腐食乌鸦攻击 | 3 |
| 衰竭 | 40 |
| 巡逻无人机攻击 | 8 |
| 逃逸实验体攻击 | 13 |
| 野化猎犬攻击 | 10 |
| 野外毒伤 | 4 |
| 阿尔法猎犬攻击 | 3 |
| 鼠群攻击 | 4 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 76.8 |
| 侦察员 | cautious | 13 | 2 | 11 | 0 | 0 | 15.4% | 100.0% | 0 | 0 | 3.3 | 0.2 | 73.6 |
| 侦察员 | collector | 13 | 2 | 10 | 1 | 0 | 15.4% | 100.0% | 0 | 0 | 4.1 | 0.1 | 75.5 |
| 侦察员 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 74.3 |
| 侦察员 | random | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 72.2 |
| 斗士 | aggressive | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.1 | 75.5 |
| 斗士 | cautious | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 76.5 |
| 斗士 | collector | 13 | 2 | 8 | 3 | 0 | 15.4% | 100.0% | 0 | 0 | 4.5 | 0.3 | 75.3 |
| 斗士 | opportunist | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 67.8 |
| 斗士 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 69.9 |
| 工程师 | aggressive | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.1 | 78.6 |
| 工程师 | cautious | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 72.7 |
| 工程师 | collector | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 85.7 |
| 工程师 | opportunist | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.4 | 0.2 | 74.0 |
| 工程师 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 72.1 |
| 医学生 | aggressive | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 3.6 | 0.1 | 76.2 |
| 医学生 | cautious | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.2 | 0.0 | 76.9 |
| 医学生 | collector | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 71.4 |
| 医学生 | opportunist | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 75.4 |
| 医学生 | random | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.7 | 0.0 | 70.7 |
| 生存专家 | aggressive | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 76.3 |
| 生存专家 | cautious | 12 | 3 | 9 | 0 | 0 | 25.0% | 100.0% | 0 | 0 | 3.6 | 0.3 | 74.1 |
| 生存专家 | collector | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.7 | 0.0 | 77.4 |
| 生存专家 | opportunist | 12 | 0 | 8 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 80.8 |
| 生存专家 | random | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.3 | 0.1 | 80.3 |
| 拾荒者 | aggressive | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 69.6 |
| 拾荒者 | cautious | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 77.1 |
| 拾荒者 | collector | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 74.6 |
| 拾荒者 | opportunist | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 5.5 | 0.0 | 77.9 |
| 拾荒者 | random | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.7 |
| 猎人 | aggressive | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 74.3 |
| 猎人 | cautious | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 74.4 |
| 猎人 | collector | 12 | 3 | 8 | 1 | 0 | 25.0% | 100.0% | 0 | 0 | 4.1 | 0.0 | 73.1 |
| 猎人 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.1 | 70.7 |
| 猎人 | random | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 77.8 |
| 陷阱师 | aggressive | 12 | 3 | 9 | 0 | 0 | 25.0% | 100.0% | 0 | 0 | 3.0 | 0.0 | 73.7 |
| 陷阱师 | cautious | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 3.6 | 0.2 | 82.8 |
| 陷阱师 | collector | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 2.8 | 0.3 | 79.3 |
| 陷阱师 | opportunist | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.3 | 0.1 | 77.8 |
| 陷阱师 | random | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.2 | 0.0 | 77.3 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 6.2% | 6.2% | 100.0% | 4.2 | 0.1 | 171.6 |
| 斗士 | 65 | 3.1% | 3.1% | 100.0% | 4.6 | 0.1 | 187.5 |
| 工程师 | 65 | 1.5% | 1.5% | 100.0% | 4.6 | 0.1 | 172.0 |
| 医学生 | 65 | 6.2% | 6.2% | 100.0% | 4.3 | 0.0 | 236.2 |
| 生存专家 | 60 | 8.3% | 8.3% | 100.0% | 4.2 | 0.1 | 179.0 |
| 拾荒者 | 60 | 0.0% | 0.0% | 100.0% | 4.8 | 0.0 | 169.4 |
| 猎人 | 60 | 5.0% | 5.0% | 100.0% | 4.5 | 0.1 | 171.0 |
| 陷阱师 | 60 | 11.7% | 11.7% | 100.0% | 3.4 | 0.1 | 160.9 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 4.0% | 4.0% | 100.0% | 4.3 | 0.1 | 180.3 |
| cautious | 100 | 6.0% | 6.0% | 100.0% | 4.1 | 0.1 | 178.5 |
| collector | 100 | 11.0% | 11.0% | 100.0% | 4.2 | 0.1 | 184.3 |
| opportunist | 100 | 2.0% | 2.0% | 100.0% | 4.6 | 0.1 | 189.3 |
| random | 100 | 3.0% | 3.0% | 100.0% | 4.5 | 0.1 | 174.4 |

################################################################