import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.PHASE4B5_BASE_URL ?? 'http://127.0.0.1:4173';
const evidenceDir = path.resolve('output/phase4b5-browser');
const viewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'phone-portrait', width: 390, height: 844 },
] as const;

function ensureEvidenceDir(): void {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

async function startGame(page: import('@playwright/test').Page, seed: string): Promise<void> {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#seed').fill(seed);
  await page.locator('.char-card').filter({ hasText: '侦察员' }).click();
  await page.getByRole('button', { name: '开始新对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function settleEncounterOrPickup(page: import('@playwright/test').Page): Promise<void> {
  const giveUp = page.getByRole('button', { name: '放弃该物品' });
  if (await giveUp.count() > 0 && await giveUp.first().isVisible()) {
    await giveUp.first().click();
    await page.waitForTimeout(30);
    return;
  }
  const flee = page.locator('[data-action="flee"]');
  if (await flee.count() > 0 && await flee.first().isEnabled()) {
    await flee.first().click();
    await page.waitForTimeout(30);
    const continueButton = page.locator('.encounter-continue');
    if (await continueButton.count() > 0 && await continueButton.isVisible()) {
      await continueButton.click();
      await page.waitForTimeout(30);
    }
  }
}

async function dismissToast(page: import('@playwright/test').Page): Promise<void> {
  const toast = page.locator('.toast');
  if (await toast.count() > 0 && await toast.isVisible()) await toast.click({ force: true });
}

async function reachEncounter(page: import('@playwright/test').Page): Promise<void> {
  const search = page.locator('.actionbar-actions button').filter({ hasText: '搜索' }).first();
  const rest = page.locator('.actionbar-actions button').filter({ hasText: '休息' }).first();
  for (let i = 0; i < 48; i += 1) {
    if (await page.locator('[data-encounter-mode="active"]').count() > 0) return;
    await settleEncounterOrPickup(page);
    if (await page.locator('[data-encounter-mode="active"]').count() > 0) return;
    await dismissToast(page);
    if (await search.isEnabled()) await search.click();
    else if (await rest.isEnabled()) await rest.click();
    await page.waitForTimeout(35);
  }
  await expect(page.locator('[data-encounter-mode="active"]')).toHaveCount(1);
}

async function findPendingPickup(page: import('@playwright/test').Page): Promise<void> {
  const search = page.locator('.actionbar-actions button').filter({ hasText: '搜索' }).first();
  const rest = page.locator('.actionbar-actions button').filter({ hasText: '休息' }).first();
  for (let i = 0; i < 100; i += 1) {
    if (await page.locator('.pending[data-pending-item-id]').count() > 0) return;
    await settleEncounterOrPickup(page);
    if (await page.locator('.pending[data-pending-item-id]').count() > 0) return;
    await dismissToast(page);
    if (await search.isEnabled()) await search.click();
    else if (await rest.isEnabled()) await rest.click();
    await page.waitForTimeout(35);
  }
  await expect(page.locator('.pending[data-pending-item-id]')).toHaveCount(1);
}

async function focusEncounterActions(page: import('@playwright/test').Page): Promise<Record<string, unknown>> {
  const result = await page.evaluate(() => {
    const board = document.querySelector('.board') as HTMLElement | null;
    const stage = document.querySelector('.stage') as HTMLElement | null;
    const actions = document.querySelector('.encounter-actions') as HTMLElement | null;
    const topbarBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
    if (!board || !stage || !actions) return { scroll: 0, visible: 0 };

    const scrollContainer = stage.scrollHeight > stage.clientHeight + 1 ? stage : board;
    const targetTop = topbarBottom + 8;
    const before = actions.getBoundingClientRect().top;
    scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop + before - targetTop);
    const visible = Array.from(actions.querySelectorAll('button')).filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top >= topbarBottom && rect.bottom <= window.innerHeight;
    }).length;
    return {
      scroll: scrollContainer.scrollTop,
      visible,
      scrollContainer: scrollContainer.className,
    };
  });
  await page.waitForTimeout(60);
  return result;
}

async function snapshot(
  page: import('@playwright/test').Page,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const runtime = await page.evaluate(() => {
    const board = document.querySelector('.board') as HTMLElement | null;
    const stage = document.querySelector('.stage') as HTMLElement | null;
    const encounter = document.querySelector('.encounter') as HTMLElement | null;
    const planning = document.querySelector('.planning-drawer-panel') as HTMLElement | null;
    const hero = document.querySelector('.zone-hero') as HTMLElement | null;
    const rect = (node: HTMLElement | null) => node
      ? (() => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()
      : null;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      board: board ? { clientHeight: board.clientHeight, scrollHeight: board.scrollHeight, scrollTop: board.scrollTop } : null,
      stage: stage ? { clientHeight: stage.clientHeight, scrollHeight: stage.scrollHeight, scrollTop: stage.scrollTop } : null,
      hero: rect(hero),
      encounter: rect(encounter),
      planning: rect(planning),
      planningOpen: document.querySelector('.planning-slot-open') !== null,
      actionbar: rect(document.querySelector('.actionbar') as HTMLElement | null),
      renderState: window.render_game_to_text?.() ?? null,
    };
  });
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
  const snapshotData = { ...runtime, ...extra };
  fs.writeFileSync(path.join(evidenceDir, `${name}.json`), `${JSON.stringify(snapshotData, null, 2)}\n`);
  return snapshotData;
}

test('Phase 4B-5 production responsive closure across five viewports', async ({ page }) => {
  ensureEvidenceDir();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startGame(page, `PHASE4B5-${viewport.name}`);

    const base = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      search: (() => { const node = document.querySelector('.actionbar-actions button'); const r = node?.getBoundingClientRect(); return Boolean(node && r && r.width > 0 && r.bottom <= innerHeight); })(),
      rest: (() => { const nodes = Array.from(document.querySelectorAll('.actionbar-actions button')); const node = nodes.find((n) => n.textContent?.includes('休息')); const r = node?.getBoundingClientRect(); return Boolean(node && r && r.width > 0 && r.bottom <= innerHeight); })(),
      movementEntries: document.querySelectorAll('.zone-item').length,
    }));
    expect(base.bodyScrollWidth).toBe(viewport.width);
    expect(base.documentScrollWidth).toBe(viewport.width);
    expect(base.search).toBe(true);
    expect(base.rest).toBe(true);
    expect(base.movementEntries).toBe(6);

    const planningTrigger = page.locator('.planning-drawer-trigger');
    if (viewport.width < 1100) {
      await expect(planningTrigger).toBeVisible();
      await planningTrigger.click();
      await expect(page.locator('.planning-slot-open')).toHaveCount(1);
      await expect(page.locator('.planning-drawer-panel')).toBeVisible();
      await expect(page.locator('.planning-tabs button')).toHaveCount(3);
      await expect(page.locator('.log-panel')).toBeVisible();
      await snapshot(page, `${viewport.name}-planning-open`);
      await page.getByRole('button', { name: '关闭', exact: true }).click();
      await expect(page.locator('.planning-slot-open')).toHaveCount(0);
    } else {
      await expect(page.locator('.planning-drawer-panel')).toBeVisible();
      await expect(planningTrigger).toBeHidden();
    }
    await snapshot(page, `${viewport.name}-exploration`);

    await startGame(page, `PHASE4B5-ENCOUNTER-${viewport.name}`);
    await reachEncounter(page);
    const focus = await focusEncounterActions(page);
    const encounter = await snapshot(page, `${viewport.name}-encounter`, { encounterActionFocus: focus });
    expect(encounter.bodyScrollWidth).toBe(viewport.width);
    expect(encounter.documentScrollWidth).toBe(viewport.width);
    expect(focus.visible).toBe(6);
    expect((encounter.encounter as { height?: number } | null)?.height ?? 0).toBeLessThan(700);
  }

  // Pending pickup is a modal-free decision surface: it must be completable on
  // the narrowest shape without reopening the planning drawer.
  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page, 'PENDING-0');
  await findPendingPickup(page);
  await expect(page.locator('.pending')).toBeVisible();
  await snapshot(page, 'phone-portrait-pending');
  await page.getByRole('button', { name: '放弃该物品' }).click();
  await expect(page.locator('.pending')).toHaveCount(0);

  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});
