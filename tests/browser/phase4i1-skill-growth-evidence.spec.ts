import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { refreshZoneOccupants } from '../../src/core/gameState';
import type { Combatant, GameState } from '../../src/core/types';
import { GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';
import { newGame, npcs, player } from '../helpers';

const evidenceDir = path.resolve('output/phase4i1-browser');
const runtimePath = path.resolve('reports/phase4i1-runtime.json');

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

function stageEncounter(seed: string, level: number): { state: GameState; p: Combatant } {
  const state = newGame(seed, 'fighter');
  const p = player(state);
  const npc = npcs(state)[0]!;
  p.level = level;
  p.exp = 0;
  p.stamina = p.maxStamina;
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
  return { state, p };
}

async function loadFixture(page: Page, state: GameState): Promise<void> {
  await page.goto('/?fixture=phase4i1', { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: SAVE_KEY, value: serialize(state) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续上次对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

test('Phase 4I-1 player/NPC skill-growth presentation on production preview', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });

  await page.setViewportSize({ width: 1280, height: 720 });
  await loadFixture(page, stageEncounter('PHASE4I1-BROWSER-LOCKED', 2).state);
  await expect(page.locator('.actionbar-combat-actions > button, .actionbar-combat-actions > .combat-skill-pair')).toHaveCount(6);
  await expect(page.locator('.actionbar-combat-actions button')).toHaveCount(7);
  const locked = page.locator('button[data-skill-id="fighter_focus"]');
  await expect(locked).toBeVisible();
  await expect(locked).toBeDisabled();
  await expect(locked).toHaveAttribute('data-skill-locked', 'true');
  await expect(locked).toContainText('Lv.3 解锁');
  await expect(locked).toHaveAttribute('aria-label', /未解锁.*Lv\.3/);
  await page.screenshot({ path: path.join(evidenceDir, '01-desktop-locked-secondary-skill.png'), fullPage: false });

  await loadFixture(page, stageEncounter('PHASE4I1-BROWSER-UNLOCKED', 3).state);
  const unlocked = page.locator('button[data-skill-id="fighter_focus"]');
  await expect(unlocked).toBeEnabled();
  await expect(unlocked).toHaveAttribute('data-skill-locked', 'false');
  await unlocked.click();
  // 技能释放后，入口进入冷却态；战斗日志可能随后被 NPC 的同回合行动覆盖，
  // 因此用入口自身的机器可读状态作为 UI 证据。
  await expect(unlocked).toBeDisabled();
  await expect(unlocked).toContainText('冷却');
  await page.screenshot({ path: path.join(evidenceDir, '02-desktop-unlocked-secondary-skill.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page, stageEncounter('PHASE4I1-BROWSER-MOBILE', 3).state);
  const metrics = await page.evaluate(() => {
    const actions = Array.from(document.querySelectorAll<HTMLElement>('.actionbar-combat-actions button'));
    const slots = document.querySelectorAll('.actionbar-combat-actions > button, .actionbar-combat-actions > .combat-skill-pair');
    const inView = actions.filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight;
    }).length;
    return {
      slots: slots.length,
      controls: actions.length,
      controlsInView: inView,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      titleCount: document.querySelectorAll('[title]').length,
    };
  });
  expect(metrics.slots).toBe(6);
  expect(metrics.controls).toBe(7);
  expect(metrics.controlsInView).toBe(metrics.controls);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(390);
  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(390);
  expect(metrics.titleCount).toBe(0);
  await page.screenshot({ path: path.join(evidenceDir, '03-mobile-unlocked-secondary-skill.png'), fullPage: false });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  fs.writeFileSync(runtimePath, `${JSON.stringify({
    version: GAME_VERSION,
    locked: { secondary: 'fighter_focus', visible: true, usable: false, reason: '达到 Lv.3 后解锁' },
    unlocked: { secondary: 'fighter_focus', usable: true, feedback: '精准节拍' },
    mobile: metrics,
    consoleErrors,
    pageErrors,
  }, null, 2)}\n`);
});
