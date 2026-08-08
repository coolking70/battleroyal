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
            'exactly one adult civilian survivor',
            'approximately 28-32 years old',
            'UNARMED civilian observer',
            'binoculars are the only prominent equipment',
            'both hands are fully visible and empty',
            'both shoulders are clearly visible',
            'the upper-back silhouette is visibly empty',
            'no object extends above either shoulder',
            'no firearm',
            'no gun',
            'no rifle',
            'no sniper rifle',
            'no pistol',
            'no bow',
            'no sword',
            'no melee weapon',
            'no gun holster',
            'no weapon sling',
            'no tactical combat vest',
            'no plate carrier',
            'no chest rig',
            'no ammunition pouch',
            'no camouflage pattern',
            'civilian outdoor clothing',
            'not military personnel',
            'not a soldier',
            'not a tactical operator',
          ] : []),
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
            'FULLY INDOOR SCENE',
            'completely empty corridor',
          ] : []),
          'generate only the illustration itself; no event card frame',
          'ZERO PEOPLE',
          'ZERO CHARACTERS',
          'ZERO WEAPONS',
          'no HUD',
          'no interface',
          ...(blackout ? [
            'ZERO RAIN',
            'no weather',
            'no exterior street',
            'no combat',
            'no frame',
            'no status bar',
            'nearly all normal lights are visibly switched off',
            'electronic screens are completely black',
            'powered advertising signs are dark',
            'only sparse dim red emergency lamps remain active',
            'recent electrical power failure is the unmistakable subject',
          ] : []),
        ],
        avoid: [...GENERIC_AVOID, 'person', 'people', 'human', 'survivor', 'character', 'soldier', 'weapon', 'combat', 'HUD', 'status indicator', 'status bar', 'interface', 'card frame', ...(blackout ? ['rain', 'rainfall', 'wet street', 'street scene', 'outdoor city', 'weather'] : [])],
      };
    }
  }
}

export function genericPromptAvoid(): string[] {
  return [...GENERIC_AVOID];
}
