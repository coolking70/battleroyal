import { GAME_CONFIG } from '../data/gameConfig';
import { getItem } from '../data/items';
import { attackStaminaCostFor, spendStamina } from './actionCosts';
import { exposedDamageMultiplier } from './exposed';
import { addNoise } from './info';
import { destroyEquippedWeapon, getEquippedWeapon } from './inventory';
import { ADRENALINE_ID, consumeAdrenalineCharge } from './skills';
import { selfDamageTakenMultiplier } from './statusIds';
import type { AttackStyle, Combatant, GameState } from './types';

export interface AttackPreparation {
  staminaSpent: number;
  adrenalineActive: boolean;
  rangedAttack: boolean;
}

/** Shared player/NPC attack cost, durability-adjacent state and noise path. */
export function prepareAttack(state: GameState, attacker: Combatant, style: AttackStyle): AttackPreparation {
  attacker.stats.attacks += 1;
  state.stats.attacks += 1;
  const staminaSpent = spendStamina(attacker, attackStaminaCostFor(attacker, style));
  const adrenalineActive = attacker.statusEffects.some((effect) => effect.id === ADRENALINE_ID);
  const weapon = getEquippedWeapon(attacker);
  const rangedAttack = Boolean(weapon && getItem(weapon.itemId).weaponType === 'ranged');
  consumeAdrenalineCharge(state, attacker);
  attacker.guarding = false;
  const zone = state.zones[attacker.currentZoneId];
  if (zone) zone.lastCombatTime = state.time;
  addNoise(state, attacker.currentZoneId, 'combat');
  return { staminaSpent, adrenalineActive, rangedAttack };
}

/** Every deliberate attack wears the equipped weapon once, hit or miss. */
export function wearAttackWeapon(attacker: Combatant): boolean {
  const weapon = getEquippedWeapon(attacker);
  if (!weapon || typeof weapon.durability !== 'number') return false;
  weapon.durability -= 1;
  if (weapon.durability > 0) return false;
  destroyEquippedWeapon(attacker);
  return true;
}

export interface CombatDamageAdjustment {
  damage: number;
  guarded: boolean;
  guardPrevented: number;
  exposedBonus: number;
  frenzyBonus: number;
}

/** Canonical incoming attack modifiers, reused by contestant and wild damage. */
export function adjustIncomingCombatDamage(defender: Combatant, rawDamage: number): CombatDamageAdjustment {
  let damage = rawDamage;
  let guarded = false;
  let guardPrevented = 0;
  if (defender.guarding) {
    guarded = true;
    const reduced = Math.max(GAME_CONFIG.minDamage, Math.round(damage * (1 - GAME_CONFIG.guardDamageReduction)));
    guardPrevented = damage - reduced;
    damage = reduced;
    defender.guarding = false;
  }
  const exposedMult = exposedDamageMultiplier(defender);
  const exposedDamage = Math.max(GAME_CONFIG.minDamage, Math.round(damage * exposedMult));
  const exposedBonus = exposedDamage - damage;
  damage = exposedDamage;
  const frenzyMult = selfDamageTakenMultiplier(defender);
  const frenzyDamage = Math.max(GAME_CONFIG.minDamage, Math.round(damage * frenzyMult));
  const frenzyBonus = frenzyDamage - damage;
  return { damage: frenzyDamage, guarded, guardPrevented, exposedBonus, frenzyBonus };
}
