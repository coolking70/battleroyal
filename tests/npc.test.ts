import { describe, expect, it } from 'vitest';
import { decideNpcAction } from '../src/core/npcAi';
import { refreshZoneOccupants } from '../src/core/gameState';
import { SeededRandom } from '../src/core/random';
import { executeCommand } from '../src/core/gameEngine';
import type { Combatant, GameState, Personality } from '../src/core/types';
import { clearInventory, give, newGame, npcs, player } from './helpers';

/** 把除 target 之外的所有人挪到 school，target 单独放到 lab */
function isolate(state: GameState, target: Combatant, zoneId = 'lab'): void {
  for (const id of state.turnOrder) {
    const c = state.characters[id];
    if (c) c.currentZoneId = 'school';
  }
  target.currentZoneId = zoneId;
  refreshZoneOccupants(state);
}

/** 让 npc 与玩家在同一区域，且双方都处于「可以正常决策」的状态 */
function faceOff(state: GameState, npc: Combatant): Combatant {
  const p = player(state);
  isolate(state, npc, 'lab');
  p.currentZoneId = 'lab';
  refreshZoneOccupants(state);
  npc.hp = npc.maxHp;
  npc.stamina = npc.maxStamina;
  clearInventory(npc);
  return p;
}

/** 统计某人格在 n 次决策中各类行动的出现次数 */
function tally(
  build: (state: GameState, npc: Combatant) => void,
  personality: Personality,
  n: number,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const state = newGame(`NPC-${personality}-${i}`);
    const npc = npcs(state)[0]!;
    npc.personality = personality;
    build(state, npc);
    const rng = new SeededRandom(`roll-${i}`);
    const decision = decideNpcAction(state, npc, rng);
    counts[decision.kind] = (counts[decision.kind] ?? 0) + 1;
  }
  return counts;
}

describe('NPC 人格与决策', () => {
  it('每局都会出现全部 5 种人格，且互不重复', () => {
    const state = newGame();
    const list = npcs(state);
    expect(list).toHaveLength(5);
    expect(new Set(list.map((n) => n.personality)).size).toBe(5);
  });

  it('身处禁区时，任何人格都优先撤离', () => {
    const personalities: Personality[] = [
      'aggressive',
      'cautious',
      'collector',
      'opportunist',
      'random',
    ];
    for (const personality of personalities) {
      const state = newGame(`zone-${personality}`);
      const npc = npcs(state)[0]!;
      npc.personality = personality;
      isolate(state, npc, 'lab');
      state.zones['lab']!.status = 'restricted';

      const decision = decideNpcAction(state, npc, new SeededRandom('x'));
      expect(decision.kind).toBe('evacuate');
      expect(decision.zoneId).not.toBe('lab');
    }
  });

  it('生命过低且身上有治疗品时优先治疗', () => {
    const state = newGame('heal-case');
    const npc = npcs(state)[0]!;
    npc.personality = 'aggressive';
    isolate(state, npc);
    clearInventory(npc);
    npc.hp = 10;
    give(state, npc, 'medkit');

    const decision = decideNpcAction(state, npc, new SeededRandom('x'));
    expect(decision.kind).toBe('heal');
    expect(decision.uid).toBeTruthy();
  });

  it('体力低于阈值且无恢复品时选择休息', () => {
    const state = newGame('rest-case');
    const npc = npcs(state)[0]!;
    npc.personality = 'collector';
    isolate(state, npc);
    clearInventory(npc);
    npc.stamina = 3;

    const decision = decideNpcAction(state, npc, new SeededRandom('x'));
    expect(decision.kind).toBe('rest');
  });

  it('激进型比谨慎型更愿意主动开打', () => {
    const N = 120;
    const aggressive = tally(faceOff, 'aggressive', N);
    const cautious = tally(faceOff, 'cautious', N);

    const aggAttack = aggressive['attack'] ?? 0;
    const cauAttack = cautious['attack'] ?? 0;

    expect(aggAttack).toBeGreaterThan(cauAttack);
    // 两种人格都应当同时存在交战与避战两类决策，避免退化成常量行为
    expect(aggAttack).toBeGreaterThan(0);
    expect(cautious['flee_combat'] ?? 0).toBeGreaterThan(0);
  });

  it('收集型比激进型更愿意留在原地搜索', () => {
    const N = 120;
    const prep = (state: GameState, npc: Combatant) => {
      isolate(state, npc);
      clearInventory(npc);
      npc.hp = npc.maxHp;
      npc.stamina = npc.maxStamina;
    };
    const collector = tally(prep, 'collector', N);
    const aggressive = tally(prep, 'aggressive', N);

    expect(collector['search'] ?? 0).toBeGreaterThan(aggressive['search'] ?? 0);
    expect(aggressive['move'] ?? 0).toBeGreaterThan(collector['move'] ?? 0);
  });

  it('同一状态 + 同一随机数状态，决策完全可复现', () => {
    const state = newGame('npc-determinism');
    const npc = npcs(state)[0]!;
    faceOff(state, npc);

    const a = decideNpcAction(state, npc, SeededRandom.fromState(12345));
    const b = decideNpcAction(state, npc, SeededRandom.fromState(12345));
    expect(a).toEqual(b);
  });

  it('推进时间后 NPC 会真正产生行动记录', () => {
    let state = newGame('npc-acts');
    for (let i = 0; i < 3; i++) {
      state = executeCommand(state, { type: 'REST' }).state;
    }
    const acted = npcs(state).filter((n) => n.lastAction !== null);
    expect(acted.length).toBeGreaterThan(0);
    for (const n of acted) {
      expect(typeof n.lastActionReason).toBe('string');
    }
  });
});
