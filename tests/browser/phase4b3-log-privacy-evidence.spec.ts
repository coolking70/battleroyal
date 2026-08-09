import { expect, test } from '@playwright/test';

test('P0 production log privacy evidence', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?seed=LOG-PRIVACY-0');
  await page.getByRole('button', { name: '开始新对局' }).click();

  const log = page.locator('.log-panel');
  await expect(log).toContainText('对局开始');
  await expect(log).not.toContainText('NPC_ACTION');
  await expect(log).not.toContainText('物资 100%');
  await expect(log).not.toContainText('flee_combat');

  await page.screenshot({ path: 'output/phase4b3-log-privacy/01-desktop-default-log.png', fullPage: true });
  const runtime = await page.evaluate(() => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    logText: document.querySelector('.log-panel')?.textContent ?? '',
    consoleErrors: [] as string[],
    pageErrors: [] as string[],
  }));
  runtime.consoleErrors = consoleErrors;
  runtime.pageErrors = pageErrors;

  expect(runtime.bodyScrollWidth).toBe(1280);
  expect(runtime.documentScrollWidth).toBe(1280);
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
});
