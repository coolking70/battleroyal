/**
 * 确定性复验测试（Phase 3A-1 §61）。
 *
 * 同一 seed + character + policy 分别跑两局，最终状态必须完全一致：
 *  - 最终 state 的确定性哈希；
 *  - worldEventHistory；
 *  - 技能使用事件序列；
 *  - 攻击风格序列；
 *  - endReason。
 */

import { describe, it, expect } from 'vitest';
import { runAutoGame, type AutoPlayerPolicy } from '../tools/autoPlayer';

/** 对最终状态做确定性摘要（只取与规则相关的可序列化字段） */
function stateDigest(r: ReturnType<typeof runAutoGame>): string {
  return JSON.stringify({
    time: r.timeUsed,
    outcome: r.outcome,
    endReason: r.endReason,
    playerRank: r.playerRank,
    survivorCount: r.survivorCount,
    survivorIds: r.survivorIds,
    eventCount: r.eventCount,
    worldEventHistory: r.finalState?.worldEventHistory ?? null,
    activeWorldEvents: r.finalState?.activeWorldEvents ?? null,
    skillCooldowns: r.finalState
      ? Object.fromEntries(
          Object.values(r.finalState.characters).map((c) => [c.id, c.skillCooldowns]),
        )
      : null,
  });
}

/** 从全量事件中抽取「技能使用序列」 */
function skillSequence(r: ReturnType<typeof runAutoGame>): string {
  return JSON.stringify(
    (r.finalState?.events ?? [])
      .filter((e) => e.type === 'SKILL_USED')
      .map((e) => `${e.actorId}:${e.metadata?.skillId}`),
  );
}

/** 从全量事件中抽取「攻击风格序列」 */
function attackStyleSequence(r: ReturnType<typeof runAutoGame>): string {
  return JSON.stringify(
    (r.finalState?.events ?? [])
      .filter((e) => e.type === 'ATTACK_HIT' || e.type === 'ATTACK_MISSED')
      .map((e) => e.metadata?.style),
  );
}

function playTwice(seed: string, characterId: string, policy: AutoPlayerPolicy) {
  const a = runAutoGame({ seed, characterId, policy, keepFinalState: true });
  const b = runAutoGame({ seed, characterId, policy, keepFinalState: true });
  return { a, b };
}

describe('确定性复验（同一 seed → 完全一致）', () => {
  it('最终 state 摘要完全一致', () => {
    for (const cfg of [
      ['DET-1', 'scout', 'cautious'],
      ['DET-2', 'fighter', 'aggressive'],
      ['DET-3', 'medic', 'random'],
    ] as const) {
      const { a, b } = playTwice(cfg[0], cfg[1], cfg[2] as AutoPlayerPolicy);
      expect(stateDigest(a), `seed ${cfg[0]}`).toBe(stateDigest(b));
    }
  });

  it('worldEventHistory 完全一致', () => {
    const { a, b } = playTwice('DET-4', 'engineer', 'collector');
    expect(JSON.stringify(a.finalState!.worldEventHistory)).toBe(
      JSON.stringify(b.finalState!.worldEventHistory),
    );
  });

  it('技能使用事件序列完全一致', () => {
    const { a, b } = playTwice('DET-5', 'medic', 'aggressive');
    expect(skillSequence(a)).toBe(skillSequence(b));
  });

  it('攻击风格序列完全一致', () => {
    const { a, b } = playTwice('DET-6', 'fighter', 'opportunist');
    expect(attackStyleSequence(a)).toBe(attackStyleSequence(b));
  });

  it('endReason 完全一致', () => {
    for (let i = 0; i < 5; i++) {
      const { a, b } = playTwice(`DET-7-${i}`, 'scout', 'random');
      expect(a.endReason).toBe(b.endReason);
      expect(a.outcome).toBe(b.outcome);
    }
  });
});
