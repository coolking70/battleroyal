/**
 * 存档校验 · 一致性层（第四层）。
 *
 * Phase 2A-1 扩充。在原有跨实体自洽检查之上，新增：
 * - **全局** UID 唯一：所有角色背包 / 装备 + 所有区域地面 + pendingPickup.stack
 *   的 uid 在整个 GameState 中只能出现一次；
 * - 区域存活名单**双向完全一致**：存活角色恰好出现在所在区域名单中且不出现于
 *   其他区域；死亡角色不出现在任何名单；名单无重复、无未知角色；
 * - 事件：eventSeq 必须 ≥ 现存事件 id 的最大值；
 * - eventCounters：total ≥ events.length、数值非负、byType key 必须合法。
 */

import { isRecord, EVENT_TYPE_SET, type ValidationContext } from './types';

export function validateConsistency(ctx: ValidationContext): void {
  const { state, characters, zones, charIds, fail } = ctx;
  const currentTime = typeof state.time === 'number' ? state.time : 0;

  /* --- turnOrder 完整性 --- */
  const orderIds = (Array.isArray(state.turnOrder) ? state.turnOrder : []) as string[];
  const orderSet = new Set(orderIds);
  if (orderIds.length !== orderSet.size) {
    fail('turnOrder 存在重复角色');
  }
  for (const id of charIds) {
    if (!orderSet.has(id)) fail(`turnOrder 遗漏了存在的角色（${id}）`);
  }

  /* --- status ↔ endReason --- */
  const status = state.status;
  const endReason = state.endReason;
  if (status === 'playing') {
    if (endReason !== null && endReason !== undefined) {
      fail(`进行中对局不应带有结束原因（${String(endReason)}）`);
    }
  } else if (status === 'won') {
    if (endReason !== 'player_won' && endReason !== 'extraction' && endReason !== 'research') fail(`won 对局的结束原因非法（实际 ${String(endReason)}）`);
  } else if (status === 'lost') {
    if (endReason !== 'last_survivor' && endReason !== 'extraction' && endReason !== 'research') fail(`lost 对局的结束原因非法（实际 ${String(endReason)}）`);
  } else if (status === 'draw') {
    if (endReason !== 'draw' && endReason !== 'time_limit') {
      fail(`draw 对局必须 endReason=draw/time_limit（实际 ${String(endReason)}）`);
    }
  }

  /* --- unified victory and extraction invariants --- */
  const victory = state.victory;
  if (!isRecord(victory)) {
    fail('state.victory 必须是对象');
  } else {
    const empty = victory.winnerId === null && victory.type === null && victory.declaredAtTime === null;
    const complete = typeof victory.winnerId === 'string'
      && typeof victory.type === 'string'
      && typeof victory.declaredAtTime === 'number';
    if (!empty && !complete) fail('state.victory 三字段必须完整存在，或全部为 null');
    if (status === 'playing' && !empty) fail('进行中的对局不得带 victory result');
    if (status === 'draw' && !empty) fail('平局不得带 victory result');
    if ((status === 'won' || status === 'lost') && !complete) fail('非平局终局必须带完整 victory result');
    if (complete && typeof victory.winnerId === 'string') {
      const winner = characters[victory.winnerId];
      if (!isRecord(winner) || winner.alive !== true) fail('victory.winnerId 必须指向存活角色');
      if ((victory.winnerId === state.playerId) !== (status === 'won')) fail('status 必须与 victory.winnerId 的玩家归属一致');
    }
  }
  const aliveContestants = Object.values(characters).filter((raw) => isRecord(raw) && raw.alive === true).length;
  if (status === 'playing' && aliveContestants <= 1) {
    fail('进行中的对局必须仍有至少两名存活参赛者，单人或零人应先完成终局判定');
  }
  const activeExtraction = state.activeExtraction;
  if (activeExtraction !== null && activeExtraction !== undefined) {
    if (status !== 'playing') fail('已结束对局不得保留 activeExtraction');
    if (!isRecord(activeExtraction)) {
      fail('activeExtraction 必须是对象或 null');
    } else {
      const caller = typeof activeExtraction.callerId === 'string' ? characters[activeExtraction.callerId] : null;
      if (!isRecord(caller) || caller.alive !== true || caller.currentZoneId !== 'station') fail('activeExtraction caller 状态不一致');
      if (isRecord(caller) && rawItemCount(caller, 'extraction_beacon') < 1) fail('activeExtraction caller 缺少撤离信标');
      if (activeExtraction.phase === 'ready' && typeof activeExtraction.readyAtTime === 'number' && currentTime < activeExtraction.readyAtTime) fail('ready extraction 的当前时间尚未到 readyAtTime');
    }
  }

  /* --- phase --- */
  const phase = state.phase;
  if (phase !== 'opening' && phase !== 'midgame' && phase !== 'finale') {
    fail(`state.phase 非法：${String(phase)}`);
  }

  /* --- 全局 UID 唯一 --- */
  const seenUid = new Map<string, string>();
  const markUid = (uid: unknown, where: string): void => {
    if (typeof uid !== 'string' || uid.length === 0) return;
    const first = seenUid.get(uid);
    if (first) {
      fail(`物品 UID「${uid}」全局重复：${first} 与 ${where}`);
    } else {
      seenUid.set(uid, where);
    }
  };
  for (const [id, raw] of Object.entries(characters)) {
    if (!isRecord(raw)) continue;
    const c = raw;
    for (const field of ['inventory', 'equipment'] as const) {
      const list = c[field];
      if (!Array.isArray(list)) continue;
      for (const s of list) {
        if (isRecord(s)) markUid(s.uid, `角色 ${id} 的 ${field}`);
      }
    }
  }
  for (const [zoneId, raw] of Object.entries(zones)) {
    if (!isRecord(raw)) continue;
    const z = raw;
    if (!Array.isArray(z.groundItems)) continue;
    for (const s of z.groundItems) {
      if (isRecord(s)) markUid(s.uid, `区域 ${zoneId} 的地面`);
    }
  }
  if (isRecord(state.pendingPickup) && isRecord(state.pendingPickup.stack)) {
    markUid(state.pendingPickup.stack.uid, 'pendingPickup');
  }
  if (isRecord(state.landmarks)) for (const [landmarkId, raw] of Object.entries(state.landmarks)) {
    if (!isRecord(raw) || !Array.isArray(raw.loot)) continue;
    for (const stack of raw.loot) if (isRecord(stack)) markUid(stack.uid, `地标 ${landmarkId} 的隐藏物资`);
  }
  // Phase 4T-AF2: incident reward pool stacks are real item stacks with real
  // UIDs; they join the same global uniqueness invariant.
  if (isRecord(state.incidents)) for (const [incidentId, raw] of Object.entries(state.incidents)) {
    if (!isRecord(raw) || !Array.isArray(raw.reward)) continue;
    for (const stack of raw.reward) {
      if (isRecord(stack)) markUid(stack.uid, `事件 ${incidentId} 的 reward 池`);
    }
  }

  /* --- 区域存活名单：双向完全一致 --- */
  const aliveCharIds = new Set<string>();
  for (const [id, raw] of Object.entries(characters)) {
    if (isRecord(raw) && raw.alive === true) aliveCharIds.add(id);
  }

  const zoneName = (id: string): string => `区域 ${id}`;
  for (const [id, raw] of Object.entries(characters)) {
    if (!isRecord(raw)) continue;
    const c = raw;
    const alive = c.alive === true;

    if (alive && typeof c.currentZoneId === 'string') {
      const here = zones[c.currentZoneId];
      const inList = isRecord(here) && Array.isArray(here.aliveCharacterIds)
        ? (here.aliveCharacterIds as unknown[]).includes(id)
        : false;
      if (!inList) {
        fail(`存活角色 ${id} 不在其所在区域（${c.currentZoneId}）的存活名单里`);
      }
    }
    if (alive) {
      // 存活角色不得出现在「其他」区域名单
      for (const [zoneId, z] of Object.entries(zones)) {
        if (zoneId === c.currentZoneId) continue;
        if (!isRecord(z) || !Array.isArray(z.aliveCharacterIds)) continue;
        if ((z.aliveCharacterIds as unknown[]).includes(id)) {
          fail(`存活角色 ${id} 却出现在非所在区域 ${zoneId} 的存活名单中`);
          break;
        }
      }
    } else {
      for (const [zoneId, z] of Object.entries(zones)) {
        if (!isRecord(z) || !Array.isArray(z.aliveCharacterIds)) continue;
        if ((z.aliveCharacterIds as unknown[]).includes(id)) {
          fail(`死亡角色 ${id} 仍留在区域 ${zoneId} 的存活名单中`);
          break;
        }
      }
    }
  }

  // 名单去重 + 名单内角色必须存活
  for (const [zoneId, raw] of Object.entries(zones)) {
    if (!isRecord(raw) || !Array.isArray(raw.aliveCharacterIds)) continue;
    const list = raw.aliveCharacterIds as unknown[];
    const set = new Set(list);
    if (list.length !== set.size) {
      fail(`${zoneName(zoneId)} 的存活名单存在重复 ID`);
    }
    for (const id of list) {
      if (typeof id === 'string' && charIds.has(id) && !aliveCharIds.has(id)) {
        fail(`${zoneName(zoneId)} 的存活名单包含了已死亡的角色（${id}）`);
      }
    }
  }

  /* --- 事件序列与统计 --- */
  if (Array.isArray(state.events)) {
    let maxEventSeq = -1;
    let seenEventIdCount = 0;
    for (const e of state.events as unknown[]) {
      if (!isRecord(e)) continue;
      if (typeof e.id === 'string') {
        const m = /^e(\d+)$/.exec(e.id);
        if (m) maxEventSeq = Math.max(maxEventSeq, Number.parseInt(m[1]!, 10));
      }
      if (typeof e.id === 'string') seenEventIdCount += 1;
    }
    if (isFiniteNumberValue(state.eventSeq)) {
      const seq = state.eventSeq as number;
      if (maxEventSeq >= seq) {
        fail(`state.eventSeq（${seq}）必须大于现存事件 id 的最大值（${maxEventSeq}）`);
      }
      if (seenEventIdCount > seq) {
        fail('现存事件数量超过 eventSeq');
      }
    } else {
      fail('state.eventSeq 类型错误');
    }
  }

  const counters = state.eventCounters;
  if (!isRecord(counters)) {
    fail('缺少 eventCounters');
  } else {
    if (!isFiniteNumberValue(counters.total) || (counters.total as number) < 0) {
      fail('eventCounters.total 必须为非负数');
    } else if (
      Array.isArray(state.events) &&
      (counters.total as number) < state.events.length
    ) {
      fail(`eventCounters.total（${counters.total}）小于现存事件数（${state.events.length}）`);
    }
    if (!isFiniteNumberValue(counters.archived) || (counters.archived as number) < 0) {
      fail('eventCounters.archived 必须为非负数');
    }
    if (isRecord(counters.byType)) {
      for (const [k, v] of Object.entries(counters.byType)) {
        if (!EVENT_TYPE_SET.has(k)) {
          fail(`eventCounters.byType 包含非法事件类型（${k}）`);
        }
        if (!isFiniteNumberValue(v) || (v as number) < 0) {
          fail(`eventCounters.byType.${k} 必须为非负数`);
        }
      }
    } else {
      fail('eventCounters.byType 类型错误');
    }
  }
}

function isFiniteNumberValue(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

function rawItemCount(raw: Record<string, unknown>, itemId: string): number {
  const inventory = Array.isArray(raw.inventory) ? raw.inventory : [];
  return inventory.reduce((sum, stack) => {
    if (!isRecord(stack) || stack.itemId !== itemId || typeof stack.count !== 'number') return sum;
    return sum + stack.count;
  }, 0);
}
