/**
 * 区域内动态事件框架（Phase 3 Step 4）。
 *
 * 事件类型：
 * - `storm`   风暴：在随机区域持续若干回合，对区域内所有角色每回合造成伤害。
 * - `supply_drop` 空投：向某区域投放物资（加入该区域有限物资库存）。
 * - `ambush`  伏击：将一名存活 NPC 瞬移到玩家所在区域，制造遭遇压力。
 *
 * 设计红线（与 Phase 2A / Phase 3 一致）：
 * - 完全确定性：所有随机来源都来自种子 RNG，同种子同流程结果完全一致；
 * - 不引入新规则：风暴走既有 `StatusEffect` + `applyHpChange` 死亡结算，
 *   伏击只复用既有"NPC 进入玩家区域"机制，空投复用既有 `zoneLoot` 库存；
 * - 玩家与 NPC 同等承受动态事件（风暴不区分对象）。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { getItem } from '../data/items';
import { pushEvent } from './events';
import { applyHpChange } from './vitals';
import { addLootItem } from './zoneLoot';
import { aliveCharacters, refreshZoneOccupants } from './gameState';
import type {
  ActiveEvent,
  Combatant,
  DynamicEventType,
  GameState,
  StatusEffect,
} from './types';
import type { SeededRandom } from './random';

/** 各动态事件的静态展示信息 */
export const DYNAMIC_EVENT_DEFS: Record<
  DynamicEventType,
  { label: string; description: string }
> = {
  storm: {
    label: '风暴',
    description: `区域内持续 ${GAME_CONFIG.stormDuration} 回合，每回合造成 ${GAME_CONFIG.stormDamagePerTick} 点伤害。`,
  },
  supply_drop: {
    label: '空投',
    description: `向某区域投放 ${GAME_CONFIG.supplyDropCount} 件物资。`,
  },
  ambush: {
    label: '伏击',
    description: `一名对手突入你的区域，造成 ${GAME_CONFIG.ambushDamage} 点突袭伤害。`,
  },
};

/** 防御性兜底：确保任意来源的 state（含旧存档）都有 activeEvents 字段 */
function ensureActiveEvents(state: GameState): void {
  if (!Array.isArray(state.activeEvents)) state.activeEvents = [];
  if (typeof state.nextDynamicEventTime !== 'number') {
    state.nextDynamicEventTime = GAME_CONFIG.firstDynamicEventTime;
  }
}

/** 推进 1 个时间单位时调用：先衰减既有事件，再按调度概率触发新事件 */
export function runDynamicEvents(state: GameState, rng: SeededRandom): void {
  ensureActiveEvents(state);
  if (!GAME_CONFIG.dynamicEventsEnabled) return;

  // 1. 衰减既有事件
  state.activeEvents = state.activeEvents
    .map((e) => ({ ...e, remaining: e.remaining - 1 }))
    .filter((e) => e.remaining > 0);

  // 2. 按调度触发新事件
  if (state.time >= state.nextDynamicEventTime) {
    triggerDynamicEvent(state, rng);
    // 伏击会移动 NPC，立即刷新区域存活名单，保证状态自洽（含存档校验不变量）
    refreshZoneOccupants(state);
    state.nextDynamicEventTime =
      state.time +
      rng.int(GAME_CONFIG.dynamicEventIntervalMin, GAME_CONFIG.dynamicEventIntervalMax);
  }
}

/** 加权随机选取一种事件类型 */
function pickEventType(rng: SeededRandom): DynamicEventType {
  const weighted: Array<[DynamicEventType, number]> = [
    ['storm', GAME_CONFIG.stormWeight],
    ['supply_drop', GAME_CONFIG.supplyDropWeight],
    ['ambush', GAME_CONFIG.ambushWeight],
  ];
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [type, w] of weighted) {
    roll -= w;
    if (roll < 0) return type;
  }
  return 'storm';
}

function triggerDynamicEvent(state: GameState, rng: SeededRandom): void {
  const type = pickEventType(rng);
  const zoneIds = Object.keys(state.zones);
  const zoneId = rng.pick(zoneIds) ?? zoneIds[0];
  const def = DYNAMIC_EVENT_DEFS[type];
  const event: ActiveEvent = {
    id: `de${state.eventSeq}`,
    type,
    zoneId,
    startedAtTime: state.time,
    remaining: type === 'storm' ? GAME_CONFIG.stormDuration : 1,
    label: def.label,
    description: def.description,
  };
  state.activeEvents.push(event);
  state.eventSeq += 1;

  switch (type) {
    case 'storm':
      applyStorm(state, zoneId, rng);
      break;
    case 'supply_drop':
      applySupplyDrop(state, zoneId, rng);
      break;
    case 'ambush':
      applyAmbush(state, rng);
      break;
  }
}

/** 风暴：对区域内所有存活角色叠加持续伤害状态 */
function applyStorm(state: GameState, zoneId: string, _rng: SeededRandom): void {
  const zone = state.zones[zoneId];
  if (!zone) return;
  const effect: StatusEffect = {
    id: 'storm',
    remaining: GAME_CONFIG.stormDuration,
    hpPerTick: -GAME_CONFIG.stormDamagePerTick,
    label: '风暴',
  };
  let hit = 0;
  for (const c of aliveCharacters(state)) {
    if (c.currentZoneId !== zoneId) continue;
    c.statusEffects.push({ ...effect });
    hit += 1;
  }
  pushEvent(state, {
    type: 'DYNAMIC_EVENT',
    actorId: null,
    zoneId,
    message: `风暴来袭「${zone.id}」：持续 ${GAME_CONFIG.stormDuration} 回合，区域内 ${hit} 名角色将每回合受到 ${GAME_CONFIG.stormDamagePerTick} 点伤害。`,
    metadata: { eventType: 'storm', zoneId, affected: hit },
  });
}

/** 空投：向某区域有限物资库存补充若干件 */
function applySupplyDrop(state: GameState, zoneId: string, rng: SeededRandom): void {
  const zone = state.zones[zoneId];
  if (!zone) return;
  const pool = GAME_CONFIG.supplyDropItems;
  let added = 0;
  for (let i = 0; i < GAME_CONFIG.supplyDropCount; i++) {
    const itemId = rng.pick(pool);
    if (!itemId) continue;
    addLootItem(zone, itemId, 1);
    added += 1;
  }
  pushEvent(state, {
    type: 'DYNAMIC_EVENT',
    actorId: null,
    zoneId,
    message: `空投抵达「${zone.id}」：投放了 ${added} 件物资（${pool
      .map((id) => getItem(id).name)
      .join('、')}）。`,
    metadata: { eventType: 'supply_drop', zoneId, added },
  });
}

/** 伏击：将一名存活 NPC 瞬移到玩家当前区域，并造成一次突袭伤害 */
function applyAmbush(state: GameState, rng: SeededRandom): void {
  const player = state.characters[state.playerId];
  if (!player.alive) return;
  const candidates = aliveCharacters(state).filter(
    (c) => !c.isPlayer && c.currentZoneId !== player.currentZoneId,
  );
  const attacker: Combatant | null = rng.pick(candidates);
  if (!attacker) return;
  attacker.currentZoneId = player.currentZoneId;
  applyHpChange(state, player, -GAME_CONFIG.ambushDamage, attacker.id, '伏击');
  pushEvent(state, {
    type: 'DYNAMIC_EVENT',
    actorId: attacker.id,
    targetId: player.id,
    zoneId: player.currentZoneId,
    message: `伏击！${attacker.name} 突入你的区域，造成 ${GAME_CONFIG.ambushDamage} 点突袭伤害。`,
    metadata: { eventType: 'ambush', zoneId: player.currentZoneId, damage: GAME_CONFIG.ambushDamage },
  });
}

/** 仅供 UI：取当前最值得展示的动态事件（风暴优先，其次最新） */
export function activeBannerEvents(state: GameState): ActiveEvent[] {
  ensureActiveEvents(state);
  return state.activeEvents;
}

/** 当前是否有任意持续型（风暴）事件生效 */
export function hasActiveStorm(state: GameState): boolean {
  ensureActiveEvents(state);
  return state.activeEvents.some((e) => e.type === 'storm' && e.remaining > 0);
}
