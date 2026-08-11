import { GAME_CONFIG } from '../data/gameConfig';
import { getItem } from '../data/items';
import type { Combatant } from './types';

export interface ExperienceGainResult {
  gained: number;
  levelsGained: number;
  beforeLevel: number;
  afterLevel: number;
  beforeExp: number;
  afterExp: number;
}

/** 当前等级升到下一级所需经验；已封顶时返回 0。 */
export function experienceToNextLevel(level: number): number {
  if (level < 1 || level >= GAME_CONFIG.maxLevel) return 0;
  return GAME_CONFIG.levelExpThresholds[level - 1] ?? 0;
}

/** 成品档次复用既有 value：低阶至少 2，高阶最多 6，始终低于战斗参与经验。 */
export function craftExperienceFor(itemId: string): number {
  const raw = Math.ceil(getItem(itemId).value / GAME_CONFIG.expCraftValueDivisor);
  return Math.max(GAME_CONFIG.expCraftMin, Math.min(GAME_CONFIG.expCraftMax, raw));
}

/**
 * 玩家 / NPC 共用的唯一经验与升级入口。
 * 升级只改变 attack / defense / maxHp；活人当前 HP 同量增加，死人不会复活。
 */
export function gainExperience(
  actor: Combatant,
  amount: number,
): ExperienceGainResult {
  const beforeLevel = actor.level;
  const beforeExp = actor.exp;
  const gained = Math.max(0, Math.floor(amount));
  if (gained === 0 || actor.level >= GAME_CONFIG.maxLevel) {
    return {
      gained: 0,
      levelsGained: 0,
      beforeLevel,
      afterLevel: actor.level,
      beforeExp,
      afterExp: actor.exp,
    };
  }

  actor.exp += gained;
  let levelsGained = 0;
  while (actor.level < GAME_CONFIG.maxLevel) {
    const needed = experienceToNextLevel(actor.level);
    if (needed <= 0 || actor.exp < needed) break;
    actor.exp -= needed;
    actor.level += 1;
    levelsGained += 1;
    actor.attack += GAME_CONFIG.levelAttackGain;
    actor.defense += GAME_CONFIG.levelDefenseGain;
    actor.maxHp += GAME_CONFIG.levelMaxHpGain;
    if (actor.alive) actor.hp += GAME_CONFIG.levelMaxHpGain;
  }
  if (actor.level >= GAME_CONFIG.maxLevel) actor.exp = 0;

  return {
    gained,
    levelsGained,
    beforeLevel,
    afterLevel: actor.level,
    beforeExp,
    afterExp: actor.exp,
  };
}

/** 只有实际支付了正体力成本的动作才可发经验。 */
export function gainCostedActionExperience(
  actor: Combatant,
  amount: number,
  staminaSpent: number,
): ExperienceGainResult {
  return gainExperience(actor, staminaSpent > 0 ? amount : 0);
}

/** 一次攻击结算：双方参与经验；击杀者额外获得奖励。 */
export function awardAttackExperience(
  attacker: Combatant,
  defender: Combatant,
  defenderDied: boolean,
  staminaSpent: number,
): void {
  if (staminaSpent <= 0) return;
  gainExperience(attacker, GAME_CONFIG.expCombatParticipation);
  gainExperience(defender, GAME_CONFIG.expCombatParticipation);
  if (defenderDied) gainExperience(attacker, GAME_CONFIG.expKillBonus);
}
