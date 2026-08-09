import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createArtConfig } from '../tools/art/config';
import { generateImage } from '../tools/art/apiClient';
import {
  auditEnvironmentProviderPrompt,
  auditItemProviderPrompt,
  FORBIDDEN_ENVIRONMENT_TOKENS,
  FORBIDDEN_ITEM_MARKING_TOKENS,
} from '../tools/art/promptAudit';
import { contentHash } from '../tools/art/cache';
import { buildPrompt, promptHashInput } from '../tools/art/promptBuilder';
import { loadTasks } from '../tools/art/taskPlanner';
import type { ArtTask } from '../tools/art/types';

const RECOVERY_TASKS = [
  'zone/hospital/background',
  'item/medkit/icon',
  'world_event/rain/illustration',
] as const;

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

describe('Phase 4A-2.2 positive-only recovery contracts', () => {
  it.each([
    ['zone/hospital/background', 'environment-positive-only'],
    ['world_event/rain/illustration', 'environment-positive-only'],
    ['item/medkit/icon', 'item-positive-only-unmarked'],
  ] as const)('assigns %s to the intended strategy', async (taskId, strategy) => {
    expect((await taskById(taskId)).promptStrategy).toBe(strategy);
  });

  it('increments Hospital and Medkit to revision 2', async () => {
    expect((await taskById('zone/hospital/background')).revision).toBe(2);
    expect((await taskById('item/medkit/icon')).revision).toBe(2);
  });

  it('increments Rain to revision 3 for provider-safe recovery', async () => {
    expect((await taskById('world_event/rain/illustration')).revision).toBe(3);
  });

  it.each(RECOVERY_TASKS)('keeps %s negativePrompt empty', async (taskId) => {
    expect((await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash')).negativePrompt).toBe('');
  });

  it.each(RECOVERY_TASKS)('does not emit an Avoid section for %s', async (taskId) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    expect(built.sections.avoid).toBe('');
    expect(built.prompt).not.toMatch(/\n\nAvoid:/i);
  });

  it('makes Hospital read through vacant waiting-room anchors', async () => {
    const built = await buildPrompt(process.cwd(), await taskById('zone/hospital/background'), 'agnes-image-2.1-flash');
    expect(built.prompt).toContain('vacant medical waiting hall');
    expect(built.prompt).toContain('completely empty waiting chairs');
    expect(built.prompt).toContain('unattended diagnostic machines');
    expect(built.prompt).toContain('closed reception windows');
  });

  it('makes Rain v3 read through ordinary city and weather anchors', async () => {
    const built = await buildPrompt(process.cwd(), await taskById('world_event/rain/illustration'), 'agnes-image-2.1-flash');
    expect(built.prompt).toContain('quiet city street during heavy summer rain');
    expect(built.prompt).toContain('sidewalks empty');
    expect(built.prompt).toContain('heavy summer rainstorm');
    expect(built.prompt).toContain('large puddles');
    expect(built.prompt).not.toMatch(/abandoned|deserted|disaster|survival|ruins/i);
  });

  it('makes Medkit read through a plain off-white and green emergency case', async () => {
    const built = await buildPrompt(process.cwd(), await taskById('item/medkit/icon'), 'agnes-image-2.1-flash');
    expect(built.prompt).toContain('portable emergency supply case');
    expect(built.prompt).toContain('off-white hard shell');
    expect(built.prompt).toContain('muted green accent panels');
    expect(built.prompt).toContain('plain blank front surfaces');
  });

  it.each(RECOVERY_TASKS)('includes strategy, traits, composition and final prompt in %s hash input', async (taskId) => {
    const built = await buildPrompt(process.cwd(), await taskById(taskId), 'agnes-image-2.1-flash');
    const input = promptHashInput(built);
    expect(input.promptStrategy).toBe(built.task.promptStrategy);
    expect(input.positiveTraits).toEqual(built.task.positiveTraits);
    if (taskId === 'item/medkit/icon') expect(input.positiveComposition).toBeUndefined();
    else expect(input.positiveComposition).toEqual(built.task.positiveComposition);
    expect(input.revision).toBe(taskId === 'world_event/rain/illustration' ? 3 : 2);
    expect(input.styleProfileVersion).toBe(built.styleProfileVersion);
    expect(input.prompt).toBe(built.prompt);
  });

  it.each(RECOVERY_TASKS)('produces a new cache hash for %s', async (taskId) => {
    const task = await taskById(taskId);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(contentHash(built)).not.toBe(taskId === 'zone/hospital/background'
      ? '80d603bfd8124a44919ffc590313448511686c51f2648850527c71e8268e9354'
      : taskId === 'item/medkit/icon'
        ? 'c52f6ec3dd935448b766a090fe32513d6c6b5a9bde3710dee101edb087e09108'
        : '5804105a6f017924222fa112126db9fc8d482dd0707ef0141c0ea09da0f83313');
  });

  it('changes the Hospital hash when a positive scene trait changes', async () => {
    const task = await taskById('zone/hospital/background');
    const original = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    const revised = await buildPrompt(process.cwd(), { ...task, positiveTraits: [...(task.positiveTraits ?? []), 'aged tiled floor'] }, 'agnes-image-2.1-flash');
    expect(contentHash(revised)).not.toBe(contentHash(original));
  });

  it('changes the Medkit hash when the task revision changes', async () => {
    const task = await taskById('item/medkit/icon');
    const original = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    const revised = await buildPrompt(process.cwd(), { ...task, revision: 3 }, 'agnes-image-2.1-flash');
    expect(contentHash(revised)).not.toBe(contentHash(original));
  });

  it.each(RECOVERY_TASKS)('sends an Agnes payload with no synthetic negative suffix for %s', async (taskId) => {
    const { built, prompt } = await providerPrompt(await taskById(taskId));
    expect(prompt).toBe(built.prompt);
    expect(prompt).not.toContain('\n\nAvoid:');
  });

  it.each(['zone/hospital/background', 'world_event/rain/illustration'] as const)('actual Agnes %s payload has zero environment-forbidden tokens', async (taskId) => {
    const task = await taskById(taskId);
    const { prompt } = await providerPrompt(task);
    expect(auditEnvironmentProviderPrompt(task, prompt)).toMatchObject({ passed: true, forbiddenTokenCount: 0, forbiddenTokens: [] });
  });

  it('actual Agnes Medkit payload has zero protected-marking tokens', async () => {
    const task = await taskById('item/medkit/icon');
    const { prompt } = await providerPrompt(task);
    expect(auditItemProviderPrompt(task, prompt)).toMatchObject({ passed: true, forbiddenTokenCount: 0, forbiddenTokens: [] });
  });

  it.each(FORBIDDEN_ENVIRONMENT_TOKENS)('environment audit catches forbidden token %s', async (token) => {
    const task = await taskById('zone/hospital/background');
    expect(auditEnvironmentProviderPrompt(task, `A ${token} appears in the scene.`).forbiddenTokens).toContain(token);
  });

  it.each(FORBIDDEN_ITEM_MARKING_TOKENS)('Medkit audit catches protected marking token %s', async (token) => {
    const task = await taskById('item/medkit/icon');
    expect(auditItemProviderPrompt(task, `A case with a ${token}.`).forbiddenTokens).toContain(token);
  });

  it('keeps the formal manifest at thirty-one AI tasks after all Injured publication', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as {
      characters: Record<string, Record<string, string | null>>;
      zones: Record<string, Record<string, string | null>>;
      items: Record<string, string | null>;
      worldEvents: Record<string, string | null>;
    };
    const count = [
      ...Object.values(manifest.characters).flatMap((entry) => Object.values(entry)),
      ...Object.values(manifest.zones).flatMap((entry) => Object.values(entry)),
      ...Object.values(manifest.items),
      ...Object.values(manifest.worldEvents),
    ].filter(Boolean).length;
    expect(count).toBe(31);
    expect(manifest.zones.hospital?.background).toBe('/assets/zones/hospital/background.png');
    expect(manifest.zones.residential?.background).toBe('/assets/zones/residential/background.png');
    expect(manifest.zones.factory?.background).toBe('/assets/zones/factory/background.png');
    expect(manifest.zones.forest?.background).toBe('/assets/zones/forest/background.png');
    expect(manifest.zones.lab?.background).toBe('/assets/zones/lab/background.png');
    expect(manifest.items.medkit).toBe('/assets/items/medkit/icon.png');
    expect(manifest.items.water).toBe('/assets/items/water/icon.png');
    expect(manifest.items.energy_drink).toBe('/assets/items/energy_drink/icon.png');
    expect(manifest.items.battery).toBe('/assets/items/battery/icon.png');
    expect(manifest.items.iron).toBe('/assets/items/iron/icon.png');
    expect(manifest.items.wood).toBe('/assets/items/wood/icon.png');
    expect(manifest.items.iron_pipe).toBe('/assets/items/iron_pipe/icon.png');
    expect(manifest.items.stone_axe).toBe('/assets/items/stone_axe/icon.png');
    expect(manifest.items.simple_bow).toBe('/assets/items/simple_bow/icon.png');
    expect(manifest.items.simple_armor).toBe('/assets/items/simple_armor/icon.png');
    expect(manifest.items.plate_armor).toBe('/assets/items/plate_armor/icon.png');
  });

  it.each([
    ['zone/hospital/background', 'Human review: multiple visible people violate the empty environment requirement.'],
    ['item/medkit/icon', 'Human review: prominent protected medical-cross markings make the asset unsuitable for formal publication.'],
    ['world_event/rain/illustration', 'Human review: a prominent visible person violates the environment-only event composition.'],
  ] as const)('records the formal rejection reason for %s', async (taskId, reason) => {
    const evidence = await fs.readFile(path.join(process.cwd(), 'reports/phase4a22-command-results.txt'), 'utf8');
    expect(evidence).toContain(`SUMMARY: rejected old ${taskId === 'zone/hospital/background' ? 'Hospital' : taskId === 'item/medkit/icon' ? 'Medkit' : 'Rain'} candidate`);
    expect(evidence).toContain(reason);
  });

  it.each([
    ['character/fighter/portrait', '33b377a42b0a9a827fed7d3c8701dbe40e70893bc517a6500090a0e1febf8218'],
    ['character/engineer/portrait', '12989865f752e70e7716b2881c3bfa5dbe5546a9c0ec7694705b38be30101979'],
    ['character/medic/portrait', '6a1d891c1597e51d3ea26cab3c63a514994a4ed3d026f3f5f5e675a47eb8ec59'],
  ] as const)('keeps the approved character provenance for %s', async (taskId, hash) => {
    const provenance = JSON.parse(await fs.readFile(path.join(process.cwd(), 'art/approved-assets.json'), 'utf8')) as { assets: Record<string, { candidateHash: string }> };
    expect(provenance.assets[taskId]?.candidateHash).toBe(hash);
  });

  it.each(['fighter', 'engineer', 'medic'] as const)('has an official runtime visual for %s', async (id) => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8'));
    expect(manifest.characters[id].portrait).toBe(`/assets/characters/${id}/portrait.png`);
  });

  it('does not formally publish Rain without a candidate', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8'));
    expect(manifest.worldEvents.rain).toBeUndefined();
  });
});
