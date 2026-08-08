import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { listCandidates } from './reviewer';
import { validateManifest, isSafePublishedPath } from './validator';
import type { ArtConfig, ArtManifest, ArtVersion, CandidateMetadata } from './types';

function baseManifest(): ArtManifest {
  return {
    version: 1,
    characters: {},
    zones: {},
    items: {},
    worldEvents: {},
  };
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
    return {
      ...baseManifest(),
      ...parsed,
      characters: parsed.characters ?? {},
      zones: parsed.zones ?? {},
      items: parsed.items ?? {},
      worldEvents: parsed.worldEvents ?? {},
    } as ArtManifest;
  } catch {
    return baseManifest();
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

async function copyDirectory(source: string, destination: string): Promise<void> {
  await fs.mkdir(destination, { recursive: true });
  await fs.cp(source, destination, { recursive: true, force: true });
}

export async function publishApproved(config: ArtConfig): Promise<{ manifest: ArtManifest; published: CandidateMetadata[]; manifestHash: string }> {
  const approved = (await listCandidates(config)).filter(
    (candidate) => candidate.reviewStatus === 'approved' && candidate.validationStatus === 'passed',
  );
  const manifest = await readManifest(config);
  for (const candidate of approved) {
    const imagePath = path.join(config.rootDir, candidate.imagePath);
    try {
      await fs.access(imagePath);
    } catch {
      throw new Error(`approved candidate image is missing: ${candidate.taskId}`);
    }
    applyCandidate(manifest, candidate);
  }

  const publicParent = path.dirname(config.publicAssetsDir);
  const stagingDir = await fs.mkdtemp(path.join(publicParent, '.assets-publish-'));
  try {
    await copyDirectory(config.publicAssetsDir, stagingDir);
    for (const candidate of approved) {
      const destination = path.join(stagingDir, candidate.publicPath.slice('/assets/'.length));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(path.join(config.rootDir, candidate.imagePath), destination);
    }
    const stagedConfig = { ...config, publicAssetsDir: stagingDir };
    const errors = await validateManifest(stagedConfig, manifest);
    if (errors.length > 0) throw new Error(`publish validation failed:\n${errors.join('\n')}`);
    const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
    const manifestHash = crypto.createHash('sha256').update(manifestJson).digest('hex');
    const version: ArtVersion = {
      pipelineVersion: 1,
      publishedAt: new Date().toISOString(),
      manifestHash,
      taskRevision: 'phase4-r1',
    };
    await fs.writeFile(path.join(stagingDir, 'manifest.json'), manifestJson);
    await fs.writeFile(path.join(stagingDir, 'art-version.json'), `${JSON.stringify(version, null, 2)}\n`);

    const archiveRoot = path.join(config.rootDir, 'art', 'archive', new Date().toISOString().replaceAll(':', '-'));
    await fs.mkdir(archiveRoot, { recursive: true });
    await fs.rename(config.publicAssetsDir, path.join(archiveRoot, 'assets'));
    await fs.rename(stagingDir, config.publicAssetsDir);
    return { manifest, published: approved, manifestHash };
  } catch (error) {
    await fs.rm(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

export async function validatePublishedManifest(config: ArtConfig): Promise<string[]> {
  const manifest = await readManifest(config);
  return validateManifest(config, manifest);
}

export { readManifest };
