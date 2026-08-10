import { getItem } from '../data/items';
import type { Combatant } from '../core/types';

/** 点击的槽位：生命槽只对 healHp > 0 的物品感兴趣，体力槽只对 healStamina > 0。 */
export type RestoreSlot = 'hp' | 'stamina';

export interface RestoreCandidate {
  /** 使用时提交给 USE_ITEM 的堆叠 uid（同种物品取背包中第一个堆叠） */
  uid: string;
  itemId: string;
  name: string;
  healHp: number;
  healStamina: number;
  /** 同种物品在背包里的总件数（maxStack 只有 2~3，同种会分裂成多个堆叠） */
  count: number;
}

/**
 * 候选集（Phase 4E-1 §3.1）：对点击的槽，取背包中该项恢复量 > 0 的物品。
 *
 * 按 **物品种类（itemId）** 聚合：恢复类道具 maxStack 仅 2~3，
 * 4 个绷带会占 2 个堆叠，但对玩家来说仍然只是"绷带"这一种选择。
 * §3.2 的"候选恰好只有一种"因此按种类计数，选择窗也按种类列出。
 *
 * 只读玩家自身背包与权威物品数据，不读取任何他者状态或隐藏信息。
 */
export function quickRestoreCandidates(player: Combatant, slot: RestoreSlot): RestoreCandidate[] {
  const byItem = new Map<string, RestoreCandidate>();
  for (const stack of player.inventory) {
    const def = getItem(stack.itemId);
    const healHp = def.healHp ?? 0;
    const healStamina = def.healStamina ?? 0;
    if (slot === 'hp' ? healHp <= 0 : healStamina <= 0) continue;
    const existing = byItem.get(stack.itemId);
    if (existing) {
      existing.count += stack.count;
      continue;
    }
    byItem.set(stack.itemId, {
      uid: stack.uid,
      itemId: stack.itemId,
      name: def.name,
      healHp,
      healStamina,
      count: stack.count,
    });
  }
  return [...byItem.values()];
}

/** 当前槽位的空缺量（用于判定自动使用时是否会溢出）。 */
export function restoreDeficit(player: Combatant, slot: RestoreSlot): number {
  return slot === 'hp'
    ? Math.max(0, player.maxHp - player.hp)
    : Math.max(0, player.maxStamina - player.stamina);
}

export interface QuickRestoreDecision {
  /** auto = 自动使用（无弹窗）；choose = 弹出小型选择窗 */
  mode: 'auto' | 'choose';
  autoUid?: string;
}

/**
 * Phase 4E-1 §3 判定规则（写死，不自行发挥）：
 *
 * 1. 候选集：见 `quickRestoreCandidates`（按物品种类聚合）。
 * 2. 自动使用：候选**恰好只有一种** 且 它在所点击槽上的恢复量 **≤ 当前空缺量**
 *    → 直接使用，不弹窗。（同种物品占多个堆叠仍算"一种"。）
 * 3. 其余全部情况（候选多种 / 唯一候选会溢出 / 候选为空）→ 弹小型选择窗。
 * 4. 双效物品（草药、能量饮料）：自动使用与否**只看所点击槽的恢复量**，
 *    不因另一项可能溢出而排除。
 */
export function decideQuickRestore(player: Combatant, slot: RestoreSlot): QuickRestoreDecision {
  const candidates = quickRestoreCandidates(player, slot);
  const deficit = restoreDeficit(player, slot);
  if (candidates.length === 1) {
    const only = candidates[0]!;
    const recovery = slot === 'hp' ? only.healHp : only.healStamina;
    if (recovery <= deficit) {
      return { mode: 'auto', autoUid: only.uid };
    }
  }
  return { mode: 'choose' };
}
