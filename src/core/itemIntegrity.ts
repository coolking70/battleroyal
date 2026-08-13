/**
 * 物品守恒审计（Phase 2A Step 9）。
 *
 * 第二阶段引入了「有限物资」与「玩家/NPC 共享同一份库存」，
 * 物品实例（ItemStack）靠 `uid` 全局唯一标识。任何一类手改 / 逻辑 bug 都可能
 * 让同一 uid 出现在多处、凭空多出物品、引用不存在的物品，或装备指向空实例。
 *
 * `auditItemIntegrity` 是一个**纯函数**，扫一遍整个 `GameState` 给出
 * `{ ok, problems }`：
 *  - ok=true 表示物品守恒不变量成立（全新对局 / 任何合法推进后的对局都应如此）；
 *  - 任一违例都会进入 problems，便于调试面板与「逐 tick 审计」测试一次性展示。
 *
 * 设计为可「逐 tick 调用」：调用方（模拟测试 / 调试面板）可在每个时间单位后
 * 调一次来守住守恒，而不必侵入引擎主循环。
 */

import { tryGetItem } from '../data/items';
import type { GameState, ItemStack } from './types';

export interface ItemIntegrityReport {
  ok: boolean;
  problems: string[];
}

interface LocatedStack {
  uid: string;
  itemId: string;
  count: number;
  where: string;
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * 审计整局状态的物品守恒不变量。
 *
 * 检查项：
 *  1. 每个物品实例的 uid 在**整个对局**内全局唯一（不得重复出现在任意背包 /
 *     装备 / 地面 / pendingPickup）；
 *  2. itemId 必须是真实存在的物品定义；
 *  3. 堆叠数量必须是正整数；
 *  4. 角色的 equippedWeaponId / equippedArmorId / equippedUtilityId（若设置）必须指向其 equipment
 *     里真实存在的实例 uid。
 */
export function auditItemIntegrity(state: GameState): ItemIntegrityReport {
  const problems: string[] = [];
  const located: LocatedStack[] = [];

  /* --- 收集全部物品实例 --- */
  for (const [id, raw] of Object.entries(state.characters)) {
    if (!isRecord(raw)) continue;
    const c = raw as unknown as { inventory?: unknown; equipment?: unknown; name?: string };
    const who = `角色 ${id}${typeof c.name === 'string' ? `（${c.name}）` : ''}`;
    for (const list of ['inventory', 'equipment'] as const) {
      const arr = c[list];
      if (!Array.isArray(arr)) continue;
      for (const s of arr) {
        if (!isRecord(s)) {
          problems.push(`${who} 的 ${list} 中存在结构损坏的物品`);
          continue;
        }
        const stack = s as unknown as ItemStack;
        located.push({
          uid: String(stack.uid ?? ''),
          itemId: String(stack.itemId ?? ''),
          count: typeof stack.count === 'number' ? stack.count : NaN,
          where: `${who} 的 ${list}`,
        });
      }
    }
  }

  for (const [zoneId, raw] of Object.entries(state.zones)) {
    if (!isRecord(raw)) continue;
    const z = raw as unknown as { groundItems?: unknown };
    if (!Array.isArray(z.groundItems)) continue;
    for (const s of z.groundItems) {
      if (!isRecord(s)) {
        problems.push(`区域 ${zoneId} 的地面存在结构损坏的物品`);
        continue;
      }
      const stack = s as unknown as ItemStack;
      located.push({
        uid: String(stack.uid ?? ''),
        itemId: String(stack.itemId ?? ''),
        count: typeof stack.count === 'number' ? stack.count : NaN,
        where: `区域 ${zoneId} 的地面`,
      });
    }
  }

  if (state.pendingPickup && isRecord(state.pendingPickup) && isRecord(state.pendingPickup.stack)) {
    const stack = state.pendingPickup.stack as unknown as ItemStack;
    located.push({
      uid: String(stack.uid ?? ''),
      itemId: String(stack.itemId ?? ''),
      count: typeof stack.count === 'number' ? stack.count : NaN,
      where: 'pendingPickup',
    });
  }

  if (isRecord(state.landmarks)) for (const [landmarkId, raw] of Object.entries(state.landmarks)) {
    if (!isRecord(raw) || !Array.isArray(raw.loot)) continue;
    for (const s of raw.loot) {
      if (!isRecord(s)) {
        problems.push(`地标 ${landmarkId} 的隐藏物资存在结构损坏`);
        continue;
      }
      const stack = s as unknown as ItemStack;
      located.push({ uid: String(stack.uid ?? ''), itemId: String(stack.itemId ?? ''), count: typeof stack.count === 'number' ? stack.count : NaN, where: `地标 ${landmarkId} 的隐藏物资` });
    }
  }

  /* --- 1+2+3. uid / itemId / count 校验 --- */
  const seen = new Map<string, string>();
  for (const s of located) {
    if (s.uid.length === 0) {
      problems.push(`${s.where} 存在空 uid 的物品`);
      continue;
    }
    if (!tryGetItem(s.itemId)) {
      problems.push(`${s.where} 持有未知物品（${s.itemId}）`);
    }
    if (!isPositiveInt(s.count)) {
      problems.push(`${s.where} 的物品数量非法（${s.count}）`);
    }
    const first = seen.get(s.uid);
    if (first) {
      problems.push(`物品 UID「${s.uid}」重复出现：${first} 与 ${s.where}`);
    } else {
      seen.set(s.uid, s.where);
    }
  }

  /* --- 4. 装备引用一致性 --- */
  for (const [id, raw] of Object.entries(state.characters)) {
    if (!isRecord(raw)) continue;
    const c = raw as unknown as {
      equipment?: unknown;
      equippedWeaponId?: string | null;
      equippedArmorId?: string | null;
      equippedUtilityId?: string | null;
    };
    const equipUids = new Set(
      Array.isArray(c.equipment)
        ? c.equipment
            .filter(isRecord)
            .map((s) => String((s as unknown as ItemStack).uid))
        : [],
    );
    for (const slot of ['equippedWeaponId', 'equippedArmorId', 'equippedUtilityId'] as const) {
      const uid = c[slot];
      if (uid !== null && uid !== undefined && !equipUids.has(uid)) {
        problems.push(`角色 ${id} 的 ${slot} 指向不存在的装备实例（${uid}）`);
      }
    }
  }

  return { ok: problems.length === 0, problems };
}
