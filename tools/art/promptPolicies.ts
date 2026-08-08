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

const SCOUT_HARD_CONSTRAINTS = [
  'waist-up portrait',
  'exactly one adult civilian man',
  'approximately 28-32 years old',
  'civilian urban observer',
  'binoculars are the only visible professional equipment',
  'both empty hands are visible',
  'both shoulders are clearly visible',
  'upper back is completely empty',
  'nothing extends above either shoulder',
  'no backpack',
  'no firearm',
  'no gun',
  'no rifle',
  'no sniper rifle',
  'no pistol',
  'no weapon',
  'no weapon sling',
  'no gun holster',
  'no tactical vest',
  'no plate carrier',
  'no chest rig',
  'no ammunition pouch',
  'no camouflage',
  'no military uniform',
  'not military personnel',
  'plain solid-color civilian clothing',
  'simple pale neutral background',
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
          ...(scout ? SCOUT_HARD_CONSTRAINTS : []),
          'simple unobtrusive background',
        ],
        avoid: [...GENERIC_AVOID, 'firearm', 'gun', 'rifle', 'sniper rifle', 'pistol', 'gun barrel', 'gun stock', 'weapon', 'weapon sling', 'holster', 'plate carrier', 'chest rig', 'ammunition pouch', 'military camouflage', 'soldier', 'special forces', 'tactical operator', 'combat vest', 'military combat loadout'],
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
          ...(blackout ? [
            'completely windowless indoor corridor',
            'underground commercial corridor',
            'completely empty corridor',
          ] : []),
          'generate only the illustration itself; no event card frame',
          'ZERO PEOPLE',
          'ZERO CHARACTERS',
          'ZERO WEAPONS',
          'no HUD',
          'no interface',
          ...(blackout ? [
            'ZERO WINDOWS',
            'ZERO RAIN',
            'no exterior view',
            'no street',
            'no sky',
            'no weather',
            'no rain',
            'no combat',
            'no frame',
            'no status bar',
            'every normal ceiling light is switched off',
            'ZERO illuminated white ceiling lights',
            'all digital screens are completely black',
            'all storefront lighting is off',
            'all escalator indicator lights are off',
            'no green indicator lights',
            'only sparse dim red emergency lamps remain active',
            'powerless electrical fixtures only',
            'the entire scene is predominantly dark',
            'recent electrical blackout is immediately recognizable',
          ] : []),
        ],
        avoid: [...GENERIC_AVOID, 'person', 'people', 'human', 'survivor', 'character', 'soldier', 'weapon', 'combat', 'HUD', 'status indicator', 'status bar', 'interface', 'card frame', ...(blackout ? ['rain', 'rainfall', 'wet street', 'street scene', 'outdoor city', 'weather', 'fire', 'explosion', 'collapsed ceiling', 'battle damage', 'flooding'] : [])],
      };
    }
  }
}

export function genericPromptAvoid(): string[] {
  return [...GENERIC_AVOID];
}
