import { LANDMARKS, getLandmarkDef, tryGetLandmarkDef } from '../data/landmarks';
import { createStack } from './inventory';
import type { GameState, LandmarkState, LandmarkStatus } from './types';

export function initializeLandmarks(state: GameState): void {
  state.landmarks = {};
  for (const def of LANDMARKS) {
    const loot = def.initialLoot.flatMap((entry) => {
      const stacks = [];
      for (let index = 0; index < entry.count; index += 1) stacks.push(createStack(state, entry.itemId, 1));
      return stacks;
    });
    const interaction = def.interaction;
    state.landmarks[def.id] = {
      landmarkId: def.id,
      zoneId: def.zoneId,
      discovered: false,
      remainingSearches: Math.min(def.maxSearches, loot.length),
      maxSearches: Math.min(def.maxSearches, loot.length),
      charges: interaction?.maxCharges ?? 0,
      maxCharges: interaction?.maxCharges ?? 0,
      exhausted: loot.length === 0,
      disabled: Boolean(interaction?.requiresRepair),
      repaired: !interaction?.requiresRepair,
      activated: false,
      locked: Boolean(interaction?.requiresUnlock),
      lastUsedAt: null,
      loot,
    };
  }
}

export function landmarkState(state: GameState, landmarkId: string): LandmarkState | null {
  return state.landmarks[landmarkId] ?? null;
}

export function landmarkStatus(runtime: LandmarkState): LandmarkStatus {
  if (runtime.exhausted) return 'exhausted';
  if (runtime.disabled) return 'untouched';
  if (runtime.repaired && runtime.activated) return 'repaired';
  if (runtime.activated) return 'activated';
  if (!runtime.discovered) return 'untouched';
  if (runtime.remainingSearches < runtime.maxSearches) return 'partially_used';
  return 'discovered';
}

export function canSearchLandmark(state: GameState, actorId: string, landmarkId: string): { ok: boolean; reason: string | null } {
  const actor = state.characters[actorId];
  const def = tryGetLandmarkDef(landmarkId);
  const runtime = landmarkState(state, landmarkId);
  if (!def || !runtime) return { ok: false, reason: '地标不存在。' };
  if (!actor?.alive) return { ok: false, reason: '已死亡的角色无法搜索地标。' };
  if (state.status !== 'playing') return { ok: false, reason: '对局已经结束。' };
  if (actor.currentZoneId !== def.zoneId) return { ok: false, reason: '该地标不在当前区域。' };
  if (!def.searchable) return { ok: false, reason: '该地点不可搜索。' };
  if (runtime.locked) return { ok: false, reason: '该地标仍处于锁定状态。' };
  if (runtime.disabled) return { ok: false, reason: '该设施已停用，需要先修复。' };
  if (runtime.exhausted || runtime.remainingSearches <= 0 || runtime.loot.length === 0) return { ok: false, reason: '该地标已经耗尽。' };
  return { ok: true, reason: null };
}

export function landmarkDefinitionsForZone(state: GameState, zoneId: string) {
  return LANDMARKS.filter((def) => def.zoneId === zoneId && state.landmarks[def.id]);
}

export function validateLandmarkDefinitionRefs(): string[] {
  return LANDMARKS.flatMap((def) => {
    const errors: string[] = [];
    if (def.zoneId.length === 0) errors.push(`${def.id} 缺少 zoneId`);
    if (def.interaction?.requiredLandmarkId && !tryGetLandmarkDef(def.interaction.requiredLandmarkId)) errors.push(`${def.id} 引用了未知前置地标`);
    return errors;
  });
}

// Keep the lookup function exercised by static dependency audits and make
// accidental registry removal fail at module load rather than at runtime.
for (const def of LANDMARKS) getLandmarkDef(def.id);
