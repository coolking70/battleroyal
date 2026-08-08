/**
 * 合法行动服务与反死锁回归（Phase 2A Step 4）。
 *
 * 这里守护 Phase 2A 最重要的一条不变量：
 *
 * > 只要 `status === 'playing'` 且玩家存活，
 * > `hasTimeAdvancingAction(state)` 必须恒为 `true`。
 *
 * 测试分三层：
 *  1. **契约层**：`getLegalPlayerCommands` 返回的每一条命令，
 *     `executeCommand` 都必须接受（不允许"列出来却执行不了"）；
 *  2. **构造层**：把玩家人为塞进历史上出现过死锁的极端状态，逐个断言仍有出路；
 *  3. **随机层**：跑多局随机对局，每个时间单位都检查一次，用真实轨迹兜底。
 */

import { describe, expect, it } from 'vitest';

import { GAME_CONFIG } from '../src/data/gameConfig';
import { executeCommand } from '../src/core/gameEngine';
import { refreshZoneOccupants } from '../src/core/gameState';
import { createStack } from '../src/core/inventory';
import {
  findDeadlock,
  fleeIsFree,
  getLegalPlayerCommands,
  getTimeAdvancingActions,
  hasTimeAdvancingAction,
} from '../src/core/legalActions';
import { SeededRandom } from '../src/core/random';
import { clearInventory, give, newGame, npcs, player } from './helpers';
import type { Combatant, GameState } from '../src/core/types';

/** 把一名 NPC 拉到玩家所在区域并开启遭遇 */
function stageEncounter(state: GameState): Combatant {
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
  return npc;
}

/** 把背包塞满不可堆叠 / 高占位物品 */
function fillInventory(state: GameState, c: Combatant): void {
  clearInventory(c);
  while (c.inventory.length < GAME_CONFIG.inventorySlots) {
    c.inventory.push(createStack(state, 'scrap', 1));
  }
}

/* ================================================================== */
/* 1. 契约层：列出来的必须能执行                                       */
/* ================================================================== */

describe('[LA-1] getLegalPlayerCommands 的执行契约', () => {
  it('对局结束后不再返回任何合法命令', () => {
    const state = newGame();
    state.status = 'won';
    expect(getLegalPlayerCommands(state)).toHaveLength(0);
    expect(hasTimeAdvancingAction(state)).toBe(false);
    // 对局结束不算死锁
    expect(findDeadlock(state)).toBeNull();
  });

  it('玩家死亡后不再返回任何合法命令，且不判为死锁', () => {
    const state = newGame();
    player(state).alive = false;
    expect(getLegalPlayerCommands(state)).toHaveLength(0);
    expect(findDeadlock(state)).toBeNull();
  });

  it('开局状态下每一条合法命令都能被引擎接受', () => {
    const state = newGame();
    give(state, player(state), 'bandage', 1);
    give(state, player(state), 'iron_pipe', 1);
    const actions = getLegalPlayerCommands(state);
    expect(actions.length).toBeGreaterThan(5);
    for (const a of actions) {
      const res = executeCommand(state, a.command);
      expect(
        res.ok,
        `命令 ${JSON.stringify(a.command)} 被引擎拒绝：${res.message}`,
      ).toBe(true);
    }
  });

  it('遭遇战中每一条合法命令都能被引擎接受', () => {
    const state = newGame();
    stageEncounter(state);
    give(state, player(state), 'bandage', 1);
    const actions = getLegalPlayerCommands(state);
    // 遭遇中不得出现移动 / 搜索 / 休息这些会被阻塞的命令
    const types = new Set(actions.map((a) => a.command.type));
    expect(types.has('MOVE')).toBe(false);
    expect(types.has('SEARCH')).toBe(false);
    expect(types.has('REST')).toBe(false);
    expect(types.has('FLEE')).toBe(true);
    for (const a of actions) {
      const res = executeCommand(state, a.command);
      expect(
        res.ok,
        `命令 ${JSON.stringify(a.command)} 被引擎拒绝：${res.message}`,
      ).toBe(true);
    }
  });

  it('待决拾取时只返回 RESOLVE_PICKUP，且每条都能执行', () => {
    const state = newGame();
    const p = player(state);
    fillInventory(state, p);
    state.pendingPickup = {
      stack: createStack(state, 'medkit', 1),
      source: 'search',
      zoneId: p.currentZoneId,
    };
    const actions = getLegalPlayerCommands(state);
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) {
      expect(a.command.type).toBe('RESOLVE_PICKUP');
      const res = executeCommand(state, a.command);
      expect(
        res.ok,
        `命令 ${JSON.stringify(a.command)} 被引擎拒绝：${res.message}`,
      ).toBe(true);
    }
  });

  it('体力不足时不会把付不起的动作列为合法', () => {
    const state = newGame();
    const p = player(state);
    p.stamina = 0;
    const types = new Set(getLegalPlayerCommands(state).map((a) => a.command.type));
    expect(types.has('MOVE')).toBe(false);
    expect(types.has('SEARCH')).toBe(false);
    expect(types.has('CRAFT')).toBe(false);
    // 免费动作仍在
    expect(types.has('REST')).toBe(true);
  });
});

/* ================================================================== */
/* 2. 构造层：历史死锁场景逐个复现                                     */
/* ================================================================== */

describe('[LA-2] 反死锁回归：极端状态下仍有出路', () => {
  it('场景 1：体力归零、非遭遇 —— 休息永远可用', () => {
    const state = newGame();
    const p = player(state);
    p.stamina = 0;
    clearInventory(p);
    expect(hasTimeAdvancingAction(state)).toBe(true);
    expect(findDeadlock(state)).toBeNull();
    expect(getTimeAdvancingActions(state).some((a) => a.command.type === 'REST')).toBe(
      true,
    );
  });

  it('场景 2：体力归零 + 遭遇战 —— 逃跑免费，永远是出口', () => {
    const state = newGame();
    stageEncounter(state);
    const p = player(state);
    p.stamina = 0;
    clearInventory(p);
    expect(fleeIsFree(p)).toBe(true);
    expect(hasTimeAdvancingAction(state)).toBe(true);
    expect(getTimeAdvancingActions(state).map((a) => a.command.type)).toContain('FLEE');
  });

  it('场景 3：体力归零 + 遭遇战 + 全图禁区 + 空背包', () => {
    const state = newGame();
    stageEncounter(state);
    const p = player(state);
    p.stamina = 0;
    p.hp = 1;
    clearInventory(p);
    for (const zone of Object.values(state.zones)) {
      if (zone.id !== p.currentZoneId) zone.status = 'restricted';
    }
    expect(hasTimeAdvancingAction(state)).toBe(true);
    expect(findDeadlock(state)).toBeNull();
  });

  it('场景 4：背包已满 + 待决拾取 —— 解决型命令可解锁', () => {
    const state = newGame();
    const p = player(state);
    fillInventory(state, p);
    p.stamina = 0;
    state.pendingPickup = {
      stack: createStack(state, 'medkit', 1),
      source: 'search',
      zoneId: p.currentZoneId,
    };
    // 当前这一步没有任何推进时间的命令……
    expect(getTimeAdvancingActions(state)).toHaveLength(0);
    // ……但一步解锁之后就有了，所以不算死锁
    expect(hasTimeAdvancingAction(state)).toBe(true);
    expect(findDeadlock(state)).toBeNull();
  });

  it('场景 5：背包已满 + 待决拾取 + 遭遇战（双重阻塞）', () => {
    const state = newGame();
    const p = player(state);
    stageEncounter(state);
    fillInventory(state, p);
    p.stamina = 0;
    state.pendingPickup = {
      stack: createStack(state, 'medkit', 1),
      source: 'search',
      zoneId: p.currentZoneId,
    };
    expect(hasTimeAdvancingAction(state)).toBe(true);
  });

  it('场景 6：遭遇已结算但未关闭 + 体力归零', () => {
    const state = newGame();
    const npc = stageEncounter(state);
    state.encounter!.resolved = true;
    npc.alive = false;
    const p = player(state);
    p.stamina = 0;
    expect(hasTimeAdvancingAction(state)).toBe(true);
  });

  it('场景 7：所有相邻区域都是禁区 + 本区物资搜空 + 体力归零', () => {
    const state = newGame();
    const p = player(state);
    p.stamina = 0;
    const zone = state.zones[p.currentZoneId]!;
    zone.loot = [];
    zone.remainingLootCount = 0;
    zone.supply = 0;
    for (const z of Object.values(state.zones)) {
      if (z.id !== p.currentZoneId) z.status = 'restricted';
    }
    expect(hasTimeAdvancingAction(state)).toBe(true);
  });

  it('场景 8：玩家所在区域本身已是禁区且体力归零', () => {
    const state = newGame();
    const p = player(state);
    p.stamina = 0;
    state.zones[p.currentZoneId]!.status = 'restricted';
    expect(hasTimeAdvancingAction(state)).toBe(true);
  });
});

/* ================================================================== */
/* 3. 随机层：真实轨迹兜底                                             */
/* ================================================================== */

describe('[LA-3] 随机对局全程无死锁', () => {
  it('20 局随机走子，每个时间单位都存在可推进时间的行动', () => {
    for (let g = 0; g < 20; g++) {
      const seed = `LA-FUZZ-${g}`;
      const state0 = newGame(seed, ['scout', 'fighter', 'engineer', 'medic'][g % 4]);
      const rng = new SeededRandom(`${seed}-picker`);
      let state = state0;
      let guard = 0;

      while (state.status === 'playing' && guard < 400) {
        guard += 1;
        const report = findDeadlock(state);
        expect(report?.summary ?? null).toBeNull();

        const actions = getLegalPlayerCommands(state);
        expect(actions.length).toBeGreaterThan(0);

        // 优先挑推进时间的动作，保证对局能往前走
        const advancing = actions.filter((a) => a.advancesTime);
        const pool = advancing.length > 0 ? advancing : actions;
        const chosen = pool[rng.int(0, pool.length - 1)] ?? pool[0]!;
        const res = executeCommand(state, chosen.command);
        expect(
          res.ok,
          `第 ${g} 局 t=${state.time} 命令 ${JSON.stringify(chosen.command)} 被拒绝：${res.message}`,
        ).toBe(true);
        state = res.state;
      }

      expect(guard, `第 ${g} 局在 400 步内没有结束`).toBeLessThan(400);
      expect(state.status).not.toBe('playing');
    }
  });
});
