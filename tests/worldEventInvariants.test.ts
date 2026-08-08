/**
 * 世界事件不变量测试（Phase 3A-1 行为规则版）。
 *
 * 覆盖：
 *  1. 结构自洽：`auditWorldEventInvariants` 对全新/推进后的对局始终 ok；
 *  2. 行为规则（§24 主红线，不再以 readFileSync 为主）：
 *     - 停电：enemyWeight 变低、nothingWeight 变高、不改变战斗命中；
 *     - 暴雨：玩家/NPC MOVE +1 体力、远程命中降低、近战命中不变、逃跑率不变；
 *     - 广播：选择高噪音区域、不写入所有 NPC playerIntel、不显示精确人数；
 *     - 医疗警报：医院治疗 +20%、其他区域不受影响；
 *     - 研究异常：lab 每 tick -3、其他区域 0、可致死且死亡流程正确；
 *     - 全域骚动：噪音不衰减、搜索噪音增加、结束后恢复正常衰减。
 *  3. 辅助红线：worldEvents.ts 不得 import zoneLoot / inventory（编译期兜底）。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { createGame } from '../src/core/gameState';
import {
  runWorldEvents,
  WORLD_EVENT_IDS,
  pickBroadcastZone,
} from '../src/core/worldEvents';
import { applyWorldEventTickDamage } from '../src/core/worldEventTick';
import { auditWorldEventInvariants } from '../src/core/worldEventAudit';
import { SeededRandom } from '../src/core/random';
import { getTimeAdvancingActions } from '../src/core/legalActions';
import { executeCommand } from '../src/core/gameEngine';
import { computeSearchWeights } from '../src/core/search';
import { moveStaminaCostFor } from '../src/core/actionCosts';
import { hitChanceIn, fleeChanceIn } from '../src/core/combat';
import { healMultiplierOf } from '../src/core/consumables';
import { addNoise, decayNoise } from '../src/core/info';
import type { GameState, WorldEventId, WorldEventState } from '../src/core/types';

const CHARS = ['scout', 'fighter', 'engineer', 'medic'] as const;

function freshGame(seed: string, char = 'scout'): GameState {
  return createGame({ seed, playerCharacterId: char });
}

/** 往 activeWorldEvents 里直接压入一个事件实例（跳过随机调度） */
function forceEvent(state: GameState, eventId: WorldEventId, zoneId: string | null = null, remaining?: number): void {
  const def = {
    blackout: 6,
    rain: 6,
    emergency_broadcast: 0,
    medical_alert: GAME_CONFIG.medicalAlertDuration,
    research_anomaly: GAME_CONFIG.researchAnomalyDuration,
    citywide_unrest: GAME_CONFIG.unrestDuration,
  }[eventId]!;
  const ev: WorldEventState = {
    id: `weT${state.eventSeq}`,
    eventId,
    scope: zoneId ? 'zone' : 'global',
    zoneId: zoneId ?? null,
    startedAtTime: state.time,
    remaining: remaining ?? def,
    label: eventId,
    description: eventId,
  };
  state.activeWorldEvents.push(ev);
  state.eventSeq += 1;
}

describe('auditWorldEventInvariants — 结构自洽', () => {
  it('全新对局与随机推进后的对局始终通过审计', () => {
    const s0 = freshGame('audit-0');
    expect(auditWorldEventInvariants(s0).ok).toBe(true);
    for (let g = 0; g < 30; g++) {
      let s = freshGame(`audit-${g}`, CHARS[g % CHARS.length]!);
      const rng = new SeededRandom(7000 + g);
      let guard = 0;
      while (s.status === 'playing' && guard++ < 400) {
        const adv = getTimeAdvancingActions(s);
        if (adv.length === 0) break;
        const pick = adv[rng.int(0, adv.length - 1)]!;
        const r = executeCommand(s, pick.command);
        if (!r.ok) break;
        s = r.state;
      }
      const rep = auditWorldEventInvariants(s);
      expect(rep.ok, `game ${g}: ${rep.problems.join(' | ')}`).toBe(true);
    }
  });
});

describe('停电 blackout — 行为规则', () => {
  it('搜索遭遇敌人权重变低、空手权重变高', () => {
    const s = freshGame('bk-1', 'fighter');
    const p = s.characters[s.playerId]!;
    // 让同区有敌人，使 enemy 权重非零
    const npc = Object.values(s.characters).find((c) => !c.isPlayer)!;
    npc.currentZoneId = p.currentZoneId;
    const base = computeSearchWeights(s, p);
    expect(base.enemy).toBeGreaterThan(0);
    forceEvent(s, 'blackout');
    const mod = computeSearchWeights(s, p);
    expect(mod.enemy).toBeCloseTo(base.enemy * 0.8, 5);
    expect(mod.nothing).toBeCloseTo(base.nothing * 1.1, 5);
    // find 不受影响
    expect(mod.find).toBeCloseTo(base.find, 5);
  });

  it('不改变战斗命中', () => {
    const s = freshGame('bk-2', 'fighter');
    const p = s.characters[s.playerId]!;
    const e = Object.values(s.characters).find((c) => !c.isPlayer)!;
    p.currentZoneId = e.currentZoneId;
    const before = hitChanceIn(s, p, e, 'normal');
    forceEvent(s, 'blackout');
    const after = hitChanceIn(s, p, e, 'normal');
    expect(after).toBe(before);
  });
});

describe('暴雨 rain — 行为规则', () => {
  function rangedSetup(): { s: GameState; p: GameState['characters'][string]; e: GameState['characters'][string] } {
    const s = freshGame('rn-1', 'scout');
    const p = s.characters[s.playerId]!;
    const e = Object.values(s.characters).find((c) => !c.isPlayer)!;
    p.currentZoneId = e.currentZoneId;
    p.inventory.push({ uid: 'bow', itemId: 'simple_bow', count: 1, durability: 5 } as never);
    p.equipment = [{ uid: 'bow', itemId: 'simple_bow', count: 1, durability: 5 } as never];
    p.equippedWeaponId = 'bow';
    return { s, p, e };
  }

  it('玩家与 NPC 移动体力均 +1（走 actionCosts）', () => {
    const { s, p } = rangedSetup();
    const npc = Object.values(s.characters).find((c) => !c.isPlayer)!;
    const basePlayer = moveStaminaCostFor(s, p);
    const baseNpc = moveStaminaCostFor(s, npc);
    expect(basePlayer).toBe(GAME_CONFIG.moveStaminaCost);
    expect(baseNpc).toBe(GAME_CONFIG.moveStaminaCost);
    forceEvent(s, 'rain');
    expect(moveStaminaCostFor(s, p)).toBe(GAME_CONFIG.moveStaminaCost + 1);
    expect(moveStaminaCostFor(s, npc)).toBe(GAME_CONFIG.moveStaminaCost + 1);
  });

  it('远程命中降低 ×0.9、近战命中不变、逃跑率不变', () => {
    const { s, p, e } = rangedSetup();
    const rangedBefore = hitChanceIn(s, p, e, 'normal');
    // 近战：换下远程武器
    p.equipment = [];
    p.equippedWeaponId = null;
    const meleeBefore = hitChanceIn(s, p, e, 'normal');
    const fleeBefore = fleeChanceIn(s, p, e);
    forceEvent(s, 'rain');
    p.equipment = [{ uid: 'bow', itemId: 'simple_bow', count: 1, durability: 5 } as never];
    p.equippedWeaponId = 'bow';
    const rangedAfter = hitChanceIn(s, p, e, 'normal');
    p.equipment = [];
    p.equippedWeaponId = null;
    const meleeAfter = hitChanceIn(s, p, e, 'normal');
    const fleeAfter = fleeChanceIn(s, p, e);
    expect(rangedAfter).toBeCloseTo(rangedBefore * 0.9, 5);
    expect(meleeAfter).toBe(meleeBefore);
    expect(fleeAfter).toBe(fleeBefore);
  });
});

describe('紧急广播 emergency_broadcast — 行为规则', () => {
  it('选择高噪音区域（纯函数）', () => {
    const s = freshGame('bc-1');
    s.zones.lab!.noiseLevel = GAME_CONFIG.noiseLoudThreshold;
    expect(pickBroadcastZone(s)).toBe('lab');
    // 全部安静 → 无目标
    for (const z of Object.values(s.zones)) z.noiseLevel = 0;
    expect(pickBroadcastZone(s)).toBeNull();
  });

  it('广播后 playerIntel 不新增任何 NPC（不泄露身份/人数）', () => {
    const s = freshGame('bc-2');
    const before = Object.keys(s.playerIntel).length;
    // 触发一次完整的广播流程（走 runWorldEvents 调度；用足够大的种子空间找广播）
    let broadcastSeen = false;
    for (let i = 0; i < 400; i++) {
      const rng = new SeededRandom(9000 + i);
      s.nextWorldEventTime = 0;
      s.activeWorldEvents = [];
      s.time += 1;
      runWorldEvents(s, rng);
      const bc = s.worldEventHistory.some((h) => h.eventId === 'emergency_broadcast');
      if (bc) {
        broadcastSeen = true;
        break;
      }
    }
    expect(broadcastSeen).toBe(true);
    // 广播只记录噪音区域，不产生任何精确人物情报
    expect(Object.keys(s.playerIntel).length).toBe(before);
    // 只检查广播事件自身的消息：不含人名/精确人数（允许“监控发现「X」近期活动频繁”类文案）
    const msg = s.events
      .filter(
        (e) =>
          e.type === 'WORLD_EVENT' &&
          e.metadata?.worldEventId === 'emergency_broadcast',
      )
      .map((e) => e.message)
      .join(' ');
    expect(msg.length).toBeGreaterThan(0);
    expect(/监控发现「/.test(msg) || /暂未发现明显集中活动/.test(msg)).toBe(true);
  });
});

describe('医疗警报 medical_alert — 行为规则', () => {
  it('医院治疗 +20%，其他区域不受影响', () => {
    const s = freshGame('ma-1', 'medic');
    const p = s.characters[s.playerId]!;
    p.currentZoneId = 'hospital';
    const baseHospital = healMultiplierOf(p, s);
    forceEvent(s, 'medical_alert', 'hospital');
    expect(healMultiplierOf(p, s)).toBeCloseTo(baseHospital * 1.2, 5);
    // 其他区域
    p.currentZoneId = 'factory';
    expect(healMultiplierOf(p, s)).toBeCloseTo(baseHospital, 5);
  });
});

describe('研究异常 research_anomaly — 行为规则', () => {
  it('lab 每 tick -3，其他区域 0，可致死且死亡流程正确', () => {
    const s = freshGame('ra-1');
    forceEvent(s, 'research_anomaly', GAME_CONFIG.researchAnomalyZoneId);
    // 把一个 NPC 放进 lab，血量设为 3
    const lab = s.zones[GAME_CONFIG.researchAnomalyZoneId]!;
    const npc = Object.values(s.characters).find((c) => !c.isPlayer)!;
    npc.currentZoneId = lab.id;
    npc.hp = 3;
    lab.aliveCharacterIds = [...lab.aliveCharacterIds, npc.id].filter((v, i, a) => a.indexOf(v) === i);
    // 另一个 NPC 留在原区域
    const other = Object.values(s.characters).find((c) => !c.isPlayer && c.id !== npc.id)!;
    const otherHp = other.hp;
    applyWorldEventTickDamage(s);
    expect(npc.alive).toBe(false); // 3 点伤害正好致死
    expect(npc.hp).toBe(0);
    expect(npc.diedAtTime).not.toBeNull();
    expect(other.hp).toBe(otherHp); // 其他区域不受影响
    // 死亡只发生一次：再次 tick 不再变化
    applyWorldEventTickDamage(s);
    expect(npc.diedAtTime).not.toBeNull();
  });

  it('伤害走 applyDamage（写入事件与 stats.damageTaken）', () => {
    const s = freshGame('ra-2');
    forceEvent(s, 'research_anomaly', GAME_CONFIG.researchAnomalyZoneId);
    const lab = s.zones[GAME_CONFIG.researchAnomalyZoneId]!;
    const npc = Object.values(s.characters).find((c) => !c.isPlayer)!;
    npc.currentZoneId = lab.id;
    npc.hp = 50;
    const before = npc.stats.damageTaken;
    const eventCountBefore = s.events.length;
    applyWorldEventTickDamage(s);
    expect(npc.hp).toBe(50 - GAME_CONFIG.researchAnomalyDamagePerTick);
    expect(npc.stats.damageTaken).toBe(before + GAME_CONFIG.researchAnomalyDamagePerTick);
    expect(s.events.length).toBeGreaterThan(eventCountBefore);
  });
});

describe('全域骚动 citywide_unrest — 行为规则', () => {
  it('噪音停止自然衰减，结束后恢复正常', () => {
    const s = freshGame('cu-1');
    for (const z of Object.values(s.zones)) z.noiseLevel = 10;
    forceEvent(s, 'citywide_unrest');
    decayNoise(s);
    for (const z of Object.values(s.zones)) {
      expect(z.noiseLevel).toBe(10); // 未衰减
    }
    // 事件结束后（remaining=0 移除）恢复衰减
    s.activeWorldEvents = [];
    decayNoise(s);
    for (const z of Object.values(s.zones)) {
      expect(z.noiseLevel).toBeLessThan(10);
    }
  });

  it('搜索产生的噪音增加（×1.5）', () => {
    const s = freshGame('cu-2');
    const p = s.characters[s.playerId]!;
    const zone = s.zones[p.currentZoneId]!;
    const baseNoise = GAME_CONFIG.noiseFromSearch;
    forceEvent(s, 'citywide_unrest');
    const before = zone.noiseLevel;
    addNoise(s, zone.id, 'search');
    const expected = before + Math.ceil(baseNoise * GAME_CONFIG.unrestSearchNoiseMult);
    expect(zone.noiseLevel).toBe(expected);
  });
});

describe('辅助红线 — 编译期兜底', () => {
  it('worldEvents.ts 不得 import zoneLoot / inventory（实体写入模块）', () => {
    const src = readFileSync(resolve(__dirname, '../src/core/worldEvents.ts'), 'utf8');
    for (const mod of ['zoneLoot', 'inventory']) {
      const present = src
        .split('\n')
        .some((line) => /^\s*import\b/.test(line) && line.includes(`'./${mod}'`));
      expect(present, `worldEvents.ts 不应 import ./${mod}`).toBe(false);
    }
  });

  it('WORLD_EVENT_IDS 恰好是 6 种（不新增第 7 种）', () => {
    expect(WORLD_EVENT_IDS).toEqual([
      'blackout',
      'rain',
      'emergency_broadcast',
      'medical_alert',
      'research_anomaly',
      'citywide_unrest',
    ]);
  });
});
