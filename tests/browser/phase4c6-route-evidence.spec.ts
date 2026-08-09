import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { executeCommand } from '../../src/core/gameEngine';
import { createGame, getPlayer } from '../../src/core/gameState';
import { clearInventory } from '../helpers';
import { GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';

const evidenceDir = path.resolve('output/phase4c6-browser');

function routeFixture(): Record<string, unknown> {
  const state = createGame({
    seed: 'PHASE4C6-BROWSER-ROUTE',
    playerCharacterId: 'scout',
    playerName: '路线验证者',
  });
  clearInventory(getPlayer(state));
  const result = executeCommand(state, {
    type: 'SET_CRAFT_GOAL',
    recipeId: 'r_field_spear',
  });
  if (!result.ok) throw new Error(result.message ?? '无法设定路线验证目标');
  const next = result.state;
  return {
    version: GAME_VERSION,
    savedAt: 1,
    seed: next.seed,
    time: next.time,
    rngState: next.rngState,
    state: next,
  };
}

async function loadFixture(
  page: import('@playwright/test').Page,
  fixture: Record<string, unknown>,
): Promise<void> {
  await page.goto('/?fixture=phase4c6', { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: fixture,
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续上次对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function openCraft(page: import('@playwright/test').Page): Promise<void> {
  const trigger = page.getByRole('button', { name: '打开规划与历史' });
  if (await trigger.count() > 0 && await trigger.isVisible()) await trigger.click();
  const craftTab = page.locator('.planning-tabs [role="tab"]').filter({ hasText: '合成' });
  await expect(craftTab).toHaveCount(1);
  await craftTab.click();
  await expect(craftTab).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-craft-raw-materials]').scrollIntoViewIfNeeded();
}

async function snapshot(
  page: import('@playwright/test').Page,
  name: string,
): Promise<Record<string, unknown>> {
  const runtime = await page.evaluate(() => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    routeText: document.querySelector('[data-craft-raw-materials]')?.textContent ?? null,
    recommendationText: document.querySelector('.cg-recs')?.textContent ?? null,
    subgoalText: document.querySelector('[data-craft-subgoal-tracker]')?.textContent ?? null,
    renderState: window.render_game_to_text?.() ?? null,
  }));
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
  fs.writeFileSync(path.join(evidenceDir, `${name}.json`), `${JSON.stringify(runtime, null, 2)}\n`);
  return runtime;
}

test('Phase 4C-6 nested craft route evidence on clean production preview', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1280, height: 720 });
  await loadFixture(page, routeFixture());
  await openCraft(page);
  const desktop = await snapshot(page, '01-desktop-nested-route');
  expect(desktop.routeText).toContain('木材');
  expect(desktop.routeText).toContain('石头');
  expect(desktop.routeText).toContain('绳子');
  expect(desktop.routeText).toContain('铁块');
  expect(desktop.recommendationText).toContain('学校');
  expect(desktop.recommendationText).not.toContain('加固握把');

  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page, routeFixture());
  await openCraft(page);
  const mobile = await snapshot(page, '02-mobile-nested-route');
  expect(mobile.bodyScrollWidth).toBe(390);
  expect(mobile.documentScrollWidth).toBe(390);
  expect(mobile.routeText).toContain('铁块');
  expect(mobile.subgoalText).toContain('木棍');

  fs.writeFileSync(
    path.join(evidenceDir, 'runtime-errors.json'),
    `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`,
  );
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
