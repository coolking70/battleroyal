/**
 * 统一的生命值与死亡结算。
 *
 * 第一阶段有三条独立的掉血路径（战斗 / 禁区 / 状态效果），其中状态效果那条
 * 只是把 `hp` 压到 0，从来不触发死亡结算 —— 于是出现了"血量为 0 的活人"。
 *
 * 第二阶段起，**任何**生命变化都必须经过 `applyHpChange`：
 * - 数值一律夹在 `[0, maxHp]`；
 * - 归零必然走 `killCharacter`，一次且仅一次；
 * - 死亡会同步清理遭遇、交手记录、区域名单，保证状态自洽。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { getZoneDef } from '../data/zones';
import { pushEvent } from './events';
import { refreshZoneOccupants } from './gameState';
import { addNoise } from './info';
import {
  getEquippedArmor,
  getEquippedWeapon,
  topValueStacks,
} from './inventory';
import type { Combatant, GameState, ItemStack } from './types';

export interface HpChangeResult {
  /** 实际生效的生命变化量（负数为伤害） */
  delta: number;
  died: boolean;
}

/**
 * 唯一的生命值变更入口。
 *
 * @param amount 正数为治疗，负数为伤害
 * @param killerId 致死时记录的击杀者；环境伤害传 null
 * @param cause 死亡原因文案（"战斗" / "禁区侵蚀" / "衰竭" …）
 */
export function applyHpChange(
  state: GameState,
  target: Combatant,
  amount: number,
  killerId: string | null,
  cause: string,
): HpChangeResult {
  if (!target.alive) return { delta: 0, died: false };
  if (amount === 0) return { delta: 0, died: false };

  const before = target.hp;
  const next = Math.max(0, Math.min(target.maxHp, before + amount));
  target.hp = next;
  const delta = next - before;

  if (delta < 0) {
    target.stats.damageTaken += -delta;
  }

  if (next <= 0) {
    killCharacter(state, target, killerId, cause);
    return { delta, died: true };
  }
  return { delta, died: false };
}

export interface DamageResult {
  damage: number;
  died: boolean;
}

/** 施加伤害（负向的 `applyHpChange` 包装） */
export function applyDamage(
  state: GameState,
  target: Combatant,
  amount: number,
  killerId: string | null,
  cause: string,
): DamageResult {
  if (!target.alive) return { damage: 0, died: false };
  const requested = Math.max(0, amount);
  if (requested === 0) return { damage: 0, died: false };
  const res = applyHpChange(state, target, -requested, killerId, cause);
  return { damage: -res.delta, died: res.died };
}

/** 施加治疗（正向的 `applyHpChange` 包装），返回真正回复的点数 */
export function applyHealing(
  state: GameState,
  target: Combatant,
  amount: number,
): number {
  if (!target.alive || amount <= 0) return 0;
  return applyHpChange(state, target, amount, null, '治疗').delta;
}

/**
 * 角色死亡处理：
 * 1. 标记死亡，记录击杀者与死亡时间
 * 2. 在当前区域生成最多 3 件掉落（已装备武器 > 已装备防具 > 背包最高价值）
 * 3. 清理遭遇 / 交手记录 / 区域存活名单
 * 4. 写入事件日志并制造噪音
 */
export function killCharacter(
  state: GameState,
  victim: Combatant,
  killerId: string | null,
  cause: string,
): void {
  if (!victim.alive) return;

  victim.alive = false;
  victim.hp = 0;
  victim.killedBy = killerId;
  victim.diedAtTime = state.time;
  if (!state.deathOrder.includes(victim.id)) {
    state.deathOrder.push(victim.id);
  }

  const drops: ItemStack[] = [];
  const weapon = getEquippedWeapon(victim);
  const armor = getEquippedArmor(victim);
  if (weapon) drops.push(weapon);
  if (armor) drops.push(armor);
  const remaining = GAME_CONFIG.maxCorpseDrops - drops.length;
  if (remaining > 0) {
    drops.push(...topValueStacks(victim, remaining));
  }

  const zone = state.zones[victim.currentZoneId];
  if (zone) {
    zone.groundItems.push(...drops.slice(0, GAME_CONFIG.maxCorpseDrops));
    zone.lastCombatTime = state.time;
  }

  victim.inventory = [];
  victim.equipment = [];
  victim.equippedWeaponId = null;
  victim.equippedArmorId = null;
  victim.statusEffects = [];
  victim.plannedRecipeId = null;
  victim.planCreatedAt = null;
  victim.planReason = null;
  victim.planProgress = 0;
  victim.planNoProgressTurns = 0;
  victim.planRecommendedZoneId = null;
  victim.lastReplanReason = null;

  if (killerId) {
    const killer = state.characters[killerId];
    if (killer) killer.kills += 1;
  }

  // 死亡必须同步清理与之关联的临时状态，否则会留下"和死人对峙"的脏状态
  if (state.encounter) {
    if (state.encounter.enemyId === victim.id || victim.id === state.playerId) {
      state.encounter.resolved = true;
    }
  }
  state.engagedWithPlayer = state.engagedWithPlayer.filter((id) => id !== victim.id);

  const killerName = killerId ? state.characters[killerId]?.name ?? '未知' : null;
  pushEvent(state, {
    type: 'CHARACTER_DIED',
    actorId: killerId,
    targetId: victim.id,
    zoneId: victim.currentZoneId,
    importance: 'critical',
    message: killerName
      ? `${victim.name} 被 ${killerName} 击杀（${getZoneDef(victim.currentZoneId).name}）。`
      : `${victim.name} 在${getZoneDef(victim.currentZoneId).name}死亡（${cause}）。`,
    metadata: {
      cause,
      killerId: killerId ?? null,
      dropCount: Math.min(drops.length, GAME_CONFIG.maxCorpseDrops),
    },
  });

  addNoise(state, victim.currentZoneId, 'death');
  refreshZoneOccupants(state);
}
