/**
 * 存档校验 · 数值层（第二层）。
 *
 * Phase 2A-1 扩充。除原有「数值区间」外，新增：
 * - GameState 基础计数器（eventSeq / uidSeq / nextZoneEventTime / endedAtTime /
 *   finaleStartedAt）的类型、有限性、非负性与时间一致性；
 * - 背包：格数上限、每个 ItemStack 的 uid / itemId / count / maxStack /
 *   不可堆叠 / 耐久字段；
 * - 角色状态：stats 全字段非负、alive ↔ hp、diedAtTime 非空一致性；
 * - 区域库存：每条 loot 合法、remainingLootCount === Σcount、
 *   initialLootCount ≥ remaining、supply 必须等于派生比例（容差 1e-6）。
 */

import { GAME_CONFIG } from '../../data/gameConfig';
import { tryGetItem } from '../../data/items';
import { SKILLS } from '../skills';
import { ADRENALINE_ID, FIELD_CRAFT_ID, MEDICAL_FOCUS_ID, EXPOSED_ID } from '../statusIds';
import { isFiniteNumber, isRecord, type ValidationContext } from './types';

const INVENTORY_SLOTS = GAME_CONFIG.inventorySlots;

/** 校验一个 ItemStack 的数值与结构合法性（背包 / 装备 / 地面 / pendingPickup 共用） */
export function validateStack(
  ctx: ValidationContext,
  stack: unknown,
  where: string,
): boolean {
  const { fail, charIds } = ctx;
  if (!isRecord(stack)) {
    fail(`${where} 中存在结构损坏的物品`);
    return false;
  }
  const s = stack;
  let ok = true;

  if (typeof s.uid !== 'string' || s.uid.length === 0) {
    fail(`${where} 的物品缺少非空 uid`);
    ok = false;
  }

  const hasDroppedBy = Object.prototype.hasOwnProperty.call(s, 'droppedBy');
  const hasRevealedTo = Object.prototype.hasOwnProperty.call(s, 'revealedTo');
  if (hasDroppedBy || hasRevealedTo) {
    const groundLike = where.includes('地面') || where === 'pendingPickup';
    if (!groundLike) {
      fail(`${where} 不得携带尸体掉落归属字段`);
      ok = false;
    }
    if (hasDroppedBy && (typeof s.droppedBy !== 'string' || !charIds.has(s.droppedBy))) {
      fail(`${where} 的 droppedBy 不是合法角色引用（${String(s.droppedBy)}）`);
      ok = false;
    }
    if (!hasRevealedTo || !Array.isArray(s.revealedTo)) {
      fail(`${where} 的尸体掉落缺少合法 revealedTo 数组`);
      ok = false;
    } else {
      if (s.revealedTo.length > 6) {
        fail(`${where} 的 revealedTo 超过 6 个角色（${s.revealedTo.length}）`);
        ok = false;
      }
      const seen = new Set<string>();
      for (const id of s.revealedTo) {
        if (typeof id !== 'string' || !charIds.has(id)) {
          fail(`${where} 的 revealedTo 含非法角色引用（${String(id)}）`);
          ok = false;
        } else if (seen.has(id)) {
          fail(`${where} 的 revealedTo 存在重复角色（${id}）`);
          ok = false;
        }
        if (typeof id === 'string') seen.add(id);
      }
    }
  }

  if (typeof s.itemId !== 'string' || !tryGetItem(s.itemId)) {
    fail(`${where} 持有未知物品（${String(s.itemId)}）`);
    ok = false;
  } else {
    const def = tryGetItem(s.itemId)!;
    if (!isFiniteNumber(s.count) || !Number.isInteger(s.count) || (s.count as number) <= 0) {
      fail(`${where} 的物品数量必须为正整数（${String(s.count)}）`);
      ok = false;
    } else if ((s.count as number) > def.maxStack) {
      fail(`${where} 的物品数量超过 maxStack（${s.count} > ${def.maxStack}）`);
      ok = false;
    } else if (!def.stackable && s.count !== 1) {
      fail(`${where} 的不可堆叠物品数量必须为 1（实际 ${s.count}）`);
      ok = false;
    }

    if (def.category === 'weapon') {
      if (!isFiniteNumber(s.durability) || !Number.isInteger(s.durability)) {
        fail(`${where} 的武器缺少合法耐久（${String(s.durability)}）`);
        ok = false;
      } else {
        const maxDur = def.durability ?? 0;
        if ((s.durability as number) < 0 || (s.durability as number) > maxDur) {
          fail(`${where} 的武器耐久越界（${s.durability}，应在 [0, ${maxDur}]）`);
          ok = false;
        }
      }
    } else if ('durability' in s && s.durability !== undefined) {
      fail(`${where} 的非武器物品出现了耐久字段`);
      ok = false;
    }
  }
  return ok;
}

export function validateNumbers(ctx: ValidationContext): void {
  const { state, characters, zones, fail } = ctx;

  if (isFiniteNumber(state.time)) {
    if (!Number.isInteger(state.time) || (state.time as number) < 0) {
      fail(`state.time 必须是非负整数（实际 ${state.time}）`);
    }
  } else {
    fail('state.time 类型错误');
  }

  /* --- 基础计数器 --- */
  const intCounterFields = ['eventSeq', 'uidSeq', 'nextZoneEventTime'] as const;
  for (const f of intCounterFields) {
    const v = state[f];
    if (!isFiniteNumber(v) || !Number.isInteger(v) || (v as number) < 0) {
      fail(`state.${f} 必须是非负整数（实际 ${String(v)}）`);
    }
  }
  // nextWorldEventTime 同样要求非负整数（Phase 3A Step 6 世界事件调度）
  if (!isFiniteNumber(state.nextWorldEventTime) || !Number.isInteger(state.nextWorldEventTime)) {
    fail(`state.nextWorldEventTime 必须是有限整数（实际 ${String(state.nextWorldEventTime)}）`);
  } else if ((state.nextWorldEventTime as number) < 0) {
    fail(`state.nextWorldEventTime 不得为负（${state.nextWorldEventTime}）`);
  }
  // nextZoneEventTime 允许 Number.MAX_SAFE_INTEGER（禁区已封锁完的哨兵值），
  // 否则不得明显超过硬上限 + 间隔。
  if (isFiniteNumber(state.nextZoneEventTime)) {
    const nz = state.nextZoneEventTime as number;
    if (nz !== Number.MAX_SAFE_INTEGER && nz > GAME_CONFIG.hardTimeLimit + 10) {
      fail(`state.nextZoneEventTime 明显超过硬上限（${nz}）`);
    }
  }

  const nullableTimeFields = ['endedAtTime', 'finaleStartedAt'] as const;
  for (const f of nullableTimeFields) {
    const v = state[f];
    if (v === null || v === undefined) continue;
    if (!isFiniteNumber(v) || !Number.isInteger(v) || (v as number) < 0) {
      fail(`state.${f} 必须为 null 或非负整数（实际 ${String(v)}）`);
    } else if ((v as number) > (state.time as number)) {
      fail(`state.${f}（${v}）晚于 state.time（${state.time}）`);
    }
  }
  // 未结束的对局不得带有结束时间；已结束的对局必须带有结束时间
  if (state.status === 'playing') {
    if (state.endedAtTime !== null && state.endedAtTime !== undefined) {
      fail('进行中的对局不应带有 endedAtTime');
    }
  } else if (state.endedAtTime === null || state.endedAtTime === undefined) {
    fail('已结束的对局缺少 endedAtTime');
  }

  /* --- 角色 --- */
  for (const [id, raw] of Object.entries(characters)) {
    if (!isRecord(raw)) {
      fail(`角色 ${id} 不是对象`);
      continue;
    }
    const c = raw;
    const levelValid = isFiniteNumber(c.level) && Number.isInteger(c.level);
    if (!levelValid) {
      fail(`角色 ${id} 的 level 必须是整数（实际 ${String(c.level)}）`);
    } else if (
      (c.level as number) < 1 ||
      (c.level as number) > GAME_CONFIG.maxLevel
    ) {
      fail(`角色 ${id} 的 level 越界（${c.level}，应在 [1, ${GAME_CONFIG.maxLevel}]）`);
    }
    const expValid = isFiniteNumber(c.exp) && Number.isInteger(c.exp);
    if (!expValid) {
      fail(`角色 ${id} 的 exp 必须是整数（实际 ${String(c.exp)}）`);
    } else if ((c.exp as number) < 0) {
      fail(`角色 ${id} 的 exp 不得为负（${c.exp}）`);
    } else if (
      levelValid &&
      (c.level as number) >= 1 &&
      (c.level as number) <= GAME_CONFIG.maxLevel
    ) {
      const level = c.level as number;
      const threshold = GAME_CONFIG.levelExpThresholds[level - 1] ?? 0;
      if (level === GAME_CONFIG.maxLevel && c.exp !== 0) {
        fail(`角色 ${id} 已满级但 exp 不为 0（${c.exp}）`);
      } else if (level < GAME_CONFIG.maxLevel && (c.exp as number) >= threshold) {
        fail(`角色 ${id} 的 exp 已达到升级阈值却未升级（${c.exp} / ${threshold}）`);
      }
    }

    if (!isFiniteNumber(c.hp) || !isFiniteNumber(c.maxHp)) {
      fail(`角色 ${id} 的 hp/maxHp 类型错误`);
      continue;
    }
    if (c.maxHp <= 0) fail(`角色 ${id} 的 maxHp 非法（${c.maxHp}）`);
    if (c.hp < 0 || c.hp > c.maxHp) {
      fail(`角色 ${id} 的 hp 越界（${c.hp} / ${c.maxHp}）`);
    }
    if (!isFiniteNumber(c.stamina) || !isFiniteNumber(c.maxStamina)) {
      fail(`角色 ${id} 的体力字段类型错误`);
    } else if (c.stamina < 0 || c.stamina > c.maxStamina) {
      fail(`角色 ${id} 的体力越界（${c.stamina} / ${c.maxStamina}）`);
    }
    if (typeof c.alive !== 'boolean') {
      fail(`角色 ${id} 缺少 alive 标记`);
    } else if (c.alive) {
      if (c.hp === 0) fail(`角色 ${id} 处于「血量为 0 的活人」非法状态`);
      if (c.diedAtTime !== null && c.diedAtTime !== undefined) {
        fail(`角色 ${id} 存活却带有 diedAtTime`);
      }
    } else {
      if (c.hp !== 0) fail(`角色 ${id} 已死亡但 hp 不为 0（${c.hp}）`);
      if (c.diedAtTime === null || c.diedAtTime === undefined) {
        fail(`角色 ${id} 已死亡但缺少 diedAtTime`);
      } else if (!isFiniteNumber(c.diedAtTime) || (c.diedAtTime as number) < 0) {
        fail(`角色 ${id} 的 diedAtTime 非法（${String(c.diedAtTime)}）`);
      }
    }

    /* --- Phase 3 Step 1/3 新增字段：防御姿态 / 技能冷却 --- */
    if (typeof c.guarding !== 'boolean') {
      fail(`角色 ${id} 的 guarding 必须是布尔值`);
    }
    if (!isRecord(c.skillCooldowns)) {
      fail(`角色 ${id} 的 skillCooldowns 必须是对象`);
    } else {
      for (const [sid, left] of Object.entries(c.skillCooldowns as Record<string, unknown>)) {
        if (!(sid in SKILLS)) {
          fail(`角色 ${id} 的 skillCooldowns 含有未知技能（${sid}）`);
        }
        if (!isFiniteNumber(left) || !Number.isInteger(left) || (left as number) < 0) {
          fail(`角色 ${id} 的技能冷却 ${sid} 非法（${String(left)}）`);
        }
      }
    }

    /* --- Phase 3A Step 8：状态效果（含 EXPOSED 红线）--- */
    const STATUS_EFFECT_IDS = new Set([
      ADRENALINE_ID,
      FIELD_CRAFT_ID,
      MEDICAL_FOCUS_ID,
      EXPOSED_ID,
    ]);
    if (!Array.isArray(c.statusEffects)) {
      fail(`角色 ${id} 的 statusEffects 类型错误`);
    } else {
      const seenStatusIds = new Set<string>();
      for (const e of c.statusEffects.filter(isRecord)) {
        const eid = e.id;
        if (typeof eid !== 'string' || !STATUS_EFFECT_IDS.has(eid)) {
          fail(`角色 ${id} 的 statusEffects 含有未知状态（${String(eid)}）`);
          continue;
        }
        if (seenStatusIds.has(eid)) {
          // EXPOSED 明确不可叠加；其它签名技能状态也不应重复挂在同一个人身上
          fail(`角色 ${id} 的状态效果重复生效（${eid}）`);
        } else {
          seenStatusIds.add(eid);
        }
        if (!isFiniteNumber(e.remaining) || !Number.isInteger(e.remaining) || (e.remaining as number) <= 0) {
          fail(`角色 ${id} 的状态效果 ${eid} 的 remaining 非法（${String(e.remaining)}）`);
        }
        if (!isFiniteNumber(e.hpPerTick)) {
          fail(`角色 ${id} 的状态效果 ${eid} 的 hpPerTick 非法`);
        }
        if (eid === EXPOSED_ID) {
          // EXPOSED 红线：只作用在攻击类战斗伤害上，绝不通过 hpPerTick 直接扣血
          if ((e.hpPerTick as number) !== 0) {
            fail(`角色 ${id} 的 EXPOSED 不应带 hpPerTick 伤害（${String(e.hpPerTick)}）`);
          }
          if (!isFiniteNumber(e.damageTakenMult) || (e.damageTakenMult as number) !== GAME_CONFIG.exposedDamageMult) {
            fail(`角色 ${id} 的 EXPOSED damageTakenMult 应为 ${GAME_CONFIG.exposedDamageMult}`);
          }
          if ((e.remaining as number) > GAME_CONFIG.exposedMaxDuration) {
            fail(`角色 ${id} 的 EXPOSED remaining 超过兜底上限 ${GAME_CONFIG.exposedMaxDuration}`);
          }
        }
      }
    }

    /* --- 背包 / 装备格数 --- */
    if (Array.isArray(c.inventory) && c.inventory.length > INVENTORY_SLOTS) {
      fail(`角色 ${id} 的背包超过 ${INVENTORY_SLOTS} 格（${c.inventory.length} 格）`);
    }
    for (const field of ['inventory', 'equipment'] as const) {
      const list = c[field];
      if (!Array.isArray(list)) continue; // 引用层已报
      for (const s of list) validateStack(ctx, s, `角色 ${id} 的 ${field}`);
    }

    /* --- stats 非负 --- */
    if (isRecord(c.stats)) {
      const statFields = [
        'searches',
        'crafts',
        'moves',
        'itemsUsed',
        'attacks',
        'damageDealt',
        'damageTaken',
      ] as const;
      for (const f of statFields) {
        const v = c.stats[f];
        if (!isFiniteNumber(v) || (v as number) < 0) {
          fail(`角色 ${id} 的 stats.${f} 必须为非负数（实际 ${String(v)}）`);
        }
      }
    } else {
      fail(`角色 ${id} 缺少 stats`);
    }
    if (!isFiniteNumber(c.kills) || (c.kills as number) < 0) {
      fail(`角色 ${id} 的 kills 必须为非负数（实际 ${String(c.kills)}）`);
    }
  }

  /* --- 区域库存 --- */
  for (const [zoneId, raw] of Object.entries(zones)) {
    if (!isRecord(raw)) continue; // 结构层已报
    const z = raw;

    let lootSum = 0;
    let lootValid = true;
    if (Array.isArray(z.loot)) {
      for (const e of z.loot as unknown[]) {
        if (!isRecord(e)) {
          fail(`区域 ${zoneId} 的物资清单中存在损坏条目`);
          lootValid = false;
          continue;
        }
        if (typeof e.itemId !== 'string' || !tryGetItem(e.itemId)) {
          fail(`区域 ${zoneId} 的物资引用了未知物品（${String(e.itemId)}）`);
          lootValid = false;
        }
        if (!isFiniteNumber(e.count) || !Number.isInteger(e.count) || (e.count as number) <= 0) {
          fail(`区域 ${zoneId} 的物资数量必须为正整数（${String(e.count)}）`);
          lootValid = false;
        }
        if (e.rarity !== 'normal' && e.rarity !== 'rare') {
          fail(`区域 ${zoneId} 的物资稀有度非法（${String(e.rarity)}）`);
          lootValid = false;
        }
        if (isFiniteNumber(e.count)) lootSum += e.count as number;
      }
    }

    if (isFiniteNumber(z.remainingLootCount)) {
      if (lootValid && (z.remainingLootCount as number) !== lootSum) {
        fail(
          `区域 ${zoneId} 的 remainingLootCount（${z.remainingLootCount}）与实际物资清单之和（${lootSum}）不符`,
        );
      }
      if ((z.remainingLootCount as number) < 0) {
        fail(`区域 ${zoneId} 的 remainingLootCount 为负数`);
      }
    } else {
      fail(`区域 ${zoneId} 的 remainingLootCount 类型错误`);
    }

    if (isFiniteNumber(z.initialLootCount)) {
      if ((z.initialLootCount as number) < 0) {
        fail(`区域 ${zoneId} 的 initialLootCount 为负数`);
      } else if (
        isFiniteNumber(z.remainingLootCount) &&
        (z.remainingLootCount as number) > (z.initialLootCount as number)
      ) {
        fail(
          `区域 ${zoneId} 的 remainingLootCount（${z.remainingLootCount}）大于 initialLootCount（${z.initialLootCount}）`,
        );
      }
    } else {
      fail(`区域 ${zoneId} 的 initialLootCount 类型错误`);
    }

    /* supply 必须是派生比例（允许浮点容差 1e-6） */
    if (isFiniteNumber(z.supply) && isFiniteNumber(z.initialLootCount)) {
      const expected =
        (z.initialLootCount as number) === 0
          ? 0
          : (z.remainingLootCount as number) / (z.initialLootCount as number);
      if (Math.abs((z.supply as number) - expected) > 0.000001) {
        fail(
          `区域 ${zoneId} 的 supply（${z.supply}）与派生比例（${expected.toFixed(6)}）不符`,
        );
      }
    } else if (!isFiniteNumber(z.supply)) {
      fail(`区域 ${zoneId} 的 supply 类型错误`);
    }
  }
}
