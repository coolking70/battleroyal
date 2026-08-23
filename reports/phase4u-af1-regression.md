# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-23T15:25:38.568Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4U-AF1

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

- encounters=7517, kills=1876, flees=5927, playerDeaths=53
- damageTaken=95712, groundDrops=3033, pickups=3378, wildCrafts=152
- eliteEncounters=378, eliteKills=0, apexSpawned=344, apexEncounters=7, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"escaped_subject":516,"maintenance_bot":924,"security_hound":506,"feral_dog":1060,"carrion_crow":676,"resin_stalker":348,"armored_repair_bot":78,"rat_swarm":1304,"patrol_drone":813,"venom_snake":458,"tusked_boar":527,"feral_alpha_hound":90,"scavenger_boar":84,"riot_control_unit":40,"toxic_experiment":17,"hunter_killer_drone":69,"iron_tusk":4,"prototype_aegis":3}
- encounterByZone: {"lab":580,"construction":807,"factory":763,"residential":766,"school":438,"underground":590,"commercial":614,"station":596,"forest":727,"park":542,"warehouse":619,"hospital":475}
- killsByType: {"feral_dog":371,"rat_swarm":505,"patrol_drone":191,"venom_snake":243,"escaped_subject":43,"tusked_boar":107,"carrion_crow":268,"security_hound":45,"resin_stalker":7,"maintenance_bot":96}
- killsByZone: {"residential":266,"factory":94,"construction":186,"park":200,"lab":47,"forest":225,"commercial":189,"warehouse":137,"school":143,"station":157,"underground":109,"hospital":123}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 6.7% |
| 最低非零胜率 | 1.7% |
| 比值 | 4.00 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3501 | 4.7% | 2.0% | **PASS** |
| normal | 52755 | 70.9% | - | - |
| heavy | 18121 | 24.4% | 2.0% | **PASS** |
| 合计 | 74377 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2791 | - | - |
| GUARD 使用率（占全部命令） | 10.2% | 2.0% | **PASS** |
| 防御成功减免次数 | 524 | - | - |
| EXPOSED 施加（重击挥空） | 7983 | - | - |
| EXPOSED 兑现（破绽被击中） | 2355 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 561 |
| prepare_ambush | 474 |
| track_target | 389 |
| scout_recon | 346 |
| sort_rare | 346 |
| emergency_treatment | 338 |
| escape_plan | 325 |
| camp_routine | 320 |
| second_wind | 313 |
| engineer_reinforce | 288 |
| scout_smoke | 252 |
| adrenaline | 232 |
| steady_aim | 190 |
| medic_regen | 161 |
| fighter_focus | 158 |
| field_craft | 50 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 576 | 50 | ✓ |
| rain | 547 | 50 | ✓ |
| emergency_broadcast | 515 | 50 | ✓ |
| medical_alert | 565 | 50 | ✓ |
| research_anomaly | 522 | 50 | ✓ |
| citywide_unrest | 548 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3501 | 2685 | 816 | 76.7% | 76.9% | 0.20 | ✓ | 10637 | 4.0 |
| normal | 52755 | 36017 | 16738 | 68.3% | 67.6% | 0.65 | ✓ | 204770 | 5.7 |
| heavy | 18121 | 10138 | 7983 | 55.9% | 54.1% | 1.80 | ✓ | 98975 | 9.8 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2791 |
| 防御成功触发（减免伤害） | 524 |
| 减免伤害总量 | 2025 |
| 平均每次减免 | 3.9 |
| 重击落空（Heavy Miss） | 7983 |
| EXPOSED 施加 | 7983 |
| EXPOSED 兑现（被击中） | 2355 |
| EXPOSED 未兑现失效 | 2682 |
| EXPOSED 兑现时额外伤害总量 | 1967 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 66 | 280 | 遭遇先手次数：0 |
| 肾上腺素 | 44 | 188 | 覆盖攻击 305 · 额外伤害 309 · 省体力 305 · 自伤 19 |
| 现场加工 | 50 | 0 | 免费合成 2 · 省体力 2 |
| 应急处理 | 65 | 273 | 即时治疗 880 · 治疗品额外 44 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 576 | 受影响搜索 1383 · 遭遇权重降低 1270 · 空手权重提高 1383 |
| 暴雨 | 547 | 受影响移动 1680 · 额外体力 1680 · 远程攻击 3564 |
| 广播 | 515 | 广播区域数：515 |
| 医疗警报 | 565 | 受影响治疗 3 · 额外治疗 9 |
| 研究异常 | 522 | 伤害 tick 742 · 总伤害 2222 · 致死 5 |
| 全域骚动 | 548 | 阻止噪音衰减 7587 · 搜索噪音加成 595 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 531961 |
| memory evictions | 85494 (16.1%) |
| intent commit / preserve | 19228 / 136722 |
| intent reevaluate / complete / invalidate | 16466 / 11150 / 5423 |
| commit ratio per observed NPC intent turn | 12.3% |
| remembered source failures | 5754 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 49 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 2000 / 1821 |
| incident resolved / expired | 39 / 1413 |
| incident public broadcasts | 877 |
| incident local discoveries | 15500 |
| incident responses | 68 |
| incident rewards claimed | 40 |
| incident contention failures | 0 |
| incident intent commits / preserves | 1006 / 1184 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 4.6% |
| 败率 | 83.8% |
| 平局率 | 11.6% |
| 超时率 | 0.0% |
| 存活率 | 4.6% |
| 胜利路线 | {"last_survivor":442,"none":58} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 75.9 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 53.2 |
| 平均承受伤害 | 180.5 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 回收场巨獠攻击 | 2 |
| 失控维修机攻击 | 2 |
| 安保机器犬攻击 | 9 |
| 战斗 | 288 |
| 树脂寄生兽攻击 | 2 |
| 猎杀无人机攻击 | 1 |
| 獠牙野猪攻击 | 3 |
| 研究设施异常 | 2 |
| 禁区侵蚀 | 80 |
| 腐食乌鸦攻击 | 5 |
| 衰竭 | 52 |
| 装甲维修机攻击 | 1 |
| 巡逻无人机攻击 | 7 |
| 逃逸实验体攻击 | 7 |
| 野化猎犬攻击 | 5 |
| 野外毒伤 | 2 |
| 阿尔法猎犬攻击 | 1 |
| 鼠群攻击 | 8 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 77.6 |
| 侦察员 | cautious | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.9 | 0.1 | 81.8 |
| 侦察员 | collector | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 72.5 |
| 侦察员 | opportunist | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 74.3 |
| 侦察员 | random | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 74.5 |
| 斗士 | aggressive | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.5 | 0.0 | 74.5 |
| 斗士 | cautious | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.2 | 72.6 |
| 斗士 | collector | 13 | 2 | 11 | 0 | 0 | 15.4% | 100.0% | 0 | 0 | 4.5 | 0.0 | 67.8 |
| 斗士 | opportunist | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 73.2 |
| 斗士 | random | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.3 | 0.0 | 74.0 |
| 工程师 | aggressive | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 76.7 |
| 工程师 | cautious | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 77.3 |
| 工程师 | collector | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.1 | 0.0 | 73.4 |
| 工程师 | opportunist | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 72.5 |
| 工程师 | random | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 5.1 | 0.1 | 78.3 |
| 医学生 | aggressive | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.5 | 0.1 | 69.4 |
| 医学生 | cautious | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 77.7 |
| 医学生 | collector | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 5.0 | 0.2 | 78.0 |
| 医学生 | opportunist | 13 | 2 | 9 | 2 | 0 | 15.4% | 100.0% | 0 | 0 | 3.8 | 0.0 | 73.7 |
| 医学生 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.7 | 0.1 | 77.8 |
| 生存专家 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.6 | 0.0 | 77.4 |
| 生存专家 | cautious | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.8 | 0.3 | 82.8 |
| 生存专家 | collector | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.1 | 78.5 |
| 生存专家 | opportunist | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.8 | 0.1 | 86.3 |
| 生存专家 | random | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.3 | 70.9 |
| 拾荒者 | aggressive | 12 | 1 | 8 | 3 | 0 | 8.3% | 100.0% | 0 | 0 | 4.8 | 0.0 | 81.7 |
| 拾荒者 | cautious | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.1 | 0.2 | 75.1 |
| 拾荒者 | collector | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.3 | 0.0 | 75.1 |
| 拾荒者 | opportunist | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 5.3 | 0.0 | 78.9 |
| 拾荒者 | random | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.0 | 75.8 |
| 猎人 | aggressive | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.3 | 74.3 |
| 猎人 | cautious | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 74.6 |
| 猎人 | collector | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.4 | 0.2 | 76.2 |
| 猎人 | opportunist | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 5.0 | 0.0 | 82.9 |
| 猎人 | random | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 5.2 | 0.1 | 74.0 |
| 陷阱师 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 72.7 |
| 陷阱师 | cautious | 12 | 2 | 8 | 2 | 0 | 16.7% | 100.0% | 0 | 0 | 3.6 | 0.1 | 82.0 |
| 陷阱师 | collector | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.2 | 0.0 | 74.6 |
| 陷阱师 | opportunist | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 3.5 | 0.2 | 71.6 |
| 陷阱师 | random | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.9 | 0.1 | 75.1 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 3.1% | 3.1% | 100.0% | 4.8 | 0.0 | 171.3 |
| 斗士 | 65 | 4.6% | 4.6% | 100.0% | 4.7 | 0.0 | 179.0 |
| 工程师 | 65 | 6.2% | 6.2% | 100.0% | 4.6 | 0.0 | 173.7 |
| 医学生 | 65 | 6.2% | 6.2% | 100.0% | 4.1 | 0.1 | 230.5 |
| 生存专家 | 60 | 3.3% | 3.3% | 100.0% | 3.8 | 0.1 | 178.1 |
| 拾荒者 | 60 | 5.0% | 5.0% | 100.0% | 4.7 | 0.0 | 166.8 |
| 猎人 | 60 | 1.7% | 1.7% | 100.0% | 4.3 | 0.1 | 172.4 |
| 陷阱师 | 60 | 6.7% | 6.7% | 100.0% | 3.7 | 0.1 | 169.3 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 2.0% | 2.0% | 100.0% | 4.3 | 0.1 | 171.6 |
| cautious | 100 | 7.0% | 7.0% | 100.0% | 4.3 | 0.1 | 180.8 |
| collector | 100 | 7.0% | 7.0% | 100.0% | 4.1 | 0.1 | 191.9 |
| opportunist | 100 | 3.0% | 3.0% | 100.0% | 4.4 | 0.0 | 183.8 |
| random | 100 | 4.0% | 4.0% | 100.0% | 4.5 | 0.1 | 174.3 |

################################################################