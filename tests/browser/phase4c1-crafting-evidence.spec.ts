import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { executeCommand } from '../../src/core/gameEngine';
import { createGame, getPlayer } from '../../src/core/gameState';
import { addItem, createStack } from '../../src/core/inventory';
import { GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';

const evidenceDir = path.resolve('output/phase4c1-browser');

function ensureEvidenceDir(): void {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

function fixture(completed: boolean): Record<string, unknown> {
  let state = createGame({
    seed: completed ? 'PHASE4C1-EVIDENCE-COMPLETED' : 'PHASE4C1-EVIDENCE-GUIDANCE',
    playerCharacterId: 'scout',
  });
  const player = getPlayer(state);
  player.inventory = [];
  player.equipment = [];
  player.equippedWeaponId = null;
  player.equippedArmorId = null;
  player.stamina = player.maxStamina;

  const startingMaterials = completed ? ['wood', 'stone', 'rope', 'iron'] : ['wood'];
  for (const itemId of startingMaterials) {
    addItem(player, createStack(state, itemId));
  }

  let result = executeCommand(state, { type: 'SET_CRAFT_GOAL', recipeId: 'r_field_spear' });
  if (!result.ok) throw new Error(result.message ?? 'failed to set craft goal');
  state = result.state;

  if (completed) {
    for (const recipeId of ['r_stick', 'r_reinforced_handle', 'r_field_spear']) {
      result = executeCommand(state, { type: 'CRAFT', recipeId });
      if (!result.ok) throw new Error(result.message ?? `failed to craft ${recipeId}`);
      state = result.state;
    }
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
  completed: boolean,
): Promise<void> {
  await page.goto('/?fixture=phase4c1', { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: fixture(completed),
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
    guidance: document.querySelector('[data-craft-guidance="weapon-primary-path"]')?.textContent ?? null,
    path: document.querySelector('[data-craft-intermediate-path]')?.textContent ?? null,
    rawMaterials: document.querySelector('[data-craft-raw-materials]')?.textContent ?? null,
    fallbackOutput: document.querySelector('[data-output-item-id="field_spear"] .craft-output-visual')?.textContent ?? null,
    completedGoal: document.querySelector('.craft-goal')?.textContent ?? null,
    renderState: window.render_game_to_text?.() ?? null,
  }));
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
  fs.writeFileSync(path.join(evidenceDir, `${name}.json`), `${JSON.stringify(runtime, null, 2)}\n`);
  return runtime;
}

async function openCraft(page: import('@playwright/test').Page): Promise<void> {
  const trigger = page.getByRole('button', { name: '打开规划与历史' });
  if (await trigger.count() > 0 && await trigger.isVisible()) await trigger.click();
  await page.getByRole('tab', { name: '合成' }).click();
  await expect(page.locator('[data-craft-guidance="weapon-primary-path"]')).toHaveCount(1);
}

test('Phase 4C-1 clean production crafting path evidence', async ({ page }) => {
  ensureEvidenceDir();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1280, height: 720 });
  await loadFixture(page, false);
  await openCraft(page);
  const guidance = await snapshot(page, '01-desktop-guidance-and-chain');
  expect(guidance.guidance).toContain('武器主要靠合成');
  expect(guidance.path).toContain('加固握把');
  expect(guidance.rawMaterials).toContain('公开来源：工厂');
  expect(guidance.fallbackOutput).toBe('⚔️');
  expect(guidance.rawMaterials).not.toContain('物资 100%');
  expect(guidance.rawMaterials).not.toContain('其他角色的背包');

  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page, true);
  await openCraft(page);
  const completed = await snapshot(page, '02-mobile-completed-high-tier');
  expect(completed.completedGoal).toContain('野外长矛');
  expect(completed.bodyScrollWidth).toBe(390);
  expect(completed.documentScrollWidth).toBe(390);

  fs.writeFileSync(
    path.join(evidenceDir, 'runtime-errors.json'),
    `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`,
  );
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
