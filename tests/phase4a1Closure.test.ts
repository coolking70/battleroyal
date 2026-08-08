import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createArtConfig } from '../tools/art/config';
import { readManifest, manifestHash, validatePublishedManifest } from '../tools/art/publisher';
import { redactProviderMessage } from '../tools/art/providers/agnes';
import { exportRoundAReview, selectPendingReviewCandidates } from '../tools/art/reviewExport';
import { scanTextForSecrets } from '../tools/art/securityRepoAudit';
import { parseArgs } from '../tools/simulateBalance';
import type { ArtConfig, CandidateMetadata } from '../tools/art/types';

const roots: string[] = [];

function fakePng(width = 512, height = 512): Buffer {
  const bytes = Buffer.alloc(256);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[24] = 8;
  bytes[25] = 6;
  return bytes;
}

async function fixture(): Promise<{ root: string; config: ArtConfig }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'battleroyal-phase4a1-'));
  roots.push(root);
  await fs.cp(path.join(process.cwd(), 'art', 'tasks'), path.join(root, 'art', 'tasks'), { recursive: true });
  await fs.mkdir(path.join(root, 'public', 'assets', 'items'), { recursive: true });
  const config = createArtConfig(root, { IMAGE_API_KEY: 'test-secret' });
  return { root, config };
}

async function writePublishedState(config: ArtConfig, manifest: Record<string, unknown>, provenance: Record<string, unknown> = { version: 1, assets: {} }): Promise<void> {
  await fs.mkdir(path.dirname(config.manifestPath), { recursive: true });
  await fs.writeFile(config.manifestPath, JSON.stringify(manifest));
  await fs.writeFile(config.approvedAssetsPath, JSON.stringify(provenance));
  const normalized = await readManifest(config);
  await fs.writeFile(path.join(config.publicAssetsDir, 'art-version.json'), JSON.stringify({ pipelineVersion: 1, publishedAt: '2026-08-08T00:00:00.000Z', manifestHash: manifestHash(normalized), taskRevision: 'phase4-r1' }));
}

const emptyManifest = () => ({ version: 1, characters: {}, zones: {}, items: {}, worldEvents: {} });

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('Phase 4A-1 secret and error boundaries', () => {
  it.each([
    ['blank dotenv assignment', 'IMAGE_API_KEY=', []],
    ['non-empty dotenv assignment', 'IMAGE_API_KEY=fake-secret-token', ['non-empty-api-key-assignment']],
    ['environment reference', 'const key = process.env.IMAGE_API_KEY;', []],
    ['Vite assignment', 'VITE_IMAGE_API_KEY=fake-secret', ['non-empty-api-key-assignment']],
  ] as const)('scans %s correctly', (_label, text, reasons) => {
    expect(scanTextForSecrets(text)).toEqual(reasons);
  });

  it('redacts an echoed provider key before the error is exposed', () => {
    expect(redactProviderMessage('invalid token THIS_IS_TEST_SECRET', 'THIS_IS_TEST_SECRET')).toBe('invalid token [REDACTED]');
  });

  it('redacts before applying the 300-character provider message limit', () => {
    const value = redactProviderMessage(`${'x'.repeat(290)}THIS_IS_TEST_SECRET`, 'THIS_IS_TEST_SECRET');
    expect(value).not.toContain('THIS_IS_TEST_SECRET');
    expect(value.length).toBeLessThanOrEqual(300);
  });
});

describe('Phase 4A-1 provenance reverse integrity', () => {
  it('requires provenance for a formal AI task slot in the manifest', async () => {
    const { config } = await fixture();
    const manifest = { ...emptyManifest(), items: { bandage: '/assets/items/bandage/icon.png' } };
    await fs.mkdir(path.join(config.publicAssetsDir, 'items', 'bandage'), { recursive: true });
    await fs.writeFile(path.join(config.publicAssetsDir, 'items', 'bandage', 'icon.png'), fakePng());
    await writePublishedState(config, manifest);
    expect(await validatePublishedManifest(config)).toContain('manifest item/bandage AI asset is missing provenance for item/bandage/icon');
  });

  it('rejects provenance for an unknown task id', async () => {
    const { config } = await fixture();
    const manifest = emptyManifest();
    await writePublishedState(config, manifest, { version: 1, assets: { 'ghost/missing/icon': { candidateHash: 'a'.repeat(64), contentHash: 'b'.repeat(64), promptHash: 'c'.repeat(64), model: 'm', provider: 'agnes', approvedAt: '2026-08-08T00:00:00.000Z', publicPath: '/assets/items/ghost/icon.png' } } });
    expect(await validatePublishedManifest(config)).toContain('provenance ghost/missing/icon is not a defined art task');
  });

  it('allows the explicit legacy bandage SVG without AI provenance', async () => {
    const { config } = await fixture();
    const manifest = { ...emptyManifest(), items: { bandage: '/assets/items/bandage.svg' } };
    await fs.writeFile(path.join(config.publicAssetsDir, 'items', 'bandage.svg'), '<svg></svg>');
    await writePublishedState(config, manifest);
    expect(await validatePublishedManifest(config)).toEqual([]);
  });

  it('passes when an AI manifest slot and provenance point to the same task path', async () => {
    const { config } = await fixture();
    const manifest = { ...emptyManifest(), items: { bandage: '/assets/items/bandage/icon.png' } };
    await fs.mkdir(path.join(config.publicAssetsDir, 'items', 'bandage'), { recursive: true });
    await fs.writeFile(path.join(config.publicAssetsDir, 'items', 'bandage', 'icon.png'), fakePng());
    await writePublishedState(config, manifest, { version: 1, assets: { 'item/bandage/icon': { candidateHash: 'a'.repeat(64), contentHash: 'b'.repeat(64), promptHash: 'c'.repeat(64), model: 'agnes-image-2.1-flash', provider: 'agnes', approvedAt: '2026-08-08T00:00:00.000Z', publicPath: '/assets/items/bandage/icon.png' } } });
    expect(await validatePublishedManifest(config)).toEqual([]);
  });
});

describe('Phase 4A-1 regression and review export boundaries', () => {
  it('parses regression mode without changing the formal or CI flags', () => {
    const args = parseArgs(['--games', '500', '--seed-prefix', 'PHASE4A1', '--regression']);
    expect(args.regression).toBe(true);
    expect(args.ci).toBe(false);
  });

  function candidate(taskId: string, imagePath: string, source: 'api' | 'cache', generatedAt: string): CandidateMetadata {
    return {
      taskId,
      hash: 'a'.repeat(64) + (source === 'cache' ? '-cache' : ''),
      contentHash: 'b'.repeat(64),
      promptHash: 'c'.repeat(64),
      provider: 'agnes',
      model: 'agnes-image-2.1-flash',
      generatedAt,
      requestedWidth: 512,
      requestedHeight: 512,
      requestedRatio: '1:1',
      actualWidth: 512,
      actualHeight: 512,
      prompt: 'hidden from review export',
      negativePrompt: 'hidden',
      styleProfileVersion: 'v1',
      mimeType: 'image/png',
      actualMimeType: 'image/png',
      bytes: 256,
      imagePath,
      publicPath: '/assets/items/bandage/icon.png',
      validationStatus: 'passed',
      validationErrors: [],
      reviewStatus: 'pending',
      source,
    };
  }

  it('prefers the API-origin pending candidate when cache verification created a duplicate', () => {
    const api = candidate('character/scout/portrait', 'api.png', 'api', '2026-08-08T10:00:00.000Z');
    const cache = candidate('character/scout/portrait', 'cache.png', 'cache', '2026-08-08T11:00:00.000Z');
    expect(selectPendingReviewCandidates([cache, api], ['character/scout/portrait'])[0]).toBe(api);
  });

  it('does not export rejected or failed candidates', () => {
    const rejected = { ...candidate('character/scout/portrait', 'rejected.png', 'api', '2026-08-08T10:00:00.000Z'), reviewStatus: 'rejected' as const };
    const failed = { ...candidate('character/scout/portrait', 'failed.png', 'api', '2026-08-08T11:00:00.000Z'), validationStatus: 'failed' as const };
    expect(() => selectPendingReviewCandidates([rejected, failed], ['character/scout/portrait'])).toThrow('no pending validated candidate');
  });

  it('exports only pending candidates and leaves their review status unchanged', async () => {
    const { config } = await fixture();
    const tasks = ['character/scout/portrait', 'zone/school/background', 'item/bandage/icon', 'world_event/blackout/illustration'];
    const candidates = tasks.map((taskId, index) => candidate(taskId, `art/candidates/${index}.png`, 'api', `2026-08-08T10:0${index}:00.000Z`));
    for (const item of candidates) {
      const metadataPath = path.join(config.rootDir, item.imagePath.replace(/\.[^.]+$/, '.json'));
      await fs.mkdir(path.dirname(metadataPath), { recursive: true });
      await fs.writeFile(path.join(config.rootDir, item.imagePath), fakePng());
      await fs.writeFile(metadataPath, JSON.stringify(item));
    }
    const result = await exportRoundAReview(config);
    expect(result.candidates).toHaveLength(4);
    expect(JSON.parse(await fs.readFile(path.join(result.outputDir, 'index.json'), 'utf8')).assets).toHaveLength(4);
    expect(await fs.readdir(result.outputDir)).toEqual(expect.arrayContaining(['README.md', 'index.json', 'scout-portrait.png', 'school-background.png', 'bandage-icon.png', 'blackout-illustration.png']));
    expect((await selectPendingReviewCandidates(await Promise.resolve(candidates))).every((item) => item.reviewStatus === 'pending')).toBe(true);
  });
});
