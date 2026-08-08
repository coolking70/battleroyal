import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createArtConfig } from '../tools/art/config';
import { contentHash, saveCache } from '../tools/art/cache';
import { generateImage } from '../tools/art/apiClient';
import { generateTask } from '../tools/art/generator';
import { buildPrompt, promptHashInput } from '../tools/art/promptBuilder';
import { publishApproved } from '../tools/art/publisher';
import { reviewCandidate } from '../tools/art/reviewer';
import { loadTasks, selectTasks } from '../tools/art/taskPlanner';
import { isSafePublishedPath, validateImageBytes, validateManifest } from '../tools/art/validator';
import { ArtPipelineError, type ArtConfig, type ArtTask } from '../tools/art/types';

const tempRoots: string[] = [];

function fakePng(width: number, height: number, bytes = 256): Buffer {
  const result = Buffer.alloc(Math.max(bytes, 100));
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
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'battleroyal-phase4-'));
  tempRoots.push(root);
  await fs.cp(path.join(process.cwd(), 'art', 'style'), path.join(root, 'art', 'style'), { recursive: true });
  await fs.cp(path.join(process.cwd(), 'art', 'characters'), path.join(root, 'art', 'characters'), { recursive: true });
  await fs.cp(path.join(process.cwd(), 'art', 'tasks'), path.join(root, 'art', 'tasks'), { recursive: true });
  await fs.mkdir(path.join(root, 'public', 'assets'), { recursive: true });
  await fs.writeFile(path.join(root, 'public', 'assets', 'manifest.json'), JSON.stringify({ version: 1, characters: {}, zones: {}, items: {}, worldEvents: {} }));
  return { root, config: createArtConfig(root, { IMAGE_API_KEY: 'test-secret', IMAGE_API_MODEL: 'test-model' }) };
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('Phase 4 task and prompt contracts', () => {
  it('loads exactly 32 stable tasks and hashes prompt inputs deterministically', async () => {
    const { root } = await fixture();
    const tasks = await loadTasks(root);
    expect(tasks).toHaveLength(32);
    const task = tasks[0]!;
    const first = await buildPrompt(root, task, 'test-model');
    const second = await buildPrompt(root, task, 'test-model');
    expect(contentHash(first)).toBe(contentHash(second));
    expect(first.prompt).toContain('Original urban survival game artwork');
    expect(first.negativePrompt).toContain('watermark');

    await fs.appendFile(path.join(root, 'art', 'style', 'master-style.md'), '\nrevision marker');
    const changed = await buildPrompt(root, task, 'test-model');
    expect(contentHash(changed)).not.toBe(contentHash(first));
  });

  it('validation enforces image signature, dimensions, aspect ratio and alpha', () => {
    expect(validateImageBytes(fakePng(768, 1024), { width: 768, height: 1024 })).toMatchObject({ status: 'passed', mimeType: 'image/png' });
    expect(validateImageBytes(fakePng(512, 512), { width: 768, height: 1024 })).toMatchObject({ status: 'failed' });
    expect(validateImageBytes(fakePng(512, 512), { width: 512, height: 512, alphaRequired: true })).toMatchObject({ status: 'passed' });
  });

  it.each([
    ['character', 'character/scout/portrait'],
    ['zone', 'zone/school/background'],
    ['item', 'item/bandage/icon'],
    ['world_event', 'world_event/blackout/illustration'],
  ])('selects the %s task family', async (category, expectedId) => {
    const { root } = await fixture();
    const tasks = selectTasks(await loadTasks(root), { category });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.some((task) => task.id === expectedId)).toBe(true);
  });

  it.each([
    ['prompt', (built: Awaited<ReturnType<typeof buildPrompt>>) => ({ ...built, prompt: `${built.prompt} changed` })],
    ['negative prompt', (built: Awaited<ReturnType<typeof buildPrompt>>) => ({ ...built, negativePrompt: `${built.negativePrompt} changed` })],
    ['model', (built: Awaited<ReturnType<typeof buildPrompt>>) => ({ ...built, model: 'another-model' })],
    ['dimensions', (built: Awaited<ReturnType<typeof buildPrompt>>) => ({ ...built, width: built.width + 1 })],
    ['style version', (built: Awaited<ReturnType<typeof buildPrompt>>) => ({ ...built, styleProfileVersion: 'another-style' })],
  ])('includes %s changes in the content hash input', async (_label, mutate) => {
    const { root } = await fixture();
    const task = (await loadTasks(root))[0]!;
    const built = await buildPrompt(root, task, 'test-model');
    expect(JSON.stringify(promptHashInput(mutate(built)))).not.toBe(JSON.stringify(promptHashInput(built)));
  });

  it('writes character design source into character prompts but not zone prompts', async () => {
    const { root } = await fixture();
    const tasks = await loadTasks(root);
    const characterPrompt = await buildPrompt(root, tasks.find((task) => task.id === 'character/scout/portrait')!, 'test-model');
    const zonePrompt = await buildPrompt(root, tasks.find((task) => task.id === 'zone/school/background')!, 'test-model');
    expect(characterPrompt.prompt).toContain('Scout design sheet');
    expect(zonePrompt.prompt).not.toContain('design sheet');
  });
});

describe('Phase 4 API and cache boundary', () => {
  it('accepts base64 image responses without exposing the key in the result', async () => {
    const { config } = await fixture();
    const image = fakePng(1, 1);
    let auth = '';
    const result = await generateImage(config, { model: 'test-model', prompt: 'test', width: 1, height: 1 }, async (_input, init) => {
      auth = String(init?.headers && (init.headers as Record<string, string>).Authorization);
      return new Response(JSON.stringify({ id: 'req-test', data: [{ b64_json: image.toString('base64') }] }), { status: 200 });
    });
    expect(result.bytes.equals(image)).toBe(true);
    expect(result.providerRequestId).toBe('req-test');
    expect(auth).toBe('Bearer test-secret');
  });

  it('uses an existing cache entry and creates a pending candidate without an API call', async () => {
    const { root, config } = await fixture();
    const task = (await loadTasks(root)).find((item) => item.id === 'character/scout/portrait')!;
    const built = await buildPrompt(root, task, config.model);
    const hash = contentHash(built);
    await saveCache(config, hash, built, { mimeType: 'image/png', bytes: fakePng(768, 1024) });
    const report = { requested: 0, cacheHits: 0, apiCalls: 0, successful: 0, failed: 0, retryCount: 0, totalBytes: 0, tasks: [] as Array<{ taskId: string; hash: string; source: 'api' | 'cache' | 'dry-run'; status: string; errors?: string[] }> };
    const candidate = await generateTask(config, task, { retryDelaysMs: [0, 0, 0] }, report);
    expect(candidate?.source).toBe('cache');
    expect(candidate?.reviewStatus).toBe('pending');
    expect(report.apiCalls).toBe(0);
    expect(report.cacheHits).toBe(1);
  });

  it.each([
    [401, 'auth', false],
    [403, 'auth', false],
    [429, 'rate_limit', true],
    [500, 'provider', true],
    [400, 'provider', false],
  ] as const)('classifies HTTP %s as %s retry=%s', async (status, category, retryable) => {
    const { config } = await fixture();
    await expect(generateImage(config, { model: 'test-model', prompt: 'test', width: 1, height: 1 }, async () => new Response('{}', { status }))).rejects.toMatchObject({
      details: { category, retryable, status },
    });
  });

  it('rejects malformed JSON and image-less provider responses as non-retryable', async () => {
    const { config } = await fixture();
    await expect(generateImage(config, { model: 'test-model', prompt: 'test', width: 1, height: 1 }, async () => new Response('not-json', { status: 200 }))).rejects.toMatchObject({
      details: { category: 'invalid_response', retryable: false },
    });
    await expect(generateImage(config, { model: 'test-model', prompt: 'test', width: 1, height: 1 }, async () => new Response(JSON.stringify({ data: [{}] }), { status: 200 }))).rejects.toMatchObject({
      details: { category: 'invalid_response', retryable: false },
    });
  });

  it('downloads URL responses and detects their image type', async () => {
    const { config } = await fixture();
    const image = fakePng(1, 1);
    let calls = 0;
    const result = await generateImage(config, { model: 'test-model', prompt: 'test', width: 1, height: 1 }, async () => {
      calls += 1;
      if (calls === 1) return new Response(JSON.stringify({ data: [{ url: 'https://provider.invalid/image' }] }), { status: 200 });
      return new Response(new Uint8Array(image), { status: 200, headers: { 'content-type': 'image/png' } });
    });
    expect(result.mimeType).toBe('image/png');
    expect(calls).toBe(2);
  });

  it('does not overwrite an existing candidate after a cache hit', async () => {
    const { root, config } = await fixture();
    const task = (await loadTasks(root)).find((item) => item.id === 'item/bandage/icon')!;
    const built = await buildPrompt(root, task, config.model);
    const hash = contentHash(built);
    await saveCache(config, hash, built, { mimeType: 'image/png', bytes: fakePng(512, 512) });
    const first = await generateTask(config, task);
    await reviewCandidate(config, task.id, first!.hash, 'approved');
    const second = await generateTask(config, task);
    expect(second?.hash).not.toBe(first?.hash);
    expect(second?.contentHash).toBe(first?.contentHash);
    expect(second?.reviewStatus).toBe('pending');
  });
});

describe('Phase 4 review and publish contracts', () => {
  async function cachedCandidate(taskId: string): Promise<{ config: ArtConfig; task: ArtTask; hash: string }> {
    const { root, config } = await fixture();
    const task = (await loadTasks(root)).find((item) => item.id === taskId)!;
    const built = await buildPrompt(root, task, config.model);
    const hash = contentHash(built);
    await saveCache(config, hash, built, { mimeType: 'image/png', bytes: fakePng(task.width, task.height) });
    await generateTask(config, task, { retryDelaysMs: [0] });
    return { config, task, hash };
  }

  it('does not approve a failed candidate and publishes only approved candidates', async () => {
    const { config, task, hash } = await cachedCandidate('item/bandage/icon');
    await expect(reviewCandidate(config, task.id, hash, 'approved')).resolves.toMatchObject({ reviewStatus: 'approved' });
    const result = await publishApproved(config);
    expect(result.published).toHaveLength(1);
    const publishedPath = path.join(config.publicAssetsDir, 'items', 'bandage', 'icon.png');
    await expect(fs.access(publishedPath)).resolves.toBeUndefined();
    const manifest = JSON.parse(await fs.readFile(config.manifestPath, 'utf8')) as { items: Record<string, string | null> };
    expect(manifest.items.bandage).toBe('/assets/items/bandage/icon.png');
  });

  it('rejects approval when automatic validation fails', async () => {
    const { config, task, hash } = await cachedCandidate('zone/school/background');
    const bad = await fs.readFile(path.join(config.cacheDir, hash, 'image.png'));
    bad.writeUInt32BE(512, 16);
    bad.writeUInt32BE(512, 20);
    await fs.writeFile(path.join(config.rootDir, 'art', 'candidates', 'zones', 'school', 'background', hash, `${hash}.png`), bad);
    const metadataPath = path.join(config.rootDir, 'art', 'candidates', 'zones', 'school', 'background', hash, `${hash}.json`);
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8')) as Record<string, unknown>;
    metadata.validationStatus = 'failed';
    metadata.validationErrors = ['aspect ratio'];
    await fs.writeFile(metadataPath, JSON.stringify(metadata));
    await expect(reviewCandidate(config, task.id, hash, 'approved')).rejects.toThrow('automatic validation failed');
  });

  it.each([
    ['/assets/items/bandage.png', true],
    ['assets/items/bandage.png', false],
    ['/assets/../secret.png', false],
    ['/assets/items\\bandage.png', false],
    ['/assets//bandage.png', false],
    ['https://example.invalid/a.png', false],
  ])('published path safety: %s => %s', (candidate, safe) => {
    expect(isSafePublishedPath(candidate)).toBe(safe);
  });

  it('reports a missing manifest asset and passes after the file exists', async () => {
    const { config } = await fixture();
    const manifest = { version: 1 as const, characters: {}, zones: {}, items: { bandage: '/assets/items/bandage.png' }, worldEvents: {} };
    expect(await validateManifest(config, manifest)).toContain('items.bandage references a missing or unsafe file');
    await fs.mkdir(path.join(config.publicAssetsDir, 'items'), { recursive: true });
    await fs.writeFile(path.join(config.publicAssetsDir, 'items', 'bandage.png'), fakePng(1, 1));
    expect(await validateManifest(config, manifest)).toEqual([]);
  });

  it('keeps rejected candidates out of the published manifest', async () => {
    const { config, task, hash } = await cachedCandidate('item/bandage/icon');
    await reviewCandidate(config, task.id, hash, 'rejected', 'shape is unclear');
    const result = await publishApproved(config);
    expect(result.published).toHaveLength(0);
    const manifest = JSON.parse(await fs.readFile(config.manifestPath, 'utf8')) as { items: Record<string, string | null> };
    expect(manifest.items.bandage).toBeUndefined();
  });

  it('does not expose ArtPipelineError details with authorization headers', async () => {
    const { config } = await fixture();
    let caught: unknown;
    try {
      await generateImage(config, { model: 'test-model', prompt: 'test', width: 1, height: 1 }, async () => new Response('{}', { status: 401 }));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ArtPipelineError);
    expect(JSON.stringify(caught)).not.toContain('Bearer');
  });
});
