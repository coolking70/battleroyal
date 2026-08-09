import fs from 'node:fs/promises';
import path from 'node:path';
import { generationInputHash } from './hash';
import { generateTask, emptyReport, writePromptReport } from './generator';
import { buildPrompt } from './promptBuilder';
import { ArtPipelineError, type ArtConfig, type ArtTask } from './types';

export const INJURED_BATCH_TASK_IDS = [
  'character/fighter/injured',
  'character/engineer/injured',
  'character/medic/injured',
] as const;

export interface InjuredValidationReport {
  status: string;
  actualWidth: number | null;
  actualHeight: number | null;
  mimeType: string | null;
  errors: string[];
}

export interface InjuredTaskReport {
  taskId: string;
  basePortraitTask: string;
  basePortraitPublicPath: string;
  candidateHash: string | null;
  contentHash: string | null;
  apiCalls: number;
  cacheHits: number;
  validation: InjuredValidationReport;
  review: 'pending' | 'not_attempted';
  providerStatus: 'generated' | 'cache_hit' | 'provider_rejected' | 'failed' | 'skipped_after_stop';
  identityDescriptorVersion: number;
  hardVisualObservation: string;
}

export interface InjuredBatchReport {
  strategy: 'descriptor-locked-text-only';
  requested: number;
  attempted: number;
  generated: number;
  apiCalls: number;
  cacheHits: number;
  rainApiCalls: number;
  combatVariantCalls: number;
  stoppedEarly: boolean;
  stopReason: string | null;
  tasks: InjuredTaskReport[];
}

export function isInjuredContentRejection(error: unknown): boolean {
  const details = error instanceof ArtPipelineError ? error.details : null;
  return details?.category === 'provider'
    && details.retryable === false
    && /unable to generate|modify your prompt|content|safety|policy/i.test(details.message);
}

export function shouldStopInjuredBatch(consecutiveContentRejections: number): boolean {
  return consecutiveContentRejections >= 2;
}

function emptyValidation(): InjuredValidationReport {
  return { status: 'not_attempted', actualWidth: null, actualHeight: null, mimeType: null, errors: [] };
}

function basePortraitPublicPath(task: ArtTask): string {
  return `/assets/characters/${task.entityId}/portrait.png`;
}

function taskReport(task: ArtTask, basePortrait: ArtTask, values: Partial<InjuredTaskReport> = {}): InjuredTaskReport {
  return {
    taskId: task.id,
    basePortraitTask: basePortrait.id,
    basePortraitPublicPath: basePortraitPublicPath(basePortrait),
    candidateHash: null,
    contentHash: null,
    apiCalls: 0,
    cacheHits: 0,
    validation: emptyValidation(),
    review: 'not_attempted',
    providerStatus: 'skipped_after_stop',
    identityDescriptorVersion: task.revision,
    hardVisualObservation: '',
    ...values,
  };
}

function sanitizeReportName(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!safe) throw new Error('report name must contain letters, numbers, _ or -');
  return safe;
}

export async function runInjuredBatch(
  config: ArtConfig,
  tasks: readonly ArtTask[],
  options: { reportName?: string; force?: boolean } = {},
): Promise<{ report: InjuredBatchReport; exitCode: number }> {
  if (options.force) throw new Error('injured-batch does not support --force; rerolls are prohibited');
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ordered = INJURED_BATCH_TASK_IDS.map((id) => byId.get(id));
  if (ordered.some((task) => !task)) throw new Error('injured batch task plan is incomplete');
  if (ordered.some((task) => task?.promptStrategy !== 'character-positive-only')) throw new Error('injured batch requires character-positive-only tasks');

  const report: InjuredBatchReport = {
    strategy: 'descriptor-locked-text-only',
    requested: INJURED_BATCH_TASK_IDS.length,
    attempted: 0,
    generated: 0,
    apiCalls: 0,
    cacheHits: 0,
    rainApiCalls: 0,
    combatVariantCalls: 0,
    stoppedEarly: false,
    stopReason: null,
    tasks: [],
  };
  const generationReport = emptyReport();
  let consecutiveContentRejections = 0;

  for (let index = 0; index < ordered.length; index += 1) {
    const task = ordered[index]!;
    const basePortrait = byId.get(`character/${task.entityId}/portrait`);
    if (!basePortrait) throw new Error(`base portrait task missing for ${task.id}`);
    if (report.stoppedEarly) {
      report.tasks.push(taskReport(task, basePortrait));
      continue;
    }

    const built = await buildPrompt(config.rootDir, task, config.model);
    const hash = generationInputHash(built);
    await writePromptReport(config.rootDir, built, hash);
    const beforeApiCalls = generationReport.apiCalls;
    const beforeCacheHits = generationReport.cacheHits;
    report.attempted += 1;
    try {
      const metadata = await generateTask(config, task, { force: false, retryDelaysMs: [] }, generationReport);
      const apiCalls = generationReport.apiCalls - beforeApiCalls;
      const cacheHits = generationReport.cacheHits - beforeCacheHits;
      if (!metadata) throw new Error(`no candidate returned for ${task.id}`);
      consecutiveContentRejections = 0;
      report.generated += 1;
      report.tasks.push(taskReport(task, basePortrait, {
        candidateHash: metadata.hash,
        contentHash: metadata.contentHash,
        apiCalls,
        cacheHits,
        validation: {
          status: metadata.validationStatus,
          actualWidth: metadata.actualWidth,
          actualHeight: metadata.actualHeight,
          mimeType: metadata.actualMimeType,
          errors: metadata.validationErrors,
        },
        review: 'pending',
        providerStatus: metadata.source === 'cache' ? 'cache_hit' : 'generated',
        hardVisualObservation: 'candidate generated; human identity review required; no automatic similarity score or reroll',
      }));
    } catch (error) {
      const apiCalls = generationReport.apiCalls - beforeApiCalls;
      const cacheHits = generationReport.cacheHits - beforeCacheHits;
      const contentRejected = isInjuredContentRejection(error);
      consecutiveContentRejections = contentRejected ? consecutiveContentRejections + 1 : 0;
      report.tasks.push(taskReport(task, basePortrait, {
        apiCalls,
        cacheHits,
        review: 'pending',
        providerStatus: contentRejected ? 'provider_rejected' : 'failed',
        hardVisualObservation: error instanceof Error ? error.message : String(error),
      }));
      if (contentRejected && shouldStopInjuredBatch(consecutiveContentRejections)) {
        report.stoppedEarly = true;
        report.stopReason = 'two consecutive provider content rejections; remaining injured API calls were skipped';
      }
    }
  }

  report.apiCalls = generationReport.apiCalls;
  report.cacheHits = generationReport.cacheHits;
  await fs.mkdir(path.join(config.rootDir, 'reports'), { recursive: true });
  const reportName = sanitizeReportName(options.reportName ?? 'phase4a42-injured-batch');
  await fs.writeFile(path.join(config.rootDir, 'reports', `${reportName}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return { report, exitCode: report.tasks.some((task) => task.providerStatus === 'failed') ? 1 : 0 };
}
