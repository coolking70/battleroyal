import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pushEvent } from '../../src/core/events';
import { createGame, getPlayer } from '../../src/core/gameState';
import { GAME_VERSION, SAVE_KEY } from '../../src/data/gameConfig';
import { WORLD_EVENT_DEFS } from '../../src/core/worldEvents';
import type { WorldEventState } from '../../src/core/types';

const evidenceDir = path.resolve('output/phase4b4-browser');

function ensureEvidenceDir(): void {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

function activeEvent(
  eventId: WorldEventState['eventId'],
  remaining: number,
  zoneId: string | null,
  id: string,
): WorldEventState {
  const def = WORLD_EVENT_DEFS[eventId];
  return {
    id,
    eventId,
    scope: zoneId ? 'zone' : 'global',
    zoneId,
    startedAtTime: 10,
    remaining,
    label: def.label,
    description: def.description,
  };
}

function fixture(kind: 'events' | 'warning' | 'restricted'): Record<string, unknown> {
  const state = createGame({ seed: `PHASE4B4-${kind}`, playerCharacterId: 'scout' });
  const player = getPlayer(state);
  const npc = Object.values(state.characters).find((character) => !character.isPlayer)!;
  state.time = 12;
  state.nextWorldEventTime = 24;
  state.nextZoneEventTime = 24;
  state.eventSeq = 200;
  state.activeWorldEvents = [
    activeEvent('research_anomaly', 1, 'lab', 'we200'),
    activeEvent('rain', 4, null, 'we201'),
  ];
  pushEvent(state, {
    type: 'WORLD_EVENT',
    actorId: null,
    zoneId: 'hospital',
    message: '监控发现「医院」近期活动频繁。',
    metadata: {
      worldEventId: 'emergency_broadcast',
      scope: 'global',
      zoneId: 'hospital',
      broadcastZoneId: 'hospital',
      duration: 0,
      instant: true,
    },
  });
  pushEvent(state, {
    type: 'NPC_ACTION',
    actorId: npc.id,
    zoneId: 'forest',
    message: '寒星（flee_combat）：战力不足，脱离接触',
    metadata: { kind: 'flee_combat', reason: '战力不足，脱离接触' },
  });

  const zone = state.zones[player.currentZoneId]!;
  if (kind === 'warning') {
    zone.status = 'warning';
    zone.warningAtTime = state.time - 1;
  }
  if (kind === 'restricted') {
    zone.status = 'restricted';
    zone.restrictedAtTime = state.time - 1;
    player.hp = 80;
    pushEvent(state, {
      type: 'ZONE_DAMAGE',
      actorId: player.id,
      zoneId: zone.id,
      message: '你在禁区受到侵蚀。',
      metadata: { damage: 20, died: false },
    });
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

async function loadFixture(
  page: import('@playwright/test').Page,
  kind: 'events' | 'warning' | 'restricted',
): Promise<void> {
  await page.goto('/?fixture=phase4b4', { waitUntil: 'networkidle' });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: fixture(kind),
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '继续上次对局' }).click();
  await expect(page.locator('.game')).toHaveCount(1);
}

async function snapshot(page: import('@playwright/test').Page, name: string): Promise<Record<string, unknown>> {
  const result = await page.evaluate(() => {
    const board = document.querySelector('.board') as HTMLElement | null;
    const encounter = document.querySelector('.encounter') as HTMLElement | null;
    const announcement = document.querySelector('[data-world-event-announcement="true"]') as HTMLElement | null;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      board: board ? { clientHeight: board.clientHeight, scrollHeight: board.scrollHeight, scrollTop: board.scrollTop } : null,
      encounterHeight: encounter?.getBoundingClientRect().height ?? null,
      announcement: announcement ? { eventId: announcement.getAttribute('data-event-id'), text: announcement.textContent } : null,
      eventSeverities: Array.from(document.querySelectorAll('[data-event-severity]')).map((node) => ({
        id: node.getAttribute('data-event-id'),
        severity: node.getAttribute('data-event-severity'),
        remaining: node.getAttribute('data-event-remaining'),
        scope: node.getAttribute('data-event-scope'),
      })),
      zoneUrgency: document.querySelector('[data-zone-urgency]')?.getAttribute('data-zone-urgency') ?? null,
      hazardFeedback: document.querySelector('[data-zone-hazard-feedback]')?.getAttribute('data-zone-hazard-feedback') ?? null,
      logText: document.querySelector('.log-panel')?.textContent ?? '',
      renderState: window.render_game_to_text?.() ?? null,
    };
  });
  await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: false });
  fs.writeFileSync(path.join(evidenceDir, `${name}.json`), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

test('Phase 4B-4 production world event and restricted-zone evidence', async ({ page }) => {
  ensureEvidenceDir();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1280, height: 720 });
  await loadFixture(page, 'events');
  await expect(page.locator('[data-world-event-announcement="true"]')).toHaveCount(1);
  const events = await snapshot(page, '01-desktop-instant-and-severity');
  expect(events.eventSeverities).toEqual([
    { id: 'research_anomaly', severity: 'critical', remaining: '1', scope: '区域 · 研究所' },
    { id: 'rain', severity: 'ambient', remaining: '4', scope: '全城' },
  ]);
  expect((events.announcement as { eventId?: string } | null)?.eventId).toBe('emergency_broadcast');
  expect((events.logText as string)).not.toContain('flee_combat');
  expect((events.logText as string)).not.toContain('寒星');

  await page.waitForTimeout(4700);
  await expect(page.locator('[data-world-event-announcement="true"]')).toHaveCount(0);

  await loadFixture(page, 'warning');
  await page.setViewportSize({ width: 390, height: 844 });
  const warning = await snapshot(page, '02-mobile-warning-imminent');
  expect(warning.zoneUrgency).toBe('imminent');
  expect(warning.bodyScrollWidth).toBe(390);
  expect(warning.documentScrollWidth).toBe(390);

  await loadFixture(page, 'restricted');
  const restricted = await snapshot(page, '03-mobile-restricted-damage');
  expect(restricted.hazardFeedback).not.toBe('none');
  expect(restricted.bodyScrollWidth).toBe(390);
  expect(restricted.documentScrollWidth).toBe(390);

  fs.writeFileSync(path.join(evidenceDir, 'runtime-errors.json'), `${JSON.stringify({ consoleErrors, pageErrors }, null, 2)}\n`);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
