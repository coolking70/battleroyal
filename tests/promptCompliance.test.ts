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
    expect(prompts[taskId]!.prompt).not.toMatch(/strategy interface|game UI|game screenshot|status bar|navigation arrow|window chrome|inventory window/i);
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
    const config = createArtConfig(process.cwd());
    expect(await findCacheEntry(config, newHash, prompts['character/scout/portrait'])).toBeNull();
  });
});
