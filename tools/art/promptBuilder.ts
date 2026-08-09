import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ArtTask, BuiltPrompt } from './types';
import { ratioForDimensions } from './providers/agnes';
import { genericPromptAvoid, itemProductionPromptPolicyFor, promptPolicyFor } from './promptPolicies';

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
  const itemProductionPolicy = task.promptStrategy === 'item-positive-only' && task.itemProductionCategory
    ? itemProductionPromptPolicyFor(task)
    : null;
  const categoryStyle = task.promptStrategy === 'event-positive-only'
    ? 'Atmospheric environmental illustration for a game event. The event phenomenon or event equipment is the primary visual subject. Wide cinematic environmental composition.'
    : task.promptStrategy === 'environment-positive-only'
    ? task.category === 'zone'
      ? 'Environmental location illustration with clear architecture, recognizable props, restrained abandonment, open sightlines and a calm lower-center area reserved for later overlay.'
      : 'Environmental event illustration with one clear weather phenomenon as the visual subject, strong mood, readable composition and original visual design.'
    : itemProductionPolicy
      ? itemProductionPolicy.presentation
      : task.promptStrategy === 'item-positive-only'
        ? 'Isolated inventory-object illustration with one complete object centered, crisp contour, high recognition at small size, plain neutral studio backdrop, controlled shadow and original visual design.'
    : await readText(rootDir, `art/style/${STYLE_FILE_BY_PROFILE[category]!}`);
  const positiveOnly = task.promptStrategy !== undefined && task.promptStrategy !== 'standard';
  const genericAvoid = positiveOnly ? '' : await readText(rootDir, 'art/style/negative-prompt.txt');
  const policy = promptPolicyFor(task);
  const sheetPath = designSheetPath(task);
  const designSheet = !positiveOnly && sheetPath ? providerDesignSheet(await readText(rootDir, sheetPath)) : '';
  const entityBrief = [
    task.providerDescriptor ? `Provider-facing visual identity: ${task.providerDescriptor}` : '',
    task.positiveTraits?.length ? `${task.promptStrategy === 'character-positive-only' || task.promptStrategy === 'character-combat-positive-only' ? 'Positive appearance traits' : 'Positive visual traits'}:\n${task.positiveTraits.map((item) => `- ${item}`).join('\n')}` : '',
    designSheet ? `Character design source of truth:\n${designSheet}` : '',
    `Asset brief:\n${task.promptTemplate}`,
  ].filter(Boolean).join('\n\n');
  const variant = task.promptStrategy === 'character-combat-positive-only'
    ? 'State: healthy, fully alert and actively observing in a tense civilian stance.'
    : `Variant: ${task.variant}. Keep the entity identity stable across variants.`;
  const hardConstraints = task.promptStrategy === 'character-positive-only' || task.promptStrategy === 'character-combat-positive-only'
    ? [
        'single adult portrait',
        'waist-up portrait',
        'plain pale neutral studio-like backdrop',
        'both shoulders are clearly visible',
        'the silhouette behind the person is clean and empty',
        ...(task.positiveComposition ?? []),
      ]
    : task.promptStrategy === 'event-positive-only' || task.promptStrategy === 'environment-positive-only' || task.promptStrategy === 'item-positive-only-unmarked' || task.promptStrategy === 'item-positive-only'
      ? [...(task.positiveComposition ?? [])]
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
  const technicalComposition = task.promptStrategy === 'character-positive-only'
    ? `Technical composition: ${task.width}x${task.height}; centered waist-up portrait; clear focal subject; pale neutral studio-like backdrop.`
    : task.promptStrategy === 'character-combat-positive-only'
      ? `Technical composition: ${task.width}x${task.height}; dynamic three-quarter portrait; clear focal subject; pale neutral studio-like backdrop.`
    : task.promptStrategy === 'event-positive-only'
      ? `Technical composition: ${task.width}x${task.height}; wide environmental framing; clear event focal subject; cinematic atmospheric composition.`
    : task.promptStrategy === 'environment-positive-only'
      ? `Technical composition: ${task.width}x${task.height}; wide environmental framing; clear location or weather focal subject; calm lower-center space.`
      : task.promptStrategy === 'item-positive-only-unmarked' || task.promptStrategy === 'item-positive-only'
        ? `Technical composition: ${task.width}x${task.height}; centered single object; clear silhouette; plain dark-gray studio backdrop.`
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
    ...(built.task.promptStrategy && built.task.promptStrategy !== 'standard' ? {
      promptStrategy: built.task.promptStrategy,
      positiveTraits: built.task.positiveTraits ?? [],
      ...(built.task.itemProductionCategory ? { itemProductionCategory: built.task.itemProductionCategory } : {}),
      ...(built.task.promptStrategy !== 'item-positive-only-unmarked' && built.task.positiveComposition ? { positiveComposition: built.task.positiveComposition } : {}),
    } : {}),
  };
}
