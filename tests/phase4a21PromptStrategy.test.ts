import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createArtConfig } from '../tools/art/config';
import { generateImage } from '../tools/art/apiClient';
import { agnesRequestFor } from '../tools/art/providers/agnes';
import { auditCharacterProviderPrompt, FORBIDDEN_CHARACTER_TOKENS } from '../tools/art/promptAudit';
import { buildPrompt, promptHashInput } from '../tools/art/promptBuilder';
import { loadTasks } from '../tools/art/taskPlanner';
import type { ArtTask } from '../tools/art/types';

const CHARACTER_TASKS = [
  'character/engineer/portrait',
  'character/fighter/portrait',
  'character/medic/portrait',
] as const;

async function tasksById(): Promise<Map<string, ArtTask>> {
  return new Map((await loadTasks(process.cwd())).map((task) => [task.id, task]));
}

describe('Phase 4A-2.1 character-positive-only strategy', () => {
  it('enables the strategy only for the three new character portrait experiments', async () => {
    const tasks = await loadTasks(process.cwd());
    expect(tasks.filter((task) => task.promptStrategy === 'character-positive-only' && task.variant === 'portrait').map((task) => task.id).sort()).toEqual([...CHARACTER_TASKS].sort());
    expect(tasks.find((task) => task.id === 'character/scout/injured')?.promptStrategy).toBe('character-positive-only');
    expect(tasks.find((task) => task.id === 'character/scout/portrait')?.promptStrategy).not.toBe('character-positive-only');
    expect(tasks.find((task) => task.id === 'zone/hospital/background')?.promptStrategy).toBe('environment-positive-only');
    expect(tasks.find((task) => task.id === 'item/medkit/icon')?.promptStrategy).toBe('item-positive-only-unmarked');
    expect(tasks.find((task) => task.id === 'world_event/rain/illustration')?.promptStrategy).toBe('environment-positive-only');
  });

  it.each(CHARACTER_TASKS)('builds %s without a negative prompt or design-sheet source', async (taskId) => {
    const task = (await tasksById()).get(taskId)!;
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(task.revision).toBe(3);
    expect(built.negativePrompt).toBe('');
    expect(built.sections.avoid).toBe('');
    expect(built.sections.entityBrief).toContain('Positive appearance traits:');
    expect(built.sections.entityBrief).not.toContain('Character design source of truth');
    expect(built.sections.entityBrief).not.toMatch(/design sheet/i);
    expect(built.prompt).not.toContain(task.id);
  });

  it.each([
    ['character/engineer/portrait', 'workshop repair technician', 'short adjustable wrench'],
    ['character/fighter/portrait', 'adult amateur boxing athlete', 'boxing wraps'],
    ['character/medic/portrait', 'community first-aid worker', 'first-aid pouch'],
  ] as const)('keeps positive occupational anchors for %s', async (taskId, identity, anchor) => {
    const task = (await tasksById()).get(taskId)!;
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(built.prompt).toContain(identity);
    expect(built.prompt).toContain(anchor);
    expect(built.prompt).toContain('plain pale neutral studio-like backdrop');
    expect(built.prompt).toContain('both shoulders are clearly visible');
  });

  it('changes the Engineer hash and includes strategy/profile input in the hash contract', async () => {
    const task = (await tasksById()).get('character/engineer/portrait')!;
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    const input = promptHashInput(built);
    expect(input.promptStrategy).toBe('character-positive-only');
    expect(input.positiveTraits).toEqual(task.positiveTraits);
    expect((await import('../tools/art/hash')).generationInputHash(built)).not.toBe('77e02599e4b4798ff6d4668b26423bc37c6b1c7bfe7a2a5def2b48d2cdb52934');
  });

  it('assigns the new positive-only recovery strategies only to Hospital, Medkit and Rain', async () => {
    const tasks = await tasksById();
    expect(tasks.get('zone/hospital/background')?.promptStrategy).toBe('environment-positive-only');
    expect(tasks.get('item/medkit/icon')?.promptStrategy).toBe('item-positive-only-unmarked');
    expect(tasks.get('world_event/rain/illustration')?.promptStrategy).toBe('environment-positive-only');
    for (const taskId of ['zone/hospital/background', 'item/medkit/icon', 'world_event/rain/illustration']) {
      const built = await buildPrompt(process.cwd(), tasks.get(taskId)!, 'agnes-image-2.1-flash');
      expect(built.negativePrompt).toBe('');
      expect(built.sections.avoid).toBe('');
    }
  });

  it('audits the exact Agnes request payload for all three character prompts', async () => {
    const tasks = await tasksById();
    const fixture = await fs.readFile(path.join(process.cwd(), 'tests/fixtures/agnes-success-base64.json'), 'utf8');
    const config = createArtConfig(process.cwd(), { IMAGE_API_KEY: 'test-secret' });
    for (const taskId of CHARACTER_TASKS) {
      const task = tasks.get(taskId)!;
      const built = await buildPrompt(process.cwd(), task, config.model);
      let requestBody: Record<string, unknown> = {};
      await generateImage(config, {
        model: built.model,
        prompt: built.prompt,
        negativePrompt: built.negativePrompt,
        width: built.width,
        height: built.height,
        requestedRatio: built.requestedRatio,
      }, async (_input, init) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(fixture, { status: 200, headers: { 'content-type': 'application/json' } });
      });
      const providerPrompt = String(requestBody.prompt);
      expect(providerPrompt).toBe(built.prompt);
      expect(auditCharacterProviderPrompt(task, providerPrompt)).toMatchObject({
        passed: true,
        forbiddenTokenCount: 0,
        internalTaskId: false,
        internalEntityId: false,
        designSheetHeading: false,
      });
    }
  });

  it('audits forbidden vocabulary with word boundaries and reports failures', async () => {
    const task = (await tasksById()).get('character/engineer/portrait')!;
    const result = auditCharacterProviderPrompt(task, 'A workshop technician with a rifle, but a firearm-shaped wordless silhouette is not intended.');
    expect(result.passed).toBe(false);
    expect(result.forbiddenTokens).toEqual(expect.arrayContaining(['rifle', 'firearm']));
    expect(result.forbiddenTokenCount).toBeGreaterThanOrEqual(2);
    expect(FORBIDDEN_CHARACTER_TOKENS).toContain('weapon');
    expect(auditCharacterProviderPrompt(task, 'a workshop and fieldwork portrait').forbiddenTokens).toEqual([]);
  });

  it('uses a positive-only Agnes body without a synthetic Avoid suffix', async () => {
    const task = (await tasksById()).get('character/engineer/portrait')!;
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    const body = agnesRequestFor({ model: built.model, prompt: built.prompt, negativePrompt: built.negativePrompt, width: built.width, height: built.height, requestedRatio: built.requestedRatio });
    expect(body.prompt).toBe(built.prompt);
    expect(body.prompt).not.toContain('\n\nAvoid:');
  });

  it('does not carry survivor semantics or character hard-constraint sections into positive-only prompts', async () => {
    const task = (await tasksById()).get('character/engineer/portrait')!;
    const built = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    expect(built.prompt).not.toMatch(/survivor|battle-ready|prepared for survival|character design source of truth/i);
    expect(built.sections.hardConstraints).toContain('POSITIVE COMPOSITION REQUIREMENTS');
    expect(built.sections.hardConstraints).not.toContain('HARD COMPOSITION CONSTRAINTS');
  });

  it('changes the positive-only cache hash when a positive trait changes', async () => {
    const task = (await tasksById()).get('character/engineer/portrait')!;
    const original = await buildPrompt(process.cwd(), task, 'agnes-image-2.1-flash');
    const revised = await buildPrompt(process.cwd(), { ...task, positiveTraits: [...(task.positiveTraits ?? []), 'warm workshop lighting'] }, 'agnes-image-2.1-flash');
    const { generationInputHash } = await import('../tools/art/hash');
    expect(generationInputHash(revised)).not.toBe(generationInputHash(original));
  });
});
