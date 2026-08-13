/** Phase 4O unified victory model. */
export type VictoryType = 'last_survivor' | 'extraction' | 'research';

export interface VictoryState {
  winnerId: string | null;
  type: VictoryType | null;
  declaredAtTime: number | null;
}

export type ExtractionPhase = 'called' | 'ready';

export interface ActiveExtraction {
  callerId: string;
  zoneId: string;
  startedAtTime: number;
  readyAtTime: number;
  phase: ExtractionPhase;
}
