import { describe, expect, it } from 'vitest';
import { SeededRandom, hashSeed } from '../src/core/random';

function sequence(seed: string, n = 30): number[] {
  const rng = new SeededRandom(seed);
  return Array.from({ length: n }, () => rng.next());
}

describe('确定性随机数', () => {
  it('相同种子产生完全相同的序列', () => {
    expect(sequence('BR-DEMO-001')).toEqual(sequence('BR-DEMO-001'));
  });

  it('不同种子通常产生不同序列', () => {
    const a = sequence('BR-DEMO-001');
    const b = sequence('BR-DEMO-002');
    expect(a).not.toEqual(b);

    // 抽样 20 组种子，两两之间首个随机数不应大面积重复
    const firsts = new Set<number>();
    for (let i = 0; i < 20; i++) {
      firsts.add(new SeededRandom(`seed-${i}`).next());
    }
    expect(firsts.size).toBeGreaterThanOrEqual(19);
  });

  it('输出落在 [0, 1) 区间内', () => {
    const rng = new SeededRandom('range-check');
    for (let i = 0; i < 500; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int 返回闭区间内的整数', () => {
    const rng = new SeededRandom('int-check');
    for (let i = 0; i < 300; i++) {
      const v = rng.int(3, 7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('可以从状态恢复并继续同一序列', () => {
    const rng = new SeededRandom('resume');
    for (let i = 0; i < 10; i++) rng.next();
    const snapshot = rng.getState();
    const expected = [rng.next(), rng.next(), rng.next()];

    const restored = SeededRandom.fromState(snapshot);
    expect([restored.next(), restored.next(), restored.next()]).toEqual(expected);
  });

  it('pickWeighted 尊重权重，且权重为 0 的选项永不被选中', () => {
    const rng = new SeededRandom('weighted');
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 2000; i++) {
      const v = rng.pickWeighted([
        { value: 'a' as const, weight: 90 },
        { value: 'b' as const, weight: 10 },
        { value: 'c' as const, weight: 0 },
      ]);
      if (v) counts[v] += 1;
    }
    expect(counts.c).toBe(0);
    expect(counts.a).toBeGreaterThan(counts.b);
  });

  it('hashSeed 输出 32 位无符号整数', () => {
    const h = hashSeed('BR-DEMO-001');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});
