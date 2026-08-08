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
};

export function selectPendingReviewCandidates(candidates: CandidateMetadata[], taskIds: readonly string[] = ROUND_A_TASKS): CandidateMetadata[] {
  return taskIds.map((taskId) => {
    const matches = candidates
      .filter((candidate) => candidate.taskId === taskId && candidate.reviewStatus === 'pending' && candidate.validationStatus === 'passed')
      .sort((a, b) => Number(b.source === 'api') - Number(a.source === 'api') || b.generatedAt.localeCompare(a.generatedAt));
    if (!matches[0]) throw new Error(`no pending validated candidate for ${taskId}`);
    return matches[0];
  });
}

export async function exportRoundAReview(config: ArtConfig): Promise<{ outputDir: string; candidates: CandidateMetadata[] }> {
  const candidates = selectPendingReviewCandidates(await listCandidates(config));
  const outputDir = path.join(config.rootDir, OUTPUT_DIR);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  const assets = [] as Array<{ taskId: string; candidateHash: string; file: string }>;
  const readme: string[] = [
    '# Phase 4A-1 Round A Review Package',
    '',
    'Automatic validation is recorded below. Human review decisions intentionally remain blank.',
    '',
    '| Task | Candidate Hash | File | Actual Resolution | Validation | Review |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const candidate of candidates) {
    const extension = path.extname(candidate.imagePath).slice(1) || 'bin';
    const file = `${OUTPUT_NAMES[candidate.taskId] ?? candidate.taskId.replaceAll('/', '-')}.${extension}`;
    await fs.copyFile(path.join(config.rootDir, candidate.imagePath), path.join(outputDir, file));
    assets.push({ taskId: candidate.taskId, candidateHash: candidate.hash, file });
    readme.push(`| ${candidate.taskId} | ${candidate.hash} | ${file} | ${candidate.actualWidth}×${candidate.actualHeight} | ${candidate.validationStatus} | pending |`);
    readme.push('');
    readme.push('Decision: __________');
    readme.push('Notes: __________');
    readme.push('');
  }
  await fs.writeFile(path.join(outputDir, 'index.json'), `${JSON.stringify({ assets }, null, 2)}\n`);
  await fs.writeFile(path.join(outputDir, 'README.md'), `${readme.join('\n')}\n`);
  return { outputDir, candidates };
}

async function main(): Promise<void> {
  const round = process.argv.slice(2).find((value) => value === '--round') ? process.argv[process.argv.indexOf('--round') + 1] : undefined;
  if (round !== 'A') throw new Error('review export currently supports only --round A');
  const configModule = await import('./config');
  const result = await exportRoundAReview(configModule.createArtConfig());
  console.log(`EXPORTED ${result.candidates.length} pending candidates to ${result.outputDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
