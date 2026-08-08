# SUPPLY_CHAIN_AUDIT.md — npm 供应链审计报告（Phase 3A-1 Step 11）

> 版本 0.3.1 · 审计日期 2026-08-08 · 与 `ARCHITECTURE_AUDIT.md`（代码架构）刻意区分。

## 1. 审计命令与真实输出

### 1.1 生产依赖（runtime）

```bash
npm audit --omit=dev
# found 0 vulnerabilities   （exit 0）
```

**生产依赖漏洞数量：0（high 0 / critical 0）**

符合 §Runtime 规则：生产依赖无 high / critical → **PASS**。

### 1.2 完整依赖（含 devDependencies）

```bash
npm audit
# 5 vulnerabilities (3 moderate, 1 high, 1 critical)
```

**完整依赖漏洞：5（moderate 3 / high 1 / critical 1）**

## 2. 漏洞明细（全部位于 devDependencies）

| 包 | 版本（当前） | 受影响区间 | 严重度 | 路径 | 影响 |
| --- | --- | --- | --- | --- | --- |
| esbuild | 0.21.5（vite 内嵌） | ≤ 0.24.2 | critical | vite → esbuild | 恶意网站可向开发服务器发请求并读取响应（仅 dev server 场景） |
| vite | 5.4.21 | ≤ 6.4.2 | high | vite | 依赖受影响 esbuild |
| vite-node | 2.1.9（vitest 内嵌） | ≤ 2.2.0-beta.2 | moderate | vitest → vite-node | 依赖受影响 vite |
| @vitest/mocker | 2.1.9（vitest 内嵌） | ≤ 3.0.0-beta.4 | moderate | vitest → @vitest/mocker | 依赖受影响 vite |
| vitest | 2.1.9 | ≤ 3.2.5 | moderate | vitest | 依赖受影响 vite |

## 3. 处置与升级风险

- **为什么不用 `npm audit fix --force`**：官方唯一修复路径是升级 `vite@8.2.1`，
  属于**破坏性大版本变更**（Node 要求、插件 API、配置项均可能变化），
  `vite@5 → vite@8` 无法保证 `tests / build / simulate` 不受影响，故按规则**保留并记录**，
  不做未经验证的强制升级。
- `tsx@4.23.9` 自带的 `esbuild@0.28.1` 不在受影响区间（> 0.24.2），无需处理。

## 4. 影响评估

- 全部漏洞仅在 **devDependencies / 本地开发服务器** 场景生效；
  生产构建产物（`dist/`）与服务端均不涉及。
- 游戏本身是**纯前端静态站点**，无后端、无用户数据存储，
  该链路的实际攻击面为「开发者在本地跑 `npm run dev` 时访问恶意网站」，
  与交付产物（dist + 静态托管）无关。

## 5. 未来处理计划

| 项 | 计划 |
| --- | --- |
| 短期 | 保持 `npm audit --omit=dev` 为 0 的门槛（已纳入 CI 之外的发布前检查）；记录本报告 |
| 中期 | 在 Phase 4 或独立维护任务中，将 `vite` 升级至修复版（8.x）+ `vitest` 3.x，升级前依次验证 `npm run typecheck / test / build / simulate -- --games 100`，全部通过后才落地 |
| 长期 | 若官方在 5.x/6.x 线发布 backport 修复（非破坏），优先采用 |

## 6. 结论

- **Runtime（生产依赖）：PASS（0 漏洞）**
- **DevDependencies：存在 3 moderate / 1 high / 1 critical，全部记录在案，暂不强制修复（升级属破坏性变更）**
- 供应链审计真实执行，输出见上（非手写）。
