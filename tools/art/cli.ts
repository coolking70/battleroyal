import fs from 'node:fs/promises';
import path from 'node:path';
import { createArtConfig, hasUsableApiConfig } from './config';
import { contentHash } from './cache';
import { generateTask, emptyReport, writePromptReport } from './generator';
import { buildPrompt } from './promptBuilder';
import { publishApproved, validatePublishedManifest } from './publisher';
import { listCandidates, reviewCandidate } from './reviewer';
import { loadTasks, selectTasks, taskForId } from './taskPlanner';
import type { ArtConfig, ArtTask } from './types';

interface Args {
  command: string;
  taskId?: string;
  category?: string;
  status?: string;
  candidate?: string;
  reason?: string;
  force: boolean;
  dryRun: boolean;
  offline: boolean;
}

function parseArgs(argv: string[]): Args {
  const [command = 'help', ...rest] = argv;
  const args: Args = { command, force: false, dryRun: false, offline: false };
  for (let i = 0; i < rest.length; i += 1) {
    const value = rest[i];
    if (value === '--force') args.force = true;
    else if (value === '--dry-run') args.dryRun = true;
    else if (value === '--offline') args.offline = true;
    else if (value === '--task') args.taskId = rest[++i];
    else if (value === '--category') args.category = rest[++i];
    else if (value === '--status') args.status = rest[++i];
    else if (value === '--candidate') args.candidate = rest[++i];
    else if (value === '--reason') args.reason = rest[++i];
  }
  return args;
}

function printHelp(): void {
  console.log(`art pipeline commands:
  art:doctor [--offline]
  art:prompt --task character/scout/portrait
  art:generate [--task ...|--category characters|--status missing] [--dry-run] [--force]
  art:list
  art:approve --task ... --candidate <contentHash>
  art:reject --task ... --candidate <contentHash> --reason "..."
  art:publish
  art:validate
  art:api-check
  art:smoke`);
}

async function doctor(config: ArtConfig, offline: boolean): Promise<number> {
  const checks: Array<[string, boolean, string]> = [];
  try {
    const tasks = await loadTasks(config.rootDir);
    checks.push(['task definitions', tasks.length === 32 && tasks.length <= 40, `${tasks.length} tasks`]);
  } catch (error) {
    checks.push(['task definitions', false, errorMessage(error)]);
  }
  for (const relative of [
    'art/style/master-style.md',
    'art/style/character-style.md',
    'art/style/zone-style.md',
    'art/style/item-style.md',
    'art/style/event-style.md',
    'art/style/negative-prompt.txt',
    'public/assets/manifest.json',
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

async function generateCommand(config: ArtConfig, args: Args): Promise<number> {
  const allTasks = await loadTasks(config.rootDir);
  let tasks = selectTasks(allTasks, args);
  if (args.status === 'missing') {
    const candidates = await listCandidates(config);
    const existing = new Set(candidates.map((candidate) => candidate.taskId));
    tasks = tasks.filter((task) => !existing.has(task.id));
  }
  if (tasks.length === 0) throw new Error('no matching art tasks');
  const report = emptyReport();
  for (const task of tasks) {
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
  }
  await fs.mkdir(path.join(config.rootDir, 'reports'), { recursive: true });
  await fs.writeFile(path.join(config.rootDir, 'reports', 'phase4-generation-report.json'), `${JSON.stringify(report, null, 2)}\n`);
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
    case 'generate': return generateCommand(config, args);
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
      console.log(`PUBLISHED ${result.published.length} approved candidates; manifest ${result.manifestHash}`);
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
      return config.apiKey && /^https?:\/\//.test(config.baseUrl) ? 0 : 1;
    case 'smoke':
      return generateCommand(config, { ...args, command: 'generate', taskId: 'character/scout/portrait' });
    default: printHelp(); return 0;
  }
}

main().then((code) => {
  process.exitCode = code;
}).catch((error: unknown) => {
  console.error(`FAIL ${errorMessage(error)}`);
  process.exitCode = 1;
});
