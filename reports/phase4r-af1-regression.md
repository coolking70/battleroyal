# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-14T18:55:41.601Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4R-AF1

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

- encounters=7535, kills=1908, flees=6017, playerDeaths=48
- damageTaken=95652, groundDrops=3077, pickups=3416, wildCrafts=130
- eliteEncounters=373, eliteKills=0, apexSpawned=329, apexEncounters=5, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"resin_stalker":327,"rat_swarm":1377,"maintenance_bot":836,"escaped_subject":536,"feral_dog":1169,"security_hound":452,"armored_repair_bot":74,"venom_snake":570,"tusked_boar":491,"patrol_drone":713,"scavenger_boar":88,"carrion_crow":686,"feral_alpha_hound":83,"riot_control_unit":38,"hunter_killer_drone":77,"subject_07":2,"toxic_experiment":13,"prototype_aegis":2,"iron_tusk":1}
- encounterByZone: {"lab":588,"residential":659,"construction":736,"hospital":534,"forest":802,"factory":670,"warehouse":676,"station":647,"underground":531,"school":512,"commercial":603,"park":577}
- killsByType: {"maintenance_bot":87,"rat_swarm":487,"security_hound":42,"venom_snake":287,"carrion_crow":288,"tusked_boar":90,"escaped_subject":60,"feral_dog":398,"patrol_drone":156,"resin_stalker":13}
- killsByZone: {"construction":168,"warehouse":130,"factory":91,"forest":266,"commercial":189,"underground":128,"school":169,"lab":54,"hospital":116,"park":197,"residential":260,"station":140}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 4.6% |
| 最低非零胜率 | 1.7% |
| 比值 | 2.77 |
| 阈值 | 2.5 |
| 0 胜率角色 | trapper |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3431 | 4.7% | 2.0% | **PASS** |
| normal | 51870 | 70.6% | - | - |
| heavy | 18188 | 24.7% | 2.0% | **PASS** |
| 合计 | 73489 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 2689 | - | - |
| GUARD 使用率（占全部命令） | 10.0% | 2.0% | **PASS** |
| 防御成功减免次数 | 453 | - | - |
| EXPOSED 施加（重击挥空） | 8140 | - | - |
| EXPOSED 兑现（破绽被击中） | 2414 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 549 |
| prepare_ambush | 486 |
| second_wind | 362 |
| scout_recon | 352 |
| camp_routine | 352 |
| emergency_treatment | 350 |
| sort_rare | 344 |
| track_target | 343 |
| escape_plan | 338 |
| scout_smoke | 278 |
| engineer_reinforce | 276 |
| adrenaline | 248 |
| fighter_focus | 179 |
| steady_aim | 163 |
| medic_regen | 163 |
| field_craft | 41 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 506 | 50 | ✓ |
| rain | 526 | 50 | ✓ |
| emergency_broadcast | 568 | 50 | ✓ |
| medical_alert | 537 | 50 | ✓ |
| research_anomaly | 532 | 50 | ✓ |
| citywide_unrest | 551 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3431 | 2597 | 834 | 75.7% | 76.5% | 0.86 | ✓ | 10511 | 4.0 |
| normal | 51870 | 35151 | 16719 | 67.8% | 67.4% | 0.38 | ✓ | 204969 | 5.8 |
| heavy | 18188 | 10048 | 8140 | 55.2% | 53.9% | 1.36 | ✓ | 98912 | 9.8 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 2689 |
| 防御成功触发（减免伤害） | 453 |
| 减免伤害总量 | 1822 |
| 平均每次减免 | 4.0 |
| 重击落空（Heavy Miss） | 8140 |
| EXPOSED 施加 | 8140 |
| EXPOSED 兑现（被击中） | 2414 |
| EXPOSED 未兑现失效 | 2661 |
| EXPOSED 兑现时额外伤害总量 | 1909 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 66 | 286 | 遭遇先手次数：0 |
| 肾上腺素 | 43 | 205 | 覆盖攻击 349 · 额外伤害 367 · 省体力 349 · 自伤 23 |
| 现场加工 | 41 | 0 | 免费合成 5 · 省体力 5 |
| 应急处理 | 66 | 284 | 即时治疗 868 · 治疗品额外 55 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 506 | 受影响搜索 1302 · 遭遇权重降低 1196 · 空手权重提高 1302 |
| 暴雨 | 526 | 受影响移动 1681 · 额外体力 1681 · 远程攻击 3620 |
| 广播 | 568 | 广播区域数：568 |
| 医疗警报 | 537 | 受影响治疗 7 · 额外治疗 64 |
| 研究异常 | 532 | 伤害 tick 789 · 总伤害 2362 · 致死 8 |
| 全域骚动 | 551 | 阻止噪音衰减 7830 · 搜索噪音加成 786 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 3.0% |
| 败率 | 87.0% |
| 平局率 | 10.0% |
| 超时率 | 0.0% |
| 存活率 | 3.0% |
| 胜利路线 | {"last_survivor":450,"none":50} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 74.9 时间单位 |
| 平均名次 | 4.4（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 53.5 |
| 平均承受伤害 | 179.2 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 回收场巨獠攻击 | 1 |
| 失控维修机攻击 | 3 |
| 安保机器犬攻击 | 6 |
| 战斗 | 302 |
| 树脂寄生兽攻击 | 1 |
| 猎杀无人机攻击 | 5 |
| 獠牙野猪攻击 | 1 |
| 研究设施异常 | 2 |
| 禁区侵蚀 | 91 |
| 腐食乌鸦攻击 | 3 |
| 衰竭 | 39 |
| 巡逻无人机攻击 | 4 |
| 逃逸实验体攻击 | 12 |
| 野化猎犬攻击 | 6 |
| 野外毒伤 | 3 |
| 阿尔法猎犬攻击 | 1 |
| 鼠群攻击 | 5 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.2 | 73.4 |
| 侦察员 | cautious | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 72.5 |
| 侦察员 | collector | 13 | 2 | 11 | 0 | 0 | 15.4% | 100.0% | 0 | 0 | 4.3 | 0.1 | 77.5 |
| 侦察员 | opportunist | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 77.3 |
| 侦察员 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.5 | 0.0 | 74.2 |
| 斗士 | aggressive | 13 | 1 | 9 | 3 | 0 | 7.7% | 100.0% | 0 | 0 | 4.0 | 0.2 | 73.4 |
| 斗士 | cautious | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.1 | 84.5 |
| 斗士 | collector | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.2 | 0.0 | 69.2 |
| 斗士 | opportunist | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.0 | 72.5 |
| 斗士 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.3 | 0.0 | 74.5 |
| 工程师 | aggressive | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.2 | 68.8 |
| 工程师 | cautious | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.2 | 77.2 |
| 工程师 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 67.7 |
| 工程师 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 74.5 |
| 工程师 | random | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.3 | 0.3 | 78.6 |
| 医学生 | aggressive | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.3 | 74.8 |
| 医学生 | cautious | 13 | 2 | 9 | 2 | 0 | 15.4% | 100.0% | 0 | 0 | 4.5 | 0.0 | 80.0 |
| 医学生 | collector | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.8 | 0.0 | 76.4 |
| 医学生 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 70.0 |
| 医学生 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.2 | 69.1 |
| 生存专家 | aggressive | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 3.7 | 0.1 | 79.8 |
| 生存专家 | cautious | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.8 | 0.0 | 75.0 |
| 生存专家 | collector | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.5 | 0.2 | 79.7 |
| 生存专家 | opportunist | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 79.1 |
| 生存专家 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 73.8 |
| 拾荒者 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.2 | 0.0 | 71.8 |
| 拾荒者 | cautious | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.0 | 69.8 |
| 拾荒者 | collector | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 75.4 |
| 拾荒者 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 75.7 |
| 拾荒者 | random | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.9 | 0.1 | 74.8 |
| 猎人 | aggressive | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.2 | 0.1 | 67.3 |
| 猎人 | cautious | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 4.2 | 0.1 | 76.7 |
| 猎人 | collector | 12 | 0 | 8 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 72.9 |
| 猎人 | opportunist | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 66.1 |
| 猎人 | random | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.3 |
| 陷阱师 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 80.0 |
| 陷阱师 | cautious | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.7 | 0.1 | 76.6 |
| 陷阱师 | collector | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.1 | 78.2 |
| 陷阱师 | opportunist | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 86.4 |
| 陷阱师 | random | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 75.3 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 4.6% | 4.6% | 100.0% | 4.7 | 0.1 | 165.7 |
| 斗士 | 65 | 3.1% | 3.1% | 100.0% | 4.6 | 0.0 | 181.3 |
| 工程师 | 65 | 3.1% | 3.1% | 100.0% | 4.5 | 0.2 | 173.6 |
| 医学生 | 65 | 4.6% | 4.6% | 100.0% | 4.4 | 0.1 | 231.2 |
| 生存专家 | 60 | 3.3% | 3.3% | 100.0% | 4.0 | 0.1 | 174.3 |
| 拾荒者 | 60 | 1.7% | 1.7% | 100.0% | 4.6 | 0.1 | 171.4 |
| 猎人 | 60 | 3.3% | 3.3% | 100.0% | 4.3 | 0.1 | 167.4 |
| 陷阱师 | 60 | 0.0% | 0.0% | 100.0% | 4.2 | 0.1 | 166.0 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 5.0% | 5.0% | 100.0% | 4.3 | 0.1 | 172.0 |
| cautious | 100 | 4.0% | 4.0% | 100.0% | 4.3 | 0.1 | 178.8 |
| collector | 100 | 4.0% | 4.0% | 100.0% | 4.3 | 0.1 | 192.9 |
| opportunist | 100 | 0.0% | 0.0% | 100.0% | 4.4 | 0.1 | 186.2 |
| random | 100 | 2.0% | 2.0% | 100.0% | 4.6 | 0.1 | 166.0 |

################################################################