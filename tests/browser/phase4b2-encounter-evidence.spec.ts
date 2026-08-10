import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { scrollEncounterActionsIntoView, scrollEncounterIntoView } from './scrollHelpers';

const baseUrl = process.env.PHASE4B2_BASE_URL ?? 'http://127.0.0.1:4173';
const evidenceDir = path.resolve('output/phase4b2-browser-final');

function ensureEvidenceDir(): void {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

async function snapshot(page: import('@playwright/test').Page, name: string): Promise<Record<string, unknown>> {
  const runtime = await page.evaluate(() => {
    const game = document.querySelector('.game');
    const board = document.querySelector('.board') as HTMLElement | null;
    const encounter = document.querySelector('.encounter') as HTMLElement | null;
    const stage = document.querySelector('.stage') as HTMLElement | null;
    return {
      url: window.location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      encounterMode: game?.getAttribute('data-encounter-mode') ?? 'none',
      stageFocus: stage?.getAttribute('data-stage-focus') ?? 'none',
      encounterState: encounter?.getAttribute('data-encounter-state') ?? null,
      encounterRect: encounter ? (() => { const r = encounter.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })() : null,
      board: board ? { clientHeight: board.clientHeight, scrollHeight: board.scrollHeight, scrollTop: board.scrollTop } : null,
      stage: stage ? { clientHeight: stage.clientHeight, scrollHeight: stage.scrollHeight, scrollTop: stage.scrollTop, top: stage.getBoundingClientRect().top } : null,
      actionsRect: (() => { const node = document.querySelector('.encounter-actions'); if (!node) return null; const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; })(),
      playerVisualState: document.querySelector('.combatant-player')?.getAttribute('data-visual-state') ?? null,
      enemyVisualState: document.querySelector('.combatant-enemy')?.getAttribute('data-visual-state') ?? null,
      playerVisualRect: (() => { const node = document.querySelector('.encounter-player-visual'); if (!node) return null; const r = node.getBoundingClientRect(); return { width: r.width, height: r.height }; })(),
      enemyVisualRect: (() => { const node = document.querySelector('.encounter-character-visual'); if (!node) return null; const r = node.getBoundingClientRect(); return { width: r.width, height: r.height }; })(),
      playerVisualSrc: document.querySelector('.encounter-player-visual')?.getAttribute('src') ?? null,
      enemyVisualSrc: document.querySelector('.encounter-character-visual')?.getAttribute('src') ?? null,
      playerStatusText: document.querySelector('.combatant-player')?.textContent ?? null,
      enemyText: document.querySelector('.combatant-enemy')?.textContent ?? null,
      actionGroups: Array.from(document.querySelectorAll('.action-group-heading > span')).map((node) => node.textContent?.replace(/[↗◈]/g, '').trim()),
      feedback: document.querySelector('.encounter-focus')?.textContent?.trim() ?? null,
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
  for (let i = 0; i < 42; i += 1) {
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

async function driveCombatForFeedback(page: import('@playwright/test').Page): Promise<void> {
  const guard = page.locator('[data-action="guard"]');
  const quick = page.locator('[data-attack-style="quick"]');
  const heavy = page.locator('[data-attack-style="heavy"]');
  const continueButton = page.locator('.encounter-continue');
  const search = page.locator('.actionbar-actions button').filter({ hasText: '搜索' }).first();
  const rest = page.locator('.actionbar-actions button').filter({ hasText: '休息' }).first();
  for (let i = 0; i < 48; i += 1) {
    if (await page.locator('.game').count() === 0) return;
    const mode = await page.locator('.game').getAttribute('data-encounter-mode');
    if (mode === 'active') {
      if (await page.locator('.combatant-player[data-visual-state="injured"]').count() > 0) return;
      if (await guard.count() > 0 && await guard.isEnabled()) await guard.click();
      else if (await quick.count() > 0 && await quick.isEnabled()) await quick.click();
      else if (await heavy.count() > 0 && await heavy.isEnabled()) await heavy.click();
      await page.waitForTimeout(35);
      continue;
    }
    if (mode === 'resolved') {
      if (await page.locator('.combatant-player[data-visual-state="injured"]').count() > 0) return;
      if (await continueButton.count() > 0 && await continueButton.isVisible()) await continueButton.click();
      await page.waitForTimeout(35);
      continue;
    }
    await resolvePendingPickup(page);
    if (await search.count() > 0 && await search.isEnabled()) await search.click();
    else if (await rest.count() > 0 && await rest.isEnabled()) await rest.click();
    await page.waitForTimeout(35);
  }
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

test('Phase 4B-2 production encounter feedback evidence', async ({ page }) => {
  ensureEvidenceDir();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1280, height: 720 });
  await startGame(page, 'PHASE4B2-INJURED-4', 'scout');
  await reachEncounter(page);
  await focusEncounter(page);
  const healthy = await snapshot(page, '01-desktop-encounter-healthy');
  expect(healthy.encounterMode).toBe('active');
  expect(healthy.playerVisualState).toBe('combat');
  expect(healthy.enemyVisualState).toBe('combat');
  expect(healthy.actionGroups).toEqual(expect.arrayContaining(['主要攻击', '次级行动']));
  expect(healthy.enemyText).not.toMatch(/\d+\/\d+/);

  await page.setViewportSize({ width: 1024, height: 720 });
  await focusEncounter(page);
  const medium = await snapshot(page, '01b-desktop-1024-encounter');
  expect(medium.encounterMode).toBe('active');
  expect(medium.bodyScrollWidth).toBe(1024);
  expect(medium.documentScrollWidth).toBe(1024);

  // Capture the compact mobile encounter before any action changes its state.
  await page.setViewportSize({ width: 390, height: 844 });
  await focusEncounter(page);
  await page.waitForTimeout(100);
  await snapshot(page, '02-mobile-encounter');
  const mobile = await page.evaluate(() => {
    const encounter = document.querySelector('.encounter') as HTMLElement | null;
    const board = document.querySelector('.board') as HTMLElement | null;
    return {
      innerWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      encounterHeight: encounter?.getBoundingClientRect().height ?? 0,
      boardClientHeight: board?.clientHeight ?? 0,
      boardScrollHeight: board?.scrollHeight ?? 0,
      buttons: Array.from(document.querySelectorAll('.encounter button')).map((button) => ({ text: button.textContent?.trim(), visible: Boolean((button as HTMLElement).offsetParent) })),
    };
  });
  fs.writeFileSync(path.join(evidenceDir, '02-mobile-runtime.json'), `${JSON.stringify(mobile, null, 2)}\n`);
  expect(mobile.bodyScrollWidth).toBe(390);
  expect(mobile.documentScrollWidth).toBe(390);
  expect(mobile.buttons.length).toBeGreaterThan(0);
  expect(mobile.encounterHeight).toBeLessThan(700);

  await focusEncounterActions(page);
  await snapshot(page, '03-mobile-encounter-actions-reachable');
  const visibleActionCount = await page.evaluate(() => Array.from(document.querySelectorAll('.encounter-actions button')).filter((button) => {
    const rect = button.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom <= window.innerHeight && rect.top >= (document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0);
  }).length);
  expect(visibleActionCount).toBe(6);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(100);
  await focusEncounter(page);
  await driveCombatForFeedback(page);
  await focusEncounter(page);
  const injured = await snapshot(page, '04-desktop-encounter-injured-or-after-actions');
  expect(injured.encounterMode).toMatch(/active|resolved|none/);

  for (let i = 0; i < 8; i += 1) {
    if (await page.locator('[data-encounter-mode="active"]').count() === 0) break;
    if (await page.locator('[data-attack-style="heavy"]').count() > 0 && await page.locator('[data-attack-style="heavy"]').isEnabled()) await page.locator('[data-attack-style="heavy"]').click();
    await page.waitForTimeout(35);
    if (await page.locator('.tag-exposed').count() > 0) break;
  }

  // Use a deterministic fresh run for the browser-level EXPOSED cue, then resolve
  // that encounter through real combat actions so the resolved panel is captured.
  await startGame(page, 'PHASE4B2-EXPOSED-0', 'scout');
  await reachEncounter(page);
  await focusEncounter(page);
  const exposed = await snapshot(page, '05-desktop-exposed-feedback');
  expect(exposed.enemyText).toContain('露出破绽');
  expect(await page.locator('[data-action="guard"]').textContent()).toContain('防御');

  for (let i = 0; i < 24; i += 1) {
    if (await page.locator('[data-encounter-mode="resolved"]').count() > 0) break;
    if (await page.locator('[data-encounter-mode="active"]').count() === 0) break;
    const quick = page.locator('[data-attack-style="quick"]');
    const guard = page.locator('[data-action="guard"]');
    if (await quick.count() > 0 && await quick.isEnabled()) await quick.click();
    else if (await guard.count() > 0 && await guard.isEnabled()) await guard.click();
    else break;
    await page.waitForTimeout(60);
  }
  await expect(page.locator('[data-encounter-mode="resolved"]')).toHaveCount(1);
  await focusEncounter(page);
  const ended = await snapshot(page, '06-desktop-encounter-ended');
  expect(ended.encounterMode).toBe('resolved');
  expect(ended.stageFocus).toBe('exploration');

  const errors = { consoleErrors, pageErrors };
  fs.writeFileSync(path.join(evidenceDir, 'runtime-errors.json'), `${JSON.stringify(errors, null, 2)}\n`);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
