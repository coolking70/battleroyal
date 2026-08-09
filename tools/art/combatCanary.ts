import fs from 'node:fs/promises';
import path from 'node:path';
import { contentHash } from './cache';
import { generateTask, emptyReport, writePromptReport } from './generator';
import { buildPrompt } from './promptBuilder';
import { listCandidates } from './reviewer';
import { ArtPipelineError, type ArtConfig, type ArtTask } from './types';
import { SCOUT_COMBAT_CANARY_TASK_ID } from './canary';

export const COMBAT_CANARY_STRATEGY = 'descriptor-locked-text-only-dynamic-equipment-neutral' as const;
export const DYNAMIC_EQUIPMENT_POLICY = 'weapon visuals belong to item/equipment systems; character combat state art remains equipment-neutral' as const;

export interface CombatValidationReport {
  status: string;
  actualWidth: number | null;
  actualHeight: number | null;
  mimeType: string | null;
  errors: string[];
}

export interface ScoutCombatTaskReport {
  taskId: string;
  basePortraitTask: string;
  injuredTask: string;
  candidateHash: string | null;
  contentHash: string | null;
  width: number | null;
  height: number | null;
  validation: CombatValidationReport;
  review: 'pending' | 'not_attempted';
  apiCalls: number;
  cacheHits: number;
  source: 'api' | 'cache' | 'none';
  providerStatus: 'generated' | 'cache_hit' | 'provider_rejected' | 'failed';
  identityDescriptorVersion: number;
  combatDescriptorVersion: number;
  dynamicEquipmentPolicy: string;
  hardVisualObservation: string;
}

export interface ScoutCombatCanaryReport {
  strategy: typeof COMBAT_CANARY_STRATEGY;
  requested: number;
  attempted: number;
  generated: number;
  apiCalls: number;
  cacheHits: number;
  rainApiCalls: number;
  otherCombatCalls: number;
  tasks: ScoutCombatTaskReport[];
}

export function isCombatContentRejection(error: unknown): boolean {
  const details = error instanceof ArtPipelineError ? error.details : null;
  return details?.category === 'provider'
    && details.retryable === false
    && /unable to generate|modify your prompt|content|safety|policy/i.test(details.message);
}

function emptyValidation(): CombatValidationReport {
  return { status: 'not_attempted', actualWidth: null, actualHeight: null, mimeType: null, errors: [] };
}

function taskReport(task: ArtTask, basePortrait: ArtTask, injured: ArtTask, values: Partial<ScoutCombatTaskReport> = {}): ScoutCombatTaskReport {
  return {
    taskId: task.id,
    basePortraitTask: basePortrait.id,
    injuredTask: injured.id,
    candidateHash: null,
    contentHash: null,
    width: null,
    height: null,
    validation: emptyValidation(),
    review: 'not_attempted',
    apiCalls: 0,
    cacheHits: 0,
    source: 'none',
    providerStatus: 'failed',
    identityDescriptorVersion: Math.max(basePortrait.revision, injured.revision),
    combatDescriptorVersion: task.revision,
    dynamicEquipmentPolicy: DYNAMIC_EQUIPMENT_POLICY,
    hardVisualObservation: '',
    ...values,
  };
}

function sanitizeReportName(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!safe) throw new Error('report name must contain letters, numbers, _ or -');
  return safe;
}

export async function runScoutCombatCanary(
  config: ArtConfig,
  tasks: readonly ArtTask[],
  options: { reportName?: string; force?: boolean } = {},
): Promise<{ report: ScoutCombatCanaryReport; exitCode: number }> {
  if (options.force) throw new Error('Scout Combat canary does not support --force; rerolls are prohibited');
  const task = tasks.find((item) => item.id === SCOUT_COMBAT_CANARY_TASK_ID);
  const basePortrait = tasks.find((item) => item.id === 'character/scout/portrait');
  const injured = tasks.find((item) => item.id === 'character/scout/injured');
  if (!task || !basePortrait || !injured) throw new Error('Scout Combat canary task or identity sources are missing');
  if (task.promptStrategy !== 'character-combat-positive-only' || task.revision < 2) throw new Error('Scout Combat task is not descriptor-locked revision 2');
  if ((await listCandidates(config)).some((candidate) => candidate.taskId === task.id)) throw new Error('Scout Combat candidate already exists; rerolls are prohibited');

  const report: ScoutCombatCanaryReport = {
    strategy: COMBAT_CANARY_STRATEGY,
    requested: 1,
    attempted: 1,
    generated: 0,
    apiCalls: 0,
    cacheHits: 0,
    rainApiCalls: 0,
    otherCombatCalls: 0,
    tasks: [],
  };
  const generationReport = emptyReport();
  const built = await buildPrompt(config.rootDir, task, config.model);
  const hash = contentHash(built);
  await writePromptReport(config.rootDir, built, hash);
  const beforeApiCalls = generationReport.apiCalls;
  const beforeCacheHits = generationReport.cacheHits;
  try {
    const metadata = await generateTask(config, task, { force: false, retryDelaysMs: [] }, generationReport);
    if (!metadata) throw new Error('Scout Combat generation returned no candidate');
    report.generated = 1;
    report.tasks.push(taskReport(task, basePortrait, injured, {
      candidateHash: metadata.hash,
      contentHash: metadata.contentHash,
      width: metadata.actualWidth,
      height: metadata.actualHeight,
      validation: {
        status: metadata.validationStatus,
        actualWidth: metadata.actualWidth,
        actualHeight: metadata.actualHeight,
        mimeType: metadata.actualMimeType,
        errors: metadata.validationErrors,
      },
      review: 'pending',
      apiCalls: generationReport.apiCalls - beforeApiCalls,
      cacheHits: generationReport.cacheHits - beforeCacheHits,
      source: metadata.source,
      providerStatus: metadata.source === 'cache' ? 'cache_hit' : 'generated',
      hardVisualObservation: 'candidate generated; human comparison against Scout Portrait and Injured remains required; no automatic similarity score or reroll',
    }));
  } catch (error) {
    const contentRejected = isCombatContentRejection(error);
    report.tasks.push(taskReport(task, basePortrait, injured, {
      review: 'pending',
      apiCalls: generationReport.apiCalls - beforeApiCalls,
      cacheHits: generationReport.cacheHits - beforeCacheHits,
      source: 'none',
      providerStatus: contentRejected ? 'provider_rejected' : 'failed',
      hardVisualObservation: error instanceof Error ? error.message : String(error),
    }));
    if (!contentRejected) {
      report.apiCalls = generationReport.apiCalls;
      report.cacheHits = generationReport.cacheHits;
      await writeReport(config, options.reportName, report);
      return { report, exitCode: 1 };
    }
  }

  report.apiCalls = generationReport.apiCalls;
  report.cacheHits = generationReport.cacheHits;
  await writeReport(config, options.reportName, report);
  return { report, exitCode: 0 };
}

async function writeReport(config: ArtConfig, reportName: string | undefined, report: ScoutCombatCanaryReport): Promise<void> {
  await fs.mkdir(path.join(config.rootDir, 'reports'), { recursive: true });
  const safeName = sanitizeReportName(reportName ?? 'phase4a43-scout-combat-canary');
  await fs.writeFile(path.join(config.rootDir, 'reports', `${safeName}.json`), `${JSON.stringify(report, null, 2)}\n`);
}
