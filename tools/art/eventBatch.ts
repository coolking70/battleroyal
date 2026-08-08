import fs from 'node:fs/promises';
import path from 'node:path';
import { contentHash } from './cache';
import { generateTask, emptyReport, writePromptReport } from './generator';
import { buildPrompt } from './promptBuilder';
import { ArtPipelineError, type ArtConfig, type ArtTask } from './types';

export const EVENT_E1_TASK_IDS = [
  'world_event/emergency_broadcast/illustration',
  'world_event/medical_alert/illustration',
  'world_event/research_anomaly/illustration',
  'world_event/citywide_unrest/illustration',
] as const;

export interface EventE1TaskReport {
  taskId: string;
  eventId: string;
  providerDescriptor: string;
  candidateHash: string | null;
  contentHash: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  apiCalls: number;
  cacheHits: number;
  validation: string;
  review: string;
  providerStatus: string;
  hardVisualObservation: string;
}

export interface EventE1Report {
  requested: number;
  attempted: number;
  generated: number;
  apiCalls: number;
  cacheHits: number;
  stoppedEarly: boolean;
  stopReason: string | null;
  rainApiCalls: number;
  tasks: EventE1TaskReport[];
}

export function isEventContentRejection(error: unknown): boolean {
  const details = error instanceof ArtPipelineError ? error.details : null;
  return details?.category === 'provider'
    && details.retryable === false
    && /unable to generate|modify your prompt|content|safety|policy/i.test(details.message);
}

export function shouldStopEventE1(contentRejectionsAmongFirstThree: number): boolean {
  return contentRejectionsAmongFirstThree >= 2;
}

function emptyEventReport(): EventE1Report {
  return { requested: EVENT_E1_TASK_IDS.length, attempted: 0, generated: 0, apiCalls: 0, cacheHits: 0, stoppedEarly: false, stopReason: null, rainApiCalls: 0, tasks: [] };
}

function sanitizeEventReportName(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!safe) throw new Error('report name must contain letters, numbers, _ or -');
  return safe;
}

function taskReport(task: ArtTask, values: Partial<EventE1TaskReport> = {}): EventE1TaskReport {
  return {
    taskId: task.id,
    eventId: task.entityId,
    providerDescriptor: task.providerDescriptor ?? task.promptTemplate,
    candidateHash: null,
    contentHash: null,
    width: null,
    height: null,
    mimeType: null,
    apiCalls: 0,
    cacheHits: 0,
    validation: 'not_attempted',
    review: 'not_applicable',
    providerStatus: 'not_attempted',
    hardVisualObservation: '',
    ...values,
  };
}

export async function runEventE1Batch(
  config: ArtConfig,
  tasks: readonly ArtTask[],
  options: { reportName?: string; force?: boolean } = {},
): Promise<{ report: EventE1Report; exitCode: number }> {
  if (options.force) throw new Error('event-e1 does not support --force; rerolls are prohibited');
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ordered = EVENT_E1_TASK_IDS.map((id) => byId.get(id));
  if (ordered.some((task) => !task)) throw new Error('event-e1 task plan is incomplete');
  const report = emptyEventReport();
  const generationReport = emptyReport();
  let contentRejections = 0;
  let nonContentFailures = 0;

  for (let index = 0; index < ordered.length; index += 1) {
    const task = ordered[index]!;
    if (task.promptStrategy !== 'event-positive-only') throw new Error(`${task.id} is not event-positive-only`);
    const built = await buildPrompt(config.rootDir, task, config.model);
    const hash = contentHash(built);
    await writePromptReport(config.rootDir, built, hash);
    const beforeApiCalls = generationReport.apiCalls;
    const beforeCacheHits = generationReport.cacheHits;
    report.attempted += 1;
    try {
      const metadata = await generateTask(config, task, { force: false }, generationReport);
      const apiCalls = generationReport.apiCalls - beforeApiCalls;
      const cacheHits = generationReport.cacheHits - beforeCacheHits;
      if (metadata) {
        report.generated += 1;
        report.tasks.push(taskReport(task, {
          candidateHash: metadata.hash,
          contentHash: metadata.contentHash,
          width: metadata.actualWidth,
          height: metadata.actualHeight,
          mimeType: metadata.actualMimeType,
          apiCalls,
          cacheHits,
          validation: metadata.validationStatus,
          review: metadata.reviewStatus,
          providerStatus: metadata.source === 'cache' ? 'cache_hit' : 'generated',
          hardVisualObservation: 'technical candidate; human visual review required',
        }));
      } else {
        report.tasks.push(taskReport(task, { apiCalls, cacheHits, providerStatus: 'no_candidate' }));
      }
    } catch (error) {
      const apiCalls = generationReport.apiCalls - beforeApiCalls;
      const cacheHits = generationReport.cacheHits - beforeCacheHits;
      const contentRejected = isEventContentRejection(error);
      if (contentRejected) contentRejections += 1;
      else nonContentFailures += 1;
      report.tasks.push(taskReport(task, {
        apiCalls,
        cacheHits,
        providerStatus: contentRejected ? 'provider_rejected' : 'failed',
        hardVisualObservation: error instanceof Error ? error.message : String(error),
      }));
      if (contentRejected && index < 3 && shouldStopEventE1(contentRejections)) {
        report.stoppedEarly = true;
        report.stopReason = 'two provider content rejections occurred within the first three E1 tasks';
        break;
      }
    }
  }
  report.apiCalls = generationReport.apiCalls;
  report.cacheHits = generationReport.cacheHits;
  await fs.mkdir(path.join(config.rootDir, 'reports'), { recursive: true });
  const reportName = sanitizeEventReportName(options.reportName ?? 'phase4a4-event-e1');
  await fs.writeFile(path.join(config.rootDir, 'reports', `${reportName}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return { report, exitCode: nonContentFailures > 0 ? 1 : 0 };
}
