# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-14T12:58:42.911Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4R

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

- encounters=7301, kills=1844, flees=5670, playerDeaths=54
- damageTaken=98046, groundDrops=2929, pickups=3220, wildCrafts=151
- eliteEncounters=393, eliteKills=0, apexSpawned=331, apexEncounters=5, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"carrion_crow":607,"escaped_subject":485,"venom_snake":478,"feral_dog":1223,"security_hound":460,"hunter_killer_drone":77,"tusked_boar":519,"resin_stalker":374,"scavenger_boar":101,"patrol_drone":738,"maintenance_bot":818,"toxic_experiment":11,"rat_swarm":1201,"riot_control_unit":60,"feral_alpha_hound":65,"armored_repair_bot":79,"iron_tusk":1,"subject_07":3,"prototype_aegis":1}
- encounterByZone: {"commercial":615,"hospital":468,"forest":761,"construction":777,"station":570,"factory":726,"park":514,"underground":523,"warehouse":562,"lab":547,"residential":700,"school":538}
- killsByType: {"carrion_crow":272,"venom_snake":258,"rat_swarm":461,"feral_dog":384,"maintenance_bot":99,"patrol_drone":172,"tusked_boar":85,"security_hound":42,"escaped_subject":54,"resin_stalker":17}
- killsByZone: {"commercial":172,"construction":171,"forest":231,"station":146,"underground":121,"warehouse":131,"school":184,"hospital":112,"residential":256,"park":174,"factory":91,"lab":55}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 6.7% |
| 最低非零胜率 | 1.5% |
| 比值 | 4.33 |
| 阈值 | 2.5 |
| 0 胜率角色 | fighter、hunter |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3423 | 4.7% | 2.0% | **PASS** |
| normal | 51924 | 70.8% | - | - |
| heavy | 18009 | 24.6% | 2.0% | **PASS** |
| 合计 | 73356 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2930 | - | - |
| GUARD 使用率（占全部命令） | 10.8% | 2.0% | **PASS** |
| 防御成功减免次数 | 519 | - | - |
| EXPOSED 施加（重击挥空） | 8193 | - | - |
| EXPOSED 兑现（破绽被击中） | 2370 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 554 |
| prepare_ambush | 496 |
| track_target | 380 |
| emergency_treatment | 337 |
| scout_recon | 336 |
| sort_rare | 320 |
| escape_plan | 318 |
| camp_routine | 301 |
| engineer_reinforce | 299 |
| second_wind | 289 |
| adrenaline | 245 |
| scout_smoke | 211 |
| steady_aim | 184 |
| fighter_focus | 162 |
| medic_regen | 142 |
| field_craft | 55 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 557 | 50 | ✓ |
| rain | 507 | 50 | ✓ |
| emergency_broadcast | 537 | 50 | ✓ |
| medical_alert | 566 | 50 | ✓ |
| research_anomaly | 540 | 50 | ✓ |
| citywide_unrest | 536 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3423 | 2631 | 792 | 76.9% | 76.4% | 0.44 | ✓ | 10483 | 4.0 |
| normal | 51924 | 35514 | 16410 | 68.4% | 67.6% | 0.79 | ✓ | 202205 | 5.7 |
| heavy | 18009 | 9816 | 8193 | 54.5% | 54.0% | 0.53 | ✓ | 95268 | 9.7 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2930 |
| 防御成功触发（减免伤害） | 519 |
| 减免伤害总量 | 2127 |
| 平均每次减免 | 4.1 |
| 重击落空（Heavy Miss） | 8193 |
| EXPOSED 施加 | 8193 |
| EXPOSED 兑现（被击中） | 2370 |
| EXPOSED 未兑现失效 | 2688 |
| EXPOSED 兑现时额外伤害总量 | 1982 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 66 | 270 | 遭遇先手次数：0 |
| 肾上腺素 | 50 | 195 | 覆盖攻击 311 · 额外伤害 355 · 省体力 311 · 自伤 22 |
| 现场加工 | 55 | 0 | 免费合成 5 · 省体力 5 |
| 应急处理 | 63 | 274 | 即时治疗 843 · 治疗品额外 44 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 557 | 受影响搜索 1320 · 遭遇权重降低 1194 · 空手权重提高 1320 |
| 暴雨 | 507 | 受影响移动 1645 · 额外体力 1645 · 远程攻击 3334 |
| 广播 | 537 | 广播区域数：537 |
| 医疗警报 | 566 | 受影响治疗 10 · 额外治疗 74 |
| 研究异常 | 540 | 伤害 tick 748 · 总伤害 2234 · 致死 12 |
| 全域骚动 | 536 | 阻止噪音衰减 7517 · 搜索噪音加成 613 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 2.6% |
| 败率 | 88.2% |
| 平局率 | 9.2% |
| 超时率 | 0.0% |
| 存活率 | 2.6% |
| 胜利路线 | {"last_survivor":454,"none":46} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 74.7 时间单位 |
| 平均名次 | 4.4（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 51.9 |
| 平均承受伤害 | 182.9 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 回收场巨獠攻击 | 1 |
| 安保机器犬攻击 | 9 |
| 战斗 | 296 |
| 树脂寄生兽攻击 | 1 |
| 毒性实验体攻击 | 3 |
| 毒蛇攻击 | 2 |
| 猎杀无人机攻击 | 4 |
| 獠牙野猪攻击 | 4 |
| 研究设施异常 | 2 |
| 禁区侵蚀 | 95 |
| 腐食乌鸦攻击 | 1 |
| 衰竭 | 40 |
| 巡逻无人机攻击 | 8 |
| 逃逸实验体攻击 | 6 |
| 野化猎犬攻击 | 8 |
| 镇暴控制单元攻击 | 1 |
| 鼠群攻击 | 6 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.9 | 0.0 | 79.2 |
| 侦察员 | cautious | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 3.9 | 0.0 | 75.4 |
| 侦察员 | collector | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 73.8 |
| 侦察员 | opportunist | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.0 | 72.7 |
| 侦察员 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 73.1 |
| 斗士 | aggressive | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.0 | 65.0 |
| 斗士 | cautious | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.2 | 70.0 |
| 斗士 | collector | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 74.5 |
| 斗士 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 71.5 |
| 斗士 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.1 | 68.1 |
| 工程师 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 75.8 |
| 工程师 | cautious | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 72.9 |
| 工程师 | collector | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.4 | 0.0 | 77.0 |
| 工程师 | opportunist | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.1 | 71.4 |
| 工程师 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 72.6 |
| 医学生 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.1 | 77.8 |
| 医学生 | cautious | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 76.6 |
| 医学生 | collector | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.2 | 0.2 | 76.0 |
| 医学生 | opportunist | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 76.3 |
| 医学生 | random | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.2 | 0.0 | 74.5 |
| 生存专家 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 76.7 |
| 生存专家 | cautious | 12 | 2 | 10 | 0 | 0 | 16.7% | 100.0% | 0 | 0 | 3.6 | 0.1 | 79.8 |
| 生存专家 | collector | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.1 | 0.1 | 84.1 |
| 生存专家 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 76.3 |
| 生存专家 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 71.5 |
| 拾荒者 | aggressive | 12 | 0 | 8 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.0 | 70.1 |
| 拾荒者 | cautious | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.1 | 72.8 |
| 拾荒者 | collector | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.7 | 0.3 | 78.7 |
| 拾荒者 | opportunist | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.2 | 76.1 |
| 拾荒者 | random | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.1 | 70.8 |
| 猎人 | aggressive | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 72.6 |
| 猎人 | cautious | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.1 | 77.1 |
| 猎人 | collector | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.4 | 79.3 |
| 猎人 | opportunist | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 73.4 |
| 猎人 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 73.9 |
| 陷阱师 | aggressive | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.0 | 70.3 |
| 陷阱师 | cautious | 12 | 3 | 8 | 1 | 0 | 25.0% | 100.0% | 0 | 0 | 2.9 | 0.0 | 76.7 |
| 陷阱师 | collector | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.5 | 0.0 | 80.8 |
| 陷阱师 | opportunist | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.0 | 0.0 | 79.3 |
| 陷阱师 | random | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 76.1 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 3.1% | 3.1% | 100.0% | 4.7 | 0.0 | 172.1 |
| 斗士 | 65 | 0.0% | 0.0% | 100.0% | 4.5 | 0.1 | 182.4 |
| 工程师 | 65 | 1.5% | 1.5% | 100.0% | 4.5 | 0.0 | 176.4 |
| 医学生 | 65 | 3.1% | 3.1% | 100.0% | 4.5 | 0.1 | 236.3 |
| 生存专家 | 60 | 5.0% | 5.0% | 100.0% | 4.0 | 0.1 | 182.4 |
| 拾荒者 | 60 | 1.7% | 1.7% | 100.0% | 4.7 | 0.1 | 171.2 |
| 猎人 | 60 | 0.0% | 0.0% | 100.0% | 4.6 | 0.1 | 172.3 |
| 陷阱师 | 60 | 6.7% | 6.7% | 100.0% | 3.7 | 0.0 | 167.2 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 1.0% | 1.0% | 100.0% | 4.4 | 0.0 | 179.4 |
| cautious | 100 | 6.0% | 6.0% | 100.0% | 4.2 | 0.1 | 181.1 |
| collector | 100 | 4.0% | 4.0% | 100.0% | 4.2 | 0.2 | 188.7 |
| opportunist | 100 | 1.0% | 1.0% | 100.0% | 4.6 | 0.1 | 185.5 |
| random | 100 | 1.0% | 1.0% | 100.0% | 4.6 | 0.0 | 179.9 |

################################################################