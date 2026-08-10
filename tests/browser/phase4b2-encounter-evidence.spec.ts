import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { scrollEncounterActionsIntoView, scrollEncounterIntoView } from './scrollHelpers';

const baseUrl = process.env.PHASE4B2_BASE_URL ?? 'http://127.0.0.1:4173';
const evidenceDir = path.resolve('output/phase4b2-browser-final');

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

async function snapshot(page: import('@playwright/test').Page, name: string): Promise<Record<string, unknown>> {
  const runtime = await page.evaluate(() => {
    const game = document.querySelector('.game') as HTMLElement | null;
    const hero = document.querySelector('.zone-hero') as HTMLElement | null;
    const encounterHero = document.querySelector('.encounter-hero') as HTMLElement | null;
    const enemyPortrait = document.querySelector('.encounter-hero-portrait') as HTMLElement | null;
    const actionbar = document.querySelector('.actionbar') as HTMLElement | null;
    const enemyInfo = document.querySelector('.encounter-hero-enemyinfo') as HTMLElement | null;
    return {
      url: window.location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      encounterMode: game?.getAttribute('data-encounter-mode') ?? 'none',
      heroMode: hero?.getAttribute('data-hero-mode') ?? null,
      encounterState: encounterHero?.getAttribute('data-encounter-state') ?? null,
      // §3 敌方立绘随 resolveCharacterVisualState 切换三态（属性在 .encounter-hero-portrait 上）
      enemyVisualState: enemyPortrait?.getAttribute('data-visual-state') ?? null,
      actionMode: actionbar?.getAttribute('data-action-mode') ?? null,
      combatButtons: document.querySelectorAll('.actionbar-combat-actions button').length,
      // §2.1 去重：主视觉里绝不出现玩家立绘 / 玩家血条副本
      hasPlayerPortraitLeak: Boolean(
        document.querySelector('.zone-hero-portrait') || document.querySelector('.combatant-player'),
      ),
      enemyInfoText: enemyInfo?.textContent ?? null,
      // §3 敌方法定可见字段完整 + 不泄漏精确 HP
      sharedRateText: document.querySelector('.eh-shared-rate')?.textContent ?? null,
      weaponText: document.querySelector('.eh-weapon')?.textContent ?? null,
      feedbackText: document.querySelector('.encounter-hero-feedback')?.textContent ?? null,
      exposedTags: document.querySelectorAll('.tag-exposed').length,
      // 全站共享三态语汇（图标 + 文字）
      combatVisualStateHasIcon: Boolean(
        document.querySelector('.encounter-hero-enemyinfo .combat-visual-state .combat-cue-icon'),
      ),
      renderState: window.render_game_to_text?.() ?? null,
    };
  });
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
  fs.writeFileSync(path.join(evidenceDir, `${name}.json`), `${JSON.stringify(runtime, null, 2)}\n`);
  return runtime;
}

async function resolvePendingPickup(page: import('@playwright/test').Page): Promise<void> {
  const giveUp = page.getByRole('button', { name: '放弃该物品' });
  if (await giveUp.count() > 0 && await giveUp.first().isVisible()) {
    await giveUp.first().click();
    await page.waitForTimeout(30);
  }
}

async function reachEncounter(page: import('@playwright/test').Page): Promise<void> {
  const search = page.locator('.actionbar-actions button').filter({ hasText: '搜索' }).first();
  const rest = page.locator('.actionbar-actions button').filter({ hasText: '休息' }).first();
  for (let i = 0; i < 48; i += 1) {
    if (await page.locator('[data-encounter-mode="active"]').count() > 0) return;
    await resolvePendingPickup(page);
    if (await page.locator('[data-encounter-mode="active"]').count() > 0) return;
    if (await search.isEnabled()) {
      await search.click();
    } else if (await rest.isEnabled()) {
      await rest.click();
    } else {
      break;
    }
    await page.waitForTimeout(35);
  }
  await expect(page.locator('[data-encounter-mode="active"]')).toHaveCount(1);
}

async function startGame(page: import('@playwright/test').Page, seed: string, character = 'scout'): Promise<void> {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#seed').fill(seed);
  await page.locator('.char-card').filter({ hasText: character === 'fighter' ? '斗士' : '侦察员' }).click();
  await page.getByRole('button', { name: '开始新对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function focusEncounter(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(scrollEncounterIntoView);
  await page.waitForTimeout(60);
}

async function focusEncounterActions(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(scrollEncounterActionsIntoView);
  await page.waitForTimeout(60);
}

/** §4：6 个战斗动作（速攻/普通/重击/防御/逃跑/技能）全部钉在视口底部行动栏，无需滚动即可触达。 */
async function assertCombatActionsReachable(page: import('@playwright/test').Page): Promise<void> {
  const check = await page.evaluate(() => {
    const topbarBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('.actionbar-combat-actions button'));
    const inView = buttons.filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top >= topbarBottom && rect.bottom <= window.innerHeight;
    }).length;
    return { total: buttons.length, inView };
  });
  expect(check.total, `应至少 5 个战斗动作（3 攻击 + 防御 + 逃跑），实际 ${check.total}`).toBeGreaterThanOrEqual(5);
  expect(check.inView, `全部战斗动作应无需滚动即在视口内，实际 ${check.inView}/${check.total}`).toBe(check.total);
}

/** 驱动战斗直到敌方进入 injured 三态或遭遇结算。 */
async function driveToInjuredOrResolved(page: import('@playwright/test').Page): Promise<string> {
  for (let i = 0; i < 48; i += 1) {
    const mode = await page.locator('.game').getAttribute('data-encounter-mode');
    if (mode === 'none' || mode === 'resolved') return mode ?? 'none';
    if (await page.locator('.encounter-hero-portrait[data-visual-state="injured"]').count() > 0) return 'injured';
    const quick = page.locator('[data-attack-style="quick"]');
    if (await quick.count() > 0 && await quick.isEnabled()) await quick.click();
    else break;
    await page.waitForTimeout(35);
  }
  return (await page.locator('.game').getAttribute('data-encounter-mode')) ?? 'none';
}

/** 驱动重击直到 EXPOSED 出现或遭遇结算（重击挥空产生 EXPOSED）。 */
async function driveHeavyUntilExposedOrResolved(page: import('@playwright/test').Page): Promise<boolean> {
  for (let i = 0; i < 30; i += 1) {
    if (await page.locator('.tag-exposed').count() > 0) return true;
    const mode = await page.locator('.game').getAttribute('data-encounter-mode');
    if (mode === 'none' || mode === 'resolved') return false;
    const heavy = page.locator('[data-attack-style="heavy"]');
    if (await heavy.count() > 0 && await heavy.isEnabled()) await heavy.click();
    else {
      const quick = page.locator('[data-attack-style="quick"]');
      if (await quick.count() > 0 && await quick.isEnabled()) await quick.click();
      else break;
    }
    await page.waitForTimeout(35);
  }
  return (await page.locator('.tag-exposed').count()) > 0;
}

async function driveToResolved(page: import('@playwright/test').Page): Promise<string> {
  for (let i = 0; i < 48; i += 1) {
    const mode = await page.locator('.game').getAttribute('data-encounter-mode');
    if (mode === 'none' || mode === 'resolved') return mode ?? 'none';
    const quick = page.locator('[data-attack-style="quick"]');
    const heavy = page.locator('[data-attack-style="heavy"]');
    if (await quick.count() > 0 && await quick.isEnabled()) await quick.click();
    else if (await heavy.count() > 0 && await heavy.isEnabled()) await heavy.click();
    else break;
    await page.waitForTimeout(35);
  }
  return (await page.locator('.game').getAttribute('data-encounter-mode')) ?? 'none';
}

test('Phase 4D-3 production encounter-as-hero feedback evidence', async ({ page }) => {
  ensureEvidenceDir();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  // ---- 深度验收：先在桌面端跑一遍 §2.1–§2.5 / §3 ----
  await page.setViewportSize({ width: 1280, height: 720 });
  await startGame(page, 'PHASE4B2-INJURED-4', 'scout');
  await reachEncounter(page);
  await focusEncounter(page);
  const active = await snapshot(page, '01-desktop-encounter-active');
  // §2.1 / §2.5：遭遇态是主视觉的一种状态，行动栏切到 combat 模式
  expect(active.encounterMode).toBe('active');
  expect(active.heroMode).toBe('encounter');
  expect(active.actionMode).toBe('combat');
  // §2.5：共用行动栏提供 6 个战斗动作（至少 5 个可见）
  expect(active.combatButtons).toBeGreaterThanOrEqual(5);
  // §2.1 去重：主视觉不渲染玩家立绘 / 玩家血条副本
  expect(active.hasPlayerPortraitLeak).toBe(false);
  // §3：敌方法定可见字段完整、无精确 HP 泄漏
  expect(active.enemyInfoText).not.toMatch(/\d+\/\d+/);
  expect((active.enemyInfoText as string).length).toBeGreaterThan(0);
  expect((active.sharedRateText as string)).toContain('脱离');
  expect((active.weaponText as string)).toContain('武器');
  expect(active.combatVisualStateHasIcon).toBe(true);
  expect(active.enemyVisualState).toBe('combat');
  expect(active.feedbackText).toBeTruthy();

  // §2.4 战斗记录按需展开 / 关闭（复用 useDrawerFocus，Esc 关闭）
  await page.locator('.encounter-hero-log-toggle').click();
  await expect(page.locator('.encounter-hero-log')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.encounter-hero-log')).toHaveCount(0);

  // §2.1 三态：combat → injured 随敌方生命变化切换
  const injuredMode = await driveToInjuredOrResolved(page);
  if (injuredMode === 'injured') {
    const injured = await snapshot(page, '02-desktop-encounter-injured');
    expect(injured.enemyVisualState).toBe('injured');
    expect(injured.combatVisualStateHasIcon).toBe(true);
  }

  // §3 EXPOSED：重击挥空产生（露出破绽）
  const exposed = await driveHeavyUntilExposedOrResolved(page);
  if (exposed) {
    const exp = await snapshot(page, '03-desktop-exposed');
    expect(exp.exposedTags).toBeGreaterThan(0);
    const exposedText = await page.locator('.tag-exposed').first().textContent();
    expect(exposedText).toContain('露出破绽');
  }

  // §2.3 遭遇结束：进入 resolved 结算态，结果作为一行即时反馈留在主视觉
  const finalMode = await driveToResolved(page);
  expect(finalMode === 'resolved' || finalMode === 'none').toBe(true);
  if (finalMode === 'resolved') {
    await focusEncounter(page);
    const resolved = await snapshot(page, '04-desktop-encounter-resolved');
    expect(resolved.encounterState).toBe('resolved');
    // §2.3 关键：没有「继续探索」按钮
    await expect(page.locator('.encounter-continue')).toHaveCount(0);
    expect(resolved.feedbackText).toBeTruthy();
  }

  // §2.3 / §4：玩家下一次行动顺带清场，无需点击关闭
  const settle = page.getByRole('button', { name: /^休息/ });
  if (await settle.count() > 0 && await settle.isEnabled()) {
    await settle.click();
    await expect(page.locator('.encounter-hero')).toHaveCount(0);
  }

  // ---- §4：五个视口均无横向溢出，6 战斗动作无需滚动即可触达 ----
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startGame(page, `PHASE4B5-ENCOUNTER-${viewport.name}`);
    await reachEncounter(page);
    await focusEncounterActions(page);
    const snap = await snapshot(page, `${viewport.name}-encounter`);
    expect(snap.bodyScrollWidth).toBe(viewport.width);
    expect(snap.documentScrollWidth).toBe(viewport.width);
    await assertCombatActionsReachable(page);
  }

  const errors = { consoleErrors, pageErrors };
  fs.writeFileSync(path.join(evidenceDir, 'runtime-errors.json'), `${JSON.stringify(errors, null, 2)}\n`);
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});
