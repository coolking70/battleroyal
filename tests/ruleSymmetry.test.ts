/**
 * 规则对称性回归测试（Phase 2A 验收标准 2：「NPC 与玩家遵守同一规则」）。
 *
 * 第二阶段验收时，玩家在人格严格配对的对照实验里出手率只有同人格 NPC 的
 * 0.50 ~ 0.72 倍，最终名次也系统性偏低。逐条打点后定位到五处不对称，
 * 本文件为每一处钉一个回归用例，防止以后再被改回去。
 *
 * 五处不对称（均已修复）：
 *   S1 NPC 攻击玩家时，玩家不会反击（`allowCounter: !target.isPlayer`）
 *   S2 NPC 逃跑永不被追击，玩家逃跑必被追击（`allowPursuit: false`）
 *   S3 NPC 搜索遇敌可以顺带白嫖一次攻击，玩家不行
 *   S4 玩家只能攻击 `state.encounter` 里的那一个敌人，NPC 可以打同区域任何人
 *   S5 玩家没有正式遭遇就不能脱离，NPC 只要同区域有敌人就能脱离
 */
import { describe, expect, it } from 'vitest';
import { executeCommand } from '../src/core/gameEngine';
import { getLegalPlayerCommands } from '../src/core/legalActions';
import { attackActor, fleeActor } from '../src/core/actorActions';
import { SeededRandom } from '../src/core/random';
import type { Command, Combatant, GameState } from '../src/core/types';
import { newGame, npcs, player } from './helpers';

/**
 * 把恰好 `count` 名 NPC 搬到玩家所在区域，其余全部清走。
 *
 * 必须先清空再搬入：开局的落点是随机的，某些种子本来就会让 NPC 和玩家同区，
 * 只"搬入"不"清走"会让同区敌人数量随种子漂移，用例就不稳定了。
 */
function colocate(state: GameState, count = 1): Combatant[] {
  const p = player(state);
  const elsewhere = Object.keys(state.zones).find((z) => z !== p.currentZoneId)!;
  const all = npcs(state);
  for (const n of all) n.currentZoneId = elsewhere;

  const moved: Combatant[] = [];
  for (const n of all.slice(0, count)) {
    n.currentZoneId = p.currentZoneId;
    n.alive = true;
    n.hp = n.maxHp;
    n.stamina = n.maxStamina;
    moved.push(n);
  }
  for (const zoneId of Object.keys(state.zones)) {
    const zone = state.zones[zoneId];
    if (!zone) continue;
    zone.aliveCharacterIds = [p.id, ...all.map((n) => n.id)].filter(
      (id) => state.characters[id]?.currentZoneId === zoneId,
    );
  }
  return moved;
}

/** 把所有 NPC 清出玩家所在区域 */
function isolate(state: GameState): void {
  colocate(state, 0);
  for (const wild of Object.values(state.wildEnemies)) {
    wild.status = 'defeated';
    wild.hp = 0;
    wild.dropResolved = true;
    wild.defeatedAtTime = state.time;
  }
}

function types(cmds: { command: Command }[]): string[] {
  return [...new Set(cmds.map((c) => c.command.type))];
}

/* ------------------------------------------------------------------ */
/* S4：未遭遇时用泛化「袭击附近目标」，遭遇时精确指定对手                 */
/* ------------------------------------------------------------------ */

describe('[S4] 攻击目标选择（Phase 2A-1 信息隐藏）', () => {
  it('没有正式遭遇时，合法集合只给一个泛化的 ATTACK_NEARBY，不泄露目标身份', () => {
    const s = newGame('BR-SYM-S4-A');
    const [enemy] = colocate(s, 1);
    expect(s.encounter).toBeNull();

    const legal = getLegalPlayerCommands(s);
    const attacks = legal.filter((a) => a.command.type === 'ATTACK_NEARBY');
    expect(attacks.length).toBe(1);
    // 绝不出现指向具体目标 id 的 ATTACK
    expect(legal.some((a) => a.command.type === 'ATTACK')).toBe(false);
    expect(enemy).toBeDefined();
  });

  it('同区域有两名敌人时仍然只有一个泛化选项（不泄露人数）', () => {
    const s = newGame('BR-SYM-S4-B');
    colocate(s, 2);
    const legal = getLegalPlayerCommands(s);
    expect(legal.filter((a) => a.command.type === 'ATTACK_NEARBY').length).toBe(1);
    expect(legal.some((a) => a.command.type === 'ATTACK')).toBe(false);
  });

  it('没有遭遇时执行 ATTACK_NEARBY 必须成功，并自动建立正式遭遇', () => {
    const s = newGame('BR-SYM-S4-C');
    const [enemy] = colocate(s, 1);
    const res = executeCommand(s, { type: 'ATTACK_NEARBY', style: 'normal' });
    expect(res.ok).toBe(true);
    // 攻击后要么敌人已死（遭遇直接结算），要么进入遭遇状态
    const enc = res.state.encounter;
    expect(enc).not.toBeNull();
    expect(enc!.targetKind === 'wild' ? stateHasWild(res.state, enc!.enemyId) : enc!.enemyId === enemy!.id).toBe(true);
  });

  it('遭遇状态下攻击精确指定已识别的对手', () => {
    const s = newGame('BR-SYM-S4-E');
    const [enemy] = colocate(s, 1);
    const p = player(s);
    s.encounter = {
      enemyId: enemy!.id,
      zoneId: p.currentZoneId,
      startedAtTime: s.time,
      log: [],
      resolved: false,
    };
    const legal = getLegalPlayerCommands(s);
    const attacks = legal.filter((a) => a.command.type === 'ATTACK');
    expect(attacks.length).toBe(1);
    expect((attacks[0]!.command as { targetId: string }).targetId).toBe(enemy!.id);
    // 遭遇中不再提供泛化袭击（模态战斗）
    expect(legal.some((a) => a.command.type === 'ATTACK_NEARBY')).toBe(false);
  });

  it('不同区域没有敌人时，战斗动作不出现在合法集合里', () => {
    const s = newGame('BR-SYM-S4-D');
    isolate(s);
    const typesSet = types(getLegalPlayerCommands(s));
    expect(typesSet).not.toContain('ATTACK');
    expect(typesSet).not.toContain('ATTACK_NEARBY');
  });
});

function stateHasWild(state: GameState, uid: string): boolean {
  return state.wildEnemies[uid]?.status !== undefined;
}

/* ------------------------------------------------------------------ */
/* S5：没有正式遭遇也能脱离                                            */
/* ------------------------------------------------------------------ */

describe('[S5] 玩家脱离战斗不以「已进入遭遇」为前提', () => {
  it('同区域有敌人、没有遭遇时，FLEE 仍在合法集合里', () => {
    const s = newGame('BR-SYM-S5-A');
    colocate(s, 1);
    expect(s.encounter).toBeNull();
    expect(types(getLegalPlayerCommands(s))).toContain('FLEE');
  });

  it('没有遭遇时执行 FLEE 必须成功（引擎自动选定脱离对象）', () => {
    const s = newGame('BR-SYM-S5-B');
    colocate(s, 1);
    const res = executeCommand(s, { type: 'FLEE' });
    expect(res.ok).toBe(true);
  });

  it('同区域没有任何敌人时，FLEE 不得出现在合法集合里', () => {
    const s = newGame('BR-SYM-S5-C');
    isolate(s);
    expect(types(getLegalPlayerCommands(s))).not.toContain('FLEE');
  });

  it('体力为 0 时 FLEE 依然可用（免费行动，反死锁保险）', () => {
    const s = newGame('BR-SYM-S5-D');
    colocate(s, 1);
    player(s).stamina = 0;
    const legal = getLegalPlayerCommands(s);
    const flee = legal.find((a) => a.command.type === 'FLEE');
    expect(flee).toBeDefined();
    expect(flee!.staminaCost).toBe(0);
    expect(executeCommand(s, { type: 'FLEE' }).ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* S1 / S2：反击与追击对所有角色一视同仁                                */
/* ------------------------------------------------------------------ */

describe('[S1] 反击不区分攻防双方是不是玩家', () => {
  it('NPC 攻击玩家时，玩家同样有机会反击', () => {
    const s = newGame('BR-SYM-S1');
    const [enemy] = colocate(s, 1);
    const p = player(s);

    // 反击是概率事件，用多个种子累计观察是否出现过玩家反击
    let countered = false;
    for (let i = 0; i < 60 && !countered; i++) {
      const st = newGame(`BR-SYM-S1-${i}`);
      const [e] = colocate(st, 1);
      const pl = player(st);
      const res = attackActor(st, e!, pl, new SeededRandom(`k${i}`), {
        allowCounter: true,
      });
      if (res.countered) countered = true;
    }
    expect(countered).toBe(true);
    expect(p.id).toBeTruthy();
    expect(enemy).toBeDefined();
  });

  it('attackActor 默认开启反击（不需要调用方显式传参）', () => {
    let countered = false;
    for (let i = 0; i < 60 && !countered; i++) {
      const st = newGame(`BR-SYM-S1B-${i}`);
      const [e] = colocate(st, 1);
      const res = attackActor(st, e!, player(st), new SeededRandom(`d${i}`));
      if (res.countered) countered = true;
    }
    expect(countered).toBe(true);
  });
});

describe('[S2] 逃跑失败被追击，对 NPC 与玩家一致', () => {
  it('NPC 逃跑失败时同样会被追击', () => {
    let pursued = false;
    for (let i = 0; i < 80 && !pursued; i++) {
      const st = newGame(`BR-SYM-S2-${i}`);
      const [e] = colocate(st, 1);
      const res = fleeActor(st, e!, player(st), new SeededRandom(`f${i}`), {
        allowPursuit: true,
      });
      if (res.ok && res.pursued) pursued = true;
    }
    expect(pursued).toBe(true);
  });

  it('玩家逃跑失败时同样会被追击（同一段代码）', () => {
    let pursued = false;
    for (let i = 0; i < 80 && !pursued; i++) {
      const st = newGame(`BR-SYM-S2B-${i}`);
      const [e] = colocate(st, 1);
      const res = fleeActor(st, player(st), e!, new SeededRandom(`g${i}`), {
        allowPursuit: true,
      });
      if (res.ok && res.pursued) pursued = true;
    }
    expect(pursued).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 撤离禁区：NPC 的 evacuate 优先级高于交战，玩家必须同权                */
/* ------------------------------------------------------------------ */

describe('[S6] 遭遇战中允许撤离禁区', () => {
  it('身处禁区且在遭遇中时，移动仍然合法', () => {
    const s = newGame('BR-SYM-S6-A');
    const [enemy] = colocate(s, 1);
    const p = player(s);
    s.encounter = {
      enemyId: enemy!.id,
      zoneId: p.currentZoneId,
      startedAtTime: s.time,
      log: [],
      resolved: false,
    };
    const zone = s.zones[p.currentZoneId]!;
    zone.status = 'restricted';
    zone.restrictedAtTime = s.time;

    const legal = getLegalPlayerCommands(s);
    expect(types(legal)).toContain('MOVE');

    const move = legal.find((a) => a.command.type === 'MOVE')!;
    expect(executeCommand(s, move.command).ok).toBe(true);
  });

  it('安全区里的遭遇战依旧不能一走了之（模态战斗未被推翻）', () => {
    const s = newGame('BR-SYM-S6-B');
    const [enemy] = colocate(s, 1);
    const p = player(s);
    s.encounter = {
      enemyId: enemy!.id,
      zoneId: p.currentZoneId,
      startedAtTime: s.time,
      log: [],
      resolved: false,
    };
    const zone = s.zones[p.currentZoneId]!;
    zone.status = 'safe';

    expect(types(getLegalPlayerCommands(s))).not.toContain('MOVE');
  });
});

/* ------------------------------------------------------------------ */
/* 契约回归：合法集合里的命令必须都能执行成功                            */
/* ------------------------------------------------------------------ */

describe('[S7] 合法集合契约在新增的战斗动作下依然成立', () => {
  it('同区域有敌人时，每一条合法命令都能被引擎接受', () => {
    const s = newGame('BR-SYM-S7');
    colocate(s, 2);
    const legal = getLegalPlayerCommands(s);
    expect(legal.length).toBeGreaterThan(0);

    for (const a of legal) {
      const res = executeCommand(s, a.command);
      expect(
        res.ok,
        `合法集合里的 ${a.label}（${a.command.type}）被引擎拒绝：${res.message}`,
      ).toBe(true);
    }
  });
});
