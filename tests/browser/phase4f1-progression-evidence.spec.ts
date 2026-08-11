import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { attackActor, guardActor } from '../../src/core/actorActions';
import { refreshZoneOccupants } from '../../src/core/gameState';
import { experienceToNextLevel } from '../../src/core/progression';
import { SeededRandom } from '../../src/core/random';
import type { Combatant, GameState } from '../../src/core/types';
import { GAME_CONFIG, GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';
import { newGame, npcs, player } from '../helpers';

const evidenceDir = path.resolve('output/phase4f1-browser');
const runtimePath = path.resolve('reports/phase4f1-runtime.json');

interface ActorSnapshot {
  level: number;
  exp: number;
  attack: number;
  defense: number;
  hp: number;
  maxHp: number;
  stamina: number;
  alive: boolean;
}

function actorSnapshot(actor: Combatant): ActorSnapshot {
  return {
    level: actor.level,
    exp: actor.exp,
    attack: actor.attack,
    defense: actor.defense,
    hp: actor.hp,
    maxHp: actor.maxHp,
    stamina: actor.stamina,
    alive: actor.alive,
  };
}

function serialize(state: GameState): Record<string, unknown> {
  return {
    version: GAME_VERSION,
    savedAt: 1,
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state,
  };
}

function stageDuel(seed: string): { state: GameState; p: Combatant; npc: Combatant } {
  const state = newGame(seed, 'fighter');
  const p = player(state);
  const npc = npcs(state)[0]!;
  npc.currentZoneId = p.currentZoneId;
  refreshZoneOccupants(state);
  return { state, p, npc };
}

async function loadFixture(page: Page, state: GameState): Promise<void> {
  await page.goto('/?debug=1&fixture=phase4f1', { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: SAVE_KEY, value: serialize(state) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续上次对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
  await expect(page.locator('aside.debug')).toBeVisible();
}

async function showPlayerDebug(page: Page): Promise<void> {
  await page
    .locator('aside.debug')
    .getByRole('heading', { name: '玩家', exact: true })
    .scrollIntoViewIfNeeded();
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: path.join(evidenceDir, `${name}.png`),
    fullPage: false,
  });
}

test.beforeAll(() => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
});

test('Phase 4F-1 生产预览：成长、NPC 同步与零体力防刷取证据', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.setViewportSize({ width: 1280, height: 720 });

  const initialState = newGame('PHASE4F1-BROWSER-INITIAL', 'fighter');
  const initial = actorSnapshot(player(initialState));
  await loadFixture(page, initialState);
  await showPlayerDebug(page);
  await expect(page.locator('aside.debug')).toContainText('Lv.1 · 0/20');
  await expect(page.locator('aside.debug')).toContainText('attack / defense');
  await shot(page, '01-initial-level-exp');

  const combat = stageDuel('PHASE4F1-BROWSER-COMBAT');
  const combatBefore = {
    player: actorSnapshot(combat.p),
    npc: actorSnapshot(combat.npc),
  };
  const combatResult = attackActor(
    combat.state,
    combat.p,
    combat.npc,
    new SeededRandom('PHASE4F1-BROWSER-COMBAT-ROLL'),
    { allowCounter: false },
  );
  expect(combatResult.ok).toBe(true);
  const combatAfter = {
    player: actorSnapshot(combat.p),
    npc: actorSnapshot(combat.npc),
  };
  await loadFixture(page, combat.state);
  await showPlayerDebug(page);
  await expect(page.locator('aside.debug')).toContainText('Lv.1 · 8/20');
  await shot(page, '02-combat-participation-exp');

  const upgrade = stageDuel('PHASE4F1-BROWSER-UPGRADE');
  upgrade.p.exp =
    experienceToNextLevel(upgrade.p.level) - GAME_CONFIG.expCombatParticipation;
  const upgradeBefore = actorSnapshot(upgrade.p);
  const upgradeResult = attackActor(
    upgrade.state,
    upgrade.p,
    upgrade.npc,
    new SeededRandom('PHASE4F1-BROWSER-UPGRADE-ROLL'),
    { allowCounter: false },
  );
  expect(upgradeResult.ok).toBe(true);
  const upgradeAfter = actorSnapshot(upgrade.p);
  await loadFixture(page, upgrade.state);
  await showPlayerDebug(page);
  await expect(page.locator('aside.debug')).toContainText('Lv.2 · 0/30');
  await expect(page.locator('aside.debug')).toContainText(
    `${upgradeAfter.attack} / ${upgradeAfter.defense}`,
  );
  await shot(page, '03-player-level-up-stats');

  const npcUpgrade = stageDuel('PHASE4F1-BROWSER-NPC-UPGRADE');
  npcUpgrade.npc.exp =
    experienceToNextLevel(npcUpgrade.npc.level) - GAME_CONFIG.expCombatParticipation;
  const npcBefore = actorSnapshot(npcUpgrade.npc);
  const npcResult = attackActor(
    npcUpgrade.state,
    npcUpgrade.npc,
    npcUpgrade.p,
    new SeededRandom('PHASE4F1-BROWSER-NPC-UPGRADE-ROLL'),
    { allowCounter: false },
  );
  expect(npcResult.ok).toBe(true);
  const npcAfter = actorSnapshot(npcUpgrade.npc);
  await loadFixture(page, npcUpgrade.state);
  const npcCard = page.locator('.debug-npc', { hasText: npcUpgrade.npc.name });
  await npcCard.scrollIntoViewIfNeeded();
  await expect(npcCard).toContainText('Lv.2 exp 0/30');
  await expect(npcCard).toContainText(`atk ${npcAfter.attack}`);
  await expect(npcCard).toContainText(`def ${npcAfter.defense}`);
  await shot(page, '04-npc-level-up-stats');

  const guardState = newGame('PHASE4F1-BROWSER-ZERO-GUARD', 'fighter');
  const guarder = player(guardState);
  guarder.stamina = 0;
  const guardBefore = actorSnapshot(guarder);
  for (let i = 0; i < 5; i += 1) {
    expect(guardActor(guardState, guarder).ok).toBe(true);
  }
  const guardAfter = actorSnapshot(guarder);
  await loadFixture(page, guardState);
  await showPlayerDebug(page);
  await expect(page.locator('aside.debug')).toContainText('Lv.1 · 0/20');
  await expect(page.locator('.tag-guard')).toContainText('防御');
  await shot(page, '05-zero-stamina-guard-no-exp');

  expect(upgradeAfter).toMatchObject({
    level: 2,
    exp: 0,
    attack: upgradeBefore.attack + GAME_CONFIG.levelAttackGain,
    defense: upgradeBefore.defense + GAME_CONFIG.levelDefenseGain,
    maxHp: upgradeBefore.maxHp + GAME_CONFIG.levelMaxHpGain,
    hp: upgradeBefore.hp + GAME_CONFIG.levelMaxHpGain,
  });
  expect(npcAfter.level).toBe(2);
  expect(guardAfter.exp).toBe(guardBefore.exp);
  await expect(page.locator('[title]')).toHaveCount(0);
  const width = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(width.scrollWidth).toBeLessThanOrEqual(width.clientWidth + 1);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);

  fs.writeFileSync(
    runtimePath,
    `${JSON.stringify({
      version: GAME_VERSION,
      config: {
        maxLevel: GAME_CONFIG.maxLevel,
        levelExpThresholds: GAME_CONFIG.levelExpThresholds,
        levelAttackGain: GAME_CONFIG.levelAttackGain,
        levelDefenseGain: GAME_CONFIG.levelDefenseGain,
        levelMaxHpGain: GAME_CONFIG.levelMaxHpGain,
        expCombatParticipation: GAME_CONFIG.expCombatParticipation,
        expKillBonus: GAME_CONFIG.expKillBonus,
        expSearch: GAME_CONFIG.expSearch,
        expExplore: GAME_CONFIG.expExplore,
      },
      initial,
      combatParticipation: { before: combatBefore, after: combatAfter },
      playerLevelUp: { before: upgradeBefore, after: upgradeAfter },
      npcLevelUp: { before: npcBefore, after: npcAfter },
      zeroStaminaGuard: { repetitions: 5, before: guardBefore, after: guardAfter },
      browser: { viewport: '1280x720', titleCount: 0, overflow: width, consoleErrors, pageErrors },
    }, null, 2)}\n`,
  );
});
