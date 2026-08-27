# Simulation Regression Report

- 版本：0.5.0
- mode：formal
- 生成时间：2026-08-26T04:31:46.903Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：P4X-CONF

## 局数分配（P3-P1）

| 字段 | 值 |
| --- | --- |
| gamesMode | total（--games = 总对局数） |
| requestedTotalGames | 12000 |
| actualTotalGames | 12000 |
| gamesPerCell（基准） | 300 |
| cellCount | 40 |
| 请求 = 实际 | ✓ |

<details><summary>distribution（每格实际局数）</summary>

| # | 角色 | 策略 | 局数 |
| ---: | --- | --- | ---: |
| 1 | scout | aggressive | 300 |
| 2 | scout | cautious | 300 |
| 3 | scout | collector | 300 |
| 4 | scout | opportunist | 300 |
| 5 | scout | random | 300 |
| 6 | fighter | aggressive | 300 |
| 7 | fighter | cautious | 300 |
| 8 | fighter | collector | 300 |
| 9 | fighter | opportunist | 300 |
| 10 | fighter | random | 300 |
| 11 | engineer | aggressive | 300 |
| 12 | engineer | cautious | 300 |
| 13 | engineer | collector | 300 |
| 14 | engineer | opportunist | 300 |
| 15 | engineer | random | 300 |
| 16 | medic | aggressive | 300 |
| 17 | medic | cautious | 300 |
| 18 | medic | collector | 300 |
| 19 | medic | opportunist | 300 |
| 20 | medic | random | 300 |
| 21 | survivor | aggressive | 300 |
| 22 | survivor | cautious | 300 |
| 23 | survivor | collector | 300 |
| 24 | survivor | opportunist | 300 |
| 25 | survivor | random | 300 |
| 26 | scavenger | aggressive | 300 |
| 27 | scavenger | cautious | 300 |
| 28 | scavenger | collector | 300 |
| 29 | scavenger | opportunist | 300 |
| 30 | scavenger | random | 300 |
| 31 | hunter | aggressive | 300 |
| 32 | hunter | cautious | 300 |
| 33 | hunter | collector | 300 |
| 34 | hunter | opportunist | 300 |
| 35 | hunter | random | 300 |
| 36 | trapper | aggressive | 300 |
| 37 | trapper | cautious | 300 |
| 38 | trapper | collector | 300 |
| 39 | trapper | opportunist | 300 |
| 40 | trapper | random | 300 |

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
> 引擎健康、角色平衡与 Phase 3A 玩法门槛分别验收；总体判定要求三者同时 PASS。

## Phase 4N PvE ecology observations

- encounters=182612, kills=48031, flees=136619, playerDeaths=1010
- damageTaken=2229829, groundDrops=77659, pickups=84804, wildCrafts=3759
- eliteEncounters=9971, eliteKills=10, apexSpawned=8183, apexEncounters=234, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"rat_swarm":30719,"security_hound":10700,"maintenance_bot":21013,"tusked_boar":12689,"venom_snake":13015,"feral_alpha_hound":2004,"feral_dog":27950,"escaped_subject":12453,"patrol_drone":18924,"carrion_crow":16415,"armored_repair_bot":1854,"resin_stalker":8529,"hunter_killer_drone":1914,"scavenger_boar":2525,"riot_control_unit":1079,"iron_tusk":97,"toxic_experiment":595,"subject_07":56,"prototype_aegis":81}
- encounterByZone: {"hospital":11720,"station":15313,"warehouse":15010,"park":14304,"forest":18744,"factory":16707,"underground":13453,"residential":16506,"school":12899,"lab":13897,"commercial":14501,"construction":19558}
- killsByType: {"rat_swarm":12425,"venom_snake":6635,"feral_alpha_hound":9,"carrion_crow":7036,"feral_dog":10017,"maintenance_bot":2182,"patrol_drone":4843,"escaped_subject":1401,"tusked_boar":2188,"security_hound":968,"resin_stalker":326,"scavenger_boar":1}
- killsByZone: {"hospital":3104,"forest":6038,"underground":2842,"park":4718,"residential":6603,"construction":4571,"commercial":4562,"school":4489,"lab":1525,"factory":2221,"station":3871,"warehouse":3487}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 4.9% |
| 最低非零胜率 | 3.4% |
| 比值 | 1.45 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **PASS** |

**整体判定：PASS**（= 引擎健康 ✓ && 角色平衡 ✓ && Phase 3A 玩法 ✓）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 85123 | 4.5% | 2.0% | **PASS** |
| normal | 1330319 | 70.8% | - | - |
| heavy | 463075 | 24.7% | 2.0% | **PASS** |
| 合计 | 1878517 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 70298 | - | - |
| GUARD 使用率（占全部命令） | 10.1% | 2.0% | **PASS** |
| 防御成功减免次数 | 12627 | - | - |
| EXPOSED 施加（重击挥空） | 207226 | - | - |
| EXPOSED 兑现（破绽被击中） | 61761 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 13957 |
| prepare_ambush | 11455 |
| track_target | 8808 |
| sort_rare | 8769 |
| scout_recon | 8699 |
| emergency_treatment | 8581 |
| escape_plan | 8143 |
| engineer_reinforce | 7839 |
| camp_routine | 7693 |
| second_wind | 7656 |
| scout_smoke | 7101 |
| adrenaline | 5908 |
| steady_aim | 4909 |
| medic_regen | 4624 |
| fighter_focus | 4114 |
| field_craft | 1499 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 13353 | 50 | ✓ |
| rain | 13304 | 50 | ✓ |
| emergency_broadcast | 13292 | 50 | ✓ |
| medical_alert | 13480 | 50 | ✓ |
| research_anomaly | 13438 | 50 | ✓ |
| citywide_unrest | 13005 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 85123 | 66065 | 19058 | 77.6% | 77.3% | 0.33 | ✓ | 250098 | 3.8 |
| normal | 1330319 | 911936 | 418383 | 68.6% | 68.0% | 0.58 | ✓ | 5031379 | 5.5 |
| heavy | 463075 | 255849 | 207226 | 55.3% | 54.4% | 0.83 | ✓ | 2342240 | 9.2 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 70298 |
| 防御成功触发（减免伤害） | 12627 |
| 减免伤害总量 | 47014 |
| 平均每次减免 | 3.7 |
| 重击落空（Heavy Miss） | 207226 |
| EXPOSED 施加 | 207226 |
| EXPOSED 兑现（被击中） | 61761 |
| EXPOSED 未兑现失效 | 70082 |
| EXPOSED 兑现时额外伤害总量 | 45427 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 1548 | 7151 | 遭遇先手次数：2 |
| 肾上腺素 | 1122 | 4786 | 覆盖攻击 7811 · 额外伤害 7869 · 省体力 7811 · 自伤 522 |
| 现场加工 | 1498 | 1 | 免费合成 56 · 省体力 56 |
| 应急处理 | 1492 | 7089 | 即时治疗 19602 · 治疗品额外 1008 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 13353 | 受影响搜索 32789 · 遭遇权重降低 29814 · 空手权重提高 32789 |
| 暴雨 | 13304 | 受影响移动 42586 · 额外体力 42586 · 远程攻击 91549 |
| 广播 | 13292 | 广播区域数：13284 |
| 医疗警报 | 13480 | 受影响治疗 192 · 额外治疗 1061 |
| 研究异常 | 13438 | 伤害 tick 20641 · 总伤害 61715 · 致死 214 |
| 全域骚动 | 13005 | 阻止噪音衰减 183528 · 搜索噪音加成 16359 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 13353607 |
| memory evictions | 2092702 (15.7%) |
| intent commit / preserve | 483421 / 3371959 |
| intent reevaluate / complete / invalidate | 403603 / 281744 / 137742 |
| commit ratio per observed NPC intent turn | 12.5% |
| remembered source failures | 136062 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 733 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 48000 / 43795 |
| incident resolved / expired | 1368 / 33777 |
| incident public broadcasts | 21209 |
| incident local discoveries | 372044 |
| incident responses | 1934 |
| incident rewards claimed | 1223 |
| incident contention failures | 0 |
| incident intent commits / preserves | 25579 / 29226 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 12000 |
| 可信对局率 | 100.0% |
| 胜率 | 4.2% |
| 败率 | 84.9% |
| 平局率 | 10.9% |
| 超时率 | 0.0% |
| 存活率 | 4.2% |
| 胜利路线 | {"last_survivor":10690,"none":1305,"extraction":5} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 77.0 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 58.7 |
| 平均承受伤害 | 181.3 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 原型 Aegis攻击 | 1 |
| 命名实验体 07攻击 | 5 |
| 回收场巨獠攻击 | 25 |
| 失控维修机攻击 | 33 |
| 安保机器犬攻击 | 90 |
| 战斗 | 6811 |
| 树脂寄生兽攻击 | 29 |
| 毒性实验体攻击 | 34 |
| 毒蛇攻击 | 27 |
| 猎杀无人机攻击 | 75 |
| 獠牙野猪攻击 | 52 |
| 研究设施异常 | 52 |
| 禁区侵蚀 | 2341 |
| 腐食乌鸦攻击 | 42 |
| 衰竭 | 1233 |
| 装甲维修机攻击 | 2 |
| 巡逻无人机攻击 | 119 |
| 逃逸实验体攻击 | 217 |
| 野化猎犬攻击 | 123 |
| 野外毒伤 | 47 |
| 铁牙攻击 | 7 |
| 镇暴控制单元攻击 | 4 |
| 阿尔法猎犬攻击 | 44 |
| 鼠群攻击 | 81 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 300 | 7 | 255 | 38 | 0 | 2.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.9 |
| 侦察员 | cautious | 300 | 18 | 253 | 29 | 0 | 6.0% | 100.0% | 0 | 0 | 4.2 | 0.1 | 76.4 |
| 侦察员 | collector | 300 | 24 | 235 | 41 | 0 | 8.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 76.8 |
| 侦察员 | opportunist | 300 | 9 | 253 | 38 | 0 | 3.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.4 |
| 侦察员 | random | 300 | 13 | 260 | 27 | 0 | 4.3% | 100.0% | 0 | 0 | 4.5 | 0.1 | 76.1 |
| 斗士 | aggressive | 300 | 11 | 257 | 32 | 0 | 3.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 76.4 |
| 斗士 | cautious | 300 | 11 | 252 | 37 | 0 | 3.7% | 100.0% | 0 | 0 | 4.3 | 0.1 | 76.4 |
| 斗士 | collector | 300 | 21 | 246 | 33 | 0 | 7.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 75.6 |
| 斗士 | opportunist | 300 | 6 | 263 | 31 | 0 | 2.0% | 100.0% | 0 | 0 | 4.7 | 0.1 | 75.7 |
| 斗士 | random | 300 | 2 | 269 | 29 | 0 | 0.7% | 100.0% | 0 | 0 | 4.7 | 0.1 | 75.5 |
| 工程师 | aggressive | 300 | 10 | 267 | 23 | 0 | 3.3% | 100.0% | 0 | 0 | 4.2 | 0.1 | 78.2 |
| 工程师 | cautious | 300 | 21 | 243 | 36 | 0 | 7.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 79.8 |
| 工程师 | collector | 300 | 23 | 240 | 37 | 0 | 7.7% | 100.0% | 0 | 0 | 4.0 | 0.1 | 77.8 |
| 工程师 | opportunist | 300 | 5 | 264 | 31 | 0 | 1.7% | 100.0% | 0 | 0 | 4.5 | 0.0 | 76.2 |
| 工程师 | random | 300 | 6 | 264 | 30 | 0 | 2.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 76.0 |
| 医学生 | aggressive | 300 | 13 | 258 | 29 | 0 | 4.3% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.2 |
| 医学生 | cautious | 300 | 28 | 242 | 30 | 0 | 9.3% | 100.0% | 0 | 0 | 4.2 | 0.0 | 79.2 |
| 医学生 | collector | 300 | 21 | 250 | 29 | 0 | 7.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 76.1 |
| 医学生 | opportunist | 300 | 5 | 260 | 35 | 0 | 1.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 77.5 |
| 医学生 | random | 300 | 7 | 260 | 33 | 0 | 2.3% | 100.0% | 0 | 0 | 4.4 | 0.0 | 76.4 |
| 生存专家 | aggressive | 300 | 10 | 254 | 36 | 0 | 3.3% | 100.0% | 0 | 0 | 4.1 | 0.1 | 77.0 |
| 生存专家 | cautious | 300 | 18 | 246 | 36 | 0 | 6.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 78.1 |
| 生存专家 | collector | 300 | 18 | 248 | 34 | 0 | 6.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 78.1 |
| 生存专家 | opportunist | 300 | 10 | 261 | 29 | 0 | 3.3% | 100.0% | 0 | 0 | 4.4 | 0.0 | 77.1 |
| 生存专家 | random | 300 | 11 | 257 | 32 | 0 | 3.7% | 100.0% | 0 | 0 | 4.3 | 0.0 | 76.0 |
| 拾荒者 | aggressive | 300 | 9 | 261 | 30 | 0 | 3.0% | 100.0% | 0 | 0 | 4.4 | 0.1 | 78.0 |
| 拾荒者 | cautious | 300 | 15 | 252 | 33 | 0 | 5.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 78.7 |
| 拾荒者 | collector | 300 | 16 | 261 | 23 | 0 | 5.3% | 100.0% | 0 | 0 | 4.2 | 0.1 | 77.7 |
| 拾荒者 | opportunist | 300 | 10 | 252 | 38 | 0 | 3.3% | 100.0% | 0 | 0 | 4.5 | 0.0 | 76.4 |
| 拾荒者 | random | 300 | 8 | 265 | 27 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 76.6 |
| 猎人 | aggressive | 300 | 14 | 244 | 42 | 0 | 4.7% | 100.0% | 0 | 0 | 4.2 | 0.1 | 77.2 |
| 猎人 | cautious | 300 | 21 | 249 | 30 | 0 | 7.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 76.3 |
| 猎人 | collector | 300 | 17 | 243 | 40 | 0 | 5.7% | 100.0% | 0 | 0 | 4.1 | 0.2 | 75.3 |
| 猎人 | opportunist | 300 | 7 | 257 | 36 | 0 | 2.3% | 100.0% | 0 | 0 | 4.5 | 0.1 | 76.1 |
| 猎人 | random | 300 | 1 | 273 | 26 | 0 | 0.3% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.9 |
| 陷阱师 | aggressive | 300 | 10 | 255 | 35 | 0 | 3.3% | 100.0% | 0 | 0 | 4.1 | 0.1 | 78.9 |
| 陷阱师 | cautious | 300 | 16 | 252 | 32 | 0 | 5.3% | 100.0% | 0 | 0 | 3.9 | 0.0 | 78.7 |
| 陷阱师 | collector | 300 | 17 | 251 | 32 | 0 | 5.7% | 100.0% | 0 | 0 | 4.0 | 0.1 | 78.1 |
| 陷阱师 | opportunist | 300 | 6 | 254 | 40 | 0 | 2.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 78.8 |
| 陷阱师 | random | 300 | 10 | 264 | 26 | 0 | 3.3% | 100.0% | 0 | 0 | 4.3 | 0.1 | 77.6 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 1500 | 4.7% | 4.7% | 100.0% | 4.3 | 0.1 | 181.5 |
| 斗士 | 1500 | 3.4% | 3.5% | 100.0% | 4.5 | 0.1 | 179.9 |
| 工程师 | 1500 | 4.3% | 4.3% | 100.0% | 4.2 | 0.1 | 171.3 |
| 医学生 | 1500 | 4.9% | 4.9% | 100.0% | 4.3 | 0.0 | 233.2 |
| 生存专家 | 1500 | 4.5% | 4.5% | 100.0% | 4.2 | 0.1 | 178.6 |
| 拾荒者 | 1500 | 3.9% | 3.9% | 100.0% | 4.4 | 0.1 | 169.0 |
| 猎人 | 1500 | 4.0% | 4.0% | 100.0% | 4.3 | 0.1 | 169.1 |
| 陷阱师 | 1500 | 3.9% | 3.9% | 100.0% | 4.1 | 0.1 | 167.7 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 2400 | 3.5% | 3.5% | 100.0% | 4.3 | 0.1 | 175.7 |
| cautious | 2400 | 6.2% | 6.2% | 100.0% | 4.1 | 0.1 | 181.2 |
| collector | 2400 | 6.5% | 6.6% | 100.0% | 4.1 | 0.1 | 188.7 |
| opportunist | 2400 | 2.4% | 2.4% | 100.0% | 4.5 | 0.1 | 184.6 |
| random | 2400 | 2.4% | 2.4% | 100.0% | 4.5 | 0.1 | 176.3 |

################################################################