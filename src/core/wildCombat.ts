import { getItem } from '../data/items';
import { getWildDropTable, getWildEnemy } from '../data/wildEnemies';
import { getZoneDef } from '../data/zones';
import { payActionCost } from './actionCosts';
import { canAttack, computeDamage, fleeChanceIn, fleeDestinations, hitChanceIn } from './combat';
import { adjustIncomingCombatDamage, prepareAttack, wearAttackWeapon } from './combatRound';
import { applyExposed, consumeExposedOnDamage } from './exposed';
import { pushEvent } from './events';
import { refreshZoneOccupants } from './gameState';
import { createStack } from './inventory';
import { applyDamage } from './vitals';
import type { SeededRandom } from './random';
import type { AttackStyle, Combatant, GameState, StatusEffect, WildEnemyDef, WildEnemyInstance } from './types';

export interface WildActionResult {
  ok: boolean;
  message: string;
  enemyDefeated?: boolean;
  actorDied?: boolean;
  escaped?: boolean;
}

function wildEffects(enemy: WildEnemyInstance, def: WildEnemyDef): StatusEffect[] {
  const effects: StatusEffect[] = [];
  if (def.abilityId === 'evasive') effects.push({ id: 'wild_evasive', remaining: 1, hpPerTick: 0, label: '灵活', evasionHitMult: 0.86 });
  if (def.abilityId === 'armored') effects.push({ id: 'wild_armored', remaining: 1, hpPerTick: 0, label: '装甲', defenseBonus: 2 });
  if (def.abilityId === 'enrage' && enemy.hp / def.maxHp <= 0.5) effects.push({ id: 'wild_enraged', remaining: 1, hpPerTick: 0, label: '狂暴', damageMult: 1.25 });
  return effects;
}

/** Transient rules adapter only; it is never inserted into GameState.characters. */
export function wildCombatProfile(enemy: WildEnemyInstance): Combatant {
  const def = getWildEnemy(enemy.defId);
  const personality = def.behavior === 'aggressive' ? 'aggressive' : def.behavior === 'defensive' ? 'cautious' : 'opportunist';
  return {
    id: enemy.uid, name: def.name, isPlayer: false, characterId: `wild:${def.id}`, personality,
    victoryGoal: null,
    level: 1, exp: 0, hp: enemy.hp, maxHp: def.maxHp, stamina: 99, maxStamina: 99,
    attack: def.attack, defense: def.defense, perception: 6, speed: def.speed, crafting: 0, medical: 0,
    passiveId: 'enduring', currentZoneId: enemy.zoneId, inventory: [], equipment: [],
    equippedWeaponId: null, equippedArmorId: null, equippedUtilityId: null,
    alive: enemy.status === 'alive', kills: 0, statusEffects: wildEffects(enemy, def),
    lastAction: null, lastActionReason: null, knownEnemies: [], killedBy: null, diedAtTime: null,
    stats: { searches: 0, crafts: 0, moves: 0, itemsUsed: 0, attacks: 0, damageDealt: 0, damageTaken: 0, wildKills: 0 },
    plannedRecipeId: null, planCreatedAt: null, planReason: null, planProgress: 0,
    planNoProgressTurns: 0, planRecommendedZoneId: null, lastReplanReason: null,
    furthestPhase: 'opening', guarding: enemy.guarding, skillCooldowns: {},
  };
}

export function startWildEncounter(state: GameState, actor: Combatant, enemy: WildEnemyInstance): void {
  if (enemy.status !== 'alive' || enemy.zoneId !== actor.currentZoneId) return;
  state.stats.wildEncounterCount += 1;
  const def = getWildEnemy(enemy.defId);
  pushEvent(state, {
    type: 'WILD_ENCOUNTER_STARTED', actorId: actor.id, zoneId: enemy.zoneId,
    message: `${actor.name} 遭遇了 ${def.name}。`,
    metadata: { wildUid: enemy.uid, wildDefId: def.id, threat: def.threat },
  });
}

function createWildDrops(state: GameState, enemy: WildEnemyInstance, killer: Combatant, rng: SeededRandom): void {
  if (enemy.dropResolved) return;
  enemy.dropResolved = true;
  const def = getWildEnemy(enemy.defId);
  const zone = state.zones[enemy.zoneId];
  if (!zone) return;
  for (const entry of getWildDropTable(def.dropTableId).entries) {
    if (!rng.chance(entry.probability)) continue;
    const count = rng.int(entry.min, entry.max);
    const stack = createStack(state, entry.itemId, count);
    stack.droppedBy = killer.id;
    stack.revealedTo = [];
    zone.groundItems.push(stack);
    state.stats.wildDropsCreated += 1;
    pushEvent(state, {
      type: 'WILD_DROP_CREATED', actorId: killer.id, zoneId: enemy.zoneId,
      message: `${def.name} 留下了 ${getItem(entry.itemId).name}。`,
      metadata: { wildUid: enemy.uid, wildDefId: def.id, itemId: entry.itemId, count },
    });
  }
}

function defeatWild(state: GameState, enemy: WildEnemyInstance, killer: Combatant, rng: SeededRandom): void {
  if (enemy.status !== 'alive') return;
  const def = getWildEnemy(enemy.defId);
  enemy.status = 'defeated';
  enemy.hp = 0;
  enemy.guarding = false;
  enemy.statusEffects = [];
  enemy.defeatedAtTime = state.time;
  killer.stats.wildKills = (killer.stats.wildKills ?? 0) + 1;
  state.stats.wildKillCount += 1;
  createWildDrops(state, enemy, killer, rng);
  pushEvent(state, {
    type: 'WILD_DEFEATED', actorId: killer.id, zoneId: enemy.zoneId,
    message: `${killer.name} 击败了 ${def.name}。`,
    metadata: { wildUid: enemy.uid, wildDefId: def.id },
  });
  if (killer.isPlayer && state.encounter?.targetKind === 'wild' && state.encounter.enemyId === enemy.uid) {
    state.encounter.resolved = true;
  }
}

export function attackWildActor(
  state: GameState,
  actor: Combatant,
  wildUid: string,
  rng: SeededRandom,
  style: AttackStyle = 'normal',
  respond = false,
): WildActionResult {
  const enemy = state.wildEnemies[wildUid];
  if (!enemy || enemy.status !== 'alive') return { ok: false, message: '野外目标已经不在了。' };
  if (!actor.alive || actor.currentZoneId !== enemy.zoneId) return { ok: false, message: '野外目标不在当前区域。' };
  const cost = canAttack(actor, style);
  if (!cost.ok) return { ok: false, message: cost.reason ?? '体力不足。' };
  const target = wildCombatProfile(enemy);
  prepareAttack(state, actor, style);
  const chance = hitChanceIn(state, actor, target, style);
  const hit = rng.chance(chance);
  const weaponBroke = wearAttackWeapon(actor);
  if (!hit) {
    const exposed = style === 'heavy' ? applyExposed(state, actor) : false;
    const message = `${actor.name} 攻击 ${target.name}，被闪开了。${exposed ? '（重击落空，露出破绽）' : ''}`;
    pushEvent(state, { type: 'ATTACK_MISSED', actorId: actor.id, zoneId: actor.currentZoneId, message, metadata: { style, chance: Math.round(chance * 100), wildUid, wildDefId: enemy.defId, weaponBroke, exposed } });
    const response = respond ? resolveWildTurn(state, actor, enemy, rng) : null;
    return { ok: true, message: response ? `${message}\n${response.message}` : message, actorDied: !actor.alive };
  }
  const rawDamage = computeDamage(actor, target, rng, style, false);
  const adjusted = adjustIncomingCombatDamage(target, rawDamage);
  enemy.guarding = target.guarding;
  enemy.hp = Math.max(0, enemy.hp - adjusted.damage);
  actor.stats.damageDealt += adjusted.damage;
  const message = `${actor.name} 命中 ${target.name}，造成 ${adjusted.damage} 点伤害${adjusted.guarded ? '（防御姿态减免）' : ''}。`;
  pushEvent(state, { type: 'ATTACK_HIT', actorId: actor.id, zoneId: actor.currentZoneId, message, metadata: { style, chance: Math.round(chance * 100), damage: adjusted.damage, wildUid, wildDefId: enemy.defId, weaponBroke } });
  if (enemy.hp <= 0) {
    defeatWild(state, enemy, actor, rng);
    return { ok: true, message: `${message}——${target.name} 已被击败。`, enemyDefeated: true, actorDied: false };
  }
  const response = respond ? resolveWildTurn(state, actor, enemy, rng) : null;
  return { ok: true, message: response ? `${message}\n${response.message}` : message, actorDied: !actor.alive };
}

function wildFlees(state: GameState, actor: Combatant, enemy: WildEnemyInstance): WildActionResult {
  const def = getWildEnemy(enemy.defId);
  // A wild self-flee ends only this encounter. The finite population entry,
  // persistent HP, UID, zone, and ability charges remain available for a
  // later search; only defeat changes the population lifecycle to defeated.
  enemy.guarding = false;
  enemy.statusEffects = [];
  state.stats.wildFleeCount += 1;
  pushEvent(state, { type: 'WILD_FLED', targetId: actor.id, zoneId: enemy.zoneId, message: `${def.name} 脱离了交战，退回附近环境。`, metadata: { wildUid: enemy.uid, wildDefId: def.id, direction: 'wild' } });
  if (state.encounter?.targetKind === 'wild' && state.encounter.enemyId === enemy.uid) state.encounter.resolved = true;
  return { ok: true, message: `${def.name} 脱离了交战。`, escaped: true };
}

export function resolveWildTurn(state: GameState, actor: Combatant, enemy: WildEnemyInstance, rng: SeededRandom): WildActionResult {
  if (!actor.alive || enemy.status !== 'alive') return { ok: false, message: '遭遇已经结束。' };
  const def = getWildEnemy(enemy.defId);
  const hpRatio = enemy.hp / def.maxHp;
  if (def.behavior === 'skittish' && hpRatio <= 0.45 && rng.chance(0.45)) return wildFlees(state, actor, enemy);
  if (def.behavior === 'defensive' && !enemy.guarding && rng.chance(0.3)) {
    enemy.guarding = true;
    const message = `${def.name} 收紧姿态准备承受下一击。`;
    pushEvent(state, { type: 'WILD_ATTACK', targetId: actor.id, zoneId: enemy.zoneId, message, metadata: { wildUid: enemy.uid, wildDefId: def.id, action: 'guard' } });
    return { ok: true, message };
  }
  const profile = wildCombatProfile(enemy);
  let charged = false;
  if (def.abilityId === 'charge' && enemy.abilityCharges > 0) {
    profile.attack += 3;
    enemy.abilityCharges -= 1;
    charged = true;
  }
  const chance = hitChanceIn(state, profile, actor);
  if (!rng.chance(chance)) {
    const message = `${def.name} 扑向 ${actor.name}，攻击落空。`;
    pushEvent(state, { type: 'WILD_ATTACK', targetId: actor.id, zoneId: enemy.zoneId, message, metadata: { wildUid: enemy.uid, wildDefId: def.id, hit: false, chance: Math.round(chance * 100), charged } });
    return { ok: true, message };
  }
  const adjusted = adjustIncomingCombatDamage(actor, computeDamage(profile, actor, rng, 'normal', false));
  actor.stats.damageTaken += adjusted.damage;
  state.stats.wildDamageTaken += adjusted.damage;
  const result = applyDamage(state, actor, adjusted.damage, null, `${def.name}攻击`);
  if (result.died && actor.isPlayer) state.stats.wildPlayerDeaths += 1;
  if (result.damage > 0) consumeExposedOnDamage(state, actor);
  if (def.abilityId === 'venom' && !result.died && !actor.statusEffects.some((effect) => effect.id === 'wild_poison')) {
    actor.statusEffects.push({ id: 'wild_poison', remaining: 2, hpPerTick: -2, label: '野外毒伤' });
  }
  const message = `${def.name} 命中 ${actor.name}，造成 ${adjusted.damage} 点伤害${charged ? '（冲撞）' : ''}。`;
  pushEvent(state, { type: 'WILD_ATTACK', targetId: actor.id, zoneId: enemy.zoneId, message, metadata: { wildUid: enemy.uid, wildDefId: def.id, hit: true, damage: adjusted.damage, charged, venom: def.abilityId === 'venom' } });
  return { ok: true, message, actorDied: result.died };
}

export function fleeWildEncounter(state: GameState, actor: Combatant, enemy: WildEnemyInstance, rng: SeededRandom): WildActionResult {
  if (enemy.status !== 'alive' || enemy.zoneId !== actor.currentZoneId) return { ok: false, message: '当前没有需要脱离的野外敌人。' };
  payActionCost(actor, 'FLEE');
  const destinations = fleeDestinations(state, actor);
  const profile = wildCombatProfile(enemy);
  const success = destinations.length === 0 || rng.chance(fleeChanceIn(state, actor, profile));
  if (!success) return { ok: true, message: `${actor.name} 试图脱离，但被 ${profile.name} 缠住了。`, escaped: false };
  const target = rng.pick(destinations);
  if (target) {
    actor.currentZoneId = target;
    actor.stats.moves += 1;
    state.stats.moves += 1;
    refreshZoneOccupants(state);
  }
  state.stats.wildFleeCount += 1;
  const message = target ? `${actor.name} 摆脱 ${profile.name}，撤往${getZoneDef(target).name}。` : `${actor.name} 原地脱离了 ${profile.name}。`;
  pushEvent(state, { type: 'WILD_FLED', actorId: actor.id, zoneId: target ?? actor.currentZoneId, message, metadata: { wildUid: enemy.uid, wildDefId: enemy.defId, direction: 'contestant', toZoneId: target ?? null } });
  if (actor.isPlayer && state.encounter?.targetKind === 'wild' && state.encounter.enemyId === enemy.uid) state.encounter.resolved = true;
  return { ok: true, message, escaped: true };
}

/** One wild response per time-advancing player command. */
export function advanceActiveWildEncounter(state: GameState, rng: SeededRandom): void {
  const encounter = state.encounter;
  if (!encounter || encounter.resolved || encounter.targetKind !== 'wild') return;
  const player = state.characters[state.playerId];
  const enemy = state.wildEnemies[encounter.enemyId];
  if (!player?.alive || !enemy || enemy.status !== 'alive' || enemy.zoneId !== player.currentZoneId) {
    encounter.resolved = true;
    return;
  }
  if (encounter.reconInitiative) {
    encounter.reconInitiative = false;
    encounter.log.push('警觉侦察让你抢到先机，对方未能立刻出手。');
    return;
  }
  const result = resolveWildTurn(state, player, enemy, rng);
  encounter.log.push(result.message);
}
