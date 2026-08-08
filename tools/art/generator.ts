import fs from 'node:fs/promises';
import path from 'node:path';
import { generateImage } from './apiClient';
import { findCacheEntry, contentHash, extensionForMime, saveCache } from './cache';
import { buildPrompt } from './promptBuilder';
import { validateImageBytes } from './validator';
import type { ArtConfig, ArtTask, CandidateMetadata, GenerationError, ImageGenerationResult } from './types';
import { ArtPipelineError } from './types';

export interface GenerationReport {
  mode: 'dry-run' | 'provider';
  provider: 'agnes';
  requested: number;
  cacheHits: number;
  apiCalls: number;
  successful: number;
  failed: number;
  retryCount: number;
  totalBytes: number;
  tasks: Array<{ taskId: string; hash: string; source: 'api' | 'cache' | 'dry-run'; status: string; errors?: string[] }>;
}

function categoryDirectory(task: ArtTask): string {
  return task.category === 'world_event' ? 'world-events' : `${task.category}s`;
}

function extensionForResult(mimeType: string): string {
  return extensionForMime(mimeType);
}

export function publicAssetPath(task: ArtTask, mimeType: string): string {
  return `/assets/${categoryDirectory(task)}/${task.entityId}/${task.variant}.${extensionForResult(mimeType)}`;
}

function candidateDirectory(config: ArtConfig, task: ArtTask, hash: string): string {
  return path.join(config.candidateDir, categoryDirectory(task), task.entityId, task.variant, hash);
}

async function retryableError(error: unknown): Promise<GenerationError> {
  if (error instanceof ArtPipelineError) return error.details;
  return { category: 'provider', retryable: false, message: error instanceof Error ? error.message : 'unknown generation error' };
}

async function generateWithRetry(
  config: ArtConfig,
  built: Awaited<ReturnType<typeof buildPrompt>>,
  report: GenerationReport,
  delaysMs: number[],
): Promise<ImageGenerationResult> {
  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    try {
      report.apiCalls += 1;
      return await generateImage(config, {
        model: built.model,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        width: built.width,
        height: built.height,
        requestedRatio: built.requestedRatio,
      });
    } catch (error) {
      const details = await retryableError(error);
      const hasNextAttempt = attempt < delaysMs.length && details.retryable;
      if (!hasNextAttempt) throw new ArtPipelineError(details);
      report.retryCount += 1;
      const delay = delaysMs[attempt] ?? 0;
      if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('unreachable retry state');
}

async function writeCandidate(
  config: ArtConfig,
  task: ArtTask,
  built: Awaited<ReturnType<typeof buildPrompt>>,
  contentHashValue: string,
  candidateHash: string,
  result: ImageGenerationResult,
  source: 'api' | 'cache',
): Promise<CandidateMetadata> {
  const validation = validateImageBytes(result.bytes, task);
  const dir = candidateDirectory(config, task, candidateHash);
  await fs.mkdir(dir, { recursive: true });
  const imageName = `${candidateHash}.${extensionForResult(result.mimeType)}`;
  const imagePath = path.join(dir, imageName);
  await fs.writeFile(imagePath, result.bytes);
  const metadata: CandidateMetadata = {
    taskId: task.id,
    hash: candidateHash,
    contentHash: contentHashValue,
    promptHash: contentHashValue,
    provider: 'agnes',
    model: built.model,
    generatedAt: new Date().toISOString(),
    requestedWidth: built.width,
    requestedHeight: built.height,
    requestedRatio: built.requestedRatio,
    actualWidth: validation.actualWidth ?? 0,
    actualHeight: validation.actualHeight ?? 0,
    prompt: built.prompt,
    negativePrompt: built.negativePrompt,
    styleProfileVersion: built.styleProfileVersion,
    mimeType: result.mimeType,
    actualMimeType: validation.mimeType ?? result.mimeType,
    bytes: result.bytes.byteLength,
    imagePath: path.relative(config.rootDir, imagePath),
    publicPath: publicAssetPath(task, result.mimeType),
    validationStatus: validation.status,
    validationErrors: validation.errors,
    reviewStatus: 'pending',
    providerRequestId: result.providerRequestId,
    revisedPrompt: result.revisedPrompt,
    source,
  };
  await fs.writeFile(path.join(dir, `${candidateHash}.json`), JSON.stringify(metadata, null, 2));
  return metadata;
}

async function candidateHashFor(config: ArtConfig, task: ArtTask, hash: string): Promise<string> {
  let candidateHash = hash;
  let suffix = 0;
  while (true) {
    try {
      await fs.access(candidateDirectory(config, task, candidateHash));
      suffix += 1;
      candidateHash = `${hash}-${Date.now()}${suffix > 1 ? `-${suffix}` : ''}`;
    } catch {
      return candidateHash;
    }
  }
}

export async function generateTask(
  config: ArtConfig,
  task: ArtTask,
  options: { force?: boolean; dryRun?: boolean; retryDelaysMs?: number[] } = {},
  report: GenerationReport = emptyReport(),
): Promise<CandidateMetadata | null> {
  const built = await buildPrompt(config.rootDir, task, config.model);
  const hash = contentHash(built);
  const cache = await findCacheEntry(config, hash, built);
  const cacheHit = !options.force && cache !== null;
  if (options.dryRun) {
    report.requested += 1;
    report.tasks.push({ taskId: task.id, hash, source: 'dry-run', status: cacheHit ? 'CACHE HIT' : 'API REQUIRED' });
    return null;
  }

  let result: ImageGenerationResult;
  let source: 'api' | 'cache';
  if (cacheHit && cache) {
    result = { mimeType: cache.mimeType, bytes: await fs.readFile(cache.imagePath) };
    source = 'cache';
    report.cacheHits += 1;
  } else {
    result = await generateWithRetry(config, built, report, options.retryDelaysMs ?? [2000, 5000, 12000]);
    source = 'api';
    await saveCache(config, hash, built, result);
  }
  const actualMimeType = validateImageBytes(result.bytes, task).mimeType;
  if (actualMimeType && actualMimeType !== result.mimeType) result = { ...result, mimeType: actualMimeType };
  const candidateHash = await candidateHashFor(config, task, hash);
  const metadata = await writeCandidate(config, task, built, hash, candidateHash, result, source);
  report.requested += 1;
  report.totalBytes += result.bytes.byteLength;
  if (metadata.validationStatus === 'passed') report.successful += 1;
  else report.failed += 1;
  report.tasks.push({ taskId: task.id, hash, source, status: metadata.validationStatus, errors: metadata.validationErrors });
  return metadata;
}

export async function writePromptReport(
  rootDir: string,
  built: Awaited<ReturnType<typeof buildPrompt>>,
  hash: string,
): Promise<void> {
  const roundB1Tasks = new Set([
    'character/fighter/portrait',
    'character/engineer/portrait',
    'character/medic/portrait',
    'zone/hospital/background',
    'item/medkit/icon',
    'world_event/rain/illustration',
  ]);
  const b2TaskIds = new Set([
    'zone/residential/background',
    'zone/factory/background',
    'zone/forest/background',
    'zone/lab/background',
    'item/water/icon',
    'item/energy_drink/icon',
  ]);
  const targetedVersion = b2TaskIds.has(built.task.id)
    ? 'phase4a23-b2'
    : built.task.id === 'world_event/rain/illustration' && built.task.revision >= 3
      ? 'phase4a23-rain-recovery'
      : built.task.promptStrategy === 'environment-positive-only' || built.task.promptStrategy === 'item-positive-only-unmarked' || built.task.promptStrategy === 'item-positive-only'
    ? 'phase4a22-positive-only'
    : built.task.id === 'world_event/blackout/illustration' && built.task.revision >= 4
    ? 'phase4-targeted-v5'
    : built.task.promptStrategy === 'character-positive-only'
      ? 'phase4a21-character-positive-only'
    : roundB1Tasks.has(built.task.id)
      ? 'phase4-round-b1'
      : built.task.revision >= 3 && (built.task.id === 'character/scout/portrait' || built.task.id === 'world_event/blackout/illustration')
        ? 'phase4-targeted-v4'
        : built.task.revision >= 2 && (built.task.id === 'character/scout/portrait' || built.task.id === 'world_event/blackout/illustration')
          ? 'phase4-targeted-v3'
          : built.styleProfileVersion.startsWith('phase4-style-v2-') ? 'phase4-style-v2' : 'legacy';
  const versionDir = targetedVersion;
  const dir = path.join(rootDir, 'reports', 'phase4-prompts', versionDir);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${built.task.id.replaceAll('/', '__')}.md`;
  await fs.writeFile(
    path.join(dir, filename),
    `# ${built.task.id}\n\n- Hash: \`${hash}\`\n- Model: \`${built.model}\`\n- Requested size: ${built.width}x${built.height}\n- Requested ratio: ${built.requestedRatio}\n- Revision: ${built.task.revision}\n- Style profile version: \`${built.styleProfileVersion}\`\n\n## Prompt\n\n${built.prompt}\n\n## Negative prompt\n\n${built.negativePrompt || '(empty: positive-only strategy)'}\n`,
  );
}

export function emptyReport(): GenerationReport {
  return { mode: 'provider', provider: 'agnes', requested: 0, cacheHits: 0, apiCalls: 0, successful: 0, failed: 0, retryCount: 0, totalBytes: 0, tasks: [] };
}
