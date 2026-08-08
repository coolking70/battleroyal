/**
 * 统一行动服务（Phase 2A Step 5）。
 *
 * ## 为什么必须存在
 *
 * 第二阶段验收暴露的第二个严重问题是**玩家与 NPC 走两条执行路径**：
 *
 * | 动作 | 玩家路径 | NPC 路径（旧） |
 * | --- | --- | --- |
 * | 移动 | `handleMove` → `validateMove` + `canPayActionCost` | `npc.currentZoneId = target; npc.stamina = Math.max(0, ...)` |
 * | 攻击 | `handleAttack` → `canAttack` 体力闸门 | `resolveAttack` 直接结算，**不过闸门** |
 * | 逃跑 | `handleFlee` → 成本层 | `attemptFlee` 直接调用 |
 *
 * 后果非常具体：
 * - NPC 可以在体力为 0 时继续移动（`Math.max(0, ...)` 把负数吞掉了）；
 * - NPC 可以零体力无限攻击，而玩家不能；
 * - NPC 可以移动到不相邻甚至不存在的区域而不被发现；
 * - 于是"平衡报告"里的胜率完全不可信——两边根本不是一个游戏。
 *
 * 本模块把两条路径合并成一条。**所有角色**（玩家与 NPC）的行动都必须
 * 经过这里，规则只写一遍：
 *
 *   1. 对局必须处于 `playing`；
 *   2. 行动者必须存活；
 *   3. 体力必须经 `actionCosts` 闸门（`canPayActionCost` → `payActionCost`）；
 *   4. 移动必须经 `validateMove`（存在 + 相邻）；
 *   5. 攻击必须同区域、目标存活、且付得起体力；
 *   6. 事件文案按 `actor.isPlayer` 区分第二人称 / 第三人称，其余完全一致。
 *
 * `npcAi.ts` 不再允许出现任何 `npc.currentZoneId = ...` /
 * `npc.stamina = ...` 形式的直接赋值，由 `tests/phase2a-acceptance.test.ts`
 * 的源码扫描断言强制。
 */

import { tryGetItem } from '../data/items';
import { getZoneDef } from '../data/zones';
import { canPayActionCost, payActionCost } from './actionCosts';
import { performRest, useConsumable } from './consumables';
import { performCraft } from './crafting';
import { validateMove } from './commands';
import { pushEvent } from './events';
import { refreshZoneOccupants } from './gameState';
import { addItem, stackValue } from './inventory';
import { performSearch, type SearchOutcome } from './search';
import { done, fail, guard, who, type ActorActionResult } from './actorActionBase';
import {
  attackActor,
  fleeActor,
  guardActor,
  useSkillActor,
} from './actorCombatActions';
import type { SkillId } from './skills';
import type { SeededRandom } from './random';
import type { AttackStyle, Combatant, GameState, ItemStack } from './types';

/* ------------------------------------------------------------------ */
/* 公共基座与战斗行动（Phase 3 Step 10 拆分，此处保留统一出口）           */
/* ------------------------------------------------------------------ */

export type { ActorActionResult } from './actorActionBase';
export {
  attackActor,
  fleeActor,
  guardActor,
  useSkillActor,
} from './actorCombatActions';
export type {
  AttackActorResult,
  FleeActorResult,
} from './actorCombatActions';

/* ------------------------------------------------------------------ */
/* 移动                                                                */
/* ------------------------------------------------------------------ */

/**
 * 移动到相邻区域。
 *
 * 与旧 NPC 路径的关键差异：
 * - 体力不足时**整个动作失败**，不再靠 `Math.max(0, ...)` 把欠费抹平；
 * - 目标区域必须存在且相邻，NPC 也不能瞬移。
 */
export function moveActor(
  state: GameState,
  actor: Combatant,
  zoneId: string,
): ActorActionResult {
  // 顺序很重要：先判"对局结束 / 已死亡 / 体力不足"，再判目标区域是否合法，
  // 这样拒绝原因才是最贴切的那一个（否则死人移动会被报成"区域非法"）。
  const blocked = guard(state, actor, 'MOVE');
  if (blocked) return blocked;

  const v = validateMove(state, actor, zoneId);
  if (!v.ok) return fail('illegal_zone', v.reason ?? '无法移动。');

  actor.currentZoneId = zoneId;
  const spent = payActionCost(actor, 'MOVE');
  actor.stats.moves += 1;
  state.stats.moves += 1;

  // 玩家离开原区域即脱离遭遇；NPC 的离开由 syncEncounter 统一收尾
  if (actor.isPlayer) state.encounter = null;
  refreshZoneOccupants(state);

  const zoneName = getZoneDef(zoneId).name;
  pushEvent(state, {
    type: 'CHARACTER_MOVED',
    actorId: actor.id,
    zoneId,
    message: `${who(actor)}前往${zoneName}。`,
    metadata: { zoneId },
  });
  return done(actor.isPlayer ? `已进入${zoneName}。` : `${actor.name} 前往${zoneName}。`, spent);
}

/* ------------------------------------------------------------------ */
/* 搜索                                                                */
/* ------------------------------------------------------------------ */

export interface SearchActorResult extends ActorActionResult {
  outcome: SearchOutcome | null;
}

/**
 * 搜索当前区域。
 * 体力闸门在 `performSearch` 之前，失败时不产生任何副作用。
 */
export function searchActor(
  state: GameState,
  actor: Combatant,
  rng: SeededRandom,
): SearchActorResult {
  const blocked = guard(state, actor, 'SEARCH');
  if (blocked) return { ...blocked, outcome: null };

  // `performSearch` 内部通过 `payActionCost` 扣费，这里先记下应扣数额用于回报
  const spent = canPayActionCost(actor, 'SEARCH').cost;
  const outcome = performSearch(state, actor, rng);
  if (outcome.kind === 'enemy') {
    const enemy = state.characters[outcome.enemyId];
    return {
      ...done(`${who(actor)}遭遇了 ${enemy?.name ?? '陌生人'}。`, spent),
      outcome,
    };
  }
  if (outcome.kind === 'item') {
    return { ...done(`${who(actor)}找到了 ${outcome.itemName}。`, spent), outcome };
  }
  return { ...done('一无所获。', spent), outcome };
}

/**
 * NPC 专用的"背包满了怎么办"策略。
 *
 * 玩家会弹窗让人自己选（`pendingPickup`），NPC 不能卡住流程，
 * 所以按价值自动取舍：新物品明显更值钱才换，否则原样留在地上。
 *
 * **物品守恒**：被换下的物品一定落到地面，绝不凭空消失（Step 9 会审计）。
 */
export function resolveNpcOverflow(
  state: GameState,
  npc: Combatant,
  stack: ItemStack,
): boolean {
  const worst = npc.inventory.reduce<ItemStack | null>((min, cur) => {
    if (!min) return cur;
    return stackValue(cur) < stackValue(min) ? cur : min;
  }, null);
  const zone = state.zones[npc.currentZoneId];
  if (!worst || stackValue(stack) <= stackValue(worst)) {
    // 不换：新物品退回地面，不允许蒸发
    if (zone) zone.groundItems.push(stack);
    return false;
  }
  const idx = npc.inventory.findIndex((s) => s.uid === worst.uid);
  if (idx >= 0) npc.inventory.splice(idx, 1);
  if (zone) zone.groundItems.push(worst);
  addItem(npc, stack);
  pushEvent(state, {
    type: 'ITEM_DROPPED',
    actorId: npc.id,
    zoneId: npc.currentZoneId,
    message: `${npc.name} 丢下 ${tryGetItem(worst.itemId)?.name ?? '未知物品'}，收起了 ${
      tryGetItem(stack.itemId)?.name ?? '未知物品'
    }。`,
    metadata: { droppedItemId: worst.itemId, itemId: stack.itemId },
  });
  return true;
}


/* ------------------------------------------------------------------ */
/* 休息 / 合成 / 用药                                                   */
/* ------------------------------------------------------------------ */

export interface RestActorResult extends ActorActionResult {
  staminaGained: number;
}

/** 休息：不消耗体力的免费行动，但会推进时间且可能被偷袭（偷袭由调用方处理） */
export function restActor(state: GameState, actor: Combatant): RestActorResult {
  const blocked = guard(state, actor, null);
  if (blocked) return { ...blocked, staminaGained: 0 };
  const gained = performRest(state, actor);
  return {
    ...done(`${who(actor)}休整完毕，体力 +${gained}。`, 0),
    staminaGained: gained,
  };
}

export interface CraftActorResult extends ActorActionResult {
  outputItemId: string | null;
}

/** 合成：体力闸门由 `performCraft` 内部的成本层负责，这里补齐存活/对局校验 */
export function craftActor(
  state: GameState,
  actor: Combatant,
  recipeId: string,
): CraftActorResult {
  const blocked = guard(state, actor, 'CRAFT');
  if (blocked) return { ...blocked, outputItemId: null };
  const spent = canPayActionCost(actor, 'CRAFT').cost;
  const res = performCraft(state, actor, recipeId);
  if (!res.ok) {
    return { ...fail('not_found', res.message), outputItemId: null };
  }
  return {
    ...done(res.message, spent),
    outputItemId: res.outputItemId ?? null,
  };
}

/** 使用消耗品：不消耗体力，但会推进时间 */
export function useItemActor(
  state: GameState,
  actor: Combatant,
  uid: string,
): ActorActionResult {
  const blocked = guard(state, actor, null);
  if (blocked) return blocked;
  const res = useConsumable(state, actor, uid);
  return res.ok ? done(res.message, 0) : fail('not_found', res.message);
}

/* ------------------------------------------------------------------ */
/* 统一入口                                                            */
/* ------------------------------------------------------------------ */

export type ActorAction =
  | { type: 'MOVE'; zoneId: string }
  | { type: 'SEARCH' }
  | { type: 'REST' }
  | { type: 'CRAFT'; recipeId: string }
  | { type: 'USE_ITEM'; uid: string }
  | { type: 'ATTACK'; targetId: string; style: AttackStyle }
  | { type: 'GUARD' }
  | { type: 'USE_SKILL'; skillId: SkillId }
  | { type: 'FLEE'; enemyId: string };

/**
 * 单一入口：任何角色（玩家 / NPC）的一次行动都可以用同一个签名表达。
 *
 * 这让"NPC 是否遵守玩家规则"变成一个可以被机械验证的问题——
 * 只要两边都从这里进，就不可能再分叉。
 */
export function executeActorCommand(
  state: GameState,
  actor: Combatant,
  action: ActorAction,
  rng: SeededRandom,
): ActorActionResult {
  switch (action.type) {
    case 'MOVE':
      return moveActor(state, actor, action.zoneId);
    case 'SEARCH':
      return searchActor(state, actor, rng);
    case 'REST':
      return restActor(state, actor);
    case 'CRAFT':
      return craftActor(state, actor, action.recipeId);
    case 'USE_ITEM':
      return useItemActor(state, actor, action.uid);
    case 'ATTACK':
      return attackActor(state, actor, state.characters[action.targetId], rng, {
        style: action.style,
      });
    case 'GUARD':
      return guardActor(state, actor);
    case 'USE_SKILL':
      return useSkillActor(state, actor, action.skillId, rng);
    case 'FLEE':
      return fleeActor(state, actor, state.characters[action.enemyId], rng);
    default:
      return fail('not_found', '未知行动。');
  }
}

/** 便于外部（调试面板 / 模拟器）展示物品名，脏 id 退化成占位文案而不是抛异常 */
export function safeItemName(itemId: string): string {
  return tryGetItem(itemId)?.name ?? '未知物品';
}
