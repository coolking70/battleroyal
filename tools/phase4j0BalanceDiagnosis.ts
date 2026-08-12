/**
 * Phase 4J-0：平衡诊断（只测量，不调整）。
 *
 * 该工具只调用 autoPlayer 的正式命令通道，并从完整事件流与最终状态
 * 重建诊断指标；不写入任何生产状态，也不改变 core/data/UI。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { CHARACTERS } from '../src/data/characters';
import { GAME_CONFIG } from '../src/data/gameConfig';
import { ITEMS } from '../src/data/items';
import { craftExperienceFor } from '../src/core/progression';
import {
  AUTO_PLAYER_POLICIES,
  runAutoGame,
  type AutoGameOutcome,
  type AutoGameResult,
  type AutoPlayerPolicy,
} from './autoPlayer';

const SEED_COUNT = positiveInt(process.env.PHASE4J0_SEED_COUNT, 20);
const SEED_PREFIX = process.env.PHASE4J0_SEED_PREFIX ?? 'PHASE4J0';
const OUTPUT = resolve(
  process.cwd(),
  process.env.PHASE4J0_DIAGNOSIS_OUTPUT ?? 'reports/phase4j0-diagnosis.json',
);

const HIGH_TIER_WEAPONS = new Set([
  'field_spear',
  'steel_axe',
  'composite_bow',
  'insulated_pipe',
  'insulated_stun_rod',
]);
const WEAPON_IDS = new Set(ITEMS.filter((item) => item.category === 'weapon').map((item) => item.id));
const SECONDARY_SKILLS = new Set([
  'scout_smoke',
  'fighter_focus',
  'engineer_reinforce',
  'medic_regen',
]);
const COMBAT_COMMANDS = new Set(['ATTACK', 'ATTACK_NEARBY', 'GUARD', 'FLEE', 'USE_SKILL']);

type DeathBucket = 'battle' | 'zone_erosion' | 'exhaustion' | 'other';

interface SourcePotential {
  combatParticipation: number;
  killBonus: number;
  craft: number;
  exploration: number;
  total: number;
}

interface ActionCounts {
  search: number;
  move: number;
  craft: number;
  rest: number;
  combat: number;
  otherTimeAdvancing: number;
  timeAdvancingTotal: number;
}

interface GameObservation {
  seed: string;
  characterId: string;
  policy: AutoPlayerPolicy;
  outcome: AutoGameOutcome;
  endReason: string | null;
  trustworthy: boolean;
  hardLimitReached: boolean;
  stalled: boolean;
  deadlock: boolean;
  illegalCommandCount: number;
  timeUsed: number;
  playerDied: boolean;
  deathCause: string | null;
  deathBucket: DeathBucket | null;
  encounters: number;
  attackSettlements: number;
  playerKills: number;
  damageTaken: number;
  finalLevel: number;
  finalExp: number;
  cumulativeExp: number;
  expSourcePotential: SourcePotential;
  secondarySkillUnlocked: boolean;
  secondarySkillUses: number;
  secondarySkillUseById: Record<string, number>;
  weaponObtained: boolean;
  weaponEquipped: boolean;
  weaponEquippedBeforeEncounter: boolean;
  encounterAfterWeaponEquipped: boolean;
  highTierWeaponCrafted: boolean;
  highTierWeaponIds: string[];
  actionCounts: ActionCounts;
  commandCounts: Record<string, number>;
}

interface AggregateStats {
  games: number;
  healthyGames: number;
  wins: number;
  draws: number;
  losses: number;
  timeouts: number;
  deaths: number;
  deathCauses: Record<string, number>;
  deathBuckets: Record<DeathBucket, number>;
  encounters: number;
  attackSettlements: number;
  kills: number;
  damageTaken: number;
  duration: number;
  levels: Record<string, number>;
  cumulativeExp: number;
  sourcePotential: SourcePotential;
  secondaryUnlockedGames: number;
  secondaryUses: number;
  secondaryUseGames: number;
  secondaryUseById: Record<string, number>;
  weaponObtainedGames: number;
  weaponEquippedGames: number;
  encounterAfterWeaponEquippedGames: number;
  highTierWeaponGames: number;
  highTierWeaponIds: Record<string, number>;
  actions: ActionCounts;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function emptySourcePotential(): SourcePotential {
  return { combatParticipation: 0, killBonus: 0, craft: 0, exploration: 0, total: 0 };
}

function emptyActions(): ActionCounts {
  return {
    search: 0,
    move: 0,
    craft: 0,
    rest: 0,
    combat: 0,
    otherTimeAdvancing: 0,
    timeAdvancingTotal: 0,
  };
}

function emptyAggregate(): AggregateStats {
  return {
    games: 0,
    healthyGames: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    timeouts: 0,
    deaths: 0,
    deathCauses: {},
    deathBuckets: { battle: 0, zone_erosion: 0, exhaustion: 0, other: 0 },
    encounters: 0,
    attackSettlements: 0,
    kills: 0,
    damageTaken: 0,
    duration: 0,
    levels: {},
    cumulativeExp: 0,
    sourcePotential: emptySourcePotential(),
    secondaryUnlockedGames: 0,
    secondaryUses: 0,
    secondaryUseGames: 0,
    secondaryUseById: {},
    weaponObtainedGames: 0,
    weaponEquippedGames: 0,
    encounterAfterWeaponEquippedGames: 0,
    highTierWeaponGames: 0,
    highTierWeaponIds: {},
    actions: emptyActions(),
  };
}

function bump(map: Record<string, number>, key: string, amount = 1): void {
  map[key] = (map[key] ?? 0) + amount;
}

function deathBucket(cause: string | null): DeathBucket | null {
  if (!cause) return null;
  if (cause === '战斗') return 'battle';
  if (cause === '禁区侵蚀') return 'zone_erosion';
  if (cause === '衰竭') return 'exhaustion';
  return 'other';
}

function cumulativeExperience(level: number, exp: number): number {
  let total = Math.max(0, exp);
  for (let current = 1; current < level; current += 1) {
    total += GAME_CONFIG.levelExpThresholds[current - 1] ?? 0;
  }
  return total;
}

function playerItemId(event: NonNullable<AutoGameResult['eventTrace']>[number]): string | null {
  const itemId = event.metadata?.itemId ?? event.metadata?.outputItemId;
  return typeof itemId === 'string' ? itemId : null;
}

function actionCounts(result: AutoGameResult): ActionCounts {
  const counts = result.commandCounts;
  const actions = emptyActions();
  actions.search = counts.SEARCH ?? 0;
  actions.move = counts.MOVE ?? 0;
  actions.craft = counts.CRAFT ?? 0;
  actions.rest = counts.REST ?? 0;
  for (const command of COMBAT_COMMANDS) actions.combat += counts[command] ?? 0;
  actions.timeAdvancingTotal = result.timeAdvancingSteps;
  const named = actions.search + actions.move + actions.craft + actions.rest + actions.combat;
  actions.otherTimeAdvancing = Math.max(0, actions.timeAdvancingTotal - named);
  return actions;
}

function sourcePotential(result: AutoGameResult, playerId: string): SourcePotential {
  const trace = result.eventTrace ?? [];
  const combatSettlements = trace.filter(
    (event) =>
      (event.type === 'ATTACK_HIT' || event.type === 'ATTACK_MISSED') &&
      (event.actorId === playerId || event.targetId === playerId),
  ).length;
  const craft = trace
    .filter((event) => event.type === 'ITEM_CRAFTED' && event.actorId === playerId)
    .reduce((sum, event) => {
      const itemId = event.metadata?.outputItemId;
      return sum + (typeof itemId === 'string' ? craftExperienceFor(itemId) : 0);
    }, 0);
  const exploration =
    (result.commandCounts.SEARCH ?? 0) * GAME_CONFIG.expSearch +
    (result.commandCounts.MOVE ?? 0) * GAME_CONFIG.expExplore;
  const source = {
    combatParticipation: combatSettlements * GAME_CONFIG.expCombatParticipation,
    killBonus: result.playerKills * GAME_CONFIG.expKillBonus,
    craft,
    exploration,
    total: 0,
  };
  source.total = source.combatParticipation + source.killBonus + source.craft + source.exploration;
  return source;
}

function observe(result: AutoGameResult): GameObservation {
  const trace = result.eventTrace ?? [];
  const playerId = result.finalState?.playerId ?? '';
  const player = result.finalState?.characters[playerId];
  const playerEvents = trace.filter((event) => event.actorId === playerId);
  const encounterTimes = trace
    .filter((event) => event.type === 'ENCOUNTER_STARTED' && event.actorId === playerId)
    .map((event) => event.time);
  const weaponEvents = playerEvents.filter((event) => {
    const itemId = playerItemId(event);
    return (
      (event.type === 'ITEM_FOUND' ||
        event.type === 'ITEM_PICKED' ||
        event.type === 'ITEM_CRAFTED') &&
      itemId !== null &&
      WEAPON_IDS.has(itemId)
    );
  });
  const equipEvents = playerEvents.filter(
    (event) => event.type === 'ITEM_EQUIPPED' && event.metadata?.slot === 'weapon',
  );
  const highTierWeaponIds = [...new Set(
    playerEvents
      .filter((event) => event.type === 'ITEM_CRAFTED')
      .map(playerItemId)
      .filter((itemId): itemId is string => itemId !== null && HIGH_TIER_WEAPONS.has(itemId)),
  )];
  const firstEquipTime = equipEvents[0]?.time;
  const attackSettlements = trace.filter(
    (event) =>
      (event.type === 'ATTACK_HIT' || event.type === 'ATTACK_MISSED') &&
      (event.actorId === playerId || event.targetId === playerId),
  ).length;
  const skills: Record<string, number> = {};
  for (const event of playerEvents) {
    if (event.type !== 'SKILL_USED') continue;
    const skillId = event.metadata?.skillId;
    if (typeof skillId === 'string' && SECONDARY_SKILLS.has(skillId)) bump(skills, skillId);
  }
  const level = player?.level ?? 1;
  const exp = player?.exp ?? 0;
  const secondaryUnlocked = level >= GAME_CONFIG.skillSecondaryUnlockLevel;
  const actions = actionCounts(result);
  const deathCause = result.playerDeathSnapshot?.cause ?? null;
  const equippedBeforeEncounter = firstEquipTime !== undefined &&
    (encounterTimes.length === 0 || firstEquipTime <= Math.min(...encounterTimes));
  const encounterAfterEquip = firstEquipTime !== undefined &&
    encounterTimes.some((time) => time > firstEquipTime);

  return {
    seed: result.seed,
    characterId: result.characterId,
    policy: result.policy,
    outcome: result.outcome,
    endReason: result.endReason,
    trustworthy: result.trustworthy,
    hardLimitReached: result.hardLimitReached,
    stalled: result.stalled,
    deadlock: result.deadlock !== null,
    illegalCommandCount: result.illegalCommands.length,
    timeUsed: result.timeUsed,
    playerDied: !result.survived,
    deathCause,
    deathBucket: deathBucket(deathCause),
    encounters: encounterTimes.length,
    attackSettlements,
    playerKills: result.playerKills,
    damageTaken: result.damageTaken,
    finalLevel: level,
    finalExp: exp,
    cumulativeExp: cumulativeExperience(level, exp),
    expSourcePotential: sourcePotential(result, playerId),
    secondarySkillUnlocked: secondaryUnlocked,
    secondarySkillUses: Object.values(skills).reduce((sum, count) => sum + count, 0),
    secondarySkillUseById: skills,
    weaponObtained: weaponEvents.length > 0,
    weaponEquipped: equipEvents.length > 0,
    weaponEquippedBeforeEncounter: equipEvents.length > 0 && equippedBeforeEncounter,
    encounterAfterWeaponEquipped: encounterAfterEquip,
    highTierWeaponCrafted: highTierWeaponIds.length > 0,
    highTierWeaponIds,
    actionCounts: actions,
    commandCounts: result.commandCounts,
  };
}

function addObservation(aggregate: AggregateStats, observation: GameObservation): void {
  aggregate.games += 1;
  if (observation.trustworthy && !observation.hardLimitReached) aggregate.healthyGames += 1;
  if (observation.outcome === 'won') aggregate.wins += 1;
  else if (observation.outcome === 'draw') aggregate.draws += 1;
  else if (observation.outcome === 'timeout') aggregate.timeouts += 1;
  else aggregate.losses += 1;
  if (observation.playerDied) {
    aggregate.deaths += 1;
    if (observation.deathCause) bump(aggregate.deathCauses, observation.deathCause);
    if (observation.deathBucket) aggregate.deathBuckets[observation.deathBucket] += 1;
  }
  aggregate.encounters += observation.encounters;
  aggregate.attackSettlements += observation.attackSettlements;
  aggregate.kills += observation.playerKills;
  aggregate.damageTaken += observation.damageTaken;
  aggregate.duration += observation.timeUsed;
  bump(aggregate.levels, String(observation.finalLevel));
  aggregate.cumulativeExp += observation.cumulativeExp;
  for (const key of Object.keys(aggregate.sourcePotential) as (keyof SourcePotential)[]) {
    aggregate.sourcePotential[key] += observation.expSourcePotential[key];
  }
  if (observation.secondarySkillUnlocked) aggregate.secondaryUnlockedGames += 1;
  aggregate.secondaryUses += observation.secondarySkillUses;
  if (observation.secondarySkillUses > 0) aggregate.secondaryUseGames += 1;
  for (const [skillId, count] of Object.entries(observation.secondarySkillUseById)) {
    bump(aggregate.secondaryUseById, skillId, count);
  }
  if (observation.weaponObtained) aggregate.weaponObtainedGames += 1;
  if (observation.weaponEquipped) aggregate.weaponEquippedGames += 1;
  if (observation.encounterAfterWeaponEquipped) aggregate.encounterAfterWeaponEquippedGames += 1;
  if (observation.highTierWeaponCrafted) aggregate.highTierWeaponGames += 1;
  for (const itemId of observation.highTierWeaponIds) bump(aggregate.highTierWeaponIds, itemId);
  for (const key of Object.keys(aggregate.actions) as (keyof ActionCounts)[]) {
    aggregate.actions[key] += observation.actionCounts[key];
  }
}

function summary(aggregate: AggregateStats): Record<string, unknown> {
  const rate = (value: number): number => (aggregate.games > 0 ? value / aggregate.games : 0);
  const sourceShares = Object.fromEntries(
    Object.entries(aggregate.sourcePotential)
      .filter(([key]) => key !== 'total')
      .map(([key, value]) => [key, aggregate.sourcePotential.total > 0 ? value / aggregate.sourcePotential.total : 0]),
  );
  return {
    games: aggregate.games,
    healthyGames: aggregate.healthyGames,
    healthyRate: rate(aggregate.healthyGames),
    outcomes: {
      wins: aggregate.wins,
      winRate: rate(aggregate.wins),
      draws: aggregate.draws,
      drawRate: rate(aggregate.draws),
      losses: aggregate.losses,
      lossRate: rate(aggregate.losses),
      timeouts: aggregate.timeouts,
      timeoutRate: rate(aggregate.timeouts),
    },
    deaths: {
      total: aggregate.deaths,
      rateAmongGames: rate(aggregate.deaths),
      rateAmongDeaths: Object.fromEntries(
        Object.entries(aggregate.deathBuckets).map(([key, value]) => [key, aggregate.deaths > 0 ? value / aggregate.deaths : 0]),
      ),
      buckets: aggregate.deathBuckets,
      rawCauses: aggregate.deathCauses,
    },
    combat: {
      averageEncounters: rate(aggregate.encounters),
      averageAttackSettlements: rate(aggregate.attackSettlements),
      averageKills: rate(aggregate.kills),
      averageDamageTaken: rate(aggregate.damageTaken),
      combatDeathsAmongGames: rate(aggregate.deathBuckets.battle),
      combatDeathsAmongDeaths: aggregate.deaths > 0 ? aggregate.deathBuckets.battle / aggregate.deaths : 0,
    },
    duration: { averageTimeUnits: rate(aggregate.duration) },
    growth: {
      finalLevelDistribution: aggregate.levels,
      finalLevelRate: Object.fromEntries(Object.entries(aggregate.levels).map(([key, value]) => [key, rate(value)])),
      averageCumulativeExp: rate(aggregate.cumulativeExp),
      expSourcePotential: aggregate.sourcePotential,
      expSourcePotentialShare: sourceShares,
      sourceAccountingNote: '核心当前不发出逐笔 EXP 来源事件；这里按公开玩家事件、命令计数与 GAME_CONFIG 重建封顶前来源量，累计经验来自最终持久化 level/exp。',
      secondarySkillUnlockedGames: aggregate.secondaryUnlockedGames,
      secondarySkillUnlockRate: rate(aggregate.secondaryUnlockedGames),
      secondarySkillUseGames: aggregate.secondaryUseGames,
      secondarySkillUses: aggregate.secondaryUses,
      secondarySkillUseById: aggregate.secondaryUseById,
    },
    equipment: {
      weaponObtainedGames: aggregate.weaponObtainedGames,
      weaponObtainedRate: rate(aggregate.weaponObtainedGames),
      weaponEquippedGames: aggregate.weaponEquippedGames,
      weaponEquippedRate: rate(aggregate.weaponEquippedGames),
      encounterAfterWeaponEquippedGames: aggregate.encounterAfterWeaponEquippedGames,
      encounterAfterWeaponEquippedRate: rate(aggregate.encounterAfterWeaponEquippedGames),
      highTierWeaponCraftedGames: aggregate.highTierWeaponGames,
      highTierWeaponCraftedRate: rate(aggregate.highTierWeaponGames),
      highTierWeaponIds: aggregate.highTierWeaponIds,
      historicalPhase4C7WeaponNotConverted: { notConverted: 8, routes: 20, rate: 0.4 },
    },
    timeEconomy: {
      actions: aggregate.actions,
      actionShareOfTimeAdvancingCommands: Object.fromEntries(
        (['search', 'move', 'craft', 'rest', 'combat', 'otherTimeAdvancing'] as const).map((key) => [
          key,
          aggregate.actions.timeAdvancingTotal > 0
            ? aggregate.actions[key] / aggregate.actions.timeAdvancingTotal
            : 0,
        ]),
      ),
      restTimeUnits: aggregate.actions.rest,
      restShare: aggregate.actions.timeAdvancingTotal > 0
        ? aggregate.actions.rest / aggregate.actions.timeAdvancingTotal
        : 0,
    },
  };
}

function main(): void {
  const observations: GameObservation[] = [];
  const overall = emptyAggregate();
  const byPolicy = new Map<AutoPlayerPolicy, AggregateStats>();
  const byCharacter = new Map<string, AggregateStats>();
  const byCell = new Map<string, AggregateStats>();

  for (let seedIndex = 0; seedIndex < SEED_COUNT; seedIndex += 1) {
    const character = CHARACTERS[seedIndex % CHARACTERS.length]!;
    for (const policy of AUTO_PLAYER_POLICIES) {
      const result = runAutoGame({
        seed: `${SEED_PREFIX}-${seedIndex}-${character.id}-${policy}`,
        characterId: character.id,
        policy,
        keepFinalState: true,
        keepEventTrace: true,
      });
      const observation = observe(result);
      observations.push(observation);
      addObservation(overall, observation);
      const policyAggregate = byPolicy.get(policy) ?? emptyAggregate();
      addObservation(policyAggregate, observation);
      byPolicy.set(policy, policyAggregate);
      const characterAggregate = byCharacter.get(character.id) ?? emptyAggregate();
      addObservation(characterAggregate, observation);
      byCharacter.set(character.id, characterAggregate);
      const cellKey = `${character.id}:${policy}`;
      const cellAggregate = byCell.get(cellKey) ?? emptyAggregate();
      addObservation(cellAggregate, observation);
      byCell.set(cellKey, cellAggregate);
    }
  }

  const report = {
    phase: 'Phase 4J-0',
    generatedAt: new Date().toISOString(),
    evidenceClass: 'AUTOMATED_DIAGNOSTIC_OBSERVATION',
    humanPlaytestStatus: 'NOT_PERFORMED',
    method: {
      seedGroups: SEED_COUNT,
      policies: [...AUTO_PLAYER_POLICIES],
      requestedRuns: SEED_COUNT * AUTO_PLAYER_POLICIES.length,
      actualRuns: observations.length,
      matrix: `${SEED_COUNT} seed groups × ${AUTO_PLAYER_POLICIES.length} policies; character rotates deterministically across ${CHARACTERS.length} characters`,
      source: 'tools/autoPlayer.ts via executeCommand; full eventTrace and finalState retained for measurement',
      noProductionChanges: true,
      policyLimitation: 'autoPlayer uses heuristic NPC-style decisions, does not read UI guidance, and does not deliberately optimize growth; outcomes are not human-playtest evidence.',
    },
    health: {
      requestedEqualsActual: observations.length === SEED_COUNT * AUTO_PLAYER_POLICIES.length,
      trustworthyGames: observations.filter((item) => item.trustworthy).length,
      noTimeoutDeadlockIllegalOrHardLimit: observations.every(
        (item) => item.trustworthy && !item.hardLimitReached && !item.stalled && !item.deadlock && item.illegalCommandCount === 0,
      ),
    },
    overall: summary(overall),
    byPolicy: Object.fromEntries([...byPolicy.entries()].map(([key, value]) => [key, summary(value)])),
    byCharacter: Object.fromEntries([...byCharacter.entries()].map(([key, value]) => [key, summary(value)])),
    byCell: Object.fromEntries([...byCell.entries()].map(([key, value]) => [key, summary(value)])),
    observations,
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[phase4j0] wrote ${OUTPUT} (${observations.length} games; trustworthy ${report.health.trustworthyGames})`);
}

main();
