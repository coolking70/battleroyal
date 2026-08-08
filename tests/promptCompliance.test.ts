import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { contentHash, findCacheEntry } from '../tools/art/cache';
import { createArtConfig } from '../tools/art/config';
import { buildPrompt } from '../tools/art/promptBuilder';
import { loadTasks } from '../tools/art/taskPlanner';

const roots: string[] = [];

async function tasksAndPrompts(): Promise<{ root: string; prompts: Record<string, Awaited<ReturnType<typeof buildPrompt>>> }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'battleroyal-prompt-v2-'));
  roots.push(root);
  await fs.cp(path.join(process.cwd(), 'art', 'style'), path.join(root, 'art', 'style'), { recursive: true });
  await fs.cp(path.join(process.cwd(), 'art', 'characters'), path.join(root, 'art', 'characters'), { recursive: true });
  await fs.cp(path.join(process.cwd(), 'art', 'tasks'), path.join(root, 'art', 'tasks'), { recursive: true });
  const tasks = await loadTasks(root);
  const selected = tasks.filter((task) => [
    'character/scout/portrait',
    'zone/school/background',
    'item/bandage/icon',
    'world_event/blackout/illustration',
  ].includes(task.id));
  const prompts: Record<string, Awaited<ReturnType<typeof buildPrompt>>> = {};
  for (const task of selected) prompts[task.id] = await buildPrompt(root, task, 'agnes-image-2.1-flash');
  return { root, prompts };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('Phase 4A-1.1 category prompt compliance', () => {
  it('keeps render style free of content and interface pollution', async () => {
    const renderStyle = await fs.readFile(path.join(process.cwd(), 'art/style/render-style.md'), 'utf8');
    expect(renderStyle).not.toMatch(/urban ruins|strategy interface|HUD|character|weapon|school|hospital/i);
  });

  it('marks the style revision as phase4-style-v2', async () => {
    const { prompts } = await tasksAndPrompts();
    expect(prompts['item/bandage/icon']!.styleProfileVersion).toMatch(/^phase4-style-v2-/);
  });

  it('puts Scout hard constraints and avoid block near the prompt end', async () => {
    const { prompts } = await tasksAndPrompts();
    const prompt = prompts['character/scout/portrait']!.prompt;
    expect(prompt).toContain('HARD COMPOSITION CONSTRAINTS');
    expect(prompt).toContain('binoculars are the only prominent equipment');
    expect(prompt).toContain('no firearm');
    expect(prompt).toContain('no rifle');
    expect(prompt).toContain('approximately 28-32');
    expect(prompt.indexOf('HARD COMPOSITION CONSTRAINTS')).toBeGreaterThan(prompt.indexOf('Asset brief'));
    expect(prompt.lastIndexOf('AVOID:')).toBeGreaterThan(prompt.indexOf('HARD COMPOSITION CONSTRAINTS'));
  });

  it('does not rely on the old vague Scout sniper wording as its weapon policy', async () => {
    const { prompts } = await tasksAndPrompts();
    const prompt = prompts['character/scout/portrait']!.prompt.toLowerCase();
    expect(prompt).toContain('no firearm');
    expect(prompt).toContain('no weapon strapped to the back');
  });

  it('gives School explicit zero-human environment constraints', async () => {
    const { prompts } = await tasksAndPrompts();
    const prompt = prompts['zone/school/background']!.prompt;
    expect(prompt).toContain('ENVIRONMENT ONLY');
    expect(prompt).toContain('ZERO HUMANS');
    expect(prompt).toContain('ZERO PEOPLE');
    expect(prompt).toContain('ZERO HUMAN SILHOUETTES');
    expect(prompt).toContain('lower center remains visually calm');
  });

  it('keeps Character design source out of School prompts', async () => {
    const { prompts } = await tasksAndPrompts();
    expect(prompts['zone/school/background']!.prompt).not.toContain('Character design source of truth');
    expect(prompts['zone/school/background']!.prompt).not.toContain('game UI');
  });

  it('gives Bandage isolated-object constraints without scene inheritance', async () => {
    const { prompts } = await tasksAndPrompts();
    const prompt = prompts['item/bandage/icon']!.prompt.toLowerCase();
    expect(prompt).toContain('isolated inventory object');
    expect(prompt).toContain('exactly one complete object centered in frame');
    expect(prompt).toContain('plain neutral');
    expect(prompt).toContain('no environment');
    expect(prompt).toContain('no hud');
  });

  it('keeps Item prompts free of urban and strategy-interface positive content', async () => {
    const { prompts } = await tasksAndPrompts();
    const prompt = prompts['item/bandage/icon']!.prompt.toLowerCase();
    expect(prompt).not.toContain('urban ruins');
    expect(prompt).not.toContain('strategy interface');
    expect(prompt).not.toContain('character design source of truth');
  });

  it('gives Blackout a human-free, rain-free powerless-light theme', async () => {
    const { prompts } = await tasksAndPrompts();
    const prompt = prompts['world_event/blackout/illustration']!.prompt.toLowerCase();
    expect(prompt).toContain('zero people');
    expect(prompt).toContain('zero rain');
    expect(prompt).toContain('powerless');
    expect(prompt).toContain('emergency lamps');
    expect(prompt).toContain('only sparse dim red emergency lamps remain active');
  });

  it('keeps Event prompts free of Character design source', async () => {
    const { prompts } = await tasksAndPrompts();
    expect(prompts['world_event/blackout/illustration']!.prompt).not.toContain('Character design source of truth');
  });

  it.each([
    'character/scout/portrait',
    'zone/school/background',
    'item/bandage/icon',
    'world_event/blackout/illustration',
  ])('does not actively request UI rendering in %s', async (taskId) => {
    const { prompts } = await tasksAndPrompts();
    const positiveSections = [
      prompts[taskId]!.sections.renderStyle,
      prompts[taskId]!.sections.categoryStyle,
      prompts[taskId]!.sections.entityBrief,
      prompts[taskId]!.sections.variant,
    ].join('\n');
    expect(positiveSections).not.toMatch(/strategy interface|game UI|game screenshot|status bar|navigation arrow|window chrome|inventory window/i);
  });

  it('changes the content hash when the render style revision changes', async () => {
    const { root, prompts } = await tasksAndPrompts();
    const task = (await loadTasks(root)).find((item) => item.id === 'item/bandage/icon')!;
    await fs.appendFile(path.join(root, 'art/style/render-style.md'), '\nRevision marker for v2 test.');
    const changed = await buildPrompt(root, task, 'agnes-image-2.1-flash');
    expect(contentHash(changed)).not.toBe(contentHash(prompts['item/bandage/icon']!));
  });

  it('does not hit the old Scout v1 cache after the v2 prompt revision', async () => {
    const { prompts } = await tasksAndPrompts();
    const oldHash = '14511e9a5fb98a79962cc31732cf92d30903a0613f6a3e7141dad4809fbaf625';
    const newHash = contentHash(prompts['character/scout/portrait']);
    expect(newHash).not.toBe(oldHash);
    const cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'battleroyal-prompt-v2-cache-'));
    roots.push(cacheRoot);
    const config = createArtConfig(cacheRoot);
    expect(await findCacheEntry(config, newHash, prompts['character/scout/portrait'])).toBeNull();
  });

  it('raises Scout to revision 2 without changing the global v2 style architecture', async () => {
    const { prompts } = await tasksAndPrompts();
    expect(prompts['character/scout/portrait']!.task.revision).toBe(2);
    expect(prompts['character/scout/portrait']!.styleProfileVersion).toMatch(/^phase4-style-v2-/);
  });

  it('puts Scout weapon-free positive composition in hard constraints', async () => {
    const { prompts } = await tasksAndPrompts();
    const hard = prompts['character/scout/portrait']!.sections.hardConstraints;
    for (const phrase of ['UNARMED', 'civilian', 'both hands are fully visible and empty', 'upper-back silhouette is visibly empty', 'no gun holster', 'no plate carrier', 'no camouflage pattern', 'binoculars']) {
      expect(hard).toContain(phrase);
    }
  });

  it('keeps Scout positive semantic sections civilian and non-military', async () => {
    const { prompts } = await tasksAndPrompts();
    const positive = `${prompts['character/scout/portrait']!.sections.categoryStyle}\n${prompts['character/scout/portrait']!.sections.entityBrief}`;
    expect(positive).not.toMatch(/\bmilitary scout\b|\btactical operator\b|\barmed\b|\bsniper\b|\bcombat loadout\b/i);
    expect(positive).toMatch(/civilian|unarmed|empty hands|empty|binoculars/i);
  });

  it('keeps Scout positive description focused on civilian observation identity', async () => {
    const { prompts } = await tasksAndPrompts();
    const positive = prompts['character/scout/portrait']!.sections.entityBrief;
    expect(positive).toMatch(/civilian urban observer/i);
    expect(positive).toMatch(/simple neck strap|civilian outdoor clothing|shoulder pouch/i);
    expect(positive).not.toMatch(/rifle|gun|plate carrier|camouflage/i);
  });

  it('makes Scout v3 visibly weapon-free in the composition constraints', async () => {
    const { prompts } = await tasksAndPrompts();
    const hard = prompts['character/scout/portrait']!.sections.hardConstraints;
    expect(hard).toContain('both shoulders are clearly visible');
    expect(hard).toContain('no object extends above either shoulder');
    expect(hard).toContain('simple unobtrusive background');
  });

  it('raises Blackout to revision 2 with an indoor event brief', async () => {
    const { prompts } = await tasksAndPrompts();
    expect(prompts['world_event/blackout/illustration']!.task.revision).toBe(2);
    expect(prompts['world_event/blackout/illustration']!.sections.entityBrief).toMatch(/indoor commercial corridor|power failure/i);
  });

  it('puts Blackout power-loss and isolation constraints in hard constraints', async () => {
    const { prompts } = await tasksAndPrompts();
    const hard = prompts['world_event/blackout/illustration']!.sections.hardConstraints;
    for (const phrase of ['FULLY INDOOR', 'empty corridor', 'ZERO PEOPLE', 'ZERO RAIN', 'no weather', 'no exterior street', 'normal lights are visibly switched off', 'screens are completely black', 'emergency lamps', 'power failure']) {
      expect(hard.toLowerCase()).toContain(phrase.toLowerCase());
    }
  });

  it('keeps Blackout positive sections indoor and free of weather or characters', async () => {
    const { prompts } = await tasksAndPrompts();
    const positive = `${prompts['world_event/blackout/illustration']!.sections.categoryStyle}\n${prompts['world_event/blackout/illustration']!.sections.entityBrief}`;
    expect(positive).toMatch(/indoor|corridor|power failure|electrical fixtures/i);
    expect(positive).not.toMatch(/\brain\b|street battle|\bsurvivor\b|\bsoldier\b/i);
  });

  it('changes both targeted hashes and avoids the v2 cache entries', async () => {
    const { root, prompts } = await tasksAndPrompts();
    const scout = (await loadTasks(root)).find((task) => task.id === 'character/scout/portrait')!;
    const blackout = (await loadTasks(root)).find((task) => task.id === 'world_event/blackout/illustration')!;
    const scoutHash = contentHash(prompts['character/scout/portrait']!);
    const blackoutHash = contentHash(prompts['world_event/blackout/illustration']!);
    expect(scoutHash).not.toBe('d47e96af060e6357e8d513ee79056b3b7f701c8add0332f8ae9d3b61bdaaee0a');
    expect(blackoutHash).not.toBe('48af21a453ef44f2103779f634851607eb3be1377d96b11bf5619043c97b664d');
    const cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'battleroyal-prompt-v3-cache-'));
    roots.push(cacheRoot);
    const config = createArtConfig(cacheRoot);
    expect(await findCacheEntry(config, scoutHash, prompts['character/scout/portrait'])).toBeNull();
    expect(await findCacheEntry(config, blackoutHash, prompts['world_event/blackout/illustration'])).toBeNull();
    expect(scout.revision).toBe(2);
    expect(blackout.revision).toBe(2);
  });
});
