import { describe, expect, it } from 'vitest';
import { executeCommand } from '../src/core/gameEngine';
import { createStack, addItem } from '../src/core/inventory';
import { newGame, player } from './helpers';

describe('Phase 4Q 设施交互', () => {
  it('手术室治疗使用有限 charges，终局与耗尽后均拒绝', () => {
    let state = newGame('PHASE4Q-FACILITY-HEAL');
    const actor = player(state);
    actor.currentZoneId = 'hospital';
    actor.hp = 40;
    actor.stamina = actor.maxStamina;
    for (const zone of Object.values(state.zones)) zone.wildEnemyIds = [];
    const runtime = state.landmarks.hospital_operating_room!;
    const initialCharges = runtime.charges;
    const result = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'hospital_operating_room', interactionId: 'treat_wounds' });
    expect(result.ok).toBe(true);
    expect(player(result.state).hp).toBeGreaterThan(40);
    expect(result.state.landmarks.hospital_operating_room!.charges).toBe(initialCharges - 1);
    expect(result.state.events.some((event) => event.type === 'FACILITY_USED')).toBe(true);

    state = result.state;
    state.landmarks.hospital_operating_room!.charges = 0;
    const exhausted = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'hospital_operating_room', interactionId: 'treat_wounds' });
    expect(exhausted.ok).toBe(false);
    state.status = 'won';
    const terminal = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'hospital_operating_room', interactionId: 'treat_wounds' });
    expect(terminal.ok).toBe(false);
    expect(terminal.state.landmarks.hospital_operating_room!.charges).toBe(0);
  });

  it('设施前置状态通过正式交互解锁，且消耗工具而不制造免费动作', () => {
    let state = newGame('PHASE4Q-FACILITY-UNLOCK');
    const actor = player(state);
    actor.currentZoneId = 'underground';
    actor.stamina = actor.maxStamina;
    addItem(actor, createStack(state, 'wire'));
    for (const zone of Object.values(state.zones)) zone.wildEnemyIds = [];
    const before = actor.stamina;
    const repaired = executeCommand(state, { type: 'INTERACT_LANDMARK', landmarkId: 'underground_service_room', interactionId: 'service_system' });
    expect(repaired.ok).toBe(true);
    expect(repaired.state.landmarks.underground_service_room!.repaired).toBe(true);
    expect(repaired.state.landmarks.underground_sealed_passage!.locked).toBe(false);
    expect(player(repaired.state).stamina).toBeLessThan(before);
    expect(player(repaired.state).inventory.some((stack) => stack.itemId === 'wire')).toBe(false);
  });
});
