# Simulation Regression Report

- 版本：0.5.0
- mode：formal
- 生成时间：2026-08-25T18:07:43.626Z
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

- encounters=182275, kills=47515, flees=137318, playerDeaths=1040
- damageTaken=2251280, groundDrops=76709, pickups=83667, wildCrafts=3662
- eliteEncounters=9909, eliteKills=11, apexSpawned=8158, apexEncounters=220, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"rat_swarm":31326,"security_hound":10589,"maintenance_bot":21020,"tusked_boar":12896,"venom_snake":13126,"patrol_drone":18827,"feral_alpha_hound":2093,"feral_dog":27800,"escaped_subject":12278,"carrion_crow":16121,"armored_repair_bot":1829,"scavenger_boar":2474,"resin_stalker":8163,"riot_control_unit":1065,"hunter_killer_drone":1895,"iron_tusk":75,"prototype_aegis":89,"toxic_experiment":553,"subject_07":56}
- encounterByZone: {"hospital":11639,"station":15234,"warehouse":15099,"park":14337,"forest":18900,"lab":13859,"underground":13210,"factory":16869,"school":13094,"residential":16356,"commercial":14008,"construction":19670}
- killsByType: {"rat_swarm":12291,"venom_snake":6566,"carrion_crow":7028,"tusked_boar":2232,"feral_dog":9776,"patrol_drone":4819,"maintenance_bot":2104,"security_hound":906,"escaped_subject":1449,"resin_stalker":333,"feral_alpha_hound":11}
- killsByZone: {"hospital":3070,"forest":5999,"park":4712,"school":4494,"commercial":4520,"lab":1525,"factory":2176,"construction":4529,"station":3875,"residential":6431,"warehouse":3399,"underground":2785}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 4.9% |
| 最低非零胜率 | 3.6% |
| 比值 | 1.35 |
| 阈值 | 2.5 |
| 0 胜率角色 | 无 |
| 判定 | **PASS** |

**整体判定：PASS**（= 引擎健康 ✓ && 角色平衡 ✓ && Phase 3A 玩法 ✓）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 84048 | 4.6% | 2.0% | **PASS** |
| normal | 1309528 | 71.0% | - | - |
| heavy | 451734 | 24.5% | 2.0% | **PASS** |
| 合计 | 1845310 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 68851 | - | - |
| GUARD 使用率（占全部命令） | 10.0% | 2.0% | **PASS** |
| 防御成功减免次数 | 12497 | - | - |
| EXPOSED 施加（重击挥空） | 202119 | - | - |
| EXPOSED 兑现（破绽被击中） | 59757 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 13886 |
| prepare_ambush | 11547 |
| track_target | 8843 |
| scout_recon | 8671 |
| sort_rare | 8621 |
| emergency_treatment | 8607 |
| escape_plan | 8111 |
| engineer_reinforce | 7846 |
| camp_routine | 7719 |
| second_wind | 7680 |
| scout_smoke | 6936 |
| adrenaline | 5929 |
| steady_aim | 4845 |
| fighter_focus | 4163 |
| medic_regen | 4033 |
| field_craft | 1457 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 13076 | 50 | ✓ |
| rain | 13166 | 50 | ✓ |
| emergency_broadcast | 13270 | 50 | ✓ |
| medical_alert | 13257 | 50 | ✓ |
| research_anomaly | 13144 | 50 | ✓ |
| citywide_unrest | 13223 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 84048 | 65185 | 18863 | 77.6% | 77.3% | 0.29 | ✓ | 248610 | 3.8 |
| normal | 1309528 | 898439 | 411089 | 68.6% | 68.0% | 0.65 | ✓ | 5037688 | 5.6 |
| heavy | 451734 | 249615 | 202119 | 55.3% | 54.4% | 0.89 | ✓ | 2327585 | 9.3 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 68851 |
| 防御成功触发（减免伤害） | 12497 |
| 减免伤害总量 | 47322 |
| 平均每次减免 | 3.8 |
| 重击落空（Heavy Miss） | 202119 |
| EXPOSED 施加 | 202119 |
| EXPOSED 兑现（被击中） | 59757 |
| EXPOSED 未兑现失效 | 67878 |
| EXPOSED 兑现时额外伤害总量 | 45557 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 1530 | 7141 | 遭遇先手次数：2 |
| 肾上腺素 | 1106 | 4823 | 覆盖攻击 7788 · 额外伤害 8080 · 省体力 7788 · 自伤 525 |
| 现场加工 | 1457 | 0 | 免费合成 73 · 省体力 73 |
| 应急处理 | 1488 | 7119 | 即时治疗 20018 · 治疗品额外 1166 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 13076 | 受影响搜索 32201 · 遭遇权重降低 29304 · 空手权重提高 32201 |
| 暴雨 | 13166 | 受影响移动 42402 · 额外体力 42402 · 远程攻击 88088 |
| 广播 | 13270 | 广播区域数：13263 |
| 医疗警报 | 13257 | 受影响治疗 198 · 额外治疗 1089 |
| 研究异常 | 13144 | 伤害 tick 19274 · 总伤害 57618 · 致死 204 |
| 全域骚动 | 13223 | 阻止噪音衰减 186811 · 搜索噪音加成 16447 |

## Phase 4S cognition sanity

| 指标 | 值 |
| --- | ---: |
| memory observations | 13113908 |
| memory evictions | 2065268 (15.7%) |
| intent commit / preserve | 476099 / 3329186 |
| intent reevaluate / complete / invalidate | 398955 / 276683 / 135423 |
| commit ratio per observed NPC intent turn | 12.5% |
| remembered source failures | 136067 |
| threat-avoidance intents | 0 |
| Apex-contest intents | 706 |

## Phase 4T incident sanity

| 指标 | 值 |
| --- | ---: |
| incident scheduled / activated | 48000 / 43456 |
| incident resolved / expired | 1336 / 33339 |
| incident public broadcasts | 21035 |
| incident local discoveries | 365459 |
| incident responses | 1887 |
| incident rewards claimed | 1103 |
| incident contention failures | 0 |
| incident intent commits / preserves | 25103 / 29220 |
| duplicateIncidentReward (must be 0) | 0 |
| illegalIncidentResolution (must be 0) | 0 |
| postTerminalIncidentMutation (must be 0) | 0 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 12000 |
| 可信对局率 | 100.0% |
| 胜率 | 4.3% |
| 败率 | 85.0% |
| 平局率 | 10.8% |
| 超时率 | 0.0% |
| 存活率 | 4.3% |
| 胜利路线 | {"last_survivor":10705,"none":1292,"extraction":3} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 76.3 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 58.2 |
| 平均承受伤害 | 180.8 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 原型 Aegis攻击 | 2 |
| 命名实验体 07攻击 | 6 |
| 回收场巨獠攻击 | 26 |
| 失控维修机攻击 | 42 |
| 安保机器犬攻击 | 92 |
| 战斗 | 6856 |
| 树脂寄生兽攻击 | 35 |
| 毒性实验体攻击 | 34 |
| 毒蛇攻击 | 26 |
| 猎杀无人机攻击 | 65 |
| 獠牙野猪攻击 | 45 |
| 研究设施异常 | 60 |
| 禁区侵蚀 | 2307 |
| 腐食乌鸦攻击 | 48 |
| 衰竭 | 1170 |
| 装甲维修机攻击 | 5 |
| 巡逻无人机攻击 | 121 |
| 逃逸实验体攻击 | 207 |
| 野化猎犬攻击 | 138 |
| 野外毒伤 | 55 |
| 铁牙攻击 | 6 |
| 镇暴控制单元攻击 | 4 |
| 阿尔法猎犬攻击 | 44 |
| 鼠群攻击 | 94 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 300 | 10 | 262 | 28 | 0 | 3.3% | 100.0% | 0 | 0 | 4.1 | 0.1 | 75.2 |
| 侦察员 | cautious | 300 | 24 | 231 | 45 | 0 | 8.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 76.0 |
| 侦察员 | collector | 300 | 17 | 249 | 34 | 0 | 5.7% | 100.0% | 0 | 0 | 4.1 | 0.1 | 75.7 |
| 侦察员 | opportunist | 300 | 8 | 270 | 22 | 0 | 2.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.5 |
| 侦察员 | random | 300 | 8 | 253 | 39 | 0 | 2.7% | 100.0% | 0 | 0 | 4.6 | 0.1 | 74.0 |
| 斗士 | aggressive | 300 | 7 | 265 | 28 | 0 | 2.3% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.7 |
| 斗士 | cautious | 300 | 14 | 250 | 36 | 0 | 4.7% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.7 |
| 斗士 | collector | 300 | 23 | 245 | 32 | 0 | 7.7% | 100.0% | 0 | 0 | 4.2 | 0.2 | 74.4 |
| 斗士 | opportunist | 300 | 7 | 265 | 28 | 0 | 2.3% | 100.0% | 0 | 0 | 4.7 | 0.0 | 74.4 |
| 斗士 | random | 300 | 3 | 257 | 40 | 0 | 1.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 73.7 |
| 工程师 | aggressive | 300 | 8 | 268 | 24 | 0 | 2.7% | 100.0% | 0 | 0 | 4.2 | 0.1 | 76.7 |
| 工程师 | cautious | 300 | 24 | 244 | 32 | 0 | 8.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 78.1 |
| 工程师 | collector | 300 | 24 | 240 | 36 | 0 | 8.0% | 100.0% | 0 | 0 | 4.0 | 0.1 | 77.2 |
| 工程师 | opportunist | 300 | 9 | 262 | 29 | 0 | 3.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 77.1 |
| 工程师 | random | 300 | 4 | 262 | 34 | 0 | 1.3% | 100.0% | 0 | 0 | 4.5 | 0.1 | 76.2 |
| 医学生 | aggressive | 300 | 6 | 267 | 27 | 0 | 2.0% | 100.0% | 0 | 0 | 4.8 | 0.0 | 77.1 |
| 医学生 | cautious | 300 | 23 | 248 | 29 | 0 | 7.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.8 |
| 医学生 | collector | 300 | 17 | 253 | 30 | 0 | 5.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.5 |
| 医学生 | opportunist | 300 | 7 | 256 | 37 | 0 | 2.3% | 100.0% | 0 | 0 | 4.8 | 0.0 | 76.0 |
| 医学生 | random | 300 | 9 | 258 | 33 | 0 | 3.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 75.3 |
| 生存专家 | aggressive | 300 | 10 | 263 | 27 | 0 | 3.3% | 100.0% | 0 | 0 | 4.2 | 0.1 | 76.9 |
| 生存专家 | cautious | 300 | 16 | 253 | 31 | 0 | 5.3% | 100.0% | 0 | 0 | 4.1 | 0.1 | 77.4 |
| 生存专家 | collector | 300 | 15 | 251 | 34 | 0 | 5.0% | 100.0% | 0 | 0 | 4.1 | 0.1 | 76.5 |
| 生存专家 | opportunist | 300 | 9 | 270 | 21 | 0 | 3.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 77.1 |
| 生存专家 | random | 300 | 8 | 260 | 32 | 0 | 2.7% | 100.0% | 0 | 0 | 4.3 | 0.0 | 75.9 |
| 拾荒者 | aggressive | 300 | 11 | 262 | 27 | 0 | 3.7% | 100.0% | 0 | 0 | 4.4 | 0.1 | 76.0 |
| 拾荒者 | cautious | 300 | 20 | 242 | 38 | 0 | 6.7% | 100.0% | 0 | 0 | 4.1 | 0.1 | 79.0 |
| 拾荒者 | collector | 300 | 23 | 237 | 40 | 0 | 7.7% | 100.0% | 0 | 0 | 4.0 | 0.1 | 77.8 |
| 拾荒者 | opportunist | 300 | 5 | 254 | 41 | 0 | 1.7% | 100.0% | 0 | 0 | 4.6 | 0.0 | 75.4 |
| 拾荒者 | random | 300 | 4 | 265 | 31 | 0 | 1.3% | 100.0% | 0 | 0 | 4.6 | 0.1 | 75.4 |
| 猎人 | aggressive | 300 | 10 | 265 | 25 | 0 | 3.3% | 100.0% | 0 | 0 | 4.2 | 0.1 | 76.2 |
| 猎人 | cautious | 300 | 23 | 250 | 27 | 0 | 7.7% | 100.0% | 0 | 0 | 4.0 | 0.1 | 77.3 |
| 猎人 | collector | 300 | 26 | 238 | 36 | 0 | 8.7% | 100.0% | 0 | 0 | 4.0 | 0.1 | 75.4 |
| 猎人 | opportunist | 300 | 3 | 270 | 27 | 0 | 1.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.8 |
| 猎人 | random | 300 | 4 | 262 | 34 | 0 | 1.3% | 100.0% | 0 | 0 | 4.5 | 0.1 | 75.0 |
| 陷阱师 | aggressive | 300 | 15 | 257 | 28 | 0 | 5.0% | 100.0% | 0 | 0 | 3.9 | 0.0 | 78.2 |
| 陷阱师 | cautious | 300 | 16 | 245 | 39 | 0 | 5.3% | 100.0% | 0 | 0 | 3.9 | 0.1 | 77.8 |
| 陷阱师 | collector | 300 | 22 | 241 | 37 | 0 | 7.3% | 100.0% | 0 | 0 | 3.9 | 0.1 | 77.8 |
| 陷阱师 | opportunist | 300 | 10 | 254 | 36 | 0 | 3.3% | 100.0% | 0 | 0 | 4.2 | 0.0 | 77.1 |
| 陷阱师 | random | 300 | 10 | 252 | 38 | 0 | 3.3% | 100.0% | 0 | 0 | 4.2 | 0.0 | 76.4 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 1500 | 4.5% | 4.5% | 100.0% | 4.3 | 0.1 | 174.5 |
| 斗士 | 1500 | 3.6% | 3.6% | 100.0% | 4.5 | 0.1 | 180.2 |
| 工程师 | 1500 | 4.6% | 4.6% | 100.0% | 4.2 | 0.1 | 170.4 |
| 医学生 | 1500 | 4.1% | 4.1% | 100.0% | 4.6 | 0.0 | 236.3 |
| 生存专家 | 1500 | 3.9% | 3.9% | 100.0% | 4.2 | 0.1 | 178.6 |
| 拾荒者 | 1500 | 4.2% | 4.2% | 100.0% | 4.3 | 0.1 | 167.5 |
| 猎人 | 1500 | 4.4% | 4.4% | 100.0% | 4.2 | 0.1 | 168.6 |
| 陷阱师 | 1500 | 4.9% | 4.9% | 100.0% | 4.0 | 0.1 | 170.7 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 2400 | 3.2% | 3.2% | 100.0% | 4.3 | 0.1 | 175.4 |
| cautious | 2400 | 6.7% | 6.7% | 100.0% | 4.1 | 0.1 | 180.7 |
| collector | 2400 | 7.0% | 7.0% | 100.0% | 4.1 | 0.1 | 188.1 |
| opportunist | 2400 | 2.4% | 2.4% | 100.0% | 4.5 | 0.0 | 184.4 |
| random | 2400 | 2.1% | 2.1% | 100.0% | 4.5 | 0.1 | 175.5 |

################################################################