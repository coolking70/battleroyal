import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createArtConfig } from '../tools/art/config';
import { generateImage } from '../tools/art/apiClient';
import { generationInputHash } from '../tools/art/hash';
import { EVENT_E1_TASK_IDS, isEventContentRejection, runEventE1Batch, shouldStopEventE1 } from '../tools/art/eventBatch';
import { auditEventProviderPrompt, FORBIDDEN_EVENT_PERSON_TOKENS, FORBIDDEN_EVENT_UI_TOKENS } from '../tools/art/promptAudit';
import { buildPrompt, promptHashInput } from '../tools/art/promptBuilder';
import { loadTasks } from '../tools/art/taskPlanner';
import { ArtPipelineError, type ArtTask } from '../tools/art/types';

const EVENT_TASKS = [...EVENT_E1_TASK_IDS] as const;
const ANCHORS: Record<(typeof EVENT_TASKS)[number], string[]> = {
  'world_event/emergency_broadcast/illustration': ['public-address speaker', 'communications console', 'abstract signal bars', 'geometric blocks', 'amber warning beacon'],
  'world_event/medical_alert/illustration': ['hospital emergency supply station', 'off-white cases', 'muted green panels', 'status beacon'],
  'world_event/research_anomaly/illustration': ['contained instrument anomaly', 'research chamber', 'sealed glass apparatus', 'blue-violet', 'abstract waveforms'],
  'world_event/citywide_unrest/illustration': ['disordered city intersection', 'displaced lightweight barriers', 'overturned bins', 'scattered paper', 'warning beacons'],
};

async function taskById(id: string): Promise<ArtTask> {
  return (await loadTasks(process.cwd())).find((task) => task.id === id)!;
}

async function agnesBody(task: ArtTask): Promise<{ built: Awaited<ReturnType<typeof buildPrompt>>; body: Record<string, unknown> }> {
  const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
  const fixture = await fs.readFile(path.join(process.cwd(), 'tests/fixtures/agnes-success-base64.json'), 'utf8');
  let body: Record<string, unknown> = {};
  await generateImage(createArtConfig(process.cwd(), { IMAGE_API_KEY: 'test-secret' }), {
    model: built.model,
    prompt: built.prompt,
    negativePrompt: built.negativePrompt,
    width: built.width,
    height: built.height,
    requestedRatio: built.requestedRatio,
  }, async (_input, init) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(fixture, { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return { built, body };
}

describe('Phase 4A-4 Event E1 provider-safe production contracts', () => {
  async function tempArtRoot(): Promise<string> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'battleroyal-phase4a4-e1-'));
    await fs.cp(path.join(process.cwd(), 'art', 'style'), path.join(root, 'art', 'style'), { recursive: true });
    await fs.cp(path.join(process.cwd(), 'art', 'tasks'), path.join(root, 'art', 'tasks'), { recursive: true });
    await fs.mkdir(path.join(root, 'public', 'assets'), { recursive: true });
    await fs.writeFile(path.join(root, 'public', 'assets', 'manifest.json'), JSON.stringify({ version: 1, characters: {}, zones: {}, items: {}, worldEvents: {} }));
    return root;
  }

  it('plans exactly four E1 tasks in the required API order', () => {
    expect(EVENT_TASKS).toEqual([
      'world_event/emergency_broadcast/illustration',
      'world_event/medical_alert/illustration',
      'world_event/research_anomaly/illustration',
      'world_event/citywide_unrest/illustration',
    ]);
  });

  it('does not plan Rain or any prior world event in E1', () => {
    expect(EVENT_TASKS).not.toContain('world_event/rain/illustration');
    expect(EVENT_TASKS).not.toContain('world_event/blackout/illustration');
  });

  it.each(EVENT_TASKS)('assigns %s to event-positive-only', async (taskId) => {
    expect((await taskById(taskId)).promptStrategy).toBe('event-positive-only');
  });

  it.each(EVENT_TASKS)('keeps %s at revision 2', async (taskId) => {
    expect((await taskById(taskId)).revision).toBe(2);
  });

  it.each(EVENT_TASKS)('requests 16:9 768x432 for %s', async (taskId) => {
    const task = await taskById(taskId);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect([built.width, built.height, built.requestedRatio]).toEqual([768, 432, '16:9']);
  });

  it.each(EVENT_TASKS)('uses an empty negativePrompt for %s', async (taskId) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    expect(built.negativePrompt).toBe('');
    expect(built.sections.avoid).toBe('');
    expect(built.prompt).not.toMatch(/\bAvoid:/i);
  });

  it.each(EVENT_TASKS)('includes only positive event anchors in %s', async (taskId) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    for (const anchor of ANCHORS[taskId]) expect(built.prompt).toContain(anchor);
    expect(built.prompt).not.toMatch(/person|people|human|survivor|soldier|crowd|protester|pedestrian|HUD|interface|game card|status bar|menu/i);
  });

  it.each(EVENT_TASKS)('does not expose task IDs or entity IDs in %s', async (taskId) => {
    const task = await taskById(taskId);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(built.prompt).not.toContain(task.id);
    expect(built.prompt).not.toMatch(new RegExp(`\\b${task.entityId}\\b`, 'i'));
  });

  it.each(EVENT_TASKS)('hashes the final event-positive prompt for %s', async (taskId) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    expect(promptHashInput(built)).toMatchObject({ promptStrategy: 'event-positive-only', prompt: built.prompt, revision: 2 });
    expect(promptHashInput(built).positiveComposition).toEqual(built.task.positiveComposition);
    expect(generationInputHash(built)).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each(EVENT_TASKS)('passes the event prompt audit for %s', async (taskId) => {
    const task = await taskById(taskId);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(auditEventProviderPrompt(task, built.prompt)).toMatchObject({ passed: true, forbiddenTokenCount: 0, internalTaskId: false, internalEntityId: false });
  });

  it.each(EVENT_TASKS)('captures the actual Agnes body for %s', async (taskId) => {
    const { built, body } = await agnesBody(await taskById(taskId));
    expect(body).toMatchObject({ model: 'agnes-image-2.1-flash', size: '1K', ratio: '16:9', return_base64: true });
    expect(String(body.prompt)).toBe(built.prompt);
    expect(String(body.prompt)).not.toMatch(/\n\nAvoid:/i);
  });

  it.each(FORBIDDEN_EVENT_PERSON_TOKENS)('rejects event person token %s', async (token) => {
    const task = await taskById(EVENT_TASKS[0]);
    expect(auditEventProviderPrompt(task, `A civic room containing ${token}.`).forbiddenTokens).toContain(token);
  });

  it.each(FORBIDDEN_EVENT_UI_TOKENS)('rejects event UI token %s', async (token) => {
    const task = await taskById(EVENT_TASKS[0]);
    expect(auditEventProviderPrompt(task, `A civic room with ${token}.`).forbiddenTokens).toContain(token);
  });

  it.each([
    ['world_event/emergency_broadcast/illustration', 'map'],
    ['world_event/emergency_broadcast/illustration', 'coordinates'],
    ['world_event/medical_alert/illustration', 'logo'],
    ['world_event/medical_alert/illustration', 'emblem'],
    ['world_event/research_anomaly/illustration', 'monster'],
    ['world_event/research_anomaly/illustration', 'portal'],
    ['world_event/citywide_unrest/illustration', 'riot'],
    ['world_event/citywide_unrest/illustration', 'explosion'],
  ] as const)('rejects task-specific event pollution %s', async (taskId, token) => {
    const task = await taskById(taskId);
    expect(auditEventProviderPrompt(task, `A valid scene with ${token}.`).forbiddenTokens).toContain(token);
  });

  it('does not stop after zero or one content rejection', () => {
    expect(shouldStopEventE1(0)).toBe(false);
    expect(shouldStopEventE1(1)).toBe(false);
  });

  it('stops after two content rejections among the first three tasks', () => {
    expect(shouldStopEventE1(2)).toBe(true);
    expect(shouldStopEventE1(3)).toBe(true);
  });

  it('classifies a provider content rejection as non-retryable', () => {
    expect(isEventContentRejection(new ArtPipelineError({ category: 'provider', retryable: false, status: 400, message: 'Unable to generate image; please modify your prompt.' }))).toBe(true);
  });

  it('does not classify transient provider errors as content rejection', () => {
    expect(isEventContentRejection(new ArtPipelineError({ category: 'provider', retryable: true, status: 503, message: 'temporary provider failure' }))).toBe(false);
  });

  it('does not classify auth errors as content rejection', () => {
    expect(isEventContentRejection(new ArtPipelineError({ category: 'auth', retryable: false, status: 401, message: 'unauthorized' }))).toBe(false);
  });

  it('does not retry a content rejection and records no candidate before systemic stop', async () => {
    const root = await tempArtRoot();
    const originalFetch = globalThis.fetch;
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { message: 'Unable to generate image; please modify your prompt.' } }), { status: 400 });
    });
    try {
      const config = createArtConfig(root, { IMAGE_API_KEY: 'test-secret' });
      const result = await runEventE1Batch(config, await loadTasks(root));
      expect(calls).toBe(2);
      expect(result.report).toMatchObject({ requested: 4, attempted: 2, generated: 0, apiCalls: 2, stoppedEarly: true });
      expect(result.report.tasks).toHaveLength(2);
      expect(result.report.tasks.every((task) => task.candidateHash === null && task.providerStatus === 'provider_rejected')).toBe(true);
      expect(result.exitCode).toBe(0);
    } finally {
      vi.stubGlobal('fetch', originalFetch);
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
