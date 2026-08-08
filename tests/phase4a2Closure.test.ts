import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPrompt } from '../tools/art/promptBuilder';
import { loadTasks } from '../tools/art/taskPlanner';
import { promptPolicyFor } from '../tools/art/promptPolicies';
import {
  getCharacterVisual,
  getItemVisual,
  getWorldEventVisual,
  getZoneVisual,
  setAssetManifest,
  type AssetManifest,
} from '../src/ui/visualAssets';

const B1_TASKS = [
  'character/fighter/portrait',
  'character/engineer/portrait',
  'character/medic/portrait',
  'zone/hospital/background',
  'item/medkit/icon',
  'world_event/rain/illustration',
] as const;

afterEach(() => setAssetManifest(null));

describe('Phase 4A-2 formal Round A closure', () => {
  it('publishes exactly four AI slots after Blackout approval', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
    expect(manifest.characters.scout?.portrait).toBe('/assets/characters/scout/portrait.png');
    expect(manifest.zones.school?.background).toBe('/assets/zones/school/background.png');
    expect(manifest.items.bandage).toBe('/assets/items/bandage/icon.png');
    expect(manifest.worldEvents.blackout).toBe('/assets/world-events/blackout/illustration.png');
    expect(Object.values(manifest.characters).flatMap((entry) => Object.values(entry)).filter(Boolean)).toHaveLength(1);
    expect(Object.values(manifest.zones).flatMap((entry) => Object.values(entry)).filter(Boolean)).toHaveLength(1);
    expect(Object.values(manifest.items).filter(Boolean)).toHaveLength(1);
    expect(Object.values(manifest.worldEvents).filter(Boolean)).toHaveLength(1);
  });

  it('keeps provenance limited to the approved Round A tasks', async () => {
    const provenance = JSON.parse(await fs.readFile(path.join(process.cwd(), 'art/approved-assets.json'), 'utf8')) as { assets: Record<string, { candidateHash: string }> };
    expect(Object.keys(provenance.assets).sort()).toEqual([
      'character/scout/portrait',
      'item/bandage/icon',
      'world_event/blackout/illustration',
      'zone/school/background',
    ]);
    expect(provenance.assets['character/scout/portrait']?.candidateHash).toBe('2cad771df6a1017996e2aa3ef3f1dabc03b0fcb9756c3a005ed86006128093fd');
    expect(provenance.assets['zone/school/background']?.candidateHash).toBe('c475891838381390cf9e837cbf3745971c3e834d95650e5ec98ed8bb29e053c7');
    expect(provenance.assets['item/bandage/icon']?.candidateHash).toBe('3e4d2edadc1b0cd8e2664be2224e1effa663c8fc01d61a170e5f7e4b6c9a09bb');
    expect(provenance.assets['world_event/blackout/illustration']?.candidateHash).toBe('d813c5525288a419335cee2975ce1736f1cd5b49499ae9b05f71ad6a22130843');
  });

  it('selects all four published visuals officially', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as AssetManifest;
    setAssetManifest(manifest);
    expect(getCharacterVisual('scout').source).toBe('official');
    expect(getZoneVisual('school').source).toBe('official');
    expect(getItemVisual('bandage').source).toBe('official');
    expect(getWorldEventVisual('blackout').source).toBe('official');
    expect(getWorldEventVisual('blackout').image).toBe('/assets/world-events/blackout/illustration.png');
  });

  it('falls through from an unavailable official slot to the local SVG source', () => {
    setAssetManifest({ version: 1, characters: { scout: { portrait: 'https://invalid.example/scout.png' } }, zones: {}, items: {}, worldEvents: {} });
    expect(getCharacterVisual('scout').source).toBe('svg');
    expect(getCharacterVisual('scout').image).toBe('characters/scout.svg');
  });
});

describe('Phase 4A-2 controlled Round B1 and Blackout v5 prompts', () => {
  it('contains exactly six B1 first-call tasks and no injured variants', async () => {
    const tasks = await loadTasks(process.cwd());
    expect(B1_TASKS).toHaveLength(6);
    expect(tasks.filter((task) => (B1_TASKS as readonly string[]).includes(task.id))).toHaveLength(6);
    expect(B1_TASKS.some((taskId) => taskId.includes('/injured/'))).toBe(false);
  });

  it.each([
    ['character/fighter/portrait', 'adult amateur boxing athlete', 'boxing wraps'],
    ['character/engineer/portrait', 'workshop repair technician', 'compact tool belt'],
    ['character/medic/portrait', 'community first-aid worker', 'first-aid pouch'],
  ] as const)('isolates %s around a civilian positive identity', async (taskId, descriptor, positiveAnchor) => {
    const task = (await loadTasks(process.cwd())).find((item) => item.id === taskId)!;
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(built.sections.entityBrief).toContain(`Provider-facing visual identity: ${descriptor}`);
    expect(built.sections.entityBrief).toContain(positiveAnchor);
    expect(built.sections.entityBrief).not.toMatch(/military|soldier|tactical|combat armor/i);
  });

  it('keeps Hospital environment-only with zero humans and no character focal subject', async () => {
    const task = (await loadTasks(process.cwd())).find((item) => item.id === 'zone/hospital/background')!;
    const policy = promptPolicyFor(task);
    expect(policy.allowPeople).toBe(false);
    expect(policy.hardConstraints).toEqual(expect.arrayContaining(['ENVIRONMENT ONLY', 'ZERO HUMANS', 'ZERO HUMAN SILHOUETTES']));
  });

  it('keeps Medkit isolated as the selected healing consumable, separate from Bandage', async () => {
    const task = (await loadTasks(process.cwd())).find((item) => item.id === 'item/medkit/icon')!;
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(task.entityId).toBe('medkit');
    expect(built.sections.hardConstraints).toContain('ISOLATED INVENTORY OBJECT');
    expect(built.sections.entityBrief).toContain('field medical kit');
    expect(built.sections.entityBrief).not.toContain('bandage');
  });

  it('allows Rain as the one event-specific weather task while retaining event isolation', async () => {
    const task = (await loadTasks(process.cwd())).find((item) => item.id === 'world_event/rain/illustration')!;
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(built.sections.entityBrief).toMatch(/rain/i);
    expect(built.sections.hardConstraints).toContain('ZERO PEOPLE');
    expect(built.sections.hardConstraints).toContain('ZERO WEAPONS');
  });

  it('locks Blackout v5 to one dim red beacon and a ceiling-free control-area composition', async () => {
    const task = (await loadTasks(process.cwd())).find((item) => item.id === 'world_event/blackout/illustration')!;
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(task.revision).toBe(4);
    expect(built.sections.entityBrief).toContain('electrical control area');
    expect(built.sections.hardConstraints).toContain('ceiling is outside the frame');
    expect(built.sections.hardConstraints).toContain('ZERO CEILING LAMPS VISIBLE');
    expect(built.sections.hardConstraints).toContain('all electrical control panels are dark');
    expect(built.sections.hardConstraints).toContain('exactly one dim red emergency beacon is illuminated');
    expect(built.sections.hardConstraints).toContain('ZERO GREEN LIGHTS');
    expect(built.sections.hardConstraints).toContain('ZERO WHITE NORMAL LIGHTS');
    expect(built.sections.entityBrief).not.toMatch(/rain|weather|street|outdoor/i);
  });
});
