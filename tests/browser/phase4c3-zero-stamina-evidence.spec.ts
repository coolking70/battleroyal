import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createGame, getPlayer, refreshZoneOccupants } from '../../src/core/gameState';
import { clearInventory } from '../helpers';
import { GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';
import { scrollEncounterActionsIntoView } from './scrollHelpers';

const evidenceDir = path.resolve('output/phase4c3-browser');

function makeDeadlockFixture(): Record<string, unknown> {
  const state = createGame({
    seed: 'PHASE4C3-BROWSER-DEADLOCK',
    playerCharacterId: 'scout',
    playerName: '验收玩家',
  });
  const p = getPlayer(state);
  const enemy = state.turnOrder
    .map((id) => state.characters[id])
    .find((character) => character && !character.isPlayer);
  if (!enemy) throw new Error('fixture enemy missing');

  enemy.currentZoneId = p.currentZoneId;
  enemy.alive = true;
  enemy.stamina = enemy.maxStamina;
  p.stamina = 0;
  p.hp = Math.min(p.maxHp, 80);
  clearInventory(p);
  refreshZoneOccupants(state);
  state.encounter = {
    enemyId: enemy.id,
    zoneId: p.currentZoneId,
    startedAtTime: state.time,
    log: [],
    resolved: false,
  };
  for (const zone of Object.values(state.zones)) {
    if (zone.id !== p.currentZoneId) zone.status = 'restricted';
  }

  return {
    version: GAME_VERSION,
    savedAt: 1,
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state,
  };
}

async function loadFixture(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?fixture=phase4c3-deadlock', { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: makeDeadlockFixture(),
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续上次对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
  // 遭遇态：主视觉切到 encounter，行动栏切到 6 个战斗动作（Phase 4D-3）。
  await expect(page.locator('[data-encounter-mode="active"]')).toHaveCount(1);
}

async function snapshot(
  page: import('@playwright/test').Page,
  name: string,
): Promise<Record<string, unknown>> {
  const runtime = await page.evaluate(() => {
    const guard = document.querySelector('[data-action="guard"]') as HTMLButtonElement | null;
    const flee = document.querySelector('[data-action="flee"]') as HTMLButtonElement | null;
    const hero = document.querySelector('.encounter-hero') as HTMLElement | null;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      encounterState: hero?.getAttribute('data-encounter-state') ?? null,
      heroMode: document.querySelector('.zone-hero')?.getAttribute('data-hero-mode') ?? null,
      actionMode: document.querySelector('.actionbar')?.getAttribute('data-action-mode') ?? null,
      guard: guard ? { disabled: guard.disabled, text: guard.textContent } : null,
      flee: flee ? { disabled: flee.disabled, text: flee.textContent } : null,
      // 4D-3：合法提示落在底部共用行动栏的 #actionbar-hint（不再是 .encounter-legal-note）
      legalNote: document.querySelector('#actionbar-hint')?.textContent ?? null,
      // §2.1 去重：主视觉里绝不出现玩家立绘 / 玩家血条副本
      playerPortraitLeaked: Boolean(document.querySelector('.encounter-hero .combatant-player')),
      renderState: window.render_game_to_text?.() ?? null,
    };
  });
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
  fs.writeFileSync(path.join(evidenceDir, `${name}.json`), `${JSON.stringify(runtime, null, 2)}\n`);
  return runtime;
}

async function focusEncounterActions(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(scrollEncounterActionsIntoView);
  await page.waitForTimeout(60);
}

/** 6 个战斗动作（速攻/普通/重击/防御/逃跑/技能）全部钉在视口底部行动栏，无需滚动即可触达。 */
async function assertCombatActionsReachable(page: import('@playwright/test').Page): Promise<void> {
  const check = await page.evaluate(() => {
    const topbarBottom = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>('.actionbar-combat-actions button'),
    );
    const inView = buttons.filter((button) => {
      const rect = button.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top >= topbarBottom &&
        rect.bottom <= window.innerHeight
      );
    }).length;
    return { total: buttons.length, inView };
  });
  expect(check.total, `应至少 5 个战斗动作（3 攻击 + 防御 + 逃跑），实际 ${check.total}`).toBeGreaterThanOrEqual(5);
  expect(check.inView, `全部战斗动作应无需滚动即在视口内，实际 ${check.inView}/${check.total}`).toBe(check.total);
}

test('Phase 4C-3 clean production zero-stamina deadlock evidence (4D-3 hero merge)', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1280, height: 720 });
  await loadFixture(page);
  await focusEncounterActions(page);
  const desktop = await snapshot(page, '01-desktop-zero-stamina-deadlock');
  expect(desktop.encounterState).toBe('active');
  expect(desktop.actionMode).toBe('combat');
  expect(desktop.heroMode).toBe('encounter');
  expect(desktop.guard).toMatchObject({ disabled: false });
  expect(desktop.flee).toMatchObject({ disabled: false });
  expect(desktop.legalNote).toContain('防御本回合免费');
  expect(desktop.legalNote).toContain('原地脱离');
  // §2.1 去重：主视觉没有玩家立绘 / 玩家血条副本
  expect(desktop.playerPortraitLeaked).toBe(false);
  await assertCombatActionsReachable(page);

  await page.locator('[data-action="flee"]').click();
  await expect(page.locator('[data-encounter-mode="active"]')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('原地脱离');
  const afterFlee = await snapshot(page, '02-desktop-after-stationary-flee');
  // §2.3 遭遇结束进入 resolved 结算态，结果作为一行即时反馈留在主视觉上。
  expect(afterFlee.encounterState).toBe('resolved');
  // §2.3 关键：没有「继续探索」按钮 —— 玩家下一次行动顺带清场。
  await expect(page.locator('.encounter-continue')).toHaveCount(0);
  const feedback = await page.locator('.encounter-hero-feedback').textContent();
  // §2.3 + 4D-1：脱离结果以一行即时反馈留在主视觉上（两处脱离提示之一；
  // 另一处是上方的 toast「原地脱离」）。这里校验主视觉反馈确实包含脱离结果。
  expect(feedback).toContain('脱离');
  // §2.3：下一次行动（休息）自然清掉结算态，无需点击关闭。
  // 先收掉刚弹出的「原地脱离」toast，避免它遮挡底部行动栏导致按钮不可点。
  const toast = page.locator('.toast');
  if (await toast.count() > 0 && await toast.isVisible()) {
    await toast.click({ force: true });
    await page.waitForTimeout(60);
  }
  await page.getByRole('button', { name: /^休息/ }).click();
  // §2.3 关键证据：resolved 结算态被下一次行动自动清掉（无「继续探索」按钮）。
  // 注：本 fixture 敌人仍在本区域，休息有 45% 概率被偷袭而重新开战（新 active 遭遇），
  // 这是正常机制、不构成死锁；我们只断言「resolved 结算态已消失」。
  await expect(page.locator('.encounter-hero[data-encounter-state="resolved"]')).toHaveCount(0);
  // 无论是否重新开战，玩家都绝不会卡死：要么回到探索态，要么进入新的可操作战斗态。
  const postRest = await page.evaluate(() => {
    const hero = document.querySelector('.encounter-hero');
    return {
      heroMode: document.querySelector('.zone-hero')?.getAttribute('data-hero-mode') ?? null,
      encounterState: hero?.getAttribute('data-encounter-state') ?? null,
    };
  });
  expect(postRest.heroMode === 'exploration' || postRest.heroMode === 'encounter').toBe(true);
  if (postRest.encounterState === 'active') {
    // 重新开战也仍可用：6 个战斗动作钉在视口底部，无需滚动即可触达。
    await assertCombatActionsReachable(page);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page);
  await focusEncounterActions(page);
  const mobile = await snapshot(page, '03-mobile-zero-stamina-deadlock');
  expect(mobile.bodyScrollWidth).toBe(390);
  expect(mobile.documentScrollWidth).toBe(390);
  expect(mobile.guard).toMatchObject({ disabled: false });
  expect(mobile.flee).toMatchObject({ disabled: false });
  await assertCombatActionsReachable(page);

  fs.writeFileSync(
    path.join(evidenceDir, 'runtime-errors.json'),
    `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`,
  );
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
