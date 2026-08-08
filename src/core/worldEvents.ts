/**
 * 世界事件系统（Phase 3A Step 6）—— 取代 Phase 3 的 `dynamicEvents.ts`。
 *
 * ## 为什么要推翻 storm / supply_drop / ambush
 *
 * 旧的三种动态事件各自踩了一条 Phase 3A 红线：
 *
 * | 旧事件 | 违反的红线 | 具体表现 |
 * | --- | --- | --- |
 * | `supply_drop` | **不得修改隐藏库存** | 直接 `addLootItem()` 往区域库存塞物资，玩家不必付出搜索成本 |
 * | `ambush` | **不得瞬移角色** | 直接改写 `attacker.currentZoneId`，凭空把 NPC 挪到玩家脚下 |
 * | `storm` | **不得绕过 applyDamage** | 走 `hpPerTick` 状态确实过了伤害管线，但它是「事件直接扣血」的坏范例 |
 *
 * ## Phase 3A 的替代设计：环境修正型事件
 *
 * 6 种世界事件**一律不直接改变任何角色/区域的实体状态**，只提供一组
 * {@link WorldEventModifiers} 修正值，由各系统在自己的判定点主动查询。
 * 这带来三个结构性好处：
 *
 * 1. **红线不可能被违反**：本文件不 import `zoneLoot` / `vitals` / `inventory`，
 *    没有任何写实体状态的能力，编译期就杜绝了塞物资 / 瞬移 / 直接扣血；
 * 2. **确定性**：修正值是 state 的纯函数，存档只需序列化事件列表即可完整复现；
 * 3. **UI 与 core 同源**：UI 想显示「雨天命中 -10%」时调用的是同一个
 *    {@link worldModifiersAt}，不存在 UI 自己算一套的风险
 *    （对应不变量「UI 命中率 === core 实际概率」）。
 *
 * ## 事件一览
 *
 * | id | 范围 | 效果 |
 * | --- | --- | --- |
 * | `blackout` 大停电 | 区域 | 命中 ×0.85、搜索 ×0.7、屏蔽该区域情报 |
 * | `rain` 连绵阴雨 | 全局 | 命中 ×0.9、逃跑 +0.1 |
 * | `emergency_broadcast` 紧急广播 | 全局 | 公开全部存活者所在区域 |
 * | `medical_alert` 医疗管制 | 全局 | 治疗品效果 ×0.75、医疗物资搜索 +0.35 |
 * | `research_anomaly` 研究异常 | 区域 | 材料搜索 +0.6、装备耐久损耗 +1 |
 * | `citywide_unrest` 全城骚动 | 全局 | NPC 攻击倾向 +0.25、遭遇权重 ×1.3 |
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { getZoneDef } from '../data/zones';
import { pushEvent } from './events';
import { aliveCharacters } from './gameState';
import type {
  GameState,
  WorldEventId,
  WorldEventRecord,
  WorldEventScope,
  WorldEventState,
} from './types';
import type { SeededRandom } from './random';

/* ------------------------------------------------------------------ */
/* 定义表                                                              */
/* ------------------------------------------------------------------ */

export interface WorldEventDef {
  id: WorldEventId;
  label: string;
  scope: WorldEventScope;
  duration: number;
  weight: number;
  /** 展示用简述（UI 横幅 / 日志） */
  description: string;
}

/** 6 种世界事件的静态定义（顺序即 UI 图例顺序） */
export const WORLD_EVENT_DEFS: Record<WorldEventId, WorldEventDef> = {
  blackout: {
    id: 'blackout',
    label: '大停电',
    scope: 'zone',
    duration: GAME_CONFIG.blackoutDuration,
    weight: GAME_CONFIG.worldEventWeights.blackout,
    description: `该区域陷入黑暗：命中率 ×${GAME_CONFIG.blackoutHitMult}、搜索效率 ×${GAME_CONFIG.blackoutSearchMult}，且无法获知区域内情报。`,
  },
  rain: {
    id: 'rain',
    label: '连绵阴雨',
    scope: 'global',
    duration: GAME_CONFIG.rainDuration,
    weight: GAME_CONFIG.worldEventWeights.rain,
    description: `全城降雨：命中率 ×${GAME_CONFIG.rainHitMult}，逃跑成功率 +${Math.round(
      GAME_CONFIG.rainFleeBonus * 100,
    )}%。`,
  },
  emergency_broadcast: {
    id: 'emergency_broadcast',
    label: '紧急广播',
    scope: 'global',
    duration: GAME_CONFIG.broadcastDuration,
    weight: GAME_CONFIG.worldEventWeights.emergency_broadcast,
    description: '应急频道公开了所有幸存者的所在区域 —— 你看得见别人，别人也看得见你。',
  },
  medical_alert: {
    id: 'medical_alert',
    label: '医疗管制',
    scope: 'global',
    duration: GAME_CONFIG.medicalAlertDuration,
    weight: GAME_CONFIG.worldEventWeights.medical_alert,
    description: `药品被稀释调配：治疗类物品效果 ×${GAME_CONFIG.medicalAlertHealMult}，但医疗物资更容易被翻出来（搜索 +${Math.round(
      GAME_CONFIG.medicalAlertMedicalFindBonus * 100,
    )}%）。`,
  },
  research_anomaly: {
    id: 'research_anomaly',
    label: '研究异常',
    scope: 'zone',
    duration: GAME_CONFIG.researchAnomalyDuration,
    weight: GAME_CONFIG.worldEventWeights.research_anomaly,
    description: `该区域实验设施失控：材料类物品更易被搜到（+${Math.round(
      GAME_CONFIG.researchAnomalyMaterialFindBonus * 100,
    )}%），但装备损耗加剧（耐久 -${GAME_CONFIG.researchAnomalyDurabilityLoss}）。`,
  },
  citywide_unrest: {
    id: 'citywide_unrest',
    label: '全城骚动',
    scope: 'global',
    duration: GAME_CONFIG.unrestDuration,
    weight: GAME_CONFIG.worldEventWeights.citywide_unrest,
    description: `幸存者陷入躁动：对手进攻倾向 +${Math.round(
      GAME_CONFIG.unrestAggressionBonus * 100,
    )}%，搜索时遭遇敌人的概率 ×${GAME_CONFIG.unrestEncounterMult}。`,
  },
};

/** 全部世界事件 id（稳定顺序，供统计与 UI 遍历） */
export const WORLD_EVENT_IDS: WorldEventId[] = [
  'blackout',
  'rain',
  'emergency_broadcast',
  'medical_alert',
  'research_anomaly',
  'citywide_unrest',
];

/* ------------------------------------------------------------------ */
/* 修正值                                                              */
/* ------------------------------------------------------------------ */

/**
 * 世界事件对各系统判定的修正值汇总。
 *
 * 所有字段都是「中性值 = 无事件」：乘数为 1、加成为 0、布尔为 false。
 * 各系统只需无条件乘/加，无需判断事件是否存在。
 */
export interface WorldEventModifiers {
  /** 命中率乘数（combat.hitChanceIn） */
  hitMultiplier: number;
  /** 搜索「找到物品」权重乘数（search.computeSearchWeights） */
  searchFindMultiplier: number;
  /** 搜索「遭遇敌人」权重乘数（search.computeSearchWeights） */
  encounterMultiplier: number;
  /** 医疗类物品搜索权重加成（search.computeSearchWeights） */
  medicalFindBonus: number;
  /** 材料类物品搜索权重加成（search.computeSearchWeights） */
  materialFindBonus: number;
  /** 治疗类消耗品效果乘数（consumables.healMultiplierOf） */
  healMultiplier: number;
  /** 逃跑成功率加成（combat.fleeChanceIn） */
  fleeBonus: number;
  /** NPC 进攻倾向加成（npcDecide） */
  npcAggressionBonus: number;
  /** 装备额外耐久损耗（itemIntegrity 调用点） */
  durabilityLossBonus: number;
  /** 情报是否被屏蔽（info.recordIntel / 侦察技能） */
  intelBlocked: boolean;
  /** 是否公开全部存活者位置（info.refreshPlayerSight） */
  revealAll: boolean;
}

/** 无任何世界事件时的中性修正值 */
export const NEUTRAL_WORLD_MODIFIERS: WorldEventModifiers = {
  hitMultiplier: 1,
  searchFindMultiplier: 1,
  encounterMultiplier: 1,
  medicalFindBonus: 0,
  materialFindBonus: 0,
  healMultiplier: 1,
  fleeBonus: 0,
  npcAggressionBonus: 0,
  durabilityLossBonus: 0,
  intelBlocked: false,
  revealAll: false,
};

/**
 * 计算某区域当前受到的世界事件修正。
 *
 * **纯函数，无副作用** —— 可被 core 与 UI 任意频次调用。
 * 全局事件对所有区域生效；区域事件只对 `zoneId` 匹配的区域生效。
 *
 * @param zoneId 目标区域；传 null 时只统计全局事件
 */
export function worldModifiersAt(
  state: GameState,
  zoneId: string | null,
): WorldEventModifiers {
  const active = activeWorldEvents(state);
  if (active.length === 0) return { ...NEUTRAL_WORLD_MODIFIERS };

  const m: WorldEventModifiers = { ...NEUTRAL_WORLD_MODIFIERS };
  for (const ev of active) {
    // 区域事件只影响它自己的区域
    if (ev.scope === 'zone' && ev.zoneId !== zoneId) continue;
    applyModifier(m, ev.eventId);
  }
  return m;
}

/** 把单个事件的修正叠加到累计对象上（乘数相乘、加成相加、布尔取或） */
function applyModifier(m: WorldEventModifiers, id: WorldEventId): void {
  switch (id) {
    case 'blackout':
      m.hitMultiplier *= GAME_CONFIG.blackoutHitMult;
      m.searchFindMultiplier *= GAME_CONFIG.blackoutSearchMult;
      m.intelBlocked = true;
      break;
    case 'rain':
      m.hitMultiplier *= GAME_CONFIG.rainHitMult;
      m.fleeBonus += GAME_CONFIG.rainFleeBonus;
      break;
    case 'emergency_broadcast':
      m.revealAll = true;
      break;
    case 'medical_alert':
      m.healMultiplier *= GAME_CONFIG.medicalAlertHealMult;
      m.medicalFindBonus += GAME_CONFIG.medicalAlertMedicalFindBonus;
      break;
    case 'research_anomaly':
      m.materialFindBonus += GAME_CONFIG.researchAnomalyMaterialFindBonus;
      m.durabilityLossBonus += GAME_CONFIG.researchAnomalyDurabilityLoss;
      break;
    case 'citywide_unrest':
      m.npcAggressionBonus += GAME_CONFIG.unrestAggressionBonus;
      m.encounterMultiplier *= GAME_CONFIG.unrestEncounterMult;
      break;
  }
}

/* ------------------------------------------------------------------ */
/* 状态访问                                                            */
/* ------------------------------------------------------------------ */

/** 防御性兜底：确保 state 上的世界事件字段结构完整 */
function ensureWorldEventFields(state: GameState): void {
  if (!Array.isArray(state.activeWorldEvents)) state.activeWorldEvents = [];
  if (!Array.isArray(state.worldEventHistory)) state.worldEventHistory = [];
  if (typeof state.nextWorldEventTime !== 'number') {
    state.nextWorldEventTime = GAME_CONFIG.firstWorldEventTime;
  }
}

/** 当前生效中的世界事件（只读视图，UI 横幅直接用） */
export function activeWorldEvents(state: GameState): WorldEventState[] {
  ensureWorldEventFields(state);
  return state.activeWorldEvents;
}

/** 某种世界事件当前是否生效（可选限定区域） */
export function hasWorldEvent(
  state: GameState,
  eventId: WorldEventId,
  zoneId?: string,
): boolean {
  return activeWorldEvents(state).some((e) => {
    if (e.eventId !== eventId) return false;
    if (e.scope === 'global') return true;
    return zoneId === undefined || e.zoneId === zoneId;
  });
}

/* ------------------------------------------------------------------ */
/* 调度                                                                */
/* ------------------------------------------------------------------ */

/**
 * 推进 1 个时间单位时调用：先衰减既有事件，再按调度触发新事件。
 *
 * 与旧 `runDynamicEvents` 的关键差异：**不再调用 `refreshZoneOccupants`**，
 * 因为世界事件从不移动角色，区域占用名单不可能因它失配。
 */
export function runWorldEvents(state: GameState, rng: SeededRandom): void {
  ensureWorldEventFields(state);
  if (!GAME_CONFIG.worldEventsEnabled) return;

  expireWorldEvents(state);

  if (state.time >= state.nextWorldEventTime) {
    tryTriggerWorldEvent(state, rng);
    state.nextWorldEventTime =
      state.time +
      rng.int(GAME_CONFIG.worldEventIntervalMin, GAME_CONFIG.worldEventIntervalMax);
  }
}

/** 衰减 remaining，把归零的事件移入 history 并广播结束 */
function expireWorldEvents(state: GameState): void {
  const survivors: WorldEventState[] = [];
  for (const ev of state.activeWorldEvents) {
    const next: WorldEventState = { ...ev, remaining: ev.remaining - 1 };
    if (next.remaining > 0) {
      survivors.push(next);
      continue;
    }
    const record: WorldEventRecord = {
      id: next.id,
      eventId: next.eventId,
      zoneId: next.zoneId,
      startedAtTime: next.startedAtTime,
      endedAtTime: state.time,
    };
    state.worldEventHistory.push(record);
    pushEvent(state, {
      type: 'WORLD_EVENT_ENDED',
      actorId: null,
      zoneId: next.zoneId ?? undefined,
      message: `${next.label}结束了${next.zoneId ? `（${getZoneDef(next.zoneId).name}）` : ''}。`,
      metadata: {
        worldEventId: next.eventId,
        zoneId: next.zoneId,
        duration: state.time - next.startedAtTime,
      },
    });
  }
  state.activeWorldEvents = survivors;
}

/** 加权随机选一种「当前未生效」的事件；全都在生效中时返回 null */
function pickWorldEventId(state: GameState, rng: SeededRandom): WorldEventId | null {
  // 同一种事件不叠加：已在生效中的候选直接排除，
  // 这样修正值最多只由 maxConcurrentWorldEvents 种不同事件相乘。
  const running = new Set(state.activeWorldEvents.map((e) => e.eventId));
  const pool = WORLD_EVENT_IDS.filter((id) => !running.has(id));
  if (pool.length === 0) return null;

  const total = pool.reduce((s, id) => s + WORLD_EVENT_DEFS[id].weight, 0);
  if (total <= 0) return null;

  let roll = rng.next() * total;
  for (const id of pool) {
    roll -= WORLD_EVENT_DEFS[id].weight;
    if (roll < 0) return id;
  }
  return pool[pool.length - 1] ?? null;
}

/** 触发一次世界事件（受并发上限与去重限制，可能什么都不做） */
function tryTriggerWorldEvent(state: GameState, rng: SeededRandom): void {
  if (state.activeWorldEvents.length >= GAME_CONFIG.maxConcurrentWorldEvents) return;

  const eventId = pickWorldEventId(state, rng);
  if (!eventId) return;

  const def = WORLD_EVENT_DEFS[eventId];
  const zoneId = def.scope === 'zone' ? pickZoneId(state, rng) : null;
  // 区域事件找不到合法区域时放弃本次触发（不消耗调度以外的任何状态）
  if (def.scope === 'zone' && !zoneId) return;

  const instance: WorldEventState = {
    id: `we${state.eventSeq}`,
    eventId,
    scope: def.scope,
    zoneId,
    startedAtTime: state.time,
    remaining: def.duration,
    label: def.label,
    description: def.description,
  };
  state.activeWorldEvents.push(instance);
  state.eventSeq += 1;

  pushEvent(state, {
    type: 'WORLD_EVENT',
    actorId: null,
    zoneId: zoneId ?? undefined,
    message: buildAnnouncement(state, def, zoneId),
    metadata: {
      worldEventId: eventId,
      scope: def.scope,
      zoneId,
      duration: def.duration,
    },
  });
}

/** 区域事件的落点：只在**未被禁区吞掉**的区域中随机 */
function pickZoneId(state: GameState, rng: SeededRandom): string | null {
  const candidates = Object.values(state.zones)
    .filter((z) => z.status !== 'restricted')
    .map((z) => z.id);
  if (candidates.length === 0) return null;
  return rng.pick(candidates);
}

function buildAnnouncement(
  state: GameState,
  def: WorldEventDef,
  zoneId: string | null,
): string {
  const where = zoneId ? `「${getZoneDef(zoneId).name}」` : '全城';
  const suffix =
    def.id === 'emergency_broadcast'
      ? `（当前存活 ${aliveCharacters(state).length} 人）`
      : '';
  return `【${def.label}】${where}：${def.description}持续 ${def.duration} 个时间单位。${suffix}`;
}
