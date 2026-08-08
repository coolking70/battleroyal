/**
 * 依赖审计（Phase 3A Step 16）。
 *
 * 静态扫描 `src/` 的 import 语句，守住四条规则：
 *  R1. 分层方向：`ui/` 可依赖 `core/ data/ utils/`；`core/` 与 `data/` 不得依赖 `ui/`。
 *  R2. 红线隔离：`worldEvents.ts` 不得 import 实体写入模块（zoneLoot/vitals/inventory）。
 *  R3. 环依赖告警：同一目录内（core/ 或 data/）的 import 若形成环，输出告警（自动玩家/信息层已
 *      通过 statusIds/type-only import 断环）。
 *  R4. 单文件体量：`core/` 与 `data/` 下每个 .ts 源文件 ≤ 500 行（Phase 2 不变量 #15）。
 *
 * 判定：R1 / R2 / R4 任一违例 → exit 1；R3 只告警不判 FAIL（环可能经由 type-only 消除）。
 *
 * 用法：npm run audit:deps
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SRC = resolve(__dirname, '..', 'src');

interface Issue {
  file: string;
  rule: 'R1' | 'R2' | 'R4';
  detail: string;
}
interface CycleWarning {
  file: string;
  detail: string;
}

/** 解析 import 语句的目标模块（相对路径，去掉 './' 与扩展名） */
function importedTargets(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const targets: string[] = [];
  for (const line of src.split('\n')) {
    const m = line.match(/^\s*import\b.*?from\s+['"](.+?)['"]/);
    if (m && m[1]!.startsWith('.')) {
      targets.push(m[1]!);
    }
  }
  return targets;
}

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out = collectTsFiles(p, out);
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function lineCount(file: string): number {
  return readFileSync(file, 'utf8').split('\n').length;
}

function audit(): { issues: Issue[]; cycles: CycleWarning[]; summary: string[] } {
  const issues: Issue[] = [];
  const cycles: CycleWarning[] = [];
  const summary: string[] = [];

  const files = collectTsFiles(SRC);
  const rel = (p: string): string => relative(SRC, p);

  // R1：ui/ 之外不得依赖 ui/
  for (const f of files) {
    const r = rel(f);
    if (r.startsWith('ui/')) continue;
    for (const t of importedTargets(f)) {
      const target = normalizeTarget(f, t);
      if (target.startsWith('ui/')) {
        issues.push({
          file: r,
          rule: 'R1',
          detail: `非 ui 模块 ${r} import 了 ui/${target}`,
        });
      }
    }
  }

  // R2：worldEvents.ts 不得 import 实体写入模块
  const weFile = join(SRC, 'core', 'worldEvents.ts');
  if (exists(weFile)) {
    for (const t of importedTargets(weFile)) {
      const target = normalizeTarget(weFile, t);
      if (target === 'core/zoneLoot' || target === 'core/vitals' || target === 'core/inventory') {
        issues.push({
          file: 'core/worldEvents.ts',
          rule: 'R2',
          detail: `worldEvents.ts import 了被禁模块 ${target}`,
        });
      }
    }
  }

  // R3：core/ 与 data/ 内部的 import 环（简单 DFS，只报告环的参与文件）
  for (const dir of ['core', 'data']) {
    const dirFiles = files.filter((f) => rel(f).startsWith(`${dir}/`) && !rel(f).includes('/saveValidation/'));
    const edges = new Map<string, string[]>();
    for (const f of dirFiles) {
      const key = rel(f);
      const deps = importedTargets(f)
        .map((t) => normalizeTarget(f, t))
        .filter((t) => t.startsWith(`${dir}/`) && t !== key);
      edges.set(key, deps);
    }
    const visiting = new Set<string>();
    const done = new Set<string>();
    const stack: string[] = [];
    const visit = (k: string): void => {
      if (done.has(k) || visiting.has(k)) return;
      visiting.add(k);
      stack.push(k);
      for (const d of edges.get(k) ?? []) {
        if (visiting.has(d)) {
          // 找到环：输出参与文件
          const cycle = [...stack.slice(stack.indexOf(d)), d];
          cycles.push({ file: k, detail: `环：${cycle.join(' → ')}` });
        } else {
          visit(d);
        }
      }
      stack.pop();
      visiting.delete(k);
      done.add(k);
    };
    for (const k of edges.keys()) visit(k);
  }

  // R4：core/ 与 data/ 单文件 ≤ 500 行
  for (const f of files) {
    const r = rel(f);
    if (!r.startsWith('core/') && !r.startsWith('data/')) continue;
    if (r.includes('saveValidation/')) continue; // 校验分层允许更细文件
    const n = lineCount(f);
    if (n > 500) {
      issues.push({ file: r, rule: 'R4', detail: `${r} 共 ${n} 行（> 500）` });
    }
  }

  const maxLine = files
    .filter((f) => rel(f).startsWith('core/') || rel(f).startsWith('data/'))
    .map((f) => ({ file: rel(f), lines: lineCount(f) }))
    .sort((a, b) => b.lines - a.lines);
  summary.push(`扫描文件数：${files.length}`);
  summary.push(
    `core/data 最大文件：${maxLine[0]?.file ?? '-'}（${maxLine[0]?.lines ?? 0} 行）`,
  );
  summary.push(`R1 分层违例：${issues.filter((i) => i.rule === 'R1').length}`);
  summary.push(`R2 红线隔离违例：${issues.filter((i) => i.rule === 'R2').length}`);
  summary.push(`R3 环告警：${cycles.length}`);
  summary.push(`R4 超行告警：${issues.filter((i) => i.rule === 'R4').length}`);

  return { issues, cycles, summary };
}

function exists(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

/** 把相对 import 解析为相对 src/ 的路径（去扩展名） */
function normalizeTarget(fromFile: string, target: string): string {
  const fromDir = dirname(fromFile);
  const abs = resolve(fromDir, target);
  const r = relative(SRC, abs).replace(/\\/g, '/');
  return r.replace(/\.(ts|tsx|js|jsx)$/, '');
}

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('auditDependencies.ts') ||
    process.argv[1].endsWith('auditDependencies.js'));

if (isMain) {
  const { issues, cycles, summary } = audit();
  // eslint-disable-next-line no-console
  console.log('[audit:deps] 依赖审计');
  for (const s of summary) console.log(`  ${s}`);
  for (const i of issues) console.error(`[audit:deps] FAIL ${i.rule} ${i.file}：${i.detail}`);
  for (const c of cycles) console.warn(`[audit:deps] WARN R3 ${c.file}：${c.detail}`);
  const failed = issues.length > 0;
  if (failed) {
    // eslint-disable-next-line no-console
    console.error(`[audit:deps] 判定：FAIL（${issues.length} 项违例）`);
    process.exitCode = 1;
  } else {
    // eslint-disable-next-line no-console
    console.log('[audit:deps] 判定：PASS');
  }
}

export { audit };
