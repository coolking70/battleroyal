# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-17T23:58:38.079Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4T

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

- encounters=7565, kills=1969, flees=5783, playerDeaths=60
- damageTaken=97151, groundDrops=3150, pickups=3447, wildCrafts=144
- eliteEncounters=390, eliteKills=0, apexSpawned=338, apexEncounters=8, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"rat_swarm":1245,"hunter_killer_drone":64,"maintenance_bot":892,"feral_dog":1157,"venom_snake":577,"security_hound":416,"patrol_drone":729,"carrion_crow":731,"escaped_subject":464,"armored_repair_bot":63,"feral_alpha_hound":93,"tusked_boar":583,"scavenger_boar":130,"riot_control_unit":31,"resin_stalker":373,"subject_07":6,"toxic_experiment":9,"iron_tusk":1,"prototype_aegis":1}
- encounterByZone: {"factory":721,"construction":796,"residential":710,"forest":898,"warehouse":624,"park":581,"station":591,"commercial":587,"hospital":435,"school":522,"underground":539,"lab":561}
- killsByType: {"venom_snake":297,"feral_dog":378,"carrion_crow":301,"security_hound":33,"escaped_subject":57,"rat_swarm":516,"tusked_boar":95,"patrol_drone":183,"resin_stalker":19,"maintenance_bot":90}
- killsByZone: {"park":201,"forest":262,"commercial":199,"construction":174,"hospital":117,"residential":242,"underground":111,"school":181,"lab":68,"station":165,"warehouse":144,"factory":105}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 6.7% |
| 最低非零胜率 | 1.5% |
| 比值 | 4.33 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3250 | 4.4% | 2.0% | **PASS** |
| normal | 52216 | 70.7% | - | - |
| heavy | 18432 | 24.9% | 2.0% | **PASS** |
| 合计 | 73898 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2649 | - | - |
| GUARD 使用率（占全部命令） | 9.7% | 2.0% | **PASS** |
| 防御成功减免次数 | 460 | - | - |
| EXPOSED 施加（重击挥空） | 8462 | - | - |
| EXPOSED 兑现（破绽被击中） | 2495 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 545 |
| prepare_ambush | 496 |
| track_target | 365 |
| scout_recon | 364 |
| emergency_treatment | 348 |
| escape_plan | 343 |
| sort_rare | 335 |
| camp_routine | 319 |
| second_wind | 305 |
| engineer_reinforce | 283 |
| scout_smoke | 267 |
| adrenaline | 267 |
| fighter_focus | 183 |
| medic_regen | 177 |
| steady_aim | 166 |
| field_craft | 41 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 535 | 50 | ✓ |
| rain | 535 | 50 | ✓ |
| emergency_broadcast | 561 | 50 | ✓ |
| medical_alert | 498 | 50 | ✓ |
| research_anomaly | 553 | 50 | ✓ |
| citywide_unrest | 564 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3250 | 2486 | 764 | 76.5% | 75.8% | 0.73 | ✓ | 9905 | 4.0 |
| normal | 52216 | 35589 | 16627 | 68.2% | 67.5% | 0.62 | ✓ | 205976 | 5.8 |
| heavy | 18432 | 9970 | 8462 | 54.1% | 53.7% | 0.38 | ✓ | 98340 | 9.9 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2649 |
| 防御成功触发（减免伤害） | 460 |
| 减免伤害总量 | 2007 |
| 平均每次减免 | 4.4 |
| 重击落空（Heavy Miss） | 8462 |
| EXPOSED 施加 | 8462 |
| EXPOSED 兑现（被击中） | 2495 |
| EXPOSED 未兑现失效 | 2732 |
| EXPOSED 兑现时额外伤害总量 | 2053 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 66 | 298 | 遭遇先手次数：0 |
| 肾上腺素 | 49 | 218 | 覆盖攻击 355 · 额外伤害 348 · 省体力 355 · 自伤 18 |
| 现场加工 | 41 | 0 | 免费合成 6 · 省体力 6 |
| 应急处理 | 65 | 283 | 即时治疗 859 · 治疗品额外 55 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 535 | 受影响搜索 1354 · 遭遇权重降低 1250 · 空手权重提高 1354 |
| 暴雨 | 535 | 受影响移动 1773 · 额外体力 1773 · 远程攻击 3512 |
| 广播 | 561 | 广播区域数：561 |
| 医疗警报 | 498 | 受影响治疗 10 · 额外治疗 73 |
| 研究异常 | 553 | 伤害 tick 874 · 总伤害 2615 · 致死 9 |
| 全域骚动 | 564 | 阻止噪音衰减 7957 · 搜索噪音加成 711 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 527669 |
| memory evictions | 85336 (16.2%) |
| intent commit / preserve | 19131 / 136184 |
| intent reevaluate / complete / invalidate | 16037 / 9939 / 6692 |
| commit ratio per observed NPC intent turn | 12.3% |
| remembered source failures | 5663 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 18 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 2000 / 1799 |
| incident resolved / expired | 46 / 1365 |
| incident public broadcasts | 875 |
| incident local discoveries | 15595 |
| incident responses | 58 |
| incident rewards claimed | 42 |
| incident contention failures | 0 |
| incident intent commits / preserves | 273 / 767 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 2.8% |
| 败率 | 86.0% |
| 平局率 | 11.2% |
| 超时率 | 0.0% |
| 存活率 | 2.8% |
| 胜利路线 | {"last_survivor":444,"none":56} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 75.3 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 57.1 |
| 平均承受伤害 | 182.3 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 阿尔法猎犬攻击 | 3 |
| 安保机器犬攻击 | 7 |
| 毒蛇攻击 | 1 |
| 腐食乌鸦攻击 | 3 |
| 回收场巨獠攻击 | 2 |
| 禁区侵蚀 | 88 |
| 獠牙野猪攻击 | 1 |
| 猎杀无人机攻击 | 2 |
| 失控维修机攻击 | 4 |
| 鼠群攻击 | 5 |
| 树脂寄生兽攻击 | 1 |
| 衰竭 | 49 |
| 逃逸实验体攻击 | 12 |
| 巡逻无人机攻击 | 6 |
| 研究设施异常 | 4 |
| 研究所封堵失败环境风险 | 1 |
| 野化猎犬攻击 | 11 |
| 野外毒伤 | 1 |
| 原型 Aegis攻击 | 1 |
| 战斗 | 283 |
| 镇暴控制单元攻击 | 1 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 70.2 |
| 侦察员 | cautious | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.3 | 72.4 |
| 侦察员 | collector | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.2 | 78.8 |
| 侦察员 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.2 | 72.2 |
| 侦察员 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.2 | 75.8 |
| 斗士 | aggressive | 13 | 1 | 9 | 3 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.0 | 78.4 |
| 斗士 | cautious | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 77.5 |
| 斗士 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 75.9 |
| 斗士 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 80.9 |
| 斗士 | random | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 73.2 |
| 工程师 | aggressive | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 74.8 |
| 工程师 | cautious | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 77.1 |
| 工程师 | collector | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.3 | 77.2 |
| 工程师 | opportunist | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 71.6 |
| 工程师 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.2 | 72.2 |
| 医学生 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.0 | 76.1 |
| 医学生 | cautious | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 75.8 |
| 医学生 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.2 | 79.1 |
| 医学生 | opportunist | 13 | 2 | 9 | 2 | 0 | 15.4% | 100.0% | 0 | 0 | 4.0 | 0.1 | 74.5 |
| 医学生 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.0 | 76.2 |
| 生存专家 | aggressive | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.2 | 74.9 |
| 生存专家 | cautious | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 4.2 | 0.2 | 77.5 |
| 生存专家 | collector | 12 | 3 | 8 | 1 | 0 | 25.0% | 100.0% | 0 | 0 | 3.3 | 0.1 | 74.7 |
| 生存专家 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 70.8 |
| 生存专家 | random | 12 | 0 | 8 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 81.5 |
| 拾荒者 | aggressive | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.8 | 0.1 | 73.3 |
| 拾荒者 | cautious | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 76.7 |
| 拾荒者 | collector | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.0 | 75.3 |
| 拾荒者 | opportunist | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 76.6 |
| 拾荒者 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 73.8 |
| 猎人 | aggressive | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 74.2 |
| 猎人 | cautious | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.3 | 75.8 |
| 猎人 | collector | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.3 | 0.0 | 67.7 |
| 猎人 | opportunist | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 70.6 |
| 猎人 | random | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 78.0 |
| 陷阱师 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.0 | 81.2 |
| 陷阱师 | cautious | 12 | 1 | 8 | 3 | 0 | 8.3% | 100.0% | 0 | 0 | 2.7 | 0.1 | 76.4 |
| 陷阱师 | collector | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.4 | 0.0 | 72.6 |
| 陷阱师 | opportunist | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.1 | 0.0 | 77.8 |
| 陷阱师 | random | 12 | 0 | 7 | 5 | 0 | 0.0% | 100.0% | 0 | 0 | 3.4 | 0.0 | 72.5 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 1.5% | 1.5% | 100.0% | 4.7 | 0.2 | 172.2 |
| 斗士 | 65 | 1.5% | 1.5% | 100.0% | 4.5 | 0.0 | 177.7 |
| 工程师 | 65 | 1.5% | 1.5% | 100.0% | 4.4 | 0.1 | 176.5 |
| 医学生 | 65 | 3.1% | 3.1% | 100.0% | 4.3 | 0.1 | 233.0 |
| 生存专家 | 60 | 6.7% | 6.7% | 100.0% | 4.0 | 0.1 | 182.4 |
| 拾荒者 | 60 | 1.7% | 1.7% | 100.0% | 4.3 | 0.0 | 172.8 |
| 猎人 | 60 | 1.7% | 1.7% | 100.0% | 4.8 | 0.1 | 173.4 |
| 陷阱师 | 60 | 5.0% | 5.0% | 100.0% | 3.5 | 0.0 | 167.6 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 2.0% | 2.0% | 100.0% | 4.2 | 0.1 | 175.0 |
| cautious | 100 | 2.0% | 2.0% | 100.0% | 4.3 | 0.1 | 179.4 |
| collector | 100 | 5.0% | 5.0% | 100.0% | 4.3 | 0.1 | 191.4 |
| opportunist | 100 | 4.0% | 4.0% | 100.0% | 4.4 | 0.1 | 186.1 |
| random | 100 | 1.0% | 1.0% | 100.0% | 4.5 | 0.1 | 179.4 |

################################################################