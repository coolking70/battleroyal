import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256Bytes } from './hash';
import { listCandidates } from './reviewer';
import { loadTasks } from './taskPlanner';
import { validateManifest, isSafePublishedPath } from './validator';
import type { ArtConfig, ArtManifest, ArtVersion, ApprovedAssetsFile, CandidateMetadata } from './types';

export const LEGACY_BASELINE_ASSETS = new Set(['/assets/items/bandage.svg']);

export interface PublishOptions {
  rename?: typeof fs.rename;
}

function baseManifest(): ArtManifest {
  return { version: 1, characters: {}, zones: {}, items: {}, worldEvents: {} };
}

function ensureCharacterSlot(manifest: ArtManifest, id: string): Record<'portrait' | 'injured' | 'combat', string | null> {
  manifest.characters[id] ??= { portrait: null, injured: null, combat: null };
  return manifest.characters[id]!;
}

function ensureZoneSlot(manifest: ArtManifest, id: string): Record<'background' | 'warning' | 'restricted', string | null> {
  manifest.zones[id] ??= { background: null, warning: null, restricted: null };
  return manifest.zones[id]!;
}

async function readManifest(config: ArtConfig): Promise<ArtManifest> {
  try {
    const parsed = JSON.parse(await fs.readFile(config.manifestPath, 'utf8')) as Partial<ArtManifest>;
    return { ...baseManifest(), ...parsed, characters: parsed.characters ?? {}, zones: parsed.zones ?? {}, items: parsed.items ?? {}, worldEvents: parsed.worldEvents ?? {} } as ArtManifest;
  } catch {
    return baseManifest();
  }
}

async function readProvenance(config: ArtConfig): Promise<ApprovedAssetsFile> {
  try {
    const parsed = JSON.parse(await fs.readFile(config.approvedAssetsPath, 'utf8')) as Partial<ApprovedAssetsFile>;
    return { version: 1, assets: parsed.assets ?? {} };
  } catch {
    return { version: 1, assets: {} };
  }
}

function applyCandidate(manifest: ArtManifest, candidate: CandidateMetadata): void {
  if (!isSafePublishedPath(candidate.publicPath)) throw new Error(`unsafe candidate public path: ${candidate.publicPath}`);
  const [root, entityId, slotFile] = candidate.publicPath.slice('/assets/'.length).split('/');
  const slot = slotFile?.replace(/\.[^.]+$/, '');
  if (root === 'characters') ensureCharacterSlot(manifest, entityId!)[slot as 'portrait' | 'injured' | 'combat'] = candidate.publicPath;
  else if (root === 'zones') ensureZoneSlot(manifest, entityId!)[slot as 'background' | 'warning' | 'restricted'] = candidate.publicPath;
  else if (root === 'items') manifest.items[entityId!] = candidate.publicPath;
  else if (root === 'world-events') manifest.worldEvents[entityId!] = candidate.publicPath;
  else throw new Error(`unsupported candidate public path: ${candidate.publicPath}`);
}

function manifestJson(manifest: ArtManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function manifestHash(manifest: ArtManifest): string {
  return crypto.createHash('sha256').update(manifestJson(manifest)).digest('hex');
}

function provenanceJson(file: ApprovedAssetsFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

async function copyDirectory(source: string, destination: string): Promise<void> {
  await fs.mkdir(destination, { recursive: true });
  await fs.cp(source, destination, { recursive: true, force: true });
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function publishApproved(
  config: ArtConfig,
  options: PublishOptions = {},
): Promise<{ manifest: ArtManifest; published: CandidateMetadata[]; manifestHash: string; changed: boolean }> {
  const rename = options.rename ?? fs.rename;
  const candidates = await listCandidates(config);
  const approved = candidates.filter((candidate) => candidate.reviewStatus === 'approved' && candidate.validationStatus === 'passed');
  const byTask = new Map<string, CandidateMetadata[]>();
  for (const candidate of approved) byTask.set(candidate.taskId, [...(byTask.get(candidate.taskId) ?? []), candidate]);
  for (const [taskId, entries] of byTask) {
    if (entries.length > 1) throw new Error(`duplicate active approvals for task: ${taskId}`);
  }

  const manifest = await readManifest(config);
  const existingProvenance = await readProvenance(config);
  const provenance: ApprovedAssetsFile = { version: 1, assets: { ...existingProvenance.assets } };
  if (approved.length === 0) {
    return { manifest, published: [], manifestHash: manifestHash(manifest), changed: false };
  }
  const candidateBytes = new Map<string, Buffer>();
  for (const candidate of approved) {
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(path.join(config.rootDir, candidate.imagePath));
    } catch {
      throw new Error(`approved candidate image is missing: ${candidate.taskId}`);
    }
    const actualContentHash = sha256Bytes(bytes);
    if (actualContentHash !== candidate.contentHash) {
      throw new Error(`approved candidate content hash mismatch: ${candidate.taskId}`);
    }
    candidateBytes.set(candidate.taskId, bytes);
    applyCandidate(manifest, candidate);
    const previous = existingProvenance.assets[candidate.taskId];
    provenance.assets[candidate.taskId] = {
      candidateHash: candidate.hash,
      contentHash: candidate.contentHash,
      promptHash: candidate.promptHash,
      model: candidate.model,
      provider: candidate.provider,
      approvedAt: previous?.candidateHash === candidate.hash ? previous.approvedAt : new Date().toISOString(),
      publicPath: candidate.publicPath,
    };
  }
  const nextManifestHash = manifestHash(manifest);
  const existingVersion = await readJsonFile<ArtVersion>(path.join(config.publicAssetsDir, 'art-version.json'));
  if (existingVersion?.manifestHash === nextManifestHash && sameJson(existingProvenance.assets, provenance.assets)) {
    return { manifest, published: approved, manifestHash: nextManifestHash, changed: false };
  }

  const publicParent = path.dirname(config.publicAssetsDir);
  const stagingDir = await fs.mkdtemp(path.join(publicParent, '.assets-publish-'));
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const backupDir = path.join(publicParent, `.assets-backup-${timestamp}`);
  const archiveDir = path.join(config.rootDir, 'art', 'archive', timestamp, 'assets');
  const provenanceTemp = path.join(path.dirname(config.approvedAssetsPath), `.approved-assets-${timestamp}.tmp`);
  const oldProvenanceText = await readRawFile(config.approvedAssetsPath);
  try {
    await copyDirectory(config.publicAssetsDir, stagingDir);
    for (const candidate of approved) {
      const destination = path.join(stagingDir, candidate.publicPath.slice('/assets/'.length));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, candidateBytes.get(candidate.taskId)!);
      const stagedHash = sha256Bytes(await fs.readFile(destination));
      if (stagedHash !== candidate.contentHash) throw new Error(`staged public content hash mismatch: ${candidate.taskId}`);
    }
    const stagedConfig = { ...config, publicAssetsDir: stagingDir };
    const errors = await validateManifest(stagedConfig, manifest);
    if (errors.length > 0) throw new Error(`publish validation failed:\n${errors.join('\n')}`);
    const version: ArtVersion = { pipelineVersion: 1, publishedAt: new Date().toISOString(), manifestHash: nextManifestHash, taskRevision: 'phase4-r1' };
    await fs.writeFile(path.join(stagingDir, 'manifest.json'), manifestJson(manifest));
    await fs.writeFile(path.join(stagingDir, 'art-version.json'), `${JSON.stringify(version, null, 2)}\n`);
    await fs.mkdir(path.dirname(provenanceTemp), { recursive: true });
    await fs.writeFile(provenanceTemp, provenanceJson(provenance));

    await rename(config.publicAssetsDir, backupDir);
    try {
      await rename(stagingDir, config.publicAssetsDir);
    } catch (error) {
      await fs.rm(config.publicAssetsDir, { recursive: true, force: true });
      await rename(backupDir, config.publicAssetsDir);
      throw error;
    }
    try {
      await rename(provenanceTemp, config.approvedAssetsPath);
    } catch (error) {
      await rename(config.publicAssetsDir, stagingDir);
      await rename(backupDir, config.publicAssetsDir);
      await fs.rm(stagingDir, { recursive: true, force: true });
      if (oldProvenanceText === null) await fs.rm(config.approvedAssetsPath, { force: true });
      else await fs.writeFile(config.approvedAssetsPath, oldProvenanceText);
      throw error;
    }
    await fs.mkdir(path.dirname(archiveDir), { recursive: true });
    try {
      await rename(backupDir, archiveDir);
    } catch {
      // The new formal tree and provenance are already committed atomically; retain backup for manual recovery.
    }
    return { manifest, published: approved, manifestHash: nextManifestHash, changed: true };
  } catch (error) {
    await fs.rm(stagingDir, { recursive: true, force: true });
    await fs.rm(provenanceTemp, { force: true });
    throw error;
  }
}

export async function validatePublishedManifest(config: ArtConfig): Promise<string[]> {
  const manifest = await readManifest(config);
  const errors = await validateManifest(config, manifest);
  const version = await readJsonFile<ArtVersion>(path.join(config.publicAssetsDir, 'art-version.json'));
  if (!version || version.manifestHash !== manifestHash(manifest)) errors.push('art-version manifestHash does not match manifest.json');
  const provenance = await readProvenance(config);
  const candidates = await listCandidates(config);
  const publishedOnlyCiValidation = process.env.CI === 'true' && candidates.length === 0;
  const candidatesByKey = new Map(candidates.map((candidate) => [`${candidate.taskId}:${candidate.hash}`, candidate]));
  const tasks = await loadTasks(config.rootDir);
  const taskIds = new Set(tasks.map((task) => task.id));
  for (const taskId of Object.keys(provenance.assets)) {
    if (!taskIds.has(taskId)) errors.push(`provenance ${taskId} is not a defined art task`);
  }
  for (const [taskId, entry] of Object.entries(provenance.assets)) {
    if (!isSafePublishedPath(entry.publicPath)) errors.push(`provenance ${taskId} has unsafe publicPath`);
    if (!entry.candidateHash.match(/^[a-f0-9]{64}(?:-[0-9-]+)?$/)) errors.push(`provenance ${taskId} has invalid candidateHash`);
    const manifestPath = manifestPathForTask(manifest, taskId);
    if (manifestPath !== entry.publicPath) errors.push(`provenance ${taskId} does not match manifest`);
    const candidate = candidatesByKey.get(`${taskId}:${entry.candidateHash}`);
    if (!candidate) {
      if (!publishedOnlyCiValidation) {
        errors.push(`provenance ${taskId} candidate metadata is missing`);
      } else {
        try {
          const publicBytes = await fs.readFile(path.join(config.publicAssetsDir, entry.publicPath.slice('/assets/'.length)));
          if (sha256Bytes(publicBytes) !== entry.contentHash) errors.push(`provenance ${taskId} public content bytes mismatch`);
          if (!/^[a-f0-9]{64}$/.test(entry.promptHash)) errors.push(`provenance ${taskId} promptHash is invalid`);
        } catch {
          errors.push(`provenance ${taskId} public file is missing`);
        }
      }
    } else {
      if (candidate.reviewStatus !== 'approved') errors.push(`provenance ${taskId} source is not approved`);
      if (candidate.validationStatus !== 'passed') errors.push(`provenance ${taskId} source validation is not passed`);
      if (candidate.publicPath !== entry.publicPath) errors.push(`provenance ${taskId} candidate publicPath mismatch`);
      if (candidate.promptHash !== entry.promptHash) errors.push(`provenance ${taskId} promptHash mismatch`);
      if (candidate.contentHash !== entry.contentHash) errors.push(`provenance ${taskId} contentHash mismatch`);
      try {
        const candidateBytes = await fs.readFile(path.join(config.rootDir, candidate.imagePath));
        if (sha256Bytes(candidateBytes) !== candidate.contentHash) errors.push(`provenance ${taskId} candidate content bytes mismatch`);
        const publicBytes = await fs.readFile(path.join(config.publicAssetsDir, entry.publicPath.slice('/assets/'.length)));
        if (sha256Bytes(publicBytes) !== entry.contentHash) errors.push(`provenance ${taskId} public content bytes mismatch`);
        if (!candidateBytes.equals(publicBytes)) errors.push(`provenance ${taskId} candidate/public bytes differ`);
      } catch {
        errors.push(`provenance ${taskId} candidate or public file is missing`);
      }
    }
    if (!(await fileExists(path.join(config.publicAssetsDir, entry.publicPath.slice('/assets/'.length))))) errors.push(`provenance ${taskId} file is missing`);
  }
  for (const [taskId, publicPath] of manifestAssetEntries(manifest)) {
    if (LEGACY_BASELINE_ASSETS.has(publicPath)) continue;
    const task = tasks.find((candidate) => taskPathMatches(candidate, publicPath));
    if (!task) {
      errors.push(`manifest ${taskId} references a non-legacy asset without a matching art task`);
      continue;
    }
    const entry = provenance.assets[task.id];
    if (!entry) errors.push(`manifest ${taskId} AI asset is missing provenance for ${task.id}`);
    else if (entry.publicPath !== publicPath) errors.push(`manifest ${taskId} provenance path mismatch for ${task.id}`);
  }
  return errors;
}

function taskPathPrefix(task: Awaited<ReturnType<typeof loadTasks>>[number]): string {
  const category = task.category === 'world_event' ? 'world-events' : `${task.category}s`;
  return `/assets/${category}/${task.entityId}/${task.variant}.`;
}

function taskPathMatches(task: Awaited<ReturnType<typeof loadTasks>>[number], publicPath: string): boolean {
  return publicPath.startsWith(taskPathPrefix(task));
}

function manifestAssetEntries(manifest: ArtManifest): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const [entityId, slots] of Object.entries(manifest.characters)) {
    for (const [slot, value] of Object.entries(slots)) if (typeof value === 'string') entries.push([`character/${entityId}/${slot}`, value]);
  }
  for (const [entityId, slots] of Object.entries(manifest.zones)) {
    for (const [slot, value] of Object.entries(slots)) if (typeof value === 'string') entries.push([`zone/${entityId}/${slot}`, value]);
  }
  for (const [entityId, value] of Object.entries(manifest.items)) if (typeof value === 'string') entries.push([`item/${entityId}`, value]);
  for (const [entityId, value] of Object.entries(manifest.worldEvents)) if (typeof value === 'string') entries.push([`world_event/${entityId}`, value]);
  return entries;
}

function manifestPathForTask(manifest: ArtManifest, taskId: string): string | null {
  const [category, entityId, variant] = taskId.split('/');
  if (category === 'character') return manifest.characters[entityId!]?.[variant as 'portrait' | 'injured' | 'combat'] ?? null;
  if (category === 'zone') return manifest.zones[entityId!]?.[variant as 'background' | 'warning' | 'restricted'] ?? null;
  if (category === 'item') return manifest.items[entityId!] ?? null;
  if (category === 'world_event') return manifest.worldEvents[entityId!] ?? null;
  return null;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function readRawFile(filePath: string): Promise<string | null> {
  try { return await fs.readFile(filePath, 'utf8'); } catch { return null; }
}

async function fileExists(filePath: string): Promise<boolean> {
  try { await fs.access(filePath); return true; } catch { return false; }
}

export { readManifest, readProvenance, manifestHash };
