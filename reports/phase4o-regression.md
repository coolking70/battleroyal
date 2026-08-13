# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-13T10:51:08.783Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4O-AF2

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

**引擎整体判定：PASS**

> 说明：timeout 在 Step 13 的 `enforceTimeLimit` 落地后会由 `playing → draw` 收束而归零；
> Regression 门槛只要求请求/实际局数一致且引擎健康；角色平衡与 Phase 3A 结果仅作为观察。

## Phase 4N PvE ecology observations

- encounters=7341, kills=1756, flees=6103, playerDeaths=43
- damageTaken=92293, groundDrops=2857, pickups=3185, wildCrafts=104
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"rat_swarm":1293,"venom_snake":461,"feral_dog":1268,"patrol_drone":863,"resin_stalker":359,"maintenance_bot":1010,"tusked_boar":445,"security_hound":428,"carrion_crow":713,"escaped_subject":501}
- encounterByZone: {"hospital":502,"construction":643,"residential":723,"school":653,"station":621,"forest":584,"lab":605,"commercial":568,"factory":745,"warehouse":660,"park":522,"underground":515}
- killsByType: {"venom_snake":197,"rat_swarm":477,"feral_dog":414,"carrion_crow":293,"tusked_boar":54,"patrol_drone":184,"security_hound":32,"escaped_subject":42,"maintenance_bot":58,"resin_stalker":5}
- killsByZone: {"construction":116,"hospital":118,"forest":161,"station":140,"commercial":174,"residential":281,"park":135,"school":244,"underground":109,"warehouse":130,"factory":99,"lab":49}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 9.2% |
| 最低非零胜率 | 1.5% |
| 比值 | 6.00 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3517 | 4.4% | 2.0% | **PASS** |
| normal | 56220 | 70.5% | - | - |
| heavy | 19981 | 25.1% | 2.0% | **PASS** |
| 合计 | 79718 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 3024 | - | - |
| GUARD 使用率（占全部命令） | 10.3% | 2.0% | **PASS** |
| 防御成功减免次数 | 1871 | - | - |
| EXPOSED 施加（重击挥空） | 9109 | - | - |
| EXPOSED 兑现（破绽被击中） | 2812 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 597 |
| prepare_ambush | 571 |
| escape_plan | 415 |
| sort_rare | 401 |
| camp_routine | 390 |
| scout_recon | 377 |
| second_wind | 364 |
| track_target | 360 |
| emergency_treatment | 360 |
| engineer_reinforce | 350 |
| scout_smoke | 300 |
| adrenaline | 244 |
| steady_aim | 185 |
| medic_regen | 178 |
| fighter_focus | 170 |
| field_craft | 75 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 580 | 50 | ✓ |
| rain | 512 | 50 | ✓ |
| emergency_broadcast | 541 | 50 | ✓ |
| medical_alert | 583 | 50 | ✓ |
| research_anomaly | 544 | 50 | ✓ |
| citywide_unrest | 570 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3517 | 2695 | 822 | 76.6% | 76.3% | 0.31 | ✓ | 9506 | 3.5 |
| normal | 56220 | 38400 | 17820 | 68.3% | 67.7% | 0.65 | ✓ | 208251 | 5.4 |
| heavy | 19981 | 10872 | 9109 | 54.4% | 53.5% | 0.87 | ✓ | 94278 | 8.7 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 3024 |
| 防御成功触发（减免伤害） | 1871 |
| 减免伤害总量 | 6594 |
| 平均每次减免 | 3.5 |
| 重击落空（Heavy Miss） | 9109 |
| EXPOSED 施加 | 9109 |
| EXPOSED 兑现（被击中） | 2812 |
| EXPOSED 未兑现失效 | 3134 |
| EXPOSED 兑现时额外伤害总量 | 2276 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 65 | 312 | 遭遇先手次数：0 |
| 肾上腺素 | 53 | 191 | 覆盖攻击 315 · 额外伤害 286 · 省体力 315 · 自伤 32 |
| 现场加工 | 75 | 0 | 免费合成 4 · 省体力 4 |
| 应急处理 | 65 | 295 | 即时治疗 849 · 治疗品额外 40 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 580 | 受影响搜索 1940 · 遭遇权重降低 1738 · 空手权重提高 1940 |
| 暴雨 | 512 | 受影响移动 1533 · 额外体力 1533 · 远程攻击 2744 |
| 广播 | 541 | 广播区域数：540 |
| 医疗警报 | 583 | 受影响治疗 11 · 额外治疗 64 |
| 研究异常 | 544 | 伤害 tick 799 · 总伤害 2386 · 致死 9 |
| 全域骚动 | 570 | 阻止噪音衰减 7986 · 搜索噪音加成 940 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 4.8% |
| 败率 | 83.4% |
| 平局率 | 11.8% |
| 超时率 | 0.0% |
| 存活率 | 4.8% |
| 胜利路线 | {"last_survivor":441,"none":59} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 76.8 时间单位 |
| 平均名次 | 4.2（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 62.2 |
| 平均承受伤害 | 177.4 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 失控维修机攻击 | 4 |
| 安保机器犬攻击 | 4 |
| 战斗 | 259 |
| 树脂寄生兽攻击 | 1 |
| 獠牙野猪攻击 | 3 |
| 研究设施异常 | 4 |
| 禁区侵蚀 | 95 |
| 腐食乌鸦攻击 | 3 |
| 衰竭 | 73 |
| 巡逻无人机攻击 | 10 |
| 逃逸实验体攻击 | 5 |
| 野化猎犬攻击 | 9 |
| 野外毒伤 | 2 |
| 鼠群攻击 | 4 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 75.0 |
| 侦察员 | cautious | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.6 | 0.1 | 66.3 |
| 侦察员 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.2 | 75.2 |
| 侦察员 | opportunist | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.2 | 76.1 |
| 侦察员 | random | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 75.5 |
| 斗士 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 76.2 |
| 斗士 | cautious | 13 | 2 | 9 | 2 | 0 | 15.4% | 100.0% | 0 | 0 | 4.1 | 0.0 | 79.8 |
| 斗士 | collector | 13 | 2 | 8 | 3 | 0 | 15.4% | 100.0% | 0 | 0 | 3.6 | 0.2 | 72.9 |
| 斗士 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 77.8 |
| 斗士 | random | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 70.8 |
| 工程师 | aggressive | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 77.8 |
| 工程师 | cautious | 13 | 0 | 9 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 71.3 |
| 工程师 | collector | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 79.8 |
| 工程师 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 79.0 |
| 工程师 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.1 | 73.7 |
| 医学生 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.1 | 78.5 |
| 医学生 | cautious | 13 | 4 | 8 | 1 | 0 | 30.8% | 100.0% | 0 | 0 | 3.5 | 0.0 | 77.5 |
| 医学生 | collector | 13 | 2 | 11 | 0 | 0 | 15.4% | 100.0% | 0 | 0 | 4.7 | 0.0 | 78.0 |
| 医学生 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 76.8 |
| 医学生 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.2 | 79.1 |
| 生存专家 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 74.6 |
| 生存专家 | cautious | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 2.7 | 0.2 | 80.3 |
| 生存专家 | collector | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.3 | 82.1 |
| 生存专家 | opportunist | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.0 | 80.3 |
| 生存专家 | random | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 80.2 |
| 拾荒者 | aggressive | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 78.7 |
| 拾荒者 | cautious | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.1 | 0.4 | 79.3 |
| 拾荒者 | collector | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 72.2 |
| 拾荒者 | opportunist | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 74.3 |
| 拾荒者 | random | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 76.3 |
| 猎人 | aggressive | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 74.0 |
| 猎人 | cautious | 12 | 1 | 8 | 3 | 0 | 8.3% | 100.0% | 0 | 0 | 4.6 | 0.3 | 75.8 |
| 猎人 | collector | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.5 | 0.1 | 79.9 |
| 猎人 | opportunist | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.4 | 0.2 | 69.4 |
| 猎人 | random | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 78.2 |
| 陷阱师 | aggressive | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.4 | 0.0 | 82.3 |
| 陷阱师 | cautious | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.2 | 0.1 | 84.0 |
| 陷阱师 | collector | 12 | 2 | 7 | 3 | 0 | 16.7% | 100.0% | 0 | 0 | 3.6 | 0.0 | 75.3 |
| 陷阱师 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.3 | 0.1 | 79.7 |
| 陷阱师 | random | 12 | 2 | 10 | 0 | 0 | 16.7% | 100.0% | 0 | 0 | 3.7 | 0.2 | 80.8 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 1.5% | 1.5% | 100.0% | 4.6 | 0.1 | 164.9 |
| 斗士 | 65 | 7.7% | 7.7% | 100.0% | 4.3 | 0.1 | 175.0 |
| 工程师 | 65 | 1.5% | 1.5% | 100.0% | 4.3 | 0.0 | 166.1 |
| 医学生 | 65 | 9.2% | 9.2% | 100.0% | 4.2 | 0.1 | 234.8 |
| 生存专家 | 60 | 3.3% | 3.3% | 100.0% | 3.8 | 0.1 | 174.9 |
| 拾荒者 | 60 | 1.7% | 1.7% | 100.0% | 4.5 | 0.1 | 168.5 |
| 猎人 | 60 | 5.0% | 5.0% | 100.0% | 4.4 | 0.1 | 167.9 |
| 陷阱师 | 60 | 8.3% | 8.3% | 100.0% | 3.4 | 0.1 | 164.5 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 1.0% | 1.0% | 100.0% | 4.3 | 0.0 | 173.2 |
| cautious | 100 | 12.0% | 12.0% | 100.0% | 3.9 | 0.1 | 174.0 |
| collector | 100 | 7.0% | 7.0% | 100.0% | 4.1 | 0.1 | 186.7 |
| opportunist | 100 | 1.0% | 1.0% | 100.0% | 4.4 | 0.1 | 182.9 |
| random | 100 | 3.0% | 3.0% | 100.0% | 4.3 | 0.1 | 170.2 |

################################################################