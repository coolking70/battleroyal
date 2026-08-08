import type { ArtTask } from './types';

export const FORBIDDEN_CHARACTER_TOKENS = [
  'gun',
  'rifle',
  'firearm',
  'pistol',
  'sniper',
  'weapon',
  'armed',
  'military',
  'tactical',
  'combat',
  'soldier',
  'survivor',
  'ammunition',
  'holster',
  'plate carrier',
  'chest rig',
  'special forces',
  'camouflage',
  'fighter',
  'engineer',
  'medic',
  'field',
  'combat athlete',
] as const;

export const FORBIDDEN_ENVIRONMENT_TOKENS = [
  'person',
  'people',
  'human',
  'character',
  'survivor',
  'patient',
  'doctor',
  'nurse',
  'pedestrian',
  'crowd',
  'silhouette',
] as const;

export const FORBIDDEN_RAIN_NARRATIVE_TOKENS = [
  'abandoned',
  'deserted',
  'disaster',
  'survivor',
  'combat',
  'war',
  'danger',
  'ruins',
  'destroyed',
  'collapsed',
] as const;

export const FORBIDDEN_ITEM_MARKING_TOKENS = [
  'cross',
  'logo',
  'emblem',
  'symbol',
  'brand',
  'red cross',
] as const;

export const FORBIDDEN_ITEM_CATEGORY_TOKENS = [
  'urban',
  'ruins',
  'cityscape',
  'environment',
  'scenery',
  'person',
  'character',
  'hand',
  'interface',
  'HUD',
  'frame',
  'arrows',
  'buttons',
  'strategy',
  'character sheet',
  'game UI',
  'logo',
  'brand',
  'label',
  'text',
] as const;

function tokenPattern(token: string): RegExp {
  return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i');
}

export interface PromptAuditResult {
  strategy: string;
  passed: boolean;
  forbiddenTokenCount: number;
  forbiddenTokens: string[];
  internalTaskId: boolean;
  internalEntityId: boolean;
  designSheetHeading: boolean;
  failures: string[];
}

export function auditCharacterProviderPrompt(task: ArtTask, providerPrompt: string): PromptAuditResult {
  const forbiddenTokens = FORBIDDEN_CHARACTER_TOKENS.filter((token) => tokenPattern(token).test(providerPrompt));
  const internalTaskId = providerPrompt.includes(task.id);
  const internalEntityId = tokenPattern(task.entityId).test(providerPrompt);
  const designSheetHeading = new RegExp(`\\b${task.entityId} design sheet\\b`, 'i').test(providerPrompt);
  const failures = [
    ...forbiddenTokens.map((token) => `forbidden token: ${token}`),
    ...(internalTaskId ? [`internal task id: ${task.id}`] : []),
    ...(internalEntityId ? [`internal entity id: ${task.entityId}`] : []),
    ...(designSheetHeading ? [`design-sheet heading: ${task.entityId} design sheet`] : []),
  ];
  return {
    strategy: task.promptStrategy ?? 'standard',
    passed: failures.length === 0,
    forbiddenTokenCount: forbiddenTokens.length,
    forbiddenTokens,
    internalTaskId,
    internalEntityId,
    designSheetHeading,
    failures,
  };
}

function auditTokenSet(task: ArtTask, providerPrompt: string, tokens: readonly string[]): PromptAuditResult {
  const forbiddenTokens = tokens.filter((token) => tokenPattern(token).test(providerPrompt));
  const failures = forbiddenTokens.map((token) => `forbidden token: ${token}`);
  return {
    strategy: task.promptStrategy ?? 'standard',
    passed: failures.length === 0,
    forbiddenTokenCount: forbiddenTokens.length,
    forbiddenTokens,
    internalTaskId: false,
    internalEntityId: false,
    designSheetHeading: false,
    failures,
  };
}

export function auditEnvironmentProviderPrompt(task: ArtTask, providerPrompt: string): PromptAuditResult {
  return auditTokenSet(task, providerPrompt, FORBIDDEN_ENVIRONMENT_TOKENS);
}

export function auditRainProviderPrompt(task: ArtTask, providerPrompt: string): PromptAuditResult {
  return auditTokenSet(task, providerPrompt, [...FORBIDDEN_ENVIRONMENT_TOKENS, ...FORBIDDEN_RAIN_NARRATIVE_TOKENS]);
}

export function auditItemProviderPrompt(task: ArtTask, providerPrompt: string): PromptAuditResult {
  return auditTokenSet(task, providerPrompt, task.promptStrategy === 'item-positive-only'
    ? FORBIDDEN_ITEM_CATEGORY_TOKENS
    : FORBIDDEN_ITEM_MARKING_TOKENS);
}
