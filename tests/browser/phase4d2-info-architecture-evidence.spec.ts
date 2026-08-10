import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { measureInfoArchitecture, type InfoArchitectureMetrics } from './infoArchitectureMetrics';

/**
 * Phase 4D-2 信息架构证据。
 *
 * 同一个 spec 有两种运行模式：
 * - 默认（PHASE4D2_LABEL 未设置或为 phase4d2）：跑改造后的构建，断言 §7 验收指标；
 * - 基线（PHASE4D2_LABEL=baseline，配合 PW_BASE_URL 指向 ce508cf 的 preview）：
 *   只采集同一口径的数字，不做 4D-2 断言 —— 这样两组数字才可比。
 */
const label = process.env.PHASE4D2_LABEL ?? 'phase4d2';
const isBaseline = label === 'baseline';
const evidenceDir = path.resolve(`output/phase4d2-browser/${label}`);

const viewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'phone-portrait', width: 390, height: 844 },
] as const;

type Page = import('@playwright/test').Page;

async function startGame(page: Page, seed: string): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#seed').fill(seed);
  await page.locator('.char-card').filter({ hasText: '侦察员' }).click();
  await page.getByRole('button', { name: '开始新对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function dismissToast(page: Page): Promise<void> {
  const toast = page.locator('.toast');
  if ((await toast.count()) > 0 && (await toast.isVisible())) await toast.click({ force: true });
}

async function settleBlockingSurfaces(page: Page): Promise<void> {
  const giveUp = page.getByRole('button', { name: '放弃该物品' });
  if ((await giveUp.count()) > 0 && (await giveUp.first().isVisible())) {
    await giveUp.first().click();
    await page.waitForTimeout(30);
  }
  const continueButton = page.locator('.encounter-continue');
  if ((await continueButton.count()) > 0 && (await continueButton.first().isVisible())) {
    await continueButton.first().click();
    await page.waitForTimeout(30);
  }
}

async function reachEncounter(page: Page): Promise<boolean> {
  const search = page.locator('.actionbar-actions button').filter({ hasText: '搜索' }).first();
  const rest = page.locator('.actionbar-actions button').filter({ hasText: '休息' }).first();
  for (let i = 0; i < 48; i += 1) {
    if ((await page.locator('[data-encounter-mode="active"]').count()) > 0) return true;
    await settleBlockingSurfaces(page);
    if ((await page.locator('[data-encounter-mode="active"]').count()) > 0) return true;
    await dismissToast(page);
    if (await search.isEnabled()) await search.click();
    else if (await rest.isEnabled()) await rest.click();
    await page.waitForTimeout(35);
  }
  return (await page.locator('[data-encounter-mode="active"]').count()) > 0;
}

async function capture(
  page: Page,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<InfoArchitectureMetrics> {
  const metrics = await page.evaluate(measureInfoArchitecture);
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
  fs.writeFileSync(
    path.join(evidenceDir, `${name}.json`),
    `${JSON.stringify({ label, ...metrics, ...extra }, null, 2)}\n`,
  );
  return metrics;
}

test(`Phase 4D-2 information architecture metrics (${label})`, async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  const summary: Record<string, unknown> = { label, viewports: {} as Record<string, unknown> };

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startGame(page, `PHASE4D2-${viewport.name.toUpperCase()}`);

    // ---- 首屏（干净探索态） ----
    const firstScreen = await capture(page, `${viewport.name}-01-first-screen`);
    (summary.viewports as Record<string, unknown>)[viewport.name] = {
      residentBlockCount: firstScreen.residentBlockCount,
      residentBlocks: firstScreen.residentBlocks,
      contextualBlockCount: firstScreen.contextualBlockCount,
      contextualBlocks: firstScreen.contextualBlocks,
      firstScreenBlockCount: firstScreen.firstScreenBlockCount,
      emptyStateCount: firstScreen.emptyStateCount,
      emptyStateTexts: firstScreen.emptyStateTexts,
      equipInventoryMapSharePercent: firstScreen.equipInventoryMapShare.sharePercent,
      visibleInteractiveControls: firstScreen.visibleInteractiveControls,
      titleAttributeCount: firstScreen.titleAttributeCount,
      horizontalOverflow: firstScreen.horizontalOverflow.overflow,
    };

    if (!isBaseline) {
      // §5 硬约束：无横向溢出、真实 DOM 无 [title]
      expect(firstScreen.horizontalOverflow.overflow, JSON.stringify(firstScreen.horizontalOverflow)).toBe(false);
      expect(firstScreen.titleAttributeCount).toBe(0);

      // §7：常驻区块 ≤ 5，首屏空态文案 0
      expect(
        firstScreen.residentBlockCount,
        `常驻区块应 ≤5，实际命中：${firstScreen.residentBlocks.join(' / ')}`,
      ).toBeLessThanOrEqual(5);
      expect(
        firstScreen.emptyStateCount,
        `首屏空态文案应为 0，实际：${firstScreen.emptyStateTexts.join(' / ')}`,
      ).toBe(0);
      // §7：装备 + 背包 + 地图不再常驻占屏
      expect(firstScreen.equipInventoryMapShare.sharePercent).toBeLessThan(10);

      // §3.1：五块常驻结构确实在场
      await expect(page.locator('.topbar')).toBeVisible();
      await expect(page.locator('.zone-rail')).toBeVisible();
      await expect(page.locator('.zone-hero')).toBeVisible();
      await expect(page.locator('.craft-goal-bar')).toBeVisible();
      await expect(page.locator('.actionbar')).toBeVisible();

      // ---- §3.2：完整六区地图按需展开，展开后信息无损 ----
      const mapTrigger = page.locator('.zone-rail-expand');
      await expect(mapTrigger).toBeVisible();
      await mapTrigger.click();
      await expect(page.locator('.map-slot-open')).toHaveCount(1);
      const mapPanel = page.locator('.map-drawer-panel');
      await expect(mapPanel).toBeVisible();
      await expect(mapPanel.locator('.zone-item')).toHaveCount(6);
      const mapOpen = await capture(page, `${viewport.name}-02-map-open`, { surface: 'map-drawer' });
      expect(mapOpen.horizontalOverflow.overflow).toBe(false);
      expect(mapOpen.titleAttributeCount).toBe(0);
      await page.keyboard.press('Escape');
      await expect(page.locator('.map-slot-open')).toHaveCount(0);
      await expect(mapTrigger).toBeFocused();

      // ---- §3.2：背包 + 装备合并入同一入口 ----
      const planningTrigger = page.locator('.planning-drawer-trigger');
      await expect(planningTrigger).toBeVisible();
      await planningTrigger.click();
      await expect(page.locator('.planning-slot-open')).toHaveCount(1);
      const inventoryTab = page.locator('#planning-tab-inventory');
      await expect(inventoryTab).toContainText('背包');
      await expect(inventoryTab).toContainText('装备');
      const inventoryPanel = page.locator('#planning-tabpanel-inventory');
      await expect(inventoryPanel.locator('.equip-row')).toBeVisible();
      await expect(inventoryPanel.locator('.inv-list')).toBeVisible();
      const planningOpen = await capture(page, `${viewport.name}-03-planning-open`, {
        surface: 'planning-drawer',
      });
      expect(planningOpen.horizontalOverflow.overflow).toBe(false);
      expect(planningOpen.titleAttributeCount).toBe(0);
      await page.keyboard.press('Escape');
      await expect(page.locator('.planning-slot-open')).toHaveCount(0);
      await expect(planningTrigger).toBeFocused();

      // 回归防线：关抽屉后触发器仍获焦，它绝不能因 focus-visible 掉回文档流
      // 摊成整宽横条压住行动栏。直接用命中测试验证行动栏主行动仍可点。
      const actionbarReachable = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('.actionbar-actions button')).map(
          (button) => {
            const rect = button.getBoundingClientRect();
            const hit = document.elementFromPoint(
              rect.left + rect.width / 2,
              rect.top + rect.height / 2,
            );
            return {
              label: (button.textContent ?? '').trim().slice(0, 12),
              blocked: !hit || (hit !== button && !button.contains(hit)),
              hit: hit ? `${hit.tagName.toLowerCase()}.${hit.className}` : null,
            };
          },
        ),
      );
      expect(actionbarReachable.length).toBeGreaterThan(0);
      expect(
        actionbarReachable.filter((entry) => entry.blocked),
        JSON.stringify(actionbarReachable),
      ).toEqual([]);
    }

    // ---- 上下文触发：搜索一次后，上下文保留区应出现内容且主视觉不消失 ----
    const searchButton = page.locator('.actionbar-actions button').filter({ hasText: '搜索' }).first();
    if (await searchButton.isEnabled()) {
      await searchButton.click();
      await page.waitForTimeout(60);
      await dismissToast(page);
    }
    const afterSearch = await capture(page, `${viewport.name}-04-after-search`, {
      surface: 'context-triggered',
    });
    if (!isBaseline) {
      expect(afterSearch.horizontalOverflow.overflow).toBe(false);
      expect(afterSearch.titleAttributeCount).toBe(0);
      await expect(page.locator('.zone-hero')).toBeVisible();
      await expect(page.locator('.actionbar')).toBeVisible();
    }
  }

  // ---- 遭遇态：主视觉切 combat 立绘，遭遇面板落在上下文保留区 ----
  await page.setViewportSize({ width: 1280, height: 720 });
  await startGame(page, 'PHASE4B5-ENCOUNTER-desktop');
  const reached = await reachEncounter(page);
  const encounter = await capture(page, 'desktop-05-encounter', { surface: 'encounter', reached });
  if (!isBaseline) {
    expect(encounter.horizontalOverflow.overflow).toBe(false);
    expect(encounter.titleAttributeCount).toBe(0);
  }
  if (!isBaseline && reached) {
    await expect(page.locator('.stage-content .encounter')).toBeVisible();
    await expect(page.locator('.zone-hero')).toBeVisible();
    const portraitSrc = await page
      .locator('.zone-hero-portrait')
      .first()
      .getAttribute('src');
    // 官方图存在时应切到 combat/injured 变体；emoji 降级时 src 为 null，不强制
    if (portraitSrc) {
      expect(portraitSrc).toMatch(/combat|injured/);
    }
  }
  summary.encounterReached = reached;

  fs.writeFileSync(
    path.join(evidenceDir, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(evidenceDir, 'runtime-errors.json'),
    `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`,
  );
  if (!isBaseline) {
    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  }
});
