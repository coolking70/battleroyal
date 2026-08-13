# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-13T07:30:01.832Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4O-AF

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

- encounters=7578, kills=1831, flees=6146, playerDeaths=50
- damageTaken=94055, groundDrops=2963, pickups=3384, wildCrafts=125
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"maintenance_bot":898,"carrion_crow":651,"venom_snake":567,"security_hound":459,"feral_dog":1250,"escaped_subject":567,"rat_swarm":1407,"patrol_drone":873,"resin_stalker":378,"tusked_boar":528}
- encounterByZone: {"construction":682,"park":583,"factory":804,"residential":765,"underground":599,"school":596,"lab":677,"commercial":581,"forest":624,"station":546,"warehouse":636,"hospital":485}
- killsByType: {"carrion_crow":292,"venom_snake":217,"rat_swarm":542,"patrol_drone":189,"security_hound":27,"feral_dog":389,"escaped_subject":53,"maintenance_bot":60,"tusked_boar":49,"resin_stalker":13}
- killsByZone: {"park":157,"underground":124,"construction":130,"factory":114,"commercial":158,"lab":62,"hospital":122,"school":231,"residential":286,"station":133,"warehouse":151,"forest":163}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 8.3% |
| 最低非零胜率 | 1.5% |
| 比值 | 5.42 |
| 阈值 | 2.5 |
| 0 胜率角色 | engineer |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3511 | 4.4% | 2.0% | **PASS** |
| normal | 55775 | 70.5% | - | - |
| heavy | 19848 | 25.1% | 2.0% | **PASS** |
| 合计 | 79134 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2953 | - | - |
| GUARD 使用率（占全部命令） | 10.2% | 2.0% | **PASS** |
| 防御成功减免次数 | 1896 | - | - |
| EXPOSED 施加（重击挥空） | 8934 | - | - |
| EXPOSED 兑现（破绽被击中） | 2814 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| prepare_ambush | 636 |
| scavenge_focus | 590 |
| escape_plan | 439 |
| sort_rare | 383 |
| emergency_treatment | 375 |
| scout_recon | 365 |
| track_target | 352 |
| engineer_reinforce | 347 |
| scout_smoke | 306 |
| camp_routine | 302 |
| second_wind | 295 |
| adrenaline | 255 |
| medic_regen | 195 |
| fighter_focus | 168 |
| steady_aim | 167 |
| field_craft | 61 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 538 | 50 | ✓ |
| rain | 520 | 50 | ✓ |
| emergency_broadcast | 542 | 50 | ✓ |
| medical_alert | 522 | 50 | ✓ |
| research_anomaly | 563 | 50 | ✓ |
| citywide_unrest | 587 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3511 | 2707 | 804 | 77.1% | 76.4% | 0.70 | ✓ | 9640 | 3.6 |
| normal | 55775 | 37996 | 17779 | 68.1% | 67.5% | 0.67 | ✓ | 208220 | 5.5 |
| heavy | 19848 | 10914 | 8934 | 55.0% | 53.3% | 1.66 | ✓ | 93195 | 8.5 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2953 |
| 防御成功触发（减免伤害） | 1896 |
| 减免伤害总量 | 6962 |
| 平均每次减免 | 3.7 |
| 重击落空（Heavy Miss） | 8934 |
| EXPOSED 施加 | 8934 |
| EXPOSED 兑现（被击中） | 2814 |
| EXPOSED 未兑现失效 | 3017 |
| EXPOSED 兑现时额外伤害总量 | 2151 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 66 | 299 | 遭遇先手次数：0 |
| 肾上腺素 | 49 | 206 | 覆盖攻击 316 · 额外伤害 309 · 省体力 316 · 自伤 22 |
| 现场加工 | 61 | 0 | 免费合成 3 · 省体力 3 |
| 应急处理 | 64 | 311 | 即时治疗 885 · 治疗品额外 39 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 538 | 受影响搜索 1850 · 遭遇权重降低 1665 · 空手权重提高 1850 |
| 暴雨 | 520 | 受影响移动 1659 · 额外体力 1659 · 远程攻击 2517 |
| 广播 | 542 | 广播区域数：542 |
| 医疗警报 | 522 | 受影响治疗 8 · 额外治疗 32 |
| 研究异常 | 563 | 伤害 tick 860 · 总伤害 2569 · 致死 10 |
| 全域骚动 | 587 | 阻止噪音衰减 8264 · 搜索噪音加成 948 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 4.0% |
| 败率 | 85.6% |
| 平局率 | 10.4% |
| 超时率 | 0.0% |
| 存活率 | 4.0% |
| 胜利路线 | {"last_survivor":448,"none":52} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 76.2 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 64.4 |
| 平均承受伤害 | 178.3 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 失控维修机攻击 | 3 |
| 安保机器犬攻击 | 3 |
| 战斗 | 264 |
| 獠牙野猪攻击 | 2 |
| 研究设施异常 | 1 |
| 禁区侵蚀 | 98 |
| 腐食乌鸦攻击 | 1 |
| 衰竭 | 63 |
| 巡逻无人机攻击 | 10 |
| 逃逸实验体攻击 | 14 |
| 野化猎犬攻击 | 9 |
| 野外毒伤 | 4 |
| 鼠群攻击 | 8 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.3 | 72.2 |
| 侦察员 | cautious | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 79.3 |
| 侦察员 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.2 | 76.2 |
| 侦察员 | opportunist | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.0 | 76.4 |
| 侦察员 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.4 | 0.0 | 79.1 |
| 斗士 | aggressive | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.4 | 0.0 | 77.0 |
| 斗士 | cautious | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.1 | 73.4 |
| 斗士 | collector | 13 | 2 | 10 | 1 | 0 | 15.4% | 100.0% | 0 | 0 | 4.0 | 0.0 | 76.4 |
| 斗士 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 77.2 |
| 斗士 | random | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.4 | 0.2 | 80.8 |
| 工程师 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.2 | 80.7 |
| 工程师 | cautious | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 73.5 |
| 工程师 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.2 | 74.8 |
| 工程师 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.3 | 77.7 |
| 工程师 | random | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.2 | 69.9 |
| 医学生 | aggressive | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.4 | 0.0 | 75.2 |
| 医学生 | cautious | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.0 | 71.9 |
| 医学生 | collector | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.2 | 78.9 |
| 医学生 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.2 | 0.0 | 75.4 |
| 医学生 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.1 | 76.3 |
| 生存专家 | aggressive | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.6 | 0.1 | 78.2 |
| 生存专家 | cautious | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 3.6 | 0.1 | 78.8 |
| 生存专家 | collector | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.6 | 0.2 | 80.1 |
| 生存专家 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 76.1 |
| 生存专家 | random | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.5 | 0.0 | 73.2 |
| 拾荒者 | aggressive | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 4.3 | 0.0 | 74.6 |
| 拾荒者 | cautious | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.7 | 0.2 | 74.8 |
| 拾荒者 | collector | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.2 | 78.1 |
| 拾荒者 | opportunist | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 5.6 | 0.0 | 75.2 |
| 拾荒者 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 80.3 |
| 猎人 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.0 |
| 猎人 | cautious | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.3 | 72.0 |
| 猎人 | collector | 12 | 0 | 7 | 5 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 75.6 |
| 猎人 | opportunist | 12 | 1 | 8 | 3 | 0 | 8.3% | 100.0% | 0 | 0 | 4.3 | 0.1 | 71.3 |
| 猎人 | random | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.2 | 68.7 |
| 陷阱师 | aggressive | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.3 | 0.3 | 76.3 |
| 陷阱师 | cautious | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.3 | 0.2 | 83.7 |
| 陷阱师 | collector | 12 | 1 | 8 | 3 | 0 | 8.3% | 100.0% | 0 | 0 | 3.4 | 0.2 | 76.1 |
| 陷阱师 | opportunist | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 3.4 | 0.2 | 77.5 |
| 陷阱师 | random | 12 | 2 | 10 | 0 | 0 | 16.7% | 100.0% | 0 | 0 | 3.4 | 0.2 | 81.0 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 1.5% | 1.5% | 100.0% | 4.8 | 0.1 | 163.0 |
| 斗士 | 65 | 6.2% | 6.2% | 100.0% | 4.4 | 0.0 | 176.9 |
| 工程师 | 65 | 0.0% | 0.0% | 100.0% | 4.4 | 0.2 | 178.2 |
| 医学生 | 65 | 1.5% | 1.5% | 100.0% | 4.8 | 0.0 | 234.9 |
| 生存专家 | 60 | 8.3% | 8.3% | 100.0% | 3.7 | 0.1 | 165.3 |
| 拾荒者 | 60 | 5.0% | 5.0% | 100.0% | 4.5 | 0.1 | 168.3 |
| 猎人 | 60 | 1.7% | 1.7% | 100.0% | 4.5 | 0.1 | 170.2 |
| 陷阱师 | 60 | 8.3% | 8.3% | 100.0% | 3.4 | 0.2 | 166.4 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 6.0% | 6.0% | 100.0% | 4.1 | 0.1 | 172.9 |
| cautious | 100 | 4.0% | 4.0% | 100.0% | 4.2 | 0.1 | 180.9 |
| collector | 100 | 4.0% | 4.0% | 100.0% | 4.2 | 0.1 | 179.3 |
| opportunist | 100 | 2.0% | 2.0% | 100.0% | 4.6 | 0.1 | 182.7 |
| random | 100 | 4.0% | 4.0% | 100.0% | 4.5 | 0.1 | 175.7 |

################################################################