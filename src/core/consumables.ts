import { GAME_CONFIG } from '../data/gameConfig';
import { getItem } from '../data/items';
import { pushEvent } from './events';
import { consumeOne, findStack } from './inventory';
import { consumableHealMultiplier } from './statusIds';
import { worldModifiersAt } from './worldEvents';
import type { Combatant, GameState, ItemStack } from './types';

/**
 * 治疗量总倍率 = 医学生被动 × 紧急处置状态 × 世界事件修正。
 *
 * Phase 3A：医学生的技能不再是「按一下回一管血」，而是**放大手里每一件治疗品**。
 * 三者相乘而非取大值 —— 被动是天赋、状态是主动投入、世界事件是环境压力，
 * 叠起来才让「囤药 + 挑时机集中回复」成为一条真正值得规划的资源路线。
 *
 * @param state 传入后会计入「医疗管制」世界事件（治疗品效果 ×0.75）。
 *              省略时只算角色自身倍率，仅供不关心环境的单元测试使用。
 */
export function healMultiplierOf(actor: Combatant, state?: GameState): number {
  const passive = actor.passiveId === 'field_medic' ? GAME_CONFIG.medicHealMultiplier : 1;
  const world = state
    ? worldModifiersAt(state, actor.currentZoneId).healMultiplier
    : 1;
  return passive * consumableHealMultiplier(actor) * world;
}

export interface UseItemResult {
  ok: boolean;
  message: string;
  hpRestored: number;
  staminaRestored: number;
}

/** 使用一个消耗品 */
export function useConsumable(
  state: GameState,
  actor: Combatant,
  uid: string,
): UseItemResult {
  const empty = { hpRestored: 0, staminaRestored: 0 };
  if (state.status !== 'playing') {
    return { ok: false, message: '对局已经结束。', ...empty };
  }
  if (!actor.alive) {
    return { ok: false, message: '已经死亡的角色无法使用物品。', ...empty };
  }
  const stack = findStack(actor, uid);
  if (!stack) {
    return { ok: false, message: '背包里没有这件物品。', ...empty };
  }
  const def = getItem(stack.itemId);
  if (def.category !== 'consumable') {
    return { ok: false, message: `${def.name} 不能直接使用。`, ...empty };
  }

  const mult = healMultiplierOf(actor, state);
  const hpGain = Math.round((def.healHp ?? 0) * mult);
  const stGain = Math.round((def.healStamina ?? 0) * mult);

  const hpBefore = actor.hp;
  const stBefore = actor.stamina;
  actor.hp = Math.min(actor.maxHp, actor.hp + hpGain);
  actor.stamina = Math.min(actor.maxStamina, actor.stamina + stGain);

  consumeOne(actor, uid);
  actor.stats.itemsUsed += 1;
  state.stats.itemsUsed += 1;

  const hpRestored = actor.hp - hpBefore;
  const staminaRestored = actor.stamina - stBefore;

  const parts: string[] = [];
  if (hpRestored > 0) parts.push(`生命 +${hpRestored}`);
  if (staminaRestored > 0) parts.push(`体力 +${staminaRestored}`);
  const detail = parts.length > 0 ? parts.join('，') : '没有明显效果';

  pushEvent(state, {
    type: 'ITEM_USED',
    actorId: actor.id,
    zoneId: actor.currentZoneId,
    message: `${actor.name} 使用了 ${def.name}（${detail}）。`,
    metadata: { itemId: def.id, hpRestored, staminaRestored },
  });

  return {
    ok: true,
    message: `使用 ${def.name}：${detail}`,
    hpRestored,
    staminaRestored,
  };
}

/** 找出背包里最合适的治疗品（不浪费溢出治疗量） */
export function findBestHealItem(actor: Combatant): ItemStack | null {
  const missing = actor.maxHp - actor.hp;
  if (missing <= 0) return null;
  const candidates = actor.inventory.filter((s) => {
    const def = getItem(s.itemId);
    return def.category === 'consumable' && (def.healHp ?? 0) > 0;
  });
  if (candidates.length === 0) return null;

  // 优先选择「刚好够用」的：治疗量不超过缺失量的最大者；都超了就选最小的
  const notWasteful = candidates.filter(
    (s) => (getItem(s.itemId).healHp ?? 0) <= missing,
  );
  const pool = notWasteful.length > 0 ? notWasteful : candidates;
  return pool.reduce((best, cur) => {
    const a = getItem(best.itemId).healHp ?? 0;
    const b = getItem(cur.itemId).healHp ?? 0;
    if (notWasteful.length > 0) return b > a ? cur : best;
    return b < a ? cur : best;
  });
}

/** 找出背包里恢复体力最多的消耗品 */
export function findBestStaminaItem(actor: Combatant): ItemStack | null {
  const candidates = actor.inventory.filter((s) => {
    const def = getItem(s.itemId);
    return def.category === 'consumable' && (def.healStamina ?? 0) > 0;
  });
  if (candidates.length === 0) return null;
  return candidates.reduce((best, cur) =>
    (getItem(cur.itemId).healStamina ?? 0) > (getItem(best.itemId).healStamina ?? 0)
      ? cur
      : best,
  );
}

/** 休息：恢复体力，不恢复生命 */
export function performRest(state: GameState, actor: Combatant): number {
  const before = actor.stamina;
  actor.stamina = Math.min(
    actor.maxStamina,
    actor.stamina + GAME_CONFIG.restStaminaGain,
  );
  const gained = actor.stamina - before;
  pushEvent(state, {
    type: 'REST',
    actorId: actor.id,
    zoneId: actor.currentZoneId,
    message: `${actor.name} 原地休整，体力 +${gained}。`,
    metadata: { gained },
  });
  return gained;
}
