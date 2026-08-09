import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { performCraft } from '../../src/core/crafting';
import { createGame, getPlayer } from '../../src/core/gameState';
import { addItem, createStack } from '../../src/core/inventory';
import { pushEvent } from '../../src/core/events';
import { GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';
import { clearInventory } from '../helpers';

const evidenceDir = path.resolve('output/phase4c5-browser');

function searchFixture(): Record<string, unknown> {
  const state = createGame({
    seed: 'PHASE4C5-BROWSER-SEARCH',
    playerCharacterId: 'scout',
    playerName: '装备测试者',
  });
  const player = getPlayer(state);
  clearInventory(player);
  addItem(player, createStack(state, 'iron_pipe'));
  pushEvent(state, {
    type: 'ITEM_FOUND',
    actorId: player.id,
    zoneId: player.currentZoneId,
    message: '你找到了铁管。',
    metadata: { itemId: 'iron_pipe' },
  });
  pushEvent(state, {
    type: 'ITEM_PICKED',
    actorId: player.id,
    zoneId: player.currentZoneId,
    message: '你收下了铁管。',
    metadata: { itemId: 'iron_pipe' },
  });
  return saveFixture(state);
}

function craftFixture(): Record<string, unknown> {
  const state = createGame({
    seed: 'PHASE4C5-BROWSER-CRAFT',
    playerCharacterId: 'scout',
    playerName: '装备测试者',
  });
  const player = getPlayer(state);
  clearInventory(player);
  addItem(player, createStack(state, 'wood'));
  addItem(player, createStack(state, 'stone'));
  const result = performCraft(state, player, 'r_stick');
  if (!result.ok) throw new Error(result.message);
  return saveFixture(state);
}

function saveFixture(state: ReturnType<typeof createGame>): Record<string, unknown> {
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
  await page.goto('/?fixture=phase4c5', { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: fixture,
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续上次对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function openPlanning(page: import('@playwright/test').Page): Promise<void> {
  const trigger = page.getByRole('button', { name: '打开规划与历史' });
  if (await trigger.count() > 0 && await trigger.isVisible()) await trigger.click();
}

async function snapshot(
  page: import('@playwright/test').Page,
  name: string,
): Promise<Record<string, unknown>> {
  const runtime = await page.evaluate(() => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    searchEquipVisible: document.querySelector('[data-search-equip-output]') !== null,
    craftEquipVisible: document.querySelector('[data-craft-equip-output]') !== null,
    searchFeedback: document.querySelector('[data-search-result="item"]')?.textContent ?? null,
    craftFeedback: document.querySelector('[data-craft-progress-feedback]')?.textContent ?? null,
    equippedWeapon: document.querySelector('.equip-slot[data-slot="武器"]')?.textContent ?? null,
    renderState: window.render_game_to_text?.() ?? null,
  }));
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
  fs.writeFileSync(path.join(evidenceDir, `${name}.json`), `${JSON.stringify(runtime, null, 2)}\n`);
  return runtime;
}

test('Phase 4C-5 clean production equipment handoff evidence', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1280, height: 720 });
  await loadFixture(page, searchFixture());
  const search = await snapshot(page, '01-desktop-search-result-before-equip');
  expect(search.searchEquipVisible).toBe(true);
  await page.locator('[data-search-equip-output]').click();
  await expect(page.locator('[data-search-result="item"]')).toContainText('已装备');
  const searchEquipped = await snapshot(page, '02-desktop-search-result-after-equip');
  expect(searchEquipped.equippedWeapon).toContain('铁管');

  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page, craftFixture());
  await openPlanning(page);
  await page.getByRole('tab', { name: '合成' }).click();
  const craft = await snapshot(page, '03-mobile-craft-result-before-equip');
  expect(craft.craftEquipVisible).toBe(true);
  await page.locator('[data-craft-equip-output]').click();
  await expect(page.locator('[data-craft-progress-feedback]')).toContainText('成品已装备');
  const craftEquipped = await snapshot(page, '04-mobile-craft-result-after-equip');
  expect(craftEquipped.bodyScrollWidth).toBe(390);
  expect(craftEquipped.documentScrollWidth).toBe(390);

  fs.writeFileSync(
    path.join(evidenceDir, 'runtime-errors.json'),
    `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`,
  );
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
