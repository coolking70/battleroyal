/**
 * Phase 4C-1 可达性观察：记录自动对局在正常时间上限内实际完成的高阶武器。
 *
 * 这是观察工具，不参与游戏规则，也不作为平衡 PASS/FAIL 门禁。
 * 对局仍通过 autoPlayer -> executeCommand 正式命令通道推进。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { CHARACTERS } from '../src/data/characters';
import { ITEMS } from '../src/data/items';
import { runAutoGame, AUTO_PLAYER_POLICIES } from './autoPlayer';

const SEED_COUNT = 10;
const OUTPUT = resolve(process.cwd(), 'reports/phase4c1-craft-reachability.json');
const HIGH_TIER_WEAPONS = [
  'field_spear',
  'steel_axe',
  'composite_bow',
  'insulated_pipe',
  'insulated_stun_rod',
] as const;

type HighTierWeaponId = (typeof HIGH_TIER_WEAPONS)[number];

interface WeaponObservation {
  itemId: HighTierWeaponId;
  name: string;
  gamesWithCraft: number;
  craftEvents: number;
  playerGamesWithCraft: number;
  firstCraftTime: number | null;
}

const observations = Object.fromEntries(
  HIGH_TIER_WEAPONS.map((itemId) => [
    itemId,
    {
      itemId,
      name: ITEMS.find((item) => item.id === itemId)?.name ?? itemId,
      gamesWithCraft: 0,
      craftEvents: 0,
      playerGamesWithCraft: 0,
      firstCraftTime: null,
    },
  ]),
) as Record<HighTierWeaponId, WeaponObservation>;

let requestedGames = 0;
let actualGames = 0;
let totalTime = 0;
let healthyGames = 0;

for (let seedIndex = 0; seedIndex < SEED_COUNT; seedIndex += 1) {
  for (const character of CHARACTERS) {
    for (const policy of AUTO_PLAYER_POLICIES) {
      requestedGames += 1;
      const result = runAutoGame({
        seed: `PHASE4C1-CRAFT-${seedIndex}-${character.id}-${policy}`,
        characterId: character.id,
        policy,
        keepFinalState: true,
      });
      actualGames += 1;
      totalTime += result.timeUsed;
      if (result.trustworthy && !result.hardLimitReached) healthyGames += 1;

      const craftedByGame = new Set<HighTierWeaponId>();
      const playerCraftedByGame = new Set<HighTierWeaponId>();
      for (const event of result.finalState?.events ?? []) {
        if (event.type !== 'ITEM_CRAFTED') continue;
        const itemId = event.metadata?.outputItemId;
        if (!HIGH_TIER_WEAPONS.includes(itemId as HighTierWeaponId)) continue;
        const observation = observations[itemId as HighTierWeaponId];
        observation.craftEvents += 1;
        craftedByGame.add(itemId as HighTierWeaponId);
        if (event.actorId === result.finalState?.playerId) {
          playerCraftedByGame.add(itemId as HighTierWeaponId);
        }
        const craftTime = event.time;
        observation.firstCraftTime =
          observation.firstCraftTime === null
            ? craftTime
            : Math.min(observation.firstCraftTime, craftTime);
      }
      for (const itemId of craftedByGame) observations[itemId].gamesWithCraft += 1;
      for (const itemId of playerCraftedByGame) observations[itemId].playerGamesWithCraft += 1;
    }
  }
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(
  OUTPUT,
  `${JSON.stringify(
    {
      phase: '4C-1',
      generatedAt: new Date().toISOString(),
      method: {
        seedCount: SEED_COUNT,
        matrix: '4 characters × 5 policies',
        requestedGames,
        actualGames,
        source: 'tools/autoPlayer.ts via executeCommand',
        interpretation: 'observation only; no win-rate or balance gate',
      },
      health: {
        healthyGames,
        requestedEqualsActual: requestedGames === actualGames,
        noTimeoutOrDeadlockOrIllegal: healthyGames === actualGames,
        averageTimeUsed: actualGames > 0 ? totalTime / actualGames : 0,
      },
      highTierWeapons: Object.values(observations).map((observation) => ({
        ...observation,
        gameRate: actualGames > 0 ? observation.gamesWithCraft / actualGames : 0,
        playerGameRate: actualGames > 0 ? observation.playerGamesWithCraft / actualGames : 0,
      })),
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(`Wrote ${OUTPUT}`);
