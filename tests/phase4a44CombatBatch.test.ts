import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createArtConfig } from '../tools/art/config';
import { COMBAT_BATCH_TASK_IDS, selectCombatBatch } from '../tools/art/canary';
import { runCombatBatch, COMBAT_PRODUCTION_STRATEGY, DYNAMIC_EQUIPMENT_POLICY } from '../tools/art/combatBatch';
import { contentHash } from '../tools/art/cache';
import { buildPrompt, promptHashInput } from '../tools/art/promptBuilder';
import { auditCombatProviderPrompt } from '../tools/art/promptAudit';
import { loadTasks } from '../tools/art/taskPlanner';
import type { ArtTask } from '../tools/art/types';

const roots: string[] = [];

async function taskById(id: string): Promise<ArtTask> {
  return (await loadTasks(process.cwd())).find((task) => task.id === id)!;
}

async function tempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'battleroyal-phase4a44-'));
  roots.push(root);
  await fs.cp(path.join(process.cwd(), 'art', 'style'), path.join(root, 'art', 'style'), { recursive: true });
  await fs.cp(path.join(process.cwd(), 'art', 'tasks'), path.join(root, 'art', 'tasks'), { recursive: true });
  await fs.mkdir(path.join(root, 'public', 'assets'), { recursive: true });
  await fs.writeFile(path.join(root, 'public', 'assets', 'manifest.json'), JSON.stringify({ version: 1, characters: {}, zones: {}, items: {}, worldEvents: {} }));
  return root;
}

async function successFixture(): Promise<string> {
  return fs.readFile(path.join(process.cwd(), 'tests/fixtures/agnes-success-base64.json'), 'utf8');
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('Phase 4A-4.4 controlled combat batch', () => {
  it('selects exactly Fighter, Engineer, Medic in production order', async () => {
    const selected = selectCombatBatch(await loadTasks(process.cwd()));
    expect(selected.map((task) => task.id)).toEqual([...COMBAT_BATCH_TASK_IDS]);
  });

  it('keeps Scout Combat outside the three-task batch and Rain outside all calls', () => {
    expect(COMBAT_BATCH_TASK_IDS).not.toContain('character/scout/combat');
    expect(COMBAT_BATCH_TASK_IDS.some((taskId) => taskId.includes('rain'))).toBe(false);
  });

  it.each([...COMBAT_BATCH_TASK_IDS])('declares posture-only signature policy for %s', async (taskId) => {
    const task = await taskById(taskId);
    expect(task).toMatchObject({ promptStrategy: 'character-combat-positive-only', postureOnly: true, revision: 4, status: 'planned' });
    expect(['static', 'wearable']).toContain(task.signaturePropMode);
  });

  it('uses the fixed wearable glove-pair policy for Fighter', async () => {
    const task = await taskById('character/fighter/combat');
    expect(task.signaturePropMode).toBe('wearable');
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(built.prompt).toContain('one matched pair of worn training gloves');
    expect(built.prompt).toContain('one glove worn normally on each hand');
    expect(built.prompt).toContain('compact defensive boxing guard');
    expect(built.negativePrompt).toBe('');
  });

  it('keeps Engineer wrench secured and hands away from tools', async () => {
    const built = await buildPrompt(process.cwd(), await taskById('character/engineer/combat'), 'agnes-image-2.1-flash');
    expect(built.prompt).toContain('one compact adjustable wrench remains secured');
    expect(built.prompt).toContain('normal carried position on the tool belt');
    expect(built.prompt).toContain('hands are empty and away from the tools');
    expect(built.prompt).toContain('tools remain static');
  });

  it('keeps Medic pouch closed and hands away from the pouch', async () => {
    const built = await buildPrompt(process.cwd(), await taskById('character/medic/combat'), 'agnes-image-2.1-flash');
    expect(built.prompt).toContain('first-aid pouch remains closed');
    expect(built.prompt).toContain('fixed in its normal position at her waist');
    expect(built.prompt).toContain('hands are empty and away from the pouch');
  });

  it.each([...COMBAT_BATCH_TASK_IDS])('uses positive-only no-injury prompts for %s', async (taskId) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    expect(built.negativePrompt).toBe('');
    expect(built.sections.avoid).toBe('');
    expect(built.prompt).not.toMatch(/\b(?:bandage|dressing|injury|wound|blood|fatigue|fatigued|tired|dust|scuff|treatment|healing)\b/i);
  });

  it.each([...COMBAT_BATCH_TASK_IDS])('passes the full combat prompt audit for %s', async (taskId) => {
    const task = await taskById(taskId);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(auditCombatProviderPrompt(task, built.prompt)).toMatchObject({ passed: true, postureOnlyContract: true, signaturePropContract: true, dynamicEquipmentForbiddenTokenCount: 0, injuryForbiddenTokenCount: 0, militaryForbiddenTokenCount: 0, propTransitionLanguageCount: 0 });
  });

  it('does not classify wearable gloves as dynamic game equipment', async () => {
    const task = await taskById('character/fighter/combat');
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    const audit = auditCombatProviderPrompt(task, built.prompt);
    expect(audit.passed).toBe(true);
    expect(audit.dynamicEquipmentForbiddenTokenCount).toBe(0);
    expect(audit.signaturePropContract).toBe(true);
  });

  it('rejects Engineer holding, repair and reaching transitions', async () => {
    const task = await taskById('character/engineer/combat');
    const result = auditCombatProviderPrompt(task, 'A technician is holding the wrench, repairing equipment and reaching for tools.');
    expect(result.passed).toBe(false);
    expect(result.propTransitionLanguageCount).toBeGreaterThanOrEqual(3);
    expect(result.signaturePropContract).toBe(false);
  });

  it('rejects Medic pouch interaction and treatment language', async () => {
    const task = await taskById('character/medic/combat');
    const result = auditCombatProviderPrompt(task, 'A first-aid worker is opening the pouch and healing treatment begins.');
    expect(result.passed).toBe(false);
    expect(result.propTransitionLanguageCount).toBeGreaterThan(0);
    expect(result.signaturePropContract).toBe(false);
  });

  it('hashes posture and signature mode into each prompt identity', async () => {
    const built = await buildPrompt(process.cwd(), await taskById('character/fighter/combat'), 'agnes-image-2.1-flash');
    expect(promptHashInput(built)).toMatchObject({ postureOnly: true, signaturePropMode: 'wearable', revision: 4, prompt: built.prompt });
    expect(contentHash(built)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('sends three real provider-shaped requests sequentially and leaves all candidates pending', async () => {
    const root = await tempRoot();
    const fixture = await successFixture();
    const calls: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(fixture, { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const result = await runCombatBatch(createArtConfig(root, { IMAGE_API_KEY: 'test-secret' }), await loadTasks(root));
    expect(result.exitCode).toBe(0);
    expect(calls).toHaveLength(3);
    expect(calls.map((body) => String(body.prompt)).map((prompt) => prompt.includes('boxing guard') ? 'fighter' : prompt.includes('tool belt') ? 'engineer' : 'medic')).toEqual(['fighter', 'engineer', 'medic']);
    expect(calls.every((body) => body.model === 'agnes-image-2.1-flash' && body.ratio === '3:4' && !String(body.prompt).includes('\n\nAvoid:'))).toBe(true);
    expect(result.report).toMatchObject({ strategy: COMBAT_PRODUCTION_STRATEGY, requested: 3, attempted: 3, generated: 3, apiCalls: 3, cacheHits: 0, scoutCombatCalls: 0, rainApiCalls: 0, stoppedEarly: false });
    expect(result.report.tasks.map((task) => task.providerStatus)).toEqual(['generated', 'generated', 'generated']);
    expect(result.report.tasks.every((task) => task.review === 'pending' && task.validation.status === 'passed' && task.signaturePropContract)).toBe(true);
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'public/assets/manifest.json'), 'utf8')) as { characters: Record<string, Record<string, string | null>> };
    expect(manifest.characters).toEqual({});
  });

  it('stops before Medic after Fighter and Engineer content rejections', async () => {
    const root = await tempRoot();
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { message: 'content policy: unable to generate this prompt' } }), { status: 400, headers: { 'content-type': 'application/json' } });
    });
    const result = await runCombatBatch(createArtConfig(root, { IMAGE_API_KEY: 'test-secret' }), await loadTasks(root));
    expect(result.exitCode).toBe(0);
    expect(calls).toBe(2);
    expect(result.report).toMatchObject({ attempted: 2, generated: 0, apiCalls: 2, stoppedEarly: true, stopReason: 'Fighter and Engineer were both provider content-rejected; Medic API call was skipped' });
    expect(result.report.tasks.map((task) => task.providerStatus)).toEqual(['provider_rejected', 'provider_rejected', 'skipped_after_stop']);
  });

  it('refuses a rerun when a combat candidate already exists', async () => {
    const root = await tempRoot();
    await fs.mkdir(path.join(root, 'art/candidates/characters/fighter/combat/existing'), { recursive: true });
    await fs.writeFile(path.join(root, 'art/candidates/characters/fighter/combat/existing/existing.json'), JSON.stringify({ taskId: 'character/fighter/combat', hash: 'existing' }));
    await expect(runCombatBatch(createArtConfig(root, { IMAGE_API_KEY: 'test-secret' }), await loadTasks(root))).rejects.toThrow(/refuses reroll/);
  });

  it('reports the locked no-dynamic-equipment policy', async () => {
    expect(DYNAMIC_EQUIPMENT_POLICY).toMatch(/no dynamic game equipment/);
    expect(COMBAT_PRODUCTION_STRATEGY).toContain('posture-only');
  });
});
