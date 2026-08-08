# Phase 3A 命令执行记录（Command Results）

> 记录 Phase 3A 验收相关的关键命令与真实输出，作为交付证据。日期 2026-08-08。

## 1. Typecheck

```bash
npx tsc -p tsconfig.app.json --noEmit
# exit 0（无输出，全绿）
```

> 注：根 `tsconfig.json` 为 references 壳，真类型检查入口是 `tsconfig.app.json`。

## 2. 单元测试

```bash
npx vitest run
# Test Files  35 passed (35)
# Tests       491 passed (491)
```

## 3. 构建

```bash
npm run build
# ✓ built in ~700ms
# dist/assets/index-*.css  ~21.5 kB │ gzip ~5.0 kB
# dist/assets/index-*.js   ~291 kB │ gzip ~98 kB
```

## 4. 存档审计

```bash
npm run audit:save
# [audit:save] 对照 通过 | 损坏用例 74 个，拒绝 74 个，通过 74 个，构造失败 0 个
# [audit:save] 判定：PASS
```

## 5. 依赖审计

```bash
npm run audit:deps
# [audit:deps] 依赖审计
#   扫描文件数：51
#   core/data 最大文件：core/types.ts（486 行）
#   R1 分层违例：0
#   R2 红线隔离违例：0
#   R3 环告警：0
#   R4 超行告警：0
# [audit:deps] 判定：PASS
```

## 6. 1000 局中间模拟（Step 10 使用率门槛）

```bash
npx tsx tools/simulateBalance.ts --games 1000 --seed-prefix PHASE3A_S10 --output reports/phase3a-s10-balance.json
# 请求总局数 1000，实际 1000，胜率 4.1%，可信率 100.0%，
# 引擎判定 PASS，角色平衡 PASS，Phase 3A PASS → 整体判定 PASS
```

## 7. 3000 局正式模拟（最终验收）

```bash
npx tsx tools/simulateBalance.ts --games 3000 --seed-prefix PHASE3A_FINAL --output reports/phase3a-final-balance.json
# 请求总局数 3000，实际 3000，每格基准 150 局，cells=20，
# 胜率 5.3%，可信率 100.0%，引擎判定 PASS，角色平衡 PASS，Phase 3A PASS → 整体判定 PASS
```

关键指标：胜率比 **1.65**（< 2.5）；quick 3.14% / heavy 17.20% / guard 6.93%（≥ 2%）；EXPOSED 施加 19,212 / 兑现 13,124（兑现率 68.3%）；6 种世界事件各 1,421~1,540 次（≥ 50）。

## 8. 12 局脚本化对局

```bash
npm run scripted:playthroughs
# 已完成 12 局脚本化完整对局（角色：scout、fighter、engineer、medic）
# 全部：卡死=false 问题=0；报告写入 reports/phase3-scripted-playthroughs.md
# 世界事件类型覆盖：大停电 ✓ 连绵阴雨 ✓ 紧急广播 ✓ 医疗管制 ✓ 研究异常 ✓ 全城骚动 ✓
# 引擎层判定：12 局全部完整跑完，无卡死、无 livelock
```

## 9. 世界事件触发探针（Step 6 收尾，临时探针已清理）

```bash
npx tsx .tmp/probe_we.ts   # 120 局随机走子
# games: 120
# WORLD_EVENT by id: { blackout: 51, rain: 39, emergency_broadcast: 40,
#                      medical_alert: 42, research_anomaly: 45, citywide_unrest: 50 }
# total started: 267 / total ended: 206
```
