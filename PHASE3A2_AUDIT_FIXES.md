# PHASE3A2_AUDIT_FIXES.md

## BLOCKER-01 — combat file size

- 原问题：历史 Phase 3A-1 命令记录显示 `src/core/combat.ts` 515 行，`audit:deps` FAIL。
- 当前事实：本工作树基线 `combat.ts` 已为 398 行；最终 `npm run audit:deps` 真实输出 R4=0、exit 0。该 blocker 在当前基线已由前序拆分提交关闭，本轮没有再制造无意义 helper。
- 证据：`ARCHITECTURE_AUDIT.md`、`reports/phase3a2-command-results.txt`。

## BLOCKER-02 — Engineer NPC field_craft

- 原问题：低体力 REST 分支在生存技能判断前，导致 `field_craft` 死路径。
- 根因：NPC 在 `stamina < npcRestThreshold` 时直接 REST。
- 修改：`src/core/npcDecide.ts` 将合法生存技能机会置于低体力恢复之前；field_craft charge 存在且材料/容量合法时优先 CRAFT，即使体力为 0 也只免 CRAFT 成本，不赠送技能体力。
- 测试：`tests/phase3a2Closure.test.ts` 覆盖 ready、成功免费合成、材料不足、冷却、技能成本不足。
- 证据：3000 局 `field_craft` playerUses=404、npcUses=1、freeCraft=19。

## BLOCKER-03 — Scout reconInitiative lifetime

- 原问题：只有 NPC attack 分支清除 flag，heal/skill/rest 等动作可能让先手保护延迟多个时间单位。
- 修改：`src/core/npcAi.ts` 在 `runNpcTurn()` 开始捕获当前目标，在整个 NPC 行动机会结束后统一清除；若该机会原本要 attack，则只转为 guard/observe。
- 测试：`tests/phase3a2Closure.test.ts` 覆盖首次 attack、heal、skill 与后续 attack；`tests/skills.test.ts` 保留玩家主动攻击反击规则。
- 证据：3000 局 `scout_recon` playerUses=750、npcUses=3096；实现严格按一次 NPC 行动机会消费。

## BLOCKER-04 — runtime Manifest and visuals

- 原问题：`public/assets/manifest.json` 存在，但浏览器 bootstrap 没有 fetch；UI 没有统一的 image error fallback。
- 修改：新增 `src/ui/assetManifestLoader.ts`，bootstrap 先 fetch `/assets/manifest.json`；404、网络失败、坏 JSON、错误 schema、安全路径失败均返回 null 并继续启动。新增 `src/ui/components/VisualImage.tsx`，实现 official → SVG → emoji 单向三级 fallback。
- UI 入口：角色（MenuScreen/StatusBar）、区域（GameScreen/ZoneMap）、世界事件（GameScreen banner）、物品（Inventory）都经过 `get*Visual` + `VisualImage`；新增 public bandage 测试资产验证正式路径。
- 测试：`tests/assetManifestLoader.test.ts`、`tests/visualImage.test.tsx`。
- 浏览器证据：Vite dev server + Playwright 菜单/对局截图无 console error，菜单角色图、区域图标、区域头图均可见；`window.render_game_to_text()` 可读取 menu/playing 状态。

## EVIDENCE-01 — contradictory historical reports

- `PHASE3A1_REPORT.md` 顶部已标为 Historical，并指向本报告；旧 FAIL 日志未被改写。
- 当前真实证据集中在 `reports/phase3a2-command-results.txt` 与 `reports/phase3a2-final-balance.*`。

## EVIDENCE-02 — npm ci

- `npm ci` 已真实执行并在命令记录中包含 stdout 与 exit code。

## EVIDENCE-03 — CI

- `.github/workflows/ci.yml` 保持 Node 20、`npm ci`、typecheck、test、build、save audit、deps audit、100-game `--ci`，任一步失败都会阻断 workflow。
- 本 agent 未读取远程 GitHub Actions 状态；没有伪造 remote green 结论。

## DOC-01 — stale comments and docs

- 更新了 `src/core/npcSkillDecide.ts` / `src/core/skills.ts` 的 Scout 名称与不透视描述。
- 更新了 `VISUAL_ASSET_SPEC.md` 的真实 bootstrap、Manifest failure 与三级 fallback 行为。
- 模拟器报告模板已删除“不设胜率门槛”旧文案，改为引擎、角色平衡、玩法三项同时验收。
- `HUMAN_PLAYTEST_CHECKLIST.md` 保持空白；脚本化对局明确标为 scripted，不冒充人工试玩。
