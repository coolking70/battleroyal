/**
 * 合法行动的类型定义与子集枚举器（Phase 3 Step 10 从 legalActions.ts 拆出）。
 *
 * 本文件只回答「某一类命令在当前状态下有哪些是保证可执行的」，
 * 不含主入口 `getLegalPlayerCommands` 与死锁诊断——那些仍在 `legalActions.ts`。
 * 拆分纯属文件体积治理，逻辑与拆分前逐行一致。
 */

import { areAdjacent, getZoneDef, tryGetZoneDef } from '../data/zones';
import { getItem, tryGetItem } from '../data/items';
import { RECIPES } from '../data/recipes';
import { canPayActionCost } from './actionCosts';
import { canAttack } from './combat';
import { SKILLS, canUseSkill, getCharacterSkill, type SkillId } from './skills';
import { advancesTime, commandLabel } from './commands';
import { hasRoomForOutput } from './crafting';
import { enemiesInZone } from './gameState';
import {
  getEquippedArmor,
  getEquippedWeapon,
  hasFreeSlot,
  missingIngredients,
} from './inventory';
import type { Command, Combatant, GameState } from './types';

/** 合法动作的分类，供 UI 分组与模拟器策略选择 */
export type LegalActionCategory =
  | 'movement'
  | 'search'
  | 'recovery'
  | 'craft'
  | 'combat'
  | 'item'
  /** 不推进时间、但能解开阻塞状态的命令 */
  | 'resolution'
  /** 不推进时间的纯设置类命令 */
  | 'meta';

export interface LegalAction {
  command: Command;
  /** 中文标签，可直接用于按钮与日志 */
  label: string;
  /** 执行后是否推进 1 个时间单位 */
  advancesTime: boolean;
  /** 体力成本（0 表示免费） */
  staminaCost: number;
  category: LegalActionCategory;
  /** 补充说明，例如"进入禁区会持续掉血" */
  note: string | null;
}

export function action(
  command: Command,
  category: LegalActionCategory,
  staminaCost: number,
  note: string | null = null,
): LegalAction {
  return {
    command,
    label: commandLabel(command),
    advancesTime: advancesTime(command),
    staminaCost,
    category,
    note,
  };
}

/* ------------------------------------------------------------------ */
/* 子集枚举                                                            */
/* ------------------------------------------------------------------ */

/**
 * 背包相关的"整理型"命令。
 * 这些命令都不推进时间，遭遇战中同样允许（见 `isEncounterBlocking`）。
 */
export function inventoryActions(player: Combatant): LegalAction[] {
  const out: LegalAction[] = [];
  for (const stack of player.inventory) {
    const def = tryGetItem(stack.itemId);
    if (!def) continue; // 脏数据不进合法集合
    if (def.category === 'consumable') {
      out.push(
        action({ type: 'USE_ITEM', uid: stack.uid }, 'item', 0, `使用 ${def.name}`),
      );
    }
    if (def.category === 'weapon' || def.category === 'armor') {
      // 装备槽独立于背包格：新装备先离开背包，必定腾出一格给换下的旧装备，
      // 所以只要物品可装备就一定能装上。
      out.push(action({ type: 'EQUIP', uid: stack.uid }, 'item', 0, `装备 ${def.name}`));
    }
    out.push(action({ type: 'DROP_ITEM', uid: stack.uid }, 'item', 0, `丢弃 ${def.name}`));
  }
  // 卸下装备需要背包有空位放回，否则引擎会拒绝
  if (hasFreeSlot(player)) {
    if (getEquippedWeapon(player)) {
      out.push(action({ type: 'UNEQUIP', slot: 'weapon' }, 'item', 0, null));
    }
    if (getEquippedArmor(player)) {
      out.push(action({ type: 'UNEQUIP', slot: 'armor' }, 'item', 0, null));
    }
  }
  return out;
}

/**
 * 战斗动作。
 *
 * Phase 2A-1 信息隐藏（§十）后的目标选择规则：
 * - **未发生正式遭遇**：不逐个列出匿名对手（那会泄露同区域人数），只给一个
 *   泛化的「袭击附近目标」（ATTACK_NEARBY），由引擎按种子随机数从同区域的
 *   未识别目标中确定对象，出手后立即建立正式遭遇；
 * - **已进入遭遇**：对手已被识别，攻击精确指定 `encounter.enemyId`（模态战斗）；
 * - FLEE 保持免费，只要同区域有敌人就在合法集合里（反死锁最后一道保险）。
 */
export function combatActions(state: GameState, player: Combatant): LegalAction[] {
  const out: LegalAction[] = [];
  const enemies = enemiesInZone(state, player);
  if (enemies.length === 0) return out;

  const encounter = state.encounter && !state.encounter.resolved ? state.encounter : null;
  const atk = canAttack(player);
  if (atk.ok) {
    if (encounter) {
      const enemy = enemies.find((e) => e.id === encounter.enemyId);
      if (enemy) {
        out.push(
          action(
            { type: 'ATTACK', targetId: enemy.id, style: 'normal' },
            'combat',
            atk.cost,
            '正在交战的对手（可在界面选择攻击风格）',
          ),
        );
      }
    } else {
      out.push(
        action(
          { type: 'ATTACK_NEARBY', style: 'normal' },
          'combat',
          atk.cost,
          '从同区域的未识别目标中选一个出手（出手后进入正式遭遇）',
        ),
      );
    }
  }

  // GUARD：防御姿态，减免下一次所受伤害（Phase 3 Step 1）
  const gd = canPayActionCost(player, 'GUARD');
  if (gd.ok) {
    out.push(
      action(
        { type: 'GUARD' },
        'combat',
        gd.cost,
        '摆出防御姿态：下一击伤害减免，但本回合放弃进攻',
      ),
    );
  }

  // FLEE 是免费行动：只要同区域还有活着的敌人，就一定在合法集合里
  //（`handleFlee` 已能在没有正式遭遇时自动选定脱离对象）。
  // 这是"遭遇战永不死锁"的最后一道保险。
  const flee = canPayActionCost(player, 'FLEE');
  if (flee.ok) {
    out.push(
      action(
        { type: 'FLEE' },
        'combat',
        flee.cost,
        '免费行动，但仍推进 1 个时间单位，失败会被追击',
      ),
    );
  }
  return out;
}

/**
 * 角色技能（Phase 3 Step 3）。
 * 每个角色拥有一枚专属签名技能，可随时释放（自增益 / 治疗 / 修理），
 * 只要冷却就绪且付得起体力。技能不要求处于遭遇中，因此在这里单独成块，
 * 并在遭遇内与主列表两处都纳入合法集合。
 */
export function skillActions(player: Combatant): LegalAction[] {
  const skillId = getCharacterSkill(player.characterId);
  if (!skillId) return [];
  const check = canUseSkill(player, skillId as SkillId);
  if (!check.ok) return [];
  const def = SKILLS[skillId as SkillId];
  return [
    action(
      { type: 'USE_SKILL', skillId },
      'combat',
      check.cost,
      `${def.name}：${def.description}`,
    ),
  ];
}

/** 玩家脚下是否是禁区 / 预警区（决定遭遇战中能否撤离，与 NPC 同一判据） */
export function needsEvacuation(state: GameState, player: Combatant): boolean {
  const zone = state.zones[player.currentZoneId];
  return zone?.status === 'restricted' || zone?.status === 'warning';
}

/** 移动到相邻且存在的区域，且付得起体力 */
export function movementActions(state: GameState, player: Combatant): LegalAction[] {
  const out: LegalAction[] = [];
  const moveCheck = canPayActionCost(player, 'MOVE');
  if (!moveCheck.ok) return out;

  for (const zoneId of Object.keys(state.zones)) {
    if (zoneId === player.currentZoneId) continue;
    if (!tryGetZoneDef(zoneId)) continue;
    if (!areAdjacent(player.currentZoneId, zoneId)) continue;
    const zone = state.zones[zoneId];
    const restricted = zone?.status === 'restricted';
    out.push(
      action(
        { type: 'MOVE', zoneId },
        'movement',
        moveCheck.cost,
        restricted ? `${getZoneDef(zoneId).name}已是禁区，进入会持续掉血` : null,
      ),
    );
  }
  return out;
}

/** 合成：材料 / 体力 / 背包空间三项都满足 */
export function craftActions(player: Combatant): LegalAction[] {
  const out: LegalAction[] = [];
  const craftCheck = canPayActionCost(player, 'CRAFT');
  if (!craftCheck.ok) return out;

  for (const recipe of RECIPES) {
    if (missingIngredients(player, recipe.ingredients).length > 0) continue;
    if (!hasRoomForOutput(player, recipe)) continue;
    out.push(
      action(
        { type: 'CRAFT', recipeId: recipe.id },
        'craft',
        craftCheck.cost,
        `合成 ${getItem(recipe.outputItemId).name}`,
      ),
    );
  }
  return out;
}

/** 待决拾取：唯一允许的出口 */
export function pickupResolutionActions(
  state: GameState,
  player: Combatant,
): LegalAction[] {
  const pending = state.pendingPickup;
  if (!pending) return [];
  const out: LegalAction[] = [];

  // 放弃永远合法——这是解开阻塞的保底选项
  out.push(
    action(
      { type: 'RESOLVE_PICKUP', accept: false },
      'resolution',
      0,
      '放弃这件物品（会落在地上）',
    ),
  );

  // 收下必须明确指定"丢哪一件"：引擎的 `accept:true` 分支要求 dropUid 存在，
  // 缺了它会直接返回 ok:false，因此绝不能把无 dropUid 的版本放进合法集合。
  for (const stack of player.inventory) {
    out.push(
      action(
        { type: 'RESOLVE_PICKUP', accept: true, dropUid: stack.uid },
        'resolution',
        0,
        `丢弃 ${tryGetItem(stack.itemId)?.name ?? '未知物品'} 后收下`,
      ),
    );
  }
  return out;
}
