import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createArtConfig } from '../tools/art/config';
import { contentHash } from '../tools/art/cache';
import {
  INJURED_BATCH_TASK_IDS,
  isInjuredContentRejection,
  runInjuredBatch,
  shouldStopInjuredBatch,
} from '../tools/art/injuredBatch';
import { auditCharacterProviderPrompt, FORBIDDEN_CHARACTER_TOKENS } from '../tools/art/promptAudit';
import { buildPrompt, promptHashInput } from '../tools/art/promptBuilder';
import { agnesRequestFor } from '../tools/art/providers/agnes';
import { loadTasks } from '../tools/art/taskPlanner';
import type { ArtTask } from '../tools/art/types';
import { ArtPipelineError } from '../tools/art/types';

const BASE_ANCHORS: Record<string, string[]> = {
  'character/fighter/injured': ['adult male-presenting character around 30', 'short dark hair', 'strong athletic build', 'charcoal-gray athletic zip jacket', 'muted rust-orange trim', 'simple forearm wraps', 'worn training gloves'],
  'character/engineer/injured': ['adult male-presenting character around 30', 'short dark brown hair', 'ochre mustard-yellow work jacket', 'plain gray shirt', 'dark work trousers', 'simple work gloves', 'compact tool belt', 'compact adjustable wrench'],
  'character/medic/injured': ['adult female character in her late twenties', 'short dark-brown bob haircut', 'desaturated green practical jacket', 'off-white cream utility panels', 'gray inner shirt', 'compact white-and-green first-aid waist pouch'],
};

const INJURY_ANCHORS: Record<string, string[]> = {
  'character/fighter/injured': ['mild fatigue', 'small beige adhesive strip', 'minor scuffs', 'slightly rumpled sleeve', 'tired but focused'],
  'character/engineer/injured': ['mild fatigue', 'small beige dressing', 'slightly dustier work jacket', 'minor sleeve scuff', 'slightly worn glove'],
  'character/medic/injured': ['mild fatigue', 'small beige adhesive dressing', 'slightly dusty jacket cuffs', 'minor fabric scuff', 'tired eyes'],
};

async function taskById(id: string): Promise<ArtTask> {
  return (await loadTasks(process.cwd())).find((task) => task.id === id)!;
}

async function tempArtRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'battleroyal-phase4a42-'));
  await fs.cp(path.join(process.cwd(), 'art', 'style'), path.join(root, 'art', 'style'), { recursive: true });
  await fs.cp(path.join(process.cwd(), 'art', 'tasks'), path.join(root, 'art', 'tasks'), { recursive: true });
  await fs.mkdir(path.join(root, 'public', 'assets'), { recursive: true });
  await fs.writeFile(path.join(root, 'public', 'assets', 'manifest.json'), JSON.stringify({ version: 1, characters: {}, zones: {}, items: {}, worldEvents: {} }));
  return root;
}

describe('Phase 4A-4.2 injured variant controlled production', () => {
  it('locks the exact sequential three-task production order', () => {
    expect(INJURED_BATCH_TASK_IDS).toEqual([
      'character/fighter/injured',
      'character/engineer/injured',
      'character/medic/injured',
    ]);
  });

  it.each(INJURED_BATCH_TASK_IDS)('uses revision 2 descriptor-locked positive-only strategy for %s', async (taskId) => {
    const task = await taskById(taskId);
    expect(task).toMatchObject({ promptStrategy: 'character-positive-only', revision: 2, styleProfile: 'character', status: 'planned' });
    expect(task.providerDescriptor).toBeTruthy();
    expect(task.positiveTraits?.length).toBeGreaterThanOrEqual(7);
    expect(task.positiveComposition?.length).toBeGreaterThanOrEqual(3);
  });

  it.each(INJURED_BATCH_TASK_IDS)('includes the approved base visual identity in %s', async (taskId) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    for (const anchor of BASE_ANCHORS[taskId]!) expect(built.prompt).toContain(anchor);
  });

  it.each(INJURED_BATCH_TASK_IDS)('includes only mild positive injury anchors in %s', async (taskId) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    for (const anchor of INJURY_ANCHORS[taskId]!) expect(built.prompt).toContain(anchor);
    expect(built.prompt).not.toMatch(/blood|open wound|fracture|burn|dismember|dying|severe|military|tactical/i);
    expect(built.negativePrompt).toBe('');
    expect(built.sections.avoid).toBe('');
  });

  it.each(INJURED_BATCH_TASK_IDS)('keeps %s free of internal IDs and reference claims', async (taskId) => {
    const task = await taskById(taskId);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(built.prompt).not.toContain(task.id);
    expect(built.prompt).not.toMatch(new RegExp(`\\b${task.entityId}\\b`, 'i'));
    expect(built.prompt).not.toMatch(/same character as previous image|same portrait|use reference|match input image|reference image|img2img/i);
  });

  it.each(INJURED_BATCH_TASK_IDS)('passes the character prompt audit for %s', async (taskId) => {
    const task = await taskById(taskId);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(auditCharacterProviderPrompt(task, built.prompt)).toMatchObject({ passed: true, forbiddenTokenCount: 0, internalTaskId: false, internalEntityId: false });
  });

  it.each(INJURED_BATCH_TASK_IDS)('captures a clean actual Agnes body for %s', async (taskId) => {
    const task = await taskById(taskId);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    const body = agnesRequestFor({ model: built.model, prompt: built.prompt, negativePrompt: built.negativePrompt, width: built.width, height: built.height, requestedRatio: built.requestedRatio });
    expect(body).toMatchObject({ model: 'agnes-image-2.1-flash', size: '1K', ratio: '3:4', return_base64: true });
    expect(body.prompt).toBe(built.prompt);
    expect(body.prompt).not.toContain('\n\nAvoid:');
    expect(auditCharacterProviderPrompt(task, body.prompt)).toMatchObject({ passed: true, forbiddenTokenCount: 0 });
  });

  it.each(FORBIDDEN_CHARACTER_TOKENS)('continues rejecting forbidden character vocabulary: %s', async (token) => {
    const task = await taskById(INJURED_BATCH_TASK_IDS[0]);
    expect(auditCharacterProviderPrompt(task, `A clean portrait containing ${token}.`).forbiddenTokens).toContain(token);
  });

  it('hashes strategy, descriptor, identity, injury, composition, revision and final prompt', async () => {
    const task = await taskById(INJURED_BATCH_TASK_IDS[1]);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(promptHashInput(built)).toMatchObject({ promptStrategy: 'character-positive-only', positiveTraits: task.positiveTraits, positiveComposition: task.positiveComposition, revision: 2, prompt: built.prompt, styleProfileVersion: built.styleProfileVersion });
    expect(contentHash(built)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('stops only after two consecutive provider content rejections', () => {
    expect(shouldStopInjuredBatch(0)).toBe(false);
    expect(shouldStopInjuredBatch(1)).toBe(false);
    expect(shouldStopInjuredBatch(2)).toBe(true);
    expect(isInjuredContentRejection(new ArtPipelineError({ category: 'provider', retryable: false, message: 'Unable to generate image; please modify your prompt.' }))).toBe(true);
    expect(isInjuredContentRejection(new ArtPipelineError({ category: 'provider', retryable: true, status: 503, message: 'temporary provider failure' }))).toBe(false);
  });

  it('runs each remaining variant once, keeps candidates pending, and records the report', async () => {
    const root = await tempArtRoot();
    const originalFetch = globalThis.fetch;
    const fixture = await fs.readFile(path.join(process.cwd(), 'tests/fixtures/agnes-success-base64.json'), 'utf8');
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      return new Response(fixture, { status: 200, headers: { 'content-type': 'application/json' } });
    });
    try {
      const result = await runInjuredBatch(createArtConfig(root, { IMAGE_API_KEY: 'test-secret' }), await loadTasks(root));
      expect(calls).toBe(3);
      expect(result.exitCode).toBe(0);
      expect(result.report).toMatchObject({ requested: 3, attempted: 3, generated: 3, apiCalls: 3, cacheHits: 0, rainApiCalls: 0, combatVariantCalls: 0, stoppedEarly: false });
      expect(result.report.tasks).toHaveLength(3);
      expect(result.report.tasks.every((task) => task.validation.status === 'passed' && task.review === 'pending' && task.providerStatus === 'generated')).toBe(true);
      const report = JSON.parse(await fs.readFile(path.join(root, 'reports/phase4a42-injured-batch.json'), 'utf8')) as typeof result.report;
      expect(report.tasks.map((task) => task.taskId)).toEqual([...INJURED_BATCH_TASK_IDS]);
    } finally {
      vi.stubGlobal('fetch', originalFetch);
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('stops the third API call after two consecutive content rejections without auto approval', async () => {
    const root = await tempArtRoot();
    const originalFetch = globalThis.fetch;
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { message: 'Unable to generate image; please modify your prompt.' } }), { status: 400 });
    });
    try {
      const result = await runInjuredBatch(createArtConfig(root, { IMAGE_API_KEY: 'test-secret' }), await loadTasks(root));
      expect(calls).toBe(2);
      expect(result.report).toMatchObject({ requested: 3, attempted: 2, generated: 0, apiCalls: 2, stoppedEarly: true, stopReason: expect.stringContaining('two consecutive') });
      expect(result.report.tasks).toHaveLength(3);
      expect(result.report.tasks[0]).toMatchObject({ providerStatus: 'provider_rejected', candidateHash: null, review: 'pending' });
      expect(result.report.tasks[1]).toMatchObject({ providerStatus: 'provider_rejected', candidateHash: null, review: 'pending' });
      expect(result.report.tasks[2]).toMatchObject({ providerStatus: 'skipped_after_stop', apiCalls: 0, candidateHash: null });
    } finally {
      vi.stubGlobal('fetch', originalFetch);
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
