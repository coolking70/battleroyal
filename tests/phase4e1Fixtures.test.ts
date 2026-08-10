/**
 * Phase 4E-1 浏览器证据夹具的守门测试。
 *
 * 三个夹具都要走真实的"继续上次对局"路径进入游戏，
 * 一旦存档校验不通过，浏览器证据会在 preview 里静默退回开局界面、
 * 直到超时才报错。这里先用真实校验器把它们钉死，省掉一整轮构建。
 */

import { describe, expect, it } from 'vitest';
import { validateSaveData } from '../src/core/saveValidation';
import {
  craftableHintFixture,
  killReportFixture,
  quickRestoreAutoFixture,
  quickRestoreChooseFixture,
} from './browser/phase4e1Fixtures';

interface FixtureShape {
  state: {
    encounter: { enemyId: string; resolved: boolean } | null;
    characters: Record<string, { id: string; hp: number; alive: boolean; currentZoneId: string }>;
    playerId: string;
    zones: Record<string, { groundItems: { itemId: string }[] }>;
  };
}

function expectValid(fixture: Record<string, unknown>, label: string): void {
  const report = validateSaveData(fixture);
  expect(report.ok, `${label} 存档校验失败：${report.errors.join(' / ')}`).toBe(true);
}

describe('Phase 4E-1 浏览器证据夹具', () => {
  it('击杀战报夹具：遭遇进行中、敌人 1 HP、玩家有余量可被治疗', () => {
    const fixture = killReportFixture();
    expectValid(fixture, '击杀战报夹具');
    const { state } = fixture as unknown as FixtureShape;
    expect(state.encounter).not.toBeNull();
    expect(state.encounter!.resolved).toBe(false);
    const enemy = state.characters[state.encounter!.enemyId]!;
    expect(enemy.hp).toBe(1);
    expect(enemy.alive).toBe(true);
    expect(enemy.currentZoneId).toBe(state.characters[state.playerId]!.currentZoneId);
  });

  it('快捷恢复自动夹具：唯一候选且不溢出', () => {
    expectValid(quickRestoreAutoFixture(), '快捷恢复自动夹具');
  });

  it('快捷恢复选择夹具：多候选且含双效物品', () => {
    expectValid(quickRestoreChooseFixture(), '快捷恢复选择夹具');
  });

  it('可合成提示夹具：手上有木棍、地面有石头（差一件材料）', () => {
    const fixture = craftableHintFixture();
    expectValid(fixture, '可合成提示夹具');
    const { state } = fixture as unknown as FixtureShape;
    const zone = state.zones[state.characters[state.playerId]!.currentZoneId]!;
    expect(zone.groundItems.map((s) => s.itemId)).toEqual(['stone']);
  });
});
