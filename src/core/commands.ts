import { GAME_CONFIG } from '../data/gameConfig';
import { areAdjacent, tryGetZoneDef } from '../data/zones';
import type { Combatant, Command, GameState } from './types';

export interface Validation {
  ok: boolean;
  reason: string | null;
}

const OK: Validation = { ok: true, reason: null };

function fail(reason: string): Validation {
  return { ok: false, reason };
}

/** 移动校验：只能去存在且相邻的区域，死亡角色不能移动 */
export function validateMove(
  state: GameState,
  actor: Combatant,
  zoneId: string,
): Validation {
  if (state.status !== 'playing') return fail('对局已经结束。');
  if (!actor.alive) return fail('已经死亡的角色无法移动。');
  if (!tryGetZoneDef(zoneId)) return fail('目标区域不存在。');
  if (zoneId === actor.currentZoneId) return fail('已经在该区域了。');
  if (!areAdjacent(actor.currentZoneId, zoneId)) {
    return fail('只能移动到相邻区域。');
  }
  return OK;
}

/**
 * 撤离例外：遭遇战中，玩家站在**禁区或预警区**时允许直接移动。
 *
 * 这是为了消除一条实测出来的规则不对称（Phase 2A 验收标准 2「NPC 与玩家
 * 遵守同一规则」）：`npcDecide.decideNpcAction` 的优先级里 `evacuate`（分支 2）
 * 排在交战（分支 6）**之前** —— NPC 只要脚下是禁区/预警区，哪怕同区域站着
 * 敌人也会先撤走，而且走的是普通 `MOVE`，不需要逃跑判定。
 *
 * 玩家原先在遭遇战里只有「攻击 / 逃跑 / 用道具」三个出口：想离开禁区就必须
 * 赌一次逃跑判定，失败还会被追击，只能继续站在禁区里挨伤害。
 * 1000 局模拟显示玩家每局承受的区域伤害事件是 NPC 的约 3 倍（1.57 : 0.50）。
 *
 * 这里只放开**与 NPC 完全相同的条件**：脚下是 restricted / warning 才允许移动。
 * 安全区里的遭遇战依旧只能打或逃，模态战斗的设计没有被推翻。
 */
function isEvacuationMove(state: GameState, command: Command): boolean {
  if (command.type !== 'MOVE') return false;
  const player = state.characters[state.playerId];
  if (!player) return false;
  const zone = state.zones[player.currentZoneId];
  if (!zone) return false;
  return zone.status === 'restricted' || zone.status === 'warning';
}

/** 遭遇状态下只允许战斗相关操作（撤离禁区除外，见 `isEvacuationMove`） */
export function isEncounterBlocking(state: GameState, command: Command): boolean {
  if (!state.encounter || state.encounter.resolved) return false;
  if (isEvacuationMove(state, command)) return false;
  switch (command.type) {
    case 'ATTACK':
    case 'ATTACK_NEARBY':
    case 'GUARD':
    case 'USE_SKILL':
    case 'FLEE':
    case 'USE_ITEM':
    case 'EQUIP':
    case 'UNEQUIP':
    case 'DROP_ITEM':
    case 'CLOSE_ENCOUNTER':
    case 'RESOLVE_PICKUP':
    case 'DEBUG_ADVANCE_TIME':
    case 'DEBUG_GIVE_MATERIAL':
    case 'DEBUG_HEAL_PLAYER':
    case 'DEBUG_TRIGGER_ZONE':
    case 'DEBUG_WEAKEN_NPC':
      return false;
    default:
      return true;
  }
}

/** 有待处理的拾取选择时，必须先做出选择 */
export function isPickupBlocking(state: GameState, command: Command): boolean {
  if (!state.pendingPickup) return false;
  return command.type !== 'RESOLVE_PICKUP';
}

/** 会推进 1 个时间单位的命令 */
export function advancesTime(command: Command): boolean {
  switch (command.type) {
    case 'MOVE':
    case 'SEARCH':
    case 'REST':
    case 'CRAFT':
    case 'USE_ITEM':
    case 'ATTACK':
    case 'ATTACK_NEARBY':
    case 'GUARD':
    case 'USE_SKILL':
    case 'FLEE':
    case 'CALL_EXTRACTION':
    case 'EXTRACT':
    case 'SUBMIT_RESEARCH':
      return true;
    default:
      return false;
  }
}

/** 命令的中文名，用于错误提示 */
export function commandLabel(command: Command): string {
  const labels: Record<Command['type'], string> = {
    MOVE: '移动',
    SEARCH: '搜索',
    REST: '休息',
    CRAFT: '合成',
    USE_ITEM: '使用物品',
    EQUIP: '装备',
    UNEQUIP: '卸下',
    DROP_ITEM: '丢弃',
    ATTACK: '攻击',
    ATTACK_NEARBY: '袭击附近目标',
    GUARD: '防御',
    USE_SKILL: '技能',
    FLEE: '逃跑',
    PICKUP_GROUND: '拾取',
    RESOLVE_PICKUP: '处理拾取',
    CLOSE_ENCOUNTER: '结束遭遇',
    SET_CRAFT_GOAL: '设定制作目标',
    CALL_EXTRACTION: '呼叫撤离',
    EXTRACT: '执行撤离',
    SUBMIT_RESEARCH: '提交研究',
    DEBUG_ADVANCE_TIME: '调试：推进时间',
    DEBUG_GIVE_MATERIAL: '调试：给予材料',
    DEBUG_HEAL_PLAYER: '调试：回满生命',
    DEBUG_TRIGGER_ZONE: '调试：触发禁区',
    DEBUG_WEAKEN_NPC: '调试：削弱 NPC',
  };
  return labels[command.type];
}

export const INVENTORY_SLOTS = GAME_CONFIG.inventorySlots;
