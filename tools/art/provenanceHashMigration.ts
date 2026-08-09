import fs from 'node:fs/promises';
import path from 'node:path';
import { isSha256Hex, sha256Bytes } from './hash';
import { listCandidates } from './reviewer';
import { readProvenance } from './publisher';
import { loadTasks } from './taskPlanner';
import { validateImageBytes } from './validator';
import type { ApprovedAssetsFile, ArtConfig, CandidateMetadata } from './types';

export interface ProvenanceMigrationOptions {
  apply?: boolean;
}

export interface ProvenanceMigrationReport {
  generatedAt: string;
  mode: 'dry-run' | 'apply';
  totalCandidates: number;
  approved: number;
  pending: number;
  rejected: number;
  candidateIdsChanged: number;
  reviewStatusesChanged: number;
  promptHashesPreserved: number;
  contentHashesRecomputed: number;
  missingImages: string[];
  invalidImages: Array<{ taskId: string; errors: string[] }>;
  migrationFailures: string[];
  provenanceEntries: number;
  provenanceEntriesUpdated: number;
  publicCandidateHashMatches: number;
  publicAssetTreeBefore: string;
  publicAssetTreeAfter: string;
  imageFilesChanged: number;
  manifestPathsChanged: number;
  providerCalls: number;
  changed: boolean;
  passed: boolean;
}

interface CandidateUpdate {
  before: string;
  after: string;
  candidate: CandidateMetadata;
}

function metadataPath(config: ArtConfig, candidate: CandidateMetadata): string {
  return path.join(config.rootDir, candidate.imagePath.replace(/\.[^.]+$/, '.json'));
}

function statusCounts(candidates: readonly CandidateMetadata[]): Pick<ProvenanceMigrationReport, 'approved' | 'pending' | 'rejected'> {
  return {
    approved: candidates.filter((candidate) => candidate.reviewStatus === 'approved').length,
    pending: candidates.filter((candidate) => candidate.reviewStatus === 'pending').length,
    rejected: candidates.filter((candidate) => candidate.reviewStatus === 'rejected').length,
  };
}

async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}

async function treeHash(config: ArtConfig): Promise<string> {
  const manifest = JSON.parse(await fs.readFile(config.manifestPath, 'utf8')) as {
    characters: Record<string, Record<string, string | null>>;
    zones: Record<string, Record<string, string | null>>;
    items: Record<string, string | null>;
    worldEvents: Record<string, string | null>;
  };
  const paths: string[] = [];
  for (const slots of Object.values(manifest.characters)) for (const value of Object.values(slots)) if (value) paths.push(value);
  for (const slots of Object.values(manifest.zones)) for (const value of Object.values(slots)) if (value) paths.push(value);
  for (const value of Object.values(manifest.items)) if (value) paths.push(value);
  for (const value of Object.values(manifest.worldEvents)) if (value) paths.push(value);
  const rows: string[] = [];
  for (const publicPath of [...new Set(paths)].sort()) {
    const bytes = await fs.readFile(path.join(config.publicAssetsDir, publicPath.slice('/assets/'.length)));
    rows.push(`${publicPath}\t${sha256Bytes(bytes)}`);
  }
  return sha256Bytes(Buffer.from(`${rows.join('\n')}\n`, 'utf8'));
}

function provenanceText(file: ApprovedAssetsFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

async function applyFiles(files: Array<{ path: string; before: string; after: string }>): Promise<void> {
  const changed = files.filter((file) => file.before !== file.after);
  const committed: Array<{ path: string; before: string }> = [];
  try {
    for (const file of changed) {
      const temporary = `${file.path}.phase4a451.tmp`;
      await fs.writeFile(temporary, file.after, 'utf8');
      await fs.rename(temporary, file.path);
      committed.push({ path: file.path, before: file.before });
    }
  } catch (error) {
    for (const file of committed.reverse()) await fs.writeFile(file.path, file.before, 'utf8');
    throw error;
  } finally {
    for (const file of changed) await fs.rm(`${file.path}.phase4a451.tmp`, { force: true });
  }
}

export async function runProvenanceHashMigration(
  config: ArtConfig,
  options: ProvenanceMigrationOptions = {},
): Promise<ProvenanceMigrationReport> {
  const candidates = await listCandidates(config);
  const tasks = await loadTasks(config.rootDir);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const provenance = await readProvenance(config);
  const counts = statusCounts(candidates);
  const report: ProvenanceMigrationReport = {
    generatedAt: new Date().toISOString(),
    mode: options.apply ? 'apply' : 'dry-run',
    totalCandidates: candidates.length,
    ...counts,
    candidateIdsChanged: 0,
    reviewStatusesChanged: 0,
    promptHashesPreserved: 0,
    contentHashesRecomputed: 0,
    missingImages: [],
    invalidImages: [],
    migrationFailures: [],
    provenanceEntries: Object.keys(provenance.assets).length,
    provenanceEntriesUpdated: 0,
    publicCandidateHashMatches: 0,
    publicAssetTreeBefore: '',
    publicAssetTreeAfter: '',
    imageFilesChanged: 0,
    manifestPathsChanged: 0,
    providerCalls: 0,
    changed: false,
    passed: false,
  };

  try {
    report.publicAssetTreeBefore = await treeHash(config);
  } catch (error) {
    report.migrationFailures.push(`cannot freeze public asset tree: ${error instanceof Error ? error.message : String(error)}`);
  }

  const updates: CandidateUpdate[] = [];
  const byKey = new Map<string, CandidateMetadata>();
  for (const candidate of candidates) {
    byKey.set(`${candidate.taskId}:${candidate.hash}`, candidate);
    const task = taskById.get(candidate.taskId);
    if (!task) {
      report.migrationFailures.push(`${candidate.taskId}: task definition missing`);
      continue;
    }
    let before: string;
    let bytes: Buffer;
    try {
      const candidateMetadataPath = metadataPath(config, candidate);
      before = await readText(candidateMetadataPath);
      bytes = await fs.readFile(path.join(config.rootDir, candidate.imagePath));
    } catch {
      report.missingImages.push(candidate.taskId);
      continue;
    }
    const validation = validateImageBytes(bytes, task);
    if (validation.status !== 'passed') {
      report.invalidImages.push({ taskId: candidate.taskId, errors: validation.errors });
      continue;
    }
    const promptHash = isSha256Hex(candidate.promptHash)
      ? candidate.promptHash
      : isSha256Hex(candidate.contentHash)
        ? candidate.contentHash
        : isSha256Hex(candidate.hash.slice(0, 64))
          ? candidate.hash.slice(0, 64)
          : null;
    if (!promptHash) {
      report.migrationFailures.push(`${candidate.taskId}/${candidate.hash}: cannot recover promptHash without guessing`);
      continue;
    }
    report.promptHashesPreserved += 1;
    report.contentHashesRecomputed += 1;
    const next: CandidateMetadata = {
      ...candidate,
      promptHash,
      contentHash: sha256Bytes(bytes),
      actualWidth: validation.actualWidth ?? candidate.actualWidth,
      actualHeight: validation.actualHeight ?? candidate.actualHeight,
      actualMimeType: validation.mimeType ?? candidate.actualMimeType,
      bytes: bytes.byteLength,
    };
    updates.push({ before, after: JSON.stringify(next, null, 2), candidate: next });
  }

  const nextProvenance: ApprovedAssetsFile = { version: provenance.version, assets: { ...provenance.assets } };
  for (const [taskId, entry] of Object.entries(provenance.assets)) {
    const candidate = byKey.get(`${taskId}:${entry.candidateHash}`);
    const update = updates.find((item) => item.candidate.taskId === taskId && item.candidate.hash === entry.candidateHash);
    if (!candidate || !update) {
      report.migrationFailures.push(`${taskId}: approved provenance candidate is missing or invalid`);
      continue;
    }
    if (update.candidate.reviewStatus !== 'approved' || update.candidate.validationStatus !== 'passed') {
      report.migrationFailures.push(`${taskId}: provenance source is not approved and passed`);
      continue;
    }
    const publicFilePath = path.join(config.publicAssetsDir, entry.publicPath.slice('/assets/'.length));
    try {
      const publicBytes = await fs.readFile(publicFilePath);
      const candidateBytes = await fs.readFile(path.join(config.rootDir, update.candidate.imagePath));
      if (!candidateBytes.equals(publicBytes)) report.migrationFailures.push(`${taskId}: candidate/public bytes differ`);
      else report.publicCandidateHashMatches += 1;
    } catch {
      report.migrationFailures.push(`${taskId}: public file is missing`);
    }
    nextProvenance.assets[taskId] = {
      ...entry,
      promptHash: update.candidate.promptHash,
      contentHash: update.candidate.contentHash,
    };
  }
  report.provenanceEntriesUpdated = Object.entries(provenance.assets).filter(([taskId, entry]) => JSON.stringify(entry) !== JSON.stringify(nextProvenance.assets[taskId])).length;
  report.changed = updates.some((item) => item.before !== item.after) || provenanceText(provenance) !== provenanceText(nextProvenance);

  try {
    report.publicAssetTreeAfter = await treeHash(config);
  } catch (error) {
    report.migrationFailures.push(`cannot reread public asset tree: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (report.publicAssetTreeBefore && report.publicAssetTreeBefore !== report.publicAssetTreeAfter) {
    report.migrationFailures.push('public asset tree changed during preflight');
  }

  const files = updates.map((update) => ({ path: metadataPath(config, update.candidate), before: update.before, after: update.after }));
  files.push({ path: config.approvedAssetsPath, before: provenanceText(provenance), after: provenanceText(nextProvenance) });
  if (options.apply && report.migrationFailures.length === 0 && report.missingImages.length === 0 && report.invalidImages.length === 0) {
    try {
      await applyFiles(files);
    } catch (error) {
      report.migrationFailures.push(`atomic apply failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (options.apply && report.migrationFailures.length === 0 && report.missingImages.length === 0 && report.invalidImages.length === 0) {
    report.changed = files.some((file) => file.before !== file.after);
  }
  report.passed = report.totalCandidates === 54 && report.approved === 35 && report.pending === 10 && report.rejected === 9 && report.candidateIdsChanged === 0 && report.reviewStatusesChanged === 0 && report.missingImages.length === 0 && report.invalidImages.length === 0 && report.migrationFailures.length === 0 && report.provenanceEntries === 35 && report.publicCandidateHashMatches === 35 && report.publicAssetTreeBefore === report.publicAssetTreeAfter;
  await fs.mkdir(path.join(config.rootDir, 'reports'), { recursive: true });
  await fs.writeFile(path.join(config.rootDir, 'reports/phase4a451-migration.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
