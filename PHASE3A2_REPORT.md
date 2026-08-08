# PHASE3A2_REPORT.md — Phase 3A-2 Pre-Phase4 Final Closure

版本 `0.3.2`。最终提交为 `9dbdc85c0fbef3ee66250860f836c0ac94abca28`，由基线 `bf6c73fe6bbd65dc84083c6cf9a2595805496315` 快进而来。

## Engine

3000 局正式模拟（`PHASE3A2`）：actualTotalGames=3000、timeout=0、deadlock/illegalState=0、hardLimitReached=0，可信率 100%。整体引擎 PASS。

## Architecture

最终 `npm run audit:deps`：扫描 54 个文件，最大 core/data 文件为 `core/types.ts` 496 行；R1=0、R2=0、R3=0、R4=0，exit 0。历史 `combat.ts` 515 行记录保留为历史；当前实际 398 行。

## Engineer NPC

3000 局统计：`field_craft` playerUses=404、npcUses=1、freeCraft=19。NPC 使用只发生在 ready、材料齐、容量合法且技能成本可支付时；下一次成功 CRAFT 免费并消费 charge。专项测试覆盖材料不足、冷却和 stamina<2。

## Scout

`reconInitiative` 现在只覆盖敌方紧接着的第一次 `runNpcTurn()`。首次动作若 attack 则转 guard/observe；首次动作若 heal/skill/rest/craft/search/move/flee，也在行动机会结束时清除。对应测试在 `tests/phase3a2Closure.test.ts`。

## Asset pipeline

- 启动真实执行 `loadAssetManifest()` → `fetch('/assets/manifest.json')`，成功后 render App。
- 404、网络失败、非法 JSON、错误版本/schema、危险路径均降级到 null，游戏继续启动。
- 角色、区域、物品、世界事件均通过 `getCharacterVisual` / `getZoneVisual` / `getItemVisual` / `getWorldEventVisual` 接入 UI。
- `VisualImage` 实际执行 official → development SVG → emoji/color 单向 fallback，不无限重试；本地 SVG 通过 Vite asset glob 进入 production build。

## Tests and simulation

- `npm test`：41 test files、546 tests，全绿。
- 3000 局角色胜率：scout 6.0%、fighter 4.8%、engineer 5.3%、medic 3.5%；max/min=1.73 < 2.5，无 0 胜率角色。
- quick=3.0%、heavy=17.6%、guard=7.2%，均过 2% 门槛。
- quick/normal/heavy 命中 Δpp：0.30 / 0.04 / 0.03，均 <5pp。
- 六世界事件触发次数：blackout 1463、rain 1439、emergency_broadcast 1438、medical_alert 1378、research_anomaly 1463、citywide_unrest 1482，均 ≥50。
- 16 局 scripted playthroughs：全部无卡死、无问题；报告不是人工试玩结论。

## CI

`.github/workflows/ci.yml` 使用 Node 20，包含 npm ci、typecheck、test、build、audit:save、audit:deps 与 100 局 `simulate --ci`；任一失败会阻断 workflow。远程 GitHub Actions 状态未由本 agent 独立读取，未伪造绿色状态。

## Supply chain

`npm audit --omit=dev`：0 vulnerabilities，exit 0。完整 `npm audit`：5 个已知 dev dependency 链漏洞（3 moderate、1 high、1 critical，Vite/esbuild/Vitest），exit 1；本阶段按要求不强制升级 Vite 8，详情与真实 stdout 在 `reports/phase3a2-command-results.txt`。

## Documentation and version

版本为 `0.3.2`，未改变存档总体结构；`PHASE3A1_REPORT.md` 已明确标为 historical；`HUMAN_PLAYTEST_CHECKLIST.md` 保持空白。Phase 3A-2 的完整修复说明见 `PHASE3A2_AUDIT_FIXES.md`。
