import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createArtConfig } from '../tools/art/config';
import { saveCache, findCacheEntry } from '../tools/art/cache';
import { generateTask } from '../tools/art/generator';
import { generationInputHash, sha256Bytes } from '../tools/art/hash';
import { buildPrompt } from '../tools/art/promptBuilder';
import { publishApproved, readProvenance, validatePublishedManifest } from '../tools/art/publisher';
import { reviewCandidate, listCandidates } from '../tools/art/reviewer';
import { runProvenanceHashMigration } from '../tools/art/provenanceHashMigration';
import { runPhase4A45Audit } from '../tools/art/phase4a45Audit';
import { loadTasks } from '../tools/art/taskPlanner';
import type { ArtConfig } from '../tools/art/types';

const tempRoots: string[] = [];

function fakePng(width: number, height: number, marker = 0): Buffer {
  const result = Buffer.alloc(256, marker);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(result);
  result.writeUInt32BE(13, 8);
  result.write('IHDR', 12, 'ascii');
  result.writeUInt32BE(width, 16);
  result.writeUInt32BE(height, 20);
  result[24] = 8;
  result[25] = 6;
  return result;
}

async function fixture(): Promise<{ root: string; config: ArtConfig }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'battleroyal-phase4a451-'));
  tempRoots.push(root);
  await fs.cp(path.join(process.cwd(), 'art', 'style'), path.join(root, 'art', 'style'), { recursive: true });
  await fs.cp(path.join(process.cwd(), 'art', 'characters'), path.join(root, 'art', 'characters'), { recursive: true });
  await fs.cp(path.join(process.cwd(), 'art', 'tasks'), path.join(root, 'art', 'tasks'), { recursive: true });
  await fs.mkdir(path.join(root, 'public', 'assets'), { recursive: true });
  await fs.writeFile(path.join(root, 'public', 'assets', 'manifest.json'), JSON.stringify({ version: 1, characters: {}, zones: {}, items: {}, worldEvents: {} }));
  return { root, config: createArtConfig(root, { IMAGE_API_KEY: 'test-secret', IMAGE_API_MODEL: 'test-model' }) };
}

async function cachedCandidate(config: ArtConfig, taskId: string, marker = 0): Promise<{ task: Awaited<ReturnType<typeof loadTasks>>[number]; promptHash: string }> {
  const task = (await loadTasks(config.rootDir)).find((entry) => entry.id === taskId)!;
  const built = await buildPrompt(config.rootDir, task, config.model);
  const promptHash = generationInputHash(built);
  await saveCache(config, promptHash, built, { mimeType: 'image/png', bytes: fakePng(task.width, task.height, marker) });
  await generateTask(config, task);
  return { task, promptHash };
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('Phase 4A-4.5.1 hash semantics', () => {
  it('hashes exact bytes with lowercase SHA-256', () => {
    expect(sha256Bytes(Buffer.from('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('uses canonical generation input for promptHash', async () => {
    const { root, config } = await fixture();
    const task = (await loadTasks(root))[0]!;
    const built = await buildPrompt(root, task, config.model);
    expect(generationInputHash(built)).toMatch(/^[a-f0-9]{64}$/);
    expect(generationInputHash(built)).not.toBe(sha256Bytes(Buffer.from(built.prompt)));
  });

  it('records contentHash from exact generated image bytes, not promptHash', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    const candidate = (await listCandidates(config)).find((entry) => entry.taskId === task.id)!;
    const bytes = await fs.readFile(path.join(config.rootDir, candidate.imagePath));
    expect(candidate.promptHash).toBe(promptHash);
    expect(candidate.contentHash).toBe(sha256Bytes(bytes));
    expect(candidate.contentHash).not.toBe(candidate.promptHash);
  });

  it('stores cache contentHash from image bytes while retaining promptHash cache key', async () => {
    const { root, config } = await fixture();
    const task = (await loadTasks(root)).find((entry) => entry.id === 'item/bandage/icon')!;
    const built = await buildPrompt(root, task, config.model);
    const promptHash = generationInputHash(built);
    const bytes = fakePng(task.width, task.height, 1);
    await saveCache(config, promptHash, built, { mimeType: 'image/png', bytes });
    const metadata = JSON.parse(await fs.readFile(path.join(config.cacheDir, promptHash, 'metadata.json'), 'utf8')) as { hash: string; contentHash: string };
    expect(metadata.hash).toBe(promptHash);
    expect(metadata.contentHash).toBe(sha256Bytes(bytes));
    expect(metadata.contentHash).not.toBe(promptHash);
  });

  it('rejects a cache image when its stored contentHash is stale', async () => {
    const { root, config } = await fixture();
    const task = (await loadTasks(root)).find((entry) => entry.id === 'item/bandage/icon')!;
    const built = await buildPrompt(root, task, config.model);
    const promptHash = generationInputHash(built);
    await saveCache(config, promptHash, built, { mimeType: 'image/png', bytes: fakePng(task.width, task.height) });
    const metadataPath = path.join(config.cacheDir, promptHash, 'metadata.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8')) as Record<string, unknown>;
    metadata.contentHash = '0'.repeat(64);
    await fs.writeFile(metadataPath, JSON.stringify(metadata));
    expect(await findCacheEntry(config, promptHash, built)).toBeNull();
  });

  it('keeps the same promptHash for duplicate candidates but changes contentHash when bytes differ', async () => {
    const { config } = await fixture();
    const first = await cachedCandidate(config, 'item/bandage/icon', 1);
    await fs.rm(path.join(config.cacheDir, first.promptHash), { recursive: true, force: true });
    const second = await cachedCandidate(config, 'item/bandage/icon', 2);
    const candidates = (await listCandidates(config)).filter((entry) => entry.taskId === first.task.id);
    expect(first.promptHash).toBe(second.promptHash);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]!.promptHash).toBe(candidates[1]!.promptHash);
    expect(candidates[0]!.contentHash).not.toBe(candidates[1]!.contentHash);
    expect(candidates[0]!.hash).not.toBe(candidates[1]!.hash);
  });
});

describe('Phase 4A-4.5.1 review/publish integrity', () => {
  it('rechecks candidate bytes before approval', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    const candidate = (await listCandidates(config)).find((entry) => entry.hash === promptHash)!;
    await fs.writeFile(path.join(config.rootDir, candidate.imagePath), fakePng(task.width, task.height, 9));
    await expect(reviewCandidate(config, task.id, candidate.hash, 'approved')).rejects.toThrow('candidate content hash mismatch');
  });

  it('allows an immutable candidate ID to differ from promptHash and contentHash', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    const oldPath = path.join(config.rootDir, 'art', 'candidates', 'items', 'bandage', 'icon', promptHash, `${promptHash}.json`);
    const metadata = JSON.parse(await fs.readFile(oldPath, 'utf8')) as Record<string, unknown>;
    const candidateId = `${'a'.repeat(64)}-123`;
    metadata.hash = candidateId;
    await fs.writeFile(oldPath, JSON.stringify(metadata, null, 2));
    await reviewCandidate(config, task.id, candidateId, 'approved');
    const result = await publishApproved(config);
    expect(result.changed).toBe(true);
    const published = await readProvenance(config);
    expect(published.assets[task.id]!.candidateHash).toBe(candidateId);
    expect(candidateId).not.toBe(published.assets[task.id]!.promptHash);
    expect(candidateId).not.toBe(published.assets[task.id]!.contentHash);
    expect(await validatePublishedManifest(config)).toEqual([]);
  });

  it('fails publish before swapping public assets when candidate bytes are tampered', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    const candidate = (await listCandidates(config)).find((entry) => entry.hash === promptHash)!;
    await fs.writeFile(path.join(config.rootDir, candidate.imagePath), fakePng(task.width, task.height, 8));
    const metadataPath = path.join(config.rootDir, candidate.imagePath.replace(/\.[^.]+$/, '.json'));
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8')) as Record<string, unknown>;
    metadata.reviewStatus = 'approved';
    await fs.writeFile(metadataPath, JSON.stringify(metadata));
    await expect(publishApproved(config)).rejects.toThrow('approved candidate content hash mismatch');
    await expect(fs.access(path.join(config.publicAssetsDir, 'manifest.json'))).resolves.toBeUndefined();
  });

  it('validates a freshly published candidate/public byte chain', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    await reviewCandidate(config, task.id, promptHash, 'approved');
    await publishApproved(config);
    expect(await validatePublishedManifest(config)).toEqual([]);
  });

  it('detects a valid same-size public image replacement', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    await reviewCandidate(config, task.id, promptHash, 'approved');
    await publishApproved(config);
    await fs.writeFile(path.join(config.publicAssetsDir, 'items', 'bandage', 'icon.png'), fakePng(task.width, task.height, 7));
    expect((await validatePublishedManifest(config)).some((error) => error.includes('public content bytes mismatch'))).toBe(true);
  });

  it('detects a valid same-size candidate image replacement after publish', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    await reviewCandidate(config, task.id, promptHash, 'approved');
    await publishApproved(config);
    const candidate = (await listCandidates(config)).find((entry) => entry.hash === promptHash)!;
    await fs.writeFile(path.join(config.rootDir, candidate.imagePath), fakePng(task.width, task.height, 6));
    expect((await validatePublishedManifest(config)).some((error) => error.includes('candidate content bytes mismatch'))).toBe(true);
  });

  it('detects provenance contentHash tampering', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    await reviewCandidate(config, task.id, promptHash, 'approved');
    await publishApproved(config);
    const provenancePath = path.join(config.rootDir, 'art', 'approved-assets.json');
    const provenance = JSON.parse(await fs.readFile(provenancePath, 'utf8')) as { assets: Record<string, Record<string, string>> };
    provenance.assets[task.id]!.contentHash = `${provenance.assets[task.id]!.contentHash.slice(0, -1)}0`;
    await fs.writeFile(provenancePath, JSON.stringify(provenance));
    expect((await validatePublishedManifest(config)).some((error) => error.includes('contentHash mismatch'))).toBe(true);
  });

  it('detects provenance promptHash tampering', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    await reviewCandidate(config, task.id, promptHash, 'approved');
    await publishApproved(config);
    const provenancePath = path.join(config.rootDir, 'art', 'approved-assets.json');
    const provenance = JSON.parse(await fs.readFile(provenancePath, 'utf8')) as { assets: Record<string, Record<string, string>> };
    provenance.assets[task.id]!.promptHash = `${provenance.assets[task.id]!.promptHash.slice(0, -1)}0`;
    await fs.writeFile(provenancePath, JSON.stringify(provenance));
    expect((await validatePublishedManifest(config)).some((error) => error.includes('promptHash mismatch'))).toBe(true);
  });

  it('detects candidate/public byte divergence even when both images are valid', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    await reviewCandidate(config, task.id, promptHash, 'approved');
    await publishApproved(config);
    const candidate = (await listCandidates(config)).find((entry) => entry.hash === promptHash)!;
    await fs.writeFile(path.join(config.rootDir, candidate.imagePath), fakePng(task.width, task.height, 5));
    await fs.writeFile(path.join(config.publicAssetsDir, 'items', 'bandage', 'icon.png'), fakePng(task.width, task.height, 4));
    expect((await validatePublishedManifest(config)).some((error) => error.includes('candidate/public bytes differ'))).toBe(true);
  });
});

describe('Phase 4A-4.5.1 migration and audit contracts', () => {
  it('defaults migration to read-only dry-run', async () => {
    const { config } = await fixture();
    const result = await runProvenanceHashMigration(config);
    expect(result.mode).toBe('dry-run');
    expect(result.providerCalls).toBe(0);
  });

  it('fails migration preflight instead of writing partial metadata when an image is missing', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    const candidate = (await listCandidates(config)).find((entry) => entry.hash === promptHash)!;
    const metadataBefore = await fs.readFile(path.join(config.rootDir, candidate.imagePath.replace(/\.[^.]+$/, '.json')), 'utf8');
    await fs.rm(path.join(config.rootDir, candidate.imagePath));
    const result = await runProvenanceHashMigration(config, { apply: true });
    expect(result.passed).toBe(false);
    expect(result.missingImages).toContain(task.id);
    expect(await fs.readFile(path.join(config.rootDir, candidate.imagePath.replace(/\.[^.]+$/, '.json')), 'utf8')).toBe(metadataBefore);
  });

  it('preserves candidate ID and review status while recomputing contentHash', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    const candidateBefore = (await listCandidates(config)).find((entry) => entry.hash === promptHash)!;
    const result = await runProvenanceHashMigration(config);
    expect(result.candidateIdsChanged).toBe(0);
    expect(result.reviewStatusesChanged).toBe(0);
    expect(result.promptHashesPreserved).toBe(1);
    expect(result.contentHashesRecomputed).toBe(1);
    expect(task.id).toBe(candidateBefore.taskId);
  });

  it('does not count rejected or pending history as approved provenance', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    await reviewCandidate(config, task.id, promptHash, 'rejected', 'history');
    const result = await runProvenanceHashMigration(config);
    expect(result.approved).toBe(0);
    expect(result.rejected).toBe(1);
    expect(result.provenanceEntriesUpdated).toBe(0);
  });

  it('does not call the provider during migration', async () => {
    const { config } = await fixture();
    const result = await runProvenanceHashMigration(config, { apply: true });
    expect(result.providerCalls).toBe(0);
  });

  it('keeps promptHash as the cache key in generation reports', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    const candidate = (await listCandidates(config)).find((entry) => entry.taskId === task.id)!;
    expect(candidate.promptHash).toBe(promptHash);
    expect(candidate.hash.startsWith(promptHash)).toBe(true);
  });

  it('requires a complete provenance chain for every published task', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    await reviewCandidate(config, task.id, promptHash, 'approved');
    await publishApproved(config);
    const provenancePath = path.join(config.rootDir, 'art', 'approved-assets.json');
    const provenance = JSON.parse(await fs.readFile(provenancePath, 'utf8')) as { assets: Record<string, unknown> };
    delete provenance.assets[task.id];
    await fs.writeFile(provenancePath, JSON.stringify(provenance));
    expect((await validatePublishedManifest(config)).some((error) => error.includes('missing provenance'))).toBe(true);
  });

  it('reports public byte tamper through the Phase 4A audit', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    await reviewCandidate(config, task.id, promptHash, 'approved');
    await publishApproved(config);
    await fs.writeFile(path.join(config.publicAssetsDir, 'items', 'bandage', 'icon.png'), fakePng(task.width, task.height, 3));
    const audit = await runPhase4A45Audit(config);
    expect((audit.provenance.publicContentHashMismatches as string[])).toContain(task.id);
    expect(audit.provenance.passed).toBe(false);
  });

  it('reports provenance contentHash tamper through the Phase 4A audit', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    await reviewCandidate(config, task.id, promptHash, 'approved');
    await publishApproved(config);
    const provenancePath = path.join(config.rootDir, 'art', 'approved-assets.json');
    const provenance = JSON.parse(await fs.readFile(provenancePath, 'utf8')) as { assets: Record<string, Record<string, string>> };
    provenance.assets[task.id]!.contentHash = '0'.repeat(64);
    await fs.writeFile(provenancePath, JSON.stringify(provenance));
    const audit = await runPhase4A45Audit(config);
    expect((audit.provenance.candidateContentHashMismatches as string[]).some((entry) => entry.startsWith(task.id))).toBe(true);
    expect(audit.provenance.passed).toBe(false);
  });

  it('reports provenance promptHash tamper through the Phase 4A audit', async () => {
    const { config } = await fixture();
    const { task, promptHash } = await cachedCandidate(config, 'item/bandage/icon');
    await reviewCandidate(config, task.id, promptHash, 'approved');
    await publishApproved(config);
    const provenancePath = path.join(config.rootDir, 'art', 'approved-assets.json');
    const provenance = JSON.parse(await fs.readFile(provenancePath, 'utf8')) as { assets: Record<string, Record<string, string>> };
    provenance.assets[task.id]!.promptHash = '0'.repeat(64);
    await fs.writeFile(provenancePath, JSON.stringify(provenance));
    const audit = await runPhase4A45Audit(config);
    expect((audit.provenance.promptHashMismatches as string[])).toContain(task.id);
    expect(audit.provenance.passed).toBe(false);
  });
});
