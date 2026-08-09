import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.use({ hasTouch: true });

const evidenceDir = path.resolve('output/phase4c13-browser');
const viewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'phone-portrait', width: 390, height: 844 },
] as const;

async function startGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#seed').fill('PHASE4C13-SAFE-AREA');
  await page.getByRole('button', { name: '开始新对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function tapLocator(page: import('@playwright/test').Page, selector: string): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`cannot tap ${selector}: no bounding box`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test('Phase 4C-13 touch and safe-area contract across five viewports', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await startGame(page);
  const snapshots: Record<string, unknown>[] = [];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const mobile = viewport.width < 1100;
    await page.evaluate((safeArea) => {
      for (const side of ['top', 'right', 'bottom', 'left']) {
        document.documentElement.style.setProperty(`--safe-area-${side}`, `${safeArea}px`);
      }
    }, mobile ? 24 : 0);

    const before = await page.evaluate(({ name, width, height }) => {
      const actionbar = document.querySelector('.actionbar') as HTMLElement | null;
      const topbar = document.querySelector('.topbar') as HTMLElement | null;
      const trigger = document.querySelector('.planning-drawer-trigger') as HTMLElement | null;
      const actionbarStyle = actionbar ? getComputedStyle(actionbar) : null;
      const topbarStyle = topbar ? getComputedStyle(topbar) : null;
      return {
        name,
        viewport: { width, height },
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        actionbar: actionbar ? {
          top: actionbar.getBoundingClientRect().top,
          bottom: actionbar.getBoundingClientRect().bottom,
          paddingBottom: actionbarStyle?.paddingBottom ?? null,
          paddingLeft: actionbarStyle?.paddingLeft ?? null,
          paddingRight: actionbarStyle?.paddingRight ?? null,
        } : null,
        topbar: topbar ? {
          paddingTop: topbarStyle?.paddingTop ?? null,
          paddingLeft: topbarStyle?.paddingLeft ?? null,
          paddingRight: topbarStyle?.paddingRight ?? null,
        } : null,
        drawerTrigger: trigger ? {
          bottom: getComputedStyle(trigger).bottom,
          minHeight: getComputedStyle(trigger).minHeight,
        } : null,
      };
    }, viewport);
    snapshots.push(before);

    expect(before.bodyScrollWidth).toBe(viewport.width);
    expect(before.documentScrollWidth).toBe(viewport.width);
    expect(before.actionbar).not.toBeNull();
    expect((before.actionbar as { bottom: number }).bottom).toBeLessThanOrEqual(viewport.height);
    if (mobile) {
      expect(Number.parseFloat((before.actionbar as { paddingBottom: string }).paddingBottom)).toBeGreaterThanOrEqual(24);
      expect(Number.parseFloat((before.actionbar as { paddingLeft: string }).paddingLeft)).toBeGreaterThanOrEqual(24);
      expect(Number.parseFloat((before.actionbar as { paddingRight: string }).paddingRight)).toBeGreaterThanOrEqual(24);
      expect(Number.parseFloat((before.topbar as { paddingTop: string }).paddingTop)).toBeGreaterThanOrEqual(24);
      expect(before.drawerTrigger).not.toBeNull();
      expect(Number.parseFloat((before.drawerTrigger as { minHeight: string }).minHeight)).toBeGreaterThanOrEqual(44);

      await tapLocator(page, '.planning-drawer-trigger');
      await expect(page.locator('.planning-slot-open')).toHaveCount(1);
      await expect(page.locator('.planning-drawer-close')).toBeVisible();
      const open = await page.evaluate(() => {
        const panel = document.querySelector('.planning-drawer-panel') as HTMLElement | null;
        const actionbar = document.querySelector('.actionbar') as HTMLElement | null;
        return {
          panelBottom: panel?.getBoundingClientRect().bottom ?? null,
          actionbarTop: actionbar?.getBoundingClientRect().top ?? null,
          panelBottomCss: panel ? getComputedStyle(panel).bottom : null,
        };
      });
      expect(open.panelBottom).not.toBeNull();
      expect(open.actionbarTop).not.toBeNull();
      expect(open.panelBottom as number).toBeLessThanOrEqual(open.actionbarTop as number);
      snapshots.push({ name: `${viewport.name}-drawer-open`, ...open });
      await page.screenshot({ path: path.join(evidenceDir, `${viewport.name}-drawer-open.png`), fullPage: false });
      await tapLocator(page, '.planning-drawer-close');
      await expect(page.locator('.planning-slot-open')).toHaveCount(0);
    }
  }

  fs.writeFileSync(path.join(evidenceDir, 'runtime.json'), `${JSON.stringify(snapshots, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'runtime-errors.json'), `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
