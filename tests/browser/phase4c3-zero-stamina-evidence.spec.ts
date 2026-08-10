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
  await expect(page.locator('[data-encounter-mode="active"]')).toHaveCount(1);
}

async function snapshot(
  page: import('@playwright/test').Page,
  name: string,
): Promise<Record<string, unknown>> {
  const runtime = await page.evaluate(() => {
    const guard = document.querySelector('[data-action="guard"]') as HTMLButtonElement | null;
    const flee = document.querySelector('[data-action="flee"]') as HTMLButtonElement | null;
    const encounter = document.querySelector('.encounter') as HTMLElement | null;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      encounterState: encounter?.getAttribute('data-encounter-state') ?? null,
      guard: guard ? { disabled: guard.disabled, text: guard.textContent } : null,
      flee: flee ? { disabled: flee.disabled, text: flee.textContent } : null,
      legalNote: document.querySelector('.encounter-legal-note')?.textContent ?? null,
      playerStatus: document.querySelector('.combatant-player')?.textContent ?? null,
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

test('Phase 4C-3 clean production zero-stamina deadlock evidence', async ({ page }) => {
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
  expect(desktop.guard).toMatchObject({ disabled: false });
  expect(desktop.flee).toMatchObject({ disabled: false });
  expect(desktop.legalNote).toContain('防御本回合免费');
  expect(desktop.legalNote).toContain('原地脱离');

  await page.locator('[data-action="flee"]').click();
  await expect(page.locator('[data-encounter-mode="active"]')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('原地脱离');
  const afterFlee = await snapshot(page, '02-desktop-after-stationary-flee');
  // Phase 4D-1 起脱离不再让遭遇面板凭空消失：它进入 resolved 结算态，
  // 玩家读完结果后自己关闭。这里跟随那个已验收的行为，而不是旧的"直接清空"。
  expect(afterFlee.encounterState).toBe('resolved');
  await expect(page.locator('.encounter-continue')).toBeVisible();
  await page.locator('.encounter-continue').click();
  await expect(page.locator('.encounter')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page);
  await focusEncounterActions(page);
  const mobile = await snapshot(page, '03-mobile-zero-stamina-deadlock');
  expect(mobile.bodyScrollWidth).toBe(390);
  expect(mobile.documentScrollWidth).toBe(390);
  expect(mobile.guard).toMatchObject({ disabled: false });
  expect(mobile.flee).toMatchObject({ disabled: false });

  fs.writeFileSync(
    path.join(evidenceDir, 'runtime-errors.json'),
    `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`,
  );
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
