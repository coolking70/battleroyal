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
  'same scout',
  'same character as previous image',
  'as reference image',
  'reference image',
  'image reference',
  'img2img',
] as const;

export const FORBIDDEN_COMBAT_DYNAMIC_EQUIPMENT_TOKENS = [
  'gun',
  'rifle',
  'firearm',
  'pistol',
  'sniper',
  'weapon',
  'armed',
  'bow',
  'axe',
  'sword',
  'knife',
  'military',
  'tactical',
  'soldier',
  'special forces',
  'combat gear',
  'plate carrier',
  'chest rig',
  'ammunition',
  'holster',
] as const;

export const FORBIDDEN_COMBAT_INJURY_TOKENS = [
  'bandage',
  'injury',
  'wound',
  'blood',
  'hurt',
  'wounded',
  'damaged',
  'fatigue',
  'fatigued',
  'tired',
  'dust',
  'scuff',
] as const;

export const FORBIDDEN_COMBAT_MILITARY_TOKENS = [
  'military',
  'tactical',
  'soldier',
  'special forces',
  'combat gear',
  'plate carrier',
  'chest rig',
  'ammunition',
  'holster',
  'survivor',
] as const;

export const FORBIDDEN_COMBAT_PROP_TRANSITION_PATTERNS = [
  /\blifted\s+binoculars\b/i,
  /\braised\s+binoculars\b/i,
  /\bholds?\s+(?:the\s+)?binoculars\b/i,
  /\bholding\s+(?:the\s+)?binoculars\b/i,
  /\buses?\s+(?:the\s+)?binoculars\b/i,
  /\blooking\s+through\s+(?:the\s+)?binoculars\b/i,
  /\bgrabs?\s+(?:the\s+)?binoculars\b/i,
  /\badjusts?\s+(?:the\s+)?binoculars\b/i,
  /\btouches?\s+(?:the\s+)?binoculars\b/i,
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

export const FORBIDDEN_ITEM_OBJECT_TOKENS = [
  'person',
  'people',
  'human',
  'character',
  'survivor',
  'soldier',
  'warrior',
  'wearer',
  'worn by',
  'mannequin',
  'hand',
  'battle',
  'combat',
  'fight',
  'scene',
  'environment',
  'scenery',
  'HUD',
  'interface',
  'window',
  'slot',
  'arrows',
  'buttons',
  'game UI',
  'game interface',
  'inventory frame',
] as const;

export const FORBIDDEN_EVENT_PERSON_TOKENS = [
  'person',
  'people',
  'human',
  'character',
  'protagonist',
  'survivor',
  'soldier',
  'crowd',
  'protester',
  'pedestrian',
  'worker',
  'doctor',
  'nurse',
  'patient',
] as const;

export const FORBIDDEN_EVENT_UI_TOKENS = [
  'HUD',
  'interface',
  'game card',
  'status bar',
  'menu',
  'game screenshot',
  'event card',
  'window',
  'slot',
  'arrows',
  'buttons',
] as const;

const EVENT_PROMPT_REQUIREMENTS: Record<string, readonly string[]> = {
  'world_event/emergency_broadcast/illustration': [
    'unattended civic communications room',
    'public-address speaker',
    'communications console',
    'abstract signal bars',
    'geometric blocks',
    'amber warning beacon',
  ],
  'world_event/medical_alert/illustration': [
    'hospital emergency supply station',
    'off-white cases',
    'muted green panels',
    'status beacon',
  ],
  'world_event/research_anomaly/illustration': [
    'contained instrument anomaly',
    'research chamber',
    'sealed glass apparatus',
    'blue-violet',
    'abstract waveforms',
  ],
  'world_event/citywide_unrest/illustration': [
    'disordered city intersection',
    'displaced lightweight barriers',
    'overturned bins',
    'scattered paper',
    'warning beacons',
  ],
};

const EVENT_FORBIDDEN_BY_TASK: Record<string, readonly string[]> = {
  'world_event/emergency_broadcast/illustration': ['readable text', 'map', 'coordinates'],
  'world_event/medical_alert/illustration': ['cross', 'logo', 'emblem', 'red cross'],
  'world_event/research_anomaly/illustration': ['monster', 'magic', 'portal'],
  'world_event/citywide_unrest/illustration': ['riot', 'protest', 'crowd', 'battle', 'soldier', 'weapon', 'fire', 'explosion', 'political logo'],
};

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
  dynamicEquipmentForbiddenTokenCount?: number;
  injuryForbiddenTokenCount?: number;
  militaryForbiddenTokenCount?: number;
  propTransitionLanguageCount?: number;
  postureOnlyContract?: boolean;
  handsEmptyContract?: boolean;
  staticSignaturePropContract?: boolean;
  singlePropContract?: boolean;
  failures: string[];
}

export interface SinglePropContractResult {
  passed: boolean;
  missing: string[];
  ambiguousState: boolean;
}

const SINGLE_PROP_REQUIREMENTS = [
  'a single pair of compact binoculars',
  'that same pair is lifted near his face',
  'one simple neck strap',
  'neck strap remains visibly connected to the raised binoculars',
  'center of his chest beneath the raised binoculars is visually clear',
] as const;

export function auditSinglePropTransitionPrompt(providerPrompt: string): SinglePropContractResult {
  const lower = providerPrompt.toLowerCase();
  const missing = SINGLE_PROP_REQUIREMENTS.filter((requirement) => !lower.includes(requirement));
  const ambiguousState = /\bbinoculars\s+(?:hang|hanging)\s+from\b/i.test(providerPrompt)
    || /\bhanging\b[\s\S]*\braised\b/i.test(providerPrompt)
    || /\braised\b[\s\S]*\bhanging\b/i.test(providerPrompt);
  return { passed: missing.length === 0 && !ambiguousState, missing: [...missing], ambiguousState };
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

export function auditCombatProviderPrompt(task: ArtTask, providerPrompt: string): PromptAuditResult {
  const base = auditCharacterProviderPrompt(task, providerPrompt);
  const dynamicTokens = FORBIDDEN_COMBAT_DYNAMIC_EQUIPMENT_TOKENS.filter((token) => tokenPattern(token).test(providerPrompt));
  const injuryTokens = FORBIDDEN_COMBAT_INJURY_TOKENS.filter((token) => tokenPattern(token).test(providerPrompt));
  const militaryTokens = FORBIDDEN_COMBAT_MILITARY_TOKENS.filter((token) => tokenPattern(token).test(providerPrompt));
  const propTransitionLanguageCount = FORBIDDEN_COMBAT_PROP_TRANSITION_PATTERNS.filter((pattern) => pattern.test(providerPrompt)).length;
  const singleProp = task.singlePropTransition ? auditSinglePropTransitionPrompt(providerPrompt) : null;
  const staticRequirements = [
    'one compact pair of binoculars hangs naturally at the center of his chest',
    'binoculars remain resting in their normal hanging position',
  ];
  const handsEmptyRequirements = [
    'both hands are away from the binoculars',
    'hands are empty',
  ];
  const postureRequirements = [
    'torso leans subtly forward',
    'shoulders are slightly raised and tense',
    'eyes focus sharply',
  ];
  const staticMissing = task.postureOnly ? staticRequirements.filter((requirement) => !providerPrompt.toLowerCase().includes(requirement)) : [];
  const handsEmptyMissing = task.handsEmpty ? handsEmptyRequirements.filter((requirement) => !providerPrompt.toLowerCase().includes(requirement)) : [];
  const postureMissing = task.postureOnly ? postureRequirements.filter((requirement) => !providerPrompt.toLowerCase().includes(requirement)) : [];
  const staticSignaturePropContract = task.postureOnly ? staticMissing.length === 0 && propTransitionLanguageCount === 0 : undefined;
  const handsEmptyContract = task.handsEmpty ? handsEmptyMissing.length === 0 : undefined;
  const postureOnlyContract = task.postureOnly ? staticSignaturePropContract === true && handsEmptyContract === true && postureMissing.length === 0 : undefined;
  const forbiddenTokens = [...new Set([...base.forbiddenTokens, ...dynamicTokens])];
  const dynamicFailures = dynamicTokens.map((token) => `dynamic equipment token: ${token}`);
  const injuryFailures = injuryTokens.map((token) => `injury-state token: ${token}`);
  const militaryFailures = militaryTokens.map((token) => `military token: ${token}`);
  const postureFailures = [
    ...staticMissing.map((requirement) => `missing static prop anchor: ${requirement}`),
    ...handsEmptyMissing.map((requirement) => `missing hands-empty anchor: ${requirement}`),
    ...postureMissing.map((requirement) => `missing posture anchor: ${requirement}`),
    ...(propTransitionLanguageCount > 0 ? [`prop transition language count: ${propTransitionLanguageCount}`] : []),
  ];
  const singlePropFailures = singleProp
    ? [
        ...singleProp.missing.map((requirement) => `missing single-prop anchor: ${requirement}`),
        ...(singleProp.ambiguousState ? ['ambiguous independent hanging/raised binocular state'] : []),
      ]
    : [];
  return {
    ...base,
    strategy: task.promptStrategy ?? 'standard',
    passed: base.passed && dynamicTokens.length === 0 && injuryTokens.length === 0 && militaryTokens.length === 0 && singlePropFailures.length === 0 && postureFailures.length === 0,
    forbiddenTokenCount: forbiddenTokens.length,
    forbiddenTokens,
    dynamicEquipmentForbiddenTokenCount: dynamicTokens.length,
    injuryForbiddenTokenCount: injuryTokens.length,
    militaryForbiddenTokenCount: militaryTokens.length,
    propTransitionLanguageCount,
    postureOnlyContract,
    handsEmptyContract,
    staticSignaturePropContract,
    singlePropContract: singleProp ? singleProp.passed : undefined,
    failures: [...base.failures, ...dynamicFailures, ...injuryFailures, ...militaryFailures, ...singlePropFailures, ...postureFailures],
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
  return auditTokenSet(task, providerPrompt, task.itemProductionCategory
    ? FORBIDDEN_ITEM_OBJECT_TOKENS
    : task.promptStrategy === 'item-positive-only'
      ? FORBIDDEN_ITEM_CATEGORY_TOKENS
      : FORBIDDEN_ITEM_MARKING_TOKENS);
}

export function auditEventProviderPrompt(task: ArtTask, providerPrompt: string): PromptAuditResult {
  const forbiddenTokens = [
    ...FORBIDDEN_EVENT_PERSON_TOKENS,
    ...FORBIDDEN_EVENT_UI_TOKENS,
    ...(EVENT_FORBIDDEN_BY_TASK[task.id] ?? []),
  ].filter((token, index, tokens) => tokens.indexOf(token) === index && tokenPattern(token).test(providerPrompt));
  const internalTaskId = providerPrompt.includes(task.id);
  const internalEntityId = tokenPattern(task.entityId).test(providerPrompt);
  const missingRequirements = (EVENT_PROMPT_REQUIREMENTS[task.id] ?? []).filter((token) => !providerPrompt.toLowerCase().includes(token.toLowerCase()));
  const failures = [
    ...forbiddenTokens.map((token) => `forbidden token: ${token}`),
    ...(internalTaskId ? [`internal task id: ${task.id}`] : []),
    ...(internalEntityId ? [`internal entity id: ${task.entityId}`] : []),
    ...missingRequirements.map((token) => `missing positive anchor: ${token}`),
  ];
  return {
    strategy: task.promptStrategy ?? 'standard',
    passed: failures.length === 0,
    forbiddenTokenCount: forbiddenTokens.length,
    forbiddenTokens,
    internalTaskId,
    internalEntityId,
    designSheetHeading: false,
    failures,
  };
}
