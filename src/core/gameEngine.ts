import { MATERIAL_IDS, getItem, tryGetItem } from '../data/items';
import { tryGetRecipe } from '../data/recipes';
import {
  advancesTime,
  commandLabel,
  isEncounterBlocking,
  isPickupBlocking,
} from './commands';
import { performCraft } from './crafting';
import { describeError, isExpectedError } from './errors';
import { pushEvent } from './events';
import { noteOwnActionCompleted } from './exposed';
import {
  aliveCharacters,
  cloneState,
  getPlayer,
  refreshZoneOccupants,
} from './gameState';
import { decayNoise, refreshPlayerSight } from './info';
import { advancePhase, applyFinaleDecay, enforceTimeLimit } from './phase';
import { applyHpChange } from './vitals';
import {
  addItem,
  canAccept,
  createStack,
  removeStack,
  unequip,
} from './inventory';
import { runNpcTurn } from './npcAi';
import { SeededRandom } from './random';
import { announceWarning, updateRestrictedZones } from './restrictedZones';
import { runWorldEvents } from './worldEvents';
import { applyWorldEventTickDamage } from './worldEventTick';
import { advanceActiveWildEncounter } from './wildCombat';
import {
  declareVictory,
  performObjectiveAction,
  syncActiveExtraction,
} from './victory';
import {
  handleAttack,
  handleAttackNearby,
  handleEquip,
  handleFlee,
  handleGuard,
  handleMove,
  handleRest,
  handleSearch,
  handleUseItem,
  handleUseSkill,
  type HandlerOutcome,
} from './commandHandlers';
import { handlePickupGround, handleResolvePickup } from './pickupHandlers';
import type { Command, CommandResult, Combatant, GameState } from './types';

/* ------------------------------------------------------------------ */
/* 时间推进                                                            */
/* ------------------------------------------------------------------ */

/**
 * 更新状态效果。
 *
 * 关键修复（PHASE2_BASELINE §6 P0-2）：持续伤害必须走 `applyHpChange`，
 * 由它统一触发死亡结算，否则会出现"血量为 0 但仍然活着"的脏状态。
 */
function updateStatusEffects(state: GameState): void {
  for (const c of aliveCharacters(state)) {
    if (c.statusEffects.length === 0) continue;
    for (const effect of c.statusEffects) {
      if (effect.hpPerTick !== 0 && c.alive) {
        applyHpChange(state, c, effect.hpPerTick, null, effect.label);
      }
      effect.remaining -= 1;
    }
    if (!c.alive) continue;
    c.statusEffects = c.statusEffects.filter((e) => e.remaining > 0);
    // 技能冷却按时间单位递减（Phase 3 Step 3）
    for (const key of Object.keys(c.skillCooldowns)) {
      const left = (c.skillCooldowns[key] ?? 0) - 1;
      if (left <= 0) delete c.skillCooldowns[key];
      else c.skillCooldowns[key] = left;
    }
  }
}

/** 胜负判定 */
export function checkGameEnd(state: GameState): void {
  if (state.status !== 'playing') return;
  syncActiveExtraction(state);
  const player = getPlayer(state);
  const alive = aliveCharacters(state);

  if (!player.alive) {
    state.status = 'lost';
    state.endedAtTime = state.time;
    state.endReason = 'player_died';
    // 对局结束：不允许残留未解决的遭遇（Phase 2A-1 存档不变量）
    state.encounter = null;
    pushEvent(state, {
      type: 'GAME_ENDED',
      actorId: player.id,
      message: `你在第 ${state.time} 个时间单位倒下了。`,
      metadata: { result: 'lost', reason: 'player_died', time: state.time },
    });
    return;
  }

  if (alive.length === 1 && alive[0]) {
    declareVictory(state, alive[0].id, 'last_survivor');
  }
}

/** 遭遇状态维护：敌人死亡 / 离开区域时结束遭遇 */
function syncEncounter(state: GameState): void {
  if (!state.encounter) return;
  const player = getPlayer(state);
  if (state.encounter.targetKind === 'wild') {
    const wild = state.wildEnemies[state.encounter.enemyId];
    if (!player.alive) {
      state.encounter = null;
      return;
    }
    if (!wild || wild.status !== 'alive' || wild.zoneId !== player.currentZoneId) {
      state.encounter.resolved = true;
    }
    return;
  }
  const enemy = state.characters[state.encounter.enemyId];
  if (!player.alive) {
    state.encounter = null;
    return;
  }
  if (!enemy || !enemy.alive) {
    state.encounter.resolved = true;
    return;
  }
  if (enemy.currentZoneId !== player.currentZoneId) {
    state.encounter.resolved = true;
  }
}

/**
 * 推进 1 个时间单位。
 *
 * 顺序（第二阶段）：
 *   时间 +1 → 阶段推进 → NPC 行动 → 状态效果 → 禁区更新 → 终局衰竭
 *   → 噪音衰减 → 区域名单刷新 → 玩家视野刷新 → 遭遇同步 → 胜负判定 → 时间硬上限
 *
 * 阶段推进放在 NPC 行动之前，是为了让 NPC 在本回合就能按新阶段决策；
 * 终局衰竭放在禁区之后，保证"禁区伤害 + 衰竭伤害"在同一时间单位内叠加生效。
 * （玩家行动在调用本函数之前已经完成。）
 */
export function advanceTime(state: GameState, rng: SeededRandom): void {
  if (state.status !== 'playing') return;

  state.time += 1;
  advancePhase(state);

  for (const id of state.turnOrder) {
    const c = state.characters[id];
    if (!c || c.isPlayer || !c.alive) continue;
    if (state.status !== 'playing') break;
    runNpcTurn(state, c, rng);
  }

  advanceActiveWildEncounter(state, rng);

  updateStatusEffects(state);
  updateRestrictedZones(state, rng);
  applyFinaleDecay(state);
  runWorldEvents(state, rng);
  // Phase 3A-1：需要实体伤害的世界事件（研究异常）在此统一结算，走 applyDamage
  applyWorldEventTickDamage(state);
  decayNoise(state);
  refreshZoneOccupants(state);
  refreshPlayerSight(state);
  syncEncounter(state);
  syncActiveExtraction(state);
  checkGameEnd(state);
  if (state.status === 'playing') enforceTimeLimit(state);

  // 交手记录只在一个时间单位内有效
  state.engagedWithPlayer = [];
}

/* ------------------------------------------------------------------ */
/* 调试命令                                                            */
/* ------------------------------------------------------------------ */

function handleDebug(
  state: GameState,
  player: Combatant,
  command: Command,
  rng: SeededRandom,
): HandlerOutcome {
  switch (command.type) {
    case 'DEBUG_ADVANCE_TIME':
      advanceTime(state, rng);
      return { ok: true, message: '已推进 1 个时间单位。', skipTime: true };

    case 'DEBUG_GIVE_MATERIAL': {
      const itemId = rng.pick(MATERIAL_IDS) ?? 'wood';
      const stack = createStack(state, itemId, 1);
      if (!canAccept(player, stack)) {
        return { ok: false, message: '背包已满，无法给予材料。' };
      }
      addItem(player, stack);
      return { ok: true, message: `已给予 ${getItem(itemId).name}。`, skipTime: true };
    }

    case 'DEBUG_HEAL_PLAYER':
      player.hp = player.maxHp;
      player.stamina = player.maxStamina;
      return { ok: true, message: '生命与体力已回满。', skipTime: true };

    case 'DEBUG_TRIGGER_ZONE': {
      const announced = announceWarning(state, rng);
      return {
        ok: announced,
        message: announced ? '已立即公布下一禁区。' : '没有可以封锁的区域了。',
        skipTime: true,
      };
    }

    case 'DEBUG_WEAKEN_NPC': {
      const npc = state.characters[command.npcId];
      if (!npc || !npc.alive) return { ok: false, message: 'NPC 不存在或已死亡。' };
      npc.hp = 1;
      return { ok: true, message: `${npc.name} 生命降至 1。`, skipTime: true };
    }

    default:
      return { ok: false, message: '未知调试命令。' };
  }
}

/* ------------------------------------------------------------------ */
/* 入口                                                                */
/* ------------------------------------------------------------------ */

/**
 * 执行一条玩家命令。
 *
 * 本函数对外表现为纯函数：接收旧状态返回新状态，绝不修改传入的对象。
 * 内部先做一次深拷贝，再在副本上完成全部结算。
 *
 * **错误边界**：无论内部发生什么（未知配方、脏存档、逻辑 bug），
 * 都不允许把异常抛到界面层。可预期的规则错误转成 `ok:false`；
 * 未预期的异常同样被兜住，并原样返回**未被修改的**旧状态，
 * 保证界面永远不会拿到一个半改坏的 state。
 */
export function executeCommand(state: GameState, command: Command): CommandResult {
  try {
    return executeCommandInner(state, command);
  } catch (err) {
    if (isExpectedError(err)) {
      return { state, ok: false, message: describeError(err) };
    }
    return {
      state,
      ok: false,
      message: `「${commandLabel(command)}」执行失败：${describeError(err)}（本次操作已回滚）`,
    };
  }
}

function executeCommandInner(state: GameState, command: Command): CommandResult {
  const draft = cloneState(state);
  const rng = SeededRandom.fromState(draft.rngState);

  // 入口先同步一次结局判定：任何情况下都不允许出现「玩家已死但对局仍在进行」的状态
  syncEncounter(draft);
  checkGameEnd(draft);

  const finish = (outcome: HandlerOutcome): CommandResult => {
    // Phase 3A：玩家侧「有效行动完成」收口点。
    // EXPOSED 的条件B（没挨打就靠自己下一次行动调整过来）在这里结算，
    // 与 NPC 侧 `runNpcTurn` 共用同一个函数，规则只有一份实现。
    // 放在 advanceTime **之前**：产生破绽的那次行动只消费掉「跳过一次」标记，
    // 破绽会完整覆盖紧随其后的这一轮 NPC 行动，然后在玩家下一次行动收尾时消失。
    if (outcome.ok && advancesTime(command)) {
      noteOwnActionCompleted(draft, getPlayer(draft));
    }
    if (outcome.ok && !outcome.skipTime && advancesTime(command)) {
      advanceTime(draft, rng);
    } else {
      syncActiveExtraction(draft);
      syncEncounter(draft);
      checkGameEnd(draft);
    }
    draft.rngState = rng.getState();
    return { state: draft, ok: outcome.ok, message: outcome.message };
  };

  const reject = (message: string): CommandResult => {
    draft.rngState = rng.getState();
    return { state: draft, ok: false, message };
  };

  const isDebug = command.type.startsWith('DEBUG_');

  if (draft.status !== 'playing' && !isDebug) {
    return reject('对局已经结束，无法继续行动。');
  }
  if (isPickupBlocking(draft, command)) {
    return reject('背包已满，请先处理刚发现的物品。');
  }
  if (isEncounterBlocking(draft, command)) {
    return reject('正在遭遇战中，只能攻击、逃跑或使用物品。');
  }

  const player = getPlayer(draft);
  // 玩家每出手一次就解除上一回合的防御姿态（防御只挡一次攻击，详见 combat.ts）。
  // GUARD 命令会在随后的 switch 里重新置为 true。
  player.guarding = false;
  if (!player.alive && !isDebug) {
    return reject('你已经死亡，无法行动。');
  }

  switch (command.type) {
    case 'MOVE':
      return finish(handleMove(draft, player, command.zoneId));

    case 'SEARCH':
      return finish(handleSearch(draft, player, rng));

    case 'REST':
      return finish(handleRest(draft, player, rng));

    case 'CRAFT': {
      // 未知配方在这里就被挡住，且不推进时间
      if (!tryGetRecipe(command.recipeId)) {
        return reject('没有这个配方，无法合成。');
      }
      const res = performCraft(draft, player, command.recipeId);
      if (!res.ok) return reject(res.message);
      if (
        draft.craftGoalRecipeId === command.recipeId &&
        !draft.craftGoalCompleted
      ) {
        draft.craftGoalCompleted = true;
        pushEvent(draft, {
          type: 'CRAFT_GOAL_SET',
          actorId: player.id,
          importance: 'major',
          message: `制作目标达成：${tryGetItem(res.outputItemId ?? '')?.name ?? '成品'}`,
          metadata: { recipeId: command.recipeId, completed: true },
        });
      }
      return finish({ ok: true, message: res.message });
    }

    case 'SET_CRAFT_GOAL': {
      if (command.recipeId === null) {
        draft.craftGoalRecipeId = null;
        draft.craftGoalCompleted = false;
        return finish({ ok: true, message: '已取消制作目标。' });
      }
      const recipe = tryGetRecipe(command.recipeId);
      if (!recipe) return reject('没有这个配方。');
      draft.craftGoalRecipeId = recipe.id;
      draft.craftGoalCompleted = false;
      pushEvent(draft, {
        type: 'CRAFT_GOAL_SET',
        actorId: player.id,
        importance: 'major',
        message: `制作目标已设为「${recipe.name}」。`,
        metadata: { recipeId: recipe.id, completed: false },
      });
      return finish({ ok: true, message: `制作目标：${recipe.name}` });
    }

    case 'CALL_EXTRACTION':
    case 'EXTRACT':
    case 'SUBMIT_RESEARCH': {
      const outcome = performObjectiveAction(draft, player, command.type);
      if (!outcome.ok) return reject(outcome.message);
      return finish({ ok: true, message: outcome.message });
    }

    // USE_ITEM / EQUIP 的结算已在 Phase 4D-1 收进 commandHandlers，
    // 与 GUARD / USE_SKILL 一样共用同一份「遭遇中要写战斗日志」的规则。
    case 'USE_ITEM':
      return finish(handleUseItem(draft, player, command.uid));

    case 'EQUIP': {
      const outcome = handleEquip(draft, player, command.uid);
      // 装备失败不推进时间，与收编前的 reject 行为逐字一致
      if (!outcome.ok) return reject(outcome.message ?? '无法装备。');
      return finish(outcome);
    }

    case 'UNEQUIP': {
      const ok = unequip(player, command.slot);
      if (!ok) return reject('背包没有空间，无法卸下装备。');
      return finish({ ok: true, message: '已卸下装备。' });
    }

    case 'DROP_ITEM': {
      const dropped = removeStack(player, command.uid);
      if (!dropped) return reject('背包里没有这件物品。');
      const zone = draft.zones[player.currentZoneId];
      if (zone) zone.groundItems.push(dropped);
      const droppedName = tryGetItem(dropped.itemId)?.name ?? '未知物品';
      pushEvent(draft, {
        type: 'ITEM_DROPPED',
        actorId: player.id,
        zoneId: player.currentZoneId,
        message: `你丢弃了 ${droppedName}。`,
        metadata: { itemId: dropped.itemId },
      });
      return finish({ ok: true, message: `已丢弃 ${droppedName}。` });
    }

    case 'ATTACK':
      return finish(handleAttack(draft, player, command.targetId, rng, command.style));

    case 'ATTACK_NEARBY':
      return finish(handleAttackNearby(draft, player, rng, command.style));

    case 'GUARD':
      return finish(handleGuard(draft, player));

    case 'USE_SKILL':
      return finish(handleUseSkill(draft, player, command.skillId, rng));

    case 'FLEE':
      return finish(handleFlee(draft, player, rng));

    case 'PICKUP_GROUND':
      return finish(handlePickupGround(draft, player, command.uid));

    case 'RESOLVE_PICKUP':
      return finish(
        handleResolvePickup(draft, player, command.accept, command.dropUid),
      );

    case 'CLOSE_ENCOUNTER': {
      // 未解决的遭遇不能被"点叉"逃掉：必须先击杀、逃跑，或等对方离开
      if (!draft.encounter) return reject('当前没有进行中的遭遇。');
      if (!draft.encounter.resolved) {
        return reject('战斗尚未结束，只能继续攻击或尝试脱离。');
      }
      draft.encounter = null;
      return finish({ ok: true, message: null });
    }

    default:
      return finish(handleDebug(draft, player, command, rng));
  }
}
