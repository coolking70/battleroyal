/**
 * Phase 4E-1 缺陷 A：击杀 / 被击杀 / 遭遇期间环境致死，三种战报均写入 encounter.log。
 *
 * 只验证「战报写入」这一件事本身（最小、确定性）：直接走统一生命结算
 * `applyDamage` → `killCharacter`，断言死亡行被追加进本次遭遇战报，且归属明确。
 * 与既有 combat-log 测试（phase4d1）互补——那里验"每次动作写日志"，
 * 这里验"最后一击的结果不再缺失"。
 */

import { describe, expect, it } from 'vitest';
import { applyDamage } from '../src/core/vitals';
import { getPlayer, refreshZoneOccupants } from '../src/core/gameState';
import { clearInventory, newGame, npcs, player } from './helpers';
import type { GameState } from '../src/core/types';

interface Staged {
  state: GameState;
  p: ReturnType<typeof player>;
  foe: ReturnType<typeof player>;
}

function stageEncounter(seed: string, killOthers = true): Staged {
  const state = newGame(seed);
  const p = player(state);
  const all = npcs(state);
  const foe = all[0]!;
  if (killOthers) {
    for (const other of all.slice(1)) other.alive = false;
  } else {
    for (const other of all) other.alive = true;
  }
  foe.alive = true;
  foe.currentZoneId = p.currentZoneId;
  refreshZoneOccupants(state);
  state.encounter = {
    enemyId: foe.id,
    zoneId: p.currentZoneId,
    startedAtTime: state.time,
    log: [],
    resolved: false,
  };
  return { state, p, foe };
}

describe('Phase 4E-1 缺陷 A：击杀写入战斗记录（归属明确）', () => {
  it('玩家击杀敌人：战报出现"X 被 你 击杀"，且明确点名', () => {
    const { state, p, foe } = stageEncounter('PHASE4E1-KILL');
    clearInventory(foe);
    const before = state.encounter!.log.length;

    applyDamage(state, foe, 999, p.id, '战斗');

    const log = state.encounter!.log;
    expect(log.length).toBe(before + 1);
    const line = log[log.length - 1]!;
    expect(line).toContain(foe.name);
    expect(line).toContain(p.name);
    expect(line).toContain('击杀');
    // 信息边界：不含精确 HP 比值（如 "0/40"）
    expect(line).not.toMatch(/\d+\/\d+/);
  });

  it('玩家被击杀：战报出现"你 被 X 击杀"', () => {
    const { state, p, foe } = stageEncounter('PHASE4E1-KILLED');
    const before = state.encounter!.log.length;

    applyDamage(state, p, 999, foe.id, '战斗');

    const log = state.encounter!.log;
    expect(log.length).toBe(before + 1);
    const line = log[log.length - 1]!;
    expect(line).toContain(p.name);
    expect(line).toContain(foe.name);
    expect(line).toContain('击杀');
  });

  it('遭遇期间环境致死：战报说明是环境而非交手所致', () => {
    const { state, foe } = stageEncounter('PHASE4E1-ENV');
    const before = state.encounter!.log.length;

    // killerId = null → 环境致死（禁区侵蚀 / 研究异常等）
    applyDamage(state, foe, 999, null, '禁区侵蚀');

    const log = state.encounter!.log;
    expect(log.length).toBe(before + 1);
    const line = log[log.length - 1]!;
    expect(line).toContain(foe.name);
    expect(line).toContain('死亡');
    expect(line).toContain('禁区侵蚀');
    // 环境致死不应写成"被某人击杀"
    expect(line).not.toContain('击杀');
  });

  it('信息边界：非本次遭遇参与者的死亡不写入战报', () => {
    // 保留两名活着的 NPC：foe=敌人，other=第三方；玩家击杀 other 不应进战报
    const { state, p } = stageEncounter('PHASE4E1-GUARD', false);
    const all = npcs(state);
    const other = all[1]!;
    other.alive = true;
    other.currentZoneId = p.currentZoneId;
    refreshZoneOccupants(state);
    const before = [...state.encounter!.log];

    applyDamage(state, other, 999, p.id, '战斗');

    expect(state.encounter!.log).toEqual(before);
  });

  it('缺陷 A 只增加战报写入，不改变死亡结算 / resolved 时机', () => {
    const { state, p, foe } = stageEncounter('PHASE4E1-SETTLE');
    clearInventory(foe);

    applyDamage(state, foe, 999, p.id, '战斗');

    // 敌方死亡 → 遭遇进入 resolved（与 4D-1 既有行为一致，未被改动）
    expect(state.encounter!.resolved).toBe(true);
    expect(getPlayer(state).alive).toBe(true);
    // 事件流照常存在一条 CHARACTER_DIED
    expect(state.events.some((e) => e.type === 'CHARACTER_DIED' && e.targetId === foe.id)).toBe(true);
  });
});
