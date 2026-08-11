/** 不依赖其他实体的基础游戏类型。 */

export type GameStatus = 'playing' | 'won' | 'lost' | 'draw';

/**
 * 对局阶段。
 * - `opening` 开局：自由搜集，禁区尚未启动
 * - `midgame` 中局：禁区收缩，物资开始紧张
 * - `finale`  终局：强制收束，全场衰竭，必然在有限时间内结束
 */
export type GamePhase = 'opening' | 'midgame' | 'finale';

export const PHASE_ORDER: readonly GamePhase[] = ['opening', 'midgame', 'finale'];
