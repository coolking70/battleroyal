# Phase 4K Human Playtest Checklist

状态：`NEEDS-HUMAN-PLAYTEST`

目的：确认自动测试无法证明的真实视觉密度、文字可读性、节点点击舒适度和完整游戏操作流。每项请记录 PASS / FAIL，并附截图或复现 seed。

## Desktop

- [ ] 打开地图抽屉，12 个区域名称均可读。
- [ ] 节点/区域列表没有严重重叠或文字覆盖。
- [ ] 能够理解学校、医院、住宅区、工厂、森林、研究所与 6 个新区之间的邻接关系。
- [ ] 当前区域有明显高亮。
- [ ] 与当前区域相邻的目的地明显可移动；远端区域不会伪装成可点击目标。
- [ ] warning 状态有明显提示，且不与当前/可移动状态冲突。
- [ ] restricted 状态有明显提示，且不会被普通 safe 状态误认。
- [ ] 在地图、状态栏和事件区域之间切换时，12 区信息不造成布局抖动或遮挡主要操作。

## Mobile

- [ ] 使用窄屏打开地图抽屉，12 区仍可通过滚动访问。
- [ ] 每个新区节点/按钮都能点击，不需要极端缩放。
- [ ] 没有严重的名称截断、状态徽标覆盖或横向溢出导致不可操作。
- [ ] 当前、相邻、远端、warning、restricted 的视觉差异仍然明显。
- [ ] 打开和关闭地图抽屉后，主要 MOVE / SEARCH / CRAFT 操作仍可访问。

## Gameplay walkthrough

建议使用固定 seed `PHASE4K-HUMAN-01`，或记录实际 seed。

1. 从当前区域移动到至少 3 个新区，至少包含 `commercial`、`station`、`underground` 中的两个。
2. 在每个访问过的新区执行 `MOVE` 后确认当前区域更新，再执行 `SEARCH`。
3. 当搜索得到物品时执行 `PICKUP`；背包满时确认替换 / 地面掉落交互仍可继续。
4. 设置或等待一个 melee、ranged、armor、healing 目标，确认 Craft Guide 推荐的区域真实存在，并沿推荐路线移动。
5. 继续推进时间，观察一个新区从 safe → warning → restricted 的状态变化；确认玩家在禁区中仍有合法移动/操作，不出现软锁。
6. 在玩家位于新区时保存并重新加载，确认当前区域、背包、装备、stats、NPC 状态和禁区状态保持，再执行一次合法 MOVE 或 SEARCH。
7. 确认地图没有显示远端 NPC 精确位置、NPC 背包/装备、隐藏事件或未公开地面掉落。

## Sign-off

- Tester:
- Date:
- Desktop result:
- Mobile result:
- Gameplay result:
- Failed items / screenshots / seeds:
