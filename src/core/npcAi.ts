import { getItem } from '../data/items';
import {
  attackActor,
  craftActor,
  fleeActor,
  guardActor,
  moveActor,
  resolveNpcOverflow,
  restActor,
  searchActor,
  useItemActor,
  useSkillActor,
} from './actorActions';
import { pushEvent } from './events';
import { noteOwnActionCompleted } from './exposed';
import { canAccessGroundItem } from './legalActions';
import type { SkillId } from './skills';
import {
  addItem,
  canAccept,
  equipItem,
  getEquippedArmor,
  getEquippedWeapon,
  stackValue,
} from './inventory';
import { decideNpcAction, planNpcGoal, type NpcDecision } from './npcDecide';
import type { SeededRandom } from './random';
import type { AttackStyle, Combatant, GameState, ItemStack } from './types';

/* 决策相关 API 由 npcDecide.ts 提供，这里统一再导出，保持对外契约不变 */
export { decideNpcAction } from './npcDecide';
export type { NpcActionKind, NpcDecision } from './npcDecide';

/* ------------------------------------------------------------------ */
/* 免费动作：装备与拾荒                                                 */
/* ------------------------------------------------------------------ */

/** NPC 自动换上更强的装备（不消耗时间） */
function autoEquip(state: GameState, npc: Combatant): void {
  for (const slot of ['weapon', 'armor'] as const) {
    const current = slot === 'weapon' ? getEquippedWeapon(npc) : getEquippedArmor(npc);
    const currentValue = current
      ? slot === 'weapon'
        ? getItem(current.itemId).attack ?? 0
        : getItem(current.itemId).defense ?? 0
      : 0;

    let best: { stack: ItemStack; value: number } | null = null;
    for (const s of npc.inventory) {
      const def = getItem(s.itemId);
      if (slot === 'weapon' && def.category !== 'weapon') continue;
      if (slot === 'armor' && def.category !== 'armor') continue;
      const v = slot === 'weapon' ? def.attack ?? 0 : def.defense ?? 0;
      if (v <= currentValue) continue;
      if (!best || v > best.value) best = { stack: s, value: v };
    }

    if (best) {
      const res = equipItem(npc, best.stack.uid);
      if (res.ok) {
        pushEvent(state, {
          type: 'ITEM_EQUIPPED',
          actorId: npc.id,
          zoneId: npc.currentZoneId,
          message: `${npc.name} 装备了 ${getItem(best.stack.itemId).name}。`,
          metadata: { itemId: best.stack.itemId, slot },
        });
      }
    }
  }
}

/**
 * NPC 拾取当前区域地面上的掉落物（不消耗时间）。
 * 背包已满时按价值评分决定是否替换最差的物品。
 */
function autoLoot(state: GameState, npc: Combatant): void {
  const zone = state.zones[npc.currentZoneId];
  if (!zone || zone.groundItems.length === 0) return;

  // 每个时间单位最多捡 2 件，避免一次性清空地面
  let picks = 2;
  for (let i = zone.groundItems.length - 1; i >= 0 && picks > 0; i--) {
    const stack = zone.groundItems[i]!;
    if (!canAccessGroundItem(npc, stack)) continue;
    if (canAccept(npc, stack)) {
      zone.groundItems.splice(i, 1);
      addItem(npc, stack);
      picks -= 1;
      pushEvent(state, {
        type: 'ITEM_PICKED',
        actorId: npc.id,
        zoneId: zone.id,
        message: `${npc.name} 捡走了地上的 ${getItem(stack.itemId).name}。`,
        metadata: { itemId: stack.itemId },
      });
      continue;
    }

    // 背包已满：与背包中价值最低的物品比较
    const worst = npc.inventory.reduce<ItemStack | null>((min, cur) => {
      if (!min) return cur;
      return stackValue(cur) < stackValue(min) ? cur : min;
    }, null);
    if (worst && stackValue(stack) > stackValue(worst) * 1.4) {
      const idx = npc.inventory.findIndex((s) => s.uid === worst.uid);
      if (idx >= 0) {
        npc.inventory.splice(idx, 1);
        zone.groundItems.push(worst);
      }
      zone.groundItems.splice(i, 1);
      addItem(npc, stack);
      picks -= 1;
      pushEvent(state, {
        type: 'ITEM_PICKED',
        actorId: npc.id,
        zoneId: zone.id,
        message: `${npc.name} 丢下 ${getItem(worst.itemId).name}，换走了 ${getItem(stack.itemId).name}。`,
        metadata: { itemId: stack.itemId, droppedItemId: worst.itemId },
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* 执行                                                                */
/* ------------------------------------------------------------------ */

/** 执行一个 NPC 的一次行动 */
export function runNpcTurn(
  state: GameState,
  npc: Combatant,
  rng: SeededRandom,
): NpcDecision {
  if (!npc.alive || state.status !== 'playing') {
    return { kind: 'idle', reason: '无法行动' };
  }

  // 出手前先解除上一回合的防御姿态（防御只挡一次攻击）
  npc.guarding = false;

  // 免费动作
  autoEquip(state, npc);
  autoLoot(state, npc);

  // 第二阶段：每回合按 TTL 维护 / 重规划 NPC 的制作目标
  // Phase 2A-1：随机型人格在规划时使用种子随机数（与对局同一 RNG 流隔离在调用方）
  planNpcGoal(state, npc, rng);

  // Scout 的 SEARCH 先手只覆盖敌方紧接着的这一次 NPC 行动机会。
  // 在决策前捕获目标，行动结束后统一消费；这样 attack / guard / heal /
  // use_skill / flee / rest / craft / search / move 都不会把标记拖成长效状态。
  const reconResponseEncounter =
    state.encounter?.reconInitiative === true && state.encounter.enemyId === npc.id;

  const decision = decideNpcAction(state, npc, rng);
  npc.lastAction = decision.kind;
  npc.lastActionReason = decision.reason;

  // 决策被规则层驳回（体力不够、目标跑了、区域不相邻……）时的兜底。
  // NPC 与玩家共享「永远存在一个免费且推进时间的出口」这条不变量：
  // 玩家是 REST / FLEE，NPC 这里退化成 REST，绝不空转一个时间单位。
  let rejected: string | null = null;
  const fallbackToRest = (reason: string): void => {
    rejected = reason;
    restActor(state, npc);
    npc.lastAction = 'rest';
    npc.lastActionReason = `${decision.reason}（${reason}，改为休整）`;
  };

  switch (decision.kind) {
    case 'evacuate':
    case 'move': {
      const target = decision.zoneId;
      if (!target) break;
      // 统一行动服务：相邻性 + 存在性 + 体力闸门，与玩家完全同一套
      const res = moveActor(state, npc, target);
      if (!res.ok) fallbackToRest(res.message);
      break;
    }

    case 'heal': {
      if (decision.uid) useItemActor(state, npc, decision.uid);
      break;
    }

    case 'rest': {
      restActor(state, npc);
      break;
    }

    case 'craft': {
      if (decision.recipeId) craftActor(state, npc, decision.recipeId);
      autoEquip(state, npc);
      break;
    }

    case 'search': {
      const res = searchActor(state, npc, rng);
      if (!res.ok) {
        fallbackToRest(res.message);
        break;
      }
      const outcome = res.outcome;
      if (outcome?.kind === 'item' && outcome.pending) {
        // 背包已满：NPC 不能弹窗，按价值自动取舍（物品必落地，不蒸发）
        resolveNpcOverflow(state, npc, outcome.stack);
      }
      if (outcome?.kind === 'enemy') {
        // ⚠️ Phase 2A 修正：这里原本立即调用 `resolveNpcEngagement`，
        // 让 NPC 在「搜索」这一个行动里白赚一次攻击。玩家搜索撞见敌人时
        // 只会进入遭遇状态、必须再花一个行动才能出手，规则并不对等。
        //
        // 现在统一为：**遭遇 ≠ 开打**。撞见只登记为"已知敌人"，
        // 想动手就得在下一个行动里正式选择攻击——玩家与 NPC 一致。
        const enemy = state.characters[outcome.enemyId];
        if (enemy && enemy.alive && !npc.knownEnemies.includes(enemy.id)) {
          npc.knownEnemies.push(enemy.id);
        }
      }
      autoEquip(state, npc);
      break;
    }

    case 'attack': {
      const target = decision.targetId ? state.characters[decision.targetId] : null;
      // Phase 3A-1：警觉先手 —— 敌方在「遭遇建立瞬间」的首次立即攻击被抑制
      // （只抑制这一次；玩家的正常攻击 / 反击完全不受影响）。
      const enc = state.encounter;
      if (
        reconResponseEncounter &&
        enc &&
        enc.reconInitiative &&
        enc.enemyId === npc.id &&
        target?.isPlayer &&
        target.alive
      ) {
        enc.log.push(`${npc.name}因你的警觉先手谨慎观望，没有立即出手。`);
        guardActor(state, npc);
        npc.lastAction = 'guard';
        npc.lastActionReason = `${decision.reason}（警觉先手，转为防御观望）`;
        break;
      }
      if (target && target.alive) {
        const res = resolveNpcEngagement(
          state,
          npc,
          target,
          rng,
          decision.attackStyle ?? 'normal',
        );
        // 零体力打不出攻击：与玩家一样，必须先休整
        if (!res.ok && res.rejection === 'no_stamina') fallbackToRest(res.message);
      }
      break;
    }

    case 'guard': {
      guardActor(state, npc);
      break;
    }

    case 'use_skill': {
      if (decision.skillId) useSkillActor(state, npc, decision.skillId as SkillId, rng);
      break;
    }

    case 'flee_combat': {
      const enemy = decision.targetId ? state.characters[decision.targetId] : null;
      if (enemy) {
        // 脱离是免费行动，NPC 同样永远付得起。
        // ⚠️ Phase 2A 修正：这里原本传 `allowPursuit: false`，
        // 等于"NPC 逃跑永不被追击、玩家逃跑必被追击"。追击是逃跑失败的代价，
        // 必须对所有角色一视同仁，否则玩家白白多挨一轮伤害。
        const res = fleeActor(state, npc, enemy, rng, { allowPursuit: true });
        // 玩家追击成功时，把结果写进遭遇日志，让玩家看得见自己的收益
        if (res.ok && res.pursued && enemy.isPlayer && state.encounter) {
          state.encounter.log.push(res.message);
          state.encounter.resolved = !npc.alive;
        }
      }
      break;
    }

    case 'idle':
    default:
      break;
  }

  if (rejected) {
    pushEvent(state, {
      type: 'NPC_ACTION',
      actorId: npc.id,
      zoneId: npc.currentZoneId,
      message: `${npc.name} 的「${decision.kind}」被规则驳回：${rejected}`,
      metadata: { kind: decision.kind, rejected: true, reason: rejected },
    });
  }

  pushEvent(state, {
    type: 'NPC_ACTION',
    actorId: npc.id,
    zoneId: npc.currentZoneId,
    message: `${npc.name}（${npc.lastAction}）：${npc.lastActionReason}`,
    metadata: { kind: npc.lastAction, reason: npc.lastActionReason },
  });

  // Phase 3A：NPC 侧的「有效行动完成」收口点。EXPOSED 条件B（一直没挨打，
  // 就靠自己下一次行动调整过来）在这里结算，与玩家侧 `executeCommand` 的
  // finish 共用同一个函数，保证规则只有一份实现。idle 不算有效行动。
  if (npc.lastAction !== 'idle') noteOwnActionCompleted(state, npc);

  // 必须在整次 NPC 行动机会结束后消费，而不是只在 attack 分支清除。
  if (reconResponseEncounter && state.encounter?.enemyId === npc.id) {
    state.encounter.reconInitiative = false;
  }

  return decision;
}

/**
 * NPC 发起的一次交手。
 *
 * 攻击本身完全走 `attackActor`（统一体力闸门 + 同区域校验 + 反击对称）。
 * 这里只额外处理"目标是玩家"这一 **UI 概念**：把交手写进 `encounter`，
 * 让玩家界面进入遭遇状态。
 *
 * ⚠️ Phase 2A 修正：`allowCounter` 不再区分目标是不是玩家。
 * 旧实现传 `!target.isPlayer`，等于"玩家挨打永不还手"——玩家是全场唯一
 * 享受不到反击的角色，实测受伤 2 倍于 NPC、输出仅 0.27 倍，
 * 5 种策略胜率全部 ≤1%。反击是被动结算，不占玩家的行动回合，
 * 因此开启它不会削弱"玩家自己决定下一步"的设计。
 */
function resolveNpcEngagement(
  state: GameState,
  npc: Combatant,
  target: Combatant,
  rng: SeededRandom,
  style: AttackStyle = 'normal',
): ReturnType<typeof attackActor> {
  const res = attackActor(state, npc, target, rng, { allowCounter: true, style });
  if (!res.ok) return res;

  if (target.isPlayer) {
    // 让玩家界面进入遭遇状态，玩家下一步自行决定
    if (!state.encounter || state.encounter.enemyId !== npc.id) {
      state.encounter = {
        enemyId: npc.id,
        zoneId: target.currentZoneId,
        startedAtTime: state.time,
        log: [],
        resolved: false,
      };
    }
    // res.message 已经把反击文本拼在后面，玩家能看到自己是怎么还手的
    state.encounter.log.push(res.message);
    state.encounter.resolved = !npc.alive || !target.alive;
  }
  return res;
}
