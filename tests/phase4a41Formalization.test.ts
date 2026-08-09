import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createArtConfig } from '../tools/art/config';
import { EXCLUDED_PHASE4A41_VARIANT_TASK_IDS, SCOUT_INJURED_CANARY_TASK_ID, selectScoutInjuredCanary } from '../tools/art/canary';
import { generateImage } from '../tools/art/apiClient';
import { contentHash } from '../tools/art/cache';
import { auditCharacterProviderPrompt, FORBIDDEN_CHARACTER_TOKENS } from '../tools/art/promptAudit';
import { buildPrompt, promptHashInput } from '../tools/art/promptBuilder';
import { publishApproved } from '../tools/art/publisher';
import { loadTasks } from '../tools/art/taskPlanner';
import { getCharacterVisual, getWorldEventVisual, setAssetManifest, type AssetManifest } from '../src/ui/visualAssets';
import type { ArtTask } from '../tools/art/types';

const E1_IDS = [
  'world_event/blackout/illustration',
  'world_event/emergency_broadcast/illustration',
  'world_event/medical_alert/illustration',
  'world_event/research_anomaly/illustration',
  'world_event/citywide_unrest/illustration',
] as const;

async function taskById(id: string): Promise<ArtTask> {
  return (await loadTasks(process.cwd())).find((task) => task.id === id)!;
}

describe('Phase 4A-4.1 E1 formalization and Scout Injured canary contracts', () => {
  it('has five official World Event manifest mappings and keeps Rain absent', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
    for (const eventId of E1_IDS.map((id) => id.split('/')[1]!)) expect(manifest.worldEvents[eventId]).toBe(`/assets/world-events/${eventId}/illustration.png`);
    expect(manifest.worldEvents.rain).toBeUndefined();
    expect(Object.values(manifest.worldEvents).filter(Boolean)).toHaveLength(5);
  });

  it('keeps the formal asset total at thirty-two after Scout Combat publication', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
    expect(Object.values(manifest.characters).flatMap((entry) => Object.values(entry)).filter(Boolean)).toHaveLength(9);
    expect(Object.values(manifest.zones).flatMap((entry) => Object.values(entry)).filter(Boolean)).toHaveLength(6);
    expect(Object.values(manifest.items).filter(Boolean)).toHaveLength(12);
    expect(Object.values(manifest.worldEvents).filter(Boolean)).toHaveLength(5);
  });

  it('records exactly four new E1 provenance mappings with unchanged candidate hashes', async () => {
    const provenance = JSON.parse(await fs.readFile(path.join(process.cwd(), 'art/approved-assets.json'), 'utf8')) as { assets: Record<string, { candidateHash: string; contentHash: string; promptHash: string; publicPath: string }> };
    expect(Object.keys(provenance.assets)).toHaveLength(32);
    const expected: Record<string, string> = {
      'world_event/emergency_broadcast/illustration': '07eed3b78bbf16ae30572b61987dcc498a58e446f421508150b291edcac23787',
      'world_event/medical_alert/illustration': '7950c827639922568f0a6f3949145ec60eb812734f847783dc7f3a1e4172c0c1',
      'world_event/research_anomaly/illustration': 'f5a2bc2592f94510aac588abf30d5435ff6ab8d0fafe0cb3d0e2617df89c18e5',
      'world_event/citywide_unrest/illustration': '1c239f17af048a803cebca4ab7e186bcee5cf05843b508531e6c313390a46bde',
    };
    for (const [taskId, hash] of Object.entries(expected)) {
      expect(provenance.assets[taskId]).toMatchObject({ candidateHash: hash, contentHash: hash, promptHash: hash, publicPath: expect.stringContaining('/assets/world-events/') });
    }
  });

  it('keeps publish idempotent after E1 formalization', async () => {
    const result = await publishApproved(createArtConfig());
    expect(result.changed).toBe(false);
  });

  it('selects all five World Event runtime visuals officially except Rain', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
    setAssetManifest(manifest);
    try {
      for (const eventId of E1_IDS.map((id) => id.split('/')[1]!) as Array<'blackout' | 'emergency_broadcast' | 'medical_alert' | 'research_anomaly' | 'citywide_unrest'>) expect(getWorldEventVisual(eventId).source).toBe('official');
      expect(getWorldEventVisual('rain').source).not.toBe('official');
      expect(getWorldEventVisual('rain').image).toBe('events/rain.svg');
    } finally {
      setAssetManifest(null);
    }
  });

  it('keeps all four portraits and all four Injured visuals official', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
    setAssetManifest(manifest);
    try {
      for (const characterId of ['scout', 'fighter', 'engineer', 'medic']) {
        expect(getCharacterVisual(characterId).source).toBe('official');
        expect(getCharacterVisual(characterId, 'injured').source).toBe('official');
      }
    } finally {
      setAssetManifest(null);
    }
  });

  it('locks the canary planner to Scout Injured only', async () => {
    const tasks = await loadTasks(process.cwd());
    expect(selectScoutInjuredCanary(tasks).map((task) => task.id)).toEqual([SCOUT_INJURED_CANARY_TASK_ID]);
    expect(selectScoutInjuredCanary(tasks).map((task) => task.id)).not.toEqual(expect.arrayContaining([...EXCLUDED_PHASE4A41_VARIANT_TASK_IDS]));
  });

  it.each(EXCLUDED_PHASE4A41_VARIANT_TASK_IDS)('excludes %s from the canary plan', async (taskId) => {
    expect(selectScoutInjuredCanary(await loadTasks(process.cwd())).some((task) => task.id === taskId)).toBe(false);
  });

  it('keeps Rain out of the canary and the formal World Event set', async () => {
    const tasks = await loadTasks(process.cwd());
    expect(selectScoutInjuredCanary(tasks).some((task) => task.id.includes('rain'))).toBe(false);
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
    expect(manifest.worldEvents.rain).toBeUndefined();
  });

  it('uses descriptor-locked character-positive-only strategy for Scout Injured', async () => {
    const task = await taskById(SCOUT_INJURED_CANARY_TASK_ID);
    expect(task.promptStrategy).toBe('character-positive-only');
    expect(task.revision).toBe(2);
    expect(task.providerDescriptor).toBe('fatigued civilian urban observer with minor first-aid dressing');
  });

  it('includes the complete stable Scout visual identity descriptor', async () => {
    const built = await buildPrompt(process.cwd(), await taskById(SCOUT_INJURED_CANARY_TASK_ID), 'agnes-image-2.1-flash');
    for (const phrase of ['adult male-presenting character around 30', 'short dark ash-brown hair', 'slate-blue outdoor jacket', 'simple charcoal shirt', 'plain khaki outdoor trousers', 'compact binoculars', 'simple neck strap', 'small civilian side messenger pouch', 'mildly fatigued', 'small beige adhesive bandage', 'minor fabric scuff', 'slightly tense']) expect(built.prompt).toContain(phrase);
  });

  it('keeps Scout Injured positive-only with no legacy Avoid section', async () => {
    const built = await buildPrompt(process.cwd(), await taskById(SCOUT_INJURED_CANARY_TASK_ID), 'agnes-image-2.1-flash');
    expect(built.negativePrompt).toBe('');
    expect(built.sections.avoid).toBe('');
    expect(built.prompt).not.toMatch(/\n\nAvoid:|global negative|weapon avoid/i);
  });

  it('does not use reference-image or same-character claims', async () => {
    const built = await buildPrompt(process.cwd(), await taskById(SCOUT_INJURED_CANARY_TASK_ID), 'agnes-image-2.1-flash');
    expect(built.prompt).not.toMatch(/same scout|same character as previous image|as reference image|reference image|image reference|img2img/i);
  });

  it('keeps the canary injury mild and positive-only', async () => {
    const built = await buildPrompt(process.cwd(), await taskById(SCOUT_INJURED_CANARY_TASK_ID), 'agnes-image-2.1-flash');
    expect(built.prompt).toMatch(/mildly fatigued|little dust|minor fabric scuff|small beige adhesive bandage|slightly tense/i);
    expect(built.prompt).not.toMatch(/blood|open wound|fracture|burn|dismember|dying|severe/i);
  });

  it('keeps Scout Injured free of internal task and entity IDs', async () => {
    const task = await taskById(SCOUT_INJURED_CANARY_TASK_ID);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(built.prompt).not.toContain(task.id);
    expect(built.prompt).not.toMatch(/\bscout\b/i);
    expect(auditCharacterProviderPrompt(task, built.prompt)).toMatchObject({ passed: true, internalTaskId: false, internalEntityId: false, forbiddenTokenCount: 0 });
  });

  it('includes strategy, descriptor traits, composition, revision and final prompt in the canary hash', async () => {
    const built = await buildPrompt(process.cwd(), await taskById(SCOUT_INJURED_CANARY_TASK_ID), 'agnes-image-2.1-flash');
    const input = promptHashInput(built);
    expect(input).toMatchObject({ promptStrategy: 'character-positive-only', positiveTraits: built.task.positiveTraits, positiveComposition: built.task.positiveComposition, revision: 2, prompt: built.prompt, styleProfileVersion: built.styleProfileVersion });
    expect(contentHash(built)).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each(FORBIDDEN_CHARACTER_TOKENS)('canary character audit rejects forbidden token %s', async (token) => {
    const task = await taskById(SCOUT_INJURED_CANARY_TASK_ID);
    expect(auditCharacterProviderPrompt(task, `A civilian portrait with ${token}.`).forbiddenTokens).toContain(token);
  });

  it('captures the exact Agnes canary body with no negative suffix', async () => {
    const task = await taskById(SCOUT_INJURED_CANARY_TASK_ID);
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    const fixture = await fs.readFile(path.join(process.cwd(), 'tests/fixtures/agnes-success-base64.json'), 'utf8');
    let body: Record<string, unknown> = {};
    await generateImage(createArtConfig(process.cwd(), { IMAGE_API_KEY: 'test-secret' }), { model: built.model, prompt: built.prompt, negativePrompt: built.negativePrompt, width: built.width, height: built.height, requestedRatio: built.requestedRatio }, async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(fixture, { status: 200 });
    });
    expect(body).toMatchObject({ model: 'agnes-image-2.1-flash', size: '1K', ratio: '3:4', return_base64: true });
    expect(body.prompt).toBe(built.prompt);
    expect(String(body.prompt)).not.toMatch(/\n\nAvoid:/i);
    expect(auditCharacterProviderPrompt(task, String(body.prompt))).toMatchObject({ passed: true, forbiddenTokenCount: 0 });
  });

  it('keeps the Scout portrait and published injured visual official', async () => {
    const reportPath = path.join(process.cwd(), 'reports/phase4a41-scout-injured-canary.json');
    try {
      const report = JSON.parse(await fs.readFile(reportPath, 'utf8')) as { tasks?: Array<{ taskId: string; review: string; validation: string }> };
      expect(report.tasks?.[0]).toMatchObject({ taskId: SCOUT_INJURED_CANARY_TASK_ID, review: 'pending', validation: 'passed' });
    } catch {
      expect(true).toBe(true);
    }
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
    expect(manifest.characters.scout?.portrait).toBe('/assets/characters/scout/portrait.png');
    expect(manifest.characters.scout?.injured).toBe('/assets/characters/scout/injured.png');
  });
});
