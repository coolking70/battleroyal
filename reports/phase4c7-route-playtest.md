# Phase 4C-7 半自动路线观察

> 本报告是 `SEMI_AUTOMATED_ROUTE_OBSERVATION`。它不是真人试玩，没有填写 `HUMAN_PLAYTEST_CHECKLIST.md`，也不替代真机/真人判断。

## 方法

- 矩阵：4 characters × 5 policies (truncated deterministic matrix)，请求 20 局，实际 20 局。
- 命令闭环：SET_CRAFT_GOAL / SEARCH / MOVE / CRAFT / EQUIP and other legal commands only。
- 记录边界：record only player actor milestones; no zone.loot, NPC inventory, NPC location, planner reason or future event data。
- 健康：20/20 条路线可信；请求数等于实际数；没有超时、死锁、非法命令或硬上限。

## 里程碑汇总（观察数据）

| 里程碑 | 对局数 |
| --- | ---: |
| 采纳公开制作目标 | 20 |
| 观察到玩家拾取原材料 | 20 |
| 完成目标依赖中的中间步骤 | 15 |
| 获得任一武器 | 19 |
| 发生装备事件 | 19 |
| 首次进入遭遇 | 18 |
| 完成当前制作目标 | 9 |
| 玩家死亡 | 17 |

死亡原因：衰竭 6、战斗 5、禁区侵蚀 6。

## 路线诊断分类

| 分类 | 对局数 |
| --- | ---: |
| target-completed | 9 |
| equipped-before-encounter | 3 |
| encounter-before-equipment | 0 |
| weapon-not-converted | 8 |
| no-player-material-observed | 0 |
| no-target-adopted | 0 |

分类只说明观察到的里程碑顺序，不等同于经济平衡结论；“未观察到”也不证明区域库存为空。

## 逐路线时间

| 路线 | 角色 / 策略 | 目标 | 目标采纳 | 原材料（已拾取） | 中间步骤首个 | 武器首个 | 装备首个 | 遭遇首个 | 目标完成 | 死亡原因 | 诊断 |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| route-0-scout-aggressive | scout / aggressive | 复合弓 | 0 | 布料、玻璃、绳子、石头、木材 | 23 | 5 | 6 | 4 | 24 | 衰竭 | target-completed |
| route-1-fighter-aggressive | fighter / aggressive | 复合弓 | 0 | 布料、玻璃、药草、绳子、木材 | 8 | 8 | 9 | 2 | — | 衰竭 | weapon-not-converted |
| route-2-engineer-aggressive | engineer / aggressive | 复合弓 | 0 | 玻璃、铁块、绳子、废金属、石头、木材 | 26 | 26 | 20 | 4 | 27 | 衰竭 | target-completed |
| route-3-medic-aggressive | medic / aggressive | 复合弓 | 0 | 玻璃、绳子、石头、木材 | 39 | 1 | 2 | 30 | 40 | 衰竭 | target-completed |
| route-4-scout-cautious | scout / cautious | 复合弓 | 0 | 布料、玻璃、绳子、废金属、木材 | — | 9 | 10 | 2 | — | 战斗 | weapon-not-converted |
| route-5-fighter-cautious | fighter / cautious | 复合弓 | 0 | 绳子、石头、木材 | 19 | 9 | 10 | — | — | 禁区侵蚀 | equipped-before-encounter |
| route-6-engineer-cautious | engineer / cautious | 复合弓 | 0 | 布料、玻璃、铁块、绳子、废金属、木材 | 9 | 3 | 4 | — | 26 | — | target-completed |
| route-7-medic-cautious | medic / cautious | 绝缘铁管 | 0 | 铁块、绳子、废金属、石头、木材 | — | 2 | 4 | 20 | 3 | — | target-completed |
| route-8-scout-collector | scout / collector | 复合弓 | 0 | 布料、玻璃、绳子、石头、木材 | 33 | 33 | 34 | 1 | — | 战斗 | weapon-not-converted |
| route-9-fighter-collector | fighter / collector | 复合弓 | 0 | 药草、绳子、木材 | 5 | 5 | 6 | 2 | — | 禁区侵蚀 | weapon-not-converted |
| route-10-engineer-collector | engineer / collector | 复合弓 | 0 | 布料、玻璃、铁块、绳子、木材 | 37 | 37 | 39 | 1 | 38 | 衰竭 | target-completed |
| route-11-medic-collector | medic / collector | 复合弓 | 0 | 布料、绳子、木材 | 46 | 46 | 47 | 2 | — | 衰竭 | weapon-not-converted |
| route-12-scout-opportunist | scout / opportunist | 复合弓 | 0 | 布料、玻璃、绳子、废金属、石头、木材 | 9 | 9 | 11 | 12 | 10 | 禁区侵蚀 | target-completed |
| route-13-fighter-opportunist | fighter / opportunist | 复合弓 | 0 | 布料、玻璃、绳子、木材 | 38 | 5 | 6 | 1 | — | 战斗 | weapon-not-converted |
| route-14-engineer-opportunist | engineer / opportunist | 绝缘电击棒 | 0 | 布料、玻璃 | — | — | — | 8 | — | 战斗 | weapon-not-converted |
| route-15-medic-opportunist | medic / opportunist | 复合弓 | 0 | 玻璃 | — | 16 | 17 | 1 | — | 禁区侵蚀 | weapon-not-converted |
| route-16-scout-random | scout / random | 复合弓 | 0 | 布料、铁块、绳子、废金属、石头、木材 | 27 | 7 | 8 | 9 | — | — | equipped-before-encounter |
| route-17-fighter-random | fighter / random | 复合弓 | 0 | 酒精、布料、玻璃、绳子、废金属、石头、木材 | 20 | 20 | 22 | 6 | 21 | 禁区侵蚀 | target-completed |
| route-18-engineer-random | engineer / random | 绝缘铁管 | 0 | 布料、铁块、绳子、废金属、石头、木材 | 31 | 26 | 13 | 8 | 27 | 禁区侵蚀 | target-completed |
| route-19-medic-random | medic / random | 复合弓 | 0 | 铁块 | — | 30 | 31 | 31 | — | 战斗 | equipped-before-encounter |

## 结论与下一步

本记录器用于回答“玩家式闭环能否被完整执行”，不是用来调胜率。只有在半自动路线和真人路线都显示某条固定路径在合理时间内稳定不可达时，才考虑最小的数据层供给调整。当前真人触控、首次上手理解、屏幕阅读器和长局取舍仍标记为 `HUMAN-PLAYTEST-NEEDED`。
