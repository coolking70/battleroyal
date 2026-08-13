# Simulation Regression Report

- 版本：0.5.0
- mode：regression
- 生成时间：2026-08-13T19:24:30.523Z
- 矩阵：8 角色 × 5 策略 = 40 格
- 种子前缀：PHASE4P-AF3

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

- encounters=7560, kills=1758, flees=5959, playerDeaths=46
- damageTaken=95414, groundDrops=2856, pickups=3220, wildCrafts=112
- eliteEncounters=160, eliteKills=0, apexSpawned=340, apexEncounters=12, apexKills=0, apexFlees=0
- signatureDrops=0, signaturePickups=0, signatureCrafts=0, bossKillsByType={}
- craftGoalCompletion=0/0 (0.0%)
- encounterByType: {"feral_dog":1210,"carrion_crow":689,"rat_swarm":1400,"patrol_drone":762,"tusked_boar":472,"maintenance_bot":932,"venom_snake":527,"security_hound":512,"escaped_subject":507,"resin_stalker":377,"armored_repair_bot":54,"scavenger_boar":13,"toxic_experiment":31,"riot_control_unit":22,"prototype_aegis":5,"feral_alpha_hound":18,"hunter_killer_drone":22,"iron_tusk":5,"subject_07":2}
- encounterByZone: {"forest":610,"park":595,"underground":565,"hospital":498,"lab":638,"factory":734,"school":577,"station":648,"residential":745,"construction":722,"warehouse":676,"commercial":552}
- killsByType: {"carrion_crow":294,"feral_dog":381,"patrol_drone":176,"rat_swarm":504,"venom_snake":197,"maintenance_bot":74,"tusked_boar":50,"security_hound":28,"resin_stalker":15,"escaped_subject":39}
- killsByZone: {"park":144,"forest":161,"lab":62,"school":225,"station":144,"construction":116,"residential":278,"warehouse":158,"factory":82,"hospital":113,"underground":102,"commercial":173}

> These are BALANCE OBSERVATIONS ONLY; Phase 4N regression gating remains engine-health-only.

## 角色平衡验收（最高/最低非零胜率比 < 2.5）

| 指标 | 值 |
| --- | --- |
| 最高胜率 | 10.0% |
| 最低非零胜率 | 1.5% |
| 比值 | 6.50 |
| 阈值 | 2.5 |
| 0 胜率角色 | fighter |
| 判定 | **FAIL** |

**Regression 整体判定：PASS**（= 请求/实际局数 ✓ && 引擎健康 ✓；角色平衡仅观察）

## Phase 3A 玩法使用率与事件覆盖验收

### 攻击风格（玩家侧全部攻击动作）

| 风格 | 次数 | 占比 | 门槛（≥2%） | 判定 |
| --- | ---: | ---: | --- | --- |
| quick | 3531 | 4.5% | 2.0% | **PASS** |
| normal | 55496 | 70.2% | - | - |
| heavy | 19972 | 25.3% | 2.0% | **PASS** |
| 合计 | 78999 | 100% | - | - |

### 防御姿态与 Heavy 风险

| 指标 | 值 | 门槛 | 判定 |
| --- | ---: | --- | --- |
| GUARD 命令次数 | 3000 | - | - |
| GUARD 使用率（占全部命令） | 10.4% | 2.0% | **PASS** |
| 防御成功减免次数 | 533 | - | - |
| EXPOSED 施加（重击挥空） | 9121 | - | - |
| EXPOSED 兑现（破绽被击中） | 2772 | - | - |

### 技能使用（按技能）

| 技能 | 使用次数 |
| --- | ---: |
| scavenge_focus | 578 |
| prepare_ambush | 505 |
| emergency_treatment | 390 |
| camp_routine | 388 |
| sort_rare | 377 |
| second_wind | 371 |
| scout_recon | 359 |
| engineer_reinforce | 351 |
| escape_plan | 350 |
| track_target | 348 |
| scout_smoke | 297 |
| adrenaline | 249 |
| medic_regen | 212 |
| fighter_focus | 186 |
| steady_aim | 179 |
| field_craft | 48 |

### 世界事件触发覆盖（正式规模下各 ≥ 50 次）

| 事件 | 触发次数 | 门槛 | 判定 |
| --- | ---: | ---: | --- |
| blackout | 538 | 50 | ✓ |
| rain | 570 | 50 | ✓ |
| emergency_broadcast | 567 | 50 | ✓ |
| medical_alert | 556 | 50 | ✓ |
| research_anomaly | 567 | 50 | ✓ |
| citywide_unrest | 511 | 50 | ✓ |

**Phase 3A 玩法整体判定：PASS**（quick ✓ / heavy ✓ / guard ✓ / 事件覆盖 ✓ / 命中偏差 ✓ / 四技能玩家侧 ✓）

### 攻击风格细分与命中一致性（Phase 3A-1）

| 风格 | 尝试 | 命中 | 落空 | 实际命中率 | 展示命中率均值 | Δpp（|期望-实际|） | 门槛（<5pp） | 总伤害 | 命中均伤 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| quick | 3531 | 2701 | 830 | 76.5% | 76.2% | 0.28 | ✓ | 10069 | 3.7 |
| normal | 55496 | 37847 | 17649 | 68.2% | 67.5% | 0.74 | ✓ | 207402 | 5.5 |
| heavy | 19972 | 10851 | 9121 | 54.3% | 53.6% | 0.74 | ✓ | 95068 | 8.8 |

### Guard 与 EXPOSED 完整统计（Phase 3A-1）

| 指标 | 值 |
| --- | ---: |
| GUARD 命令次数 | 3000 |
| 防御成功触发（减免伤害） | 533 |
| 减免伤害总量 | 1846 |
| 平均每次减免 | 3.5 |
| 重击落空（Heavy Miss） | 9121 |
| EXPOSED 施加 | 9121 |
| EXPOSED 兑现（被击中） | 2772 |
| EXPOSED 未兑现失效 | 3109 |
| EXPOSED 兑现时额外伤害总量 | 2355 |

### 技能收益统计（玩家 / NPC 分列，Phase 3A-1）

| 技能 | 玩家使用 | NPC 使用 | 收益指标 |
| --- | ---: | ---: | --- |
| 警觉侦察 | 66 | 293 | 遭遇先手次数：0 |
| 肾上腺素 | 48 | 201 | 覆盖攻击 319 · 额外伤害 304 · 省体力 319 · 自伤 22 |
| 现场加工 | 48 | 0 | 免费合成 3 · 省体力 3 |
| 应急处理 | 67 | 323 | 即时治疗 845 · 治疗品额外 44 |

### 世界事件影响统计（Phase 3A-1）

| 事件 | 触发 | 影响指标 |
| --- | ---: | --- |
| 停电 | 538 | 受影响搜索 1687 · 遭遇权重降低 1557 · 空手权重提高 1687 |
| 暴雨 | 570 | 受影响移动 1829 · 额外体力 1829 · 远程攻击 2634 |
| 广播 | 567 | 广播区域数：567 |
| 医疗警报 | 556 | 受影响治疗 15 · 额外治疗 71 |
| 研究异常 | 567 | 伤害 tick 975 · 总伤害 2912 · 致死 9 |
| 全域骚动 | 511 | 阻止噪音衰减 7512 · 搜索噪音加成 895 |

## 全局摘要

| 指标 | 值 |
| --- | --- |
| 总对局 | 500 |
| 可信对局率 | 100.0% |
| 胜率 | 4.2% |
| 败率 | 83.2% |
| 平局率 | 12.6% |
| 超时率 | 0.0% |
| 存活率 | 4.2% |
| 胜利路线 | {"last_survivor":437,"none":63} |
| terminalWithoutWinner | 0 |
| invalidVictoryTuple | 0 |
| 平均时长 | 76.3 时间单位 |
| 平均名次 | 4.3（理论 3.5 为全灭）|
| 平均击杀 | 0.1 |
| 平均造成伤害 | 59.5 |
| 平均承受伤害 | 181.0 |

### 玩家死亡原因（仅统计失败对局）

| 原因 | 次数 |
| --- | ---: |
| 失控维修机攻击 | 2 |
| 安保机器犬攻击 | 4 |
| 战斗 | 273 |
| 树脂寄生兽攻击 | 4 |
| 毒性实验体攻击 | 3 |
| 毒蛇攻击 | 2 |
| 猎杀无人机攻击 | 2 |
| 獠牙野猪攻击 | 2 |
| 研究设施异常 | 4 |
| 禁区侵蚀 | 95 |
| 腐食乌鸦攻击 | 6 |
| 衰竭 | 58 |
| 巡逻无人机攻击 | 6 |
| 逃逸实验体攻击 | 6 |
| 野化猎犬攻击 | 6 |
| 野外毒伤 | 3 |
| 铁牙攻击 | 1 |
| 鼠群攻击 | 2 |

## 角色 × 策略矩阵

| 角色 | 策略 | 局数 | 胜 | 败 | 平 | 超时 | 存活 | 可信 | 硬上限 | 非法 | 平均名次 | 平均击杀 | 平均时长 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | aggressive | 13 | 0 | 9 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 71.5 |
| 侦察员 | cautious | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 3.9 | 0.2 | 72.2 |
| 侦察员 | collector | 13 | 1 | 10 | 2 | 0 | 7.7% | 100.0% | 0 | 0 | 3.9 | 0.2 | 74.5 |
| 侦察员 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.0 | 75.1 |
| 侦察员 | random | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 78.7 |
| 斗士 | aggressive | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.1 | 73.7 |
| 斗士 | cautious | 13 | 0 | 9 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.1 | 74.6 |
| 斗士 | collector | 13 | 0 | 9 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 4.2 | 0.2 | 74.7 |
| 斗士 | opportunist | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 5.8 | 0.1 | 77.9 |
| 斗士 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 5.1 | 0.1 | 71.5 |
| 工程师 | aggressive | 13 | 0 | 11 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 75.8 |
| 工程师 | cautious | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 78.2 |
| 工程师 | collector | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.2 | 75.6 |
| 工程师 | opportunist | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 74.2 |
| 工程师 | random | 13 | 1 | 12 | 0 | 0 | 7.7% | 100.0% | 0 | 0 | 4.5 | 0.2 | 77.0 |
| 医学生 | aggressive | 13 | 0 | 13 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.3 | 0.0 | 73.8 |
| 医学生 | cautious | 13 | 0 | 10 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 4.7 | 0.2 | 81.0 |
| 医学生 | collector | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.3 | 0.0 | 82.2 |
| 医学生 | opportunist | 13 | 1 | 11 | 1 | 0 | 7.7% | 100.0% | 0 | 0 | 4.4 | 0.0 | 77.1 |
| 医学生 | random | 13 | 0 | 12 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 4.5 | 0.1 | 71.2 |
| 生存专家 | aggressive | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.9 | 0.1 | 75.6 |
| 生存专家 | cautious | 12 | 0 | 11 | 1 | 0 | 0.0% | 100.0% | 0 | 0 | 3.3 | 0.1 | 76.8 |
| 生存专家 | collector | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 4.9 | 0.1 | 76.7 |
| 生存专家 | opportunist | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.8 | 0.1 | 74.2 |
| 生存专家 | random | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.3 | 0.1 | 78.9 |
| 拾荒者 | aggressive | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.6 | 0.1 | 70.3 |
| 拾荒者 | cautious | 12 | 3 | 8 | 1 | 0 | 25.0% | 100.0% | 0 | 0 | 3.7 | 0.0 | 76.5 |
| 拾荒者 | collector | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.3 | 0.2 | 70.0 |
| 拾荒者 | opportunist | 12 | 0 | 10 | 2 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.2 | 77.8 |
| 拾荒者 | random | 12 | 1 | 7 | 4 | 0 | 8.3% | 100.0% | 0 | 0 | 4.9 | 0.1 | 77.9 |
| 猎人 | aggressive | 12 | 0 | 8 | 4 | 0 | 0.0% | 100.0% | 0 | 0 | 4.4 | 0.0 | 77.8 |
| 猎人 | cautious | 12 | 0 | 9 | 3 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.1 | 77.0 |
| 猎人 | collector | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 4.1 | 0.3 | 76.3 |
| 猎人 | opportunist | 12 | 1 | 11 | 0 | 0 | 8.3% | 100.0% | 0 | 0 | 3.8 | 0.1 | 73.6 |
| 猎人 | random | 12 | 1 | 10 | 1 | 0 | 8.3% | 100.0% | 0 | 0 | 4.6 | 0.1 | 81.8 |
| 陷阱师 | aggressive | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 3.1 | 0.0 | 81.7 |
| 陷阱师 | cautious | 12 | 1 | 9 | 2 | 0 | 8.3% | 100.0% | 0 | 0 | 3.3 | 0.1 | 81.9 |
| 陷阱师 | collector | 12 | 2 | 9 | 1 | 0 | 16.7% | 100.0% | 0 | 0 | 2.9 | 0.1 | 81.4 |
| 陷阱师 | opportunist | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 3.8 | 0.1 | 79.5 |
| 陷阱师 | random | 12 | 0 | 12 | 0 | 0 | 0.0% | 100.0% | 0 | 0 | 4.6 | 0.0 | 75.9 |

## 按角色汇总（行平均）

| 角色 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 侦察员 | 65 | 3.1% | 3.1% | 100.0% | 4.3 | 0.1 | 169.5 |
| 斗士 | 65 | 0.0% | 0.0% | 100.0% | 4.9 | 0.1 | 184.2 |
| 工程师 | 65 | 1.5% | 1.5% | 100.0% | 4.6 | 0.1 | 169.6 |
| 医学生 | 65 | 3.1% | 3.1% | 100.0% | 4.4 | 0.1 | 240.3 |
| 生存专家 | 60 | 3.3% | 3.3% | 100.0% | 4.1 | 0.1 | 175.3 |
| 拾荒者 | 60 | 10.0% | 10.0% | 100.0% | 4.4 | 0.1 | 164.8 |
| 猎人 | 60 | 5.0% | 5.0% | 100.0% | 4.1 | 0.1 | 169.6 |
| 陷阱师 | 60 | 8.3% | 8.3% | 100.0% | 3.5 | 0.1 | 171.3 |

## 按策略汇总（列平均）

| 策略 | 局数 | 胜率 | 存活率 | 可信率 | 平均名次 | 平均击杀 | 平均承受伤害 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| aggressive | 100 | 3.0% | 3.0% | 100.0% | 4.3 | 0.0 | 174.1 |
| cautious | 100 | 5.0% | 5.0% | 100.0% | 4.0 | 0.1 | 179.3 |
| collector | 100 | 7.0% | 7.0% | 100.0% | 4.1 | 0.1 | 186.1 |
| opportunist | 100 | 2.0% | 2.0% | 100.0% | 4.6 | 0.1 | 187.3 |
| random | 100 | 4.0% | 4.0% | 100.0% | 4.5 | 0.1 | 178.1 |

################################################################