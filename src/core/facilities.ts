import { getLandmarkDef } from '../data/landmarks';
import { canPayStamina, clampStamina, gainStamina } from './actionCosts';
import { addNoise } from './info';
import { landmarkState } from './landmarks';
import { consumeOne } from './inventory';
import { pushEvent } from './events';
import { applyHealing } from './vitals';
import { applyAccessTransitions, accessRequirementReason, missingAccessRequirements } from './accessChains';
import { consumeFacilityCharge, effectiveFacilityCharges } from './incidentEffects';
import type { Combatant, GameState } from './types';

function interactionCost(actor: Combatant, landmarkId: string): number {
  const engineerBonus = actor.characterId === 'engineer' && ['factory_machine_shop', 'underground_service_room'].includes(landmarkId) ? 1 : 0;
  return Math.max(1, 2 - engineerBonus);
}

function hasRequirement(state: GameState, actor: Combatant, landmarkId: string): boolean {
  const def = getLandmarkDef(landmarkId);
  return missingAccessRequirements(state, actor, def).length === 0;
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
  // The unlock interaction is the one legal action that can operate while
  // the facility is locked. Ordinary facility use still requires the normal
  // unlocked runtime state.
  if (runtime.locked && !interaction?.requiresUnlock) return { ok: false, reason: '设施尚未解锁。', cost };
  if (runtime.disabled && !interaction?.requiresRepair) return { ok: false, reason: '设施已停用，需要先修复。', cost };
  const effectiveCharges = effectiveFacilityCharges(state, landmarkId);
  if (effectiveCharges === null || effectiveCharges < interaction.chargeCost) return { ok: false, reason: '设施次数已经耗尽。', cost };
  if (!hasRequirement(state, actor, landmarkId)) return { ok: false, reason: accessRequirementReason(state, actor, def) ?? '缺少设施所需的工具或前置状态。', cost };
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
  if (interaction.requiredItemId && interaction.requiredItemConsumes !== false) {
    let remaining = interaction.requiredItemCount ?? 1;
    for (const required of actor.inventory.filter((stack) => stack.itemId === interaction.requiredItemId)) {
      while (remaining > 0 && required.count > 0) {
        consumeOne(actor, required.uid);
        remaining -= 1;
      }
      if (remaining === 0) break;
    }
  }
  consumeFacilityCharge(state, landmarkId, actor);
  runtime.discovered = true;
  runtime.activated = true;
  runtime.lastUsedAt = state.time;
  if (interaction.requiresRepair) {
    runtime.disabled = false;
    runtime.repaired = true;
  }
  if (interaction.requiresUnlock) runtime.locked = false;
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
    metadata: { landmarkId, interactionId, remainingCharges: effectiveFacilityCharges(state, landmarkId) ?? 0 },
  });
  if (runtime.activated && runtime.lastUsedAt === state.time) {
    pushEvent(state, { type: 'FACILITY_ACTIVATED', actorId: actor.id, zoneId: def.zoneId, message: `${def.name}状态已更新。`, metadata: { landmarkId, interactionId } });
  }
  applyAccessTransitions(state, actor.id, landmarkId);
  state.stats.facilityUses = (state.stats.facilityUses ?? 0) + 1;
  state.stats.facilityActivations = (state.stats.facilityActivations ?? 0) + 1;
  return { ok: true, message: `${interaction.label}完成。`, staminaSpent: before - actor.stamina };
}
