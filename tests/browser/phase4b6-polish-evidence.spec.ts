import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { scrollEncounterActionsIntoView } from './scrollHelpers';

const baseUrl = process.env.PHASE4B6_BASE_URL ?? 'http://127.0.0.1:4173';
const evidenceDir = path.resolve('output/phase4b6-browser');
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

async function startGame(
  page: import('@playwright/test').Page,
  seed: string,
  debug = false,
): Promise<void> {
  const url = `${baseUrl}${debug ? '/?debug=1' : '/'}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#seed').fill(seed);
  await page.locator('.char-card').filter({ hasText: '侦察员' }).click();
  await page.getByRole('button', { name: '开始新对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function dismissToast(page: import('@playwright/test').Page): Promise<void> {
  const toast = page.locator('.toast');
  if (await toast.count() > 0 && await toast.isVisible()) await toast.click({ force: true });
}

async function settleTransientSurface(page: import('@playwright/test').Page): Promise<void> {
  const giveUp = page.getByRole('button', { name: '放弃该物品' });
  if (await giveUp.count() > 0 && await giveUp.first().isVisible()) {
    await giveUp.first().click();
    await page.waitForTimeout(25);
    return;
  }
  const flee = page.locator('[data-action="flee"]');
  if (await flee.count() > 0 && await flee.first().isEnabled()) {
    await flee.first().click();
    await page.waitForTimeout(25);
    const continueButton = page.locator('.encounter-continue');
    if (await continueButton.count() > 0 && await continueButton.isVisible()) {
      await continueButton.click();
      await page.waitForTimeout(25);
    }
  }
}

async function reachEncounter(page: import('@playwright/test').Page): Promise<void> {
  const search = page.locator('.actionbar-actions button').filter({ hasText: '搜索' }).first();
  const rest = page.locator('.actionbar-actions button').filter({ hasText: '休息' }).first();
  for (let i = 0; i < 60; i += 1) {
    if (await page.locator('[data-encounter-mode="active"]').count() > 0) return;
    await settleTransientSurface(page);
    if (await page.locator('[data-encounter-mode="active"]').count() > 0) return;
    await dismissToast(page);
    if (await search.isEnabled()) await search.click();
    else if (await rest.isEnabled()) await rest.click();
    await page.waitForTimeout(30);
  }
  await expect(page.locator('[data-encounter-mode="active"]')).toHaveCount(1);
}

async function snapshot(
  page: import('@playwright/test').Page,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const runtime = await page.evaluate(() => {
    const rect = (selector: string) => {
      const node = document.querySelector(selector) as HTMLElement | null;
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const board = document.querySelector('.board') as HTMLElement | null;
    const stage = document.querySelector('.stage') as HTMLElement | null;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      board: board ? { clientHeight: board.clientHeight, scrollHeight: board.scrollHeight, scrollTop: board.scrollTop } : null,
      stage: stage ? { clientHeight: stage.clientHeight, scrollHeight: stage.scrollHeight, scrollTop: stage.scrollTop } : null,
      hero: rect('.zone-hero'),
      encounter: rect('.encounter'),
      encounterActions: rect('.encounter-actions'),
      planning: rect('.planning-drawer-panel'),
      planningOpen: document.querySelector('.planning-slot-open') !== null,
      actionbar: rect('.actionbar'),
      debug: rect('.debug'),
      focused: document.activeElement instanceof HTMLElement
        ? { className: document.activeElement.className, text: document.activeElement.textContent?.trim() ?? '' }
        : null,
      renderState: window.render_game_to_text?.() ?? null,
    };
  });
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
  const snapshotData = { ...runtime, ...extra };
  fs.writeFileSync(path.join(evidenceDir, `${name}.json`), `${JSON.stringify(snapshotData, null, 2)}\n`);
  return snapshotData;
}

async function minimalEncounterScroll(page: import('@playwright/test').Page): Promise<Record<string, unknown>> {
  const result = await page.evaluate(scrollEncounterActionsIntoView);
  return { ...result };
}

test('Phase 4B-6 production polish evidence across five viewports', async ({ page }) => {
  ensureEvidenceDir();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startGame(page, `PHASE4B6-EXPLORE-${viewport.name}`);

    const exploration = await snapshot(page, `${viewport.name}-exploration`);
    expect(exploration.bodyScrollWidth).toBe(viewport.width);
    expect(exploration.documentScrollWidth).toBe(viewport.width);
    await expect(page.locator('.actionbar-actions button').filter({ hasText: '搜索' })).toBeVisible();
    await expect(page.locator('.actionbar-actions button').filter({ hasText: '休息' })).toBeVisible();

    // Phase 4D-2 起规划抽屉在所有视口都按需展开，键盘开合闭环对五个视口一致成立。
    const trigger = page.locator('.planning-drawer-trigger');
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.planning-slot-open')).toHaveCount(1);
    await expect(page.locator('.planning-drawer-close')).toBeFocused();
    await snapshot(page, `${viewport.name}-planning-open`, { keyboardOpened: true });
    await page.keyboard.press('Escape');
    await expect(page.locator('.planning-slot-open')).toHaveCount(0);
    await expect(trigger).toBeFocused();

    // 地图抽屉复用同一套焦点管理（useDrawerFocus），键盘可达性同样成立。
    const mapTrigger = page.locator('.zone-rail-expand');
    await expect(mapTrigger).toBeVisible();
    await mapTrigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.map-slot-open')).toHaveCount(1);
    await expect(page.locator('.map-drawer-close')).toBeFocused();
    await snapshot(page, `${viewport.name}-map-open`, { keyboardOpened: true });
    await page.keyboard.press('Escape');
    await expect(page.locator('.map-slot-open')).toHaveCount(0);
    await expect(mapTrigger).toBeFocused();

    // Reuse the stable encounter seeds from the already-accepted 4B-5
    // evidence path so this closure captures the encounter surface before
    // the seeded simulation can reach a terminal result screen.
    await startGame(page, `PHASE4B5-ENCOUNTER-${viewport.name}`);
    await reachEncounter(page);
    const focus = await minimalEncounterScroll(page);
    const encounter = await snapshot(page, `${viewport.name}-encounter`, { encounterActionFocus: focus });
    expect(encounter.bodyScrollWidth).toBe(viewport.width);
    expect(encounter.documentScrollWidth).toBe(viewport.width);
    expect((focus.visibleButtons as number)).toBe(6);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page, 'PHASE4B6-DEBUG', true);
  const debug = await snapshot(page, 'phone-portrait-debug');
  const debugIsolation = await page.evaluate(() => {
    const debugNode = document.querySelector('.debug')?.getBoundingClientRect();
    const actionbar = document.querySelector('.actionbar')?.getBoundingClientRect();
    const intersects = debugNode && actionbar
      ? debugNode.bottom > actionbar.top && debugNode.top < actionbar.bottom
      : false;
    return { intersectsActionbar: intersects, debugBottom: debugNode?.bottom ?? null, actionbarTop: actionbar?.top ?? null };
  });
  expect(debugIsolation.intersectsActionbar).toBe(false);
  fs.writeFileSync(path.join(evidenceDir, 'phone-portrait-debug-isolation.json'), `${JSON.stringify({ debug, debugIsolation }, null, 2)}\n`);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await startGame(page, 'PHASE4B6-MOTION-NORMAL');
  const normalMotion = await page.evaluate(() => getComputedStyle(document.querySelector('.actionbar-actions button') as HTMLElement).transitionDuration);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await startGame(page, 'PHASE4B6-MOTION-REDUCED');
  const reducedMotion = await page.evaluate(() => getComputedStyle(document.querySelector('.actionbar-actions button') as HTMLElement).transitionDuration);
  await snapshot(page, 'phone-portrait-reduced-motion', { normalMotion, reducedMotion });
  expect(Number.parseFloat(reducedMotion)).toBeLessThan(0.001);
  expect(Number.parseFloat(normalMotion)).toBeGreaterThan(Number.parseFloat(reducedMotion));

  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});
