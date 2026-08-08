/**
 * Phase 2A 验收测试（Step 2 建立时全部为红灯）。
 *
 * 本文件专门覆盖第二阶段验收中暴露出来的**真实性 / 稳定性 / 完整性**问题。
 * 建立时（2026-08-07）这里的每一个断言都会失败，随后按 Step 3~15 逐条转绿。
 *
 * 覆盖面：
 *  A. 逃跑免费 + 遭遇战死锁
 *  B. 合法行动服务（getLegalPlayerCommands / hasTimeAdvancingAction）
 *  C. 玩家与 NPC 统一行动服务
 *  D. 硬时限判平局
 *  E. 信息隐藏收紧
 *  F. 存档结构损坏必须被拒绝
 *  G. 物品守恒不变量
 *  H. 制作目标路线推荐
 *  I. 模拟器不得伪造胜者
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { GAME_CONFIG } from '../src/data/gameConfig';
import { getActionStaminaCost } from '../src/core/actionCosts';
import { executeCommand } from '../src/core/gameEngine';
import { refreshZoneOccupants } from '../src/core/gameState';
import { enforceTimeLimit } from '../src/core/phase';
import { refreshPlayerSight, PRESENCE_TEXT, zonePresence } from '../src/core/info';
import { validateSaveData } from '../src/core/saveLoad';
import { newGame, npcs, player } from './helpers';
import type { Combatant, GameState } from '../src/core/types';

const ROOT = resolve(__dirname, '..');

/** 把一名 NPC 拉到玩家所在区域，并可选地开启遭遇 */
function stageEncounter(state: GameState, opts: { encounter: boolean }): Combatant {
  const p = player(state);
  const npc = npcs(state)[0]!;
  npc.currentZoneId = p.currentZoneId;
  npc.alive = true;
  refreshZoneOccupants(state);
  if (opts.encounter) {
    state.encounter = {
      enemyId: npc.id,
      zoneId: p.currentZoneId,
      startedAtTime: state.time,
      log: [],
      resolved: false,
    };
  }
  return npc;
}

/** 生成一份合法存档对象（深拷贝，便于后续定向损坏） */
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

/* ================================================================== */
/* A. 逃跑免费 + 遭遇战死锁                                            */
/* ================================================================== */

describe('[2A-A] 逃跑必须是免费行动', () => {
  it('FLEE 的体力消耗为 0', () => {
    const state = newGame();
    expect(GAME_CONFIG.fleeStaminaCost).toBe(0);
    expect(getActionStaminaCost(player(state), 'FLEE')).toBe(0);
  });

  it('体力为 0 且处于遭遇战时，逃跑命令必须被接受', () => {
    const state = newGame();
    stageEncounter(state, { encounter: true });
    player(state).stamina = 0;
    const res = executeCommand(state, { type: 'FLEE' });
    expect(res.ok).toBe(true);
  });

  it('逃跑仍然推进 1 个时间单位（无论成败）', () => {
    const state = newGame();
    stageEncounter(state, { encounter: true });
    player(state).stamina = 0;
    const before = state.time;
    const res = executeCommand(state, { type: 'FLEE' });
    expect(res.ok).toBe(true);
    expect(res.state.time).toBe(before + 1);
  });
});

/* ================================================================== */
/* B. 合法行动服务                                                     */
/* ================================================================== */

describe('[2A-B] 合法行动服务必须存在且永不死锁', () => {
  it('src/core/legalActions.ts 导出 getLegalPlayerCommands / hasTimeAdvancingAction', async () => {
    const mod = await import('../src/core/legalActions');
    expect(typeof mod.getLegalPlayerCommands).toBe('function');
    expect(typeof mod.hasTimeAdvancingAction).toBe('function');
  });

  it('体力 0 + 遭遇战 + 无逃跑目的地时，玩家仍有可推进时间的行动', async () => {
    const { hasTimeAdvancingAction } = await import('../src/core/legalActions');
    const state = newGame();
    stageEncounter(state, { encounter: true });
    const p = player(state);
    p.stamina = 0;
    p.inventory = [];
    // 把所有相邻区域都设为禁区，断掉逃跑与移动
    for (const zone of Object.values(state.zones)) {
      if (zone.id !== p.currentZoneId) zone.status = 'restricted';
    }
    expect(hasTimeAdvancingAction(state)).toBe(true);
  });

  it('背包已满 + 待决拾取时，玩家仍有可推进时间的行动', async () => {
    const { hasTimeAdvancingAction } = await import('../src/core/legalActions');
    const state = newGame();
    state.pendingPickup = {
      stack: { uid: 'X-1', itemId: 'scrap_metal', count: 1 },
      source: 'search',
      zoneId: player(state).currentZoneId,
    };
    expect(hasTimeAdvancingAction(state)).toBe(true);
  });
});

/* ================================================================== */
/* C. 玩家与 NPC 统一行动服务                                          */
/* ================================================================== */

describe('[2A-C] NPC 必须与玩家共用同一套行动规则', () => {
  it('src/core/actorActions.ts 提供统一行动入口', async () => {
    const mod = await import('../src/core/actorActions');
    expect(typeof mod.executeActorCommand).toBe('function');
    expect(typeof mod.moveActor).toBe('function');
    expect(typeof mod.searchActor).toBe('function');
    expect(typeof mod.attackActor).toBe('function');
    expect(typeof mod.fleeActor).toBe('function');
    expect(typeof mod.restActor).toBe('function');
  });

  it('npcAi.ts 中不得出现绕过规则的直接状态赋值', () => {
    const src = readFileSync(resolve(ROOT, 'src/core/npcAi.ts'), 'utf-8');
    expect(src).not.toMatch(/npc\.currentZoneId\s*=/);
    expect(src).not.toMatch(/npc\.stamina\s*=/);
    expect(src).not.toMatch(/actor\.currentZoneId\s*=/);
    expect(src).not.toMatch(/actor\.stamina\s*=/);
  });
});

/* ================================================================== */
/* D. 硬时限判平局                                                     */
/* ================================================================== */

describe('[2A-D] 硬时限不得用生命值比较判胜负', () => {
  it('到达 hardTimeLimit 时判为平局 draw / time_limit', () => {
    const state = newGame();
    state.time = GAME_CONFIG.hardTimeLimit;
    for (const npc of npcs(state)) npc.hp = 1;
    player(state).hp = player(state).maxHp;

    expect(enforceTimeLimit(state)).toBe(true);
    expect(state.status as string).toBe('draw');
    expect(state.endReason).toBe('time_limit');
  });

  it('平局会写入可供模拟器识别的诊断事件', () => {
    const state = newGame();
    state.time = GAME_CONFIG.hardTimeLimit;
    enforceTimeLimit(state);
    const ended = state.events.find((e) => e.type === 'GAME_ENDED');
    expect(ended).toBeDefined();
    expect(ended!.metadata.result).toBe('draw');
    expect(ended!.metadata.hardLimitReached).toBe(true);
  });
});

/* ================================================================== */
/* E. 信息隐藏收紧                                                     */
/* ================================================================== */

describe('[2A-E] 未识别的对手不得泄露身份', () => {
  it('refreshPlayerSight 不因为同区域就自动识别陌生角色', () => {
    const state = newGame();
    const npc = stageEncounter(state, { encounter: false });
    state.playerIntel = {};
    player(state).knownEnemies = [];
    refreshPlayerSight(state);
    expect(state.playerIntel[npc.id]).toBeUndefined();
  });

  it('非遭遇状态下同区域只给存在感提示，不暴露身份与精确人数', () => {
    const state = newGame();
    stageEncounter(state, { encounter: false });
    player(state).knownEnemies = [];
    const level = zonePresence(state);
    expect(level).not.toBe('none'); // 知道"有人"，仅此而已
    const text = PRESENCE_TEXT[level];
    expect(text).not.toMatch(/n\d|灰隼|铁砂|夜枭/); // 无姓名
    expect(text).not.toMatch(/\d+\s*人/); // 无精确人数
  });
});

/* ================================================================== */
/* F. 存档损坏必须被拒绝                                               */
/* ================================================================== */

describe('[2A-F] 存档校验必须覆盖结构性与引用性损坏', () => {
  it('合法存档本身能通过校验（对照组）', () => {
    const save = makeSave(newGame());
    expect(validateSaveData(save).ok).toBe(true);
  });

  it('拒绝：背包中出现重复的物品 UID', () => {
    const state = newGame();
    const p = player(state);
    const first = p.inventory[0];
    if (first) p.inventory.push({ ...first });
    else {
      p.inventory.push({ uid: 'DUP-1', itemId: 'scrap_metal', count: 1 });
      p.inventory.push({ uid: 'DUP-1', itemId: 'scrap_metal', count: 1 });
    }
    expect(validateSaveData(makeSave(state)).ok).toBe(false);
  });

  it('拒绝：turnOrder 中出现重复角色', () => {
    const state = newGame();
    state.turnOrder = [...state.turnOrder, state.turnOrder[0]!];
    expect(validateSaveData(makeSave(state)).ok).toBe(false);
  });

  it('拒绝：turnOrder 遗漏了存在的角色', () => {
    const state = newGame();
    state.turnOrder = state.turnOrder.slice(0, 2);
    expect(validateSaveData(makeSave(state)).ok).toBe(false);
  });

  it('拒绝：status 与 endReason 自相矛盾', () => {
    const state = newGame();
    state.status = 'playing';
    state.endReason = 'player_won';
    expect(validateSaveData(makeSave(state)).ok).toBe(false);
  });

  it('拒绝：phase 为非法值', () => {
    const state = newGame();
    (state as unknown as { phase: string }).phase = 'endgame';
    expect(validateSaveData(makeSave(state)).ok).toBe(false);
  });

  it('拒绝：remainingLootCount 与实际物资清单不符', () => {
    const state = newGame();
    const zone = Object.values(state.zones)[0]!;
    zone.remainingLootCount += 99;
    expect(validateSaveData(makeSave(state)).ok).toBe(false);
  });

  it('拒绝：supply 比例越界', () => {
    const state = newGame();
    Object.values(state.zones)[0]!.supply = 3.5;
    expect(validateSaveData(makeSave(state)).ok).toBe(false);
  });

  it('拒绝：pendingPickup.dropUid 指向背包里不存在的物品', () => {
    const state = newGame();
    state.pendingPickup = {
      stack: { uid: 'P-1', itemId: 'scrap_metal', count: 1 },
      source: 'search',
      zoneId: player(state).currentZoneId,
    };
    (state.pendingPickup as unknown as { dropUid: string }).dropUid = 'NOT-EXIST';
    expect(validateSaveData(makeSave(state)).ok).toBe(false);
  });

  it('拒绝：plannedRecipeId 指向不存在的配方', () => {
    const state = newGame();
    npcs(state)[0]!.plannedRecipeId = 'recipe_does_not_exist';
    expect(validateSaveData(makeSave(state)).ok).toBe(false);
  });

  it('拒绝：存活角色不在其所在区域的名单里', () => {
    const state = newGame();
    const p = player(state);
    const zone = state.zones[p.currentZoneId]!;
    zone.aliveCharacterIds = zone.aliveCharacterIds.filter((id) => id !== p.id);
    expect(validateSaveData(makeSave(state)).ok).toBe(false);
  });

  it('拒绝：死亡角色仍留在区域存活名单中', () => {
    const state = newGame();
    const npc = npcs(state)[0]!;
    npc.alive = false;
    npc.hp = 0;
    expect(validateSaveData(makeSave(state)).ok).toBe(false);
  });
});

/* ================================================================== */
/* G. 物品守恒                                                         */
/* ================================================================== */

describe('[2A-G] 物品守恒不变量', () => {
  it('src/core/itemIntegrity.ts 导出 auditItemIntegrity', async () => {
    const mod = await import('../src/core/itemIntegrity');
    expect(typeof mod.auditItemIntegrity).toBe('function');
  });

  it('全新对局的物品完整性审计必须通过', async () => {
    const { auditItemIntegrity } = await import('../src/core/itemIntegrity');
    const report = auditItemIntegrity(newGame());
    expect(report.ok).toBe(true);
    expect(report.problems).toEqual([]);
  });

  it('人为制造重复 UID 时审计必须报错', async () => {
    const { auditItemIntegrity } = await import('../src/core/itemIntegrity');
    const state = newGame();
    const p = player(state);
    p.inventory = [
      { uid: 'SAME', itemId: 'scrap_metal', count: 1 },
      { uid: 'SAME', itemId: 'scrap_metal', count: 1 },
    ];
    expect(auditItemIntegrity(state).ok).toBe(false);
  });
});

/* ================================================================== */
/* H. 制作目标路线推荐                                                 */
/* ================================================================== */

describe('[2A-H] 制作目标必须给出路线指引', () => {
  it('crafting 模块导出 getCraftGoalRecommendations', async () => {
    const mod = await import('../src/core/craftGuide');
    expect(typeof mod.getCraftGoalRecommendations).toBe('function');
    expect(typeof mod.describeCraftGoal).toBe('function');
  });

  it('推荐结果不得随隐藏战利品变化（反作弊）', async () => {
    const { getCraftGoalRecommendations } = await import('../src/core/craftGuide');
    const a = newGame('BR-ANTI-CHEAT');
    const b = newGame('BR-ANTI-CHEAT');
    a.craftGoalRecipeId = 'reinforced_blade';
    b.craftGoalRecipeId = 'reinforced_blade';
    // 只改动"隐藏信息"：区域内的实际战利品清单
    for (const zone of Object.values(b.zones)) zone.loot = [];

    const ra = getCraftGoalRecommendations(a, player(a));
    const rb = getCraftGoalRecommendations(b, player(b));
    expect(rb.map((r) => r.zoneId)).toEqual(ra.map((r) => r.zoneId));
  });
});

/* ================================================================== */
/* I. 模拟器不得伪造胜者                                               */
/* ================================================================== */

describe('[2A-I] 模拟器控制器', () => {
  it('tools/autoPlayer.ts 导出 runAutoGame', async () => {
    const mod = await import('../tools/autoPlayer');
    expect(typeof mod.runAutoGame).toBe('function');
  });

  it('对局结果只能是 won / lost / draw / timeout，不得凭血量推断', async () => {
    const { runAutoGame } = await import('../tools/autoPlayer');
    const r = runAutoGame({
      seed: 'BR-SIM-1',
      characterId: 'scout',
      policy: 'cautious',
    });
    expect(['won', 'lost', 'draw', 'timeout']).toContain(r.outcome);
    expect(r.finalStatus).not.toBe('playing');
  });

  it('旧模拟器的「取血量最高者当胜者」逻辑必须被移除', () => {
    const src = readFileSync(resolve(ROOT, 'tools/simulate.ts'), 'utf-8');
    expect(src).not.toMatch(/c\.hp\s*>\s*best\.hp/);
  });
});
