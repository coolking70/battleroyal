import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { executeCommand } from '../../src/core/gameEngine';
import { createGame, getPlayer } from '../../src/core/gameState';
import { addItem, createStack } from '../../src/core/inventory';
import { GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';

const evidenceDir = path.resolve('output/phase4c2-browser');

function ensureEvidenceDir(): void {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

function fixture(kind: 'auto' | 'subgoal'): Record<string, unknown> {
  let state = createGame({
    seed: `PHASE4C2-EVIDENCE-${kind}`,
    playerCharacterId: 'scout',
  });
  const player = getPlayer(state);
  player.inventory = [];
  player.equipment = [];
  player.equippedWeaponId = null;
  player.equippedArmorId = null;
  player.stamina = player.maxStamina;

  for (const itemId of kind === 'auto' ? ['wood', 'rope'] : ['wood', 'stone', 'rope', 'iron']) {
    addItem(player, createStack(state, itemId));
  }

  if (kind === 'subgoal') {
    const result = executeCommand(state, { type: 'SET_CRAFT_GOAL', recipeId: 'r_field_spear' });
    if (!result.ok) throw new Error(result.message ?? 'failed to set fixture goal');
    state = result.state;
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
  kind: 'auto' | 'subgoal',
): Promise<void> {
  await page.goto(`/?fixture=phase4c2-${kind}`, { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: fixture(kind),
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
    suggestion: document.querySelector('[data-craft-auto-suggestion]')?.textContent ?? null,
    subgoal: document.querySelector('[data-craft-subgoal-tracker]')?.textContent ?? null,
    codex: document.querySelector('[data-craft-codex]')?.textContent?.slice(0, 500) ?? null,
    codexDepth3: document.querySelectorAll('[data-codex-depth="3"]').length,
    fallbackVisual: document.querySelector('[data-codex-root-id="r_field_spear"] .craft-codex-visual')?.textContent ?? null,
    renderState: window.render_game_to_text?.() ?? null,
  }));
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
  fs.writeFileSync(path.join(evidenceDir, `${name}.json`), `${JSON.stringify(runtime, null, 2)}\n`);
  return runtime;
}

test('Phase 4C-2 clean production crafting guidance and codex evidence', async ({ page }) => {
  ensureEvidenceDir();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1280, height: 720 });
  await loadFixture(page, 'auto');
  await openPlanning(page);
  await page.getByRole('tab', { name: '合成' }).click();
  await expect(page.locator('[data-craft-auto-suggestion]')).toHaveCount(1);
  const suggestedRecipe = await page.locator('[data-craft-adopt-suggestion]').evaluate((button) => {
    const panel = button.closest('[data-craft-auto-suggestion]');
    return panel?.textContent ?? '';
  });
  expect(suggestedRecipe).toContain('下一步建议');
  await snapshot(page, '01-desktop-auto-suggestion');
  await page.locator('[data-craft-adopt-suggestion]').click();
  await expect(page.locator('.craft-goal')).toContainText('制作目标');

  await loadFixture(page, 'subgoal');
  await openPlanning(page);
  await page.getByRole('tab', { name: '合成' }).click();
  await expect(page.locator('[data-craft-subgoal-tracker]')).toContainText('木棍');
  await snapshot(page, '02-desktop-subgoal-start');
  await page.locator('[data-output-item-id="stick"]').getByRole('button', { name: '合成' }).click();
  await expect(page.locator('[data-craft-subgoal-tracker]')).toContainText('加固握把');
  await snapshot(page, '03-desktop-subgoal-advanced');

  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page, 'subgoal');
  await openPlanning(page);
  await page.getByRole('tab', { name: '图鉴' }).click();
  await expect(page.locator('[data-craft-codex]')).toHaveCount(1);
  const codex = await snapshot(page, '04-mobile-codex');
  expect(codex.codexDepth3).toBeGreaterThan(0);
  expect(codex.fallbackVisual).toContain('⚔️');
  expect(codex.bodyScrollWidth).toBe(390);
  expect(codex.documentScrollWidth).toBe(390);

  fs.writeFileSync(
    path.join(evidenceDir, 'runtime-errors.json'),
    `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`,
  );
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
