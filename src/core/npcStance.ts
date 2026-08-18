import { GAME_CONFIG } from '../data/gameConfig';
import { getZoneDef } from '../data/zones';
import { estimatePower } from './combat';
import { strategicZonePreference } from './npcStrategicIntent';
import type { AttackStyle, Combatant, GameState, Personality } from './types';
import type { SeededRandom } from './random';

/**
 * Phase 4T extraction: combat stance, target / move / evacuation selection and
 * the public-zone projections were moved out of `npcDecide.ts` to keep that
 * file under the 500-line red-line. All callers in `npcDecide.ts` import
 * these helpers unchanged.
 */

interface CombatStance {
  /** 我方战力至少要达到对方的多少倍才愿意开打 */
  powerRatioToFight: number;
  /** 生命比例低于该值时优先避战 */
  avoidBelowHpRatio: number;
  /** 额外的主动攻击倾向 */
  aggressionBonus: number;
}

const STANCES: Record<Personality, CombatStance> = {
  aggressive: { powerRatioToFight: 0.7, avoidBelowHpRatio: 0.33, aggressionBonus: 0.12 },
  cautious: { powerRatioToFight: 1.15, avoidBelowHpRatio: GAME_CONFIG.cautiousAvoidHpRatio, aggressionBonus: -0.2 },
  collector: { powerRatioToFight: 1.3, avoidBelowHpRatio: 0.45, aggressionBonus: -0.1 },
  opportunist: { powerRatioToFight: 1.05, avoidBelowHpRatio: 0.35, aggressionBonus: 0.05 },
  random: { powerRatioToFight: 1.0, avoidBelowHpRatio: 0.25, aggressionBonus: 0 },
};

export function stanceFor(personality: Personality): CombatStance {
  return STANCES[personality];
}

/** NPC 可见的近期战斗区域（最近 8 个时间单位内的击杀播报）。 */
export function publiclyKnownCombatZones(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const e of state.events) {
    if (e.type !== 'CHARACTER_DIED') continue;
    if (state.time - e.time > 8) continue;
    if (e.zoneId) out.add(e.zoneId);
  }
  return out;
}

/** 已被广播「搜空」的区域（全场播报事件）。 */
export function publiclyExhaustedZones(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const e of state.events) {
    if (e.type === 'ZONE_EXHAUSTED' && e.zoneId) out.add(e.zoneId);
  }
  return out;
}

export function chooseTarget(
  npc: Combatant,
  enemies: Combatant[],
  rng: SeededRandom,
): Combatant | null {
  if (enemies.length === 0) return null;
  switch (npc.personality) {
    case 'opportunist':
    case 'aggressive':
      return enemies.reduce((best, cur) =>
        cur.hp / cur.maxHp < best.hp / best.maxHp ? cur : best,
      );
    case 'cautious':
    case 'collector':
      return enemies.reduce((best, cur) =>
        estimatePower(cur) < estimatePower(best) ? cur : best,
      );
    case 'random':
    default:
      return rng.pick(enemies);
  }
}

export function chooseAttackStyle(
  npc: Combatant,
  target: Combatant,
  rng: SeededRandom,
): AttackStyle {
  const myPower = estimatePower(npc);
  const theirPower = estimatePower(target);
  const powerOk = myPower >= theirPower * 0.8;
  const lowStamina = npc.stamina < GAME_CONFIG.attackStyleStaminaCost.heavy + 1;
  switch (npc.personality) {
    case 'aggressive':
      return powerOk && !lowStamina ? 'heavy' : 'normal';
    case 'cautious':
      return npc.stamina < GAME_CONFIG.attackStyleStaminaCost.normal + 1
        ? 'quick'
        : 'normal';
    case 'collector':
      return lowStamina ? 'quick' : 'normal';
    case 'opportunist':
      return target.hp / target.maxHp < 0.4 && powerOk && !lowStamina
        ? 'heavy'
        : 'normal';
    case 'random':
    default:
      return rng.pick<AttackStyle>(['quick', 'normal', 'heavy']) ?? 'normal';
  }
}

export function chooseMoveTarget(
  state: GameState,
  npc: Combatant,
  rng: SeededRandom,
): string | null {
  const adjacent = getZoneDef(npc.currentZoneId).adjacent;
  const combatZones = publiclyKnownCombatZones(state);
  const exhausted = publiclyExhaustedZones(state);

  const entries = adjacent.map((zoneId) => {
    const status = state.zones[zoneId]?.status ?? 'safe';
    let weight = status === 'safe' ? 10 : status === 'warning' ? 2 : 0.2;

    const hasCombat = combatZones.has(zoneId);
    if (hasCombat) {
      if (npc.personality === 'opportunist') weight *= 2.5;
      else if (npc.personality === 'aggressive') weight *= 1.8;
      else if (npc.personality === 'cautious') weight *= 0.35;
    }
    if (exhausted.has(zoneId)) {
      weight *= npc.personality === 'collector' ? 0.15 : 0.4;
    }
    if (npc.planRecommendedZoneId === zoneId && status !== 'restricted') {
      weight *= 5;
    }
    weight *= strategicZonePreference(npc, zoneId);
    if (npc.personality === 'random') weight += 4;
    return { value: zoneId, weight };
  });

  return rng.pickWeighted(entries);
}

export function chooseEvacuationTarget(
  state: GameState,
  npc: Combatant,
  rng: SeededRandom,
): string | null {
  const adjacent = getZoneDef(npc.currentZoneId).adjacent;
  const safe = adjacent.filter((id) => state.zones[id]?.status === 'safe');
  if (safe.length > 0) return rng.pick(safe);
  const warning = adjacent.filter((id) => state.zones[id]?.status === 'warning');
  if (warning.length > 0) return rng.pick(warning);
  return rng.pick(adjacent);
}
