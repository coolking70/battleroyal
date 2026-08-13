import { getLandmarkDef } from '../data/landmarks';
import { canPayStamina, clampStamina, gainStamina } from './actionCosts';
import { addNoise } from './info';
import { landmarkState } from './landmarks';
import { consumeOne, countItem } from './inventory';
import { pushEvent } from './events';
import { applyHealing } from './vitals';
import type { Combatant, GameState } from './types';

function interactionCost(actor: Combatant, landmarkId: string): number {
  const engineerBonus = actor.characterId === 'engineer' && ['factory_machine_shop', 'underground_service_room'].includes(landmarkId) ? 1 : 0;
  return Math.max(1, 2 - engineerBonus);
}

function hasRequirement(state: GameState, actor: Combatant, landmarkId: string): boolean {
  const interaction = getLandmarkDef(landmarkId).interaction;
  if (!interaction) return false;
  if (interaction.requiredItemId && countItem(actor, interaction.requiredItemId) < 1 && actor.characterId !== 'engineer') return false;
  if (interaction.requiredLandmarkId) {
    const prerequisite = landmarkState(state, interaction.requiredLandmarkId);
    if (!prerequisite?.activated && !prerequisite?.repaired) return false;
  }
  return true;
}

export function canUseFacility(state: GameState, actor: Combatant, landmarkId: string, interactionId: string): { ok: boolean; reason: string | null; cost: number } {
  const def = getLandmarkDef(landmarkId);
  const runtime = landmarkState(state, landmarkId);
  const interaction = def.interaction;
  const cost = interactionCost(actor, landmarkId);
  if (state.status !== 'playing') return { ok: false, reason: '对局已经结束。', cost };
  if (!actor.alive) return { ok: false, reason: '已死亡的角色无法使用设施。', cost };
  if (actor.currentZoneId !== def.zoneId) return { ok: false, reason: '该设施不在当前区域。', cost };
  if (!interaction || interaction.id !== interactionId || !runtime) return { ok: false, reason: '设施交互不存在。', cost };
  if (runtime.locked) return { ok: false, reason: '设施尚未解锁。', cost };
  if (runtime.disabled && !interaction?.requiresRepair) return { ok: false, reason: '设施已停用，需要先修复。', cost };
  if (runtime.charges < interaction.chargeCost) return { ok: false, reason: '设施次数已经耗尽。', cost };
  if (!hasRequirement(state, actor, landmarkId)) return { ok: false, reason: '缺少设施所需的工具或前置状态。', cost };
  const check = canPayStamina(actor, cost);
  return check.ok ? { ok: true, reason: null, cost } : { ok: false, reason: check.reason, cost };
}

export function interactFacility(state: GameState, actor: Combatant, landmarkId: string, interactionId: string): { ok: boolean; message: string; staminaSpent: number } {
  const check = canUseFacility(state, actor, landmarkId, interactionId);
  if (!check.ok) return { ok: false, message: check.reason ?? '无法使用设施。', staminaSpent: 0 };
  const def = getLandmarkDef(landmarkId);
  const runtime = landmarkState(state, landmarkId)!;
  const interaction = def.interaction!;
  const before = actor.stamina;
  actor.stamina = clampStamina(actor, actor.stamina - check.cost);
  if (interaction.requiredItemId && countItem(actor, interaction.requiredItemId) > 0) {
    const required = actor.inventory.find((stack) => stack.itemId === interaction.requiredItemId);
    if (required) consumeOne(actor, required.uid);
  }
  runtime.charges -= interaction.chargeCost;
  runtime.discovered = true;
  runtime.activated = true;
  runtime.lastUsedAt = state.time;
  if (interaction.requiresRepair) {
    runtime.disabled = false;
    runtime.repaired = true;
  }
  if (interaction.requiresUnlock) runtime.locked = false;
  if (interaction.effectType === 'service_system') {
    const passage = state.landmarks['underground_sealed_passage'];
    if (passage) passage.locked = false;
  }
  if (interaction.effectType === 'treat_wounds') {
    const heal = actor.characterId === 'medic' ? 32 : 22;
    applyHealing(state, actor, heal);
  } else if (interaction.effectType === 'field_prep') {
    gainStamina(actor, actor.characterId === 'survivor' ? 12 : 8);
  } else if (interaction.effectType === 'restore_control' || interaction.effectType === 'start_generator') {
    const zone = state.zones[def.zoneId];
    if (zone) zone.lastNoiseTime = state.time;
  } else if (interaction.effectType === 'workbench') {
    // One finite public activation is enough to make the facility meaningful;
    // no free craft flag is created and the existing CRAFT gate stays intact.
    addNoise(state, def.zoneId, 'search');
  }
  pushEvent(state, {
    type: 'FACILITY_USED', actorId: actor.id, zoneId: def.zoneId,
    message: `${actor.name} 使用了${def.name}：${interaction.label}。`,
    metadata: { landmarkId, interactionId, remainingCharges: runtime.charges },
  });
  if (runtime.activated && runtime.lastUsedAt === state.time) {
    pushEvent(state, { type: 'FACILITY_ACTIVATED', actorId: actor.id, zoneId: def.zoneId, message: `${def.name}状态已更新。`, metadata: { landmarkId, interactionId } });
  }
  state.stats.facilityUses = (state.stats.facilityUses ?? 0) + 1;
  state.stats.facilityActivations = (state.stats.facilityActivations ?? 0) + 1;
  return { ok: true, message: `${interaction.label}完成。`, staminaSpent: before - actor.stamina };
}
