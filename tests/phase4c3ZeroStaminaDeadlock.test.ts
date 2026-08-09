/**
 * Phase 4C-3：最后一个安全区的零体力遭遇不变量。
 *
 * 这些测试刻意绕开完整时间推进，直接验证战斗行动服务的结算结果；
 * 这样可以把“原地脱离不会触发追击”与 NPC/玩家共用路径的断言隔离出来。
 */

import { describe, expect, it } from 'vitest';

import {
  canPayActionCost,
  getActionStaminaCost,
} from '../src/core/actionCosts';
import { executeActorCommand } from '../src/core/actorActions';
import { getLegalPlayerCommands, getTimeAdvancingActions } from '../src/core/legalActions';
import { SeededRandom } from '../src/core/random';
import { refreshZoneOccupants } from '../src/core/gameState';
import { clearInventory, newGame, npcs, player } from './helpers';
import type { Combatant, GameState } from '../src/core/types';

function stageLastSafeEncounter(): { state: GameState; p: Combatant; npc: Combatant } {
  const state = newGame('PHASE4C3-DEADLOCK');
  const p = player(state);
  const npc = npcs(state)[0]!;
  npc.currentZoneId = p.currentZoneId;
  npc.alive = true;
  refreshZoneOccupants(state);
  state.encounter = {
    enemyId: npc.id,
    zoneId: p.currentZoneId,
    startedAtTime: state.time,
    log: [],
    resolved: false,
  };
  for (const zone of Object.values(state.zones)) {
    if (zone.id !== p.currentZoneId) zone.status = 'restricted';
  }
  p.stamina = 0;
  npc.stamina = npc.maxStamina;
  clearInventory(p);
  return { state, p, npc };
}

describe('Phase 4C-3：零体力遭遇不变量', () => {
  it('最后一个安全区 + 零体力时，合法集合含有可推进且可成功执行的脱离动作', () => {
    const { state, p, npc } = stageLastSafeEncounter();
    const actions = getTimeAdvancingActions(state);
    const flee = actions.find((action) => action.command.type === 'FLEE');

    expect(flee).toBeDefined();
    expect(flee?.advancesTime).toBe(true);
    expect(getLegalPlayerCommands(state).map((action) => action.command.type)).toContain('FLEE');

    const hpBefore = p.hp;
    const result = executeActorCommand(
      state,
      p,
      { type: 'FLEE', enemyId: npc.id },
      new SeededRandom('PHASE4C3-PLAYER-FLEE'),
    );
    expect(result.ok).toBe(true);
    expect(result.message).toContain('原地脱离');
    expect(p.hp).toBe(hpBefore);
  });

  it('无相邻可退区域时逃跑成功且不会触发追击', () => {
    const { state, p, npc } = stageLastSafeEncounter();
    npc.stamina = npc.maxStamina;
    const hpBefore = p.hp;

    const result = executeActorCommand(
      state,
      p,
      { type: 'FLEE', enemyId: npc.id },
      new SeededRandom('PHASE4C3-NO-EXIT'),
    );

    expect(result.ok).toBe(true);
    expect(result.message).toContain('原地脱离');
    expect(result.message).not.toContain('追击');
    expect(p.hp).toBe(hpBefore);
    const escape = state.events.at(-1);
    expect(escape?.type).toBe('CHARACTER_ESCAPED');
    expect(escape?.metadata).toMatchObject({ success: true, reason: 'no_exit', stationary: true });
  });

  it('防御只在恰好零体力时免费，1 点体力仍不能支付完整成本', () => {
    const { state, p, npc } = stageLastSafeEncounter();
    npc.stamina = 0;

    expect(getActionStaminaCost(p, 'GUARD')).toBe(0);
    expect(canPayActionCost(p, 'GUARD').ok).toBe(true);
    expect(getLegalPlayerCommands(state).map((action) => action.command.type)).toContain('GUARD');

    const playerGuard = executeActorCommand(state, p, { type: 'GUARD' }, new SeededRandom('PHASE4C3-PLAYER-GUARD'));
    const npcGuard = executeActorCommand(state, npc, { type: 'GUARD' }, new SeededRandom('PHASE4C3-NPC-GUARD'));
    expect(playerGuard.ok).toBe(true);
    expect(playerGuard.staminaSpent).toBe(0);
    expect(p.guarding).toBe(true);
    expect(npcGuard.ok).toBe(true);
    expect(npcGuard.staminaSpent).toBe(0);
    expect(npc.guarding).toBe(true);

    p.stamina = 1;
    expect(getActionStaminaCost(p, 'GUARD')).toBe(2);
    expect(canPayActionCost(p, 'GUARD').ok).toBe(false);
  });

  it('NPC 在同样的最后安全区条件下使用相同的原地脱离规则', () => {
    const { state, p, npc } = stageLastSafeEncounter();
    const npcHpBefore = npc.hp;
    const result = executeActorCommand(
      state,
      npc,
      { type: 'FLEE', enemyId: p.id },
      new SeededRandom('PHASE4C3-NPC-FLEE'),
    );

    expect(result.ok).toBe(true);
    expect(result.message).toContain('原地脱离');
    expect(result.message).not.toContain('追击');
    expect(npc.hp).toBe(npcHpBefore);
    expect(npc.currentZoneId).toBe(p.currentZoneId);
  });
});
