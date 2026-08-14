# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-14T10:42:26.419Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4Q-AF2

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

- encounters=7595, kills=1751, flees=5971, playerDeaths=58
- damageTaken=93343, groundDrops=2851, pickups=3197, wildCrafts=118
- eliteEncounters=125, eliteKills=0, apexSpawned=345, apexEncounters=10, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"riot_control_unit":27,"feral_dog":1363,"rat_swarm":1393,"patrol_drone":783,"carrion_crow":665,"maintenance_bot":938,"security_hound":452,"tusked_boar":495,"resin_stalker":348,"armored_repair_bot":26,"venom_snake":470,"toxic_experiment":11,"escaped_subject":553,"scavenger_boar":29,"hunter_killer_drone":23,"feral_alpha_hound":9,"prototype_aegis":4,"subject_07":5,"iron_tusk":1}
- encounterByZone: {"commercial":680,"residential":730,"warehouse":734,"lab":633,"construction":559,"park":574,"school":627,"hospital":454,"factory":801,"forest":623,"underground":551,"station":629}
- killsByType: {"rat_swarm":515,"feral_dog":403,"carrion_crow":285,"security_hound":27,"venom_snake":204,"escaped_subject":45,"tusked_boar":42,"resin_stalker":8,"maintenance_bot":69,"patrol_drone":153}
- killsByZone: {"warehouse":155,"residential":277,"factory":100,"park":158,"construction":111,"station":126,"school":202,"underground":111,"forest":158,"hospital":101,"commercial":195,"lab":57}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 8.3% |
| 最低非零胜率 | 3.1% |
| 比值 | 2.71 |
| 阈值 | 2.5 |
| 0 胜率角色 | scavenger |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3522 | 4.5% | 2.0% | **PASS** |
| normal | 54900 | 70.6% | - | - |
| heavy | 19380 | 24.9% | 2.0% | **PASS** |
| 合计 | 77802 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2998 | - | - |
| GUARD 使用率（占全部命令） | 10.4% | 2.0% | **PASS** |
| 防御成功减免次数 | 494 | - | - |
| EXPOSED 施加（重击挥空） | 8777 | - | - |
| EXPOSED 兑现（破绽被击中） | 2719 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 559 |
| prepare_ambush | 521 |
| emergency_treatment | 386 |
| track_target | 382 |
| sort_rare | 372 |
| scout_recon | 362 |
| escape_plan | 359 |
| camp_routine | 350 |
| engineer_reinforce | 339 |
| second_wind | 337 |
| scout_smoke | 324 |
| adrenaline | 244 |
| medic_regen | 187 |
| fighter_focus | 181 |
| steady_aim | 181 |
| field_craft | 64 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 573 | 50 | ✓ |
| rain | 558 | 50 | ✓ |
| emergency_broadcast | 559 | 50 | ✓ |
| medical_alert | 516 | 50 | ✓ |
| research_anomaly | 518 | 50 | ✓ |
| citywide_unrest | 549 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3522 | 2709 | 813 | 76.9% | 76.8% | 0.13 | ✓ | 9903 | 3.7 |
| normal | 54900 | 37721 | 17179 | 68.7% | 67.7% | 1.04 | ✓ | 205642 | 5.5 |
| heavy | 19380 | 10603 | 8777 | 54.7% | 53.6% | 1.12 | ✓ | 93942 | 8.9 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2998 |
| 防御成功触发（减免伤害） | 494 |
| 减免伤害总量 | 1653 |
| 平均每次减免 | 3.3 |
| 重击落空（Heavy Miss） | 8777 |
| EXPOSED 施加 | 8777 |
| EXPOSED 兑现（被击中） | 2719 |
| EXPOSED 未兑现失效 | 2944 |
| EXPOSED 兑现时额外伤害总量 | 2230 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 65 | 297 | 遭遇先手次数：0 |
| 肾上腺素 | 50 | 194 | 覆盖攻击 335 · 额外伤害 308 · 省体力 335 · 自伤 17 |
| 现场加工 | 64 | 0 | 免费合成 10 · 省体力 10 |
| 应急处理 | 67 | 319 | 即时治疗 909 · 治疗品额外 52 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 573 | 受影响搜索 1966 · 遭遇权重降低 1821 · 空手权重提高 1966 |
| 暴雨 | 558 | 受影响移动 1839 · 额外体力 1839 · 远程攻击 2608 |
| 广播 | 559 | 广播区域数：559 |
| 医疗警报 | 516 | 受影响治疗 6 · 额外治疗 35 |
| 研究异常 | 518 | 伤害 tick 919 · 总伤害 2743 · 致死 13 |
| 全域骚动 | 549 | 阻止噪音衰减 7848 · 搜索噪音加成 851 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 4.4% |
| 败率 | 84.4% |
| 平局率 | 11.2% |
| 超时率 | 0.0% |
| 存活率 | 4.4% |
| 胜利路线 | {"last_survivor":444,"none":56} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 76.0 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 59.3 |
| 平均承受伤害 | 181.5 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 命名实验体 07攻击 | 1 |
| 安保机器犬攻击 | 1 |
| 战斗 | 249 |
| 树脂寄生兽攻击 | 2 |
| 毒蛇攻击 | 1 |
| 猎杀无人机攻击 | 6 |
| 獠牙野猪攻击 | 8 |
| 研究设施异常 | 6 |
| 禁区侵蚀 | 111 |
| 腐食乌鸦攻击 | 5 |
| 衰竭 | 52 |
| 巡逻无人机攻击 | 8 |
| 逃逸实验体攻击 | 7 |
| 野化猎犬攻击 | 9 |
| 野外毒伤 | 2 |
| 铁牙攻击 | 1 |
| 阿尔法猎犬攻击 | 2 |
| 鼠群攻击 | 7 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 80.5 |
| 侦察员 | cautious | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 3.9 | 0.0 | 70.5 |
| 侦察员 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.1 | 77.3 |
| 侦察员 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 70.2 |
| 侦察员 | random | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.4 | 0.0 | 72.2 |
| 斗士 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 73.9 |
| 斗士 | cautious | 13 | 1 | 9 | 3 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.2 | 76.7 |
| 斗士 | collector | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.2 | 73.2 |
| 斗士 | opportunist | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.8 | 0.0 | 67.4 |
| 斗士 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 74.5 |
| 工程师 | aggressive | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 3.8 | 0.2 | 77.2 |
| 工程师 | cautious | 13 | 3 | 8 | 2 | 0 | 23.1% | 100.0% | 0 | 0 | 3.5 | 0.1 | 79.5 |
| 工程师 | collector | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.1 | 0.0 | 74.0 |
| 工程师 | opportunist | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.2 | 81.5 |
| 工程师 | random | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.0 | 73.9 |
| 医学生 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 71.6 |
| 医学生 | cautious | 13 | 1 | 9 | 3 | 0 | 7.7% | 100.0% | 0 | 0 | 3.9 | 0.2 | 78.7 |
| 医学生 | collector | 13 | 2 | 9 | 2 | 0 | 15.4% | 100.0% | 0 | 0 | 3.5 | 0.0 | 82.2 |
| 医学生 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 73.3 |
| 医学生 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.0 | 77.5 |
| 生存专家 | aggressive | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.1 | 0.3 | 74.4 |
| 生存专家 | cautious | 12 | 1 | 8 | 3 | 0 | 8.3% | 100.0% | 0 | 0 | 3.3 | 0.2 | 75.3 |
| 生存专家 | collector | 12 | 1 | 8 | 3 | 0 | 8.3% | 100.0% | 0 | 0 | 4.2 | 0.2 | 75.8 |
| 生存专家 | opportunist | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 77.3 |
| 生存专家 | random | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 76.1 |
| 拾荒者 | aggressive | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 77.8 |
| 拾荒者 | cautious | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.9 | 0.2 | 72.6 |
| 拾荒者 | collector | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.2 | 76.0 |
| 拾荒者 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 73.3 |
| 拾荒者 | random | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.1 | 79.3 |
| 猎人 | aggressive | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.6 | 0.2 | 72.0 |
| 猎人 | cautious | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.1 | 0.1 | 76.4 |
| 猎人 | collector | 12 | 2 | 8 | 2 | 0 | 16.7% | 100.0% | 0 | 0 | 3.4 | 0.3 | 79.0 |
| 猎人 | opportunist | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.3 | 0.2 | 73.2 |
| 猎人 | random | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 74.4 |
| 陷阱师 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.6 | 0.0 | 83.4 |
| 陷阱师 | cautious | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.4 | 0.3 | 77.3 |
| 陷阱师 | collector | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.6 | 0.0 | 81.4 |
| 陷阱师 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.1 | 75.3 |
| 陷阱师 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 83.8 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 3.1% | 3.1% | 100.0% | 4.4 | 0.0 | 169.1 |
| 斗士 | 65 | 3.1% | 3.1% | 100.0% | 4.7 | 0.1 | 181.3 |
| 工程师 | 65 | 7.7% | 7.7% | 100.0% | 4.1 | 0.1 | 167.1 |
| 医学生 | 65 | 4.6% | 4.6% | 100.0% | 4.4 | 0.0 | 236.6 |
| 生存专家 | 60 | 5.0% | 5.0% | 100.0% | 4.0 | 0.1 | 179.0 |
| 拾荒者 | 60 | 0.0% | 0.0% | 100.0% | 4.8 | 0.1 | 172.9 |
| 猎人 | 60 | 8.3% | 8.3% | 100.0% | 4.2 | 0.1 | 174.3 |
| 陷阱师 | 60 | 3.3% | 3.3% | 100.0% | 3.7 | 0.1 | 169.0 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 3.0% | 3.0% | 100.0% | 4.4 | 0.1 | 173.6 |
| cautious | 100 | 9.0% | 9.0% | 100.0% | 3.9 | 0.1 | 178.4 |
| collector | 100 | 7.0% | 7.0% | 100.0% | 4.1 | 0.1 | 190.2 |
| opportunist | 100 | 2.0% | 2.0% | 100.0% | 4.4 | 0.1 | 184.1 |
| random | 100 | 1.0% | 1.0% | 100.0% | 4.7 | 0.0 | 181.0 |

################################################################