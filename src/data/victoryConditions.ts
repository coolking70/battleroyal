import type { VictoryType } from '../core/types';

export const EXTRACTION_ZONE_ID = 'station';
export const EXTRACTION_DELAY = 3;

export interface VictoryConditionDef {
  type: VictoryType;
  label: string;
  shortDescription: string;
  objectiveItemId: string | null;
  commandType: 'EXTRACT' | 'SUBMIT_RESEARCH' | null;
  progressVisibility: 'public' | 'private' | 'none';
}

export const VICTORY_CONDITIONS: readonly VictoryConditionDef[] = [
  {
    type: 'last_survivor',
    label: '最后生还者',
    shortDescription: '成为唯一存活的参赛者。',
    objectiveItemId: null,
    commandType: null,
    progressVisibility: 'none',
  },
  {
    type: 'extraction',
    label: '撤离',
    shortDescription: '在车站呼叫并完成一次撤离。',
    objectiveItemId: 'extraction_beacon',
    commandType: 'EXTRACT',
    progressVisibility: 'public',
  },
  {
    type: 'research',
    label: '研究',
    shortDescription: '制作研究成果包并在研究所提交。',
    objectiveItemId: 'research_package',
    commandType: 'SUBMIT_RESEARCH',
    progressVisibility: 'private',
  },
];

export const VICTORY_CONDITION_MAP: Readonly<Record<VictoryType, VictoryConditionDef>> =
  Object.fromEntries(VICTORY_CONDITIONS.map((condition) => [condition.type, condition])) as Record<VictoryType, VictoryConditionDef>;
