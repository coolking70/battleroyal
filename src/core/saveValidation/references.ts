/**
 * 存档校验 · 引用层（第三层）。
 *
 * Phase 2A-1 扩充。在原有交叉引用存在性检查之上，新增：
 * - 装备类型：三个装备 id 必须指向匹配槽位，equipment 里不得出现 raw / component；
 * - 玩家制作目标：craftGoalRecipeId 必须为 null 或真实配方，完成态必须有目标；
 * - NPC 计划三字段一致性；
 * - 事件：id 唯一、type / importance / time 合法、actorId / targetId / zoneId
 *   引用有效、message 为字符串、metadata 可 JSON 序列化；
 * - encounter：未解决时玩家与敌人必须存活、同区、encounter.zoneId === 玩家所在区；
 *   对局已结束时不得存在未解决遭遇；
 * - pendingPickup：stack 合法、zoneId 存在且 === 玩家所在区、source 合法。
 */

import { tryGetItem } from '../../data/items';
import { tryGetCharacterDef } from '../../data/characters';
import { tryGetRecipe } from '../../data/recipes';
import { validateStack } from './numbers';
import {
  EVENT_IMPORTANCE_SET,
  EVENT_TYPE_SET,
  isFiniteNumber,
  isRecord,
  type ValidationContext,
} from './types';

function isItemIdKnown(itemId: unknown): boolean {
  return typeof itemId === 'string' && Boolean(tryGetItem(itemId));
}

/** metadata 必须可 JSON 序列化：仅允许 string / number / boolean / null */
function isJsonSerializableMetadata(v: unknown): boolean {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  return false;
}

export function validateReferences(ctx: ValidationContext): void {
  const { state, characters, zones, charIds, zoneIds, fail } = ctx;

  /* --- turnOrder / deathOrder --- */
  if (Array.isArray(state.turnOrder)) {
    for (const id of state.turnOrder as unknown[]) {
      if (typeof id !== 'string' || !charIds.has(id)) {
        fail(`turnOrder 引用了不存在的角色（${String(id)}）`);
      }
    }
  }
  if (Array.isArray(state.deathOrder)) {
    for (const id of state.deathOrder as unknown[]) {
      if (typeof id !== 'string' || !charIds.has(id)) {
        fail(`deathOrder 引用了不存在的角色（${String(id)}）`);
      }
    }
  }

  /* --- 角色表内部引用 --- */
  if (!isRecord(characters)) return; // 结构层已报错，避免后续遍历崩溃
  for (const [id, raw] of Object.entries(characters)) {
    if (!isRecord(raw)) continue;
    const c = raw;

    if (typeof c.characterId !== 'string') {
      fail(`角色 ${id} 缺少合法 characterId`);
    } else {
      const characterDef = tryGetCharacterDef(c.characterId);
      if (!characterDef) {
        fail(`角色 ${id} 引用了未知职业（${c.characterId}）`);
      } else if (c.passiveId !== characterDef.passiveId) {
        fail(`角色 ${id} 的 passiveId 与职业 ${c.characterId} 不匹配`);
      }
    }

    if (typeof c.currentZoneId !== 'string' || !zoneIds.has(c.currentZoneId)) {
      fail(`角色 ${id} 位于不存在的区域（${String(c.currentZoneId)}）`);
    }

    const equipStacks = Array.isArray(c.equipment) ? c.equipment.filter(isRecord) : [];
    const equipUids = new Set(equipStacks.map((s) => String(s.uid)));

    for (const field of ['inventory', 'equipment'] as const) {
      const list = c[field];
      if (!Array.isArray(list)) {
        fail(`角色 ${id} 的 ${field} 类型错误`);
        continue;
      }
      for (const s of list) {
        if (!isRecord(s) || typeof s.itemId !== 'string') {
          fail(`角色 ${id} 的 ${field} 中存在结构损坏的物品`);
          continue;
        }
        if (!isItemIdKnown(s.itemId)) {
          fail(`角色 ${id} 持有未知物品（${String(s.itemId)}）`);
        }
      }
    }

    /* 装备类型：equipment 只能放正式装备，且装备位类型必须匹配 */
    for (const s of equipStacks) {
      const def = typeof s.itemId === 'string' ? tryGetItem(s.itemId) : null;
      if (def && !def.equipmentSlot) {
        fail(`角色 ${id} 的 equipment 里出现了不可装备物品（${def.name}）`);
      }
    }
    for (const slot of ['equippedWeaponId', 'equippedArmorId', 'equippedUtilityId'] as const) {
      const uid = c[slot];
      if (uid !== null && uid !== undefined) {
        if (typeof uid !== 'string') {
          fail(`角色 ${id} 的 ${slot} 类型错误`);
          continue;
        }
        if (!equipUids.has(uid)) {
          fail(`角色 ${id} 的 ${slot} 指向不存在的装备实例（${uid}）`);
          continue;
        }
        const stack = equipStacks.find((s) => s.uid === uid);
        const def = stack && typeof stack.itemId === 'string' ? tryGetItem(stack.itemId) : null;
        if (slot === 'equippedWeaponId') {
          if (!def || def.equipmentSlot !== 'weapon') {
            fail(`角色 ${id} 的 equippedWeaponId 指向的不是武器（${String(stack?.itemId)}）`);
          }
        } else if (slot === 'equippedArmorId') {
          if (!def || def.equipmentSlot !== 'armor') {
            fail(`角色 ${id} 的 equippedArmorId 指向的不是防具（${String(stack?.itemId)}）`);
          }
        } else if (!def || def.equipmentSlot !== 'utility') {
          fail(`角色 ${id} 的 equippedUtilityId 指向的不是 utility（${String(stack?.itemId)}）`);
        }
      }
    }

    if (c.killedBy !== null && c.killedBy !== undefined) {
      if (typeof c.killedBy !== 'string' || !charIds.has(c.killedBy)) {
        fail(`角色 ${id} 的击杀者不存在（${String(c.killedBy)}）`);
      }
    }

    /* NPC 计划三字段一致性（含对玩家不适用字段的宽容处理） */
    const planId = c.plannedRecipeId;
    const planCreated = c.planCreatedAt;
    const planReason = c.planReason;
    if (planId === null || planId === undefined) {
      if (planCreated !== null && planCreated !== undefined) {
        fail(`角色 ${id} 没有制作目标却带有 planCreatedAt`);
      }
      if (planReason !== null && planReason !== undefined) {
        fail(`角色 ${id} 没有制作目标却带有 planReason`);
      }
    } else {
      if (typeof planId !== 'string') {
        fail(`角色 ${id} 的 plannedRecipeId 类型错误`);
      } else if (!tryGetRecipe(planId)) {
        fail(`角色 ${id} 的制作目标指向不存在的配方（${planId}）`);
      }
      if (!isFiniteNumberValue(planCreated) || (planCreated as number) < 0) {
        fail(`角色 ${id} 有制作目标但 planCreatedAt 非法`);
      } else if ((planCreated as number) > (state.time as number)) {
        fail(`角色 ${id} 的 planCreatedAt 晚于当前时间`);
      }
      if (typeof planReason !== 'string' || planReason.length === 0) {
        fail(`角色 ${id} 有制作目标但 planReason 必须为非空字符串`);
      }

    }
  }

  /* --- 玩家制作目标 --- */
  const goalId = state.craftGoalRecipeId;
  if (goalId !== null && goalId !== undefined) {
    if (typeof goalId !== 'string') {
      fail('state.craftGoalRecipeId 类型错误');
    } else if (!tryGetRecipe(goalId)) {
      fail(`玩家制作目标指向不存在的配方（${goalId}）`);
    }
  }
  if (state.craftGoalCompleted === true && (goalId === null || goalId === undefined)) {
    fail('craftGoalCompleted 为 true 但未设定制作目标');
  }

  /* --- 事件 --- */
  const seenEventIds = new Set<string>();
  if (Array.isArray(state.events)) {
    for (const e of state.events as unknown[]) {
      if (!isRecord(e)) {
        fail('events 中存在结构损坏的事件');
        continue;
      }
      if (typeof e.id !== 'string' || e.id.length === 0) {
        fail('事件缺少非空 id');
      } else if (seenEventIds.has(e.id)) {
        fail(`事件 id 重复：${e.id}`);
      } else {
        seenEventIds.add(e.id);
      }
      if (typeof e.type !== 'string' || !EVENT_TYPE_SET.has(e.type)) {
        fail(`事件类型非法：${String(e.type)}`);
      }
      if (!isFiniteNumberValue(e.time) || (e.time as number) < 0) {
        fail(`事件 ${String(e.id)} 的时间非法`);
      } else if ((e.time as number) > (state.time as number)) {
        fail(`事件 ${String(e.id)} 的时间晚于 state.time`);
      }
      if (typeof e.importance !== 'string' || !EVENT_IMPORTANCE_SET.has(e.importance)) {
        fail(`事件 ${String(e.id)} 的重要度非法（${String(e.importance)}）`);
      }
      for (const ref of ['actorId', 'targetId'] as const) {
        const v = e[ref];
        if (v !== null && v !== undefined) {
          if (typeof v !== 'string' || !charIds.has(v)) {
            fail(`事件 ${String(e.id)} 的 ${ref} 引用了不存在的角色（${String(v)}）`);
          }
        }
      }
      const z = e.zoneId;
      if (z !== null && z !== undefined) {
        if (typeof z !== 'string' || !zoneIds.has(z)) {
          fail(`事件 ${String(e.id)} 的 zoneId 引用了不存在的区域（${String(z)}）`);
        }
      }
      if (typeof e.message !== 'string') {
        fail(`事件 ${String(e.id)} 的 message 必须是字符串`);
      }
      if (e.metadata !== undefined && e.metadata !== null) {
        if (!isRecord(e.metadata)) {
          fail(`事件 ${String(e.id)} 的 metadata 必须是对象`);
        } else {
          for (const [k, v] of Object.entries(e.metadata)) {
            if (!isJsonSerializableMetadata(v)) {
              fail(`事件 ${String(e.id)} 的 metadata.${k} 不可 JSON 序列化`);
              break;
            }
          }
        }
      }
    }
  }

  /* --- 世界事件（Phase 3A Step 6） --- */
  const WORLD_EVENT_IDS = new Set([
    'blackout',
    'rain',
    'emergency_broadcast',
    'medical_alert',
    'research_anomaly',
    'citywide_unrest',
  ]);
  const WORLD_EVENT_SCOPES = new Set(['global', 'zone']);

  if (!Array.isArray(state.activeWorldEvents)) {
    fail('state.activeWorldEvents 必须是数组');
  } else {
    const seenIds = new Set<string>();
    const seenEventIds = new Set<string>();
    for (const raw of state.activeWorldEvents as unknown[]) {
      if (!isRecord(raw)) {
        fail('activeWorldEvents 中存在结构损坏的事件');
        continue;
      }
      if (typeof raw.id !== 'string' || raw.id.length === 0) {
        fail('activeWorldEvents 中存在缺少 id 的条目');
      } else if (seenIds.has(raw.id)) {
        fail(`activeWorldEvents 存在重复实例 id（${raw.id}）`);
      } else {
        seenIds.add(raw.id);
      }
      if (typeof raw.eventId !== 'string' || !WORLD_EVENT_IDS.has(raw.eventId)) {
        fail(`activeWorldEvents 事件 id 非法：${String(raw.eventId)}`);
      } else if (seenEventIds.has(raw.eventId)) {
        // 同一种世界事件不允许同时生效两份，否则修正值会被重复相乘
        fail(`activeWorldEvents 中同种事件重复生效（${raw.eventId}）`);
      } else {
        seenEventIds.add(raw.eventId);
      }
      if (typeof raw.scope !== 'string' || !WORLD_EVENT_SCOPES.has(raw.scope)) {
        fail(`activeWorldEvents 的 scope 非法：${String(raw.scope)}`);
      }
      // scope 与 zoneId 必须自洽：全局事件不得带区域，区域事件必须指向存在的区域
      if (raw.scope === 'global') {
        if (raw.zoneId !== null) {
          fail(`全局世界事件的 zoneId 必须为 null（${String(raw.zoneId)}）`);
        }
      } else if (typeof raw.zoneId !== 'string' || !zoneIds.has(raw.zoneId)) {
        fail(`activeWorldEvents 引用了不存在的区域（${String(raw.zoneId)}）`);
      }
      if (
        !isFiniteNumber(raw.remaining) ||
        !Number.isInteger(raw.remaining) ||
        (raw.remaining as number) <= 0
      ) {
        // 已归零的事件应当已被移入 history，出现在 active 里即为损坏
        fail(`activeWorldEvents 的 remaining 非法（${String(raw.remaining)}）`);
      }
      if (
        !isFiniteNumber(raw.startedAtTime) ||
        !Number.isInteger(raw.startedAtTime) ||
        (raw.startedAtTime as number) < 0
      ) {
        fail(`activeWorldEvents 的 startedAtTime 非法（${String(raw.startedAtTime)}）`);
      }
      if (typeof raw.label !== 'string' || typeof raw.description !== 'string') {
        fail('activeWorldEvents 的 label / description 必须是字符串');
      }
    }
  }

  if (!Array.isArray(state.worldEventHistory)) {
    fail('state.worldEventHistory 必须是数组');
  } else {
    for (const raw of state.worldEventHistory as unknown[]) {
      if (!isRecord(raw)) {
        fail('worldEventHistory 中存在结构损坏的记录');
        continue;
      }
      if (typeof raw.eventId !== 'string' || !WORLD_EVENT_IDS.has(raw.eventId)) {
        fail(`worldEventHistory 事件 id 非法：${String(raw.eventId)}`);
      }
      if (raw.zoneId !== null && (typeof raw.zoneId !== 'string' || !zoneIds.has(raw.zoneId))) {
        fail(`worldEventHistory 引用了不存在的区域（${String(raw.zoneId)}）`);
      }
      if (
        !isFiniteNumber(raw.startedAtTime) ||
        !isFiniteNumber(raw.endedAtTime) ||
        (raw.endedAtTime as number) < (raw.startedAtTime as number)
      ) {
        fail('worldEventHistory 的时间区间非法（结束早于开始）');
      }
    }
  }

  /* --- 区域表 --- */
  for (const zoneId of zoneIds) {
    if (!isRecord(zones[zoneId])) {
      fail(`缺少区域数据：${zoneId}`);
    }
  }
  if (!isRecord(zones)) return; // 结构层已报错，避免遍历崩溃
  for (const [zoneId, raw] of Object.entries(zones)) {
    if (!zoneIds.has(zoneId)) {
      fail(`存在未知区域：${zoneId}`);
      continue;
    }
    if (!isRecord(raw)) {
      fail(`区域 ${zoneId} 不是对象`);
      continue;
    }
    const z = raw;
    if (
      z.status !== 'safe' &&
      z.status !== 'warning' &&
      z.status !== 'restricted'
    ) {
      fail(`区域 ${zoneId} 的状态非法（${String(z.status)}）`);
    }
    if (!Array.isArray(z.aliveCharacterIds)) {
      fail(`区域 ${zoneId} 的存活名单类型错误`);
    } else {
      for (const id of z.aliveCharacterIds) {
        if (typeof id !== 'string' || !charIds.has(id)) {
          fail(`区域 ${zoneId} 的存活名单引用了不存在的角色（${String(id)}）`);
        }
      }
    }
    if (!Array.isArray(z.groundItems)) {
      fail(`区域 ${zoneId} 的地面物品类型错误`);
    } else {
      for (const s of z.groundItems) {
        validateStack(ctx, s, `区域 ${zoneId} 的地面`);
      }
    }
  }

  /* --- encounter --- */
  const encounter = state.encounter;
  if (encounter !== null && encounter !== undefined) {
    if (!isRecord(encounter)) {
      fail('encounter 结构损坏');
    } else {
      const enemyId = encounter.enemyId;
      if (typeof enemyId !== 'string' || !charIds.has(enemyId)) {
        fail(`遭遇指向不存在的角色（${String(enemyId)}）`);
      }
      const zoneId = encounter.zoneId;
      if (typeof zoneId !== 'string' || !zoneIds.has(zoneId)) {
        fail(`遭遇发生在不存在的区域（${String(zoneId)}）`);
      }
      if (typeof encounter.resolved !== 'boolean') {
        fail('遭遇缺少 resolved 标记');
      } else if (!encounter.resolved) {
        /* 未解决遭遇的三条硬约束 */
        const player = characters[state.playerId as string];
        const enemy = isRecord(player) ? characters[enemyId as string] : undefined;
        if (!isRecord(player) || player.alive !== true) {
          fail('存在未解决的遭遇，但玩家已死亡');
        }
        if (!isRecord(enemy) || enemy.alive !== true) {
          fail('存在未解决的遭遇，但敌人已死亡');
        }
        if (isRecord(player) && isRecord(enemy)) {
          if (enemy.currentZoneId !== player.currentZoneId) {
            fail('存在未解决的遭遇，但敌人已不在玩家所在区域');
          }
          if (zoneId !== player.currentZoneId) {
            fail('encounter.zoneId 与玩家当前区域不一致');
          }
        }
        if (state.status !== 'playing') {
          fail('对局已结束，但存在未解决的遭遇');
        }
      }
    }
  }

  /* --- pendingPickup --- */
  const pending = state.pendingPickup;
  if (pending !== null && pending !== undefined) {
    if (!isRecord(pending) || !isRecord(pending.stack)) {
      fail('pendingPickup 结构损坏');
    } else {
      const stack = pending.stack;
      validateStack(ctx, stack, 'pendingPickup');
      if (typeof stack.itemId !== 'string' || !isItemIdKnown(stack.itemId)) {
        fail('pendingPickup 指向未知物品');
      }
      if (typeof pending.source !== 'string' ||
          (pending.source !== 'search' && pending.source !== 'ground')) {
        fail(`pendingPickup.source 非法（${String(pending.source)}）`);
      } else if (pending.source === 'search' &&
        (Object.prototype.hasOwnProperty.call(stack, 'droppedBy') ||
          Object.prototype.hasOwnProperty.call(stack, 'revealedTo'))) {
        fail('搜索发现的 pendingPickup 不得携带尸体掉落归属字段');
      }
      const zoneId = pending.zoneId;
      if (typeof zoneId !== 'string' || !zoneIds.has(zoneId)) {
        fail(`pendingPickup.zoneId 引用了不存在的区域（${String(zoneId)}）`);
      } else {
        const player = characters[state.playerId as string];
        if (isRecord(player) && player.currentZoneId !== zoneId) {
          fail('pendingPickup.zoneId 与玩家当前区域不一致');
        }
      }
      if (pending.dropUid !== undefined && pending.dropUid !== null) {
        const dropUid = pending.dropUid;
        if (typeof dropUid !== 'string') {
          fail('pendingPickup.dropUid 类型错误');
        } else {
          // dropUid 必须指向玩家背包里真实存在的实例
          const player = characters[state.playerId as string];
          const inv = isRecord(player) && Array.isArray(player.inventory) ? player.inventory : [];
          const exists = inv.some((s) => isRecord(s) && s.uid === dropUid);
          if (!exists) {
            fail(`pendingPickup.dropUid 指向背包里不存在的物品（${dropUid}）`);
          }
        }
      }
    }
  }
}

function isFiniteNumberValue(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}
