/**
 * 对局阶段与终局收束（第二阶段核心改动）。
 *
 * 第一阶段没有任何"必然结束"的保证：禁区始终保留 1 个安全区，
 * 只要双方都苟着，对局可以无限拖下去。
 *
 * 第二阶段引入三阶段与强制收束：
 * - `opening` 开局：自由搜集期；
 * - `midgame` 中局：禁区开始收缩，物资转紧；
 * - `finale`  终局：全场进入**衰竭**，每个时间单位对所有存活者造成递增的环境伤害，
 *              且伤害随终局时长持续上涨，直到分出胜负；
 * - `hardTimeLimit`：到达 180 个时间单位无论如何强制结算，避免死循环。
 *
 * 终局触发条件（满足任一即可）：
 * 1. 时间到达 `finaleForcedTime`；
 * 2. 存活人数 ≤ `finaleAliveThreshold`；
 * 3. 全场剩余物资比例 ≤ `finaleLootRatioThreshold`（没东西可搜了，硬拖没有意义）。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { pushEvent } from './events';
import { aliveCharacters } from './gameState';
import { applyDamage } from './vitals';
import { globalLootRatio } from './zoneLoot';
import { declareDraw } from './victory';
import type { GamePhase, GameState } from './types';

export const PHASE_LABEL: Record<GamePhase, string> = {
  opening: '开局',
  midgame: '中局',
  finale: '终局',
};

/** 终局触发原因，写进事件 metadata 供模拟工具统计 */
export type FinaleTrigger = 'time' | 'survivors' | 'loot';

/** 判断当前是否应该进入终局，返回触发原因；不该进入则返回 null */
export function finaleTrigger(state: GameState): FinaleTrigger | null {
  if (state.time >= GAME_CONFIG.finaleForcedTime) return 'time';
  if (aliveCharacters(state).length <= GAME_CONFIG.finaleAliveThreshold) {
    return 'survivors';
  }
  if (globalLootRatio(state) <= GAME_CONFIG.finaleLootRatioThreshold) return 'loot';
  return null;
}

/**
 * 推进阶段。每个时间单位调用一次，只会向前推进，绝不回退。
 * 返回本次是否发生了阶段切换。
 */
export function advancePhase(state: GameState): boolean {
  if (state.status !== 'playing') return false;

  const before = state.phase;

  if (state.phase === 'opening' && state.time >= GAME_CONFIG.midgameStartTime) {
    state.phase = 'midgame';
  }

  if (state.phase !== 'finale') {
    const trigger = finaleTrigger(state);
    if (trigger) {
      state.phase = 'finale';
      state.finaleStartedAt = state.time;
      pushEvent(state, {
        type: 'PHASE_CHANGED',
        message: finaleMessage(trigger),
        metadata: { phase: 'finale', trigger, time: state.time },
      });
    }
  }

  if (before !== state.phase && state.phase !== 'finale') {
    pushEvent(state, {
      type: 'PHASE_CHANGED',
      message: '禁区开始收缩，中局到来。物资会越来越少，别再原地打转了。',
      metadata: { phase: state.phase, time: state.time },
    });
  }

  // 记录每个角色抵达过的最远阶段（结算展示用）
  for (const c of aliveCharacters(state)) {
    c.furthestPhase = state.phase;
  }

  return before !== state.phase;
}

function finaleMessage(trigger: FinaleTrigger): string {
  switch (trigger) {
    case 'time':
      return '终局广播：时限已到，全场进入衰竭。留在场上的每个人都会持续失血。';
    case 'survivors':
      return '终局广播：场上只剩最后几人，衰竭开始。';
    case 'loot':
      return '终局广播：全场物资告罄，衰竭开始。再拖下去只有一起死。';
    default:
      return '终局广播：衰竭开始。';
  }
}

/** 当前终局衰竭的每时间单位伤害 */
export function finaleDecayDamage(state: GameState): number {
  if (state.phase !== 'finale' || state.finaleStartedAt === null) return 0;
  const elapsed = Math.max(0, state.time - state.finaleStartedAt);
  return Math.min(
    GAME_CONFIG.finaleDecayMax,
    GAME_CONFIG.finaleDecayBase + elapsed * GAME_CONFIG.finaleDecayGrowth,
  );
}

/**
 * 结算终局衰竭伤害。
 * 对**所有存活角色**生效，无处可躲 —— 这正是收束的意义。
 */
export function applyFinaleDecay(state: GameState): void {
  const damage = finaleDecayDamage(state);
  if (damage <= 0) return;

  const victims = aliveCharacters(state);
  if (victims.length === 0) return;

  pushEvent(state, {
    type: 'FINALE_DECAY',
    message: `衰竭加剧：全场每人承受 ${damage} 点伤害。`,
    metadata: { damage, survivors: victims.length, time: state.time },
  });

  for (const c of victims) {
    if (!c.alive) continue;
    applyDamage(state, c, damage, null, '衰竭');
  }
}

/**
 * 时间硬上限。到达后立即强制结算，防止任何情况下的无限对局。
 *
 * Phase 2A（2A-D）硬性要求：**到了硬时限一律判为平局（draw）**，
 * 严禁再按"谁的剩余血量最高"推断胜负。那种做法等于伪造胜者——
 * 会让一个苟到最后的玩家凭血量吃掉整局。平局的语义是：
 * "时间耗尽，无人胜出"，胜负只能由淘汰（玩家死亡 / NPC 全灭）决定。
 */
export function enforceTimeLimit(state: GameState): boolean {
  if (state.status !== 'playing') return false;
  if (state.time < GAME_CONFIG.hardTimeLimit) return false;

  return declareDraw(state, 'time_limit');
}
