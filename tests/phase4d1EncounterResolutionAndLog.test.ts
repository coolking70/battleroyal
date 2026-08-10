/**
 * Phase 4D-1：遭遇终止态一致性（缺陷 A）与战斗日志完整性（缺陷 B）。
 *
 * 这两条缺陷共用一组夹具：把对局收缩成「玩家 + 一名付不起体力的对手」，
 * 排除第三方 NPC 与追击对断言的干扰，从而让「终止态」与「日志内容」
 * 这两件事本身成为唯一变量。
 */

import { describe, expect, it } from 'vitest';

import { executeActorCommand } from '../src/core/actorActions';
import { executeCommand } from '../src/core/gameEngine';
import { getPlayer, refreshZoneOccupants } from '../src/core/gameState';
import { createStack, addItem } from '../src/core/inventory';
import { getLegalPlayerCommands } from '../src/core/legalActions';
import { SeededRandom } from '../src/core/random';
import { getCharacterSkill } from '../src/core/skills';
import { getItem } from '../src/data/items';
import { getZoneDef } from '../src/data/zones';
import { clearInventory, newGame, npcs, player } from './helpers';
import type { Combatant, GameState } from '../src/core/types';

interface Stage {
  state: GameState;
  p: Combatant;
  foe: Combatant;
}

/**
 * 布置一场干净的遭遇。
 *
 * - 只留玩家与一名对手存活：第三方 NPC 不会插进日志或改写遭遇；
 *   保留 2 人存活也就不会触发「只剩玩家」的胜利结算（那会清空 encounter）。
 * - 对手体力清零：付不起攻击成本，因此既不会追击，也不会在时间推进后
 *   立刻重新交火，`resolved` 才能被稳定观测到。
 * - `lastSafeZone` 决定走哪条脱离路径：其余区域全部禁区 → 无处可退 →
 *   原地脱离；否则走正常的转移脱离。
 */
function stageEncounter(seed: string, lastSafeZone: boolean): Stage {
  const state = newGame(seed);
  const p = player(state);
  const all = npcs(state);
  const foe = all[0]!;
  for (const other of all.slice(1)) other.alive = false;
  foe.alive = true;
  foe.currentZoneId = p.currentZoneId;
  foe.stamina = 0;
  refreshZoneOccupants(state);
  if (lastSafeZone) {
    for (const zone of Object.values(state.zones)) {
      if (zone.id !== p.currentZoneId) zone.status = 'restricted';
    }
  }
  state.encounter = {
    enemyId: foe.id,
    zoneId: p.currentZoneId,
    startedAtTime: state.time,
    log: [],
    resolved: false,
  };
  return { state, p, foe };
}

/**
 * 转移脱离依赖一次成功率判定，单个种子不保证成功。
 * 这里按固定顺序枚举种子直到拿到一次「确实换了区域」的脱离——
 * 种子序列写死，因此结果依旧是完全确定的。
 */
function stageTransferEscape(): { state: GameState; foeName: string } {
  for (let i = 0; i < 60; i += 1) {
    const { state, p, foe } = stageEncounter(`PHASE4D1-TRANSFER-${i}`, false);
    const fromZone = p.currentZoneId;
    const res = executeCommand(state, { type: 'FLEE' });
    if (res.ok && getPlayer(res.state).currentZoneId !== fromZone) {
      return { state: res.state, foeName: foe.name };
    }
  }
  throw new Error('未能在给定种子序列内构造出转移脱离场景');
}

/* ------------------------------------------------------------------ */
/* 缺陷 A：逃跑成功必须走与击杀相同的结算态                             */
/* ------------------------------------------------------------------ */

describe('Phase 4D-1 缺陷 A：逃跑成功的遭遇终止态', () => {
  it('原地脱离后遭遇进入 resolved 结算态，而不是凭空消失', () => {
    const { state } = stageEncounter('PHASE4D1-STATIONARY', true);

    const res = executeCommand(state, { type: 'FLEE' });

    expect(res.ok).toBe(true);
    // 旧行为是 state.encounter = null（面板直接消失、没有任何结算）
    expect(res.state.encounter).not.toBeNull();
    expect(res.state.encounter?.resolved).toBe(true);
  });

  it('原地脱离的结算文案必须点明敌人仍在本区域、可能再次交火', () => {
    const { state, foe } = stageEncounter('PHASE4D1-STATIONARY-TEXT', true);

    const res = executeCommand(state, { type: 'FLEE' });
    const log = res.state.encounter?.log ?? [];
    const text = log.join('\n');

    expect(text).toContain('原地脱离');
    expect(text).toContain('已脱离接触');
    expect(text).toContain('仍在本区域');
    expect(text).toContain('可能再次交火');
    expect(text).toContain(foe.name);
    // 原地脱离没有换区域，绝不能给出「已经离开该区域」的错误安全感
    expect(text).not.toContain('已经离开该区域');

    const nextFoe = res.state.characters[foe.id];
    expect(nextFoe?.currentZoneId).toBe(getPlayer(res.state).currentZoneId);
  });

  it('转移脱离的结算文案告知已离开该区域并给出到达地', () => {
    const { state, foeName } = stageTransferEscape();
    const text = (state.encounter?.log ?? []).join('\n');

    expect(state.encounter?.resolved).toBe(true);
    expect(text).toContain('已经离开该区域');
    expect(text).toContain('脱离接触');
    // 到达地必须写实：拿玩家当前所在区域的名字回校
    expect(text).toContain(`当前位于${getZoneDef(getPlayer(state).currentZoneId).name}`);
    expect(text).toContain(foeName);
    // 已经换了区域，就不该再说敌人「仍在本区域」
    expect(text).not.toContain('仍在本区域');
  });

  it('结算态提供继续按钮对应的 CLOSE_ENCOUNTER，且关闭后遭遇清空', () => {
    const { state } = stageEncounter('PHASE4D1-CLOSE', true);

    const fled = executeCommand(state, { type: 'FLEE' });
    expect(fled.state.encounter?.resolved).toBe(true);
    expect(
      getLegalPlayerCommands(fled.state).map((action) => action.command.type),
    ).toContain('CLOSE_ENCOUNTER');

    const closed = executeCommand(fled.state, { type: 'CLOSE_ENCOUNTER' });
    expect(closed.ok).toBe(true);
    expect(closed.state.encounter).toBeNull();
  });

  it('逃跑失败仍然是未结算态：不能靠失败的脱离拿到结算面板', () => {
    // 有可退区域时逃跑要过成功率判定；枚举种子直到抓到一次失败。
    for (let i = 0; i < 60; i += 1) {
      const { state, p } = stageEncounter(`PHASE4D1-FAIL-${i}`, false);
      const fromZone = p.currentZoneId;
      const res = executeCommand(state, { type: 'FLEE' });
      if (getPlayer(res.state).currentZoneId === fromZone) {
        expect(res.state.encounter?.resolved).toBe(false);
        return;
      }
    }
    throw new Error('未能在给定种子序列内构造出逃跑失败场景');
  });

  it('没有正式遭遇时主动脱离同样给出结算，不再是静默行为', () => {
    const { state } = stageEncounter('PHASE4D1-NO-ENCOUNTER', true);
    // Phase 2A 的 S5 对称性：同区域有敌人、但还没建立遭遇也能脱离
    state.encounter = null;

    const res = executeCommand(state, { type: 'FLEE' });

    expect(res.ok).toBe(true);
    expect(res.state.encounter?.resolved).toBe(true);
    expect((res.state.encounter?.log ?? []).join('\n')).toContain('可能再次交火');
  });
});

/* ------------------------------------------------------------------ */
/* 缺陷 B：四类动作必须写进战斗日志                                     */
/* ------------------------------------------------------------------ */

describe('Phase 4D-1 缺陷 B：遭遇内动作的战斗日志', () => {
  it('防御写入战斗日志', () => {
    const { state } = stageEncounter('PHASE4D1-LOG-GUARD', true);

    const res = executeCommand(state, { type: 'GUARD' });

    expect(res.ok).toBe(true);
    expect((res.state.encounter?.log ?? []).some((line) => line.includes('摆出防御姿态'))).toBe(true);
  });

  it('技能写入战斗日志', () => {
    const { state, p } = stageEncounter('PHASE4D1-LOG-SKILL', true);
    const skillId = getCharacterSkill(p.characterId);
    expect(skillId).not.toBeNull();

    const res = executeCommand(state, { type: 'USE_SKILL', skillId: skillId! });

    expect(res.ok).toBe(true);
    expect((res.state.encounter?.log ?? []).some((line) => line.includes('使用了「'))).toBe(true);
  });

  it('使用消耗品写入战斗日志并带上实际恢复量', () => {
    const { state, p } = stageEncounter('PHASE4D1-LOG-ITEM', true);
    clearInventory(p);
    p.hp = Math.max(1, p.maxHp - 20);
    addItem(p, createStack(state, 'bandage', 1));
    const uid = p.inventory[0]!.uid;

    const res = executeCommand(state, { type: 'USE_ITEM', uid });

    expect(res.ok).toBe(true);
    const line = (res.state.encounter?.log ?? []).find((entry) => entry.includes('绷带'));
    expect(line).toBeDefined();
    expect(line).toContain('你使用了');
    expect(line).toMatch(/生命 \+\d+/);
  });

  it('装备写入战斗日志', () => {
    const { state, p } = stageEncounter('PHASE4D1-LOG-EQUIP', true);
    clearInventory(p);
    addItem(p, createStack(state, 'iron_pipe', 1));
    const uid = p.inventory[0]!.uid;

    const res = executeCommand(state, { type: 'EQUIP', uid });

    expect(res.ok).toBe(true);
    expect((res.state.encounter?.log ?? []).some((line) => line.includes('铁管'))).toBe(true);
  });

  it('非遭遇状态下的同样四类动作不产生任何遭遇日志', () => {
    const { state, p } = stageEncounter('PHASE4D1-LOG-NO-ENCOUNTER', true);
    state.encounter = null;
    // 把对手挪走，避免这些动作顺带触发新的遭遇
    const foe = npcs(state)[0]!;
    foe.alive = false;
    refreshZoneOccupants(state);
    clearInventory(p);
    p.hp = Math.max(1, p.maxHp - 20);
    addItem(p, createStack(state, 'bandage', 1));
    addItem(p, createStack(state, 'iron_pipe', 1));
    const bandageUid = p.inventory[0]!.uid;
    const pipeUid = p.inventory[1]!.uid;
    const skillId = getCharacterSkill(p.characterId)!;

    let current = state;
    for (const command of [
      { type: 'GUARD' } as const,
      { type: 'USE_SKILL', skillId } as const,
      { type: 'USE_ITEM', uid: bandageUid } as const,
      { type: 'EQUIP', uid: pipeUid } as const,
    ]) {
      const res = executeCommand(current, command);
      current = res.state;
      expect(current.encounter).toBeNull();
    }
  });
});

/* ------------------------------------------------------------------ */
/* 缺陷 B 的信息边界：日志不得越过敌方卡片已有的可见范围                 */
/* ------------------------------------------------------------------ */

describe('Phase 4D-1 信息边界：战斗日志不泄露敌方隐藏信息', () => {
  it('敌方的防御 / 技能 / 使用物品一律不写入遭遇日志', () => {
    const { state, foe } = stageEncounter('PHASE4D1-BOUNDARY-ENEMY', true);
    foe.stamina = foe.maxStamina;
    foe.hp = Math.max(1, foe.maxHp - 20);
    clearInventory(foe);
    addItem(foe, createStack(state, 'medkit', 1));
    const foeItemUid = foe.inventory[0]!.uid;
    const foeSkillId = getCharacterSkill(foe.characterId);
    const before = [...(state.encounter?.log ?? [])];

    // 走的是 NPC 真正在用的那条统一行动服务，不是绕过实现的假调用
    executeActorCommand(state, foe, { type: 'GUARD' }, new SeededRandom('PHASE4D1-E-GUARD'));
    executeActorCommand(state, foe, { type: 'USE_ITEM', uid: foeItemUid }, new SeededRandom('PHASE4D1-E-ITEM'));
    if (foeSkillId) {
      executeActorCommand(state, foe, { type: 'USE_SKILL', skillId: foeSkillId }, new SeededRandom('PHASE4D1-E-SKILL'));
    }

    expect(state.encounter?.log).toEqual(before);
  });

  it('打完一整场遭遇后，日志里不含敌方精确 HP 数值与敌方物品 id', () => {
    const { state, p, foe } = stageEncounter('PHASE4D1-BOUNDARY-FULL', true);
    foe.stamina = foe.maxStamina;
    // 敌方持有一件玩家绝不会持有的物品，任何出现都只可能是泄露
    clearInventory(foe);
    addItem(foe, createStack(state, 'energy_drink', 1));
    const foeItemId = foe.inventory[0]!.itemId;
    const foeSkillId = getCharacterSkill(foe.characterId);
    clearInventory(p);
    addItem(p, createStack(state, 'bandage', 1));

    let current = state;
    const skillId = getCharacterSkill(p.characterId)!;
    const commands = [
      { type: 'GUARD' } as const,
      { type: 'ATTACK_NEARBY', style: 'normal' } as const,
      { type: 'USE_SKILL', skillId } as const,
      { type: 'GUARD' } as const,
      { type: 'ATTACK_NEARBY', style: 'heavy' } as const,
    ];
    for (const command of commands) {
      if (current.status !== 'playing' || !current.encounter) break;
      current = executeCommand(current, command).state;
    }

    const log = (current.encounter?.log ?? []).join('\n');
    expect(log.length).toBeGreaterThan(0);

    const enemy = current.characters[foe.id]!;
    // 精确剩余生命：既不能给出 "12/40" 这种比值，也不能给出「生命 12」这种数字描述
    expect(log).not.toContain(`${enemy.hp}/${enemy.maxHp}`);
    expect(log).not.toMatch(new RegExp(`${enemy.name}[^\\n]*(生命|HP)\\s*[:：]?\\s*\\d`));
    expect(log).not.toMatch(new RegExp(`${enemy.name}[^\\n]*剩余\\s*\\d`));
    // 敌方物品：id 与显示名都不得出现
    expect(log).not.toContain(foeItemId);
    expect(log).not.toContain(getItem(foeItemId).name);
    // 敌方技能 id 与意图
    if (foeSkillId) expect(log).not.toContain(foeSkillId);
    expect(log).not.toContain('打算');
    expect(log).not.toContain('意图');
  });
});

/* ------------------------------------------------------------------ */
/* 4C-3 不变量：本轮改动不得动摇零体力遭遇的出口                        */
/* ------------------------------------------------------------------ */

describe('Phase 4D-1 回归：4C-3 零体力不变量仍然成立', () => {
  it('最后安全区零体力时 FLEE 仍然成功、脱离本身不伤血，且现在还给出结算', () => {
    // 4C-3 不变量的核心是「零体力遭遇的出口免费、不伤血」。
    // 但 FLEE 是 advancesTime 命令，executeCommand 会跑完整 advanceTime，
    // 其中的世界事件 / 终局衰竭可能按时间推进掉血——这与逃脱动作本身无关。
    // 因此分两段验证：先在不推进时间的前提下证明「脱离动作本身零成本」，
    // 再端到端验证 resolved 结算，并把 HP 落差与环境掉血对齐隔离。

    // (a) 脱离动作本身（走统一行动服务、不推进时间）绝不动玩家血
    const a = stageEncounter('PHASE4D1-4C3-INVARIANT', true);
    a.p.stamina = 0;
    const hpBeforeEscape = a.p.hp;
    const escape = executeActorCommand(
      a.state,
      a.p,
      { type: 'FLEE', enemyId: a.state.encounter!.enemyId },
      new SeededRandom('PHASE4D1-4C3-ESCAPE'),
    );
    expect(escape.ok).toBe(true);
    expect(getPlayer(a.state).hp).toBe(hpBeforeEscape);

    // (b) 端到端：FLEE 成功并进入 resolved 结算态
    const { state, p } = stageEncounter('PHASE4D1-4C3-INVARIANT', true);
    p.stamina = 0;
    const hpBefore = p.hp;

    expect(getLegalPlayerCommands(state).map((a) => a.command.type)).toContain('FLEE');
    const res = executeCommand(state, { type: 'FLEE' });

    expect(res.ok).toBe(true);
    const next = getPlayer(res.state);
    expect(next.currentZoneId).toBe(p.currentZoneId);
    expect((res.state.encounter?.log ?? []).join('\n')).toContain('原地脱离');
    expect(res.state.encounter?.resolved).toBe(true);
    // 结算态照样有出口，不会因为多了一个 resolved 面板而卡死
    expect(
      getLegalPlayerCommands(res.state).map((a) => a.command.type),
    ).toContain('CLOSE_ENCOUNTER');

    // (c) HP 落差只能来自时间推进（环境），不能来自逃跑本身。
    // 用同种子、不逃跑只防御的控制组隔离「环境掉血」，两者落差必须一致。
    const ctrl = stageEncounter('PHASE4D1-4C3-INVARIANT', true);
    ctrl.p.stamina = 0;
    const ctrlHpBefore = ctrl.p.hp;
    const ctrlRes = executeCommand(ctrl.state, { type: 'GUARD' });
    const envDelta = ctrlHpBefore - getPlayer(ctrlRes.state).hp;
    const fleeDelta = hpBefore - next.hp;
    expect(fleeDelta).toBeLessThanOrEqual(envDelta);
  });

  it('对手体力充足时，原地脱离动作本身依然不触发追击结算', () => {
    // 原地脱离不做成功率判定，永远不会进入 fleeActor 的追击分支；
    // 这里只看脱离命令自身的结算文案，避免把「下一回合 NPC 正常出手」
    // 误判成追击——那是时间推进的结果，不是逃跑的代价。
    const { state, p, foe } = stageEncounter('PHASE4D1-4C3-NO-PURSUIT', true);
    p.stamina = 0;
    foe.stamina = foe.maxStamina;

    const res = executeCommand(state, { type: 'FLEE' });

    expect(res.ok).toBe(true);
    expect(res.message).toContain('原地脱离');
    expect(res.message).not.toContain('命中');
    expect(res.message).not.toContain('闪开');
    expect(getPlayer(res.state).currentZoneId).toBe(p.currentZoneId);
  });
});
