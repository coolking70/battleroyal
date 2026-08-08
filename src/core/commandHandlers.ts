import { tryGetItem } from '../data/items';
import {
  attackActor,
  fleeActor,
  guardActor,
  moveActor,
  searchActor,
  useSkillActor,
} from './actorActions';
import type { SkillId } from './skills';
import { canAttack, resolveAttack } from './combat';
import { performRest } from './consumables';
import { pushEvent } from './events';
import { charactersInZone, enemiesInZone } from './gameState';
import { addItem, canAccept, removeStack } from './inventory';
import type { SeededRandom } from './random';
import type { AttackStyle, Combatant, GameState } from './types';

/* ------------------------------------------------------------------ */
/* 玩家命令处理                                                        */
/* ------------------------------------------------------------------ */

export interface HandlerOutcome {
  ok: boolean;
  message: string | null;
  /** 本次命令是否应推进时间（默认跟随 advancesTime） */
  skipTime?: boolean;
}

/** 安全取物品名：未知 id 不抛异常，退化成占位文案 */
function itemName(itemId: string): string {
  return tryGetItem(itemId)?.name ?? '未知物品';
}

/**
 * 玩家移动。
 *
 * Phase 2A 起只是 `moveActor` 的薄封装——移动规则（存在性 / 相邻性 /
 * 体力闸门 / 事件文案）只在 `actorActions.ts` 里写一份，
 * 玩家与 NPC 共用，杜绝两条路径漂移。
 */
export function handleMove(
  state: GameState,
  player: Combatant,
  zoneId: string,
): HandlerOutcome {
  const res = moveActor(state, player, zoneId);
  return { ok: res.ok, message: res.message };
}

export function handleSearch(
  state: GameState,
  player: Combatant,
  rng: SeededRandom,
): HandlerOutcome {
  const res = searchActor(state, player, rng);
  if (!res.ok) return { ok: false, message: res.message };
  const outcome = res.outcome;
  if (!outcome) return { ok: false, message: res.message };

  if (outcome.kind === 'enemy') {
    const enemy = state.characters[outcome.enemyId];
    state.encounter = {
      enemyId: outcome.enemyId,
      zoneId: player.currentZoneId,
      startedAtTime: state.time,
      log: [`你在搜索中遭遇了 ${enemy?.name ?? '陌生人'}。`],
      resolved: false,
      // Phase 3A-1：警觉侦察 → 本次遭遇建立阶段获得先手（抑制敌方首次立即反击）
      ...(outcome.reconInitiative ? { reconInitiative: true } : {}),
    };
    return { ok: true, message: `遭遇 ${enemy?.name ?? '敌人'}！` };
  }
  if (outcome.kind === 'item') {
    if (outcome.pending) {
      state.pendingPickup = {
        stack: outcome.stack,
        source: 'search',
        zoneId: player.currentZoneId,
      };
      return {
        ok: true,
        message: `发现 ${outcome.itemName}，但背包已满，请做出选择。`,
      };
    }
    return { ok: true, message: `找到了 ${outcome.itemName}。` };
  }
  return { ok: true, message: '一无所获。' };
}

export function handleRest(
  state: GameState,
  player: Combatant,
  rng: SeededRandom,
): HandlerOutcome {
  const gained = performRest(state, player);

  // 休息时如果同区域有敌人，有概率被直接偷袭一次
  const enemies = charactersInZone(state, player.currentZoneId).filter(
    (c) => c.id !== player.id,
  );
  if (enemies.length > 0 && rng.chance(0.45)) {
    const attacker = rng.pick(enemies);
    // 偷袭同样要过体力闸门：没体力的 NPC 不能白嫖一次攻击
    if (attacker && canAttack(attacker).ok) {
      if (!state.engagedWithPlayer.includes(attacker.id)) {
        state.engagedWithPlayer.push(attacker.id);
      }
      const res = resolveAttack(state, attacker, player, rng);
      state.encounter = {
        enemyId: attacker.id,
        zoneId: player.currentZoneId,
        startedAtTime: state.time,
        log: [`休息被打断：${res.message}`],
        resolved: false,
      };
      return { ok: true, message: `休息被 ${attacker.name} 打断！` };
    }
  }
  return { ok: true, message: `休整完毕，体力 +${gained}。` };
}

/**
 * 玩家攻击。
 *
 * 命中 / 伤害 / 反击 / 体力闸门全部由 `attackActor` 负责，
 * 与 NPC 攻击是同一段代码；这里只补充玩家专属的 `encounter` 视图维护。
 */
export function handleAttack(
  state: GameState,
  player: Combatant,
  targetId: string,
  rng: SeededRandom,
  style: AttackStyle = 'normal',
): HandlerOutcome {
  const target = state.characters[targetId];
  const res = attackActor(state, player, target, rng, { allowCounter: true, style });
  if (!res.ok) return { ok: false, message: res.message };
  if (!target) return { ok: false, message: '目标已经不在了。' };

  const lines = [res.message];
  if (!state.engagedWithPlayer.includes(target.id)) {
    state.engagedWithPlayer.push(target.id);
  }

  if (!state.encounter || state.encounter.enemyId !== target.id) {
    state.encounter = {
      enemyId: target.id,
      zoneId: player.currentZoneId,
      startedAtTime: state.time,
      log: [],
      resolved: false,
    };
  }
  state.encounter.log.push(...lines);
  state.encounter.resolved = !target.alive;

  return { ok: true, message: lines.join(' ') };
}

/**
 * 袭击附近目标（Phase 2A-1 信息隐藏 §十）。
 *
 * 未发生正式遭遇时，玩家**不能**逐个指定匿名对手出手（那会泄露同区域人数与
 * 目标存在性）。合法集合只给一个泛化的「袭击附近目标」；这里按种子随机数
 * 从同区域未识别目标中确定对象，随后与 `handleAttack` 一样走统一行动服务并
 * 建立正式遭遇——遭遇一旦建立，目标即被识别，后续攻击就回到精确指定。
 */
export function handleAttackNearby(
  state: GameState,
  player: Combatant,
  rng: SeededRandom,
  style: AttackStyle = 'normal',
): HandlerOutcome {
  const enemies = enemiesInZone(state, player);
  if (enemies.length === 0) {
    return { ok: false, message: '附近没有可袭击的目标。' };
  }
  const target = rng.pick(enemies);
  if (!target) {
    return { ok: false, message: '附近没有可袭击的目标。' };
  }

  const res = attackActor(state, player, target, rng, { allowCounter: true, style });
  if (!res.ok) return { ok: false, message: res.message };

  const lines = [`你对 ${target.name} 出手：${res.message}`];
  if (!state.engagedWithPlayer.includes(target.id)) {
    state.engagedWithPlayer.push(target.id);
  }
  if (!state.encounter || state.encounter.enemyId !== target.id) {
    state.encounter = {
      enemyId: target.id,
      zoneId: player.currentZoneId,
      startedAtTime: state.time,
      log: [],
      resolved: false,
    };
  }
  state.encounter.log.push(...lines);
  state.encounter.resolved = !target.alive;

  return { ok: true, message: lines.join(' ') };
}

/** 摆出防御姿态（Phase 3 Step 1） */
export function handleGuard(
  state: GameState,
  player: Combatant,
): HandlerOutcome {
  const res = guardActor(state, player);
  return { ok: res.ok, message: res.message };
}

/**
 * 使用角色技能（Phase 3 Step 3 已实现）。
 *
 * 技能有体力成本与冷却，均由 `useSkillActor` 统一校验；技能效果（治疗 /
 * 修理 / 增益状态）在 `skills.ts` 中结算。玩家与 NPC 走同一段逻辑。
 */
export function handleUseSkill(
  state: GameState,
  player: Combatant,
  skillId: string,
  rng: import('./random').SeededRandom,
): HandlerOutcome {
  const res = useSkillActor(state, player, skillId as SkillId, rng);
  return { ok: res.ok, message: res.message };
}

/**
 * 脱离战斗。
 *
 * Phase 2A 关键改动：**逃跑是免费行动**（体力成本 0）。
 *
 * 为什么必须免费：遭遇战中如果攻击与逃跑都要体力，
 * 一个体力耗尽的玩家就完全没有可执行且能推进时间的命令，对局真死锁。
 * 逃跑成本降到 0 后，遭遇战里永远存在至少一个出口。
 *
 * 免费不等于无代价，逃跑失败时三件事一定发生：
 * 1. 本次命令仍然**推进 1 个时间单位**（`advancesTime('FLEE') === true`）；
 * 2. 敌人只要付得起攻击体力就会**追击**；
 * 3. 追击伤害走正常结算，**可以直接把玩家打死**。
 *
 * 因此"反复白嫖逃跑"要用时间和生命买单，不存在零风险重试。
 */
export function handleFlee(
  state: GameState,
  player: Combatant,
  rng: SeededRandom,
): HandlerOutcome {
  // 脱离对象：优先当前遭遇的对手；没有正式遭遇时退回到同区域的第一个敌人。
  //
  // ⚠️ Phase 2A 修正的规则不对称：旧实现要求**必须先存在 `state.encounter`**，
  // 否则直接返回 ok:false。而 NPC 的 `flee_combat` 只要同区域有敌人就能脱离
  // （目标由 `decideNpcAction` 从 `enemiesInZone` 里挑）。
  // 也就是说玩家主动走进敌人所在区域、或对手还没挑起遭遇时，想撤都撤不掉，
  // 只能站在原地等着挨打。逐步打点显示这一条占了玩家"策略首选被驳回"的
  // 85% ~ 96%，是四条已修正的不对称之外最大的一条。
  const encounterEnemyId = state.encounter?.enemyId;
  const encounterEnemy = encounterEnemyId ? state.characters[encounterEnemyId] : null;
  const enemy =
    encounterEnemy &&
    encounterEnemy.alive &&
    encounterEnemy.currentZoneId === player.currentZoneId
      ? encounterEnemy
      : (enemiesInZone(state, player)[0] ?? null);
  if (!enemy) return { ok: false, message: '当前没有需要脱离的敌人。' };

  // 逃跑判定、追击与体力闸门都在 `fleeActor` 里，与 NPC 共用同一段代码
  const res = fleeActor(state, player, enemy, rng, { allowPursuit: true });
  if (!res.ok) return { ok: false, message: res.message };

  if (res.escaped) {
    state.encounter = null;
    return { ok: true, message: res.message };
  }
  if (res.pursued && !state.engagedWithPlayer.includes(enemy.id)) {
    state.engagedWithPlayer.push(enemy.id);
  }
  if (state.encounter) state.encounter.log.push(res.message);
  return { ok: true, message: res.message };
}

export function handlePickupGround(
  state: GameState,
  player: Combatant,
  uid: string,
): HandlerOutcome {
  const zone = state.zones[player.currentZoneId];
  if (!zone) return { ok: false, message: '区域数据异常。' };
  const idx = zone.groundItems.findIndex((s) => s.uid === uid);
  if (idx < 0) return { ok: false, message: '地上没有这件物品。' };
  const stack = zone.groundItems[idx]!;

  // 数据自愈：地面上出现了未知物品（存档被改坏 / 版本残留）时，
  // 直接把它清掉并返回失败，而不是让 getItem 抛异常炸穿命令层。
  const def = tryGetItem(stack.itemId);
  if (!def) {
    zone.groundItems.splice(idx, 1);
    return { ok: false, message: '这件物品的数据已失效，已从地面移除。' };
  }

  if (!canAccept(player, stack)) {
    state.pendingPickup = { stack, source: 'ground', zoneId: zone.id };
    zone.groundItems.splice(idx, 1);
    return { ok: true, message: '背包已满，请选择是否替换。' };
  }

  zone.groundItems.splice(idx, 1);
  addItem(player, stack);
  pushEvent(state, {
    type: 'ITEM_PICKED',
    actorId: player.id,
    zoneId: zone.id,
    message: `你捡起了 ${def.name}。`,
    metadata: { itemId: stack.itemId },
  });
  return { ok: true, message: `拾取 ${def.name}。` };
}

export function handleResolvePickup(
  state: GameState,
  player: Combatant,
  accept: boolean,
  dropUid?: string,
): HandlerOutcome {
  const pending = state.pendingPickup;
  if (!pending) return { ok: false, message: '没有待处理的拾取。' };
  const zone = state.zones[pending.zoneId];

  if (!accept) {
    state.pendingPickup = null;
    if (zone) zone.groundItems.push(pending.stack);
    pushEvent(state, {
      type: 'ITEM_DROPPED',
      actorId: player.id,
      zoneId: pending.zoneId,
      message: `你放弃了 ${itemName(pending.stack.itemId)}。`,
      metadata: { itemId: pending.stack.itemId },
    });
    return { ok: true, message: '已放弃该物品。' };
  }

  if (!dropUid) return { ok: false, message: '请选择要丢弃的物品。' };
  const dropped = removeStack(player, dropUid);
  if (!dropped) return { ok: false, message: '要丢弃的物品不存在。' };

  if (zone) zone.groundItems.push(dropped);
  addItem(player, pending.stack);
  state.pendingPickup = null;

  pushEvent(state, {
    type: 'ITEM_DROPPED',
    actorId: player.id,
    zoneId: pending.zoneId,
    message: `你丢下 ${itemName(dropped.itemId)}，换取了 ${itemName(pending.stack.itemId)}。`,
    metadata: { droppedItemId: dropped.itemId, itemId: pending.stack.itemId },
  });
  return { ok: true, message: '已完成替换。' };
}
