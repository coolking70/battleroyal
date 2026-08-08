/**
 * 世界事件不变量测试（Phase 3A Step 7）。
 *
 * 覆盖：
 *  1. 全新对局 / 推进后的对局，`auditWorldEventInvariants` 始终 ok；
 *  2. 红线（编译期）：`worldEvents.ts` 不得 import 实体写入模块
 *     （zoneLoot / vitals / inventory）；
 *  3. 红线（行为层）：跑一遍 `runWorldEvents` 后，任何角色血量 / 库存 /
 *     区域地面物资 / 角色位置都不改变；
 *  4. 同事件不叠加 + 并发上限 `maxConcurrentWorldEvents`；
 *  5. 篡改检测：往 activeWorldEvents 注入非法字段会被审计抓出；
 *  6. 修正值数学：blackout 区域 hitMultiplier=0.85、intelBlocked=true，
 *     其他区域保持中性。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/core/gameState';
import { runWorldEvents, worldModifiersAt, WORLD_EVENT_IDS } from '../src/core/worldEvents';
import { auditWorldEventInvariants } from '../src/core/worldEventAudit';
import { SeededRandom } from '../src/core/random';
import { getTimeAdvancingActions } from '../src/core/legalActions';
import { executeCommand } from '../src/core/gameEngine';
import type { GameState, WorldEventId, WorldEventState } from '../src/core/types';

const CHARS = ['scout', 'fighter', 'engineer', 'medic'] as const;

function freshGame(seed: string, char = 'scout'): GameState {
  return createGame({ seed, playerCharacterId: char });
}

/** 随机走子推进一局，返回最终 state */
function playRandom(seed: string, maxSteps = 600): GameState {
  let s = freshGame(`INV-${seed}`, CHARS[Number(seed) % CHARS.length]!);
  const rng = new SeededRandom(7000 + Number(seed));
  let guard = 0;
  while (s.status === 'playing' && guard++ < maxSteps) {
    const adv = getTimeAdvancingActions(s);
    if (adv.length === 0) break;
    const pick = adv[rng.int(0, adv.length - 1)]!;
    const r = executeCommand(s, pick.command);
    if (!r.ok) break;
    s = r.state;
  }
  return s;
}

describe('auditWorldEventInvariants — 结构自洽', () => {
  it('全新对局即通过审计', () => {
    const s = freshGame('fresh-1');
    const rep = auditWorldEventInvariants(s);
    expect(rep.ok).toBe(true);
    expect(rep.problems).toEqual([]);
  });

  it('随机推进后的对局始终通过审计', () => {
    for (let g = 0; g < 40; g++) {
      const s = playRandom(String(g));
      const rep = auditWorldEventInvariants(s);
      expect(rep.ok, `game ${g} problems: ${rep.problems.join(' | ')}`).toBe(true);
    }
  });
});

describe('红线 — 编译期：worldEvents.ts 不 import 实体写入模块', () => {
  const FORBIDDEN = ['zoneLoot', 'vitals', 'inventory'];
  const src = readFileSync(resolve(__dirname, '../src/core/worldEvents.ts'), 'utf8');

  it('不得出现对任何实体写入模块的 import', () => {
    for (const mod of FORBIDDEN) {
      const hit = src
        .split('\n')
        .some((line) => /^import\b.*\bfrom\b.*['"]\.\/.*\b(mod)\b['"]/.test(line.replace('(mod)', mod)));
      // 更宽松但可靠的判断：任一被禁模块名出现在 import 语句的 from 路径里
      const present = src
        .split('\n')
        .some((line) => /^\s*import\b/.test(line) && line.includes(`'./${mod}'`));
      expect(present, `worldEvents.ts 不应 import ./${mod}`).toBe(false);
      expect(hit, `worldEvents.ts 不应 import ./${mod}（备选匹配）`).toBe(false);
    }
  });

  it('worldEvents.ts 实际只 import 了允许的模块', () => {
    const imports = src
      .split('\n')
      .filter((l) => /^\s*import\b/.test(l))
      .map((l) => l.trim());
    // 允许：gameConfig、zones、events、gameState、types、random
    for (const line of imports) {
      expect(
        /from ['"]\.\.\/data\/(gameConfig|zones)['"]/.test(line) ||
          /from ['"]\.\/(events|gameState)['"]/.test(line) ||
          /from ['"]\.\/types['"]/.test(line) ||
          /from ['"]\.\/random['"]/.test(line) ||
          /import type/.test(line),
        `意外 import：${line}`,
      ).toBe(true);
    }
  });
});

describe('红线 — 行为层：runWorldEvents 不写实体状态', () => {
  it('推进大量世界事件后，血量/库存/地面/位置均不变', () => {
    const s = freshGame('behav-1', 'fighter');
    // 强制尽快、密集地触发世界事件
    s.nextWorldEventTime = 0;
    const rng = new SeededRandom(31337);

    // 快照
    const snap = () => {
      const chars = Object.values(s.characters).map((c) => ({
        id: c.id,
        hp: c.hp,
        maxHp: c.maxHp,
        inv: c.inventory.length,
        eq: c.equipment.length,
        zone: c.currentZoneId,
      }));
      const ground = Object.entries(s.zones).map(([zid, z]) => [zid, z.groundItems.length]);
      return { chars, ground };
    };
    const before = snap();

    for (let t = 0; t < 200; t++) {
      s.time += 1;
      runWorldEvents(s, rng);
    }

    const after = snap();
    expect(after.chars).toEqual(before.chars);
    expect(after.ground).toEqual(before.ground);
  });
});

describe('不变量 — 同事件不叠加 + 并发上限', () => {
  it('长期推进后不存在重复 eventId，且不超过并发上限', () => {
    const cap = (() => {
      // 读配置：maxConcurrentWorldEvents
      // 用运行期推断：直接复用 audit 已校验，这里再独立断言一次
      return 2;
    })();
    for (let g = 0; g < 30; g++) {
      const s = playRandom(String(g + 100));
      const ids = s.activeWorldEvents.map((e) => e.eventId);
      expect(new Set(ids).size).toBe(ids.length); // 无重复 eventId
      expect(s.activeWorldEvents.length).toBeLessThanOrEqual(cap);
    }
  });
});

describe('篡改检测 — audit 能抓出非法状态', () => {
  it('注入非法 eventId 被标记', () => {
    const s = freshGame('tamper-1');
    s.activeWorldEvents.push({
      id: 'weX',
      eventId: 'not_a_real_event' as WorldEventId,
      scope: 'global',
      zoneId: null,
      startedAtTime: 0,
      remaining: 3,
      label: 'X',
      description: 'X',
    });
    const rep = auditWorldEventInvariants(s);
    expect(rep.ok).toBe(false);
    expect(rep.problems.some((p) => p.includes('eventId 非法'))).toBe(true);
  });

  it('全局事件携带 zoneId 被标记', () => {
    const s = freshGame('tamper-2');
    s.activeWorldEvents.push({
      id: 'weY',
      eventId: 'rain',
      scope: 'global',
      zoneId: 'z_some',
      startedAtTime: 0,
      remaining: 3,
      label: '雨',
      description: '雨',
    });
    const rep = auditWorldEventInvariants(s);
    expect(rep.ok).toBe(false);
    expect(rep.problems.some((p) => p.includes('zoneId'))).toBe(true);
  });

  it('同事件重复生效被标记', () => {
    const mk = (id: string, zoneId: string | null): WorldEventState => ({
      id,
      eventId: 'rain',
      scope: 'global',
      zoneId,
      startedAtTime: 0,
      remaining: 3,
      label: '雨',
      description: '雨',
    });
    const s = freshGame('tamper-3');
    s.activeWorldEvents.push(mk('weA', null), mk('weB', null));
    const rep = auditWorldEventInvariants(s);
    expect(rep.ok).toBe(false);
    expect(rep.problems.some((p) => p.includes('重复生效'))).toBe(true);
  });
});

describe('修正值数学 — worldModifiersAt 是 UI/core 同源', () => {
  it('区域 blackout 只影响本区域，且乘数正确', () => {
    const s = freshGame('mods-1');
    const zoneId = Object.keys(s.zones)[0]!;
    s.activeWorldEvents.push({
      id: 'weZ',
      eventId: 'blackout',
      scope: 'zone',
      zoneId,
      startedAtTime: 0,
      remaining: 5,
      label: '大停电',
      description: '停电',
    });

    const inZone = worldModifiersAt(s, zoneId);
    expect(inZone.hitMultiplier).toBeCloseTo(0.85, 5);
    expect(inZone.searchFindMultiplier).toBeCloseTo(0.7, 5);
    expect(inZone.intelBlocked).toBe(true);

    // 其他区域保持中性
    const otherZone = Object.keys(s.zones).find((z) => z !== zoneId)!;
    const outside = worldModifiersAt(s, otherZone);
    expect(outside.hitMultiplier).toBe(1);
    expect(outside.intelBlocked).toBe(false);

    // 全局（zoneId=null）不含区域事件
    const global = worldModifiersAt(s, null);
    expect(global.hitMultiplier).toBe(1);
  });

  it('全局 rain 对所有区域生效，命中 ×0.9、逃跑 +0.1', () => {
    const s = freshGame('mods-2');
    s.activeWorldEvents.push({
      id: 'weR',
      eventId: 'rain',
      scope: 'global',
      zoneId: null,
      startedAtTime: 0,
      remaining: 5,
      label: '雨',
      description: '雨',
    });
    const anyZone = worldModifiersAt(s, Object.keys(s.zones)[0]!);
    expect(anyZone.hitMultiplier).toBeCloseTo(0.9, 5);
    expect(anyZone.fleeBonus).toBeCloseTo(0.1, 5);
  });

  it('无事件时为中性值', () => {
    const s = freshGame('mods-3');
    const m = worldModifiersAt(s, Object.keys(s.zones)[0]!);
    expect(m.hitMultiplier).toBe(1);
    expect(m.healMultiplier).toBe(1);
    expect(m.intelBlocked).toBe(false);
    expect(m.revealAll).toBe(false);
    expect(m.fleeBonus).toBe(0);
  });
});

describe('覆盖完整性 — 6 种事件全部可被定义', () => {
  it('WORLD_EVENT_IDS 恰好是 6 种', () => {
    expect(WORLD_EVENT_IDS).toEqual([
      'blackout',
      'rain',
      'emergency_broadcast',
      'medical_alert',
      'research_anomaly',
      'citywide_unrest',
    ]);
  });
});

describe('红线 — UI 命中率与 core 同源（Phase 3A 不变量）', () => {
  const uiFiles = [
    '../src/ui/components/EncounterPanel.tsx',
    '../src/ui/components/ActionBar.tsx',
  ];
  it('UI 组件不得再 import 裸 hitChanceOf / fleeChanceOf', () => {
    for (const rel of uiFiles) {
      const src = readFileSync(resolve(__dirname, rel), 'utf8');
      for (const bare of ['hitChanceOf', 'fleeChanceOf']) {
        // 只允许出现 hitChanceIn / fleeChanceIn；裸名（后面不跟 In）视为违规
        const lines = src
          .split('\n')
          .filter(
            (l) =>
              new RegExp('\\b' + bare + '(?![A-Za-z])').test(l) &&
              !new RegExp('\\b' + bare + 'In\\b').test(l),
          );
        expect(lines, rel + ' 出现裸 ' + bare + '：' + lines.join('; ')).toEqual([]);
      }
    }
  });
});
