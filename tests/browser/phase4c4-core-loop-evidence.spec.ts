import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { createGame, getPlayer, refreshZoneOccupants } from '../../src/core/gameState';
import { addItem, createStack } from '../../src/core/inventory';
import { GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';
import { clearInventory } from '../helpers';

const evidenceDir = path.resolve('output/phase4c4-browser');

function ensureEvidenceDir(): void {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

function craftFixture(): Record<string, unknown> {
  const state = createGame({
    seed: 'PHASE4C4-BROWSER-CRAFT',
    playerCharacterId: 'scout',
  });
  const player = getPlayer(state);
  player.inventory = [];
  player.equipment = [];
  player.equippedWeaponId = null;
  player.equippedArmorId = null;
  player.stamina = player.maxStamina;
  for (const itemId of ['wood', 'rope']) addItem(player, createStack(state, itemId));

  return {
    version: GAME_VERSION,
    savedAt: 1,
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state,
  };
}

function encounterFixture(): Record<string, unknown> {
  const state = createGame({
    seed: 'PHASE4C4-BROWSER-ENCOUNTER',
    playerCharacterId: 'scout',
    playerName: '诊断玩家',
  });
  const player = getPlayer(state);
  const enemy = state.turnOrder
    .map((id) => state.characters[id])
    .find((character) => character && !character.isPlayer);
  if (!enemy) throw new Error('fixture enemy missing');

  enemy.currentZoneId = player.currentZoneId;
  enemy.alive = true;
  enemy.stamina = enemy.maxStamina;
  player.stamina = 0;
  player.hp = Math.min(player.maxHp, 80);
  clearInventory(player);
  refreshZoneOccupants(state);
  state.encounter = {
    enemyId: enemy.id,
    zoneId: player.currentZoneId,
    startedAtTime: state.time,
    log: [],
    resolved: false,
  };
  for (const zone of Object.values(state.zones)) {
    if (zone.id !== player.currentZoneId) zone.status = 'restricted';
  }

  return {
    version: GAME_VERSION,
    savedAt: 1,
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state,
  };
}

async function loadFixture(
  page: import('@playwright/test').Page,
  fixture: Record<string, unknown>,
): Promise<void> {
  await page.goto('/?fixture=phase4c4', { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: fixture,
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续上次对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function snapshot(
  page: import('@playwright/test').Page,
  name: string,
): Promise<Record<string, unknown>> {
  const runtime = await page.evaluate(() => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    mode: document.querySelector('.game') ? 'playing' : 'menu',
    craftGuidance: document.querySelector('[data-craft-guidance="weapon-primary-path"]')?.textContent ?? null,
    craftSuggestion: document.querySelector('[data-craft-auto-suggestion]')?.textContent ?? null,
    encounterState: document.querySelector('[data-encounter-mode]')?.getAttribute('data-encounter-mode') ?? null,
    zeroStaminaGuard: (document.querySelector('[data-action="guard"]') as HTMLButtonElement | null)?.disabled === false,
    zeroStaminaFlee: (document.querySelector('[data-action="flee"]') as HTMLButtonElement | null)?.disabled === false,
    renderState: window.render_game_to_text?.() ?? null,
  }));
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
  fs.writeFileSync(path.join(evidenceDir, `${name}.json`), `${JSON.stringify(runtime, null, 2)}\n`);
  return runtime;
}

test('Phase 4C-4 clean production core-loop evidence', async ({ page }) => {
  ensureEvidenceDir();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '开始新对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
  const exploration = await snapshot(page, '01-desktop-exploration');
  expect(exploration.mode).toBe('playing');
  expect(exploration.bodyScrollWidth).toBe(1280);
  expect(exploration.documentScrollWidth).toBe(1280);

  await loadFixture(page, craftFixture());
  const planningTrigger = page.getByRole('button', { name: '打开规划与历史' });
  if (await planningTrigger.isVisible()) await planningTrigger.click();
  await page.getByRole('tab', { name: '合成' }).click();
  const crafting = await snapshot(page, '02-desktop-crafting-guidance');
  expect(crafting.craftGuidance).toContain('武器主要靠合成');
  expect(crafting.craftSuggestion).toContain('下一步建议');

  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page, encounterFixture());
  const encounter = await snapshot(page, '03-mobile-zero-stamina-encounter');
  expect(encounter.encounterState).toBe('active');
  expect(encounter.bodyScrollWidth).toBe(390);
  expect(encounter.documentScrollWidth).toBe(390);
  expect(encounter.zeroStaminaGuard).toBe(true);
  expect(encounter.zeroStaminaFlee).toBe(true);

  fs.writeFileSync(
    path.join(evidenceDir, 'runtime-errors.json'),
    `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`,
  );
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
