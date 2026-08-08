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
    expect(prompt).toContain('binoculars are the only visible professional equipment');
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
    expect(prompt).toContain('emergency beacon');
    expect(prompt).toContain('exactly one dim red emergency beacon is illuminated');
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

  it('raises Scout to revision 3 without changing the global v2 style architecture', async () => {
    const { prompts } = await tasksAndPrompts();
    expect(prompts['character/scout/portrait']!.task.revision).toBe(3);
    expect(prompts['character/scout/portrait']!.styleProfileVersion).toMatch(/^phase4-style-v2-/);
  });

  it('puts Scout v4 weapon-free positive composition in hard constraints', async () => {
    const { prompts } = await tasksAndPrompts();
    const hard = prompts['character/scout/portrait']!.sections.hardConstraints;
    for (const phrase of ['waist-up portrait', 'civilian urban observer', 'both empty hands are visible', 'upper back is completely empty', 'nothing extends above either shoulder', 'no gun holster', 'no plate carrier', 'no camouflage', 'binoculars']) {
      expect(hard).toContain(phrase);
    }
  });

  it('keeps Scout positive semantic sections civilian and non-military', async () => {
    const { prompts } = await tasksAndPrompts();
    const positive = `${prompts['character/scout/portrait']!.sections.categoryStyle}\n${prompts['character/scout/portrait']!.sections.entityBrief}`;
    expect(positive).not.toMatch(/\bscout\b|\brecon\b|\breconnaissance\b|\btactical\b|\bmilitary\b|\bsoldier\b|\bsniper\b|\bcombat\b|\bsurvivor\b|\bfield operator\b/i);
    expect(positive).toMatch(/civilian|unarmed|empty hands|empty|binoculars/i);
  });

  it('keeps Scout positive description focused on civilian observation identity', async () => {
    const { prompts } = await tasksAndPrompts();
    const positive = prompts['character/scout/portrait']!.sections.entityBrief;
    expect(positive).toMatch(/civilian urban observer/i);
    expect(positive).toMatch(/simple neck strap|civilian outdoor clothing|shoulder pouch/i);
    expect(positive).not.toMatch(/rifle|gun|plate carrier|camouflage|backpack|utility trousers|field jacket/i);
  });

  it('makes Scout v4 visibly weapon-free in the composition constraints', async () => {
    const { prompts } = await tasksAndPrompts();
    const hard = prompts['character/scout/portrait']!.sections.hardConstraints;
    expect(hard).toContain('both shoulders are clearly visible');
    expect(hard).toContain('nothing extends above either shoulder');
    expect(hard).toContain('simple pale neutral background');
  });

  it('raises Blackout to revision 4 with a close underground control-area brief', async () => {
    const { prompts } = await tasksAndPrompts();
    expect(prompts['world_event/blackout/illustration']!.task.revision).toBe(4);
    expect(prompts['world_event/blackout/illustration']!.sections.entityBrief).toMatch(/electrical control area|powerless|blackout/i);
  });

  it('puts Blackout power-loss and isolation constraints in hard constraints', async () => {
    const { prompts } = await tasksAndPrompts();
    const hard = prompts['world_event/blackout/illustration']!.sections.hardConstraints;
    for (const phrase of ['close or medium-close environmental composition', 'electrical control area inside an underground public facility', 'ceiling is outside the frame', 'ZERO CEILING LAMPS VISIBLE', 'ZERO WINDOWS', 'ZERO PEOPLE', 'no weather', 'ZERO EXTERIOR VIEW', 'every normal ceiling light is switched off', 'illuminated white ceiling lights', 'digital screens are completely black', 'all electrical control panels are dark', 'all indicator arrays are dark', 'escalator indicator lights are off', 'no green indicator lights', 'exactly one dim red emergency beacon is illuminated', 'predominantly dark', 'electrical blackout']) {
      expect(hard.toLowerCase()).toContain(phrase.toLowerCase());
    }
  });

  it('keeps Blackout positive sections indoor and free of weather or characters', async () => {
    const { prompts } = await tasksAndPrompts();
    const positive = `${prompts['world_event/blackout/illustration']!.sections.categoryStyle}\n${prompts['world_event/blackout/illustration']!.sections.entityBrief}`;
    expect(positive).toMatch(/underground public facility|powerless|electrical control area/i);
    expect(positive).not.toMatch(/\brain\b|\bweather\b|\bstreet\b|\boutdoor\b|street battle|\bsurvivor\b|\bsoldier\b/i);
  });

  it('changes both targeted hashes and avoids the v2 cache entries', async () => {
    const { root, prompts } = await tasksAndPrompts();
    const scout = (await loadTasks(root)).find((task) => task.id === 'character/scout/portrait')!;
    const blackout = (await loadTasks(root)).find((task) => task.id === 'world_event/blackout/illustration')!;
    const scoutHash = contentHash(prompts['character/scout/portrait']!);
    const blackoutHash = contentHash(prompts['world_event/blackout/illustration']!);
    expect(scoutHash).not.toBe('1d3efddc1e422e9e5ba4fcb0353ffb6853aa6b9a6a094436b15d802ddbdeb19f');
    expect(blackoutHash).not.toBe('0e1536f4df281f25ba3d36648aff049bab3d51ed71607f80eb18a31ef82b690b');
    const cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'battleroyal-prompt-v3-cache-'));
    roots.push(cacheRoot);
    const config = createArtConfig(cacheRoot);
    expect(await findCacheEntry(config, scoutHash, prompts['character/scout/portrait'])).toBeNull();
    expect(await findCacheEntry(config, blackoutHash, prompts['world_event/blackout/illustration'])).toBeNull();
    expect(scout.revision).toBe(3);
    expect(blackout.revision).toBe(4);
  });

  it('keeps Scout provider-facing positive sections free of internal task identity', async () => {
    const { prompts } = await tasksAndPrompts();
    const positive = [
      prompts['character/scout/portrait']!.sections.categoryStyle,
      prompts['character/scout/portrait']!.sections.entityBrief,
      prompts['character/scout/portrait']!.sections.variant,
    ].join('\n');
    expect(positive).not.toMatch(/\bscout\b|character\/scout\/portrait/i);
    expect(positive).toContain('civilian urban observer');
    expect(positive).toContain('empty hands');
    expect(positive).toContain('plain slate-blue outdoor jacket');
  });

  it('strips the internal design-sheet heading from the provider prompt', async () => {
    const { prompts } = await tasksAndPrompts();
    const entityBrief = prompts['character/scout/portrait']!.sections.entityBrief;
    expect(entityBrief).not.toContain('# Scout design sheet');
    expect(entityBrief).not.toMatch(/\bScout design sheet\b/i);
  });

  it('does not inject the internal Scout task id into the final provider prompt', async () => {
    const { prompts } = await tasksAndPrompts();
    expect(prompts['character/scout/portrait']!.prompt).not.toContain('character/scout/portrait');
    expect(prompts['character/scout/portrait']!.prompt).toContain('civilian urban observer');
  });

  it('locks Blackout light-state facts instead of only using negative wording', async () => {
    const { prompts } = await tasksAndPrompts();
    const entity = prompts['world_event/blackout/illustration']!.sections.entityBrief;
    expect(entity).toContain('Electrical control panels and indicator arrays are completely dark');
    expect(entity).toContain('Several large digital displays are completely black');
    expect(entity).toContain('A nearby advertising screen is black and powerless');
    expect(entity).toContain('The ceiling is outside the frame');
    expect(entity).toContain('one dim red emergency beacon');
  });

  it('keeps Blackout positive sections free of outdoor and weather semantics', async () => {
    const { prompts } = await tasksAndPrompts();
    const positive = [
      prompts['world_event/blackout/illustration']!.sections.categoryStyle,
      prompts['world_event/blackout/illustration']!.sections.entityBrief,
    ].join('\n');
    expect(positive).toContain('underground public facility');
    expect(positive).not.toMatch(/\brain\b|\bweather\b|\bstreet\b|\boutdoor\b/i);
  });
});
