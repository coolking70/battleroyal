import type { ArtTask } from './types';

export interface CategoryPromptPolicy {
  includeCharacterSheet: boolean;
  allowPeople: boolean;
  allowEnvironment: boolean;
  hardConstraints: string[];
  avoid: string[];
}

const GENERIC_AVOID = ['text', 'watermark', 'logo', 'signature', 'bad anatomy', 'recognizable commercial IP'];

const BASE_CHARACTER_CONSTRAINTS = [
  'character artwork only',
  'exactly one adult survivor',
  'no firearm',
  'no rifle',
  'no sword',
  'no spear',
  'no bow',
  'no equipped weapon',
  'no weapon in either hand',
  'no weapon strapped to the back',
  'no HUD',
  'no interface frame',
];

export function promptPolicyFor(task: ArtTask): CategoryPromptPolicy {
  switch (task.category) {
    case 'character': {
      const scout = task.id === 'character/scout/portrait';
      return {
        includeCharacterSheet: true,
        allowPeople: true,
        allowEnvironment: false,
        hardConstraints: [
          ...BASE_CHARACTER_CONSTRAINTS,
          ...(scout ? [
            'approximately 28-32 years old',
            'mature young adult, not a teenager or schoolboy',
            'binoculars are the only prominent equipment',
            'the scout carries no weapon',
            'hands, back and shoulders are free of firearms or melee weapons',
          ] : []),
          'simple unobtrusive background',
        ],
        avoid: [...GENERIC_AVOID, 'firearm', 'rifle', 'sniper rifle', 'weapon', 'military combat loadout'],
      };
    }
    case 'zone':
      return {
        includeCharacterSheet: false,
        allowPeople: false,
        allowEnvironment: true,
        hardConstraints: [
          'ENVIRONMENT ONLY',
          'ZERO HUMANS',
          'ZERO PEOPLE',
          'ZERO CHARACTERS',
          'ZERO HUMAN SILHOUETTES',
          'no students or survivors',
          'no HUD',
          'no interface frame',
          'lower center remains visually calm and open for later overlay',
          'no major object in the lower center',
        ],
        avoid: [...GENERIC_AVOID, 'person', 'people', 'human', 'silhouette', 'portrait', 'HUD', 'interface frame', 'status indicator'],
      };
    case 'item':
      return {
        includeCharacterSheet: false,
        allowPeople: false,
        allowEnvironment: false,
        hardConstraints: [
          'ISOLATED INVENTORY OBJECT',
          'exactly one complete object centered in frame',
          'the object is the only subject',
          'plain neutral dark-gray or desaturated studio-style backdrop',
          'no environment',
          'no city',
          'no ruins',
          'no scenery',
          'no character',
          'no hand',
          'no interface',
          'no HUD',
          'no border or frame',
          'no arrows or buttons',
          'no text',
          'high silhouette readability at 32px',
        ],
        avoid: [...GENERIC_AVOID, 'urban setting', 'cityscape', 'ruined structures', 'environment', 'room', 'scenery', 'character', 'hand', 'HUD', 'interface', 'frame', 'arrows', 'buttons'],
      };
    case 'world_event': {
      const blackout = task.id === 'world_event/blackout/illustration';
      return {
        includeCharacterSheet: false,
        allowPeople: false,
        allowEnvironment: true,
        hardConstraints: [
          'atmospheric environmental illustration only',
          'generate only the illustration itself; no event card frame',
          'ZERO PEOPLE',
          'ZERO CHARACTERS',
          'ZERO WEAPONS',
          'no HUD',
          'no interface',
          ...(blackout ? [
            'ZERO RAIN',
            'no combat',
            'most normal lights are visibly powerless and switched off',
            'electronic displays are dark and powerless',
            'only sparse dim red emergency lamps remain active',
            'blackout itself is immediately recognizable as a recent loss of power',
          ] : []),
        ],
        avoid: [...GENERIC_AVOID, 'person', 'people', 'human', 'character', 'soldier', 'weapon', 'combat', 'HUD', 'status indicator', 'interface', ...(blackout ? ['rain', 'wet weather'] : [])],
      };
    }
  }
}

export function genericPromptAvoid(): string[] {
  return [...GENERIC_AVOID];
}
