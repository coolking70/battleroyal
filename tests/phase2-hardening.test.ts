/**
 * 第二阶段 · 第一步：先写失败测试。
 *
 * 本文件覆盖 PHASE2_BASELINE.md §6 中列出的 7 个已知缺陷。
 * 在硬化改造完成之前，这些用例应当全部失败；改造完成后必须全部通过，
 * 之后作为长期回归护栏保留。
 */

import { describe, expect, it } from 'vitest';
import { GAME_VERSION } from '../src/data/gameConfig';
import { getZoneDef } from '../src/data/zones';
import { executeCommand } from '../src/core/gameEngine';
import { refreshZoneOccupants } from '../src/core/gameState';
import { createStack } from '../src/core/inventory';
import { SeededRandom } from '../src/core/random';
import { performSearch } from '../src/core/search';
import { isValidSaveData } from '../src/core/saveLoad';
import type { SaveData } from '../src/core/saveLoad';
import type { GameState } from '../src/core/types';
import { clearInventory, newGame, npcs, player } from './helpers';

/** 把一个 NPC 拉到玩家所在区域，返回该 NPC */
function bringEnemyToPlayer(state: GameState) {
  const p = player(state);
  const foe = npcs(state)[0]!;
  foe.currentZoneId = p.currentZoneId;
  refreshZoneOccupants(state);
  return foe;
}

/** 构造一份基于真实对局的存档，再按需破坏其中某个字段 */
function makeSave(state: GameState, mutate: (s: GameState) => void): SaveData {
  const cloned = JSON.parse(JSON.stringify(state)) as GameState;
  mutate(cloned);
  return {
    version: GAME_VERSION,
    savedAt: 1_700_000_000_000,
    seed: cloned.seed,
    time: cloned.time,
    rngState: cloned.rngState,
    state: cloned,
  };
}

describe('第二阶段硬化 · 体力闸门', () => {
  it('零体力时不能移动（当前缺陷：移动不校验体力）', () => {
    const state = newGame();
    const p = player(state);
    p.stamina = 0;

    const target = getZoneDef(p.currentZoneId).adjacent[0]!;
    const res = executeCommand(state, { type: 'MOVE', zoneId: target });

    expect(res.ok).toBe(false);
    expect(res.message ?? '').toContain('体力');
    // 状态不能被改变
    expect(player(res.state).currentZoneId).toBe(p.currentZoneId);
    expect(res.state.time).toBe(state.time);
  });

  it('零体力时不能攻击（当前缺陷：攻击不校验体力）', () => {
    const state = newGame();
    const p = player(state);
    const foe = bringEnemyToPlayer(state);
    const foeHpBefore = foe.hp;
    p.stamina = 0;

    const res = executeCommand(state, { type: 'ATTACK', targetId: foe.id, style: 'normal' });

    expect(res.ok).toBe(false);
    expect(res.message ?? '').toContain('体力');
    expect(res.state.characters[foe.id]!.hp).toBe(foeHpBefore);
    expect(res.state.time).toBe(state.time);
  });
});

describe('第二阶段硬化 · 有限物资', () => {
  it('区域物资是有限的，反复搜索后会被搜空（当前缺陷：supplyFloor 导致无限刷新）', () => {
    const state = newGame();
    const p = player(state);
    const rng = SeededRandom.fromState(state.rngState);

    // 把同区域的角色清走，避免搜索结果被「遭遇」抢占
    for (const npc of npcs(state)) {
      npc.currentZoneId = npc.currentZoneId === p.currentZoneId ? 'forest' : npc.currentZoneId;
    }
    if (p.currentZoneId === 'forest') {
      for (const npc of npcs(state)) npc.currentZoneId = 'lab';
    }
    refreshZoneOccupants(state);

    let found = 0;
    for (let i = 0; i < 300; i++) {
      p.stamina = p.maxStamina;
      clearInventory(p);
      const outcome = performSearch(state, p, rng);
      if (outcome.kind === 'item') found += 1;
    }

    // 规格：单区域 18~28 件普通 + 2~5 件稀有，上限 33 件
    expect(found).toBeLessThanOrEqual(33);

    // 搜空之后再搜 30 次，必须一件都出不来
    let extra = 0;
    for (let i = 0; i < 30; i++) {
      p.stamina = p.maxStamina;
      clearInventory(p);
      const outcome = performSearch(state, p, rng);
      if (outcome.kind === 'item') extra += 1;
    }
    expect(extra).toBe(0);
  });
});

describe('第二阶段硬化 · 存档深度校验', () => {
  it('损坏的存档必须被拒绝（当前缺陷：只做浅校验）', () => {
    const state = newGame();

    // 合法存档应当通过
    expect(isValidSaveData(makeSave(state, () => {}))).toBe(true);

    // 1) turnOrder 引用了不存在的角色
    expect(
      isValidSaveData(makeSave(state, (s) => s.turnOrder.push('ghost-999'))),
    ).toBe(false);

    // 2) 生命值越界
    expect(
      isValidSaveData(
        makeSave(state, (s) => {
          s.characters[s.playerId]!.hp = s.characters[s.playerId]!.maxHp + 50;
        }),
      ),
    ).toBe(false);

    // 3) 角色处在一个不存在的区域
    expect(
      isValidSaveData(
        makeSave(state, (s) => {
          s.characters[s.playerId]!.currentZoneId = 'atlantis';
        }),
      ),
    ).toBe(false);

    // 4) 区域存活名单引用了未知角色
    expect(
      isValidSaveData(
        makeSave(state, (s) => {
          const first = Object.values(s.zones)[0]!;
          first.aliveCharacterIds.push('ghost-999');
        }),
      ),
    ).toBe(false);

    // 5) 时间为负
    expect(isValidSaveData(makeSave(state, (s) => void (s.time = -3)))).toBe(false);

    // 6) 遭遇指向不存在的敌人
    expect(
      isValidSaveData(
        makeSave(state, (s) => {
          s.encounter = {
            enemyId: 'ghost-999',
            zoneId: s.characters[s.playerId]!.currentZoneId,
            startedAtTime: s.time,
            log: [],
            resolved: false,
          };
        }),
      ),
    ).toBe(false);
  });
});

describe('第二阶段硬化 · 死亡与状态一致性', () => {
  it('持续伤害必须触发死亡结算（当前缺陷：DoT 只把 hp 压到 0）', () => {
    const state = newGame();
    const p = player(state);
    p.statusEffects.push({
      id: 'test_poison',
      remaining: 3,
      hpPerTick: -999,
      label: '致命剧毒',
    });

    const res = executeCommand(state, { type: 'REST' });
    const after = player(res.state);

    expect(after.hp).toBe(0);
    expect(after.alive).toBe(false);
    expect(after.diedAtTime).not.toBeNull();
    expect(res.state.deathOrder).toContain(after.id);
    expect(res.state.status).toBe('lost');
  });
});

describe('第二阶段硬化 · 命令层错误边界', () => {
  it('非法配方不得抛出异常，只能返回失败（当前缺陷：getRecipe 直接 throw）', () => {
    const state = newGame();

    let outcome: boolean | 'threw' = 'threw';
    try {
      outcome = executeCommand(state, { type: 'CRAFT', recipeId: '__no_such_recipe__' }).ok;
    } catch {
      outcome = 'threw';
    }
    expect(outcome).toBe(false);
  });

  it('非法物品不得抛出异常，只能返回失败（当前缺陷：getItem 直接 throw）', () => {
    const state = newGame();
    const p = player(state);
    const zone = state.zones[p.currentZoneId]!;
    const bogus = createStack(state, 'wood', 1);
    bogus.itemId = '__no_such_item__';
    zone.groundItems.push(bogus);

    let outcome: boolean | 'threw' = 'threw';
    try {
      outcome = executeCommand(state, { type: 'PICKUP_GROUND', uid: bogus.uid }).ok;
    } catch {
      outcome = 'threw';
    }
    expect(outcome).toBe(false);
  });
});

describe('第二阶段硬化 · 遭遇完整性', () => {
  it('未解决的遭遇不能被直接关闭（当前缺陷：CLOSE_ENCOUNTER 无条件清空）', () => {
    const state = newGame();
    const p = player(state);
    const foe = bringEnemyToPlayer(state);
    state.encounter = {
      enemyId: foe.id,
      zoneId: p.currentZoneId,
      startedAtTime: state.time,
      log: [],
      resolved: false,
    };

    const res = executeCommand(state, { type: 'CLOSE_ENCOUNTER' });

    expect(res.ok).toBe(false);
    expect(res.state.encounter).not.toBeNull();
    expect(res.state.encounter?.enemyId).toBe(foe.id);
  });

  it('敌人已死亡 / 已离开后，遭遇可以正常关闭', () => {
    const state = newGame();
    const p = player(state);
    const foe = bringEnemyToPlayer(state);
    state.encounter = {
      enemyId: foe.id,
      zoneId: p.currentZoneId,
      startedAtTime: state.time,
      log: [],
      resolved: true,
    };

    const res = executeCommand(state, { type: 'CLOSE_ENCOUNTER' });

    expect(res.ok).toBe(true);
    expect(res.state.encounter).toBeNull();
  });
});
