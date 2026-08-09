import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = path.resolve('output/phase4c11-browser');

async function startGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#seed').fill('PHASE4C11-A11Y');
  await page.locator('.char-card').filter({ hasText: '侦察员' }).click();
  await page.getByRole('button', { name: '开始新对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

test('Phase 4C-11 production drawer keyboard and tab semantics', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page);
  const trigger = page.locator('.planning-drawer-trigger');
  await trigger.click();
  const drawer = page.locator('.planning-drawer-panel');
  const close = page.locator('.planning-drawer-close');
  await expect(close).toBeFocused();
  await expect(drawer).toHaveAttribute('aria-labelledby', 'planning-drawer-title');

  for (const tabId of ['inventory', 'craft', 'codex']) {
    const tab = page.locator(`#planning-tab-${tabId}`);
    await expect(tab).toHaveAttribute('aria-controls', `planning-tabpanel-${tabId}`);
    await tab.click();
    await expect(page.locator(`#planning-tabpanel-${tabId}`)).toHaveAttribute('aria-labelledby', `planning-tab-${tabId}`);
  }
  await page.locator('#planning-tab-inventory').click();

  const focusable = drawer.locator('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
  const last = focusable.last();
  await last.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();

  await page.screenshot({ path: path.join(evidenceDir, '01-mobile-drawer-focus.png'), fullPage: false });
  const runtime = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    drawerOpen: document.querySelector('.planning-slot-open') !== null,
    activeElement: document.activeElement?.className ?? null,
    panelRole: document.querySelector('.planning-tabpanel')?.getAttribute('role') ?? null,
  }));
  fs.writeFileSync(path.join(evidenceDir, '01-mobile-drawer-focus.json'), `${JSON.stringify(runtime, null, 2)}\n`);

  await page.keyboard.press('Escape');
  await expect(page.locator('.planning-slot-open')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  fs.writeFileSync(path.join(evidenceDir, 'runtime-errors.json'), `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
