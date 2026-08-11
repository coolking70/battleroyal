import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { killCharacter } from '../../src/core/vitals';
import { refreshZoneOccupants } from '../../src/core/gameState';
import { createStack } from '../../src/core/inventory';
import type { GameState } from '../../src/core/types';
import { GAME_CONFIG, GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';
import { newGame, npcs, player } from '../helpers';

const evidenceDir = path.resolve('output/phase4g1-browser');
const runtimePath = path.resolve('reports/phase4g1-runtime.json');

function serialize(state: GameState): Record<string, unknown> {
  return {
    version: GAME_VERSION,
    savedAt: 1,
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state,
  };
}

function stageCorpseEncounter(seed: string): GameState {
  const state = newGame(seed, 'fighter');
  const p = player(state);
  const npc = npcs(state)[0]!;
  npc.currentZoneId = p.currentZoneId;
  npc.inventory.push(createStack(state, 'wood'));
  npc.hp = 1;
  state.encounter = {
    enemyId: npc.id,
    zoneId: p.currentZoneId,
    startedAtTime: state.time,
    log: [],
    resolved: false,
  };
  state.engagedWithPlayer = [npc.id];
  killCharacter(state, npc, p.id, '战斗');
  refreshZoneOccupants(state);
  return state;
}

function stageActiveEncounter(seed: string): GameState {
  const state = newGame(seed, 'fighter');
  const p = player(state);
  const npc = npcs(state)[0]!;
  npc.currentZoneId = p.currentZoneId;
  npc.stamina = 0;
  state.encounter = {
    enemyId: npc.id,
    zoneId: p.currentZoneId,
    startedAtTime: state.time,
    log: [],
    resolved: false,
  };
  state.engagedWithPlayer = [npc.id];
  refreshZoneOccupants(state);
  return state;
}

async function loadFixture(page: Page, state: GameState): Promise<void> {
  await page.goto('/?fixture=phase4g1', { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: SAVE_KEY, value: serialize(state) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续上次对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
}

test.beforeAll(() => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
});

test('Phase 4G-1 production evidence: immediate loot, equal bars, and full-frame hot zones', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1280, height: 720 });
  await loadFixture(page, stageCorpseEncounter('PHASE4G1-BROWSER-CORPSE-DESKTOP'));
  await expect(page.locator('.encounter-hero-feedback')).toContainText('击杀战利品：3 件已落地，可拾取');
  const feedbackBox = await page.locator('.encounter-hero-feedback').boundingBox();
  expect(feedbackBox).not.toBeNull();
  expect(feedbackBox!.y + feedbackBox!.height).toBeLessThanOrEqual(720);
  await screenshot(page, '01-desktop-kill-loot-immediate');

  const desktopMetrics = await page.evaluate(() => {
    const hp = document.querySelector<HTMLElement>('.survival-metric-hp');
    const stamina = document.querySelector<HTMLElement>('.survival-metric-stamina');
    const growth = document.querySelector<HTMLElement>('.survival-metric-growth');
    const hpButton = document.querySelector<HTMLButtonElement>('.survival-metric-hp .bar-button');
    const staminaButton = document.querySelector<HTMLButtonElement>('.survival-metric-stamina .bar-button');
    const area = (rect: DOMRect | null): number => rect ? rect.width * rect.height : 0;
    const centerHit = (element: HTMLElement | null): string | null => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit?.closest('button')?.className ?? null;
    };
    const bars = Array.from(document.querySelectorAll<HTMLElement>('.survival-metric .bar'))
      .map((bar) => bar.getBoundingClientRect().height);
    return {
      residentMetricCount: document.querySelectorAll('.survival-metrics > .survival-metric').length,
      barHeights: bars,
      hpFrame: hp?.getBoundingClientRect().toJSON() ?? null,
      hpButtonFrame: hpButton?.getBoundingClientRect().toJSON() ?? null,
      staminaFrame: stamina?.getBoundingClientRect().toJSON() ?? null,
      growthFrame: growth?.getBoundingClientRect().toJSON() ?? null,
      hpHotzoneMinHeight: hpButton?.getBoundingClientRect().height ?? 0,
      staminaHotzoneMinHeight: staminaButton?.getBoundingClientRect().height ?? 0,
      hpLabelHit: centerHit(hp?.querySelector('.metric-label') ?? null),
      hpValueHit: centerHit(hp?.querySelector('b') ?? null),
      hotzoneFrameAreaRatio: hp && hpButton ? area(hpButton.getBoundingClientRect()) / area(hp.getBoundingClientRect()) : 0,
      actionButtons: document.querySelectorAll('.actionbar-combat-actions .btn').length,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      titleCount: document.querySelectorAll('[title]').length,
    };
  });
  expect(desktopMetrics.residentMetricCount).toBe(3);
  expect(new Set(desktopMetrics.barHeights)).toEqual(new Set([6]));
  expect(desktopMetrics.hpHotzoneMinHeight).toBeGreaterThanOrEqual(44);
  expect(desktopMetrics.staminaHotzoneMinHeight).toBeGreaterThanOrEqual(44);
  expect(desktopMetrics.hpLabelHit).toContain('vital-metric-button');
  expect(desktopMetrics.hpValueHit).toContain('vital-metric-button');
  expect(desktopMetrics.hotzoneFrameAreaRatio).toBeCloseTo(1, 5);
  expect(desktopMetrics.bodyScrollWidth).toBeLessThanOrEqual(1280);
  expect(desktopMetrics.documentScrollWidth).toBeLessThanOrEqual(1280);
  expect(desktopMetrics.titleCount).toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page, stageActiveEncounter('PHASE4G1-BROWSER-ACTIVE-MOBILE'));
  await expect(page.locator('.actionbar-combat-actions .btn')).toHaveCount(6);
  const mobileMetrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    titleCount: document.querySelectorAll('[title]').length,
    actionButtons: document.querySelectorAll('.actionbar-combat-actions .btn').length,
    actionbarBottom: document.querySelector('.actionbar')?.getBoundingClientRect().bottom ?? null,
  }));
  expect(mobileMetrics.bodyScrollWidth).toBeLessThanOrEqual(390);
  expect(mobileMetrics.documentScrollWidth).toBeLessThanOrEqual(390);
  expect(mobileMetrics.titleCount).toBe(0);
  await screenshot(page, '02-mobile-kill-loot-and-actions');

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  fs.writeFileSync(
    runtimePath,
    `${JSON.stringify({
      version: GAME_VERSION,
      levelExpThresholds: GAME_CONFIG.levelExpThresholds,
      desktop: desktopMetrics,
      mobile: mobileMetrics,
      loot: { count: 3, feedback: '击杀战利品：3 件已落地，可拾取。' },
      consoleErrors,
      pageErrors,
    }, null, 2)}\n`,
  );
});
