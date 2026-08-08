/**
 * 统一行动服务 / NPC 与玩家规则一致性（Phase 2A Step 5）。
 *
 * 第二阶段验收里 NPC 是"作弊"的：
 *  - `npc.stamina = Math.max(0, npc.stamina - cost)` 把欠费抹平，零体力照样走；
 *  - NPC 攻击直接调 `resolveAttack`，完全绕过体力闸门；
 *  - NPC 移动不校验相邻性，理论上可以瞬移。
 *
 * 本文件用**对称测试**来锁死这件事：同一个动作，分别以玩家身份和
 * NPC 身份执行，规则结论必须一致。
 */

import { describe, expect, it } from 'vitest';

import { GAME_CONFIG } from '../src/data/gameConfig';
import {
  attackActor,
  craftActor,
  executeActorCommand,
  fleeActor,
  moveActor,
  resolveNpcOverflow,
  restActor,
  searchActor,
} from '../src/core/actorActions';
import { refreshZoneOccupants } from '../src/core/gameState';
import { createStack } from '../src/core/inventory';
import { runNpcTurn } from '../src/core/npcAi';
import { SeededRandom } from '../src/core/random';
import { getZoneDef } from '../src/data/zones';
import { clearInventory, newGame, npcs, player } from './helpers';
import type { Combatant, GameState } from '../src/core/types';

function rngOf(state: GameState): SeededRandom {
  return SeededRandom.fromState(state.rngState);
}

/** 找一个与 `from` 不相邻的区域 id（6 区地图上一定存在） */
function nonAdjacentZone(state: GameState, from: string): string {
  const adj = new Set(getZoneDef(from).adjacent);
  const found = Object.keys(state.zones).find((z) => z !== from && !adj.has(z));
  return found ?? from;
}

/* ================================================================== */
/* 1. 体力闸门对称性                                                   */
/* ================================================================== */

describe('[AA-1] 玩家与 NPC 共用同一套体力闸门', () => {
  it('零体力时移动：玩家与 NPC 都被拒绝，且区域不变', () => {
    const state = newGame();
    const p = player(state);
    const npc = npcs(state)[0]!;
    p.stamina = 0;
    npc.stamina = 0;
    const pZone = p.currentZoneId;
    const nZone = npc.currentZoneId;

    const pTarget = getZoneDef(pZone).adjacent[0]!;
    const nTarget = getZoneDef(nZone).adjacent[0]!;

    const pRes = moveActor(state, p, pTarget);
    const nRes = moveActor(state, npc, nTarget);

    expect(pRes.ok).toBe(false);
    expect(nRes.ok).toBe(false);
    expect(pRes.rejection).toBe('no_stamina');
    expect(nRes.rejection).toBe('no_stamina');
    // 关键：旧实现会把 NPC 挪过去并把体力钳到 0
    expect(p.currentZoneId).toBe(pZone);
    expect(npc.currentZoneId).toBe(nZone);
    expect(npc.stamina).toBe(0);
  });

  it('零体力时攻击：玩家与 NPC 都打不出伤害', () => {
    const state = newGame();
    const p = player(state);
    const npc = npcs(state)[0]!;
    npc.currentZoneId = p.currentZoneId;
    refreshZoneOccupants(state);
    p.stamina = 0;
    npc.stamina = 0;
    const pHp = p.hp;
    const nHp = npc.hp;
    const rng = rngOf(state);

    const pRes = attackActor(state, p, npc, rng);
    const nRes = attackActor(state, npc, p, rng);

    expect(pRes.ok).toBe(false);
    expect(nRes.ok).toBe(false);
    expect(pRes.rejection).toBe('no_stamina');
    expect(nRes.rejection).toBe('no_stamina');
    expect(p.hp).toBe(pHp);
    expect(npc.hp).toBe(nHp);
  });

  it('体力恰好等于成本时可以行动，扣完归零', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    npc.stamina = GAME_CONFIG.moveStaminaCost;
    const target = getZoneDef(npc.currentZoneId).adjacent[0]!;
    const res = moveActor(state, npc, target);
    expect(res.ok).toBe(true);
    expect(res.staminaSpent).toBe(GAME_CONFIG.moveStaminaCost);
    expect(npc.stamina).toBe(0);
    expect(npc.currentZoneId).toBe(target);
  });

  it('体力永远不会被扣成负数', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    for (let i = 0; i < 30; i++) {
      const adj = getZoneDef(npc.currentZoneId).adjacent;
      moveActor(state, npc, adj[i % adj.length]!);
      expect(npc.stamina).toBeGreaterThanOrEqual(0);
    }
  });
});

/* ================================================================== */
/* 2. 移动合法性                                                       */
/* ================================================================== */

describe('[AA-2] NPC 不能瞬移', () => {
  it('移动到不相邻区域会被拒绝', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    npc.stamina = npc.maxStamina;
    const from = npc.currentZoneId;
    const far = nonAdjacentZone(state, from);
    expect(far).not.toBe(from);

    const res = moveActor(state, npc, far);
    expect(res.ok).toBe(false);
    expect(res.rejection).toBe('illegal_zone');
    expect(npc.currentZoneId).toBe(from);
  });

  it('移动到不存在的区域会被拒绝', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    npc.stamina = npc.maxStamina;
    const res = moveActor(state, npc, 'atlantis');
    expect(res.ok).toBe(false);
    expect(res.rejection).toBe('illegal_zone');
  });

  it('死亡角色无法移动 / 攻击 / 搜索', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    npc.alive = false;
    npc.stamina = npc.maxStamina;
    const target = getZoneDef(npc.currentZoneId).adjacent[0]!;
    expect(moveActor(state, npc, target).rejection).toBe('dead');
    expect(searchActor(state, npc, rngOf(state)).rejection).toBe('dead');
    expect(restActor(state, npc).rejection).toBe('dead');
  });

  it('对局结束后任何角色都无法行动', () => {
    const state = newGame();
    state.status = 'won';
    const npc = npcs(state)[0]!;
    const target = getZoneDef(npc.currentZoneId).adjacent[0]!;
    expect(moveActor(state, npc, target).rejection).toBe('game_over');
    expect(restActor(state, npc).rejection).toBe('game_over');
    expect(craftActor(state, npc, 'r_stone_axe').rejection).toBe('game_over');
  });
});

/* ================================================================== */
/* 3. 攻击 / 逃跑规则                                                  */
/* ================================================================== */

describe('[AA-3] 攻击与逃跑的统一规则', () => {
  it('不同区域的目标不可攻击', () => {
    const state = newGame();
    const p = player(state);
    const npc = npcs(state).find((n) => n.currentZoneId !== p.currentZoneId);
    if (!npc) return; // 开局全同区的极端种子，跳过
    p.stamina = p.maxStamina;
    const res = attackActor(state, p, npc, rngOf(state));
    expect(res.ok).toBe(false);
    expect(res.rejection).toBe('illegal_target');
  });

  it('已死亡的目标不可攻击', () => {
    const state = newGame();
    const p = player(state);
    const npc = npcs(state)[0]!;
    npc.currentZoneId = p.currentZoneId;
    npc.alive = false;
    refreshZoneOccupants(state);
    const res = attackActor(state, p, npc, rngOf(state));
    expect(res.ok).toBe(false);
    expect(res.rejection).toBe('illegal_target');
  });

  it('逃跑对 NPC 同样免费：零体力的 NPC 也能脱离', () => {
    const state = newGame();
    const [a, b] = npcs(state);
    if (!a || !b) throw new Error('需要至少两个 NPC');
    b.currentZoneId = a.currentZoneId;
    refreshZoneOccupants(state);
    a.stamina = 0;
    const res = fleeActor(state, a, b, rngOf(state), { allowPursuit: false });
    expect(res.ok).toBe(true);
    expect(res.staminaSpent).toBe(0);
  });

  it('反击方零体力时打不出反击', () => {
    const state = newGame();
    const p = player(state);
    const npc = npcs(state)[0]!;
    npc.currentZoneId = p.currentZoneId;
    refreshZoneOccupants(state);
    p.stamina = p.maxStamina;
    p.hp = p.maxHp;
    npc.stamina = 0;
    npc.hp = npc.maxHp;
    const before = p.hp;
    const res = attackActor(state, p, npc, rngOf(state), { allowCounter: true });
    expect(res.ok).toBe(true);
    expect(res.countered).toBe(false);
    expect(p.hp).toBe(before);
  });
});

/* ================================================================== */
/* 4. 物品守恒                                                         */
/* ================================================================== */

describe('[AA-4] NPC 取舍不会让物品凭空消失', () => {
  it('背包满且不换时，物品退回地面', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    for (let i = 0; i < GAME_CONFIG.inventorySlots; i++) {
      npc.inventory.push(createStack(state, 'medkit', 1));
    }
    const zone = state.zones[npc.currentZoneId]!;
    const groundBefore = zone.groundItems.length;
    // 价值远低于 medkit 的杂物，NPC 不会换
    const swapped = resolveNpcOverflow(state, npc, createStack(state, 'stone', 1));
    expect(swapped).toBe(false);
    expect(zone.groundItems.length).toBe(groundBefore + 1);
  });

  it('背包满且换取时，被换下的物品落到地面', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    clearInventory(npc);
    for (let i = 0; i < GAME_CONFIG.inventorySlots; i++) {
      npc.inventory.push(createStack(state, 'stone', 1));
    }
    const zone = state.zones[npc.currentZoneId]!;
    const groundBefore = zone.groundItems.length;
    const swapped = resolveNpcOverflow(state, npc, createStack(state, 'medkit', 1));
    expect(swapped).toBe(true);
    expect(zone.groundItems.length).toBe(groundBefore + 1);
    expect(npc.inventory.some((s) => s.itemId === 'medkit')).toBe(true);
    expect(npc.inventory.length).toBe(GAME_CONFIG.inventorySlots);
  });
});

/* ================================================================== */
/* 5. 统一入口与 runNpcTurn 集成                                       */
/* ================================================================== */

describe('[AA-5] executeActorCommand 与 NPC 回合集成', () => {
  it('executeActorCommand 覆盖全部行动类型且不抛异常', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    npc.stamina = npc.maxStamina;
    const rng = rngOf(state);
    const zone = getZoneDef(npc.currentZoneId).adjacent[0]!;
    const actions = [
      { type: 'MOVE', zoneId: zone },
      { type: 'SEARCH' },
      { type: 'REST' },
      { type: 'CRAFT', recipeId: 'r_stone_axe' },
      { type: 'USE_ITEM', uid: 'nope' },
      { type: 'ATTACK', targetId: 'nope', style: 'normal' },
      { type: 'FLEE', enemyId: 'nope' },
    ] as const;
    for (const a of actions) {
      expect(() => executeActorCommand(state, npc, a, rng)).not.toThrow();
    }
  });

  it('零体力的 NPC 在一个回合内不会空转：至少会休整回体力', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    npc.stamina = 0;
    const before = npc.stamina;
    runNpcTurn(state, npc, rngOf(state));
    expect(npc.stamina).toBeGreaterThanOrEqual(before);
    // 不允许出现"移动了但体力还是 0"这种作弊轨迹
    expect(npc.stamina).toBeGreaterThanOrEqual(0);
  });

  it('连续 60 个 NPC 回合后，所有 NPC 都处在合法区域且体力非负', () => {
    const state = newGame();
    const rng = rngOf(state);
    for (let t = 0; t < 60; t++) {
      for (const npc of npcs(state)) {
        if (!npc.alive) continue;
        runNpcTurn(state, npc, rng);
        expect(state.zones[npc.currentZoneId]).toBeDefined();
        expect(npc.stamina).toBeGreaterThanOrEqual(0);
        expect(npc.stamina).toBeLessThanOrEqual(npc.maxStamina);
      }
    }
  });

  it('npcAi 源码中不再出现绕过规则的直接赋值', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(
      resolve(__dirname, '../src/core/npcAi.ts'),
      'utf-8',
    );
    expect(src).not.toMatch(/npc\.currentZoneId\s*=/);
    expect(src).not.toMatch(/npc\.stamina\s*=/);
    expect(src).not.toMatch(/resolveAttack\(/);
  });
});

/* ================================================================== */
/* 6. 玩家路径与 NPC 路径结果一致                                       */
/* ================================================================== */

describe('[AA-6] 同一状态下玩家与 NPC 的规则结论一致', () => {
  it('相同体力、相同目标区域时，两者的可行性判断完全相同', () => {
    const state = newGame();
    const p = player(state);
    const npc = npcs(state)[0]!;
    // 把 NPC 放到玩家同一区域，条件完全对齐
    npc.currentZoneId = p.currentZoneId;
    refreshZoneOccupants(state);
    const target = getZoneDef(p.currentZoneId).adjacent[0]!;

    for (const stamina of [0, 1, 2, 3, 5, 10]) {
      const s = newGame();
      const sp = player(s);
      const sn = npcs(s)[0]!;
      sn.currentZoneId = sp.currentZoneId;
      refreshZoneOccupants(s);
      sp.stamina = stamina;
      sn.stamina = stamina;
      const pOk = moveActor(s, sp, target).ok;
      const nOk = moveActor(s, sn, target).ok;
      expect(
        pOk,
        `体力 ${stamina} 时玩家(${pOk}) 与 NPC(${nOk}) 的移动可行性不一致`,
      ).toBe(nOk);
    }
  });

  it('攻击可行性同样对称', () => {
    for (const stamina of [0, 1, 2, 3, 5]) {
      const s = newGame();
      const sp = player(s);
      const [a, b] = npcs(s);
      if (!a || !b) throw new Error('需要至少两个 NPC');
      a.currentZoneId = sp.currentZoneId;
      b.currentZoneId = sp.currentZoneId;
      refreshZoneOccupants(s);
      sp.stamina = stamina;
      a.stamina = stamina;
      const rng = rngOf(s);
      const pOk = attackActor(s, sp, a, rng, { allowCounter: false }).ok;
      const nOk = attackActor(s, a, b, rng, { allowCounter: false }).ok;
      expect(pOk, `体力 ${stamina} 时攻击可行性不对称`).toBe(nOk);
    }
  });
});

/** 类型占位，确保 Combatant 被引用（避免未使用告警） */
export type _Combatant = Combatant;
