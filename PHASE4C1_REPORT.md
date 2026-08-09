# Phase 4C-1 报告：合成树深化与武器获取路径

## 1. 结论

本阶段实现了“合成是武器主路径”的明示引导、三层武器合成链、跨区域材料来源提示，以及医院和各区域稀有池的直接武器保底路径。`src/core/**` 未改动，版本仍为 `0.3.2`。

本地门禁全部通过。500 局回归只按本阶段规定的引擎健康口径判定：请求 500 = 实际 500，超时、死锁、非法行动、硬上限均为 0。胜率和角色数据仅作为观察值记录。

## 2. 改造前后

| 指标 | 改造前 | 改造后 |
| --- | ---: | ---: |
| 物品总数 | 23 | 29 |
| 材料 / 武器 / 防具 / 消耗品 | 10 / 5 / 3 / 5 | 10 / 11 / 3 / 5 |
| 配方总数 | 11 | 17 |
| 武器配方 | 5 | 11 |
| 最大合成树深度 | 2 层 | 3 层 |
| 医院稀有池武器 | 0 / 3 | 1 / 4（木棍） |
| 医院基础池武器 | 0 | 1（木棍） |

树深度按“原始材料 → 成品”为 1 层计算。原有石斧已经是 2 层；野外长矛是新的 3 层链：木材 + 石头 → 木棍 → 加固握把 → 野外长矛。

各区域稀有池现在都至少含有一件武器：学校木棍 1/3、医院木棍 1/4、住宅区石斧 1/3、工厂铁管 1/3、森林石斧/简易弓 2/3、研究所电击棒 1/3。这里的分数是池构成，不是承诺每次搜索结果；有限库存和搜索规则仍由 `src/core/**` 负责。

## 3. 新合成路径

| 高阶产物 | 中间部件 | 原始材料与公开来源区域 |
| --- | --- | --- |
| 野外长矛 | 木棍 → 加固握把 | 木材/石头（学校、工厂、森林等）+ 绳子（学校、住宅区、工厂、森林）+ 铁块（工厂、研究所） |
| 钢刃斧 | 石斧 | 木材/石头先做石斧（学校、工厂、森林等）+ 铁块（工厂、研究所） |
| 复合弓 | 简易弓 | 木材/绳子先做简易弓 + 玻璃（住宅区、研究所） |
| 绝缘铁管 | 铁管 | 废金属/木材先做铁管 + 布料（学校、医院、住宅区） |
| 绝缘电击棒 | 电击棒 | 电池/废金属先做电击棒 + 布料（学校、医院、住宅区） |

新增 `src/ui/craftPathPresentation.ts` 是纯展示层：它只读取玩家自己的背包、静态配方、静态 `basePool`/`rarePool` 及已公开的区域状态来展示路线，不读取 `zone.loot`、`remainingLootCount`、未发现掉落或其他角色数据。路径区明确显示“先完成中间部件”、原始材料缺口和静态公开来源区域。现有 4B-3 推荐块继续使用既有的公开模糊物资分档，不显示精确库存百分比。

## 4. NPC 与确定性评估

- 未修改 `src/core/npcDecide.ts` 或其他 `src/core/**` 文件。
- 现有 `findUpgradeRecipe` 每次行动都会重新扫描当前可支付的升级配方，因此中间产物保持 `weapon` 类别后，可以按“先做中间件、下一回合再做高阶武器”的方式工作。
- 新测试用正式 `findUpgradeRecipe` + `performCraft` 连续验证了木材/石头 → 木棍 → 加固握把 → 野外长矛，不需要 core 变更。
- 新增武器的攻击/价值档位保持在已有 NPC 升级判断能稳定处理的范围内；没有为胜率或存活率调数值。既有 NPC 规划断言未被削弱。
- 医院池的新增会改变固定种子的 loot/RNG 后续序列。`tests/phase3a1Stats.test.ts` 的研究异常覆盖种子由 `STAT-9` 更新为仍稳定触发该事件的 `STAT-11`；原有伤害/致死断言保持不变。确定性复验仍通过。

## 5. 可达性观察数据（非平衡门禁）

数据文件：`reports/phase4c1-craft-reachability.json`。

方法是 10 组种子 × 4 角色 × 5 策略 = 200 局，使用 `tools/autoPlayer.ts` 的正式命令通道。平均对局长度为 35.395 时间单位，200/200 局健康结束。

| 高阶武器 | 至少做出一次的对局 | 对局频次 | 其中玩家做出 |
| --- | ---: | ---: | ---: |
| 野外长矛 | 5 / 200 | 2.5% | 3 / 200 |
| 钢刃斧 | 15 / 200 | 7.5% | 2 / 200 |
| 复合弓 | 22 / 200 | 11.0% | 4 / 200 |
| 绝缘铁管 | 11 / 200 | 5.5% | 3 / 200 |
| 绝缘电击棒 | 7 / 200 | 3.5% | 5 / 200 |

这是“在当前自动策略和随机样本中实际做出”的观察，不是可达成率保证，也不作为胜率/平衡 PASS 条件。所有新物品没有正式 PNG，浏览器证据确认沿用既有物品 emoji fallback。

## 6. 门禁结果

| 门禁 | 结果 |
| --- | --- |
| `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS，65 files / 1272 tests |
| `npm run build` | PASS |
| `npm run audit:save` | PASS，74/74 损坏用例拒绝 |
| `npm run audit:deps` | PASS，分层违例 0 |
| `npm run art:doctor -- --offline` | PASS |
| `npm run art:validate` | PASS |
| `npm run art:audit:phase4a` | PASS |
| `npm run art:security:browser` | PASS |
| `npm run art:security:repo` | PASS |
| `npm run simulate -- --games 500 --seed-prefix PHASE4C1 --regression` | PASS；500/500，timeout/deadlock/illegal/hard-limit 均为 0 |
| `npm audit --omit=dev` | PASS，0 vulnerabilities |

模拟报告：`reports/phase4c1-balance.json`。其中胜率、存活率、角色平衡只保留为观察数据，没有参与本阶段回归判定。

## 7. 浏览器证据

证据在 `npm run build` 后由 `npm run preview` 的干净生产构建采集：

- `output/phase4c1-browser/01-desktop-guidance-and-chain.png`：1280×720，武器主路径、3 层链、来源区域和 fallback 图标。
- `output/phase4c1-browser/02-mobile-completed-high-tier.png`：390×844，野外长矛目标已达成，宽度无溢出。
- `output/phase4c1-browser/*.json`：运行时数值与 `render_game_to_text` 快照。
- `output/phase4c1-browser/runtime-errors.json`：console errors 0、page errors 0。

证据分级：

- `CODE-VERIFIED`：物品/配方注册、合成守恒、NPC 单步升级扫描、信息边界测试、fallback 注册与所有命令门禁。
- `RUNTIME-VERIFIED`：1280×720 / 390×844 生产预览中的引导、路线、成品达成、emoji fallback、无横向溢出、0 console/page errors。
- `HUMAN-PLAYTEST-NEEDED`：真实触控下跨区域取材的操作节奏、实际玩家对“主要靠合成”文案的理解度，以及不同策略下的主观可玩性。

## 8. Scope 自查

- 0 次图像生成 API 调用。
- `public/assets/**/*.png` 35 张逐字节未改。
- `art/approved-assets.json`、Candidate 状态、Manifest 未改。
- `src/core/**` 未改；本轮只改 `src/data/**`，另增 UI 纯展示层和观察工具。
- 未改战斗公式、技能、NPC AI、掉落结算、RNG 实现、Save schema、世界事件规则或禁区时序。
- `GAME_VERSION` 保持 `0.3.2`：仅新增物品/配方 id，旧存档结构与既有 id 仍有效；74 例存档审计通过。
- 新 UI 不展示当前区域真实剩余库存、未发现掉落、他人背包或 NPC 信息；边界回归测试和生产预览检查通过。
