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
