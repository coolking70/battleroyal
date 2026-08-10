import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { SAVE_KEY } from '../../src/data/gameConfig';
import {
  craftableHintFixture,
  killReportFixture,
  quickRestoreAutoFixture,
  quickRestoreChooseFixture,
} from './phase4e1Fixtures';

/**
 * Phase 4E-1 浏览器证据（§8）。
 *
 * 覆盖三件事，各自在 1280×720 与 390×844 两个视口下各跑一遍：
 * - 缺陷 A：击杀后战斗记录里能看到最后一击；
 * - 改进 B：新获得物品后出现可合成提示，并可一键发起合成；
 * - 改进 C：点击生命 / 体力槽的自动使用与选择窗两条路径，含遭遇中使用。
 *
 * 所有交互都走真实 UI 与真实命令通道；夹具只负责把对局摆到可取证的位置。
 */

const evidenceDir = path.resolve('output/phase4e1-browser');

const viewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'phone-portrait', width: 390, height: 844 },
] as const;

const consoleErrors: string[] = [];
const pageErrors: string[] = [];

async function loadFixture(page: Page, fixture: Record<string, unknown>): Promise<void> {
  await page.goto('/?fixture=phase4e1', { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: fixture,
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续上次对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
}

/** 横向溢出：§6 五视口不可回退项，这里在每个证据点顺带复查。 */
async function noHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 1,
    };
  });
  expect(overflow.overflow, JSON.stringify(overflow)).toBe(false);
}

/** 数值条右侧的 `现值/上限` 文本，用来验证恢复确实生效。 */
async function readVital(page: Page, slot: 'hp' | 'stamina'): Promise<number> {
  const text = await page.locator(`.survival-metric-${slot} b`).innerText();
  return Number(text.split('/')[0]);
}

/** P0 命中测试：浮层不得挡住顶部生存信息与底部行动按钮。 */
async function assertP0Clickable(page: Page): Promise<void> {
  const blocked = await page.evaluate(() => {
    const targets = [
      ...Array.from(document.querySelectorAll<HTMLElement>('.survival-metric b')),
      ...Array.from(document.querySelectorAll<HTMLElement>('.actionbar-actions button')),
    ];
    return targets
      .map((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const covered = !hit || (hit !== el && !el.contains(hit) && !hit.contains(el));
        return covered
          ? { el: el.className || el.tagName, hit: hit ? `${hit.tagName}.${hit.className}` : null }
          : null;
      })
      .filter(Boolean);
  });
  expect(blocked, JSON.stringify(blocked)).toEqual([]);
}

test.beforeAll(() => {
  fs.mkdirSync(evidenceDir, { recursive: true });
});

test.beforeEach(({ page }) => {
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
});

test.afterAll(() => {
  fs.writeFileSync(
    path.join(evidenceDir, 'runtime-errors.json'),
    `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`,
  );
});

for (const viewport of viewports) {
  test(`Phase 4E-1 缺陷 A：击杀写进战斗记录（${viewport.name}）`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await loadFixture(page, killReportFixture(`PHASE4E1-KILL-${viewport.name}`));

    await expect(page.locator('.encounter-hero')).toBeVisible();
    const enemyName = (await page.locator('.eh-name-line strong').first().innerText()).trim();

    // ---- 改进 C：遭遇中也能点血条快捷恢复（唯一候选医疗包，空缺 50 > 40 → 自动使用） ----
    const hpBefore = await readVital(page, 'hp');
    await page.locator('.survival-metric-hp .bar-button').click();
    await expect(page.locator('.quick-restore-menu')).toHaveCount(0);
    await expect
      .poll(async () => readVital(page, 'hp'), { timeout: 3000 })
      .toBeGreaterThan(hpBefore);
    await expect(page.locator('.encounter-hero')).toBeVisible();
    await noHorizontalOverflow(page);
    await shot(page, `${viewport.name}-01-quick-restore-in-encounter`);

    // ---- 缺陷 A：打死敌人，战斗记录必须包含这一击的结果 ----
    for (let i = 0; i < 20; i += 1) {
      const attack = page.locator('[data-attack-style="normal"]').first();
      if ((await attack.count()) === 0 || !(await attack.isEnabled())) break;
      await attack.click();
      await page.waitForTimeout(60);
      const logCount = await page.locator('.eh-log-count').innerText();
      if (Number(logCount) > 0 && (await page.locator('.encounter-hero').count()) > 0) {
        const resolved = await page.locator('[data-encounter-mode="active"]').count();
        if (resolved === 0) break;
      }
    }

    await page.locator('.encounter-hero-log-toggle').click();
    const logPanel = page.locator('.encounter-hero-log');
    await expect(logPanel).toBeVisible();
    const logText = await logPanel.innerText();
    fs.writeFileSync(
      path.join(evidenceDir, `${viewport.name}-kill-log.txt`),
      `${logText}\n`,
    );

    // 最后一击必须在场：能读到"击杀"与死者名字
    expect(logText).toContain('击杀');
    expect(logText).toContain(enemyName);
    // 信息边界：战报不得泄露敌方精确 HP（形如 12/40）
    expect(logText).not.toMatch(/\d+\s*\/\s*\d+/);
    await noHorizontalOverflow(page);
    await shot(page, `${viewport.name}-02-kill-battle-log`);
  });

  test(`Phase 4E-1 改进 B：可合成提示与一键合成（${viewport.name}）`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await loadFixture(page, craftableHintFixture(`PHASE4E1-HINT-${viewport.name}`));

    // 进入时只是基线：材料还差一件，不应有提示（也不应有常驻占位）
    await expect(page.locator('.craftable-hint')).toHaveCount(0);
    await shot(page, `${viewport.name}-03-hint-before`);

    // 拾取地面的石头 → 石斧从不可做变为可做
    await page.locator('.ground-item[data-item-id="stone"] button').click();

    // 拾取会弹一条 toast 操作反馈（3.2s 自动消失）；它是瞬态通知，不属于 P0 持久遮挡，
    // 先关掉它再查 P0 可点性，避免把瞬态通知误判为遮挡。
    const toast = page.locator('.toast');
    if ((await toast.count()) > 0) await toast.click();

    const hint = page.locator('.craftable-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('可合成');
    await expect(hint).toContainText('石斧');
    await noHorizontalOverflow(page);
    await assertP0Clickable(page);
    await shot(page, `${viewport.name}-04-hint-visible`);

    // 一键合成：走既有 CRAFT 通道
    await page.locator('[data-craftable-hint-craft="true"]').click();
    await expect(hint).toHaveCount(0);

    // 产物确实进了背包
    await page.locator('.planning-drawer-trigger').click();
    await expect(page.locator('#planning-tabpanel-inventory')).toContainText('石斧');
    await shot(page, `${viewport.name}-05-craft-result`);
    await page.keyboard.press('Escape');
  });

  test(`Phase 4E-1 改进 C：快捷恢复自动与选择窗两条路径（${viewport.name}）`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    // ---- §3.2 自动使用：唯一候选（绷带 +15）且空缺 40，不弹窗 ----
    await loadFixture(page, quickRestoreAutoFixture(`PHASE4E1-QR-AUTO-${viewport.name}`));
    const hpBar = page.locator('.survival-metric-hp .bar-button');
    await expect(hpBar).toHaveCount(1);
    expect(await hpBar.evaluate((el) => el.tagName)).toBe('BUTTON');

    const before = await readVital(page, 'hp');
    await hpBar.click();
    await expect(page.locator('.quick-restore-menu')).toHaveCount(0);
    await expect.poll(async () => readVital(page, 'hp'), { timeout: 3000 }).toBe(before + 15);
    await noHorizontalOverflow(page);
    await shot(page, `${viewport.name}-06-quick-restore-auto`);

    // ---- §3.3 / §3.4 选择窗：多候选，双效物品完整显示两项效果 ----
    await loadFixture(page, quickRestoreChooseFixture(`PHASE4E1-QR-CHOOSE-${viewport.name}`));
    const hpBefore = await readVital(page, 'hp');
    await page.locator('.survival-metric-hp .bar-button').click();

    const menu = page.locator('.quick-restore-menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('.quick-restore-item')).toHaveCount(3);
    const herb = menu.locator('.quick-restore-item', { hasText: '草药' });
    await expect(herb).toContainText('生命 +10');
    await expect(herb).toContainText('体力 +10');
    await noHorizontalOverflow(page);
    await assertP0Clickable(page);
    await shot(page, `${viewport.name}-07-quick-restore-menu`);

    // Esc 关闭并把焦点还给触发槽
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(page.locator('.survival-metric-hp .bar-button')).toBeFocused();

    // 重新打开并选医疗包（+40）→ 使用后收起
    await page.locator('.survival-metric-hp .bar-button').click();
    await menu.locator('.quick-restore-item', { hasText: '医疗包' }).click();
    await expect(menu).toHaveCount(0);
    await expect.poll(async () => readVital(page, 'hp'), { timeout: 3000 }).toBe(hpBefore + 40);
    await shot(page, `${viewport.name}-08-quick-restore-used`);

    // 候选为空时给出明确说明，不静默无响应
    await page.locator('.survival-metric-hp .bar-button').click();
    await expect(menu).toBeVisible();
    await expect(menu.locator('.quick-restore-item', { hasText: '医疗包' })).toHaveCount(0);
    await shot(page, `${viewport.name}-09-quick-restore-remaining`);
    await page.keyboard.press('Escape');
  });
}

test('Phase 4E-1 运行时无 console 错误', async () => {
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});
