import type { ItemStack } from './itemTypes';

/* ------------------------------------------------------------------ */
/* 遭遇 / 待处理交互                                                    */
/* ------------------------------------------------------------------ */

export interface EncounterState {
  enemyId: string;
  zoneId: string;
  startedAtTime: number;
  /** 战斗轮次日志（仅本次遭遇） */
  log: string[];
  /** 敌人已死亡 / 已逃跑时，遭遇进入"可关闭"状态 */
  resolved: boolean;
  /**
   * Phase 3A-1：侦察员「警觉侦察」由 SEARCH 建立本次遭遇时置 true。
   * 只影响「遭遇建立阶段」——敌方在建立瞬间的首次立即反击/偷袭收益被抑制；
   * 玩家之后的正常攻击仍可触发正常反击（不构成免反击护盾）。
   */
  reconInitiative?: boolean;
}

/** 背包已满时发现物品，等待玩家决策 */
export interface PendingPickup {
  stack: ItemStack;
  source: 'search' | 'ground';
  zoneId: string;
}
