import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createArtConfig, hasUsableApiConfig } from './config';
import { contentHash } from './cache';
import { generateTask, emptyReport, writePromptReport } from './generator';
import { buildPrompt } from './promptBuilder';
import { publishApproved, validatePublishedManifest } from './publisher';
import { listCandidates, reviewCandidate } from './reviewer';
import { loadTasks, selectTasks, taskForId } from './taskPlanner';
import { auditCharacterProviderPrompt, auditCombatProviderPrompt, auditEnvironmentProviderPrompt, auditEventProviderPrompt, auditItemProviderPrompt, auditRainProviderPrompt } from './promptAudit';
import { agnesRequestFor } from './providers/agnes';
import { runEventE1Batch } from './eventBatch';
import { runInjuredBatch } from './injuredBatch';
import { runScoutCombatCanary } from './combatCanary';
import { runCombatBatch } from './combatBatch';
import { runPhase4A45Audit } from './phase4a45Audit';
import type { ArtConfig, ArtTask } from './types';

interface Args {
  command: string;
  taskId?: string;
  category?: string;
  status?: string;
  candidate?: string;
  reason?: string;
  reportName?: string;
  concurrency?: number;
  debugRequest: boolean;
  force: boolean;
  dryRun: boolean;
  offline: boolean;
}

export function parseArgs(argv: string[]): Args {
  const [command = 'help', ...rest] = argv;
  const args: Args = { command, force: false, dryRun: false, offline: false, debugRequest: false };
  for (let i = 0; i < rest.length; i += 1) {
    const value = rest[i];
    if (value === '--force') args.force = true;
    else if (value === '--dry-run') args.dryRun = true;
    else if (value === '--offline') args.offline = true;
    else if (value === '--debug-request') args.debugRequest = true;
    else if (value === '--task') args.taskId = rest[++i];
    else if (value === '--category') args.category = rest[++i];
    else if (value === '--status') args.status = rest[++i];
    else if (value === '--candidate') args.candidate = rest[++i];
    else if (value === '--reason') args.reason = rest[++i];
    else if (value === '--report-name') args.reportName = rest[++i];
    else if (value === '--concurrency') args.concurrency = Number(rest[++i]);
  }
  return args;
}

function printHelp(): void {
  console.log(`art pipeline commands:
  art:doctor [--offline]
  art:prompt --task character/scout/portrait
  art:prompt-audit --task character/engineer/portrait
  art:generate [--task ...|--category characters|--status missing] [--dry-run] [--force] [--concurrency 1|2] [--report-name name]
  art:event-e1 [--report-name name] (exactly four world events, sequential, no rerolls)
  art:injured-batch [--report-name name] (Fighter, Engineer, Medic once each, sequential, no rerolls)
  art:combat-batch [--report-name name] (Fighter, Engineer, Medic once each, sequential, no rerolls)
  Scout Combat canary: art:generate --task character/scout/combat --concurrency 1 (one call, no rerolls)
  art:list
  art:approve --task ... --candidate <contentHash>
  art:reject --task ... --candidate <contentHash> --reason "..."
  art:publish
  art:validate
  art:api-check
  art:smoke
  art:review-export --round A|--report <round-report.json> [--output <dir>] [--suffix <text>]
  art:audit:phase4a (read-only Phase 4A base-art closure audit; no API calls)
  art:security:browser
  art:security:repo`);
}

async function doctor(config: ArtConfig, offline: boolean): Promise<number> {
  const checks: Array<[string, boolean, string]> = [];
  try {
    const tasks = await loadTasks(config.rootDir);
    checks.push(['task definitions', tasks.length === 36 && tasks.length <= 40, `${tasks.length} tasks`]);
  } catch (error) {
    checks.push(['task definitions', false, errorMessage(error)]);
  }
  for (const relative of [
    'art/style/master-style.md',
    'art/style/render-style.md',
    'art/style/character-style.md',
    'art/style/zone-style.md',
    'art/style/item-style.md',
    'art/style/event-style.md',
    'art/style/negative-prompt.txt',
    'public/assets/manifest.json',
    'art/approved-assets.json',
  ]) {
    try {
      await fs.access(path.join(config.rootDir, relative));
      checks.push([relative, true, 'present']);
    } catch {
      checks.push([relative, false, 'missing']);
    }
  }
  try {
    await fs.mkdir(config.candidateDir, { recursive: true });
    checks.push(['candidate directory', true, config.candidateDir]);
  } catch {
    checks.push(['candidate directory', false, 'not writable']);
  }
  try {
    await fs.mkdir(config.cacheDir, { recursive: true });
    checks.push(['cache directory', true, config.cacheDir]);
  } catch {
    checks.push(['cache directory', false, 'not writable']);
  }
  checks.push(['API configuration', true, offline ? 'offline check' : hasUsableApiConfig(config) ? 'configured' : 'WARN: IMAGE_API_KEY is not set']);
  for (const [name, pass, detail] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
  return checks.some(([, pass]) => !pass) ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function promptCommand(config: ArtConfig, task: ArtTask): Promise<void> {
  const built = await buildPrompt(config.rootDir, task, config.model);
  const hash = contentHash(built);
  await writePromptReport(config.rootDir, built, hash);
  console.log(`Task: ${task.id}\nModel: ${built.model}\nSize: ${built.width}x${built.height}\nRevision: ${task.revision}\nHash: ${hash}\n\nPrompt:\n${built.prompt}\n\nNegative prompt:\n${built.negativePrompt}`);
}

async function promptAuditCommand(config: ArtConfig, task: ArtTask): Promise<number> {
  const built = await buildPrompt(config.rootDir, task, config.model);
  const payload = agnesRequestFor({ model: built.model, prompt: built.prompt, negativePrompt: built.negativePrompt, width: built.width, height: built.height, requestedRatio: built.requestedRatio });
  const audit = task.id === 'world_event/rain/illustration'
    ? auditRainProviderPrompt(task, payload.prompt)
    : task.promptStrategy === 'event-positive-only'
      ? auditEventProviderPrompt(task, payload.prompt)
    : task.promptStrategy === 'character-combat-positive-only'
      ? auditCombatProviderPrompt(task, payload.prompt)
    : task.promptStrategy === 'character-positive-only'
      ? auditCharacterProviderPrompt(task, payload.prompt)
    : task.promptStrategy === 'environment-positive-only'
      ? auditEnvironmentProviderPrompt(task, payload.prompt)
      : task.promptStrategy === 'item-positive-only-unmarked' || task.promptStrategy === 'item-positive-only'
        ? auditItemProviderPrompt(task, payload.prompt)
        : auditCharacterProviderPrompt(task, payload.prompt);
  console.log(JSON.stringify({ taskId: task.id, ...audit }, null, 2));
  return audit.passed ? 0 : 1;
}

async function generateCommand(config: ArtConfig, args: Args): Promise<number> {
  const concurrency = args.concurrency ?? 1;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2) throw new Error('--concurrency must be an integer from 1 to 2');
  if (args.debugRequest) process.env.IMAGE_API_DEBUG_REQUEST = '1';
  const allTasks = await loadTasks(config.rootDir);
  if (args.taskId === 'character/scout/combat') {
    if (concurrency !== 1) throw new Error('Scout Combat canary requires --concurrency 1');
    if (args.dryRun) throw new Error('Scout Combat canary dry-run is not a production generation');
    const result = await runScoutCombatCanary(config, allTasks, { reportName: args.reportName, force: args.force });
    console.log(JSON.stringify(result.report, null, 2));
    return result.exitCode;
  }
  let tasks = selectTasks(allTasks, args);
  if (args.status === 'missing') {
    const candidates = await listCandidates(config);
    const existing = new Set(candidates.map((candidate) => candidate.taskId));
    tasks = tasks.filter((task) => !existing.has(task.id));
  }
  if (tasks.length === 0) throw new Error('no matching art tasks');
  const report = emptyReport();
  report.mode = args.dryRun ? 'dry-run' : 'provider';
  const runTask = async (task: ArtTask): Promise<void> => {
    const built = await buildPrompt(config.rootDir, task, config.model);
    await writePromptReport(config.rootDir, built, contentHash(built));
    try {
      await generateTask(config, task, { force: args.force, dryRun: args.dryRun }, report);
    } catch (error) {
      report.requested += 1;
      report.failed += 1;
      report.tasks.push({ taskId: task.id, hash: contentHash(built), source: 'api', status: 'failed', errors: [errorMessage(error)] });
      console.error(`FAIL ${task.id}: ${errorMessage(error)}`);
    }
  };
  const queue = [...tasks];
  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (task) await runTask(task);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  await fs.mkdir(path.join(config.rootDir, 'reports'), { recursive: true });
  const defaultReportName = args.dryRun ? 'phase4-dry-run-report' : 'phase4-provider-attempt-report';
  const reportName = sanitizeReportName(args.reportName ?? defaultReportName);
  await fs.writeFile(path.join(config.rootDir, 'reports', `${reportName}.json`), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  return report.failed > 0 && !args.dryRun ? 1 : 0;
}

async function listCommand(config: ArtConfig): Promise<void> {
  const tasks = await loadTasks(config.rootDir);
  const candidates = await listCandidates(config);
  for (const task of tasks) {
    const own = candidates.filter((candidate) => candidate.taskId === task.id);
    const status = own.length === 0 ? 'planned' : own.map((candidate) => `${candidate.hash.slice(0, 12)}:${candidate.reviewStatus}/${candidate.validationStatus}`).join(', ');
    console.log(`${task.id}\t${status}`);
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const config = createArtConfig();
  switch (args.command) {
    case 'doctor': return doctor(config, args.offline);
    case 'prompt': {
      if (!args.taskId) throw new Error('--task is required');
      await promptCommand(config, taskForId(await loadTasks(config.rootDir), args.taskId));
      return 0;
    }
    case 'prompt-audit': {
      if (!args.taskId) throw new Error('--task is required');
      return promptAuditCommand(config, taskForId(await loadTasks(config.rootDir), args.taskId));
    }
    case 'generate': return generateCommand(config, args);
    case 'event-e1': {
      if (args.concurrency !== undefined && args.concurrency !== 1) throw new Error('event-e1 requires --concurrency 1');
      const result = await runEventE1Batch(config, await loadTasks(config.rootDir), { reportName: args.reportName, force: args.force });
      console.log(JSON.stringify(result.report, null, 2));
      return result.exitCode;
    }
    case 'injured-batch': {
      if (args.concurrency !== undefined && args.concurrency !== 1) throw new Error('injured-batch requires --concurrency 1');
      const result = await runInjuredBatch(config, await loadTasks(config.rootDir), { reportName: args.reportName, force: args.force });
      console.log(JSON.stringify(result.report, null, 2));
      return result.exitCode;
    }
    case 'combat-batch': {
      if (args.concurrency !== undefined && args.concurrency !== 1) throw new Error('combat-batch requires --concurrency 1');
      if (args.dryRun) throw new Error('combat-batch dry-run is not a production generation');
      const result = await runCombatBatch(config, await loadTasks(config.rootDir), { reportName: args.reportName, force: args.force });
      console.log(JSON.stringify(result.report, null, 2));
      return result.exitCode;
    }
    case 'audit:phase4a': {
      const result = await runPhase4A45Audit(config);
      console.log(JSON.stringify({ phase: result.phase, passed: result.passed, manifest: result.manifestCoverage.passed, provenance: result.provenance.passed, candidateHygiene: result.candidateHygiene.passed, runtimeUsage: result.runtimeUsage.passed }, null, 2));
      return result.passed ? 0 : 1;
    }
    case 'list': await listCommand(config); return 0;
    case 'approve': {
      if (!args.taskId || !args.candidate) throw new Error('--task and --candidate are required');
      await reviewCandidate(config, args.taskId, args.candidate, 'approved');
      console.log(`APPROVED ${args.taskId} ${args.candidate}`);
      return 0;
    }
    case 'reject': {
      if (!args.taskId || !args.candidate) throw new Error('--task and --candidate are required');
      await reviewCandidate(config, args.taskId, args.candidate, 'rejected', args.reason);
      console.log(`REJECTED ${args.taskId} ${args.candidate}`);
      return 0;
    }
    case 'publish': {
      const result = await publishApproved(config);
      console.log(result.changed ? `PUBLISHED ${result.published.length} approved candidates; manifest ${result.manifestHash}` : 'NO CHANGES: no new approved assets to publish');
      return 0;
    }
    case 'validate': {
      const errors = await validatePublishedManifest(config);
      if (errors.length > 0) {
        errors.forEach((error) => console.error(`FAIL ${error}`));
        return 1;
      }
      console.log('PASS published manifest');
      return 0;
    }
    case 'api-check':
      console.log(`API base URL: ${config.baseUrl}`);
      console.log(`Model: ${config.model}`);
      console.log(`API key: ${config.apiKey ? 'configured (value hidden)' : 'missing'}`);
      return config.apiKey && /^https?:\/\/[^/]+\/v1\/images\/generations$/.test(config.baseUrl) && config.model === 'agnes-image-2.1-flash' ? 0 : 1;
    case 'smoke':
      return generateCommand(config, { ...args, command: 'generate', taskId: 'character/scout/portrait', reportName: args.reportName ?? 'phase4-provider-attempt-report', concurrency: 1 });
    default: printHelp(); return 0;
  }
}

export function sanitizeReportName(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!safe) throw new Error('report name must contain letters, numbers, _ or -');
  return safe;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error: unknown) => {
    console.error(`FAIL ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}
