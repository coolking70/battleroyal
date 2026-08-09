# Phase 4C-10 报告：开发依赖安全维护

## 结论

PASS。此次收尾只处理开发工具链的已知漏洞与 Vite 8/Vitest 4 兼容性，未改变游戏规则、经济、存档格式或正式美术资产。应用版本保持 `0.3.2`。

## 修复内容

升级开发依赖：

| 依赖 | 升级前 | 升级后 |
| --- | --- | --- |
| `vite` | 5.4.21 | 8.2.1 |
| `vitest` | 2.1.9 | 4.1.10 |
| `@vitejs/plugin-react` | 4.7.x | 6.0.5 |

升级前全量 `npm audit` 有 5 个开发依赖漏洞（含 Vitest critical、Vite high 及其传递依赖 moderate）；生产依赖审计原本已为 0。升级后重新生成 lockfile，当前全量与 `npm audit --omit=dev` 均为 0 vulnerabilities。

Vite 8 不再通过 Vitest 间接提供 Node 类型，因此 `tsconfig.app.json` 显式加入 `node` 类型。Vite 8 对小型 SVG fallback 可能返回内联 data URL，`VisualImage` 测试改为同时验证本地 SVG 路径或本地 SVG data URL，并使用异步 `act` 等待状态切换；没有放宽三级 fallback 的语义断言。

## 验证结果

| 门禁 | 结果 |
| --- | --- |
| 干净 `npm ci` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS，70 files / 1294 tests |
| `npm run build` | PASS，Vite 8.2.1 |
| `npm run audit:save` | PASS，74/74 损坏存档正确拒绝 |
| `npm run audit:deps` | PASS |
| `art:doctor -- --offline` / `art:validate` | PASS |
| `art:audit:phase4a` | PASS，manifest/provenance/candidate/runtime 全通过 |
| `art:security:browser` / `repo` | PASS |
| 500 局引擎健康回归 | PASS，requested=actual=500，timeout/deadlock/illegal/hard-limit 全为 0 |
| `npm audit` | PASS，0 vulnerabilities |
| `npm audit --omit=dev` | PASS，0 vulnerabilities |

模拟报告：[`reports/phase4c10-balance.json`](reports/phase4c10-balance.json) / [`reports/phase4c10-balance.md`](reports/phase4c10-balance.md)。胜率、存活率和角色差异仅作观察，不作为本阶段安全维护判定。

## 运行时证据

在 `npm run build` + `npm run preview` 的生产构建上完成：

- 既有 Phase 4C-9 信息边界证据重跑通过：1/1；远处地面掉落未显示，当前区域掉落仍可见，横向宽度保持 1280，console/page errors 均为 0。证据目录：`output/phase4c9-browser/`。
- Web Game Playwright 生产预览 smoke 通过；1280×720 菜单渲染正常，页面错误为空。截图与状态快照位于 `output/web-game/`（该目录为本地忽略目录）。
- Node/测试工具输出的既有 React `act(...)` warning 不构成浏览器 console error，未影响测试通过。

## Scope 与资产声明

- 未修改 `src/core/**`、`src/data/**`、战斗/掉落/合成/事件规则、RNG 或 Save schema。
- 未调用图像生成 API；未修改 `public/assets/**/*.png`、`art/approved-assets.json` 或候选状态。
- 未修改 `GAME_VERSION` / package 应用版本，仍为 `0.3.2`。
- `reports/save-validation-audit.json` 与 `.md` 是工作区原有用户改动，未纳入本阶段提交。

## 后续方向

开发依赖安全阻断已清除。下一步应先完成真实设备/辅助技术/长时游玩验收（`HUMAN_PLAYTEST_CHECKLIST.md` 保持由人工填写），再根据真实体验决定是否进入新的经济或路线迭代；不能用当前自动模拟的胜率观察替代人工验收。
