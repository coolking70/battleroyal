import { describe, expect, it } from 'vitest';

import { handleAttack, handleFlee } from '../src/core/commandHandlers';
import { getPlayer, refreshZoneOccupants } from '../src/core/gameState';
import { SeededRandom } from '../src/core/random';
import type { AttackStyle, Combatant, GameState } from '../src/core/types';
import { clearInventory, newGame, npcs, player } from './helpers';

interface Stage {
  state: GameState;
  p: Combatant;
  foe: Combatant;
}

function stageEncounter(seed: string, lastSafeZone = false): Stage {
  const state = newGame(seed);
  const p = player(state);
  clearInventory(p);
  const [foe, ...others] = npcs(state);
  if (!foe) throw new Error('缺少测试敌人');
  for (const other of others) other.alive = false;
  foe.alive = true;
  foe.currentZoneId = p.currentZoneId;
  if (lastSafeZone) {
    for (const zone of Object.values(state.zones)) {
      if (zone.id !== p.currentZoneId) zone.status = 'restricted';
    }
  }
  refreshZoneOccupants(state);
  state.encounter = {
    enemyId: foe.id,
    zoneId: p.currentZoneId,
    startedAtTime: state.time,
    log: [`你与 ${foe.name} 正面遭遇。`],
    resolved: false,
  };
  return { state, p, foe };
}

function attackUntil(
  style: AttackStyle,
  predicate: (stage: Stage, latest: string, message: string) => boolean,
): { stage: Stage; latest: string; message: string } {
  for (let i = 0; i < 120; i += 1) {
    const stage = stageEncounter(`PHASE4E2-ATTACK-${style}-${i}`);
    stage.foe.hp = style === 'normal' ? 1 : stage.foe.maxHp;
    stage.p.hp = stage.p.maxHp;
    const result = handleAttack(
      stage.state,
      stage.p,
      stage.foe.id,
      new SeededRandom(`PHASE4E2-ATTACK-${style}-${i}`),
      style,
    );
    const latest = stage.state.encounter?.log.at(-1) ?? '';
    if (result.ok && predicate(stage, latest, result.message ?? '')) {
      return { stage, latest, message: result.message ?? '' };
    }
  }
  throw new Error(`未能构造 ${style} 攻击场景`);
}

describe('Phase 4E-2：战斗结局并入即时反馈行', () => {
  it('命中击杀：伤害与击杀在同一条最终战报行，且结算 / 事件流 / 掉落不变', () => {
    const { stage, latest, message } = attackUntil(
      'normal',
      (current, line) => !current.foe.alive && line.includes('已被击杀'),
    );

    expect(latest).toContain('造成');
    expect(latest).toContain('已被击杀');
    expect(latest).not.toContain('\n');
    expect(latest).toBe(message);
    expect(stage.state.encounter?.resolved).toBe(true);
    expect(stage.state.events.filter((event) => event.type === 'ATTACK_HIT')).toHaveLength(1);
    const deathEvents = stage.state.events.filter((event) => event.type === 'CHARACTER_DIED');
    expect(deathEvents).toHaveLength(1);
    expect(stage.state.zones[stage.p.currentZoneId]?.groundItems.length).toBe(
      deathEvents[0]?.metadata.dropCount,
    );
  });

  it('未命中：即时反馈明确写出攻击落空，并保留重击露出破绽文案', () => {
    const { latest } = attackUntil(
      'heavy',
      (current, line) => current.foe.alive && line.includes('重击落空'),
    );

    expect(latest).toContain('攻击');
    expect(latest).toContain('重击落空');
    expect(latest).toContain('露出破绽');
    expect(latest).not.toContain('\n');
  });

  it('玩家被反击击杀：最终即时反馈行同时点明被击杀', () => {
    for (let i = 0; i < 120; i += 1) {
      const stage = stageEncounter(`PHASE4E2-PLAYER-DEAD-${i}`);
      stage.p.hp = 1;
      stage.foe.hp = stage.foe.maxHp;
      stage.foe.stamina = stage.foe.maxStamina;
      const result = handleAttack(
        stage.state,
        stage.p,
        stage.foe.id,
        new SeededRandom(`PHASE4E2-PLAYER-DEAD-${i}`),
        'normal',
      );
      const latest = stage.state.encounter?.log.at(-1) ?? '';
      if (result.ok && !stage.p.alive) {
        expect(latest).toContain('你 已被击杀');
        expect(latest).toContain('造成');
        expect(latest).not.toContain('\n');
        expect(latest).toBe(result.message);
        return;
      }
    }
    throw new Error('未能构造玩家被反击击杀场景');
  });

  it('你逃走：两类 4D-1 脱离文案合并到同一条最终反馈行', () => {
    const stationary = stageEncounter('PHASE4E2-FLEE-STATIONARY', true);
    const stationaryResult = handleFlee(
      stationary.state,
      stationary.p,
      new SeededRandom('PHASE4E2-FLEE-STATIONARY'),
    );
    const stationaryLatest = stationary.state.encounter?.log.at(-1) ?? '';
    expect(stationaryResult.ok).toBe(true);
    expect(stationaryLatest).toContain('原地脱离');
    expect(stationaryLatest).toContain('已脱离接触');
    expect(stationaryLatest).toContain('仍在本区域，可能再次交火');
    expect(stationaryLatest).not.toContain('\n');
    expect(stationaryLatest).toBe(stationaryResult.message);

    for (let i = 0; i < 120; i += 1) {
      const stage = stageEncounter(`PHASE4E2-FLEE-TRANSFER-${i}`);
      const from = stage.p.currentZoneId;
      const result = handleFlee(
        stage.state,
        stage.p,
        new SeededRandom(`PHASE4E2-FLEE-TRANSFER-${i}`),
      );
      const latest = stage.state.encounter?.log.at(-1) ?? '';
      if (result.ok && stage.p.currentZoneId !== from) {
        expect(latest).toContain('已经离开该区域');
        expect(latest).toContain('脱离接触');
        expect(latest).toContain('当前位于');
        expect(latest).not.toContain('仍在本区域');
        expect(latest).not.toContain('\n');
        return;
      }
    }
    throw new Error('未能构造转移脱离场景');
  });

  it('即时反馈取日志末项时仍是本回合最终结局，而非被死亡行盖住', () => {
    const { stage, latest } = attackUntil(
      'normal',
      (current, line) => !current.foe.alive && line.includes('已被击杀'),
    );
    const deathIndex = stage.state.encounter!.log.findIndex((line) => line.includes(' 被 ') && line.includes('击杀'));
    expect(deathIndex).toBeGreaterThanOrEqual(0);
    expect(stage.state.encounter!.log.at(-1)).toBe(latest);
    expect(deathIndex).toBeLessThan(stage.state.encounter!.log.length - 1);
    expect(getPlayer(stage.state).alive).toBe(true);
  });
});
