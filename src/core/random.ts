/**
 * 确定性伪随机数生成器。
 *
 * 核心逻辑一律不得使用 Math.random()，必须通过本模块，
 * 以保证「相同版本 + 相同种子 + 相同行动顺序」产生相同结果。
 *
 * 算法：xmur3 做字符串 -> 32 位整数的种子散列，mulberry32 做序列生成。
 * 两者都只依赖一个 uint32 状态，因此可以直接序列化进存档。
 */

/** 把任意字符串散列成一个 32 位无符号整数种子 */
export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export class SeededRandom {
  private state: number;

  /**
   * @param seed 字符串种子（会被散列）或直接传入 uint32 状态
   * @param isRawState true 表示 seed 参数已经是内部状态值
   */
  constructor(seed: string | number, isRawState = false) {
    if (typeof seed === 'number') {
      this.state = isRawState ? seed >>> 0 : hashSeed(String(seed));
    } else {
      this.state = hashSeed(seed);
    }
  }

  /** 从已保存的状态恢复 */
  static fromState(state: number): SeededRandom {
    return new SeededRandom(state, true);
  }

  getState(): number {
    return this.state >>> 0;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }

  /** [0, 1) 之间的浮点数 —— mulberry32 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] 闭区间整数 */
  int(min: number, max: number): number {
    if (max < min) {
      throw new Error(`SeededRandom.int 参数非法: min=${min} max=${max}`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** 以 p 的概率返回 true */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** 从数组中等概率取一个元素；空数组返回 null */
  pick<T>(arr: readonly T[]): T | null {
    if (arr.length === 0) return null;
    return arr[this.int(0, arr.length - 1)] as T;
  }

  /**
   * 按权重取一个元素。
   * 权重全为 0 或数组为空时返回 null。
   */
  pickWeighted<T>(entries: ReadonlyArray<{ value: T; weight: number }>): T | null {
    const positive = entries.filter((e) => e.weight > 0);
    if (positive.length === 0) return null;
    const total = positive.reduce((sum, e) => sum + e.weight, 0);
    let roll = this.next() * total;
    for (const entry of positive) {
      roll -= entry.weight;
      if (roll < 0) return entry.value;
    }
    return positive[positive.length - 1]!.value;
  }

  /** 返回打乱后的新数组（Fisher-Yates，不修改原数组） */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const a = out[i] as T;
      out[i] = out[j] as T;
      out[j] = a;
    }
    return out;
  }
}

/**
 * 生成一个随机种子字符串（仅在主菜单「随机种子」按钮里使用，
 * 不属于核心游戏逻辑，因此允许使用 Math.random）。
 */
export function generateRandomSeed(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `BR-${out}`;
}
