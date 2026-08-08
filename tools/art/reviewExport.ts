import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listCandidates } from './reviewer';
import type { ArtConfig, CandidateMetadata } from './types';

export const ROUND_A_TASKS = [
  'character/scout/portrait',
  'zone/school/background',
  'item/bandage/icon',
  'world_event/blackout/illustration',
] as const;

const OUTPUT_DIR = path.join('output', 'art-review', 'phase4a1-round-a');
const OUTPUT_NAMES: Record<string, string> = {
  'character/scout/portrait': 'scout-portrait',
  'zone/school/background': 'school-background',
  'item/bandage/icon': 'bandage-icon',
  'world_event/blackout/illustration': 'blackout-illustration',
  'character/fighter/portrait': 'fighter-portrait',
  'character/engineer/portrait': 'engineer-portrait',
  'character/medic/portrait': 'medic-portrait',
  'zone/hospital/background': 'hospital-background',
  'item/medkit/icon': 'medkit-icon',
  'world_event/rain/illustration': 'rain-illustration',
};

const REVIEW_REMINDERS: Record<string, string> = {
  'character/scout/portrait': 'Check that binoculars are the only prominent equipment and that hands, back, and shoulders are free of weapons; remember the v1 rifle issue.',
  'zone/school/background': 'Check for zero people, zero human silhouettes, and a calm open lower center; remember the v1 central-person and silhouette issue.',
  'item/bandage/icon': 'Check for exactly one centered isolated object on a neutral backdrop with no scenery, frame, arrows, buttons, or text; remember the v1 ruins/HUD/frame issue.',
  'world_event/blackout/illustration': 'Check the v5 close electrical control-area composition: ceiling out of frame, black displays and controls, zero green/white normal lights, and exactly one dim red emergency beacon.',
  'character/fighter/portrait': 'Positive-only review: check occupational identity, clean shoulder/back silhouette, sport wraps/gloves, and no injured variant.',
  'character/engineer/portrait': 'Positive-only review: check workshop repair identity, short wrench/tool belt, clean shoulder/back silhouette, and no injured variant.',
  'character/medic/portrait': 'Positive-only review: check community first-aid identity, compact pouch, clean shoulder/back silhouette, and no injured variant.',
  'zone/hospital/background': 'Check for an environment-only hospital background with zero people or human silhouettes and no character focal subject.',
  'item/medkit/icon': 'Check for exactly one isolated high-frequency healing consumable object, no bandage-only substitution, scenery, hand, frame, UI, or text.',
  'world_event/rain/illustration': 'Check for an environment-only rain event illustration with no people, weapons, HUD, or unrelated event motifs.',
};
const REVIEW_CHECKLISTS: Record<string, string[]> = {
  'character/scout/portrait': [
    'no firearm of any kind', 'nothing visible behind either shoulder', 'no gun stock/barrel', 'no gun holster', 'no camouflage', 'no tactical/military vest', 'both hands empty', 'binoculars remain clear', 'civilian clothing', 'adult 28–32 appearance',
  ],
  'world_event/blackout/illustration': [
    'close or medium-close control area', 'ceiling outside the frame', 'zero ceiling lamps visible', 'no windows', 'no exterior view', 'no people', 'no weather/rain', 'no HUD/interface/text', 'all digital displays black', 'control panels and indicator arrays dark', 'zero green lights', 'zero white normal lights', 'exactly one dim red emergency beacon', 'image is predominantly dark', 'immediately reads as blackout',
  ],
  'character/fighter/portrait': ['no unexpected long object behind shoulders', 'ordinary occupational identity reads clearly', 'no obvious militarized appearance', 'profession prop is clear', 'character style consistent with Scout'],
  'character/engineer/portrait': ['no unexpected long object behind shoulders', 'ordinary occupational identity reads clearly', 'no obvious militarized appearance', 'profession prop is clear', 'character style consistent with Scout'],
  'character/medic/portrait': ['no unexpected long object behind shoulders', 'ordinary occupational identity reads clearly', 'no obvious militarized appearance', 'profession prop is clear', 'character style consistent with Scout'],
  'zone/hospital/background': ['environment only', 'zero people', 'zero human silhouettes', 'no character focal subject', 'lower center remains open'],
  'item/medkit/icon': ['exactly one centered object', 'healing medical kit is the subject', 'no scenery or environment', 'no hands or UI frame', 'no readable text'],
  'world_event/rain/illustration': ['environment-only event', 'rain is visually clear', 'zero people', 'zero weapons', 'no HUD or event card frame'],
};

export interface ReviewExportOptions {
  reportPath?: string;
  outputDir?: string;
  fileSuffix?: string;
  title?: string;
}

export function selectPendingReviewCandidates(candidates: CandidateMetadata[], taskIds: readonly string[] = ROUND_A_TASKS): CandidateMetadata[] {
  return taskIds.map((taskId) => {
    const matches = candidates
      .filter((candidate) => candidate.taskId === taskId && candidate.reviewStatus === 'pending' && candidate.validationStatus === 'passed')
      .sort((a, b) => Number(b.source === 'api') - Number(a.source === 'api') || b.generatedAt.localeCompare(a.generatedAt));
    if (!matches[0]) throw new Error(`no pending validated candidate for ${taskId}`);
    return matches[0];
  });
}

export async function selectCandidatesFromReport(config: ArtConfig, reportPath: string): Promise<CandidateMetadata[]> {
  const parsed = JSON.parse(await fs.readFile(path.isAbsolute(reportPath) ? reportPath : path.join(config.rootDir, reportPath), 'utf8')) as {
    tasks?: Array<{ taskId?: string; candidateHash?: string | null; validation?: string; review?: string }>;
  };
  if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) throw new Error('review report has no tasks');
  const candidates = await listCandidates(config);
  const attempted = parsed.tasks.filter((entry) => !(entry.validation === 'not_attempted' && entry.candidateHash == null));
  const selected = attempted.map((entry) => {
    if (!entry.taskId || !entry.candidateHash) throw new Error('review report task is missing taskId or candidateHash');
    const candidate = candidates.find((item) => item.taskId === entry.taskId && item.hash === entry.candidateHash);
    if (!candidate) throw new Error(`review report candidate not found: ${entry.taskId} / ${entry.candidateHash}`);
    if (candidate.validationStatus !== 'passed' || candidate.reviewStatus !== 'pending') throw new Error(`review report candidate is not pending/passed: ${entry.taskId}`);
    if (entry.validation && entry.validation !== candidate.validationStatus) throw new Error(`review report validation mismatch: ${entry.taskId}`);
    if (entry.review && entry.review !== candidate.reviewStatus) throw new Error(`review report review status mismatch: ${entry.taskId}`);
    return candidate;
  });
  if (new Set(selected.map((candidate) => candidate.taskId)).size !== selected.length) throw new Error('review report contains duplicate task ids');
  return selected;
}

export async function exportRoundAReview(config: ArtConfig, options: ReviewExportOptions = {}): Promise<{ outputDir: string; candidates: CandidateMetadata[] }> {
  const candidates = options.reportPath
    ? await selectCandidatesFromReport(config, options.reportPath)
    : selectPendingReviewCandidates(await listCandidates(config));
  const outputDir = path.join(config.rootDir, options.outputDir ?? OUTPUT_DIR);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  const assets = [] as Array<{ taskId: string; candidateHash: string; file: string }>;
  const readme: string[] = [
    `# ${options.title ?? 'Phase 4A-1 Round A Review Package'}`,
    '',
    'Automatic validation is recorded below. Human review decisions intentionally remain blank.',
    '',
    '| Task | Candidate Hash | File | Actual Resolution | Validation | Review |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const candidate of candidates) {
    const extension = path.extname(candidate.imagePath).slice(1) || 'bin';
    const file = `${OUTPUT_NAMES[candidate.taskId] ?? candidate.taskId.replaceAll('/', '-')}${options.fileSuffix ?? ''}.${extension}`;
    await fs.copyFile(path.join(config.rootDir, candidate.imagePath), path.join(outputDir, file));
    assets.push({ taskId: candidate.taskId, candidateHash: candidate.hash, file });
    readme.push(`| ${candidate.taskId} | ${candidate.hash} | ${file} | ${candidate.actualWidth}×${candidate.actualHeight} | ${candidate.validationStatus} | pending |`);
    readme.push('');
    readme.push('Decision: __________');
    readme.push('Notes: __________');
    readme.push(`Review reminder: ${REVIEW_REMINDERS[candidate.taskId] ?? 'Review against the task brief and hard constraints.'}`);
    const checklist = REVIEW_CHECKLISTS[candidate.taskId];
    if (checklist) {
      readme.push('');
      readme.push('Human review checklist:');
      checklist.forEach((item) => readme.push(`- [ ] ${item}`));
    }
    readme.push('');
  }
  await fs.writeFile(path.join(outputDir, 'index.json'), `${JSON.stringify({ assets }, null, 2)}\n`);
  await fs.writeFile(path.join(outputDir, 'README.md'), `${readme.join('\n')}\n`);
  return { outputDir, candidates };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const roundIndex = argv.indexOf('--round');
  const reportIndex = argv.indexOf('--report');
  const outputIndex = argv.indexOf('--output');
  const suffixIndex = argv.findIndex((value) => value === '--suffix' || value.startsWith('--suffix='));
  const round = roundIndex >= 0 ? argv[roundIndex + 1] : undefined;
  const reportPath = reportIndex >= 0 ? argv[reportIndex + 1] : undefined;
  const outputDir = outputIndex >= 0 ? argv[outputIndex + 1] : undefined;
  const fileSuffix = suffixIndex >= 0 ? (argv[suffixIndex].startsWith('--suffix=') ? argv[suffixIndex].slice('--suffix='.length) : argv[suffixIndex + 1]) : undefined;
  if (reportPath && round) throw new Error('use either --round or --report, not both');
  if (!reportPath && round !== 'A') throw new Error('review export currently supports only --round A');
  if (reportPath && !outputDir) throw new Error('--output is required with --report');
  const configModule = await import('./config');
  const options = reportPath ? {
    reportPath,
    outputDir,
    fileSuffix: fileSuffix ?? '',
    title: fileSuffix === '-positive' ? 'Phase 4A-2.1 Character Positive-only Review Package' : fileSuffix === '-nonchar' ? 'Phase 4A-2.1 Non-character B1 Review Package' : fileSuffix === '-v5' ? 'Phase 4A-2 Blackout v5 Review Package' : fileSuffix === '-b1' ? 'Phase 4A-2 Controlled Round B1 Review Package' : fileSuffix === '-v4' ? 'Phase 4A-1.3 Round A4 Review Package' : fileSuffix === '-v3' ? 'Phase 4A-1.2 Round A3 Review Package' : undefined,
  } : {};
  const result = await exportRoundAReview(configModule.createArtConfig(), options);
  console.log(`EXPORTED ${result.candidates.length} pending candidates to ${result.outputDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
