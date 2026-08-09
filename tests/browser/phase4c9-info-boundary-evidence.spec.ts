import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { createGame, getPlayer } from '../../src/core/gameState';
import { createStack } from '../../src/core/inventory';
import { GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';
import { getZoneDef } from '../../src/data/zones';

const baseUrl = process.env.PHASE4C9_BASE_URL ?? 'http://127.0.0.1:4173';
const evidenceDir = path.resolve('output/phase4c9-browser');

function fixture(): { save: Record<string, unknown>; currentZoneId: string; remoteZoneId: string } {
  const state = createGame({
    seed: 'PHASE4C9-BROWSER-BOUNDARY',
    playerCharacterId: 'scout',
    playerName: '边界验证者',
  });
  const player = getPlayer(state);
  const remoteZoneId = Object.keys(state.zones).find((id) => id !== player.currentZoneId)!;
  state.zones[player.currentZoneId]!.groundItems.push(createStack(state, 'wood'));
  state.zones[remoteZoneId]!.groundItems.push(createStack(state, 'iron'));
  return {
    currentZoneId: player.currentZoneId,
    remoteZoneId,
    save: {
      version: GAME_VERSION,
      savedAt: 1,
      seed: state.seed,
      time: state.time,
      rngState: state.rngState,
      state,
    },
  };
}

async function loadFixture(
  page: import('@playwright/test').Page,
  save: Record<string, unknown>,
): Promise<void> {
  await page.goto(`${baseUrl}/?fixture=phase4c9`, { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: save,
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续上次对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

test('Phase 4C-9 production info-boundary evidence for ground drops', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  const data = fixture();
  await page.setViewportSize({ width: 1280, height: 720 });
  await loadFixture(page, data.save);

  const snapshot = await page.evaluate(({ currentZoneId, remoteZoneId }) => {
    const zoneText = Array.from(document.querySelectorAll('.zone-item')).map((node) => node.textContent ?? '');
    const currentName = document.querySelector('.zone-hero h2')?.textContent ?? currentZoneId;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      currentZoneId,
      remoteZoneId,
      currentName,
      zoneText,
      currentGround: document.querySelector('.ground-list')?.textContent ?? null,
    };
  }, { currentZoneId: data.currentZoneId, remoteZoneId: data.remoteZoneId });

  const currentName = getZoneDef(data.currentZoneId).name;
  const remoteName = getZoneDef(data.remoteZoneId).name;
  const currentRow = snapshot.zoneText.find((text) => text.includes(currentName));
  const remoteRow = snapshot.zoneText.find((text) => text.includes(remoteName));
  expect(currentRow).toContain('掉落 1');
  expect(remoteRow).not.toContain('掉落');
  expect(snapshot.currentGround).toContain('木材');
  expect(snapshot.currentGround).not.toContain('铁块');
  expect(snapshot.bodyScrollWidth).toBe(1280);
  expect(snapshot.documentScrollWidth).toBe(1280);

  await page.screenshot({ path: path.join(evidenceDir, '01-desktop-ground-boundary.png'), fullPage: false });
  fs.writeFileSync(path.join(evidenceDir, '01-desktop-ground-boundary.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'runtime-errors.json'), `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
