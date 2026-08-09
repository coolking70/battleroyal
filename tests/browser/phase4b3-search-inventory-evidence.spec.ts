import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { SAVE_KEY } from '../../src/data/gameConfig';
import { pendingPickupFixture } from './pendingPickupFixture';

const baseUrl = process.env.PHASE4B3_BASE_URL ?? 'http://127.0.0.1:4173';
const evidenceDir = path.resolve('output/phase4b3-browser');

function ensureEvidenceDir(): void {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

async function startGame(page: import('@playwright/test').Page, seed: string, character = 'scout'): Promise<void> {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#seed').fill(seed);
  await page.locator('.char-card').filter({ hasText: character === 'medic' ? '医学生' : '侦察员' }).click();
  await page.getByRole('button', { name: '开始新对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function loadFixture(
  page: import('@playwright/test').Page,
  fixture: Record<string, unknown>,
): Promise<void> {
  await page.goto(`${baseUrl}/?fixture=phase4b3`, { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: fixture,
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续上次对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function settleEncounterOrPickup(page: import('@playwright/test').Page): Promise<boolean> {
  const pending = page.getByRole('button', { name: '放弃该物品' });
  if (await pending.count() > 0 && await pending.first().isVisible()) {
    await pending.first().click();
    await page.waitForTimeout(45);
    return true;
  }

  if (await page.locator('[data-encounter-mode="active"]').count() > 0) {
    const flee = page.locator('[data-action="flee"]');
    if (await flee.count() > 0 && await flee.isEnabled()) await flee.click();
    await page.waitForTimeout(50);
    if (await page.locator('[data-encounter-mode="resolved"]').count() > 0) {
      const continueButton = page.locator('.encounter-continue');
      if (await continueButton.count() > 0 && await continueButton.isVisible()) await continueButton.click();
      await page.waitForTimeout(45);
    }
    return true;
  }
  return false;
}

async function dismissToast(page: import('@playwright/test').Page): Promise<void> {
  const toast = page.locator('.toast');
  if (await toast.count() > 0 && await toast.isVisible()) await toast.click({ force: true });
}

async function takeExplorationAction(page: import('@playwright/test').Page): Promise<void> {
  await dismissToast(page);
  if (await settleEncounterOrPickup(page)) return;
  await dismissToast(page);
  const search = page.locator('.actionbar-actions button').filter({ hasText: '搜索' }).first();
  const rest = page.locator('.actionbar-actions button').filter({ hasText: '休息' }).first();
  if (await search.isEnabled()) await search.click();
  else if (await rest.isEnabled()) await rest.click();
  await page.waitForTimeout(55);
}

async function findSearchResult(
  page: import('@playwright/test').Page,
  kind: 'item' | 'nothing',
): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    if (await page.locator(`[data-search-result="${kind}"]`).count() > 0) return;
    await takeExplorationAction(page);
  }
  await expect(page.locator(`[data-search-result="${kind}"]`)).toHaveCount(1);
}

async function findPendingPickup(page: import('@playwright/test').Page): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    if (await page.locator('.pending[data-pending-item-id]').count() > 0) return;
    await takeExplorationAction(page);
  }
  await expect(page.locator('.pending[data-pending-item-id]')).toHaveCount(1);
}

async function ensureWoodAndStone(page: import('@playwright/test').Page): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    const wood = page.locator('.inv-item[data-item-id="wood"]');
    const stone = page.locator('.inv-item[data-item-id="stone"]');
    if (await wood.count() > 0 && await stone.count() > 0) return;
    await takeExplorationAction(page);
  }
  await expect(page.locator('.inv-item[data-item-id="wood"]')).toHaveCount(1);
  await expect(page.locator('.inv-item[data-item-id="stone"]')).toHaveCount(1);
}

async function snapshot(page: import('@playwright/test').Page, name: string): Promise<Record<string, unknown>> {
  const runtime = await page.evaluate(() => {
    const board = document.querySelector('.board') as HTMLElement | null;
    const stage = document.querySelector('.stage') as HTMLElement | null;
    const result = document.querySelector('[data-search-result]') as HTMLElement | null;
    const pending = document.querySelector('.pending') as HTMLElement | null;
    const planning = document.querySelector('.planning-panel') as HTMLElement | null;
    const log = document.querySelector('.log-panel') as HTMLElement | null;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      board: board ? { clientHeight: board.clientHeight, scrollHeight: board.scrollHeight, scrollTop: board.scrollTop } : null,
      stage: stage ? { clientHeight: stage.clientHeight, scrollHeight: stage.scrollHeight, scrollTop: stage.scrollTop } : null,
      result: result ? { kind: result.getAttribute('data-search-result'), itemId: result.getAttribute('data-item-id') } : null,
      pending: pending ? { itemId: pending.getAttribute('data-pending-item-id'), height: pending.getBoundingClientRect().height } : null,
      itemImageCount: document.querySelectorAll('.item-visual, .equip-item-visual, .craft-output-visual, .pending-item-visual, .ground-item-visual').length,
      equippedImages: document.querySelectorAll('.equip-item-visual').length,
      craftStates: Array.from(document.querySelectorAll('[data-craft-state]')).map((node) => node.getAttribute('data-craft-state')),
      planningRect: planning ? (() => { const r = planning.getBoundingClientRect(); return { width: r.width, height: r.height }; })() : null,
      logRect: log ? (() => { const r = log.getBoundingClientRect(); return { width: r.width, height: r.height }; })() : null,
      renderState: window.render_game_to_text?.() ?? null,
    };
  });
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
  fs.writeFileSync(path.join(evidenceDir, `${name}.json`), `${JSON.stringify(runtime, null, 2)}\n`);
  return runtime;
}

async function focusNodeInBoard(page: import('@playwright/test').Page, selector: string): Promise<void> {
  await page.evaluate((target) => {
    const board = document.querySelector('.board') as HTMLElement | null;
    const node = document.querySelector(target) as HTMLElement | null;
    if (board && node) {
      const boardRect = board.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      board.scrollTop = Math.max(0, board.scrollTop + nodeRect.top - boardRect.top - 12);
    }
  }, selector);
  await page.waitForTimeout(60);
}

test('Phase 4B-3 production search and inventory evidence', async ({ page }) => {
  ensureEvidenceDir();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1280, height: 720 });
  await startGame(page, 'ITEM-0');
  await findSearchResult(page, 'item');
  const item = await snapshot(page, '01-desktop-item-result');
  expect((item.result as { kind?: string } | null)?.kind).toBe('item');
  expect(item.itemImageCount).toBeGreaterThan(0);

  await startGame(page, 'EMPTY-44');
  await findSearchResult(page, 'nothing');
  const empty = await snapshot(page, '02-desktop-empty-result');
  expect((empty.result as { kind?: string } | null)?.kind).toBe('nothing');

  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page, pendingPickupFixture('PHASE4B3-PENDING'));
  await findPendingPickup(page);
  await focusNodeInBoard(page, '.pending');
  const pending = await snapshot(page, '03-mobile-pending-pickup');
  expect(pending.pending).not.toBeNull();

  await page.setViewportSize({ width: 1280, height: 720 });
  await startGame(page, 'CRAFT-3');
  await ensureWoodAndStone(page);
  await page.locator('.planning-tabs button').filter({ hasText: '合成' }).click();
  await expect(page.locator('[data-output-item-id="stick"]')).toHaveCount(1);
  const stickRecipe = page.locator('[data-output-item-id="stick"]');
  await expect(stickRecipe).toHaveAttribute('data-craft-state', 'available');
  const craft = await snapshot(page, '04-desktop-craft-states');
  expect(craft.craftStates).toContain('available');
  await stickRecipe.getByRole('button', { name: '合成' }).click();
  await page.locator('.planning-tabs button').filter({ hasText: '背包' }).click();
  const stickItem = page.locator('.inv-item[data-item-id="stick"]');
  await expect(stickItem).toHaveCount(1);
  await stickItem.getByRole('button', { name: '装备' }).click();
  const equipped = await snapshot(page, '05-desktop-equipped-item');
  expect(equipped.equippedImages).toBeGreaterThan(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await focusNodeInBoard(page, '.planning-rail');
  const mobile = await snapshot(page, '06-mobile-planning-and-log');
  expect(mobile.bodyScrollWidth).toBe(390);
  expect(mobile.documentScrollWidth).toBe(390);
  expect(mobile.planningRect).not.toBeNull();
  expect(mobile.logRect).not.toBeNull();

  const errors = { consoleErrors, pageErrors };
  fs.writeFileSync(path.join(evidenceDir, 'runtime-errors.json'), `${JSON.stringify(errors, null, 2)}\n`);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
