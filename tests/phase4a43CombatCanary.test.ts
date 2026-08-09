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
import { listCandidates, reviewCandidate } from '../tools/art/reviewer';

const COMBAT_ANCHORS = [
  'adult male-presenting character around 30',
  'short dark ash-brown hair',
  'plain slate-blue outdoor jacket',
  'simple charcoal shirt',
  'plain khaki outdoor trousers',
  'one compact pair of binoculars',
  'one simple neck strap',
  'binoculars hanging naturally at the center of the chest',
  'binoculars resting in their normal hanging position',
  'both hands away from the binoculars',
  'hands empty',
  'small tan-brown civilian side messenger pouch',
  'fully alert and healthy appearance',
  'torso subtly leaning forward',
  'shoulders slightly raised and tense',
  'eyes focused sharply in that direction',
  'left hand raised with an open palm ready to react',
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

async function seedRejectedCombatHistory(root: string): Promise<{ v1: string; v2: string }> {
  const entries = [
    ['80109ee0510cc4132aa26518dfa1d37d59b0ebb4df5daddc57e1a88bb6fed7c1', '2026-08-09T01:09:49.015Z'],
    ['752052e828e7708ebc010457bb9eca11e718a7ec91e18e63dd8b133ad11f6159', '2026-08-09T01:31:52.582Z'],
  ] as const;
  for (const [hash, generatedAt] of entries) {
    const dir = path.join(root, 'art', 'candidates', 'characters', 'scout', 'combat', hash);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${hash}.json`), JSON.stringify({
      taskId: 'character/scout/combat',
      hash,
      contentHash: hash,
      promptHash: hash,
      provider: 'agnes',
      model: 'agnes-image-2.1-flash',
      generatedAt,
      requestedWidth: 768,
      requestedHeight: 1024,
      requestedRatio: '3:4',
      actualWidth: 864,
      actualHeight: 1152,
      prompt: 'old prompt',
      negativePrompt: '',
      styleProfileVersion: 'old',
      mimeType: 'image/png',
      actualMimeType: 'image/png',
      bytes: 1,
      imagePath: `art/candidates/characters/scout/combat/${hash}/${hash}.png`,
      publicPath: '/assets/characters/scout/combat.png',
      validationStatus: 'passed',
      validationErrors: [],
      reviewStatus: 'rejected',
      reviewReason: 'Human review: duplicated binocular prop',
      source: 'api',
    }));
  }
  return { v1: entries[0][0], v2: entries[1][0] };
}

describe('Phase 4A-4.3.2 Scout Combat posture-only canary', () => {
  it('plans exactly one Scout Combat task', async () => {
    const tasks = await loadTasks(process.cwd());
    expect(selectScoutCombatCanary(tasks).map((task) => task.id)).toEqual([SCOUT_COMBAT_CANARY_TASK_ID]);
  });

  it.each(EXCLUDED_PHASE4A43_COMBAT_TASK_IDS)('excludes %s from the Scout Combat canary', async (taskId) => {
    expect(selectScoutCombatCanary(await loadTasks(process.cwd())).some((task) => task.id === taskId)).toBe(false);
  });

  it('keeps all four Combat task definitions planned and Rain work frozen', async () => {
    const tasks = await loadTasks(process.cwd());
    expect(tasks.filter((task) => task.variant === 'combat').map((task) => task.id)).toEqual([
      'character/scout/combat',
      'character/fighter/combat',
      'character/engineer/combat',
      'character/medic/combat',
    ]);
    expect(tasks.filter((task) => task.variant === 'injured')).toHaveLength(4);
    expect(tasks.find((task) => task.id === 'world_event/rain/illustration')).toBeDefined();
  });

  it('uses revision 4 and the posture-only static-prop strategy', async () => {
    const task = await taskById(SCOUT_COMBAT_CANARY_TASK_ID);
    expect(task).toMatchObject({ promptStrategy: 'character-combat-positive-only', revision: 4, singlePropTransition: false, postureOnly: true, signaturePropMode: 'static', handsEmpty: true, providerDescriptor: 'alert civilian urban observer reacting to sudden movement', styleProfile: 'character', status: 'planned' });
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

  it('locks the signature binoculars to a static chest position and separates both hands', async () => {
    const task = await taskById(SCOUT_COMBAT_CANARY_TASK_ID);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(built.prompt).toMatch(/one compact pair of binoculars hangs naturally at the center of his chest/i);
    expect(built.prompt).toContain('binoculars remain resting in their normal hanging position');
    expect(built.prompt).toContain('Both hands are away from the binoculars');
    expect(built.prompt).toContain('His hands are empty');
    expect(built.prompt).not.toMatch(/\b(?:lifted|raised|holds?|holding|uses?|looking through|grabs?|adjusts?|touches?)\s+(?:the\s+)?binoculars\b/i);
  });

  it('does not retain any prop transition language', async () => {
    const task = await taskById(SCOUT_COMBAT_CANARY_TASK_ID);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(auditCombatProviderPrompt(task, built.prompt).propTransitionLanguageCount).toBe(0);
  });

  it('hashes strategy, identity, combat state, composition, revision, style and final prompt', async () => {
    const built = await buildPrompt(process.cwd(), await taskById(SCOUT_COMBAT_CANARY_TASK_ID), 'agnes-image-2.1-flash');
    expect(promptHashInput(built)).toMatchObject({ promptStrategy: 'character-combat-positive-only', positiveTraits: built.task.positiveTraits, positiveComposition: built.task.positiveComposition, postureOnly: true, signaturePropMode: 'static', handsEmpty: true, revision: 4, prompt: built.prompt, styleProfileVersion: built.styleProfileVersion });
    expect(contentHash(built)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('passes the equipment-neutral Combat prompt audit', async () => {
    const task = await taskById(SCOUT_COMBAT_CANARY_TASK_ID);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(auditCombatProviderPrompt(task, built.prompt)).toMatchObject({ passed: true, forbiddenTokenCount: 0, dynamicEquipmentForbiddenTokenCount: 0, militaryForbiddenTokenCount: 0, injuryForbiddenTokenCount: 0, propTransitionLanguageCount: 0, postureOnlyContract: true, handsEmptyContract: true, staticSignaturePropContract: true, internalTaskId: false, internalEntityId: false });
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
    expect(auditCombatProviderPrompt(task, String(body.prompt))).toMatchObject({ passed: true, dynamicEquipmentForbiddenTokenCount: 0, postureOnlyContract: true, handsEmptyContract: true, staticSignaturePropContract: true });
  });

  it('uses the declared dynamic-equipment policy', () => {
    expect(COMBAT_CANARY_STRATEGY).toBe('descriptor-locked-text-only-dynamic-equipment-neutral-posture-only');
    expect(DYNAMIC_EQUIPMENT_POLICY).toMatch(/item\/equipment systems|equipment-neutral/i);
  });

  it('generates exactly one API candidate, keeps it pending and does not publish Combat', async () => {
    const root = await tempArtRoot();
    const history = await seedRejectedCombatHistory(root);
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
      expect(result.report.tasks[0]).toMatchObject({ taskId: SCOUT_COMBAT_CANARY_TASK_ID, v1CandidateHash: history.v1, v1Decision: 'rejected', v2CandidateHash: history.v2, v2Decision: 'rejected', previousPromptHash: history.v2, basePortraitTask: 'character/scout/portrait', injuredTask: 'character/scout/injured', validation: { status: 'passed', actualWidth: 864, actualHeight: 1152 }, review: 'pending', source: 'api', providerStatus: 'generated', dynamicEquipmentPolicy: DYNAMIC_EQUIPMENT_POLICY, postureOnly: true, signaturePropMode: 'static', handsEmpty: true, postureOnlyContract: true, handsEmptyContract: true, staticSignaturePropContract: true });
      expect(result.report.tasks[0]?.promptHash).not.toBe(history.v2);
      const manifest = JSON.parse(await fs.readFile(path.join(root, 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
      expect(manifest.characters.scout).toBeUndefined();
      expect((await fs.readdir(path.join(root, 'reports')))).toContain('phase4a432-scout-combat-posture-only.json');
    } finally {
      vi.stubGlobal('fetch', originalFetch);
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('does not retry a provider content rejection', async () => {
    const root = await tempArtRoot();
    await seedRejectedCombatHistory(root);
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
      expect(result.report.tasks[0]).toMatchObject({ candidateHash: null, review: 'pending', source: 'none', providerStatus: 'provider_rejected', postureOnly: true, handsEmpty: true, postureOnlyContract: true });
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

  it('can formally reject the old Scout Combat candidate without touching other candidates', async () => {
    const root = await tempArtRoot();
    const history = await seedRejectedCombatHistory(root);
    const config = createArtConfig(root, { IMAGE_API_KEY: 'test-secret' });
    await reviewCandidate(config, SCOUT_COMBAT_CANARY_TASK_ID, history.v2, 'rejected', 'Human review: duplicated binocular prop');
    expect((await listCandidates(config)).find((candidate) => candidate.hash === history.v2)?.reviewStatus).toBe('rejected');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('keeps all four Injured and all four Combat visuals official, with formal count at 35', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
    for (const id of ['scout', 'fighter', 'engineer', 'medic']) {
      expect(manifest.characters[id]?.portrait).toBe(`/assets/characters/${id}/portrait.png`);
      expect(manifest.characters[id]?.injured).toBe(`/assets/characters/${id}/injured.png`);
      expect(manifest.characters[id]?.combat).toBe(`/assets/characters/${id}/combat.png`);
    }
    const count = [
      ...Object.values(manifest.characters).flatMap((entry) => Object.values(entry)),
      ...Object.values(manifest.zones).flatMap((entry) => Object.values(entry)),
      ...Object.values(manifest.items),
      ...Object.values(manifest.worldEvents),
    ].filter(Boolean);
    expect(count).toHaveLength(35);
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
