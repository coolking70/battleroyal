import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createArtConfig } from '../tools/art/config';
import { contentHash } from '../tools/art/cache';
import { runScoutCombatCanary, COMBAT_CANARY_STRATEGY, DYNAMIC_EQUIPMENT_POLICY, isCombatContentRejection } from '../tools/art/combatCanary';
import { SCOUT_COMBAT_CANARY_TASK_ID, EXCLUDED_PHASE4A43_COMBAT_TASK_IDS, selectScoutCombatCanary } from '../tools/art/canary';
import { generateImage } from '../tools/art/apiClient';
import { auditCombatProviderPrompt, FORBIDDEN_CHARACTER_TOKENS, FORBIDDEN_COMBAT_DYNAMIC_EQUIPMENT_TOKENS } from '../tools/art/promptAudit';
import { buildPrompt, promptHashInput } from '../tools/art/promptBuilder';
import { loadTasks } from '../tools/art/taskPlanner';
import { getCharacterVisual, setAssetManifest, type AssetManifest } from '../src/ui/visualAssets';
import { ArtPipelineError, type ArtTask } from '../tools/art/types';

const COMBAT_ANCHORS = [
  'adult male-presenting character around 30',
  'short dark ash-brown hair',
  'plain slate-blue outdoor jacket',
  'simple charcoal shirt',
  'plain khaki outdoor trousers',
  'compact binoculars',
  'simple neck strap',
  'small civilian side messenger pouch',
  'fully alert and healthy appearance',
  'slightly forward-leaning body',
  'subtly raised shoulders',
  'eyes focused sharply toward something outside the frame',
  'one hand steadying binoculars close to the chest',
  'other hand open and ready to move',
  'intact clothing',
];

async function taskById(id: string): Promise<ArtTask> {
  return (await loadTasks(process.cwd())).find((task) => task.id === id)!;
}

async function tempArtRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'battleroyal-phase4a43-'));
  await fs.cp(path.join(process.cwd(), 'art', 'style'), path.join(root, 'art', 'style'), { recursive: true });
  await fs.cp(path.join(process.cwd(), 'art', 'tasks'), path.join(root, 'art', 'tasks'), { recursive: true });
  await fs.mkdir(path.join(root, 'public', 'assets'), { recursive: true });
  await fs.writeFile(path.join(root, 'public', 'assets', 'manifest.json'), JSON.stringify({ version: 1, characters: {}, zones: {}, items: {}, worldEvents: {} }));
  return root;
}

describe('Phase 4A-4.3 Scout Combat equipment-neutral canary', () => {
  it('plans exactly one Scout Combat task', async () => {
    const tasks = await loadTasks(process.cwd());
    expect(selectScoutCombatCanary(tasks).map((task) => task.id)).toEqual([SCOUT_COMBAT_CANARY_TASK_ID]);
  });

  it.each(EXCLUDED_PHASE4A43_COMBAT_TASK_IDS)('excludes %s from the Scout Combat canary', async (taskId) => {
    expect(selectScoutCombatCanary(await loadTasks(process.cwd())).some((task) => task.id === taskId)).toBe(false);
  });

  it('keeps every other Combat task absent and all Injured/Rain work frozen', async () => {
    const tasks = await loadTasks(process.cwd());
    expect(tasks.filter((task) => task.variant === 'combat').map((task) => task.id)).toEqual([SCOUT_COMBAT_CANARY_TASK_ID]);
    expect(tasks.filter((task) => task.variant === 'injured')).toHaveLength(4);
    expect(tasks.find((task) => task.id === 'world_event/rain/illustration')).toBeDefined();
  });

  it('uses revision 2 and the equipment-neutral combat strategy', async () => {
    const task = await taskById(SCOUT_COMBAT_CANARY_TASK_ID);
    expect(task).toMatchObject({ promptStrategy: 'character-combat-positive-only', revision: 2, providerDescriptor: 'alert civilian urban observer in a tense active stance', styleProfile: 'character', status: 'planned' });
  });

  it('uses the approved portrait and Injured task as identity sources', async () => {
    const tasks = await loadTasks(process.cwd());
    expect(tasks.find((task) => task.id === 'character/scout/portrait')?.revision).toBe(3);
    expect(tasks.find((task) => task.id === 'character/scout/injured')?.revision).toBe(2);
    expect(tasks.find((task) => task.id === SCOUT_COMBAT_CANARY_TASK_ID)?.entityId).toBe('scout');
  });

  it.each(COMBAT_ANCHORS)('locks Scout Combat identity/state anchor: %s', async (anchor) => {
    const built = await buildPrompt(process.cwd(), await taskById(SCOUT_COMBAT_CANARY_TASK_ID), 'agnes-image-2.1-flash');
    expect(built.prompt).toContain(anchor);
  });

  it('keeps Combat positive-only and free of injured state', async () => {
    const built = await buildPrompt(process.cwd(), await taskById(SCOUT_COMBAT_CANARY_TASK_ID), 'agnes-image-2.1-flash');
    expect(built.negativePrompt).toBe('');
    expect(built.sections.avoid).toBe('');
    expect(built.prompt).not.toMatch(/\bbandage\b|\bdressing\b|\binjur\w*\b|\bblood\b|\bwound\b|\bfatigue\w*\b|\bdust\b|\bscuff\w*\b|\btired\b|\bstrained\b/i);
  });

  it('does not expose Combat task/entity IDs or combat/reference claims', async () => {
    const task = await taskById(SCOUT_COMBAT_CANARY_TASK_ID);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(built.prompt).not.toContain(task.id);
    expect(built.prompt).not.toMatch(/\bscout\b/i);
    expect(built.prompt).not.toMatch(/\bcombat\b|same character|same portrait|previous image|reference image|img2img/i);
  });

  it('uses dynamic posture rather than a fixed equipment visual', async () => {
    const built = await buildPrompt(process.cwd(), await taskById(SCOUT_COMBAT_CANARY_TASK_ID), 'agnes-image-2.1-flash');
    expect(built.prompt).toMatch(/forward-leaning|raised shoulders|focused sharply|open and ready|natural motion|active movement/i);
    expect(built.prompt).not.toMatch(/weapon slot|inventory|armor|equipment loadout|\bfixed equipment\b/i);
  });

  it('hashes strategy, identity, combat state, composition, revision, style and final prompt', async () => {
    const built = await buildPrompt(process.cwd(), await taskById(SCOUT_COMBAT_CANARY_TASK_ID), 'agnes-image-2.1-flash');
    expect(promptHashInput(built)).toMatchObject({ promptStrategy: 'character-combat-positive-only', positiveTraits: built.task.positiveTraits, positiveComposition: built.task.positiveComposition, revision: 2, prompt: built.prompt, styleProfileVersion: built.styleProfileVersion });
    expect(contentHash(built)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('passes the equipment-neutral Combat prompt audit', async () => {
    const task = await taskById(SCOUT_COMBAT_CANARY_TASK_ID);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(auditCombatProviderPrompt(task, built.prompt)).toMatchObject({ passed: true, forbiddenTokenCount: 0, dynamicEquipmentForbiddenTokenCount: 0, internalTaskId: false, internalEntityId: false });
  });

  it.each(FORBIDDEN_COMBAT_DYNAMIC_EQUIPMENT_TOKENS)('rejects dynamic equipment token %s', async (token) => {
    const task = await taskById(SCOUT_COMBAT_CANARY_TASK_ID);
    const result = auditCombatProviderPrompt(task, `A civilian active portrait with ${token}.`);
    expect(result.dynamicEquipmentForbiddenTokenCount).toBeGreaterThan(0);
    expect(result.forbiddenTokens).toContain(token);
  });

  it.each(FORBIDDEN_CHARACTER_TOKENS)('rejects character forbidden token in Combat prompt %s', async (token) => {
    const task = await taskById(SCOUT_COMBAT_CANARY_TASK_ID);
    expect(auditCombatProviderPrompt(task, `A civilian observer with ${token}.`).forbiddenTokens).toContain(token);
  });

  it('captures the actual Agnes Combat body with no negative suffix', async () => {
    const task = await taskById(SCOUT_COMBAT_CANARY_TASK_ID);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    const fixture = await fs.readFile(path.join(process.cwd(), 'tests/fixtures/agnes-success-base64.json'), 'utf8');
    let body: Record<string, unknown> = {};
    await generateImage(createArtConfig(process.cwd(), { IMAGE_API_KEY: 'test-secret' }), { model: built.model, prompt: built.prompt, negativePrompt: built.negativePrompt, width: built.width, height: built.height, requestedRatio: built.requestedRatio }, async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(fixture, { status: 200, headers: { 'content-type': 'application/json' } });
    });
    expect(body).toMatchObject({ model: 'agnes-image-2.1-flash', size: '1K', ratio: '3:4', return_base64: true });
    expect(body.prompt).toBe(built.prompt);
    expect(String(body.prompt)).not.toMatch(/\n\nAvoid:/i);
    expect(auditCombatProviderPrompt(task, String(body.prompt))).toMatchObject({ passed: true, dynamicEquipmentForbiddenTokenCount: 0 });
  });

  it('uses the declared dynamic-equipment policy', () => {
    expect(COMBAT_CANARY_STRATEGY).toBe('descriptor-locked-text-only-dynamic-equipment-neutral');
    expect(DYNAMIC_EQUIPMENT_POLICY).toMatch(/item\/equipment systems|equipment-neutral/i);
  });

  it('generates exactly one API candidate, keeps it pending and does not publish Combat', async () => {
    const root = await tempArtRoot();
    const originalFetch = globalThis.fetch;
    const fixture = await fs.readFile(path.join(process.cwd(), 'tests/fixtures/agnes-success-base64.json'), 'utf8');
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      return new Response(fixture, { status: 200, headers: { 'content-type': 'application/json' } });
    });
    try {
      const result = await runScoutCombatCanary(createArtConfig(root, { IMAGE_API_KEY: 'test-secret' }), await loadTasks(root));
      expect(calls).toBe(1);
      expect(result.exitCode).toBe(0);
      expect(result.report).toMatchObject({ strategy: COMBAT_CANARY_STRATEGY, requested: 1, attempted: 1, generated: 1, apiCalls: 1, cacheHits: 0, rainApiCalls: 0, otherCombatCalls: 0 });
      expect(result.report.tasks[0]).toMatchObject({ taskId: SCOUT_COMBAT_CANARY_TASK_ID, basePortraitTask: 'character/scout/portrait', injuredTask: 'character/scout/injured', validation: { status: 'passed', actualWidth: 864, actualHeight: 1152 }, review: 'pending', source: 'api', providerStatus: 'generated', dynamicEquipmentPolicy: DYNAMIC_EQUIPMENT_POLICY });
      const manifest = JSON.parse(await fs.readFile(path.join(root, 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
      expect(manifest.characters.scout).toBeUndefined();
      expect((await fs.readdir(path.join(root, 'reports')))).toContain('phase4a43-scout-combat-canary.json');
    } finally {
      vi.stubGlobal('fetch', originalFetch);
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('does not retry a provider content rejection', async () => {
    const root = await tempArtRoot();
    const originalFetch = globalThis.fetch;
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { message: 'Unable to generate image; please modify your prompt.' } }), { status: 400 });
    });
    try {
      const result = await runScoutCombatCanary(createArtConfig(root, { IMAGE_API_KEY: 'test-secret' }), await loadTasks(root));
      expect(calls).toBe(1);
      expect(result.exitCode).toBe(0);
      expect(result.report).toMatchObject({ requested: 1, attempted: 1, generated: 0, apiCalls: 1, cacheHits: 0, rainApiCalls: 0, otherCombatCalls: 0 });
      expect(result.report.tasks[0]).toMatchObject({ candidateHash: null, review: 'pending', source: 'none', providerStatus: 'provider_rejected' });
    } finally {
      vi.stubGlobal('fetch', originalFetch);
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('classifies content rejection and blocks forced rerolls', async () => {
    expect(isCombatContentRejection(new ArtPipelineError({ category: 'provider', retryable: false, message: 'Unable to generate image; please modify your prompt.' }))).toBe(true);
    expect(isCombatContentRejection(new ArtPipelineError({ category: 'provider', retryable: true, status: 503, message: 'temporary provider failure' }))).toBe(false);
    const root = await tempArtRoot();
    try {
      await expect(runScoutCombatCanary(createArtConfig(root, { IMAGE_API_KEY: 'test-secret' }), await loadTasks(root), { force: true })).rejects.toThrow('rerolls are prohibited');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('keeps all four Injured official, all Combat slots null, and formal count at 31', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
    for (const id of ['scout', 'fighter', 'engineer', 'medic']) {
      expect(manifest.characters[id]?.portrait).toBe(`/assets/characters/${id}/portrait.png`);
      expect(manifest.characters[id]?.injured).toBe(`/assets/characters/${id}/injured.png`);
      expect(manifest.characters[id]?.combat).toBeNull();
    }
    const count = [
      ...Object.values(manifest.characters).flatMap((entry) => Object.values(entry)),
      ...Object.values(manifest.zones).flatMap((entry) => Object.values(entry)),
      ...Object.values(manifest.items),
      ...Object.values(manifest.worldEvents),
    ].filter(Boolean);
    expect(count).toHaveLength(31);
  });

  it('uses SVG fallback when an Injured official path is unavailable', () => {
    setAssetManifest({ version: 1, characters: { fighter: { portrait: '/assets/characters/fighter/portrait.png', injured: 'https://invalid.example/fighter-injured.png', combat: null } }, zones: {}, items: {}, worldEvents: {} });
    try {
      expect(getCharacterVisual('fighter', 'injured')).toMatchObject({ source: 'svg', image: 'characters/fighter.svg' });
    } finally {
      setAssetManifest(null);
    }
  });
});
