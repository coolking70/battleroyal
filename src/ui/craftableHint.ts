import { getItem } from '../data/items';
import type { RecipeView } from '../core/crafting';

export interface InventoryEntry {
  itemId: string;
  count: number;
}

export interface CraftableHintInput {
  /** 当前全部配方视图（含 craftable 标志） */
  recipeViews: RecipeView[];
  /** 玩家当前背包（只读，用于检测"新获得物品"） */
  inventory: InventoryEntry[];
  /** 上一快照的"可合成配方 id 集合"；首次调用传 null 表示基线，不触发提示 */
  prevCraftableIds: Set<string> | null;
  /** 上一快照的背包计数（itemId -> 总数量）；首次调用传 null */
  prevInventory: Record<string, number> | null;
  /** 玩家当前设定的合成目标配方 id（优先提示） */
  goalRecipeId: string | null;
}

export interface CraftableHintResult {
  /** 应当提示的配方 id；null 表示无需提示 */
  recipeId: string | null;
  /** 本次计算出的可合成集合，回传给调用方作为下一帧的 prev */
  nextCraftableIds: Set<string>;
  /** 本次计算出的背包计数，回传给调用方作为下一帧的 prev */
  nextInventory: Record<string, number>;
}

/**
 * Phase 4E-1 改进 B：检测"新获得的物品使某条配方从不可做变为可做"。
 *
 * 纯函数：GameScreen 在每次状态变化后调用，自己维护 prev 快照。
 * - 仅当（a）有配方从不可做→可做 **且**（b）背包确实"获得了物品"时才提示，
 *   避免体力恢复（rest）之类的非拾取原因误触发。
 * - 优先提示"当前合成目标"相关配方；无目标时取新可做配方中**输出价值最高**的一条。
 */
export function detectCraftableHint(input: CraftableHintInput): CraftableHintResult {
  const currentCraftable = new Set(
    input.recipeViews.filter((v) => v.craftable).map((v) => v.recipe.id),
  );
  const currentInv: Record<string, number> = {};
  for (const entry of input.inventory) {
    currentInv[entry.itemId] = (currentInv[entry.itemId] ?? 0) + entry.count;
  }

  // 首次调用：仅记录基线，不触发任何提示
  if (input.prevCraftableIds === null) {
    return { recipeId: null, nextCraftableIds: currentCraftable, nextInventory: currentInv };
  }

  const prevInv = input.prevInventory ?? {};
  let gained = false;
  for (const [itemId, count] of Object.entries(currentInv)) {
    if ((prevInv[itemId] ?? 0) < count) {
      gained = true;
      break;
    }
  }
  if (!gained) {
    for (const itemId of Object.keys(currentInv)) {
      if (!(itemId in prevInv)) {
        gained = true;
        break;
      }
    }
  }

  const newlyCraftable = [...currentCraftable].filter((id) => !input.prevCraftableIds!.has(id));

  let chosen: string | null = null;
  if (newlyCraftable.length > 0 && gained) {
    if (input.goalRecipeId && newlyCraftable.includes(input.goalRecipeId)) {
      chosen = input.goalRecipeId;
    } else {
      let best = -1;
      for (const id of newlyCraftable) {
        const view = input.recipeViews.find((v) => v.recipe.id === id);
        const value = view ? getItem(view.recipe.outputItemId).value : 0;
        if (value > best) {
          best = value;
          chosen = id;
        }
      }
    }
  }

  return { recipeId: chosen, nextCraftableIds: currentCraftable, nextInventory: currentInv };
}
