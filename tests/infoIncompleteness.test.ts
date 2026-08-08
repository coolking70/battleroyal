/**
 * 信息不完全回归测试（Phase 3A-1 §27）。
 *
 * 核心断言：任何技能 / 世界事件都不得把「隐藏人物信息」变成玩家可见情报。
 *  - 警觉侦察（scout_recon）前后 playerIntel 必须为空；
 *  - 玩家本来认识一个敌人时，技能不得凭空更新其精确新位置；
 *  - 紧急广播触发后 playerIntel 不新增任何 NPC；
 *  - 未发生遭遇时：地图只给模糊存在感（绝不出现精确人数/姓名）。
 */

import { describe, it, expect } from 'vitest';
import { createGame } from '../src/core/gameState';
import { SeededRandom } from '../src/core/random';
import {
  refreshPlayerSight,
  zonePresence,
  PRESENCE_TEXT,
  listIntel,
} from '../src/core/info';
import { runWorldEvents } from '../src/core/worldEvents';
import { canUseSkill, useSkill } from '../src/core/skills';
import type { GameState } from '../src/core/types';

function newGame(seed = 'INFO-TEST', char = 'scout'): GameState {
  return createGame({ seed, playerCharacterId: char });
}

function playerOf(s: GameState) {
  return s.characters[s.playerId]!;
}

function castScoutRecon(s: GameState): void {
  const p = playerOf(s);
  p.stamina = p.maxStamina;
  p.skillCooldowns = {};
  expect(canUseSkill(p, 'scout_recon').ok).toBe(true);
  useSkill(s, p, 'scout_recon', new SeededRandom(1));
}

describe('警觉侦察不得建立精确 playerIntel', () => {
  it('使用前 playerIntel 为空 → 使用后仍为空', () => {
    const s = newGame();
    expect(Object.keys(s.playerIntel)).toEqual([]);
    castScoutRecon(s);
    expect(Object.keys(s.playerIntel)).toEqual([]);
  });

  it('玩家本来认识一个敌人 → 技能不凭空更新其精确新位置', () => {
    const s = newGame();
    const known = Object.values(s.characters).find((c) => !c.isPlayer)!;
    // 玩家在某区域见过该敌人（旧情报）
    s.playerIntel[known.id] = { zoneId: 'school', atTime: 0, source: 'encounter' };
    castScoutRecon(s);
    // 情报条目与时间戳均未被技能刷新（atTime 仍是 0）
    expect(s.playerIntel[known.id]!.atTime).toBe(0);
    expect(s.playerIntel[known.id]!.zoneId).toBe('school');
  });

  it('技能产生的状态不含任何人物列表（ReconState 语义）', () => {
    const s = newGame();
    castScoutRecon(s);
    const p = playerOf(s);
    const aware = p.statusEffects.find((e) => e.id === 'scout_awareness')!;
    expect(aware).toBeDefined();
    // 警觉状态只携带 id/remaining/label 等纯状态字段
    expect(Object.keys(aware).sort()).toEqual(
      ['id', 'remaining', 'hpPerTick', 'label'].sort(),
    );
  });
});

describe('紧急广播不得泄露人物情报', () => {
  it('广播触发后 playerIntel 不新增任何 NPC', () => {
    const s = newGame();
    const before = Object.keys(s.playerIntel);
    let broadcastSeen = false;
    for (let i = 0; i < 500; i++) {
      s.nextWorldEventTime = 0;
      s.activeWorldEvents = [];
      s.time += 1;
      runWorldEvents(s, new SeededRandom(8000 + i));
      if (s.worldEventHistory.some((h) => h.eventId === 'emergency_broadcast')) {
        broadcastSeen = true;
        break;
      }
    }
    expect(broadcastSeen).toBe(true);
    expect(Object.keys(s.playerIntel)).toEqual(before);
  });
});

describe('未遭遇时地图不显示姓名/精确人数', () => {
  it('refreshPlayerSight 无遭遇时不产生情报', () => {
    const s = newGame();
    const p = playerOf(s);
    // 把几个 NPC 放进玩家同区制造“人很多”的环境，但未遭遇
    const zoneId = p.currentZoneId;
    for (const npc of Object.values(s.characters).filter((c) => !c.isPlayer)) {
      npc.currentZoneId = zoneId;
    }
    refreshPlayerSight(s);
    expect(Object.keys(s.playerIntel)).toEqual([]);
    expect(listIntel(s)).toEqual([]);
  });

  it('存在感分档只给模糊文案，不含精确人数', () => {
    const s = newGame();
    const p = playerOf(s);
    const zoneId = p.currentZoneId;
    for (const npc of Object.values(s.characters).filter((c) => !c.isPlayer)) {
      npc.currentZoneId = zoneId;
    }
    const level = zonePresence(s);
    expect(['none', 'some', 'active', 'many']).toContain(level);
    // 文案里绝不出现数字（精确人数）
    for (const text of Object.values(PRESENCE_TEXT)) {
      expect(/[0-9]/.test(text)).toBe(false);
    }
  });

  it('整局推进（含遭遇外的所有动作）不产生非遭遇情报', () => {
    const s = newGame('INFO-2');
    const p = playerOf(s);
    // 只走不触发遭遇的路径：休息/移动/搜索到空区等 —— 这里直接验证
    // 「未遭遇时 refreshPlayerSight 不写情报」的契约已由上一用例覆盖；
    // 本用例补充：遭遇产生的情报只能来自 ENCOUNTER 建立。
    const enemy = Object.values(s.characters).find((c) => !c.isPlayer)!;
    s.encounter = {
      enemyId: enemy.id,
      zoneId: p.currentZoneId,
      startedAtTime: s.time,
      log: ['遭遇。'],
      resolved: false,
    };
    enemy.currentZoneId = p.currentZoneId;
    const z = s.zones[p.currentZoneId]!;
    if (!z.aliveCharacterIds.includes(enemy.id)) z.aliveCharacterIds.push(enemy.id);
    refreshPlayerSight(s);
    expect(Object.keys(s.playerIntel).length).toBe(1); // 只有遭遇对象
    expect(s.playerIntel[enemy.id]).toBeDefined();
  });
});
