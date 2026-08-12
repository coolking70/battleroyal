import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { refreshZoneOccupants } from '../../src/core/gameState';
import { killCharacter } from '../../src/core/vitals';
import { createStack } from '../../src/core/inventory';
import type { GameState, WorldEventState } from '../../src/core/types';
import { GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';
import { newGame, npcs, player } from '../helpers';

const evidenceDir = path.resolve('output/phase4g2-browser');
const runtimePath = path.resolve('reports/phase4g2-runtime.json');

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

function stageKillerCorpse(seed: string): GameState {
  const state = newGame(seed, 'fighter');
  const p = player(state);
  const victim = npcs(state)[0]!;
  victim.currentZoneId = p.currentZoneId;
  victim.inventory.push(createStack(state, 'field_spear'));
  state.encounter = {
    enemyId: victim.id,
    zoneId: p.currentZoneId,
    startedAtTime: state.time,
    log: [],
    resolved: false,
  };
  state.engagedWithPlayer = [victim.id];
  killCharacter(state, victim, p.id, '战斗');
  refreshZoneOccupants(state);
  return state;
}

function stageThirdParty(seed: string): GameState {
  const state = newGame(seed, 'fighter');
  const p = player(state);
  const [killer, victim] = npcs(state);
  if (!killer || !victim) throw new Error('缺少第三方战利品夹具角色');
  killer.currentZoneId = p.currentZoneId;
  victim.currentZoneId = p.currentZoneId;
  victim.inventory.push(createStack(state, 'field_spear'));
  killCharacter(state, victim, killer.id, '战斗');
  refreshZoneOccupants(state);
  return state;
}

function stageWorldBanners(seed: string): GameState {
  const state = newGame(seed, 'fighter');
  const events: WorldEventState[] = [
    {
      id: 'phase4g2-critical',
      eventId: 'research_anomaly',
      scope: 'zone',
      zoneId: 'lab',
      startedAtTime: state.time,
      remaining: 1,
      label: '研究异常',
      description: '研究所设施失控：每时间单位造成环境伤害。',
    },
    {
      id: 'phase4g2-ambient',
      eventId: 'rain',
      scope: 'global',
      zoneId: null,
      startedAtTime: state.time,
      remaining: 4,
      label: '连绵阴雨',
      description: '全城降雨：移动体力增加。',
    },
  ];
  state.activeWorldEvents = events;
  return state;
}

function stageActiveEncounter(seed: string): GameState {
  const state = newGame(seed, 'fighter');
  const p = player(state);
  const foe = npcs(state)[0]!;
  foe.currentZoneId = p.currentZoneId;
  foe.stamina = 0;
  state.encounter = {
    enemyId: foe.id,
    zoneId: p.currentZoneId,
    startedAtTime: state.time,
    log: [`你与 ${foe.name} 正面遭遇。`],
    resolved: false,
  };
  state.engagedWithPlayer = [foe.id];
  refreshZoneOccupants(state);
  return state;
}

async function loadFixture(page: Page, state: GameState): Promise<void> {
  await page.goto('/?fixture=phase4g2', { waitUntil: 'networkidle' });
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

test('Phase 4G-2 production evidence: owned loot, hidden third-party loot, and hero banners', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1280, height: 720 });
  await loadFixture(page, stageKillerCorpse('PHASE4G2-BROWSER-KILLER'));
  await expect(page.locator('.encounter-hero-feedback')).toContainText('击杀战利品：该对手遗留了物资，可拾取');
  await expect(page.locator('.encounter-hero-feedback')).not.toContainText(/\d+\s*件/);
  await expect(page.locator('.ground-list')).toBeVisible();
  const killerFeedbackBox = await page.locator('.encounter-hero-feedback').boundingBox();
  expect(killerFeedbackBox).not.toBeNull();
  expect(killerFeedbackBox!.y + killerFeedbackBox!.height).toBeLessThanOrEqual(720);
  await screenshot(page, '01-desktop-killer-loot');

  await loadFixture(page, stageThirdParty('PHASE4G2-BROWSER-THIRD-PARTY'));
  await expect(page.locator('.ground-list')).toHaveCount(0);
  await expect(page.locator('[data-item-id="field_spear"]')).toHaveCount(0);
  await expect(page.locator('.corpse-loot-notice')).toHaveCount(0);
  await screenshot(page, '02-desktop-third-party-hidden');

  await loadFixture(page, stageWorldBanners('PHASE4G2-BROWSER-WORLD-BANNERS'));
  await expect(page.locator('.zone-hero-event-banners .event-banner-hero')).toHaveCount(2);
  await expect(page.locator('.stage-content .event-banner-wrap')).toHaveCount(0);
  await expect(page.locator('.zone-hero-event-banners')).toContainText('直接威胁');
  await expect(page.locator('.zone-hero-event-banners')).toContainText('即将结束');
  await expect(page.locator('.zone-hero-event-banners')).toContainText('持续中');
  await screenshot(page, '03-desktop-world-event-banners');

  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page, stageWorldBanners('PHASE4G2-BROWSER-WORLD-BANNERS-MOBILE'));
  await expect(page.locator('.zone-hero-event-banners .event-banner-hero')).toHaveCount(2);
  const mobileMetrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    titleCount: document.querySelectorAll('[title]').length,
    heroHeading: document.querySelector('.zone-hero-heading')?.getBoundingClientRect().toJSON() ?? null,
    zoneTitle: document.querySelector('.zone-hero-heading h2')?.getBoundingClientRect().toJSON() ?? null,
    bannerWrap: document.querySelector('.zone-hero-event-banners')?.getBoundingClientRect().toJSON() ?? null,
    bannerRects: Array.from(document.querySelectorAll('.zone-hero-event-banners .event-banner-hero'))
      .map((element) => element.getBoundingClientRect().toJSON()),
    residentBlocks: ['.topbar', '.zone-rail', '.zone-hero', '.craft-goal-bar', '.actionbar']
      .filter((selector) => Boolean(document.querySelector(selector))),
  }));
  expect(mobileMetrics.bodyScrollWidth).toBeLessThanOrEqual(390);
  expect(mobileMetrics.documentScrollWidth).toBeLessThanOrEqual(390);
  expect(mobileMetrics.titleCount).toBe(0);
  expect(mobileMetrics.residentBlocks).toHaveLength(5);
  await screenshot(page, '04-mobile-world-event-banners');

  await loadFixture(page, stageActiveEncounter('PHASE4G2-BROWSER-ACTIVE-MOBILE'));
  await expect(page.locator('.actionbar-combat-actions > button')).toHaveCount(7);
  const encounterMetrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    actionButtons: document.querySelectorAll('.actionbar-combat-actions button').length,
    titleCount: document.querySelectorAll('[title]').length,
  }));
  expect(encounterMetrics.bodyScrollWidth).toBeLessThanOrEqual(390);
  expect(encounterMetrics.documentScrollWidth).toBeLessThanOrEqual(390);
  expect(encounterMetrics.actionButtons).toBe(7);
  expect(encounterMetrics.titleCount).toBe(0);
  await screenshot(page, '05-mobile-encounter-actions');

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  fs.writeFileSync(
    runtimePath,
    `${JSON.stringify({
      version: GAME_VERSION,
      killer: {
        feedback: '击杀战利品：该对手遗留了物资，可拾取。',
        feedbackVisibleWithoutScroll: killerFeedbackBox!.y + killerFeedbackBox!.height <= 720,
        promptHasQuantity: false,
        groundListVisible: true,
      },
      thirdParty: {
        groundListVisible: false,
        corpseItemVisible: false,
        corpseQuantityExposed: false,
      },
      worldBanners: {
        desktopInHero: true,
        mobile: mobileMetrics,
      },
      encounter: encounterMetrics,
      consoleErrors,
      pageErrors,
    }, null, 2)}\n`,
  );
});
