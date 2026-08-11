/**
 * Phase 2A Step 8 · 存档深度校验回归测试。
 *
 * 与 `phase2a-acceptance.test.ts` 的 [2A-F] 小节互为补充：
 * [2A-F] 验证「关键损坏必须被拒」这条**契约**被实现守住；
 * 本文件用 **≥30 个独立损坏用例**穷举结构 / 数值 / 引用 / 一致性四层，
 * 确保任何一类手改存档都会被 `validateSaveData` 拦下。
 *
 * 每个用例都通过「先克隆一份合法存档，再定向损坏某一处」来构造，
 * 对照组确认合法存档本身能通过。
 */

import { describe, expect, it } from 'vitest';
import { newGame } from './helpers';
import { validateSaveData } from '../src/core/saveLoad';
import { GAME_CONFIG } from '../src/data/gameConfig';
import type { GameState } from '../src/core/types';

/** 生成一份合法存档的深层克隆，便于定向损坏 */
function makeSave(state: GameState): Record<string, unknown> {
  return {
    version: state.version,
    savedAt: Date.now(),
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state: structuredClone(state) as unknown,
  };
}

/** 在合法存档基础上定向损坏，断言校验失败 */
function expectRejected(mutate: (s: GameState) => void): void {
  const state = newGame();
  mutate(state);
  expect(validateSaveData(makeSave(state)).ok).toBe(false);
}

describe('[saveValidation] 对照组', () => {
  it('合法存档本身能通过校验', () => {
    expect(validateSaveData(makeSave(newGame())).ok).toBe(true);
  });
  it('不同角色模板的合法存档也能通过', () => {
    for (const id of ['scout', 'fighter', 'engineer', 'medic']) {
      expect(validateSaveData(makeSave(newGame('BR-x', id))).ok).toBe(true);
    }
  });
});

describe('[saveValidation] 结构层损坏', () => {
  it('拒绝：存档不是对象', () => {
    expect(validateSaveData(42).ok).toBe(false);
  });
  it('拒绝：存档为 null', () => {
    expect(validateSaveData(null).ok).toBe(false);
  });
  it('拒绝：缺少 version', () => {
    const s = makeSave(newGame());
    delete (s as Record<string, unknown>).version;
    expect(validateSaveData(s).ok).toBe(false);
  });
  it('拒绝：缺少 seed', () => {
    const s = makeSave(newGame());
    delete (s as Record<string, unknown>).seed;
    expect(validateSaveData(s).ok).toBe(false);
  });
  it('拒绝：缺少 state', () => {
    const s = makeSave(newGame());
    delete (s as Record<string, unknown>).state;
    expect(validateSaveData(s).ok).toBe(false);
  });
  it('拒绝：state 不是对象', () => {
    const s = makeSave(newGame());
    (s as Record<string, unknown>).state = 1;
    expect(validateSaveData(s).ok).toBe(false);
  });
  it('拒绝：state.status 非法', () => {
    expectRejected((s) => {
      (s as unknown as { status: string }).status = 'finished';
    });
  });
  it('拒绝：state.turnOrder 不是数组', () => {
    expectRejected((s) => {
      (s as unknown as { turnOrder: number }).turnOrder = 1;
    });
  });
  it('拒绝：state.characters 不是对象', () => {
    expectRejected((s) => {
      (s as unknown as { characters: number }).characters = 1;
    });
  });
  it('拒绝：state.zones 不是对象', () => {
    expectRejected((s) => {
      (s as unknown as { zones: number }).zones = 1;
    });
  });
  it('拒绝：state.rngState 不是数字', () => {
    expectRejected((s) => {
      (s as unknown as { rngState: string }).rngState = 'abc';
    });
  });
});

describe('[saveValidation] 数值层损坏', () => {
  it('拒绝：time 为负数', () => {
    expectRejected((s) => {
      s.time = -5;
    });
  });
  it('拒绝：角色 hp 超过 maxHp', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.hp = p.maxHp + 10;
    });
  });
  it('拒绝：角色 hp 为负数', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.hp = -3;
    });
  });
  it('拒绝：角色 stamina 超过 maxStamina', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.stamina = p.maxStamina + 1;
    });
  });
  it('拒绝：角色 maxHp 为 0', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.maxHp = 0;
    });
  });
  it.each([
    ['缺 level', (p: GameState['characters'][string]) => {
      delete (p as unknown as Record<string, unknown>).level;
    }],
    ['缺 exp', (p: GameState['characters'][string]) => {
      delete (p as unknown as Record<string, unknown>).exp;
    }],
    ['level 类型错误', (p: GameState['characters'][string]) => {
      (p as unknown as Record<string, unknown>).level = '2';
    }],
    ['exp 类型错误', (p: GameState['characters'][string]) => {
      (p as unknown as Record<string, unknown>).exp = '8';
    }],
    ['level 低于下限', (p: GameState['characters'][string]) => {
      p.level = 0;
    }],
    ['level 超过 5 级上限', (p: GameState['characters'][string]) => {
      p.level = GAME_CONFIG.maxLevel + 1;
    }],
    ['exp 为负', (p: GameState['characters'][string]) => {
      p.exp = -1;
    }],
    ['exp 达阈值却未升级', (p: GameState['characters'][string]) => {
      p.exp = GAME_CONFIG.levelExpThresholds[0]!;
    }],
    ['满级仍保留 exp', (p: GameState['characters'][string]) => {
      p.level = GAME_CONFIG.maxLevel;
      p.exp = 1;
    }],
  ])('拒绝：新增成长字段%s', (_label, mutate) => {
    expectRejected((s) => mutate(s.characters[s.playerId]!));
  });
  it('拒绝：活人血量为 0', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.alive = true;
      p.hp = 0;
    });
  });
  it('拒绝：区域 remainingLootCount 与清单不符', () => {
    expectRejected((s) => {
      const zone = Object.values(s.zones)[0]!;
      zone.remainingLootCount += 99;
    });
  });
  it('拒绝：区域 supply 超过 1', () => {
    expectRejected((s) => {
      const zone = Object.values(s.zones)[0]!;
      zone.supply = 3.5;
    });
  });
  it('拒绝：区域 supply 为负数', () => {
    expectRejected((s) => {
      const zone = Object.values(s.zones)[0]!;
      zone.supply = -0.2;
    });
  });
  it('拒绝：区域 initialLootCount 为负', () => {
    expectRejected((s) => {
      const zone = Object.values(s.zones)[0]!;
      zone.initialLootCount = -1;
    });
  });
});

describe('[saveValidation] 引用层损坏', () => {
  it('拒绝：turnOrder 引用未知 id', () => {
    expectRejected((s) => {
      s.turnOrder = [...s.turnOrder, 'ghost'];
    });
  });
  it('拒绝：deathOrder 引用未知 id', () => {
    expectRejected((s) => {
      s.deathOrder = [...s.deathOrder, 'ghost'];
    });
  });
  it('拒绝：角色位于不存在的区域', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.currentZoneId = 'nowhere';
    });
  });
  it('拒绝：背包物品缺少 itemId', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.inventory = [{ uid: 'X', count: 1 } as unknown as GameState['characters'][string]['inventory'][number]];
    });
  });
  it('拒绝：背包含未知物品 id', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.inventory = [{ uid: 'X', itemId: 'no_such_item', count: 1 } as unknown as GameState['characters'][string]['inventory'][number]];
    });
  });
  it('拒绝：equippedWeaponId 指向不存在的实例', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.equippedWeaponId = 'weapon-ghost';
    });
  });
  it('拒绝：击杀者指向不存在的角色', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.killedBy = 'ghost';
    });
  });
  it('拒绝：区域状态非法', () => {
    expectRejected((s) => {
      const zone = Object.values(s.zones)[0]!;
      (zone as unknown as { status: string }).status = 'locked';
    });
  });
  it('拒绝：区域存活名单引用未知角色', () => {
    expectRejected((s) => {
      const zone = Object.values(s.zones)[0]!;
      zone.aliveCharacterIds = [...zone.aliveCharacterIds, 'ghost'];
    });
  });
  it('拒绝：区域地面有未知物品', () => {
    expectRejected((s) => {
      const zone = Object.values(s.zones)[0]!;
      zone.groundItems = [{ uid: 'G', itemId: 'no_such_item', count: 1 } as unknown as GameState['zones'][string]['groundItems'][number]];
    });
  });
  it('拒绝：遭遇指向未知敌人', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      s.encounter = {
        enemyId: 'ghost',
        zoneId: p.currentZoneId,
        startedAtTime: s.time,
        log: [],
        resolved: false,
      };
    });
  });
  it('拒绝：遭遇发生在未知区域', () => {
    expectRejected((s) => {
      s.encounter = {
        enemyId: s.turnOrder.find((id) => id !== s.playerId)!,
        zoneId: 'nowhere',
        startedAtTime: s.time,
        log: [],
        resolved: false,
      };
    });
  });
  it('拒绝：遭遇缺少 resolved', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      s.encounter = {
        enemyId: s.turnOrder.find((id) => id !== s.playerId)!,
        zoneId: p.currentZoneId,
        startedAtTime: s.time,
        log: [],
      } as unknown as GameState['encounter'];
    });
  });
  it('拒绝：pendingPickup 指向未知物品', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      s.pendingPickup = {
        stack: { uid: 'P', itemId: 'no_such_item', count: 1 },
        source: 'search',
        zoneId: p.currentZoneId,
      };
    });
  });
  it('拒绝：pendingPickup.dropUid 不在背包', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      s.pendingPickup = {
        stack: { uid: 'P', itemId: 'scrap_metal', count: 1 },
        source: 'search',
        zoneId: p.currentZoneId,
        dropUid: 'not-in-inventory',
      } as unknown as GameState['pendingPickup'];
    });
  });
  it('拒绝：NPC 制作目标指向不存在的配方', () => {
    expectRejected((s) => {
      const npc = Object.values(s.characters).find((c) => !c.isPlayer)!;
      npc.plannedRecipeId = 'recipe_does_not_exist';
    });
  });
});

describe('[saveValidation] 一致性层损坏', () => {
  it('拒绝：turnOrder 出现重复角色', () => {
    expectRejected((s) => {
      s.turnOrder = [...s.turnOrder, s.turnOrder[0]!];
    });
  });
  it('拒绝：turnOrder 遗漏存在的角色', () => {
    expectRejected((s) => {
      s.turnOrder = s.turnOrder.slice(0, 2);
    });
  });
  it('拒绝：进行中却带有结束原因', () => {
    expectRejected((s) => {
      s.status = 'playing';
      s.endReason = 'player_won';
    });
  });
  it('拒绝：won 但 endReason 不为 player_won', () => {
    expectRejected((s) => {
      s.status = 'won';
      s.endReason = 'player_died';
    });
  });
  it('拒绝：lost 但 endReason 不为 player_died', () => {
    expectRejected((s) => {
      s.status = 'lost';
      s.endReason = 'player_won';
    });
  });
  it('拒绝：phase 为非法值', () => {
    expectRejected((s) => {
      (s as unknown as { phase: string }).phase = 'endgame';
    });
  });
  it('拒绝：背包出现重复的物品 UID', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      const first = p.inventory[0];
      if (first) p.inventory.push({ ...first });
      else p.inventory.push({ uid: 'DUP', itemId: 'scrap_metal', count: 1 } as unknown as GameState['characters'][string]['inventory'][number]);
    });
  });
  it('拒绝：存活角色不在其所在区域的名单', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      const zone = s.zones[p.currentZoneId]!;
      zone.aliveCharacterIds = zone.aliveCharacterIds.filter((id) => id !== p.id);
    });
  });
  it('拒绝：死亡角色仍留在区域存活名单', () => {
    expectRejected((s) => {
      const npc = Object.values(s.characters).find((c) => !c.isPlayer)!;
      npc.alive = false;
      npc.hp = 0;
    });
  });
});

describe('[saveValidation] Phase 3 · 新增字段校验（Step 4/5）', () => {
  it('守卫：含防御姿态 / 技能冷却 / 世界事件的合法存档通过', () => {
    const state = newGame('BR-s5');
    const p = state.characters[state.playerId]!;
    p.guarding = true;
    p.skillCooldowns = { emergency_treatment: 2 };
    state.activeWorldEvents = [
      {
        id: 'we1',
        eventId: 'blackout',
        scope: 'zone',
        zoneId: p.currentZoneId,
        startedAtTime: 0,
        remaining: 2,
        label: '大停电',
        description: '测试',
      },
      {
        id: 'we2',
        eventId: 'rain',
        scope: 'global',
        zoneId: null,
        startedAtTime: 0,
        remaining: 3,
        label: '连绵阴雨',
        description: '测试',
      },
    ];
    state.worldEventHistory = [
      {
        id: 'we0',
        eventId: 'citywide_unrest',
        zoneId: null,
        startedAtTime: 0,
        endedAtTime: 5,
      },
    ];
    state.nextWorldEventTime = 12;
    expect(validateSaveData(makeSave(state)).ok).toBe(true);
  });

  it('拒绝：角色 guarding 非布尔', () => {
    expectRejected((s) => {
      (s.characters[s.playerId] as unknown as { guarding: string }).guarding = 'yes';
    });
  });

  it('拒绝：角色 skillCooldowns 非对象', () => {
    expectRejected((s) => {
      (s.characters[s.playerId] as unknown as { skillCooldowns: number }).skillCooldowns = 3;
    });
  });

  it('拒绝：角色 skillCooldowns 含负值', () => {
    expectRejected((s) => {
      s.characters[s.playerId]!.skillCooldowns = { first_aid: -1 } as unknown as Record<
        string,
        number
      >;
    });
  });

  it('拒绝：nextWorldEventTime 为负数', () => {
    expectRejected((s) => {
      (s as unknown as { nextWorldEventTime: number }).nextWorldEventTime = -5;
    });
  });

  it('拒绝：activeWorldEvents 不是数组', () => {
    expectRejected((s) => {
      (s as unknown as { activeWorldEvents: number }).activeWorldEvents = 1;
    });
  });

  it('拒绝：activeWorldEvents 事件 id 非法', () => {
    expectRejected((s) => {
      (s as unknown as { activeWorldEvents: unknown[] }).activeWorldEvents = [
        {
          id: 'we1',
          eventId: 'meteor',
          scope: 'global',
          zoneId: null,
          startedAtTime: 0,
          remaining: 1,
          label: 'x',
          description: 'y',
        },
      ];
    });
  });

  it('拒绝：区域型世界事件引用不存在的区域', () => {
    expectRejected((s) => {
      (s as unknown as { activeWorldEvents: unknown[] }).activeWorldEvents = [
        {
          id: 'we1',
          eventId: 'blackout',
          scope: 'zone',
          zoneId: 'nowhere',
          startedAtTime: 0,
          remaining: 1,
          label: 'x',
          description: 'y',
        },
      ];
    });
  });

  it('拒绝：全局型世界事件却带了 zoneId', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      (s as unknown as { activeWorldEvents: unknown[] }).activeWorldEvents = [
        {
          id: 'we1',
          eventId: 'rain',
          scope: 'global',
          zoneId: p.currentZoneId,
          startedAtTime: 0,
          remaining: 1,
          label: 'x',
          description: 'y',
        },
      ];
    });
  });

  it('拒绝：activeWorldEvents remaining 非正数（归零的事件必须已进 history）', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      (s as unknown as { activeWorldEvents: unknown[] }).activeWorldEvents = [
        {
          id: 'we1',
          eventId: 'blackout',
          scope: 'zone',
          zoneId: p.currentZoneId,
          startedAtTime: 0,
          remaining: 0,
          label: 'x',
          description: 'y',
        },
      ];
    });
  });

  it('拒绝：同一种世界事件同时生效两份（修正值会被重复相乘）', () => {
    expectRejected((s) => {
      (s as unknown as { activeWorldEvents: unknown[] }).activeWorldEvents = [
        {
          id: 'we1',
          eventId: 'rain',
          scope: 'global',
          zoneId: null,
          startedAtTime: 0,
          remaining: 3,
          label: '连绵阴雨',
          description: 'y',
        },
        {
          id: 'we2',
          eventId: 'rain',
          scope: 'global',
          zoneId: null,
          startedAtTime: 1,
          remaining: 4,
          label: '连绵阴雨',
          description: 'y',
        },
      ];
    });
  });

  it('拒绝：worldEventHistory 结束时间早于开始时间', () => {
    expectRejected((s) => {
      (s as unknown as { worldEventHistory: unknown[] }).worldEventHistory = [
        { id: 'we0', eventId: 'rain', zoneId: null, startedAtTime: 9, endedAtTime: 3 },
      ];
    });
  });
});

describe('[saveValidation] 状态效果 / EXPOSED 红线（Phase 3A Step 8）', () => {
  it('拒绝：statusEffects 含未知状态 id', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.statusEffects = [...p.statusEffects, { id: 'panic', remaining: 3, hpPerTick: 0, label: '慌乱' } as never];
    });
  });
  it('拒绝：EXPOSED 带 hpPerTick 伤害（红线）', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.statusEffects = [
        ...p.statusEffects,
        { id: 'exposed', remaining: 3, hpPerTick: -3, label: '露出破绽', damageTakenMult: 1.2 } as never,
      ];
    });
  });
  it('拒绝：EXPOSED damageTakenMult 与配置不符', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.statusEffects = [
        ...p.statusEffects,
        { id: 'exposed', remaining: 3, hpPerTick: 0, label: '露出破绽', damageTakenMult: 9.9 } as never,
      ];
    });
  });
  it('拒绝：statusEffects 重复 EXPOSED（不可叠加）', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.statusEffects = [
        ...p.statusEffects,
        { id: 'exposed', remaining: 3, hpPerTick: 0, label: '露出破绽' } as never,
        { id: 'exposed', remaining: 2, hpPerTick: 0, label: '露出破绽' } as never,
      ];
    });
  });
  it('接受：合法 EXPOSED 状态', () => {
    const state = newGame();
    const p = state.characters[state.playerId]!;
    p.statusEffects = [
      ...p.statusEffects,
      {
        id: 'exposed',
        remaining: 3,
        hpPerTick: 0,
        label: '露出破绽',
        damageTakenMult: GAME_CONFIG.exposedDamageMult,
      } as never,
    ];
    expect(validateSaveData(makeSave(state)).ok).toBe(true);
  });
});

describe('[saveValidation] 技能冷却（Phase 3A Step 8）', () => {
  it('拒绝：skillCooldowns 含未知技能', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.skillCooldowns = { ...p.skillCooldowns, fake_skill: 2 };
    });
  });
  it('拒绝：skillCooldowns 负值', () => {
    expectRejected((s) => {
      const p = s.characters[s.playerId]!;
      p.skillCooldowns = { ...p.skillCooldowns, adrenaline: -1 };
    });
  });
  it('接受：合法技能冷却（自身技能，非负整数）', () => {
    const state = newGame();
    const p = state.characters[state.playerId]!;
    p.skillCooldowns = { ...p.skillCooldowns, adrenaline: 2 };
    expect(validateSaveData(makeSave(state)).ok).toBe(true);
  });
});
