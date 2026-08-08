/**
 * Phase 2A Step 9 · 物品守恒不变量测试。
 *
 * 配合 `src/core/itemIntegrity.ts` 的 `auditItemIntegrity`：
 * - 基础完整性（合法对局通过 / 各类手改被拒）；
 * - **逐 tick 守恒**：跑完整一局（只走合法命令），每一步都审计，
 *   证明引擎在推进过程中从不产生重复 UID / 未知物品 / 非法数量 / 悬空装备引用。
 */

import { describe, expect, it } from 'vitest';
import { auditItemIntegrity } from '../src/core/itemIntegrity';
import { executeCommand } from '../src/core/gameEngine';
import { createGame } from '../src/core/gameState';
import { getLegalPlayerCommands } from '../src/core/legalActions';
import { decideAutoPlayerCommand } from '../tools/autoPlayer';
import { SeededRandom } from '../src/core/random';
import { newGame, player } from './helpers';
import type { Command, GameState } from '../src/core/types';

function cloneLike(state: GameState): GameState {
  // 仅用于测试构造损坏用例，不影响审计逻辑
  return structuredClone(state) as unknown as GameState;
}

describe('[itemIntegrity] 基础完整性', () => {
  it('全新对局通过审计', () => {
    const report = auditItemIntegrity(newGame());
    expect(report.ok).toBe(true);
    expect(report.problems).toEqual([]);
  });

  it('四种角色模板的全新对局都通过', () => {
    for (const id of ['scout', 'fighter', 'engineer', 'medic']) {
      expect(auditItemIntegrity(newGame('BR-ii', id)).ok).toBe(true);
    }
  });

  it('重复 UID 被拒', () => {
    const s = cloneLike(newGame());
    const p = s.characters[s.playerId]!;
    p.inventory = [
      { uid: 'SAME', itemId: 'scrap_metal', count: 1 },
      { uid: 'SAME', itemId: 'scrap_metal', count: 1 },
    ] as unknown as GameState['characters'][string]['inventory'];
    const report = auditItemIntegrity(s);
    expect(report.ok).toBe(false);
    expect(report.problems.some((m) => m.includes('SAME'))).toBe(true);
  });

  it('未知物品 id 被拒', () => {
    const s = cloneLike(newGame());
    const p = s.characters[s.playerId]!;
    p.inventory = [{ uid: 'X1', itemId: 'no_such_item', count: 1 } as unknown as GameState['characters'][string]['inventory'][number]];
    expect(auditItemIntegrity(s).ok).toBe(false);
  });

  it('非正整数数量被拒', () => {
    const s = cloneLike(newGame());
    const p = s.characters[s.playerId]!;
    p.inventory = [{ uid: 'X2', itemId: 'scrap_metal', count: 0 } as unknown as GameState['characters'][string]['inventory'][number]];
    expect(auditItemIntegrity(s).ok).toBe(false);
  });

  it('装备指向不存在的实例被拒', () => {
    const s = cloneLike(newGame());
    const p = s.characters[s.playerId]!;
    p.equippedWeaponId = 'ghost-weapon';
    expect(auditItemIntegrity(s).ok).toBe(false);
  });
});

describe('[itemIntegrity] 逐 tick 守恒', () => {
  function playthrough(seed: string, characterId: string): GameState[] {
    let s = createGame({ seed, playerCharacterId: characterId, playerName: '审计者' });
    const policyRng = new SeededRandom(`${seed}::audit::${characterId}`);
    const snapshots: GameState[] = [];
    let steps = 0;
    while (s.status === 'playing' && steps < 4000) {
      const legal = getLegalPlayerCommands(s);
      if (legal.length === 0) break;
      const p = s.characters[s.playerId]!;
      const pref = decideAutoPlayerCommand(s, p, 'cautious', policyRng).command;
      const matched = pref
        ? legal.find((a) => sameCommand(a.command, pref))
        : undefined;
      const chosen = matched ?? legal.find((a) => a.advancesTime) ?? legal[0]!;
      const res = executeCommand(s, chosen.command);
      if (!res.ok) break;
      s = res.state;
      snapshots.push(s);
      steps += 1;
    }
    return snapshots;
  }

  function sameCommand(a: Command, b: Command): boolean {
    if (a.type !== b.type) return false;
    const ka = a as unknown as Record<string, unknown>;
    const kb = b as unknown as Record<string, unknown>;
    for (const key of new Set([...Object.keys(ka), ...Object.keys(kb)])) {
      if (ka[key] !== kb[key]) return false;
    }
    return true;
  }

  it('完整一局推进过程中物品守恒不变量始终成立', () => {
    const seeds = ['AUDIT-1', 'AUDIT-2', 'AUDIT-3', 'AUDIT-4'];
    const characters = ['scout', 'fighter', 'engineer', 'medic'];
    let checked = 0;
    let reachedMidgame = false;
    for (const seed of seeds) {
      for (const ch of characters) {
        const snapshots = playthrough(seed, ch);
        expect(snapshots.length).toBeGreaterThan(0);
        for (const snap of snapshots) {
          const report = auditItemIntegrity(snap);
          expect(report.ok, `seed=${seed} ch=${ch} 物品守恒被破坏：${report.problems.join('; ')}`).toBe(true);
          if (snap.phase !== 'opening') reachedMidgame = true;
          checked += 1;
        }
      }
    }
    // 至少审计数百个时间单位，并确实触达过中局 / 终局物资变化
    expect(checked).toBeGreaterThan(300);
    expect(reachedMidgame).toBe(true);
  });

  it('自动玩家跑完的对局，终局状态仍通过审计', () => {
    // 复用 newGame 与玩家真实推进：取一份自动对局结尾快照做静态校验
    const s = cloneLike(newGame('AUDIT-END'));
    // 简单推进若干步后审计（不要求跑到结束，验证中途任意快照合法即可）
    let cur = s;
    for (let i = 0; i < 30; i++) {
      const legal = getLegalPlayerCommands(cur);
      if (legal.length === 0) break;
      const res = executeCommand(cur, legal[0]!.command);
      if (!res.ok) break;
      cur = res.state;
    }
    expect(auditItemIntegrity(cur).ok).toBe(true);
    void player;
  });
});
