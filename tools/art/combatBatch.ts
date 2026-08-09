import fs from 'node:fs/promises';
import path from 'node:path';
import { contentHash } from './cache';
import { COMBAT_BATCH_TASK_IDS } from './canary';
import { generateTask, emptyReport, writePromptReport } from './generator';
import { buildPrompt } from './promptBuilder';
import { listCandidates } from './reviewer';
import { auditCombatProviderPrompt } from './promptAudit';
import { ArtPipelineError, type ArtConfig, type ArtTask } from './types';

export const COMBAT_PRODUCTION_STRATEGY = 'descriptor-locked-text-only-dynamic-equipment-neutral-posture-only' as const;
export const DYNAMIC_EQUIPMENT_POLICY = 'no dynamic game equipment; only fixed wearable or static signature props' as const;

export interface CombatValidationReport {
  status: string;
  actualWidth: number | null;
  actualHeight: number | null;
  mimeType: string | null;
  errors: string[];
}

export interface CombatBatchTaskReport {
  taskId: string;
  basePortraitTask: string;
  injuredTask: string;
  candidateHash: string | null;
  contentHash: string | null;
  promptHash: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  apiCalls: number;
  cacheHits: number;
  validation: CombatValidationReport;
  review: 'pending' | 'not_attempted';
  providerStatus: 'generated' | 'cache_hit' | 'provider_rejected' | 'failed' | 'skipped_after_stop';
  identityDescriptorVersion: number;
  postureStrategy: string;
  signaturePropPolicy: string;
  dynamicEquipmentPolicy: string;
  postureOnly: boolean;
  handsEmpty: boolean;
  signaturePropContract: boolean;
  hardVisualObservation: string;
}

export interface CombatBatchReport {
  strategy: typeof COMBAT_PRODUCTION_STRATEGY;
  requested: 3;
  attempted: number;
  generated: number;
  apiCalls: number;
  cacheHits: number;
  scoutCombatCalls: number;
  rainApiCalls: number;
  stoppedEarly: boolean;
  stopReason: string | null;
  tasks: CombatBatchTaskReport[];
}

export function isCombatContentRejection(error: unknown): boolean {
  const details = error instanceof ArtPipelineError ? error.details : null;
  return details?.category === 'provider'
    && details.retryable === false
    && /unable to generate|modify your prompt|content|safety|policy/i.test(details.message);
}

function sanitizeReportName(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!safe) throw new Error('report name must contain letters, numbers, _ or -');
  return safe;
}

function emptyValidation(): CombatValidationReport {
  return { status: 'not_attempted', actualWidth: null, actualHeight: null, mimeType: null, errors: [] };
}

function basePortraitTaskId(task: ArtTask): string {
  return `character/${task.entityId}/portrait`;
}

function injuredTaskId(task: ArtTask): string {
  return `character/${task.entityId}/injured`;
}

function taskReport(task: ArtTask, values: Partial<CombatBatchTaskReport> = {}): CombatBatchTaskReport {
  return {
    taskId: task.id,
    basePortraitTask: basePortraitTaskId(task),
    injuredTask: injuredTaskId(task),
    candidateHash: null,
    contentHash: null,
    promptHash: null,
    width: null,
    height: null,
    mimeType: null,
    apiCalls: 0,
    cacheHits: 0,
    validation: emptyValidation(),
    review: 'not_attempted',
    providerStatus: 'skipped_after_stop',
    identityDescriptorVersion: task.revision,
    postureStrategy: 'posture-only; state expressed through body language and facial tension',
    signaturePropPolicy: task.signaturePropMode === 'wearable' ? 'fixed wearable role costume; no dynamic equipment' : 'static carried prop remains secured and untouched',
    dynamicEquipmentPolicy: DYNAMIC_EQUIPMENT_POLICY,
    postureOnly: task.postureOnly === true,
    handsEmpty: task.handsEmpty === true,
    signaturePropContract: false,
    hardVisualObservation: '',
    ...values,
  };
}

export async function runCombatBatch(
  config: ArtConfig,
  tasks: readonly ArtTask[],
  options: { reportName?: string; force?: boolean } = {},
): Promise<{ report: CombatBatchReport; exitCode: number }> {
  if (options.force) throw new Error('combat-batch does not support --force; rerolls are prohibited');
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ordered = COMBAT_BATCH_TASK_IDS.map((id) => byId.get(id));
  if (ordered.some((task) => !task)) throw new Error('combat batch task plan is incomplete');
  const combatTasks = ordered as ArtTask[];
  if (combatTasks.some((task) => task.promptStrategy !== 'character-combat-positive-only' || task.postureOnly !== true || !task.signaturePropMode)) {
    throw new Error('combat batch requires posture-only combat tasks with a signature prop mode');
  }
  const existing = await listCandidates(config);
  const existingCombat = existing.filter((candidate) => COMBAT_BATCH_TASK_IDS.includes(candidate.taskId as (typeof COMBAT_BATCH_TASK_IDS)[number]));
  if (existingCombat.length > 0) throw new Error(`combat batch refuses reroll; existing candidate found for ${existingCombat[0]!.taskId}`);

  const report: CombatBatchReport = {
    strategy: COMBAT_PRODUCTION_STRATEGY,
    requested: 3,
    attempted: 0,
    generated: 0,
    apiCalls: 0,
    cacheHits: 0,
    scoutCombatCalls: 0,
    rainApiCalls: 0,
    stoppedEarly: false,
    stopReason: null,
    tasks: [],
  };
  const generationReport = emptyReport();
  let contentRejectionsAmongFirstTwo = 0;
  let nonContentFailure = false;

  for (const task of combatTasks) {
    const basePortrait = byId.get(basePortraitTaskId(task));
    const injured = byId.get(injuredTaskId(task));
    if (!basePortrait || !injured) throw new Error(`combat identity chain is incomplete for ${task.id}`);
    if (report.stoppedEarly) {
      report.tasks.push(taskReport(task));
      continue;
    }
    const built = await buildPrompt(config.rootDir, task, config.model);
    const promptHash = contentHash(built);
    await writePromptReport(config.rootDir, built, promptHash);
    const audit = auditCombatProviderPrompt(task, built.prompt);
    if (!audit.passed || audit.postureOnlyContract !== true || audit.signaturePropContract !== true) {
      throw new Error(`combat prompt audit failed for ${task.id}: ${audit.failures.join('; ')}`);
    }
    const beforeApiCalls = generationReport.apiCalls;
    const beforeCacheHits = generationReport.cacheHits;
    report.attempted += 1;
    try {
      const metadata = await generateTask(config, task, { force: false, retryDelaysMs: [] }, generationReport);
      const apiCalls = generationReport.apiCalls - beforeApiCalls;
      const cacheHits = generationReport.cacheHits - beforeCacheHits;
      if (!metadata) throw new Error(`no candidate returned for ${task.id}`);
      if (metadata.validationStatus !== 'passed') {
        nonContentFailure = true;
        report.tasks.push(taskReport(task, {
          candidateHash: metadata.hash,
          contentHash: metadata.contentHash,
          promptHash: metadata.promptHash,
          width: metadata.actualWidth,
          height: metadata.actualHeight,
          mimeType: metadata.actualMimeType,
          apiCalls,
          cacheHits,
          validation: { status: metadata.validationStatus, actualWidth: metadata.actualWidth, actualHeight: metadata.actualHeight, mimeType: metadata.actualMimeType, errors: metadata.validationErrors },
          review: 'pending',
          providerStatus: 'failed',
          signaturePropContract: true,
          hardVisualObservation: 'automatic image validation failed; human review not sufficient for publication',
        }));
        report.stoppedEarly = true;
        report.stopReason = `automatic image validation failed for ${task.id}; remaining combat API calls were skipped`;
        continue;
      }
      report.generated += 1;
      report.tasks.push(taskReport(task, {
        candidateHash: metadata.hash,
        contentHash: metadata.contentHash,
        promptHash: metadata.promptHash,
        width: metadata.actualWidth,
        height: metadata.actualHeight,
        mimeType: metadata.actualMimeType,
        apiCalls,
        cacheHits,
        validation: { status: metadata.validationStatus, actualWidth: metadata.actualWidth, actualHeight: metadata.actualHeight, mimeType: metadata.actualMimeType, errors: metadata.validationErrors },
        review: 'pending',
        providerStatus: metadata.source === 'cache' ? 'cache_hit' : 'generated',
        signaturePropContract: true,
        hardVisualObservation: 'technical candidate generated; human identity/posture review required; no automatic similarity score or reroll',
      }));
    } catch (error) {
      const apiCalls = generationReport.apiCalls - beforeApiCalls;
      const cacheHits = generationReport.cacheHits - beforeCacheHits;
      const contentRejected = isCombatContentRejection(error);
      if (contentRejected && report.attempted <= 2) contentRejectionsAmongFirstTwo += 1;
      report.tasks.push(taskReport(task, {
        apiCalls,
        cacheHits,
        review: 'not_attempted',
        providerStatus: contentRejected ? 'provider_rejected' : 'failed',
        signaturePropContract: true,
        hardVisualObservation: error instanceof Error ? error.message : String(error),
      }));
      if (!contentRejected) {
        nonContentFailure = true;
        report.stoppedEarly = true;
        report.stopReason = `non-content provider failure for ${task.id}; remaining combat API calls were skipped`;
      } else if (report.attempted <= 2 && contentRejectionsAmongFirstTwo >= 2) {
        report.stoppedEarly = true;
        report.stopReason = 'Fighter and Engineer were both provider content-rejected; Medic API call was skipped';
      }
    }
  }

  report.apiCalls = generationReport.apiCalls;
  report.cacheHits = generationReport.cacheHits;
  report.scoutCombatCalls = 0;
  report.rainApiCalls = 0;
  await fs.mkdir(path.join(config.rootDir, 'reports'), { recursive: true });
  const reportName = sanitizeReportName(options.reportName ?? 'phase4a44-combat-batch');
  await fs.writeFile(path.join(config.rootDir, 'reports', `${reportName}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return { report, exitCode: nonContentFailure ? 1 : 0 };
}
