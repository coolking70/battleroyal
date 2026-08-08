import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createArtConfig } from '../tools/art/config';
import { contentHash } from '../tools/art/cache';
import { generateImage } from '../tools/art/apiClient';
import {
  auditItemProviderPrompt,
  FORBIDDEN_ITEM_OBJECT_TOKENS,
} from '../tools/art/promptAudit';
import { buildPrompt, promptHashInput } from '../tools/art/promptBuilder';
import { itemProductionPromptPolicyFor } from '../tools/art/promptPolicies';
import { loadTasks } from '../tools/art/taskPlanner';
import type { ArtTask, ItemProductionCategory } from '../tools/art/types';

const B3_TASKS = [
  'item/battery/icon',
  'item/iron/icon',
  'item/wood/icon',
  'item/iron_pipe/icon',
  'item/stone_axe/icon',
  'item/simple_bow/icon',
  'item/simple_armor/icon',
  'item/plate_armor/icon',
] as const;

const CATEGORIES: Record<(typeof B3_TASKS)[number], ItemProductionCategory> = {
  'item/battery/icon': 'material',
  'item/iron/icon': 'material',
  'item/wood/icon': 'material',
  'item/iron_pipe/icon': 'weapon',
  'item/stone_axe/icon': 'weapon',
  'item/simple_bow/icon': 'weapon',
  'item/simple_armor/icon': 'armor',
  'item/plate_armor/icon': 'armor',
};

const ANCHORS: Record<(typeof B3_TASKS)[number], string[]> = {
  'item/battery/icon': ['compact household battery cell', 'visible terminals', 'muted copper accent bands'],
  'item/iron/icon': ['rough rectangular piece of raw iron', 'dark gray metallic surface', 'heavy dense appearance'],
  'item/wood/icon': ['short piece of sturdy cut timber', 'natural brown grain', 'rough cut ends'],
  'item/iron_pipe/icon': ['short heavy iron pipe', 'plain hollow ends', 'open circular openings'],
  'item/stone_axe/icon': ['primitive stone axe', 'chipped stone head', 'short wooden handle'],
  'item/simple_bow/icon': ['simple handmade bow', 'curved wooden limbs', 'basic bowstring'],
  'item/simple_armor/icon': ['simple protective vest', 'layered cloth', 'light protective panels'],
  'item/plate_armor/icon': ['reinforced protective torso armor item', 'simple metal plates', 'dark padded base'],
};

async function taskById(id: string): Promise<ArtTask> {
  return (await loadTasks(process.cwd())).find((task) => task.id === id)!;
}

async function providerPayload(task: ArtTask): Promise<{ built: Awaited<ReturnType<typeof buildPrompt>>; body: Record<string, unknown> }> {
  const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
  const fixture = await fs.readFile(path.join(process.cwd(), 'tests/fixtures/agnes-success-base64.json'), 'utf8');
  const config = createArtConfig(process.cwd(), { IMAGE_API_KEY: 'test-secret' });
  let body: Record<string, unknown> = {};
  await generateImage(config, {
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

describe('Phase 4A-3 Item Production Batch B3 contracts', () => {
  it('uses exactly eight existing item tasks in the required category order', async () => {
    expect(B3_TASKS).toHaveLength(8);
    expect((await loadTasks(process.cwd())).filter((task) => (B3_TASKS as readonly string[]).includes(task.id)).map((task) => task.id)).toEqual(expect.arrayContaining([...B3_TASKS]));
    expect(B3_TASKS.slice(0, 3)).toEqual(['item/battery/icon', 'item/iron/icon', 'item/wood/icon']);
    expect(B3_TASKS.slice(3, 6)).toEqual(['item/iron_pipe/icon', 'item/stone_axe/icon', 'item/simple_bow/icon']);
    expect(B3_TASKS.slice(6)).toEqual(['item/simple_armor/icon', 'item/plate_armor/icon']);
  });

  it.each(B3_TASKS)('keeps %s on item-positive-only', async (taskId) => {
    const task = await taskById(taskId);
    expect(task.promptStrategy).toBe('item-positive-only');
    expect(task.itemProductionCategory).toBe(CATEGORIES[taskId]);
    expect(task.revision).toBe(2);
  });

  it.each(B3_TASKS)('keeps %s negativePrompt empty', async (taskId) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    expect(built.negativePrompt).toBe('');
    expect(built.sections.avoid).toBe('');
  });

  it.each(B3_TASKS)('includes positive identity anchors for %s', async (taskId) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    for (const anchor of ANCHORS[taskId]) expect(built.prompt).toContain(anchor);
    expect(built.prompt).toContain('plain dark-gray studio backdrop');
    expect(built.prompt).toMatch(/single complete (object|equipment item)/);
  });

  it.each(B3_TASKS)('has no scene or UI semantic injection for %s', async (taskId) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    expect(built.prompt).not.toMatch(/environment|scenery|HUD|interface|window|slot|arrows|buttons|game UI|inventory frame/i);
    expect(built.prompt).not.toMatch(/person|people|human|character|survivor|soldier|warrior|wearer|mannequin|battle|combat|fight/i);
  });

  it.each(B3_TASKS)('hashes category and positive prompt contract for %s', async (taskId) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    const input = promptHashInput(built);
    expect(input.itemProductionCategory).toBe(CATEGORIES[taskId]);
    expect(input.promptStrategy).toBe('item-positive-only');
    expect(input.prompt).toBe(built.prompt);
    expect(contentHash(built)).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each(B3_TASKS)('uses the correct category presentation for %s', async (taskId) => {
    const task = await taskById(taskId);
    const policy = itemProductionPromptPolicyFor(task);
    expect(policy.category).toBe(CATEGORIES[taskId]);
    if (policy.category === 'material') expect(policy.presentation).toContain('crafting-material subject');
    if (policy.category === 'weapon') expect(policy.presentation).toContain('weapon alone as an isolated object');
    if (policy.category === 'armor') expect(policy.presentation).toContain('protective equipment item alone');
  });

  it.each(B3_TASKS)('captures the actual Agnes payload for %s without negative or UI pollution', async (taskId) => {
    const task = await taskById(taskId);
    const { built, body } = await providerPayload(task);
    expect(body.model).toBe('agnes-image-2.1-flash');
    expect(body.prompt).toBe(built.prompt);
    expect(body.prompt).not.toMatch(/\bAvoid:/i);
    expect(body.prompt).not.toMatch(/HUD|interface|window|slot|arrows|buttons|game UI|inventory frame/i);
    expect(auditItemProviderPrompt(task, String(body.prompt))).toMatchObject({ passed: true, forbiddenTokenCount: 0 });
  });

  it.each(FORBIDDEN_ITEM_OBJECT_TOKENS)('B3 object audit rejects pollution token %s', async (token) => {
    const task = await taskById('item/iron/icon');
    expect(auditItemProviderPrompt(task, `A single iron object with ${token}.`).forbiddenTokens).toContain(token);
  });

  it('does not formally publish any B3 slot before candidate review', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as { items: Record<string, string | null> };
    for (const taskId of B3_TASKS) expect(manifest.items[taskId.split('/')[1]]).toBeUndefined();
  });

  it('records item category and strategy in the B3 prompt report', async () => {
    const report = await fs.readFile(path.join(process.cwd(), 'reports/phase4-prompts/phase4a3-b3/item__battery__icon.md'), 'utf8');
    expect(report).toContain('- Category: `material`');
    expect(report).toContain('- Strategy: `item-positive-only`');
  });
});
