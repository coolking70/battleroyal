import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { performCraft } from '../../src/core/crafting';
import { executeCommand } from '../../src/core/gameEngine';
import { getPlayer, refreshZoneOccupants } from '../../src/core/gameState';
import { addItem, createStack, equipItem } from '../../src/core/inventory';
import { GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';
import { ZONE_IDS } from '../../src/data/zones';
import type { Combatant, GameState } from '../../src/core/types';
import { clearInventory, newGame, npcs, player } from '../helpers';
import { craftableHintFixture } from './phase4e1Fixtures';

const evidenceDir = path.resolve('output/phase4e2-browser');

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

function stageEncounter(seed: string): { state: GameState; p: Combatant; foe: Combatant } {
  const state = newGame(seed);
  const p = player(state);
  clearInventory(p);
  const [foe, ...others] = npcs(state);
  if (!foe) throw new Error('缺少浏览器证据敌人');
  const elsewhere = ZONE_IDS.find((zoneId) => zoneId !== p.currentZoneId) ?? p.currentZoneId;
  for (const other of others) other.currentZoneId = elsewhere;
  foe.alive = true;
  foe.currentZoneId = p.currentZoneId;
  state.engagedWithPlayer = [foe.id];
  refreshZoneOccupants(state);
  state.encounter = {
    enemyId: foe.id,
    zoneId: p.currentZoneId,
    startedAtTime: state.time,
    log: [`你与 ${foe.name} 正面遭遇。`],
    resolved: false,
  };
  return { state, p, foe };
}

function killFixture(seed: string): Record<string, unknown> {
  const { state, p, foe } = stageEncounter(seed);
  foe.maxHp = 1;
  foe.hp = 1;
  const axe = createStack(state, 'stone_axe');
  addItem(p, axe);
  equipItem(p, axe.uid);
  p.stamina = p.maxStamina;
  return serialize(state);
}

function heavyMissFixture(): Record<string, unknown> {
  for (let i = 0; i < 120; i += 1) {
    const staged = stageEncounter(`PHASE4E2-BROWSER-MISS-${i}`);
    const probe = executeCommand(staged.state, {
      type: 'ATTACK',
      targetId: staged.foe.id,
      style: 'heavy',
    });
    if (
      probe.ok &&
      probe.state.characters[staged.foe.id]?.alive &&
      probe.state.encounter?.resolved === false &&
      probe.state.encounter?.log.at(-1)?.includes('重击落空')
    ) {
      return serialize(stageEncounter(`PHASE4E2-BROWSER-MISS-${i}`).state);
    }
  }
  throw new Error('未能构造浏览器重击落空夹具');
}

function playerKilledFixture(): Record<string, unknown> {
  for (let i = 0; i < 120; i += 1) {
    const staged = stageEncounter(`PHASE4E2-BROWSER-DEAD-${i}`);
    staged.p.hp = 1;
    staged.foe.hp = staged.foe.maxHp;
    staged.foe.stamina = staged.foe.maxStamina;
    const probe = executeCommand(staged.state, {
      type: 'ATTACK',
      targetId: staged.foe.id,
      style: 'normal',
    });
    if (probe.ok && probe.state.status === 'lost' && probe.message?.includes('你 已被击杀')) {
      const fresh = stageEncounter(`PHASE4E2-BROWSER-DEAD-${i}`);
      fresh.p.hp = 1;
      fresh.foe.hp = fresh.foe.maxHp;
      fresh.foe.stamina = fresh.foe.maxStamina;
      return serialize(fresh.state);
    }
  }
  throw new Error('未能构造浏览器玩家被击杀夹具');
}

function stationaryFleeFixture(seed: string): Record<string, unknown> {
  const staged = stageEncounter(seed);
  staged.foe.stamina = 0;
  for (const zone of Object.values(staged.state.zones)) {
    if (zone.id !== staged.p.currentZoneId) zone.status = 'restricted';
  }
  return serialize(staged.state);
}

function transferFleeFixture(): Record<string, unknown> {
  for (let i = 0; i < 120; i += 1) {
    const staged = stageEncounter(`PHASE4E2-BROWSER-FLEE-${i}`);
    staged.foe.stamina = 0;
    const from = staged.p.currentZoneId;
    const probe = executeCommand(staged.state, { type: 'FLEE' });
    if (probe.ok && getPlayer(probe.state).currentZoneId !== from) {
      const fresh = stageEncounter(`PHASE4E2-BROWSER-FLEE-${i}`);
      fresh.foe.stamina = 0;
      return serialize(fresh.state);
    }
  }
  throw new Error('未能构造浏览器转移脱离夹具');
}

function opponentEscapeFixture(seed: string): Record<string, unknown> {
  const staged = stageEncounter(seed);
  const destination = ZONE_IDS.find((zoneId) => zoneId !== staged.p.currentZoneId);
  if (!destination) throw new Error('缺少对方逃走目的地');
  staged.foe.currentZoneId = destination;
  staged.state.encounter!.resolved = true;
  staged.state.encounter!.log = [`你 命中 ${staged.foe.name}，造成 3 点伤害。`];
  refreshZoneOccupants(staged.state);
  return serialize(staged.state);
}

function craftNotStrongerFixture(seed: string): Record<string, unknown> {
  const state = newGame(seed);
  const p = player(state);
  clearInventory(p);
  addItem(p, createStack(state, 'iron_pipe'));
  const equipped = p.inventory[0]!;
  if (!equipItem(p, equipped.uid).ok) throw new Error('无法构造不更强装备夹具');
  addItem(p, createStack(state, 'wood'));
  addItem(p, createStack(state, 'stone'));
  const result = performCraft(state, p, 'r_stick');
  if (!result.ok) throw new Error(result.message);
  return serialize(state);
}

async function loadFixture(page: Page, fixture: Record<string, unknown>): Promise<void> {
  await page.goto('/?fixture=phase4e2', { waitUntil: 'networkidle' });
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

async function noHorizontalOverflow(page: Page): Promise<void> {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(result.scrollWidth, JSON.stringify(result)).toBeLessThanOrEqual(result.clientWidth + 1);
}

test.beforeAll(() => {
  fs.mkdirSync(evidenceDir, { recursive: true });
});

test('Phase 4E-2 生产预览：四类结局与合成装备提示实拍', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.setViewportSize({ width: 1280, height: 720 });

  await loadFixture(page, killFixture('PHASE4E2-BROWSER-KILL'));
  await page.locator('[data-attack-style="normal"]').click();
  await expect(page.locator('.encounter-hero-feedback strong')).toContainText('造成');
  await expect(page.locator('.encounter-hero-feedback strong')).toContainText('已被击杀');
  await shot(page, '01-kill-immediate-feedback');

  await loadFixture(page, heavyMissFixture());
  await page.locator('[data-attack-style="heavy"]').click();
  await expect(page.locator('.encounter-hero-feedback strong')).toContainText('重击落空');
  await expect(page.locator('.encounter-hero-feedback strong')).toContainText('露出破绽');
  await shot(page, '02-heavy-miss-immediate-feedback');

  await loadFixture(page, playerKilledFixture());
  await page.locator('[data-attack-style="normal"]').click();
  await expect(page.locator('.toast')).toContainText('你 已被击杀');
  await shot(page, '03-player-killed-feedback');

  await loadFixture(page, stationaryFleeFixture('PHASE4E2-BROWSER-FLEE-STATIONARY'));
  await page.locator('[data-action="flee"]').click();
  await expect(page.locator('.encounter-hero-feedback strong')).toContainText('仍在本区域，可能再次交火');
  await shot(page, '04-stationary-flee-feedback');

  await loadFixture(page, transferFleeFixture());
  await page.locator('[data-action="flee"]').click();
  await expect(page.locator('.encounter-hero-feedback strong')).toContainText('已经离开该区域');
  await expect(page.locator('.encounter-hero-feedback strong')).toContainText('当前位于');
  await shot(page, '05-transfer-flee-feedback');

  await loadFixture(page, opponentEscapeFixture('PHASE4E2-BROWSER-OPPONENT'));
  await expect(page.locator('.encounter-hero-feedback strong')).toContainText('已经离开该区域');
  await expect(page.locator('.encounter-hero-feedback strong')).toContainText('脱离接触');
  await shot(page, '06-opponent-escape-feedback');

  await loadFixture(page, craftableHintFixture('PHASE4E2-BROWSER-CRAFT'));
  await page.locator('.ground-item[data-item-id="stone"] button').click();
  const craftHint = page.locator('.craftable-hint');
  await expect(craftHint).toBeVisible();
  await craftHint.locator('[data-craftable-hint-craft="true"]').click();
  await expect(page.locator('[data-craft-equipment-hint="true"]')).toBeVisible();
  await expect(page.locator('[data-craft-equipment-comparison="true"]')).toContainText('当前空槽');
  await expect(page.locator('[data-craft-equipment-comparison="true"]')).toContainText('攻击 +6');
  await shot(page, '07-craft-weapon-equip-hint');

  await loadFixture(page, craftNotStrongerFixture('PHASE4E2-BROWSER-NOT-STRONGER'));
  await expect(page.locator('[data-craft-equipment-hint="true"]')).toHaveCount(0);
  await shot(page, '08-craft-not-stronger-no-hint');

  await noHorizontalOverflow(page);
  fs.writeFileSync(
    path.join(evidenceDir, 'runtime-errors.json'),
    `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`,
  );
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('Phase 4E-2 生产预览：五视口无横向溢出且战斗动作可达', async ({ page }) => {
  const viewports = [
    [1280, 720],
    [1024, 768],
    [768, 1024],
    [844, 390],
    [390, 844],
  ] as const;
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await loadFixture(page, killFixture(`PHASE4E2-BROWSER-VIEW-${width}-${height}`));
    await expect(page.locator('.actionbar-combat-actions button')).toHaveCount(7);
    await expect(page.locator('.actionbar-combat-actions > button')).toHaveCount(7);
    await noHorizontalOverflow(page);
  }
});

test('Phase 4E-2 生产预览无 console/page errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto('/?fixture=phase4e2-errors', { waitUntil: 'networkidle' });
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
