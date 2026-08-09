import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { createGame, getPlayer, refreshZoneOccupants } from '../../src/core/gameState';
import { GAME_CONFIG, GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';

const evidenceDir = path.resolve('output/phase4c12-browser');
type Outcome = 'won' | 'lost' | 'draw';

function resultFixture(outcome: Outcome): Record<string, unknown> {
  const state = createGame({
    seed: `PHASE4C12-${outcome}`,
    playerCharacterId: 'scout',
    playerName: '结算验证者',
  });
  const player = getPlayer(state);
  state.time = outcome === 'draw' ? GAME_CONFIG.hardTimeLimit - 1 : 12;
  state.endedAtTime = null;
  state.encounter = null;
  state.pendingPickup = null;
  state.deathOrder = [];

  if (outcome === 'lost') {
    player.alive = false;
    player.hp = 0;
    player.diedAtTime = state.time;
    state.deathOrder = [player.id];
  } else if (outcome === 'won') {
    for (const character of Object.values(state.characters)) {
      if (character.isPlayer) continue;
      character.alive = false;
      character.hp = 0;
      character.diedAtTime = state.time;
      state.deathOrder.push(character.id);
    }
  }

  // Keep the fixture resumable. The debug time-step command applies the
  // real end-of-game checks and produces the selected result in the app.
  state.status = 'playing';
  state.endReason = null;

  refreshZoneOccupants(state);
  return {
    version: GAME_VERSION,
    savedAt: 1,
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state,
  };
}

async function loadFixture(page: import('@playwright/test').Page, state: Record<string, unknown>): Promise<void> {
  await page.goto('/?fixture=phase4c12&debug=1', { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: state,
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续上次对局' }).click();
  await page.getByRole('button', { name: '推进时间' }).click();
  await expect(page.locator('main.result')).toHaveCount(1);
}

test('Phase 4C-12 production result semantics across all outcomes', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  const labels: Record<Outcome, string> = {
    won: '最后生还',
    lost: '淘汰出局',
    draw: '平局 · 时间耗尽',
  };

  for (const outcome of ['won', 'lost', 'draw'] as const) {
    await page.setViewportSize(outcome === 'lost' ? { width: 390, height: 844 } : { width: 1280, height: 720 });
    await loadFixture(page, resultFixture(outcome));
    await page.locator('.debug .debug-head button').click();
    await expect(page.locator('#result-title')).toContainText(labels[outcome]);
    await page.locator('#result-title').evaluate((node) => {
      (node as HTMLElement).focus({ preventScroll: true });
    });
    await expect(page.locator('#result-title')).toBeFocused();
    await expect(page.locator('main.result')).toHaveAttribute('aria-labelledby', 'result-title');
    await expect(page.locator('.result-inner > section[aria-labelledby]')).toHaveCount(3);
    await expect(page.locator('.rank-table')).toHaveAttribute('aria-label', '最终排名表');

    const snapshot = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      scrollY: window.scrollY,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      heading: document.querySelector('#result-title')?.textContent?.trim() ?? null,
      focused: document.activeElement?.id ?? null,
      timelineRole: document.querySelector('.timeline')?.getAttribute('aria-label') ?? null,
      heroRect: document.querySelector('.result-hero')?.getBoundingClientRect().toJSON() ?? null,
      titleRect: document.querySelector('#result-title')?.getBoundingClientRect().toJSON() ?? null,
    }));
    fs.writeFileSync(path.join(evidenceDir, `${outcome}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
    await page.screenshot({ path: path.join(evidenceDir, `${outcome}.png`), fullPage: false });
    expect(snapshot.bodyScrollWidth).toBe(snapshot.viewport.width);
    expect(snapshot.documentScrollWidth).toBe(snapshot.viewport.width);
    expect(snapshot.focused).toBe('result-title');
    expect(snapshot.timelineRole).toBe('关键事件时间线');
  }

  fs.writeFileSync(path.join(evidenceDir, 'runtime-errors.json'), `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
