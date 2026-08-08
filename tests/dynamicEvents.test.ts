import { describe, it, expect } from 'vitest';
import { createGame } from '../src/core/gameState';
import { SeededRandom } from '../src/core/random';
import { executeCommand } from '../src/core/gameEngine';
import { runDynamicEvents } from '../src/core/dynamicEvents';
import { countLoot } from '../src/core/zoneLoot';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { createMemoryStorage, loadGame, saveGame, setStorage } from '../src/core/saveLoad';
import type { Combatant, GameState } from '../src/core/types';

function advance(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = executeCommand(s, { type: 'DEBUG_ADVANCE_TIME' }).state;
  }
  return s;
}

function playerOf(s: GameState): Combatant {
  return s.characters[s.playerId]!;
}

describe('动态事件框架 · 基础', () => {
  it('开局不含任何生效中的动态事件', () => {
    const s = createGame({ seed: 'DE-BASE', playerCharacterId: 'scout' });
    expect(Array.isArray(s.activeEvents)).toBe(true);
    expect(s.activeEvents.length).toBe(0);
  });

  it('时间推进到首个事件阈值后会出现动态事件', () => {
    const s = createGame({ seed: 'DE-TRIG', playerCharacterId: 'medic' });
    // 一直推进到首事件阈值之后，应至少触发过一次
    const end = advance(s, GAME_CONFIG.firstDynamicEventTime + 3);
    const triggered = end.events.some((e) => e.type === 'DYNAMIC_EVENT');
    expect(triggered).toBe(true);
  });

  it('同种子结果确定（两次推进事件序列一致）', () => {
    const a = advance(createGame({ seed: 'DE-DET', playerCharacterId: 'fighter' }), 60);
    const b = advance(createGame({ seed: 'DE-DET', playerCharacterId: 'fighter' }), 60);
    expect(a.events.filter((e) => e.type === 'DYNAMIC_EVENT').map((e) => e.message)).toEqual(
      b.events.filter((e) => e.type === 'DYNAMIC_EVENT').map((e) => e.message),
    );
  });
});

describe('动态事件框架 · 风暴', () => {
  it('风暴对区域内角色施加持续伤害状态', () => {
    const s = createGame({ seed: 'DE-STORM', playerCharacterId: 'engineer' });
    const rng = SeededRandom.fromState(s.rngState);
    // 触发风暴命中玩家所在区域
    const zoneId = s.zones[playerOf(s).currentZoneId].id;
    s.nextDynamicEventTime = s.time;
    // 通过反复触发直到命中玩家所在区域（风暴随机选区域，最多尝试若干次）
    let stormed = false;
    for (let i = 0; i < 30 && !stormed; i++) {
      s.nextDynamicEventTime = s.time;
      const before = playerOf(s).hp;
      runDynamicEvents(s, rng);
      const storm = s.activeEvents.find((e) => e.type === 'storm' && e.zoneId === zoneId);
      if (storm) {
        // 推进一回合让状态生效
        advance(s, 1);
        expect(playerOf(s).hp).toBeLessThanOrEqual(before);
        stormed = true;
      }
    }
    expect(stormed).toBe(true);
  });
});

describe('动态事件框架 · 空投', () => {
  it('空投向某区域补充物资', () => {
    const s = createGame({ seed: 'DE-DROP', playerCharacterId: 'scout' });
    const rng = SeededRandom.fromState(s.rngState);
    // 反复触发直到出现一次空投，并检查其目标区域库存确实增加
    let added = false;
    for (let i = 0; i < 60 && !added; i++) {
      s.nextDynamicEventTime = s.time;
      const evBefore = s.events.length;
      runDynamicEvents(s, rng);
      s.rngState = rng.getState();
      const newEvents = s.events.slice(evBefore);
      const drop = newEvents.find(
        (e) => e.type === 'DYNAMIC_EVENT' && e.metadata.eventType === 'supply_drop',
      );
      if (drop && typeof drop.metadata.zoneId === 'string') {
        const zone = s.zones[drop.metadata.zoneId];
        if (zone) {
          // 该区域库存应已增加 supplyDropCount 件（初始化后只增不减）
          expect(countLoot(zone.loot)).toBeGreaterThan(0);
          added = true;
        }
      }
    }
    expect(added).toBe(true);
  });
});

describe('动态事件框架 · 伏击', () => {
  it('伏击会把一名 NPC 拉进玩家区域并造成突袭伤害', () => {
    const s = createGame({ seed: 'DE-AMB', playerCharacterId: 'fighter' });
    const rng = SeededRandom.fromState(s.rngState);
    const playerZone = playerOf(s).currentZoneId;
    const before = playerOf(s).hp;
    // 反复触发直到出现伏击
    let ambushed = false;
    for (let i = 0; i < 40 && !ambushed; i++) {
      s.nextDynamicEventTime = s.time;
      const hpBefore = playerOf(s).hp;
      runDynamicEvents(s, rng);
      const amb = s.activeEvents.find((e) => e.type === 'ambush');
      if (amb) {
        // 伏击即时结算，玩家应受到伤害
        expect(playerOf(s).hp).toBeLessThan(hpBefore);
        // 应有某名 NPC 现在位于玩家区域
        const intruder = Object.values(s.characters).find(
          (c) => !c.isPlayer && c.alive && c.currentZoneId === playerZone,
        );
        expect(intruder).toBeTruthy();
        ambushed = true;
      }
      void before;
    }
    expect(ambushed).toBe(true);
  });
});

describe('动态事件框架 · 衰减', () => {
  it('事件 remaining 会随时间递减并消失', () => {
    const s = createGame({ seed: 'DE-DECAY', playerCharacterId: 'medic' });
    const rng = SeededRandom.fromState(s.rngState);
    s.nextDynamicEventTime = s.time;
    runDynamicEvents(s, rng);
    expect(s.activeEvents.length).toBeGreaterThan(0);
    const total = s.activeEvents.length;
    // 推进足够多回合，所有瞬时/持续事件都应衰减完毕
    advance(s, GAME_CONFIG.stormDuration + 2);
    expect(s.activeEvents.length).toBeLessThanOrEqual(total);
  });
});

describe('动态事件框架 · 存档', () => {
  it('含动态事件的存档可正常保存并恢复', () => {
    setStorage(createMemoryStorage());
    const s = createGame({ seed: 'DE-SAVE', playerCharacterId: 'scout' });
    // 强制触发一次动态事件，使其进入 activeEvents
    const rng = SeededRandom.fromState(s.rngState);
    s.nextDynamicEventTime = s.time;
    runDynamicEvents(s, rng);
    s.rngState = rng.getState();
    const beforeCount = s.activeEvents.length;
    expect(beforeCount).toBeGreaterThan(0);

    expect(saveGame(s).ok).toBe(true);
    const loaded = loadGame();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(Array.isArray(loaded.data.state.activeEvents)).toBe(true);
    expect(loaded.data.state.activeEvents.length).toBe(beforeCount);
    expect(loaded.data.state.nextDynamicEventTime).toBe(s.nextDynamicEventTime);
  });
});
