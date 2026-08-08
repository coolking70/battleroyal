import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ArtTask, BuiltPrompt } from './types';
import { ratioForDimensions } from './providers/agnes';

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
  if (task.category !== 'character') return null;
  return `art/characters/${task.entityId}.md`;
}

export async function buildPrompt(rootDir: string, task: ArtTask, model: string): Promise<BuiltPrompt> {
  const master = await readText(rootDir, 'art/style/master-style.md');
  const category = categoryStyleName(task);
  const categoryStyle = await readText(
    rootDir,
    `art/style/${STYLE_FILE_BY_PROFILE[category] ?? 'master-style.md'}`,
  );
  const negativePrompt = await readText(rootDir, 'art/style/negative-prompt.txt');
  const sheetPath = designSheetPath(task);
  const designSheet = sheetPath ? await readText(rootDir, sheetPath) : '';
  const styleVersion = crypto
    .createHash('sha256')
    .update(`${master}\n${categoryStyle}\n${negativePrompt}`)
    .digest('hex')
    .slice(0, 12);

  const sections = [
    master,
    categoryStyle,
    designSheet ? `Character design source of truth:\n${designSheet}` : '',
    `Asset brief:\n${task.promptTemplate}`,
    `Variant: ${task.variant}. Keep the entity identity stable across variants.`,
    `Technical composition: ${task.width}x${task.height}, clear focal subject, no text, no logo, no watermark.`,
  ].filter(Boolean);

  return {
    task,
    prompt: clean(sections.join('\n\n')),
    negativePrompt,
    model,
    width: task.width,
    height: task.height,
    requestedRatio: ratioForDimensions(task.width, task.height),
    styleProfileVersion: styleVersion,
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
