import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ArtTask, BuiltPrompt } from './types';
import { ratioForDimensions } from './providers/agnes';
import { genericPromptAvoid, promptPolicyFor } from './promptPolicies';

const STYLE_FILE_BY_PROFILE: Record<string, string> = {
  character: 'character-style.md',
  zone: 'zone-style.md',
  item: 'item-style.md',
  event: 'event-style.md',
};

function clean(value: string): string {
  return value.trim().replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n');
}

async function readText(rootDir: string, relativePath: string): Promise<string> {
  return clean(await fs.readFile(path.join(rootDir, relativePath), 'utf8'));
}

function categoryStyleName(task: ArtTask): string {
  return task.category === 'world_event' ? 'event' : task.category;
}

function designSheetPath(task: ArtTask): string | null {
  return task.category === 'character' ? `art/characters/${task.entityId}.md` : null;
}

export async function buildPrompt(rootDir: string, task: ArtTask, model: string): Promise<BuiltPrompt> {
  const renderStyle = await readText(rootDir, 'art/style/render-style.md');
  const category = categoryStyleName(task);
  const categoryStyle = await readText(rootDir, `art/style/${STYLE_FILE_BY_PROFILE[category]!}`);
  const genericAvoid = await readText(rootDir, 'art/style/negative-prompt.txt');
  const policy = promptPolicyFor(task);
  const sheetPath = designSheetPath(task);
  const designSheet = sheetPath ? await readText(rootDir, sheetPath) : '';
  const entityBrief = [
    designSheet ? `Character design source of truth:\n${designSheet}` : '',
    `Asset brief:\n${task.promptTemplate}`,
  ].filter(Boolean).join('\n\n');
  const variant = `Variant: ${task.variant}. Keep the entity identity stable across variants.`;
  const hardConstraints = [
    ...policy.hardConstraints,
    ...(task.hardConstraints ?? []),
  ];
  const avoid = [...new Set([
    ...genericPromptAvoid(),
    ...policy.avoid,
    ...(task.avoid ?? []),
    ...genericAvoid.split(',').map((item) => item.trim()).filter(Boolean),
  ])].join(', ');
  const sections = {
    renderStyle,
    categoryStyle,
    entityBrief,
    variant,
    hardConstraints: `HARD COMPOSITION CONSTRAINTS:\n${hardConstraints.map((item) => `- ${item}`).join('\n')}`,
    avoid: `AVOID:\n${avoid}`,
  };
  const prompt = clean([
    sections.renderStyle,
    sections.categoryStyle,
    sections.entityBrief,
    sections.variant,
    `Technical composition: ${task.width}x${task.height}, clear focal subject, no text, no logo, no watermark.`,
    sections.hardConstraints,
    sections.avoid,
  ].join('\n\n'));
  const styleVersion = crypto
    .createHash('sha256')
    .update(`${sections.renderStyle}\n${sections.categoryStyle}\n${sections.hardConstraints}\n${sections.avoid}`)
    .digest('hex')
    .slice(0, 12);

  return {
    task,
    prompt,
    negativePrompt: clean(avoid),
    model,
    width: task.width,
    height: task.height,
    requestedRatio: ratioForDimensions(task.width, task.height),
    styleProfileVersion: `phase4-style-v2-${styleVersion}`,
    sections,
  };
}

export function promptHashInput(built: BuiltPrompt): Record<string, unknown> {
  return {
    taskId: built.task.id,
    prompt: built.prompt,
    negativePrompt: built.negativePrompt,
    model: built.model,
    width: built.width,
    height: built.height,
    requestedRatio: built.requestedRatio,
    revision: built.task.revision,
    styleProfileVersion: built.styleProfileVersion,
  };
}
