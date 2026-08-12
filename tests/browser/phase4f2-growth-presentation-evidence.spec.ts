import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { killCharacter } from '../../src/core/vitals';
import { refreshZoneOccupants } from '../../src/core/gameState';
import { experienceToNextLevel } from '../../src/core/progression';
import { createStack } from '../../src/core/inventory';
import type { Combatant, GameState } from '../../src/core/types';
import { GAME_CONFIG, GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';
import { newGame, npcs, player } from '../helpers';

const evidenceDir = path.resolve('output/phase4f2-browser');
const runtimePath = path.resolve('reports/phase4f2-runtime.json');

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

function stageEncounter(seed: string): { state: GameState; p: Combatant; npc: Combatant } {
  const state = newGame(seed, 'fighter');
  const p = player(state);
  const npc = npcs(state)[0]!;
  npc.currentZoneId = p.currentZoneId;
  // 证据夹具只固定 NPC 的既有性格输入，避免升级动作后的 NPC 回合选择脱离；
  // 不改变生产决策优先级或任何战斗规则。
  npc.personality = 'aggressive';
  // 让固定状态下的 NPC 回合走既有免费休息出口，保持同一遭遇在截图中可见。
  npc.stamina = 0;
  p.exp = experienceToNextLevel(p.level) - GAME_CONFIG.expCombatParticipation;
  state.encounter = {
    enemyId: npc.id,
    zoneId: p.currentZoneId,
    startedAtTime: state.time,
    log: [],
    resolved: false,
  };
  state.engagedWithPlayer = [npc.id];
  refreshZoneOccupants(state);
  return { state, p, npc };
}

function stageCorpseLoot(seed: string): GameState {
  const state = newGame(seed, 'fighter');
  const p = player(state);
  const npc = npcs(state)[0]!;
  npc.currentZoneId = p.currentZoneId;
  state.encounter = {
    enemyId: npc.id,
    zoneId: p.currentZoneId,
    startedAtTime: state.time,
    log: [],
    resolved: false,
  };
  state.engagedWithPlayer = [npc.id];
  npc.inventory.push(createStack(state, 'wood'));
  npc.hp = 1;
  killCharacter(state, npc, p.id, '战斗');
  refreshZoneOccupants(state);
  return state;
}

async function loadFixture(page: Page, state: GameState): Promise<void> {
  await page.goto('/?fixture=phase4f2', { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: SAVE_KEY, value: serialize(state) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续上次对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
}

test.beforeAll(() => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
});

test('Phase 4F-2 player growth presentation on clean production preview', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1280, height: 720 });
  const initialState = newGame('PHASE4F2-BROWSER-INITIAL', 'fighter');
  await loadFixture(page, initialState);
  await expect(page.locator('.survival-metric-growth')).toContainText('Lv.1');
  // 可见文本不带 EXP 后缀；完整措辞在 aria-valuetext 上，两者分别断言。
  await expect(page.locator('.survival-metric-growth')).toContainText(
    `0/${GAME_CONFIG.levelExpThresholds[0]}`,
  );
  await expect(page.locator('.survival-metric-growth [role="progressbar"]')).toHaveAttribute(
    'aria-valuetext',
    new RegExp(`0/${GAME_CONFIG.levelExpThresholds[0]} EXP`),
  );
  await screenshot(page, '01-desktop-level-exp');

  const encounter = stageEncounter('PHASE4F2-BROWSER-UPGRADE-ENCOUNTER');
  await loadFixture(page, encounter.state);
  await expect(page.locator('.encounter-hero')).toBeVisible();
  await expect(page.locator('.actionbar-combat-actions > button')).toHaveCount(7);
  await expect(page.locator('.actionbar-combat-actions [data-action="skill"]')).toHaveCount(2);
  await page.locator('button[data-attack-style="normal"]').click();
  await expect(page.locator('.toast')).toContainText('升级 Lv.2');
  await expect(page.locator('.toast')).toContainText('攻击 +1');
  await expect(page.locator('.toast')).toContainText('防御 +1');
  await expect(page.locator('.toast')).toContainText('最大生命 +10');
  await expect(page.locator('.toast')).toHaveAttribute('role', 'status');
  await expect(page.locator('.toast')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.actionbar-combat-actions > button')).toHaveCount(7);
  await expect(page.locator('.encounter-hero')).not.toContainText(/等级\s*[:：=]?\s*\d+/);
  await expect(page.locator('.encounter-hero')).not.toContainText(/经验\s*[:：=]?\s*\d+/);
  await screenshot(page, '02-desktop-encounter-level-up');

  await page.setViewportSize({ width: 1280, height: 720 });
  await loadFixture(page, stageCorpseLoot('PHASE4F2-BROWSER-CORPSE-LOOT'));
  await expect(page.locator('.corpse-loot-notice')).toContainText('击杀战利品');
  await expect(page.locator('.corpse-loot-notice')).toContainText('遗留的物资');
  await expect(page.locator('.corpse-loot-notice')).not.toContainText(/\d+\s*件/);
  await page.locator('.stage').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await screenshot(page, '03-desktop-corpse-loot');

  await page.setViewportSize({ width: 390, height: 844 });
  const maxState = newGame('PHASE4F2-BROWSER-MAX', 'fighter');
  player(maxState).level = GAME_CONFIG.maxLevel;
  player(maxState).exp = 0;
  await loadFixture(page, maxState);
  await expect(page.locator('.growth-max-state')).toContainText('已满级');
  await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
  await screenshot(page, '04-mobile-max-level');

  const layout = await page.evaluate(() => ({
    viewport: `${innerWidth}x${innerHeight}`,
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    titleCount: document.querySelectorAll('[title]').length,
    actionbarBottom: document.querySelector('.actionbar')?.getBoundingClientRect().bottom ?? null,
    actionbarHeight: document.querySelector('.actionbar')?.getBoundingClientRect().height ?? null,
    residentBlocks: ['.topbar', '.zone-rail', '.zone-hero', '.craft-goal-bar', '.actionbar']
      .filter((selector) => Boolean(document.querySelector(selector))),
  }));
  expect(layout.bodyScrollWidth).toBeLessThanOrEqual(390);
  expect(layout.documentScrollWidth).toBeLessThanOrEqual(390);
  expect(layout.titleCount).toBe(0);
  expect(layout.residentBlocks).toHaveLength(5);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);

  const corpseSnapshot = stageCorpseLoot('PHASE4F2-BROWSER-CORPSE-SNAPSHOT');
  const corpsePlayer = player(corpseSnapshot);
  const corpseDropCount = corpseSnapshot.zones[corpsePlayer.currentZoneId]!.groundItems.length;

  fs.writeFileSync(
    runtimePath,
    `${JSON.stringify({
      version: GAME_VERSION,
      ownGrowth: { initialLevel: 1, initialExp: 0, maxLevel: GAME_CONFIG.maxLevel },
      encounterUpgrade: {
        before: {
          level: encounter.p.level,
          exp: experienceToNextLevel(1) - GAME_CONFIG.expCombatParticipation,
        },
        visibleToast: '升级 Lv.2！攻击 +1 · 防御 +1 · 最大生命 +10',
      },
      corpseLoot: { dropCount: corpseDropCount },
      maxLevel: { level: GAME_CONFIG.maxLevel, text: '已满级' },
      browser: { layout, consoleErrors, pageErrors },
    }, null, 2)}\n`,
  );
});
