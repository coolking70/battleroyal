import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { refreshZoneOccupants } from '../../src/core/gameState';
import { experienceToNextLevel } from '../../src/core/progression';
import type { Combatant, GameState } from '../../src/core/types';
import { GAME_CONFIG, GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';
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

function stageEncounter(
  seed: string,
  characterId: Combatant['characterId'] = 'fighter',
  level = 3,
  exp = 0,
): { state: GameState; p: Combatant } {
  const state = newGame(seed, characterId);
  const p = player(state);
  const npc = npcs(state)[0]!;
  p.level = level;
  p.exp = exp;
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
  await loadFixture(page, stageEncounter('PHASE4I1-BROWSER-LOCKED', 'fighter', 2).state);
  await expect(page.locator('.actionbar-combat-actions > button')).toHaveCount(7);
  await expect(page.locator('.actionbar-combat-actions button')).toHaveCount(7);
  await expect(page.locator('.actionbar-combat-actions [data-attack-style], .actionbar-combat-actions [data-action="guard"], .actionbar-combat-actions [data-action="flee"], .actionbar-combat-actions [data-skill-role="primary"]')).toHaveCount(6);
  await expect(page.locator('.actionbar-combat-actions [data-skill-role="secondary"]')).toHaveCount(1);
  const locked = page.locator('button[data-skill-id="fighter_focus"]');
  await expect(locked).toBeVisible();
  await expect(locked).toBeDisabled();
  await expect(locked).toHaveAttribute('data-skill-locked', 'true');
  await expect(locked).toContainText('Lv.3 解锁');
  await expect(locked).toHaveAttribute('aria-label', /未解锁.*Lv\.3/);
  await page.screenshot({ path: path.join(evidenceDir, '01-desktop-locked-secondary-skill.png'), fullPage: false });

  const unlockFixture = stageEncounter(
    'PHASE4I1-BROWSER-UNLOCK-MOMENT',
    'fighter',
    2,
    experienceToNextLevel(2) - GAME_CONFIG.expCombatParticipation,
  );
  await loadFixture(page, unlockFixture.state);
  const unlocked = page.locator('button[data-skill-id="fighter_focus"]');
  await expect(unlocked).toBeDisabled();
  await page.locator('button[data-attack-style="normal"]').click();
  await expect(page.locator('.toast')).toContainText('升级 Lv.3');
  await expect(unlocked).toBeEnabled();
  await expect(unlocked).toHaveAttribute('data-skill-locked', 'false');
  await page.screenshot({ path: path.join(evidenceDir, '02-desktop-level-3-unlock-moment.png'), fullPage: false });

  const secondaryEvidence = [
    { characterId: 'scout' as const, skillId: 'scout_smoke', file: '03-desktop-scout-secondary-used.png' },
    { characterId: 'fighter' as const, skillId: 'fighter_focus', file: '04-desktop-fighter-secondary-used.png' },
    { characterId: 'engineer' as const, skillId: 'engineer_reinforce', file: '05-desktop-engineer-secondary-used.png' },
    { characterId: 'medic' as const, skillId: 'medic_regen', file: '06-desktop-medic-secondary-used.png' },
  ];
  for (const item of secondaryEvidence) {
    await loadFixture(page, stageEncounter(`PHASE4I1-BROWSER-${item.characterId.toUpperCase()}`, item.characterId).state);
    const secondary = page.locator(`button[data-skill-id="${item.skillId}"]`);
    await expect(secondary).toBeEnabled();
    await secondary.click();
    await expect(secondary).toBeDisabled();
    await expect(secondary).toContainText('冷却');
    await page.screenshot({ path: path.join(evidenceDir, item.file), fullPage: false });
  }

  const desktopMetrics = await page.evaluate(() => {
    const actions = Array.from(document.querySelectorAll<HTMLElement>('.actionbar-combat-actions button'));
    return {
      controls: actions.length,
      controlsInView: actions.filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight;
      }).length,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(desktopMetrics.controlsInView).toBe(desktopMetrics.controls);
  expect(desktopMetrics.bodyScrollWidth).toBeLessThanOrEqual(1280);
  expect(desktopMetrics.documentScrollWidth).toBeLessThanOrEqual(1280);

  await page.setViewportSize({ width: 390, height: 844 });
  await loadFixture(page, stageEncounter('PHASE4I1-BROWSER-MOBILE', 'fighter').state);
  const metrics = await page.evaluate(() => {
    const actions = Array.from(document.querySelectorAll<HTMLElement>('.actionbar-combat-actions button'));
    const slots = document.querySelectorAll('.actionbar-combat-actions > button');
    const existingActions = document.querySelectorAll('.actionbar-combat-actions [data-attack-style], .actionbar-combat-actions [data-action="guard"], .actionbar-combat-actions [data-action="flee"], .actionbar-combat-actions [data-skill-role="primary"]');
    const planning = document.querySelector<HTMLElement>('.planning-drawer-trigger')?.getBoundingClientRect();
    const inView = actions.filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight;
    }).length;
    const planningIntersectsActions = planning
      ? actions.some((button) => {
          const rect = button.getBoundingClientRect();
          return rect.left < planning.right && rect.right > planning.left && rect.top < planning.bottom && rect.bottom > planning.top;
        })
      : false;
    return {
      slots: slots.length,
      controls: actions.length,
      existingActions: existingActions.length,
      secondaryActions: document.querySelectorAll('.actionbar-combat-actions [data-skill-role="secondary"]').length,
      controlsInView: inView,
      planningIntersectsActions,
      skillButtons: actions
        .filter((button) => button.dataset.action === 'skill')
        .map((button) => ({
          role: button.dataset.skillRole,
          className: button.className,
          gridColumn: getComputedStyle(button).gridColumn,
          rect: button.getBoundingClientRect().toJSON(),
        })),
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      titleCount: document.querySelectorAll('[title]').length,
    };
  });
  expect(metrics.slots).toBe(7);
  expect(metrics.controls).toBe(7);
  expect(metrics.existingActions).toBe(6);
  expect(metrics.secondaryActions).toBe(1);
  expect(metrics.controlsInView).toBe(metrics.controls);
  expect(metrics.planningIntersectsActions).toBe(false);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(390);
  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(390);
  expect(metrics.titleCount).toBe(0);
  await page.screenshot({ path: path.join(evidenceDir, '07-mobile-seven-action-controls.png'), fullPage: false });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  fs.writeFileSync(runtimePath, `${JSON.stringify({
    version: GAME_VERSION,
    locked: { secondary: 'fighter_focus', visible: true, usable: false, reason: '达到 Lv.3 后解锁' },
    level3UnlockMoment: { beforeLevel: 2, afterLevel: 3, secondaryEnabled: true },
    secondaryEffects: secondaryEvidence.map((item) => ({
      characterId: item.characterId,
      skillId: item.skillId,
      used: true,
      cooldownVisible: true,
    })),
    desktop: desktopMetrics,
    mobile: metrics,
    consoleErrors,
    pageErrors,
  }, null, 2)}\n`);
});
