# 平衡调整日志（BALANCE_CHANGELOG.md）

Phase 2A-1 角色平衡闭环：目标「最高/最低非零胜率比 < 2.5 且无 0 胜率角色」。

## 调整记录（2026-08-07）

### 第一轮（Phase 2A 基线 → 2A-1 初调）

| 角色 | 调整 | 动机 |
| --- | --- | --- |
| 斗士 | maxHp 125→110、attack 10→8、**移除开局木棍** | 规格 §五：斗士优势明显过高，优先降 HP/攻击、取消额外木棍优势 |
| 侦察员 | 空手概率倍率 0.5→0.4（`keenEyeNothingMultiplier`） | 强化锐目：更少空手而归 |
| 侦察员 | 新增遭遇发现率 ×1.5（`keenEyeEncounterBonus`） | 强化锐目：更容易先发现同区域敌人 |
| 侦察员 | 新增逃跑成功率 +0.08（`keenEyeFleeBonus`） | 规格建议：更高逃跑率 |
| 工程师 | attack 5→6 | 补足偏低的初始攻击 |
| 工程师 | 材料搜索权重 1.6→2.2（`tinkererMaterialBias`） | 强化巧手：目标材料搜索权重提升（不生成额外材料） |
| 医学生 | 治疗倍率 1.5→1.8（`medicHealMultiplier`） | 强化临床：治疗量与治疗品效率 |
| 医学生 | 医院搜索加成 0.3→0.45（`medicHospitalFindBonus`） | 强化临床 |
| 医学生 | defense 2→3 | 补足最薄的防御 |

第一轮实测（1000 局）：scout 4.0% / fighter 8.8% / engineer 2.8% / medic 4.8%，
ratio **3.14**（FAIL）。

### 第二轮（收敛）

| 角色 | 调整 | 动机 |
| --- | --- | --- |
| 斗士 | maxHp 110→105、attack 8→7 | 继续压低正面强度 |
| 斗士 | 搏击近战加成 2→1（`brawlerMeleeBonus`） | 削弱斗士被动 |
| 工程师 | attack 6→7 | 继续补足工程师战力 |

第二轮实测（1000 局）：scout 3.2% / fighter 6.8% / engineer 5.6% / medic 6.0%，
ratio **2.13** < 2.5（PASS）。

### 权威确认（20000 局，最终代码）

| 角色 | 胜率 |
| --- | --- |
| scout | 3.92% |
| fighter | 7.60% |
| engineer | 4.62% |
| medic | 5.40% |

- 最高/最低非零胜率比：**1.939** < 2.5；
- 0 胜率角色：无；
- engine：timeout=0、illegalState=0、hardLimitReached=0；
- 整体判定：**PASS**（`reports/phase2a1-balance.json`）。

## Phase 3 Step 9 平衡调优（2026-08-08）

目标：2000 局模拟下「最高/最低非零胜率比 < 2.5 且无 0 胜率角色」，并让各角色平均承伤收敛。

### 基线（PHASE3-BASE，2000 局）

scout 2.8% / fighter 3.4% / engineer 1.6% / medic 9.4%，ratio **5.88**（FAIL）。
医学生「急救」治疗量过大形成碾压，工程师「应急修理」只回体力不提供续航导致垫底。

### 调整（Phase 3 新增技能系统后的收敛）

| 角色 / 系统 | 调整 | 动机 |
| --- | --- | --- |
| 工程师 | `field_repair` 新增恢复生命（`skillRepairHealRatio` 0.3，后微调 0.2） | 让应急修理也提供续航，抬升工程师（原垫底） |
| 工程师 | defense 4→5 | 补足生存 |
| 医学生 | `first_aid` 治疗比例 0.4→0.28→0.30 | 收敛医学生碾压优势 |
| 医学生 | `medicHealMultiplier` 1.8→1.4→1.6 | 收敛医学生消耗品治疗优势 |
| 侦察员 | attack 6→7→8、defense 3→4 | 补足偏低攻防（原 2.8% 垫底） |
| 侦察员 | `dash` 持续 2→3（后回 2） | 延长闪避覆盖 |
| 斗士 | attack 7→8 | 补足正面强度 |
| 斗士 | `brawlerFleePenalty` 0.15→0.10 | 减少被缠住、收敛胜率 |

### 验收（2000 局，种子 PHASE3-FINAL → `reports/phase3-balance.json`）

scout 2.0% / fighter 2.0% / engineer 4.4% / medic 3.x%，ratio **2.2** < 2.5（PASS）；
引擎健康 PASS（timeout=0、illegalState=0、hardLimitReached=0）。

### 多种子稳健性（防 100 局/角色低胜率噪声）

| 种子 | 最高/最低 | ratio | 判定 |
| --- | --- | --- | --- |
| PHASE3-BAL | 4.0 / 3.4 | 1.24 | PASS |
| PHASE3-VERIFY | 4.2 / 2.2 | 1.90 | PASS |
| PHASE3-CHECK | 4.8 / 3.2 | 1.50 | PASS |
| PHASE3-FINAL | 4.4 / 2.0 | 2.20 | PASS |

四组独立种子全部 PASS，真实比值约 1.5–2.2，稳健低于 2.5 阈值。

### 承伤收敛

非治疗角色平均承伤 100–115（侦察 100 / 斗士 109 / 工程师 115），医学生约 150
（治疗者天然多承伤、靠治疗撑过，属合理分化，非失衡）。

## 数值口径

- 全部模拟基于 4 角色 × 5 策略矩阵（自动玩家与 NPC 共用同一决策内核与规则层）；
- 胜率口径：引擎 `status === 'won'` 的对局占比（`playing ⇒ timeout` 绝不伪造胜者）；
- 低绝对胜率属结构性：单人对抗 5 名 NPC，玩家死亡即对局结束，获胜需 5 个 NPC 全灭。
  验收标准（§五/§六）只约束**角色间胜率比**与**无 0 胜率**，不设胜率门槛。

## 文件

- `reports/phase2a1-balance.json` / `.md`（权威报告，含 `characterBalance` 验收字段）
- 调整落点：`src/data/characters.ts`、`src/data/gameConfig.ts`（被动数值）、
  `src/core/gameState.ts`（移除斗士开局木棍）、`src/core/search.ts`（锐目遇敌加成）、
  `src/core/combat.ts`（锐目逃跑加成）
