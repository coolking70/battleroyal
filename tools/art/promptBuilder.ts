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

function providerDesignSheet(value: string): string {
  return value.replace(/^#[^\n]*\n+/, '').trim();
}

export async function buildPrompt(rootDir: string, task: ArtTask, model: string): Promise<BuiltPrompt> {
  const renderStyle = await readText(rootDir, 'art/style/render-style.md');
  const category = categoryStyleName(task);
  const categoryStyle = await readText(rootDir, `art/style/${STYLE_FILE_BY_PROFILE[category]!}`);
  const positiveOnly = task.promptStrategy === 'character-positive-only';
  const genericAvoid = positiveOnly ? '' : await readText(rootDir, 'art/style/negative-prompt.txt');
  const policy = promptPolicyFor(task);
  const sheetPath = designSheetPath(task);
  const designSheet = !positiveOnly && sheetPath ? providerDesignSheet(await readText(rootDir, sheetPath)) : '';
  const entityBrief = [
    task.providerDescriptor ? `Provider-facing visual identity: ${task.providerDescriptor}` : '',
    positiveOnly && task.positiveTraits?.length ? `Positive appearance traits:\n${task.positiveTraits.map((item) => `- ${item}`).join('\n')}` : '',
    designSheet ? `Character design source of truth:\n${designSheet}` : '',
    `Asset brief:\n${task.promptTemplate}`,
  ].filter(Boolean).join('\n\n');
  const variant = `Variant: ${task.variant}. Keep the entity identity stable across variants.`;
  const hardConstraints = positiveOnly
    ? [
        'single adult portrait',
        'waist-up portrait',
        'plain pale neutral studio-like backdrop',
        'both shoulders are clearly visible',
        'the silhouette behind the person is clean and empty',
        ...(task.positiveComposition ?? []),
      ]
    : [
        ...policy.hardConstraints,
        ...(task.hardConstraints ?? []),
      ];
  const avoid = positiveOnly ? '' : [...new Set([
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
    hardConstraints: `${positiveOnly ? 'POSITIVE COMPOSITION REQUIREMENTS' : 'HARD COMPOSITION CONSTRAINTS'}:\n${hardConstraints.map((item) => `- ${item}`).join('\n')}`,
    avoid: avoid ? `AVOID:\n${avoid}` : '',
  };
  const technicalComposition = positiveOnly
    ? `Technical composition: ${task.width}x${task.height}; centered waist-up portrait; clear focal subject; pale neutral studio-like backdrop.`
    : `Technical composition: ${task.width}x${task.height}, clear focal subject, no text, no logo, no watermark.`;
  const prompt = clean([
    sections.renderStyle,
    sections.categoryStyle,
    sections.entityBrief,
    sections.variant,
    technicalComposition,
    sections.hardConstraints,
    sections.avoid,
  ].join('\n\n'));
  const styleVersionInput = positiveOnly
    ? `${task.promptStrategy}\n${sections.renderStyle}\n${sections.categoryStyle}\n${sections.entityBrief}\n${sections.variant}\n${sections.hardConstraints}\n${sections.avoid}`
    : `${sections.renderStyle}\n${sections.categoryStyle}\n${sections.hardConstraints}\n${sections.avoid}`;
  const styleVersion = crypto
    .createHash('sha256')
    .update(styleVersionInput)
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
  const positiveOnly = built.task.promptStrategy === 'character-positive-only';
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
    ...(positiveOnly ? {
      promptStrategy: built.task.promptStrategy,
      positiveTraits: built.task.positiveTraits ?? [],
    } : {}),
  };
}
