import { describe, expect, it } from 'vitest';
import { validateSaveData } from '../src/core/saveValidation';
import { GAME_VERSION } from '../src/data/gameConfig';
import { newGame } from './helpers';

function saveOf(state: ReturnType<typeof newGame>): Record<string, unknown> {
  return { version: GAME_VERSION, savedAt: 1, seed: state.seed, time: state.time, rngState: state.rngState, state };
}

function valid(): Record<string, unknown> {
  return saveOf(newGame('PHASE4Q-SAVE-BASE'));
}

describe('Phase 4Q 地标存档校验', () => {
  const cases: Array<[string, (raw: any) => void]> = [
    ['unknown landmark', (raw) => { raw.state.landmarks.unknown = structuredClone(raw.state.landmarks.school_gym); }],
    ['duplicate landmark instance', (raw) => { raw.state.landmarks.school_gym.loot.push(raw.state.landmarks.school_science_classroom.loot[0]); }],
    ['wrong zone', (raw) => { raw.state.landmarks.school_gym.zoneId = 'hospital'; }],
    ['negative searches', (raw) => { raw.state.landmarks.school_gym.remainingSearches = -1; }],
    ['exhausted with remaining', (raw) => { raw.state.landmarks.school_gym.exhausted = true; raw.state.landmarks.school_gym.remainingSearches = 1; raw.state.landmarks.school_gym.loot = []; }],
    ['negative charge', (raw) => { raw.state.landmarks.hospital_operating_room.charges = -1; }],
    ['charge above max', (raw) => { raw.state.landmarks.hospital_operating_room.charges = 99; }],
    ['locked and activated', (raw) => { raw.state.landmarks.underground_sealed_passage.locked = true; raw.state.landmarks.underground_sealed_passage.activated = true; }],
    ['invalid interaction event', (raw) => { raw.state.events.push({ id: `e${raw.state.eventSeq}`, type: 'FACILITY_USED', time: raw.state.time, actorId: raw.state.playerId, targetId: null, zoneId: 'hospital', message: 'bad', importance: 'minor', metadata: { landmarkId: 'hospital_operating_room', interactionId: 'wrong' } }); raw.state.eventSeq += 1; raw.state.eventCounters.total += 1; }],
    ['invalid NPC recommended landmark', (raw) => { const npc = Object.values(raw.state.characters).find((candidate: any) => !candidate.isPlayer) as any; npc.planRecommendedLandmarkId = 'unknown'; npc.planRecommendedZoneId = 'school'; }],
    ['event unknown landmark', (raw) => { raw.state.events.push({ id: `e${raw.state.eventSeq}`, type: 'LANDMARK_SEARCHED', time: raw.state.time, actorId: raw.state.playerId, targetId: null, zoneId: 'school', message: 'bad', importance: 'minor', metadata: { landmarkId: 'unknown' } }); raw.state.eventSeq += 1; raw.state.eventCounters.total += 1; }],
    ['landmark loot duplicate UID', (raw) => { raw.state.landmarks.school_gym.loot.push(raw.state.landmarks.school_science_classroom.loot[0]); }],
  ];

  it.each(cases)('%s is rejected', (_name, mutate) => {
    const raw = valid();
    mutate(raw);
    expect(validateSaveData(raw).ok).toBe(false);
  });

  it('untouched current-schema landmark save is accepted', () => {
    expect(validateSaveData(valid()).ok).toBe(true);
  });
});
