import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createArtConfig } from '../tools/art/config';
import { generateImage } from '../tools/art/apiClient';
import { contentHash } from '../tools/art/cache';
import {
  auditEnvironmentProviderPrompt,
  auditItemProviderPrompt,
  auditRainProviderPrompt,
  FORBIDDEN_ENVIRONMENT_TOKENS,
  FORBIDDEN_ITEM_CATEGORY_TOKENS,
  FORBIDDEN_RAIN_NARRATIVE_TOKENS,
} from '../tools/art/promptAudit';
import { buildPrompt, promptHashInput } from '../tools/art/promptBuilder';
import { loadTasks } from '../tools/art/taskPlanner';
import type { ArtTask } from '../tools/art/types';

const B2_ZONES = [
  'zone/residential/background',
  'zone/factory/background',
  'zone/forest/background',
  'zone/lab/background',
] as const;

const B2_ITEMS = ['item/water/icon', 'item/energy_drink/icon'] as const;
const B2_TASKS = [...B2_ZONES, ...B2_ITEMS] as const;

async function taskById(id: string): Promise<ArtTask> {
  return (await loadTasks(process.cwd())).find((task) => task.id === id)!;
}

async function providerPrompt(task: ArtTask): Promise<{ built: Awaited<ReturnType<typeof buildPrompt>>; prompt: string }> {
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
  return { built, prompt: String(body.prompt) };
}

describe('Phase 4A-2.3 controlled production expansion contracts', () => {
  it('keeps exactly six B2 tasks in the intended order', async () => {
    expect(B2_TASKS).toEqual([
      'zone/residential/background',
      'zone/factory/background',
      'zone/forest/background',
      'zone/lab/background',
      'item/water/icon',
      'item/energy_drink/icon',
    ]);
    expect((await loadTasks(process.cwd())).filter((task) => (B2_TASKS as readonly string[]).includes(task.id))).toHaveLength(6);
  });

  it.each(B2_ZONES)('assigns %s to environment-positive-only', async (taskId) => {
    expect((await taskById(taskId)).promptStrategy).toBe('environment-positive-only');
  });

  it.each(B2_ITEMS)('assigns %s to item-positive-only', async (taskId) => {
    expect((await taskById(taskId)).promptStrategy).toBe('item-positive-only');
  });

  it.each(B2_TASKS)('keeps %s negativePrompt empty', async (taskId) => {
    expect((await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash')).negativePrompt).toBe('');
  });

  it.each(B2_TASKS)('hashes strategy, revision, style and final prompt for %s', async (taskId) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    const input = promptHashInput(built);
    expect(input.promptStrategy).toBe(built.task.promptStrategy);
    expect(input.revision).toBe(built.task.revision);
    expect(input.styleProfileVersion).toBe(built.styleProfileVersion);
    expect(input.prompt).toBe(built.prompt);
    expect(contentHash(built)).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    ['zone/residential/background', 'quiet vacant residential block', 'open shared courtyard'],
    ['zone/factory/background', 'idle industrial workshop floor', 'inactive powered-down machinery'],
    ['zone/forest/background', 'quiet overgrown woodland trail', 'narrow natural path'],
    ['zone/lab/background', 'inactive research laboratory', 'sealed glass equipment'],
  ] as const)('anchors %s to its positive location identity', async (taskId, identity, anchor) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    expect(built.prompt).toContain(identity);
    expect(built.prompt).toContain(anchor);
    expect(built.prompt).toContain('lower-center');
    expect(built.prompt).not.toMatch(/game UI|HUD|interface|status frame/i);
  });

  it('keeps Residential distinct from School and Hospital', async () => {
    const built = await buildPrompt(process.cwd(), await taskById('zone/residential/background'), 'agnes-image-2.1-flash');
    expect(built.prompt).toContain('apartment entrances');
    expect(built.prompt).not.toMatch(/waiting chairs|medical carts|school corridor|desks/i);
  });

  it('keeps Factory positive semantics free of worker and combat concepts', async () => {
    const built = await buildPrompt(process.cwd(), await taskById('zone/factory/background'), 'agnes-image-2.1-flash');
    expect(built.prompt).toContain('workbenches');
    expect(built.prompt).not.toMatch(/worker|operator|soldier|combat/i);
  });

  it('keeps Forest quiet and natural without creature or danger semantics', async () => {
    const built = await buildPrompt(process.cwd(), await taskById('zone/forest/background'), 'agnes-image-2.1-flash');
    expect(built.prompt).toContain('overgrown woodland trail');
    expect(built.prompt).not.toMatch(/monster|creature|animal attack|danger/i);
  });

  it('keeps Lab distinct from Hospital through research anchors', async () => {
    const built = await buildPrompt(process.cwd(), await taskById('zone/lab/background'), 'agnes-image-2.1-flash');
    expect(built.prompt).toContain('research laboratory');
    expect(built.prompt).toContain('instrument consoles');
    expect(built.prompt).not.toMatch(/waiting chairs|clinical|hospital/i);
  });

  it('keeps Water isolated and recognizable through bottle positives', async () => {
    const built = await buildPrompt(process.cwd(), await taskById('item/water/icon'), 'agnes-image-2.1-flash');
    expect(built.prompt).toContain('sealed transparent drinking-water bottle');
    expect(built.prompt).toContain('clear water');
    expect(built.prompt).toContain('muted-blue cap');
    expect(built.prompt).toContain('plain dark-gray studio backdrop');
  });

  it('keeps Energy Drink generic and brand-independent', async () => {
    const built = await buildPrompt(process.cwd(), await taskById('item/energy_drink/icon'), 'agnes-image-2.1-flash');
    expect(built.prompt).toContain('small energy beverage can');
    expect(built.prompt).toContain('muted charcoal and amber-orange color blocks');
    expect(built.prompt).toContain('clean geometric color panels');
    expect(built.prompt).not.toMatch(/Red Bull|Monster|Rockstar|real logo|brand parody/i);
  });

  it.each(B2_ZONES)('actual Agnes body.prompt for %s has zero environment tokens', async (taskId) => {
    const task = await taskById(taskId);
    const { built, prompt } = await providerPrompt(task);
    expect(prompt).toBe(built.prompt);
    expect(auditEnvironmentProviderPrompt(task, prompt)).toMatchObject({ passed: true, forbiddenTokenCount: 0 });
  });

  it.each(B2_ITEMS)('actual Agnes body.prompt for %s has zero item pollution tokens', async (taskId) => {
    const task = await taskById(taskId);
    const { built, prompt } = await providerPrompt(task);
    expect(prompt).toBe(built.prompt);
    expect(auditItemProviderPrompt(task, prompt)).toMatchObject({ passed: true, forbiddenTokenCount: 0 });
  });

  it('Rain v3 has no negative prompt and no dangerous narrative tokens', async () => {
    const task = await taskById('world_event/rain/illustration');
    const { built, prompt } = await providerPrompt(task);
    expect(built.negativePrompt).toBe('');
    expect(built.prompt).not.toMatch(/abandoned|deserted|disaster|survival|ruins/i);
    expect(auditRainProviderPrompt(task, prompt)).toMatchObject({ passed: true, forbiddenTokenCount: 0 });
    expect(FORBIDDEN_RAIN_NARRATIVE_TOKENS).toContain('disaster');
  });

  it.each(FORBIDDEN_ENVIRONMENT_TOKENS)('B2 environment audit rejects token %s', async (token) => {
    const task = await taskById('zone/residential/background');
    expect(auditEnvironmentProviderPrompt(task, `A ${token} is visible.`).forbiddenTokens).toContain(token);
  });

  it.each(FORBIDDEN_ITEM_CATEGORY_TOKENS)('B2 item audit rejects pollution token %s', async (token) => {
    const task = await taskById('item/water/icon');
    expect(auditItemProviderPrompt(task, `A bottle near a ${token}.`).forbiddenTokens).toContain(token);
  });

  it('keeps all six B2 Manifest slots official after Track A formalization', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8'));
    expect(manifest.zones.residential.background).toBe('/assets/zones/residential/background.png');
    expect(manifest.zones.factory.background).toBe('/assets/zones/factory/background.png');
    expect(manifest.zones.forest.background).toBe('/assets/zones/forest/background.png');
    expect(manifest.zones.lab.background).toBe('/assets/zones/lab/background.png');
    expect(manifest.items.water).toBe('/assets/items/water/icon.png');
    expect(manifest.items.energy_drink).toBe('/assets/items/energy_drink/icon.png');
  });

  it('keeps Rain absent after the prior provider rejection', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8'));
    expect(manifest.worldEvents.rain).toBeUndefined();
  });
});
