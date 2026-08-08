# 区域式大逃杀（网页游戏 · 第一阶段）

一个**纯前端、零后端**的回合制「区域式大逃杀」网页游戏。1 名玩家对阵 5 名 AI 参赛者，在 6 个相互连通的区域中搜索物资、合成装备、遭遇并战斗，同时躲避不断收缩的「禁区」。第一目标是交付一个**可运行、可测试、确定性可复现**的垂直切片（vertical slice），核心逻辑与界面严格分离。

> 项目代号：`zone-battle-royale` · 版本 `0.3.0`（Phase 3A）

---

## 1. 项目简介

本作受大逃杀题材启发，但刻意做减法：

- **没有**多人联机、账号、登录、商城、抽卡、地图缩放、3D 渲染等任何重型功能。
- **只有**最贴近玩法内核的循环：移动 → 搜索 → 合成 → 装备 → 遭遇 → 战斗 → 撤离禁区。
- 所有「随机性」都由**带种子的伪随机数生成器（PRNG）**驱动，因此同一颗种子必然产生同一局对局，方便测试与复盘。

第一阶段交付一个**完整可玩的单机竖切**：菜单、角色选择、对局主界面、遭遇战、合成、背包、结算、调试面板、自动存档一应俱全。

---

## 2. 技术栈与运行要求

| 维度 | 选型 |
| --- | --- |
| 语言 | TypeScript（严格模式 `strict` + `noUnusedLocals` 等全开） |
| 框架 | React 18 + Vite 5 |
| 样式 | 原生 CSS（单文件 `src/ui/styles.css`，无 UI 框架） |
| 测试 | Vitest（核心逻辑 node 环境，UI 冒烟测试 jsdom 环境） |
| 状态 | 纯函数命令引擎 + 单一 `useGame` 粘合层，无 Redux / 状态库 |
| 渲染 | React 组件，**不使用** Phaser / PixiJS / Three.js |
| 后端 | **无**。无数据库、无 WebSocket、无服务端 |

**运行要求**

- Node.js ≥ 18（已在 Node 22 验证）
- 包管理器：npm

**明确排除项（满足第一阶段约束，详见第 12 节）**：无联机、无登录/账号、无商城/内购/抽卡、无外部 AI 接口、无重型引擎、无大型 UI 组件库。

---

## 3. 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173 ）
npm run dev

# 生产构建（tsc 类型检查 + vite 打包，产物在 dist/）
npm run build

# 运行全部测试
npm test

# 自动平衡模拟（默认 1000 局；可加参数指定局数，如 npm run simulate -- 500）
npm run simulate
```

> 调试面板：在 URL 后追加 `?debug=1`（如 `http://localhost:5173/?debug=1`）即可开启开发者调试面板，可查看种子、RNG 状态、当前禁区倒计时、各 NPC 决策依据、噪音与情报视图，并支持「推进时间 / 给予材料 / 回满状态 / 立即封锁禁区 / 削弱 NPC / 导出存档 JSON」等调试命令。

---

## 3.1 第二阶段（Phase 2）要点

当前版本 `0.2.0`，在**不推倒重写**第一阶段的前提下完成核心硬化与战略搜集循环：

- **有限物资**：每个区域开局一次性生成有限清单，搜空后全场广播，NPC 不再空搜。
- **体力战略循环**：移动 / 攻击 / 合成消耗体力，0 体力无法行动，杜绝无限拖拽；**逃跑自 Phase 2A 起为免费行动（体力 0）**，保证遭遇战中永远存在一个可执行出口，但逃跑仍消耗 1 个时间单位、失败还会被追击致死，因此免费 ≠ 无代价。
- **终局收束**：阶段（开局 / 中局 / 终局）+ 终局衰竭 + 180 硬上限，对局必然在有限时间结束。
- **信息不完全**：地图只显示噪音分档与最后已知位置情报；同区对手仅「遭遇中」暴露精确数值。
- **制作目标**：玩家可显式设定制作目标，NPC 按 TTL 自动规划并复规划。
- **存档安全**：v2 存档深度校验；检测到 v1 旧存档只提示删除，不做静默迁移。
- **自动平衡**：`npm run simulate` 批量模拟并校验 4 性格胜率比 < 2.2。

---

## 3.2 第三阶段（Phase 3）要点

版本仍为 `0.2.0`（Phase 3 为在 Phase 2 之上的增量深化，**不推倒重写、不扩大功能范围**），聚焦「战术深度 + 可观测性 + 平衡收敛」：

- **战斗风格**：攻击拆分为 `迅捷 / 标准 / 强攻` 三种风格，命中率、伤害倍率与体力开销各不相同，玩家与 NPC **共用同一套规则**（无 AI 特权）。
- **角色专属技能**：4 名可选角色各有一个带冷却的主动技能——`急救`（斥候/通用系恢复生命）、`战术冲刺`（速度增益，持续 2 时间单位）、`野战维修`（修复装备耐久并恢复少量生命）、`精准医疗`（医学生高倍率治疗）。技能受体力与冷却双重约束。
- **动态事件**：对局中会触发 `风暴 / 空投 / 伏击` 三类随机事件，改变区域收益与风险；事件对玩家与 NPC 同等生效。
- **视觉升级**：状态条低于 30% 时脉动预警、按钮/面板渐变与按下反馈、`你 / 敌` 角色徽章、遭遇列表悬停高亮（纯样式改动，不触碰核心逻辑）。
- **调试增强**：`?debug=1` 面板新增「技能冷却 / 战斗风格命中与逃跑概率 / 当前生效事件 / RNG 状态（种子 + 可重放说明）」四个分区。
- **脚本化对局验证**：`reports/phase3-scripted-playthroughs.md` 记录 8 局全自动对局，全部正常收束、无卡死，且技能释放与三类动态事件覆盖率均为 8/8。
- **平衡收敛**：`npm run simulate -- --games 2000` 的最高/最低非零胜率比由基线 **5.88** 收敛至 **2.20**，并在 4 个独立种子（BAL / VERIFY / CHECK / FINAL）上全部通过 `< 2.5` 红线，无 0 胜率角色，引擎健康指标（超时 / 非法状态 / 触顶）全为 0。调优明细见 `BALANCE_CHANGELOG.md`。

---

## 3.3 Phase 3A 要点（版本 0.3.0）

在 Phase 3 之上继续做「战斗正确性 + 角色特色 + 世界事件 + 视觉资产接口」闭环，**不推倒 Phase 2/3 已验收的底层**，并新增 5 条红线（见 `PHASE3A_BASELINE.md`）：

- **EXPOSED（露出破绽）**：重击挥空 → 自己破绽，下一次受到**攻击类战斗伤害** +20%；只由 heavy miss 产生、只作用于 `resolveAttack` 路径、不可叠加。修复了 Phase 3 的 BUG-01（攻击风格漏传导致 UI 命中率与核心概率不一致）。
- **四角色签名技能重做**：侦察员「战场侦察」（信息）/ 斗士「肾上腺素」（战斗节奏，唯一带负面代价）/ 工程师「野外工造」（合成）/ 医学生「紧急处置」（消耗品经济），触发条件贴着各自战略维度。
- **世界事件（取代 storm/supply_drop/ambush）**：6 种环境修正型事件（大停电 / 连绵阴雨 / 紧急广播 / 医疗管制 / 研究异常 / 全城骚动），一律不写实体状态，只提供修正值由各系统查询 —— 编译期杜绝塞物资 / 瞬移 / 直接扣血。
- **命中率同源不变量**：UI 展示的命中率必须 === core 实际掷骰概率（`hitChanceIn` / `fleeChanceIn` 为唯一入口，含世界事件修正）。
- **视觉资产接口**：`visualAssets.ts` 统一注册表 + `assets/` SVG 目录 + fallback（缺图自动退回 emoji + 色块）。
- **模拟统计升级**：`simulateBalance` 新增攻击风格使用率 / Heavy 风险 / 防御 / 技能 / 世界事件覆盖统计与验收门槛（quick·heavy·guard ≥2%，6 事件各 ≥50 次 @3000 局）。
- **存档校验升级**：世界事件（active/history 自洽、同事件不叠加、并发上限）+ EXPOSED 红线（hpPerTick=0、damageTakenMult 一致、不可叠加）+ 技能冷却（合法 id、非负）。
- **依赖审计**：`npm run audit:deps` 静态扫描分层方向 / 红线隔离 / 环依赖 / 单文件体量（core/data ≤ 500 行）。

设计文档：`COMBAT_DESIGN.md` / `SKILL_DESIGN.md` / `WORLD_EVENT_DESIGN.md` / `VISUAL_ASSET_SPEC.md` / `DEPENDENCY_AUDIT.md`。

---

## 4. 游戏玩法概述

- 每局 **6 名参赛者**：1 名玩家（`你`）+ 5 名 NPC。
- 时间以**离散时间单位**推进：玩家每执行一个「消耗时间的动作」即推进 1 个时间单位，随后所有存活 NPC 各自行动一次。
- 胜负：
  - **胜利**：全场仅剩玩家一人（其余 5 名 NPC 全部出局）。
  - **失败**：玩家生命归零，或被困在禁区中阵亡。
- 角色拥有 `生命 / 体力 / 攻击 / 防御 / 感知 / 速度 / 合成 / 医疗` 八项属性，并各自带一个**被动**（如「锐目」「搏击」「巧手」「临床」）。
- 单局节奏约数十个时间单位内分出胜负，适合快速重开。

---

## 5. 核心系统说明

| 系统 | 说明 | 关键文件 |
| --- | --- | --- |
| 命令引擎 | `executeCommand(state, command)` 为**纯函数**：先深拷贝状态，再在副本上结算，绝不修改入参。 | `src/core/gameEngine.ts` |
| 时间推进 | `advanceTime`：时间 +1 → NPC 行动 → 状态效果 → 禁区更新 → 清理遭遇 → 死亡/胜负检查。 | `src/core/gameEngine.ts` |
| 移动 | 仅可前往**相邻**区域，消耗 3 点体力。 | `commandHandlers.ts` / `commands.ts` |
| 搜索 | 消耗 5 点体力，按权重判定「找到物品 / 遭遇敌人 / 一无所获」；区域物资随搜索衰减（下限 15%）。 | `src/core/search.ts` |
| 战斗 | 命中率随攻防、速度、距离动态计算；含反击与逃跑；玩家遭遇由独立面板承接。 | `src/core/combat.ts` |
| 合成 | 配方消耗材料 + 体力（工程师仅 1 点），可产出武器 / 防具 / 治疗品。 | `src/core/crafting.ts` |
| 装备 | 武器 / 防具槽位，影响攻击与防御；可换下。 | `src/core/inventory.ts` |
| 消耗品 | 治疗 / 恢复体力；可合成或搜出。 | `src/core/consumables.ts` |
| 禁区 | 动态封锁区域，身处其中每时间单位受 20 点伤害。 | `src/core/restrictedZones.ts` |
| NPC AI | 硬性优先级（1–7）+ 人格加权的行动选择。 | `src/core/npcAi.ts` / `src/core/npcDecide.ts` |
| 事件日志 | 全局公开事件流，供界面与 NPC 决策共同消费。 | `src/core/events.ts` |

---

## 6. 角色与 NPC

**4 名可选玩家角色**（差异化的属性与被动）：

| 角色 | 定位 | 被动 |
| --- | --- | --- |
| 侦察员 | 高感知、少空手 | 锐目：空手概率减半，更早察觉敌人 |
| 斗士 | 高血高攻 | 搏击：近战 +2 伤害，逃跑 -15% |
| 工程师 | 合成强 | 巧手：合成仅耗 1 体力，更易搜到材料 |
| 医学生 | 治疗强 | 临床：治疗量 +50%，医院搜索加成 |

**5 种 NPC 人格**（每局洗牌后各出现一次，保证 5 种齐全）：

- `aggressive` 好斗、`cautious` 谨慎、`collector` 收集、`opportunist` 投机、`random` 随性。

NPC 只能读取「公开信息」：自身状态、全场广播的禁区状态、同区域可见角色、地面掉落、公共击杀记录；**严禁**读取其他角色背包。人格影响其交战阈值、撤离倾向与常规行动权重。

---

## 7. 物品与配方

- **23 种物品**：10 材料 + 5 武器 + 3 防具 + 5 消耗品（名称与描述均为原创占位内容）。
- **11 个配方**，例如：木棍、石斧、铁管、简易弓、电击棒、布衣、简易护甲、铁板护甲、绷带、医疗包、草药。
- 物品支持堆叠（`stackable` + `maxStack`），背包固定 **8 格**；背包已满时通过「替换」交互处理新拾取。

---

## 8. 区域与禁区机制

- **6 个固定区域**，连接关系写死并在模块加载时做对称性自检：

  学校 ─ 医院 ─ 研究所 ─ 工厂 ─ 住宅区 ─ 森林（互为相邻，详见 `src/data/zones.ts`）。

- **禁区时间线**：
  - 第 **8** 个时间单位首次公布禁区；
  - 之后**每 6 个时间单位**新增一个禁区；
  - 封锁前先有 **2 个时间单位**的「预警」；
  - 处于「正式禁区」的角色每时间单位受 **20 点**伤害；
  - 始终至少保留 **1 个**安全区域。

NPC 会优先撤离禁区 / 预警区；玩家若滞留其中将快速掉血，是核心的「收缩」压力来源。

---

## 9. 架构与目录结构

核心设计原则：**游戏逻辑（`src/core`、`src/data`）与 React 界面（`src/ui`、`src/App.tsx`、`src/main.tsx`）完全分离**。核心层为纯函数、无 React 依赖、可独立测试。

```
src/
├── core/                # 纯逻辑层（无 React）
│   ├── gameEngine.ts        # 命令入口 executeCommand / advanceTime
│   ├── commandHandlers.ts   # 玩家各命令的具体结算
│   ├── npcAi.ts             # NPC 回合执行 + 交手
│   ├── npcDecide.ts         # NPC 决策（硬编码优先级 + 人格权重）
│   ├── combat.ts            # 命中 / 伤害 / 反击 / 逃跑
│   ├── crafting.ts / search.ts / consumables.ts / inventory.ts
│   ├── restrictedZones.ts   # 禁区收缩
│   ├── gameState.ts         # 状态创建 / 查询 / 胜负
│   ├── commands.ts          # 命令合法性校验
│   ├── events.ts / random.ts / saveLoad.ts / types.ts
│   ├── skills.ts / exposed.ts / statusIds.ts     # Phase 3A：角色技能 / EXPOSED / 状态 id 常量
│   ├── worldEvents.ts / worldEventAudit.ts       # Phase 3A：世界事件（环境修正型）/ 不变量审计
│   ├── npcSkillDecide.ts                         # 自 npcDecide 拆出：NPC 技能决策
│   ├── npcGoalPlan.ts                            # 自 npcDecide 拆出：NPC 长期制作目标规划
│   ├── legalActionBuilders.ts                    # 自 legalActions 拆出：合法动作子集枚举
│   ├── actorActionBase.ts / actorCombatActions.ts  # 自 actorActions 拆出：公共基座 / 战斗行动
│   ├── commandTypes.ts                           # 自 types 拆出：命令与事件类型
│   └── （所有 core 单文件均 < 500 行，最大 types.ts 486）
├── data/                # 静态配置：characters / items / recipes / zones / gameConfig
├── ui/                  # React 表现层
│   ├── screens/         # MenuScreen / GameScreen / ResultScreen
│   ├── components/      # StatusBar / ZoneMap / Inventory / CraftPanel / EncounterPanel ...
│   ├── assets/          # Phase 3A：SVG 视觉资产（zones/ characters/ events/ + fallback + manifest）
│   ├── visualAssets.ts  # Phase 3A：视觉注册表（emoji + 色块 + 图片路径 + fallback）
│   └── styles.css
├── utils/              # format.ts（展示辅助）+ useGame.ts（核心↔React 唯一粘合层）
├── App.tsx / main.tsx
tests/                   # Vitest：random / zones / movement / combat / search / crafting / npc / save / victory / ui / 世界事件不变量 / 视觉资产 / 存档校验（共 35 个文件）
```

**粘合层**：`src/utils/useGame.ts` 是唯一接触 React 状态的核心调用方——`dispatch(command)` 内部调用 `executeCommand`，拿到新状态后 `setState`，并触发 localStorage 自动存档与 toast 反馈。

---

## 10. 确定性、存档与调试

- **确定性 RNG**：`src/core/random.ts` 使用 `xmur3` 字符串哈希 + `mulberry32` 算法；默认种子 `BR-DEMO-001`。核心逻辑**一律不得使用** `Math.random()`，仅 `generateRandomSeed()`（菜单「随机」按钮）例外。
- **存档**：对局状态通过 `src/core/saveLoad.ts` 写入 `localStorage`（key：`zone-br.save.v1`），每次状态变更自动保存；主菜单可「继续上次对局」。该模块支持注入 `StorageLike`，便于测试替换为内存存储。
- **调试**：`?debug=1` 开启调试面板，可见种子 / RNG 状态 / 时间 / 禁区倒计时 / 各 NPC 最近决策理由与战力，并提供若干调试命令（推进时间、给材料、回满、立即封锁、削弱 NPC）。

---

## 11. 测试

- 框架：**Vitest**，`globals: true`，默认 node 环境；UI 冒烟测试用 `@vitest-environment jsdom` 单独覆盖。
- 当前 **491 个测试，全部通过**，分布在 35 个文件（第一阶段 71 → 第二阶段 128 → 第三阶段 424 → Phase 3A 491）。
- 下表为第一阶段的 10 个基础文件，后续阶段在此之上新增了硬化 / 死锁 / 物品守恒 /
  技能 / 动态事件 / 世界事件不变量 / 视觉资产 / 存档校验 / 平衡验收等专项用例：

| 测试文件 | 覆盖点 |
| --- | --- |
| random.test.ts | 种子哈希、确定性、分布 |
| zones.test.ts | 区域相邻对称性、连接 |
| movement.test.ts | 移动合法性、体力消耗 |
| combat.test.ts | 命中 / 伤害 / 反击 / 逃跑 |
| search.test.ts | 搜索权重、衰减、遭遇 |
| crafting.test.ts | 配方消耗、产出、体力 |
| npc.test.ts | 人格决策、撤离、治疗、确定性、胜率差异 |
| save.test.ts | 存档 / 读档 / 内存存储 |
| victory.test.ts | 胜负判定、排名 |
| ui.test.tsx | 菜单 / 开局 / 搜索推进 / 合成 / 日志 / 读档 |

---

## 12. 开发约定与限制（第一阶段范围）

**已遵守的硬约束**

- TypeScript 严格模式全开；核心逻辑**无 `any`**、**无 `console.*`**；`Math.random()` 仅出现在 `generateRandomSeed()`。
- 所有 `core/` 单文件 **< 500 行**。
- `npm install` / `npm run dev` / `npm run build` / `npm test` 均零错误。

**第一阶段明确不包含（避免范围蔓延）**

- 多人联机 / WebSocket / 服务端。
- 登录、账号系统、云存档。
- 商城、内购、抽卡、排行榜。
- 地图缩放、3D、粒子特效、音效。
- 外部 AI / LLM 接口参与对局。
- 主动技能树、复杂剧情、任务系统。

这些被刻意排除，以保证第一阶段是一个**聚焦、可控、可验证**的竖切。后续阶段可在本架构之上增量扩展。
