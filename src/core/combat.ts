import { GAME_CONFIG } from '../data/gameConfig';
import { getItem } from '../data/items';
import { attackStaminaCostFor, spendStamina, type CostCheck } from './actionCosts';
import { pushEvent } from './events';
import {
  EXPOSED_LABEL,
  applyExposed,
  consumeExposedOnDamage,
  exposedDamageMultiplier,
} from './exposed';
import { addNoise } from './info';
import {
  armorDefenseOf,
  destroyEquippedWeapon,
  getEquippedWeapon,
  weaponAttackOf,
} from './inventory';
import { consumeAdrenalineCharge, ADRENALINE_ID } from './skills';
import { awardAttackExperience } from './progression';
import { selfDamageTakenMultiplier } from './statusIds';
import { applyDamage } from './vitals';
import { worldModifiersAt } from './worldEvents';
import type { SeededRandom } from './random';
import type { AttackStyle, Combatant, GameState } from './types';

// 生命/死亡结算已统一收敛到 vitals.ts；这里重新导出，保持既有调用方不变。
export { applyDamage, applyHealing, applyHpChange, killCharacter } from './vitals';
export type { DamageResult, HpChangeResult } from './vitals';

/* ------------------------------------------------------------------ */
/* 命中与伤害                                                          */
/* ------------------------------------------------------------------ */

/**
 * 命中率 = 基础命中
 *        + 攻击方感知 × 0.012
 *        + (攻击方速度 - 防御方速度) × 0.02
 *        + 远程武器加成
 * 结果被夹在 [minHitChance, maxHitChance] 之间。
 */
export function hitChanceOf(
  attacker: Combatant,
  defender: Combatant,
  style: AttackStyle = 'normal',
): number {
  const weapon = getEquippedWeapon(attacker);
  const rangedBonus =
    weapon && getItem(weapon.itemId).weaponType === 'ranged'
      ? GAME_CONFIG.rangedHitBonus
      : 0;

  const raw =
    GAME_CONFIG.baseHitChance +
    attacker.perception * 0.012 +
    (attacker.speed - defender.speed) * 0.02 +
    rangedBonus;

  // 战斗风格影响命中：速攻更易命中、重击更易落空
  const adjusted = raw * GAME_CONFIG.attackStyleHitMult[style];

  // 状态效果：攻击方增益与防御方闪避（Phase 3 Step 3）
  let chance = adjusted;
  for (const e of attacker.statusEffects) {
    if (e.hitChanceMult) chance *= e.hitChanceMult;
  }
  for (const e of defender.statusEffects) {
    if (e.evasionHitMult) chance *= e.evasionHitMult;
  }

  return Math.min(
    GAME_CONFIG.maxHitChance,
    Math.max(GAME_CONFIG.minHitChance, chance),
  );
}

/**
 * 带世界事件修正的命中率（Phase 3A-1）。
 *
 * **这是 UI 与 core 唯一共用的命中率入口。**
 * 不变量「UI 显示的命中率 === core 实际掷骰用的概率」由此保证：
 * `resolveAttack` 掷骰用它、`EncounterPanel` / `DebugPanel` 显示也用它。
 * 直接调用 {@link hitChanceOf} 只会得到**不含天气修正**的裸概率，
 * 除单元测试外不应在任何判定或展示路径中使用。
 *
 * 修正口径：连绵阴雨只影响**远程武器**命中（×0.9），近战与逃跑不受影响；
 * 停电不再影响战斗命中。
 */
export function hitChanceIn(
  state: GameState,
  attacker: Combatant,
  defender: Combatant,
  style: AttackStyle = 'normal',
): number {
  const base = hitChanceOf(attacker, defender, style);
  const mods = worldModifiersAt(state, attacker.currentZoneId);
  const weapon = getEquippedWeapon(attacker);
  const isRanged = Boolean(
    weapon && getItem(weapon.itemId).weaponType === 'ranged',
  );
  const mult = isRanged ? mods.rangedHitMultiplier : 1;
  return Math.min(
    GAME_CONFIG.maxHitChance,
    Math.max(GAME_CONFIG.minHitChance, base * mult),
  );
}

/**
 * 伤害 = 攻击力 + 武器攻击 + [0,4] 随机 - 防御力 - 防具防御 (+ 搏击被动)
 * 再乘以战斗风格伤害倍率，最低为 1，保证任何一次命中都会推进战斗。
 */
export function computeDamage(
  attacker: Combatant,
  defender: Combatant,
  rng: SeededRandom,
  style: AttackStyle = 'normal',
): number {
  const weapon = getEquippedWeapon(attacker);
  const isMelee = !weapon || getItem(weapon.itemId).weaponType === 'melee';

  let damage =
    attacker.attack +
    weaponAttackOf(attacker) +
    rng.int(0, GAME_CONFIG.damageRandomMax) -
    defender.defense -
    armorDefenseOf(defender);

  // 斗士被动：近战额外伤害
  if (attacker.passiveId === 'brawler' && isMelee) {
    damage += GAME_CONFIG.brawlerMeleeBonus;
  }

  // 战斗风格伤害倍率（重击明显更痛、速攻偏轻）
  damage *= GAME_CONFIG.attackStyleDamageMult[style];

  // 状态效果：攻击方伤害增益与防御方额外防御（Phase 3 Step 3）
  for (const e of attacker.statusEffects) {
    if (e.damageMult) damage *= e.damageMult;
  }
  for (const e of defender.statusEffects) {
    if (e.defenseBonus) damage -= e.defenseBonus;
  }

  return Math.max(GAME_CONFIG.minDamage, Math.round(damage));
}

/* ------------------------------------------------------------------ */
/* 攻击                                                                */
/* ------------------------------------------------------------------ */

/** 攻击风格的展示名（Phase 3 Step 1） */
export const ATTACK_STYLE_LABEL: Record<AttackStyle, string> = {
  quick: '速攻',
  normal: '普通',
  heavy: '重击',
};

/** 攻击前置校验：存活 + 风格对应的体力。反击、偷袭同样必须先过这一关。 */
export function canAttack(actor: Combatant, style: AttackStyle = 'normal'): CostCheck {
  const cost = GAME_CONFIG.attackStyleStaminaCost[style];
  if (!actor.alive) {
    return { ok: false, reason: '已经死亡的角色无法行动。', cost };
  }
  if (actor.stamina < cost) {
    return {
      ok: false,
      reason: `体力不足：攻击（${ATTACK_STYLE_LABEL[style]}）需要 ${cost} 点，当前只有 ${Math.floor(actor.stamina)} 点。请先休息或使用恢复品。`,
      cost,
    };
  }
  return { ok: true, reason: null, cost };
}

export interface AttackResult {
  hit: boolean;
  damage: number;
  targetDied: boolean;
  weaponBroke: boolean;
  message: string;
}

/** 单次攻击结算（不含反击） */
export function resolveAttack(
  state: GameState,
  attacker: Combatant,
  defender: Combatant,
  rng: SeededRandom,
  style: AttackStyle = 'normal',
): AttackResult {
  attacker.stats.attacks += 1;
  state.stats.attacks += 1;
  // Phase 3A：体力成本走 attackStaminaCostFor，肾上腺素的折扣才会真的落地，
  // 且与 UI / legalActions 读的是同一个函数（不重蹈 BUG-01 的覆辙）。
  const staminaSpent = spendStamina(attacker, attackStaminaCostFor(attacker, style));
  // Phase 3A-1 统计：记录本次攻击是否处于肾上腺素状态（供模拟指标）
  const adrenalineActive = attacker.statusEffects.some(
    (e) => e.id === ADRENALINE_ID,
  );
  const rangedAttack = Boolean(
    getEquippedWeapon(attacker) &&
      getItem(getEquippedWeapon(attacker)!.itemId).weaponType === 'ranged',
  );
  // 肾上腺素按「攻击次数」计费：无论命中与否，这一拳都算用掉一次
  consumeAdrenalineCharge(state, attacker);
  // 出手即解除自身防御姿态（防御只能挡下一次攻击）
  attacker.guarding = false;

  const zone = state.zones[attacker.currentZoneId];
  if (zone) zone.lastCombatTime = state.time;
  addNoise(state, attacker.currentZoneId, 'combat');

  if (!attacker.knownEnemies.includes(defender.id)) {
    attacker.knownEnemies.push(defender.id);
  }
  if (!defender.knownEnemies.includes(attacker.id)) {
    defender.knownEnemies.push(attacker.id);
  }

  // Phase 3A BUG-01：这里过去漏传了 style，导致 UI 显示的是带风格的概率、
  // 而核心实际按 'normal' 掷骰 —— 三种风格的命中差异在真实战斗中完全不存在。
  // style 必须传入，UI 概率与核心概率才是同一个数。
  const chance = hitChanceIn(state, attacker, defender, style);
  const hit = rng.chance(chance);
  /** 写进事件 metadata 的命中率百分数：UI 与模拟统计都以此为准，必须与掷骰同源 */
  const chancePct = Math.round(chance * 100);

  // 武器耐久：无论命中与否都会磨损（Phase 3A-1：研究异常不再增加额外损耗）
  let weaponBroke = false;
  const weapon = getEquippedWeapon(attacker);
  if (weapon && typeof weapon.durability === 'number') {
    weapon.durability -= 1;
    if (weapon.durability <= 0) {
      destroyEquippedWeapon(attacker);
      weaponBroke = true;
    }
  }

  if (!hit) {
    // Phase 3A：重击挥空 = 把破绽卖给对手。这是 heavy 高伤的代价，
    // 只有 heavy 会触发，quick / normal 落空不产生任何额外风险。
    const exposedApplied = style === 'heavy' ? applyExposed(state, attacker) : false;
    const msg =
      `${attacker.name} 攻击 ${defender.name}，被闪开了。` +
      (exposedApplied ? `（重击落空，${EXPOSED_LABEL}）` : '');
    pushEvent(state, {
      type: 'ATTACK_MISSED',
      actorId: attacker.id,
      targetId: defender.id,
      zoneId: attacker.currentZoneId,
      message: msg,
      metadata: {
        style,
        chance: chancePct,
        exposed: exposedApplied,
        // Phase 3A-1 统计
        adrenalineActive,
        staminaSaved: adrenalineActive ? 1 : 0,
        ranged: rangedAttack,
      },
    });
    awardAttackExperience(attacker, defender, false, staminaSpent);
    return { hit: false, damage: 0, targetDied: false, weaponBroke, message: msg };
  }

  let damage = computeDamage(attacker, defender, rng, style);
  const baseDamage = damage;

  // Phase 3A-1 统计：肾上腺素带来的伤害加成（damage 已含 ×1.2，反推加成量）
  const adrenalineBonus = adrenalineActive
    ? Math.max(
        0,
        damage -
          Math.max(GAME_CONFIG.minDamage, Math.round(damage / GAME_CONFIG.skillAdrenalineDamageMult)),
      )
    : 0;

  // 防御姿态：减免本次伤害后解除
  let guarded = false;
  let guardPrevented = 0;
  if (defender.guarding) {
    guarded = true;
    const reduced = Math.max(
      GAME_CONFIG.minDamage,
      Math.round(damage * (1 - GAME_CONFIG.guardDamageReduction)),
    );
    guardPrevented = damage - reduced;
    damage = reduced;
    defender.guarding = false;
  }

  // Phase 3A：EXPOSED 只在这里生效 —— 也就是「攻击类战斗伤害」这一条路径上。
  // 禁区侵蚀 / 世界事件 / 持续伤害 / 终局衰竭都直接走 applyDamage，不经过此处，
  // 因此天然吃不到这 20%，符合设计红线。
  const exposedMult = exposedDamageMultiplier(defender);
  let exposedBonus = 0;
  if (exposedMult !== 1) {
    const boosted = Math.max(GAME_CONFIG.minDamage, Math.round(damage * exposedMult));
    exposedBonus = boosted - damage;
    damage = boosted;
  }

  // Phase 3A：肾上腺素的代价。斗士为了省体力换来的是「这段时间自己更脆」，
  // 和 EXPOSED 一样只作用在攻击类战斗伤害上（禁区 / 世界事件不吃这一刀）。
  const frenzyMult = selfDamageTakenMultiplier(defender);
  let frenzyBonus = 0;
  if (frenzyMult !== 1) {
    const boosted = Math.max(GAME_CONFIG.minDamage, Math.round(damage * frenzyMult));
    frenzyBonus = boosted - damage;
    damage = boosted;
  }

  attacker.stats.damageDealt += damage;
  const res = applyDamage(state, defender, damage, attacker.id, '战斗');

  // 条件A：受到成功的战斗伤害后，破绽立刻被兑现掉
  const exposedConsumed = res.damage > 0 && consumeExposedOnDamage(state, defender);

  const msg =
    `${attacker.name} 命中 ${defender.name}，造成 ${damage} 点伤害` +
    (guarded ? '（防御姿态减免）' : '') +
    (exposedBonus > 0 ? `（击中破绽 +${exposedBonus}）` : '') +
    '。';
  pushEvent(state, {
    type: 'ATTACK_HIT',
    actorId: attacker.id,
    targetId: defender.id,
    zoneId: attacker.currentZoneId,
    message: msg,
    metadata: {
      style,
      chance: chancePct,
      damage,
      baseDamage,
      remainingHp: defender.hp,
      guarded,
      guardPrevented,
      exposedBonus,
      exposedConsumed,
      frenzyBonus,
      // Phase 3A-1 统计
      adrenalineActive,
      adrenalineBonus,
      staminaSaved: adrenalineActive ? 1 : 0,
      ranged: rangedAttack,
    },
  });

  if (weaponBroke) {
    pushEvent(state, {
      type: 'ITEM_DROPPED',
      actorId: attacker.id,
      zoneId: attacker.currentZoneId,
      message: `${attacker.name} 的武器损坏了。`,
      metadata: { broke: true },
    });
  }

  awardAttackExperience(attacker, defender, res.died, staminaSpent);

  return {
    hit: true,
    damage,
    targetDied: res.died,
    weaponBroke,
    message: msg,
  };
}

/**
 * 反击判定：玩家攻击后目标若存活，有概率立即反击。
 * 激进人格更爱反击，谨慎人格更少。
 */
export function counterChanceOf(
  defender: Combatant,
  attacker: Combatant,
  incomingStyle: AttackStyle = 'normal',
): number {
  let p =
    GAME_CONFIG.baseCounterChance + (defender.speed - attacker.speed) * 0.02;
  if (defender.personality === 'aggressive') p += 0.2;
  if (defender.personality === 'cautious') p -= 0.1;
  if (defender.hp / defender.maxHp < 0.3) p -= 0.15;
  // 重击破绽更大，被反击的概率更高；速攻更灵活，更易脱身
  p *= GAME_CONFIG.attackStyleCounterVuln[incomingStyle];
  return Math.min(0.75, Math.max(0.05, p));
}

/* ------------------------------------------------------------------ */
/* 逃跑                                                                */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* 逃离 / 战力评估（已拆分至 flee.ts，这里原样再导出保持对外契约）      */
/* ------------------------------------------------------------------ */

export {
  attemptFlee,
  estimatePower,
  fleeChanceIn,
  fleeChanceOf,
  fleeDestinations,
  type FleeResult,
} from './flee';
