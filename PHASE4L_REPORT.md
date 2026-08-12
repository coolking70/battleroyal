# Phase 4L — Expanded Character / Profession Roster

## 1. 交付结论

Phase 4L 将可玩职业从 4 个扩展到 8 个，新增：

| id | 名称 | 核心身份 | 主技能 | 第二技能 |
| --- | --- | --- | --- | --- |
| `survivor` | 生存专家 | 长线体力与禁区耐受 | 第二呼吸 | 扎营节律 |
| `scavenger` | 拾荒者 | 有限物资搜索与材料路线 | 搜索专注 | 筛选稀有 |
| `hunter` | 猎人 | 已知目标追踪与远程接敌 | 追踪目标 | 稳定瞄准 |
| `trapper` | 陷阱师 | 防御姿态、反击与撤离准备 | 埋伏准备 | 预留退路 |

原有侦察员、斗士、工程师、医学生保持兼容。新职业不是单纯替换属性，而是通过现有统一技能 / 状态 / 行动管线改变搜索、战斗、撤离和长期生存决策。

## 2. Phase 4K 前置合并与分支

- Phase 4K PR：#18
- 验收 head：`573648849c783b534256903cf29fa0d30978a809`
- 合并方式：GitHub 普通 merge commit
- Phase 4K merge commit：`bd5ec85dc4cb1c4770e121fb4bd3271e9a7ff25d`
- 新分支：`agent/phase4l-expanded-profession-roster`
- 分支基线：`main` at `bd5ec85dc4cb1c4770e121fb4bd3271e9a7ff25d`
- Phase 4L 不在本报告阶段合并。

## 3. 架构审计与实现决策

审计确认角色、技能、状态、行动和 UI 已经具备可扩展接缝：

- `CHARACTERS` 是职业注册表，启动、NPC 模板和角色选择读取同一份数据。
- `SkillDef` / `SKILLS` / `getCharacterSkills` 是数据驱动映射；新职业各挂 2 个技能。
- 玩家、NPC、AutoPlayer 都通过 `useSkill` / `useSkillActor` / `executeCommand` 共享规则。
- 搜索、战斗、撤离、休息和禁区伤害只在既有规则入口增加职业修正。
- `commandHandlers.ts` 保持原有 499 行上限，没有复制第二套 handler；本阶段未做不必要的结构拆分。
- 存档校验新增职业注册表与 `passiveId` 一致性，并校验新增状态字段、持续时间和配置值。

历史的四角色特殊逻辑仍保留在对应领域模块；Phase 4L 新逻辑集中在注册表、配置和共享状态查询，不引入角色 id 到处散落的执行分支。

## 4. 新职业行为矩阵

| 职业 | 被动 | 主动行为 | 资源边界 |
| --- | --- | --- | --- |
| 生存专家 | 休息额外恢复；禁区伤害 ×0.8 | `second_wind` 正体力成本换即时恢复；`camp_routine` 放大后续 REST | 不免费行动，不改最大体力之外的资源来源 |
| 拾荒者 | 搜索发现 ×1.2；材料权重偏好 | `scavenge_focus` 放大发现权重；`sort_rare` 提高正式稀有抽取概率 | 仍从有限 loot pool 取物，不生成物品、不增加库存 |
| 猎人 | 已知目标远程命中 ×1.08 | `track_target` 提高同区遭遇权重；`steady_aim` 仅提高远程命中 | 不读取远端位置，不写入精确全图情报 |
| 陷阱师 | 防御姿态反击概率提高 | `prepare_ambush` 进入防御并挂反击状态；`escape_plan` 提高正式撤离 | 反击仍走既有体力与命中管线，撤离仍是普通 FLEE |

## 5. UI 与视觉

- 主菜单角色卡片由 `CHARACTERS.map` 自动扩展到 8 张。
- 每张卡显示名称、描述、生命 / 体力 / 攻击 / 防御 / 感知 / 速度 / 制作 / 医疗、被动说明和两项技能说明。
- 角色卡带 `data-character-id` 与 `aria-pressed`，便于自动化验收和键盘语义检查。
- 网格布局在桌面端自适应，多卡在窄屏降为单列；未生产新 PNG。
- 原有四名角色的 SVG / production asset 路径未改动；新增角色明确使用 emoji + 色块 fallback，不伪造美术资产。
- 主菜单区域数量读取 `ZONE_IDS.length`，不再硬编码旧区域数量。

## 6. NPC、AutoPlayer 与成长

- NPC survival/combat skill decision 已覆盖 8 个职业的战略触发条件。
- 新职业开局使用完整 NPC 注册表；历史四职业开局保留旧四职业 NPC RNG 基线，以免扩张职业表改变既有确定性回归。
- AutoPlayer 不新增旁路，所有新职业均可通过标准合法命令闭环运行。
- 技能等级仍由 `level` 推导：主技能 Lv.1，第二技能 Lv.3；冷却保存于 `skillCooldowns`。
- 技能释放仍支付正体力成本并推进时间；零体力时 REST / FLEE / GUARD 的旧出口继续有效。

## 7. 存档、信息边界与物品守恒

- 新职业、新技能冷却和新状态可保存 / 读取。
- 加载时验证 `characterId` 存在且 `passiveId` 与注册表匹配；新状态的数值、持续时间、`hpPerTick` 也受配置约束。
- Hunter 追踪只改变搜索权重；不会读取 `aliveCharacterIds`、远端位置或写精确身份位置情报。
- Scavenger 技能只改变有限池抽取权重；不会增加区域库存或凭空生成物品。
- `itemCount` / 地面掉落 / 背包 / 装备的守恒回归通过。

## 8. 验证结果

已通过：

- `npm run typecheck`
- `npm test` — 91 files / 1481 tests
- `npm run build`
- `npm run audit:save`
- `npm run audit:deps`
- `npm run art:doctor -- --offline`
- `npm run art:validate`
- `npm run art:audit:phase4a`
- `npm run art:security:browser`
- `npm run art:security:repo`
- `npm audit --omit=dev`
- `npm run simulate -- --games 500 --seed-prefix PHASE4L --regression --output reports/phase4l-regression.json`

500 局回归证据：

- [reports/phase4l-regression.json](reports/phase4l-regression.json)
- [reports/phase4l-regression.md](reports/phase4l-regression.md)
- 8 职业 × 5 策略 = 40 cells，requested = actual = 500
- timeout / illegalState / deadlock / livelock / empty legal set / hard limit：均为 0
- Phase 3A 玩法门槛：PASS
- 角色胜率比：2.71，超过 2.5；按 Phase 4L 政策仅记录观察，不做平衡调参

历史 `reports/phase3-balance.json` 与 `reports/phase3-balance.md` 未被重写。

## 9. 人工试玩与延期项

- 人工试玩清单：[PHASE4L_HUMAN_PLAYTEST.md](PHASE4L_HUMAN_PLAYTEST.md)
- 当前状态：`NEEDS-HUMAN-PLAYTEST`
- 未在本阶段做：平衡调参、Crafting 2.0、PvE、胜利条件、正式新美术生产。
- 进入下一阶段前需先完成新职业的人工可玩性、信息边界、手机布局和长局存档恢复检查。
