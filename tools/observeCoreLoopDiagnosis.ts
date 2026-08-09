/**
 * Phase 4C-4：核心循环与经济诊断观察工具。
 *
 * 这是诊断/观察工具，不参与规则结算，也不作为胜率或角色平衡门禁。
 * 每局仍严格走 tools/autoPlayer.ts -> executeCommand 正式命令通道。
 *
 * 观察重点：
 * - 玩家首件武器的获得时间与来源；
 * - 制作目标设定、目标完成和中间部件漏斗；
 * - 高阶武器的玩家/全体完成率；
 * - 玩家死亡原因与死亡前装备；
 * - 零体力防御/逃跑与原地脱离的使用量；
 * - 每局健康性（请求/实际、timeout、deadlock、illegal、hard-limit）。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { CHARACTERS } from '../src/data/characters';
import { ITEMS } from '../src/data/items';
import {
  AUTO_PLAYER_POLICIES,
  runAutoGame,
  type AutoGameResult,
  type AutoPlayerPolicy,
} from './autoPlayer';

const SEED_COUNT = positiveInt(process.env.CORE_LOOP_SEED_COUNT, 20);
const SEED_PREFIX = process.env.CORE_LOOP_SEED_PREFIX ?? 'PHASE4C4-CORE';
const REPRESENTATIVE_BUILD_LOOP = process.env.CORE_LOOP_REPRESENTATIVE === '1';
const OUTPUT = resolve(
  process.cwd(),
  process.env.CORE_LOOP_DIAGNOSIS_OUTPUT ?? 'reports/phase4c4-core-loop-diagnosis.json',
);

const HIGH_TIER_WEAPONS = [
  'field_spear',
  'steel_axe',
  'composite_bow',
  'insulated_pipe',
  'insulated_stun_rod',
] as const;

const INTERMEDIATE_WEAPONS = [
  'stick',
  'stone_axe',
  'iron_pipe',
  'simple_bow',
  'stun_rod',
  'reinforced_handle',
] as const;

const WEAPON_IDS = new Set(
  ITEMS.filter((item) => item.category === 'weapon').map((item) => item.id),
);

type HighTierWeaponId = (typeof HIGH_TIER_WEAPONS)[number];
type WeaponSource = 'craft' | 'pickup';

interface FirstWeaponObservation {
  itemId: string;
  time: number;
  source: WeaponSource;
}

interface Bucket {
  games: number;
  healthyGames: number;
  firstWeaponGames: number;
  firstWeaponBySource: Record<WeaponSource, number>;
  firstWeaponTimes: number[];
  neverWeaponGames: number;
  goalSetGames: number;
  goalSetEvents: number;
  goalCompletedGames: number;
  goalCompletedEvents: number;
  intermediateGames: number;
  intermediateCraftEvents: number;
  highTierPlayerGames: number;
  highTierGames: Record<HighTierWeaponId, number>;
  highTierCraftEvents: Record<HighTierWeaponId, number>;
  playerEncounterGames: number;
  playerEncounterStarts: number;
  playerAttackEvents: number;
  playerGuardEvents: number;
  playerEscapeEvents: number;
  playerEquipEvents: number;
  playerEquipGames: number;
  playerWeaponEquipEvents: number;
  playerArmorEquipEvents: number;
  zeroStaminaGuardCommands: number;
  zeroStaminaFleeCommands: number;
  stationaryEscapeEvents: number;
  deathCauses: Record<string, number>;
  deathsWithWeapon: number;
  deathsWithArmor: number;
  deathsWithoutWeapon: number;
  deathsWithoutArmor: number;
  deathsWithCarriedWeapon: number;
  deathsWithCarriedArmor: number;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function newBucket(): Bucket {
  return {
    games: 0,
    healthyGames: 0,
    firstWeaponGames: 0,
    firstWeaponBySource: { craft: 0, pickup: 0 },
    firstWeaponTimes: [],
    neverWeaponGames: 0,
    goalSetGames: 0,
    goalSetEvents: 0,
    goalCompletedGames: 0,
    goalCompletedEvents: 0,
    intermediateGames: 0,
    intermediateCraftEvents: 0,
    highTierPlayerGames: 0,
    highTierGames: Object.fromEntries(
      HIGH_TIER_WEAPONS.map((itemId) => [itemId, 0]),
    ) as Record<HighTierWeaponId, number>,
    highTierCraftEvents: Object.fromEntries(
      HIGH_TIER_WEAPONS.map((itemId) => [itemId, 0]),
    ) as Record<HighTierWeaponId, number>,
    playerEncounterGames: 0,
    playerEncounterStarts: 0,
    playerAttackEvents: 0,
    playerGuardEvents: 0,
    playerEscapeEvents: 0,
    playerEquipEvents: 0,
    playerEquipGames: 0,
    playerWeaponEquipEvents: 0,
    playerArmorEquipEvents: 0,
    zeroStaminaGuardCommands: 0,
    zeroStaminaFleeCommands: 0,
    stationaryEscapeEvents: 0,
    deathCauses: {},
    deathsWithWeapon: 0,
    deathsWithArmor: 0,
    deathsWithoutWeapon: 0,
    deathsWithoutArmor: 0,
    deathsWithCarriedWeapon: 0,
    deathsWithCarriedArmor: 0,
  };
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function firstWeapon(result: AutoGameResult): FirstWeaponObservation | null {
  const playerId = result.finalState?.playerId;
  if (!playerId || !result.eventTrace) return null;

  const candidates: Array<FirstWeaponObservation & { order: number }> = [];
  result.eventTrace.forEach((event, order) => {
    if (event.actorId !== playerId) return;
    const itemId = event.metadata?.itemId ?? event.metadata?.outputItemId;
    if (typeof itemId !== 'string' || !WEAPON_IDS.has(itemId)) return;
    if (event.type === 'ITEM_CRAFTED') {
      candidates.push({ itemId, time: event.time, source: 'craft', order });
    } else if (event.type === 'ITEM_PICKED') {
      candidates.push({ itemId, time: event.time, source: 'pickup', order });
    }
  });

  candidates.sort((a, b) => a.time - b.time || a.order - b.order);
  const candidate = candidates[0];
  if (!candidate) return null;
  return { itemId: candidate.itemId, time: candidate.time, source: candidate.source };
}

function observeResult(bucket: Bucket, result: AutoGameResult): void {
  bucket.games += 1;
  if (result.trustworthy && !result.hardLimitReached) bucket.healthyGames += 1;

  const trace = result.eventTrace ?? [];
  const playerId = result.finalState?.playerId;
  const weapon = firstWeapon(result);
  if (weapon) {
    bucket.firstWeaponGames += 1;
    bucket.firstWeaponBySource[weapon.source] += 1;
    bucket.firstWeaponTimes.push(weapon.time);
  } else {
    bucket.neverWeaponGames += 1;
  }

  const playerGoalSet = trace.filter(
    (event) =>
      event.type === 'CRAFT_GOAL_SET' &&
      event.actorId === playerId &&
      event.metadata?.completed !== true,
  );
  const playerGoalCompleted = trace.filter(
    (event) =>
      event.type === 'CRAFT_GOAL_SET' &&
      event.actorId === playerId &&
      event.metadata?.completed === true,
  );
  bucket.goalSetEvents += playerGoalSet.length;
  bucket.goalCompletedEvents += playerGoalCompleted.length;
  if (playerGoalSet.length > 0) bucket.goalSetGames += 1;
  if (playerGoalCompleted.length > 0) bucket.goalCompletedGames += 1;

  const intermediateEvents = trace.filter(
    (event) =>
      event.type === 'ITEM_CRAFTED' &&
      event.actorId === playerId &&
      typeof event.metadata?.outputItemId === 'string' &&
      INTERMEDIATE_WEAPONS.includes(event.metadata.outputItemId as (typeof INTERMEDIATE_WEAPONS)[number]),
  );
  bucket.intermediateCraftEvents += intermediateEvents.length;
  if (intermediateEvents.length > 0) bucket.intermediateGames += 1;

  const highTierGames = new Set<HighTierWeaponId>();
  trace.forEach((event) => {
    if (event.type !== 'ITEM_CRAFTED') return;
    const itemId = event.metadata?.outputItemId;
    if (!HIGH_TIER_WEAPONS.includes(itemId as HighTierWeaponId)) return;
    const highTierId = itemId as HighTierWeaponId;
    bucket.highTierCraftEvents[highTierId] += 1;
    if (event.actorId === playerId) highTierGames.add(highTierId);
  });
  for (const itemId of highTierGames) bucket.highTierGames[itemId] += 1;
  if (highTierGames.size > 0) bucket.highTierPlayerGames += 1;

  const playerEncounters = trace.filter(
    (event) => event.type === 'ENCOUNTER_STARTED' && event.actorId === playerId,
  );
  bucket.playerEncounterStarts += playerEncounters.length;
  if (playerEncounters.length > 0) bucket.playerEncounterGames += 1;
  bucket.playerAttackEvents += trace.filter(
    (event) =>
      (event.type === 'ATTACK_HIT' || event.type === 'ATTACK_MISSED') &&
      event.actorId === playerId,
  ).length;
  bucket.playerGuardEvents += trace.filter(
    (event) => event.type === 'GUARD' && event.actorId === playerId,
  ).length;
  const playerEscapes = trace.filter(
    (event) => event.type === 'CHARACTER_ESCAPED' && event.actorId === playerId,
  );
  bucket.playerEscapeEvents += playerEscapes.length;
  bucket.stationaryEscapeEvents += playerEscapes.filter(
    (event) => event.metadata?.stationary === true,
  ).length;
  bucket.zeroStaminaGuardCommands += result.zeroStaminaGuardCommands;
  bucket.zeroStaminaFleeCommands += result.zeroStaminaFleeCommands;
  const playerEquips = trace.filter(
    (event) => event.type === 'ITEM_EQUIPPED' && event.actorId === playerId,
  );
  bucket.playerEquipEvents += playerEquips.length;
  if (playerEquips.length > 0) bucket.playerEquipGames += 1;
  for (const event of playerEquips) {
    const itemId = event.metadata?.itemId;
    const item = typeof itemId === 'string' ? ITEMS.find((candidate) => candidate.id === itemId) : undefined;
    if (item?.category === 'weapon') bucket.playerWeaponEquipEvents += 1;
    if (item?.category === 'armor') bucket.playerArmorEquipEvents += 1;
  }

  const death = result.playerDeathSnapshot;
  if (death) {
    bump(bucket.deathCauses, death.cause ?? 'unknown');
    if (death.equippedWeaponId) bucket.deathsWithWeapon += 1;
    else bucket.deathsWithoutWeapon += 1;
    if (death.equippedArmorId) bucket.deathsWithArmor += 1;
    else bucket.deathsWithoutArmor += 1;
    if (death.carriedWeaponIds.length > 0 || death.equippedWeaponId) {
      bucket.deathsWithCarriedWeapon += 1;
    }
    if (death.carriedArmorIds.length > 0 || death.equippedArmorId) {
      bucket.deathsWithCarriedArmor += 1;
    }
  }
}

function finalBucket(bucket: Bucket): Record<string, unknown> {
  const rate = (value: number): number => (bucket.games > 0 ? value / bucket.games : 0);
  return {
    games: bucket.games,
    healthyGames: bucket.healthyGames,
    healthyRate: rate(bucket.healthyGames),
    firstWeapon: {
      games: bucket.firstWeaponGames,
      rate: rate(bucket.firstWeaponGames),
      neverWeaponGames: bucket.neverWeaponGames,
      bySource: bucket.firstWeaponBySource,
      medianTime: median(bucket.firstWeaponTimes),
      averageTime:
        bucket.firstWeaponTimes.length > 0
          ? bucket.firstWeaponTimes.reduce((sum, value) => sum + value, 0) /
            bucket.firstWeaponTimes.length
          : null,
    },
    craftGoal: {
      setGames: bucket.goalSetGames,
      setRate: rate(bucket.goalSetGames),
      setEvents: bucket.goalSetEvents,
      completedGames: bucket.goalCompletedGames,
      completedRate: rate(bucket.goalCompletedGames),
      completedEvents: bucket.goalCompletedEvents,
    },
    intermediateCrafting: {
      games: bucket.intermediateGames,
      rate: rate(bucket.intermediateGames),
      craftEvents: bucket.intermediateCraftEvents,
    },
    highTierWeapons: Object.fromEntries(
      HIGH_TIER_WEAPONS.map((itemId) => [
        itemId,
        {
          name: ITEMS.find((item) => item.id === itemId)?.name ?? itemId,
          playerGames: bucket.highTierGames[itemId],
          playerRate: rate(bucket.highTierGames[itemId]),
          allActorCraftEvents: bucket.highTierCraftEvents[itemId],
        },
      ]),
    ),
    highTierPlayerGames: bucket.highTierPlayerGames,
    highTierPlayerRate: rate(bucket.highTierPlayerGames),
    encounter: {
      games: bucket.playerEncounterGames,
      gameRate: rate(bucket.playerEncounterGames),
      starts: bucket.playerEncounterStarts,
      attacks: bucket.playerAttackEvents,
      guards: bucket.playerGuardEvents,
      escapes: bucket.playerEscapeEvents,
      stationaryEscapes: bucket.stationaryEscapeEvents,
      zeroStaminaGuards: bucket.zeroStaminaGuardCommands,
      zeroStaminaFlees: bucket.zeroStaminaFleeCommands,
    },
    equipmentHandoff: {
      games: bucket.playerEquipGames,
      gameRate: rate(bucket.playerEquipGames),
      events: bucket.playerEquipEvents,
      weaponEvents: bucket.playerWeaponEquipEvents,
      armorEvents: bucket.playerArmorEquipEvents,
    },
    deaths: {
      causes: bucket.deathCauses,
      withWeapon: bucket.deathsWithWeapon,
      withoutWeapon: bucket.deathsWithoutWeapon,
      withArmor: bucket.deathsWithArmor,
      withoutArmor: bucket.deathsWithoutArmor,
      withCarriedWeapon: bucket.deathsWithCarriedWeapon,
      withCarriedArmor: bucket.deathsWithCarriedArmor,
    },
  };
}

const overall = newBucket();
const cells = new Map<string, Bucket>();
let requestedGames = 0;
let actualGames = 0;

for (let seedIndex = 0; seedIndex < SEED_COUNT; seedIndex += 1) {
  for (const character of CHARACTERS) {
    for (const policy of AUTO_PLAYER_POLICIES) {
      requestedGames += 1;
      const result = runAutoGame({
        seed: `${SEED_PREFIX}-${seedIndex}-${character.id}-${policy}`,
        characterId: character.id,
        policy: policy as AutoPlayerPolicy,
        keepFinalState: true,
        keepEventTrace: true,
        representativeBuildLoop: REPRESENTATIVE_BUILD_LOOP,
      });
      actualGames += 1;
      observeResult(overall, result);
      const key = `${character.id}:${policy}`;
      const cell = cells.get(key) ?? newBucket();
      observeResult(cell, result);
      cells.set(key, cell);
    }
  }
}

const output = {
  phase: REPRESENTATIVE_BUILD_LOOP ? 'Phase 4C-5' : 'Phase 4C-4',
  generatedAt: new Date().toISOString(),
  interpretation:
    '观察数据 only；不对胜率、存活率或角色平衡作 PASS/FAIL 判定。玩家目标设定为模拟器命令通道指标，不等同于真实玩家采纳 UI 建议。',
  method: {
    seedCount: SEED_COUNT,
    matrix: '4 characters × 5 policies',
    seedPrefix: SEED_PREFIX,
    mode: REPRESENTATIVE_BUILD_LOOP ? 'representative-build-loop' : 'baseline-policy',
    requestedGames,
    actualGames,
    source: 'tools/autoPlayer.ts via executeCommand',
  },
  health: {
    requestedEqualsActual: requestedGames === actualGames,
    healthyGames: overall.healthyGames,
    timeoutOrDeadlockOrIllegal: overall.games - overall.healthyGames,
    pass: requestedGames === actualGames && overall.healthyGames === actualGames,
  },
  overall: finalBucket(overall),
  matrix: Object.fromEntries(
    [...cells.entries()].map(([key, bucket]) => [key, finalBucket(bucket)]),
  ),
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Wrote ${OUTPUT}`);
