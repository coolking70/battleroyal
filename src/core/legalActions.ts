/**
 * 合法行动服务（Phase 2A Step 4）。
 *
 * ## 为什么需要这个模块
 *
 * 第二阶段验收暴露的最严重问题是**对局死锁**：玩家进入某些状态之后，
 * 界面上所有按钮要么被禁用、要么点了返回 `ok:false`，时间永远停在原地，
 * 对局既不能推进也不能结束。原因是"哪些命令现在可用"这件事被拆散在
 * 三个地方各写一遍：
 *
 *   - `commands.ts` 的 `isEncounterBlocking` / `isPickupBlocking`（阻塞规则）
 *   - `gameEngine.ts` 的各 `case` 分支（真正的执行校验）
 *   - 各个 UI 组件的 `disabled={...}`（界面可点性）
 *
 * 三份逻辑互相漂移，就必然出现"UI 说能点、引擎说不行"或者
 * "三个出口同时关闭"的情况。本模块把它收敛成**唯一权威来源**：
 *
 *   - `getLegalPlayerCommands(state)` —— 枚举当前状态下**保证可执行**的命令；
 *   - `hasTimeAdvancingAction(state)` —— 断言"活着的玩家永远有出路"。
 *
 * ## 核心不变量（Phase 2A 硬性要求）
 *
 * > **只要 `status === 'playing'` 且玩家存活，`hasTimeAdvancingAction(state)`
 * > 必须恒为 `true`。**
 *
 * 这个不变量由三条设计共同兜底：
 *
 * 1. `REST` 不消耗体力，非遭遇状态下永远可用；
 * 2. `FLEE` 自 Phase 2A 起为免费行动（成本 0），遭遇状态下永远可用；
 *    恰好 0 体力时 `GUARD` 也作为应急防守选择免费开放；
 * 3. `pendingPickup` 这类"必须先处理"的阻塞态，都能被一个**不推进时间的
 *    解决型命令**（`RESOLVE_PICKUP` / `CLOSE_ENCOUNTER`）解开，
 *    解开之后立刻回到上面两种情况。
 *
 * 因此 `hasTimeAdvancingAction` 允许有限步（默认 2 步）的解锁前瞻，
 * 而不是只看当前这一步。
 *
 * ## 使用方
 *
 * - `tools/autoPlayer.ts`：模拟器只能从这里挑动作，杜绝"模拟器发出
 *   界面上根本按不出来的命令"这种失真；
 * - 调试面板：展示当前合法动作与死锁诊断；
 * - 测试：反死锁回归用例。
 */

import { RECIPES } from '../data/recipes';
import { getZoneDef } from '../data/zones';
import { tryGetItem } from '../data/items';
import { canPayActionCost, getActionStaminaCost } from './actionCosts';
import { getPlayer } from './gameState';
import { canAccept } from './inventory';
import {
  action,
  combatActions,
  craftActions,
  inventoryActions,
  movementActions,
  needsEvacuation,
  pickupResolutionActions,
  skillActions,
} from './legalActionBuilders';
import type { Combatant, Command, GameState, ItemStack } from './types';

import type { LegalAction } from './legalActionBuilders';

export type { LegalAction, LegalActionCategory } from './legalActionBuilders';

/** 解锁前瞻的最大步数：目前最深的阻塞链是 pendingPickup → 遭遇 → 正常，2 步足够 */
const MAX_RESOLUTION_LOOKAHEAD = 2;

/**
 * 地面物品的唯一可见 / 可拾取门槛。
 *
 * 普通掉落没有 `revealedTo`，维持原有公开行为；尸体掉落只有击杀者或
 * 已通过本区域搜索被写入 `revealedTo` 的角色可以看到它。玩家 UI、玩家命令
 * 与 NPC 自动拾取都复用此判定，避免出现“列表可见但命令拒绝”的漂移。
 */
export function canAccessGroundItem(actor: Combatant, stack: ItemStack): boolean {
  if (stack.droppedBy === undefined && stack.revealedTo === undefined) return true;
  if (!Array.isArray(stack.revealedTo)) return false;
  return stack.droppedBy === actor.id || stack.revealedTo.includes(actor.id);
}

/**
 * 物品进入任何角色背包时清除地面归属。
 *
 * 归属只描述「这件东西正躺在地上、属于某具尸体」。一旦被捡进背包，
 * 它就只是普通物品了。不清除的话，玩家腾背包时手动丢下的东西会带着
 * 旧的 `droppedBy` 落地，被 `canAccessGroundItem` 当成尸体遗物 ——
 * 除原主外谁都看不见也捡不走，与「非击杀掉落不受此规则约束」相悖。
 * NPC 满包替换时丢回地面的物品同理。
 */
export function clearGroundOwnership(stack: ItemStack): ItemStack {
  delete stack.droppedBy;
  delete stack.revealedTo;
  return stack;
}

/* ------------------------------------------------------------------ */
/* 主入口                                                              */
/* ------------------------------------------------------------------ */

/**
 * 枚举当前状态下玩家**保证能成功执行**的命令。
 *
 * 契约（由 `tests/legalActions.test.ts` 强制校验）：
 * 对返回列表里的任意一条命令，`executeCommand(state, cmd).ok` 必须为 `true`。
 * 换句话说，这里绝不返回"看起来能点但引擎会拒绝"的命令。
 *
 * 不包含 `DEBUG_*` 命令——调试命令不属于正常对局的行动空间。
 */
export function getLegalPlayerCommands(state: GameState): LegalAction[] {
  if (state.status !== 'playing') return [];
  const player = getPlayer(state);
  if (!player.alive) return [];

  // 1) 待决拾取是最高优先级阻塞：除 RESOLVE_PICKUP 外一律非法
  if (state.pendingPickup) {
    return pickupResolutionActions(state, player);
  }

  const encounterActive = Boolean(state.encounter && !state.encounter.resolved);

  // 2) 未结束的遭遇：战斗 + 背包整理，外加「撤离禁区」这一个例外。
  //    例外的理由见 `commands.ts` 的 `isEvacuationMove`：NPC 的 evacuate 优先级
  //    高于交战，玩家必须享有同样的权利，否则会被禁区单方面消耗。
  if (encounterActive) {
    const evacuation = needsEvacuation(state, player)
      ? movementActions(state, player).map((a) => ({
          ...a,
          note: '脚下是危险区域，可以直接撤离（无需逃跑判定）',
        }))
      : [];
    return [
      ...combatActions(state, player),
      ...evacuation,
      ...skillActions(player),
      ...inventoryActions(player),
    ];
  }

  const out: LegalAction[] = [];

  // 3) 已结算的遭遇可以关闭（不推进时间）
  if (state.encounter && state.encounter.resolved) {
    out.push(action({ type: 'CLOSE_ENCOUNTER' }, 'resolution', 0, null));
  }

  // 3.5) 主动出击：同区域有敌人时，玩家和 NPC 一样可以先动手，
  //      不必等对方挑起遭遇（见 `combatActions` 的注释）。
  out.push(...combatActions(state, player));

  // 3.6) 角色技能：随时可用（自增益 / 治疗 / 修理），冷却就绪且付得起体力即可
  out.push(...skillActions(player));

  // 4) 移动：相邻且存在的区域，且付得起体力
  out.push(...movementActions(state, player));

  // 5) 搜索
  const searchCheck = canPayActionCost(player, 'SEARCH');
  if (searchCheck.ok) {
    const zone = state.zones[player.currentZoneId];
    const empty = (zone?.remainingLootCount ?? 0) <= 0;
    out.push(
      action(
        { type: 'SEARCH' },
        'search',
        searchCheck.cost,
        empty ? '该区域物资已被搜空，仍可能遭遇参赛者或野外威胁' : null,
      ),
    );
  }

  // 6) 休息：不消耗体力，非遭遇状态下**永远合法**，是反死锁的第一道保险
  out.push(
    action({ type: 'REST' }, 'recovery', 0, '恢复体力，但同区域敌人可能偷袭'),
  );

  // 7) 合成：材料 / 体力 / 背包空间三项都满足
  out.push(...craftActions(player));

  // 8) 拾取地面物品（不推进时间）
  const zone = state.zones[player.currentZoneId];
  for (const stack of zone?.groundItems ?? []) {
    if (!tryGetItem(stack.itemId)) continue;
    if (!canAccessGroundItem(player, stack)) continue;
    if (!canAccept(player, stack)) continue;
    out.push(action({ type: 'PICKUP_GROUND', uid: stack.uid }, 'item', 0, null));
  }

  // 9) 设定 / 取消制作目标（不推进时间）
  out.push(action({ type: 'SET_CRAFT_GOAL', recipeId: null }, 'meta', 0, '取消制作目标'));
  for (const recipe of RECIPES) {
    if (recipe.id === state.craftGoalRecipeId) continue;
    out.push(
      action({ type: 'SET_CRAFT_GOAL', recipeId: recipe.id }, 'meta', 0, recipe.name),
    );
  }

  out.push(...inventoryActions(player));
  return out;
}

/** 只返回会推进时间的合法命令（模拟器主循环用） */
export function getTimeAdvancingActions(state: GameState): LegalAction[] {
  return getLegalPlayerCommands(state).filter((a) => a.advancesTime);
}

/**
 * 浅层"解锁"推演：把一个解决型命令的**阻塞效果**抹掉，
 * 得到一个只用于判断的临时状态。
 *
 * 这里刻意不调用 `executeCommand`：
 * 1. 避免 `legalActions ↔ gameEngine` 循环依赖；
 * 2. 判死锁只关心"阻塞是否会被解开"，不关心具体结算结果；
 * 3. 浅拷贝零成本，且下游只读。
 */
function unblock(state: GameState, command: Command): GameState | null {
  switch (command.type) {
    case 'RESOLVE_PICKUP':
      return { ...state, pendingPickup: null };
    case 'CLOSE_ENCOUNTER':
      return { ...state, encounter: null };
    default:
      return null;
  }
}

/**
 * 判断玩家是否**还有出路**：能否在有限步内执行到一个推进时间的动作。
 *
 * 返回 `false` 的情况只有两种，都不算 bug：
 * - 对局已经结束（`status !== 'playing'`）；
 * - 玩家已经死亡。
 *
 * 在 `status === 'playing'` 且玩家存活时返回 `false`，就是**死锁**，
 * 属于必须修复的严重缺陷。
 */
export function hasTimeAdvancingAction(
  state: GameState,
  budget: number = MAX_RESOLUTION_LOOKAHEAD,
): boolean {
  if (state.status !== 'playing') return false;
  const player = getPlayer(state);
  if (!player.alive) return false;

  const actions = getLegalPlayerCommands(state);
  if (actions.some((a) => a.advancesTime)) return true;
  if (budget <= 0) return false;

  for (const a of actions) {
    if (a.category !== 'resolution') continue;
    const next = unblock(state, a.command);
    if (next && hasTimeAdvancingAction(next, budget - 1)) return true;
  }
  return false;
}

export interface DeadlockReport {
  time: number;
  zoneId: string;
  hp: number;
  stamina: number;
  inventorySize: number;
  hasEncounter: boolean;
  hasPendingPickup: boolean;
  legalCommandTypes: string[];
  summary: string;
}

/**
 * 死锁诊断：没有死锁时返回 `null`。
 * 供模拟器（Step 6/7）与调试面板（Step 14）在每个时间单位调用。
 */
export function findDeadlock(state: GameState): DeadlockReport | null {
  if (state.status !== 'playing') return null;
  const player = getPlayer(state);
  if (!player.alive) return null;
  if (hasTimeAdvancingAction(state)) return null;

  const actions = getLegalPlayerCommands(state);
  const types = [...new Set(actions.map((a) => a.command.type))];
  return {
    time: state.time,
    zoneId: player.currentZoneId,
    hp: player.hp,
    stamina: player.stamina,
    inventorySize: player.inventory.length,
    hasEncounter: Boolean(state.encounter && !state.encounter.resolved),
    hasPendingPickup: Boolean(state.pendingPickup),
    legalCommandTypes: types,
    summary:
      `死锁：第 ${state.time} 个时间单位，玩家在 ${getZoneDef(player.currentZoneId).name}` +
      `（生命 ${player.hp} / 体力 ${player.stamina}），` +
      `合法命令 [${types.join(', ') || '无'}] 中没有任何一条能推进时间。`,
  };
}

/** 逃跑成本的对外只读快照，便于 UI 与测试断言"免费行动"这件事 */
export function fleeIsFree(player: Combatant): boolean {
  return getActionStaminaCost(player, 'FLEE') === 0;
}
