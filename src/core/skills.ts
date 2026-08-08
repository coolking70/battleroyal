/**
 * 四角色签名技能（Phase 3A Step 4 重定义）。
 *
 * ## 为什么要重写
 *
 * Phase 3 的四个技能是「回 30% 血」「命中 ×1.12 伤害 ×1.6」「闪避 ×0.5」
 * 「回满体力 + 修耐久 + 回 20% 血」—— 全是纯战斗数值增益。
 * 后果是四个角色的差异退化成**数字大小**：谁的技能数值高谁就强，
 * 「侦察员擅长信息、工程师擅长合成」这些设定在实际操作里一点都摸不到。
 *
 * Phase 3A 把每个技能钉死在该角色的战略身份上：
 *
 * | 角色 | 技能 | 战略维度 | 核心效果 |
 * | --- | --- | --- | --- |
 * | 侦察员 scout | `scout_recon` 战场侦察 | **信息** | 一次性看穿当前 + 相邻区域的人 |
 * | 斗士 fighter | `adrenaline` 肾上腺素 | **战斗节奏** | 接下来 3 次攻击省体力，代价是自己更脆 |
 * | 工程师 engineer | `field_craft` 野外工造 | **合成** | 接下来 2 次合成不要体力 |
 * | 医学生 medic | `emergency_treatment` 紧急处置 | **消耗品经济** | 止血，并让治疗品增效 25% |
 *
 * 注意 `adrenaline` 是**唯一带负面代价**的技能。这是刻意的：斗士本来就是
 * 「主动开战换收益」的角色，给他一个纯增益反而会让 heavy + 技能变成无脑最优。
 *
 * ## 不变的红线
 * - 玩家与 NPC 走同一个 `useSkill`，规则只写一遍；
 * - 技能有体力成本与冷却，不能连放；
 * - 本模块不消耗 RNG，同种子下结果完全确定。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { getZoneDef } from '../data/zones';
import { canPayStamina, spendStamina, type CostCheck } from './actionCosts';
import { pushEvent } from './events';
import { recordIntel } from './info';
import { ADRENALINE_ID, FIELD_CRAFT_ID, MEDICAL_FOCUS_ID } from './statusIds';
import { applyHealing } from './vitals';
import type { Combatant, GameState, StatusEffect } from './types';

export type SkillId =
  | 'scout_recon'
  | 'adrenaline'
  | 'field_craft'
  | 'emergency_treatment';

// 状态 id 与只读查询集中在 statusIds.ts（避免与 actionCosts / combat 形成循环依赖），
// 这里原样再导出，调用方 import 哪一边都行。
export {
  ADRENALINE_ID,
  FIELD_CRAFT_ID,
  MEDICAL_FOCUS_ID,
  adrenalineStaminaDelta,
  consumableHealMultiplier,
  hasFieldCraftCharge,
  selfDamageTakenMultiplier,
} from './statusIds';

export interface SkillDef {
  id: SkillId;
  name: string;
  /** 拥有该技能的角色 id */
  characterId: string;
  /** 体力成本 */
  staminaCost: number;
  /** 冷却时间单位 */
  cooldown: number;
  /** 战略维度标签（UI 与文档用） */
  dimension: '信息' | '战斗节奏' | '合成' | '消耗品经济';
  description: string;
}

/** 角色 -> 专属技能（每角色一枚签名技能） */
export const SKILLS: Record<SkillId, SkillDef> = {
  scout_recon: {
    id: 'scout_recon',
    name: '战场侦察',
    characterId: 'scout',
    staminaCost: GAME_CONFIG.skillReconStaminaCost,
    cooldown: GAME_CONFIG.skillCooldown,
    dimension: '信息',
    description: '立刻查明当前区域与所有相邻区域里还活着的对手位置。',
  },
  adrenaline: {
    id: 'adrenaline',
    name: '肾上腺素',
    characterId: 'fighter',
    staminaCost: GAME_CONFIG.skillAdrenalineStaminaCost,
    cooldown: GAME_CONFIG.skillCooldown,
    dimension: '战斗节奏',
    description: `接下来 ${GAME_CONFIG.skillAdrenalineAttacks} 次攻击体力 -1；代价是这期间自己受到的伤害 +${Math.round(
      (GAME_CONFIG.skillAdrenalineSelfDamageMult - 1) * 100,
    )}%。`,
  },
  field_craft: {
    id: 'field_craft',
    name: '野外工造',
    characterId: 'engineer',
    staminaCost: GAME_CONFIG.skillFieldCraftStaminaCost,
    cooldown: GAME_CONFIG.skillCooldown,
    dimension: '合成',
    description: `接下来 ${GAME_CONFIG.skillFieldCraftCharges} 次合成不消耗体力。`,
  },
  emergency_treatment: {
    id: 'emergency_treatment',
    name: '紧急处置',
    characterId: 'medic',
    staminaCost: GAME_CONFIG.skillTreatmentStaminaCost,
    cooldown: GAME_CONFIG.skillCooldown,
    dimension: '消耗品经济',
    description: `立即止血，并在 ${GAME_CONFIG.skillTreatmentDuration} 个时间单位内让治疗类消耗品效果 +${Math.round(
      (GAME_CONFIG.skillTreatmentConsumableMult - 1) * 100,
    )}%。`,
  },
};

/** 返回某角色拥有的技能 id（没有则返回 null） */
export function getCharacterSkill(characterId: string): SkillId | null {
  for (const def of Object.values(SKILLS)) {
    if (def.characterId === characterId) return def.id;
  }
  return null;
}

export function getSkill(skillId: SkillId): SkillDef {
  return SKILLS[skillId];
}

/** 冷却是否为 0（或从未使用过） */
export function isSkillReady(actor: Combatant, skillId: SkillId): boolean {
  const cd = actor.skillCooldowns[skillId];
  return cd === undefined || cd <= 0;
}

/** 前置校验：存活 + 拥有该技能 + 冷却就绪 + 体力足够 */
export function canUseSkill(actor: Combatant, skillId: SkillId): CostCheck {
  const def = SKILLS[skillId];
  const payStamina = canPayStamina; // 捕获引用，规避循环依赖下的绑定解析异常
  if (!actor.alive) {
    return { ok: false, reason: '已经死亡的角色无法行动。', cost: def.staminaCost };
  }
  if (getCharacterSkill(actor.characterId) !== skillId) {
    return { ok: false, reason: '当前角色没有这个技能。', cost: def.staminaCost };
  }
  if (!isSkillReady(actor, skillId)) {
    return {
      ok: false,
      reason: `技能冷却中（剩余 ${actor.skillCooldowns[skillId]} 回合）。`,
      cost: def.staminaCost,
    };
  }
  const pay = payStamina(actor, def.staminaCost);
  if (!pay.ok) {
    return {
      ok: false,
      reason: `体力不足：技能需要 ${def.staminaCost} 点，当前只有 ${Math.floor(actor.stamina)} 点。`,
      cost: def.staminaCost,
    };
  }
  return { ok: true, reason: null, cost: def.staminaCost };
}

/** 给角色叠加一个状态效果（同名效果刷新持续时间，不叠加多层） */
function addStatusEffect(actor: Combatant, effect: StatusEffect): void {
  actor.statusEffects = actor.statusEffects.filter((e) => e.id !== effect.id);
  actor.statusEffects.push(effect);
}

/* ------------------------------------------------------------------ */
/* 状态消费：会写状态、发事件，因此留在本文件（statusIds 只读）           */
/* ------------------------------------------------------------------ */

/**
 * 肾上腺素：消费一次攻击次数。攻击结算时调用，次数归零即移除状态。
 * @returns 是否确实消费了一次（用于模拟统计）
 */
export function consumeAdrenalineCharge(state: GameState, actor: Combatant): boolean {
  const e = actor.statusEffects.find((s) => s.id === ADRENALINE_ID);
  if (!e || typeof e.remainingAttacks !== 'number') return false;
  e.remainingAttacks -= 1;
  if (e.remainingAttacks > 0) return true;

  actor.statusEffects = actor.statusEffects.filter((s) => s.id !== ADRENALINE_ID);
  pushEvent(state, {
    type: 'STATUS_EXPIRED',
    actorId: actor.id,
    zoneId: actor.currentZoneId,
    importance: 'minor',
    message: `${actor.isPlayer ? '你' : actor.name}的肾上腺素退去了。`,
    metadata: { statusId: ADRENALINE_ID, reason: 'charges_used' },
  });
  return true;
}

/**
 * 野外工造：消费一次合成次数。**只在合成真的成功时调用**，
 * 失败的合成不该白扣充能。
 */
export function consumeFieldCraftCharge(state: GameState, actor: Combatant): boolean {
  const e = actor.statusEffects.find((s) => s.id === FIELD_CRAFT_ID);
  if (!e || typeof e.remainingCrafts !== 'number' || e.remainingCrafts <= 0) return false;
  e.remainingCrafts -= 1;
  if (e.remainingCrafts > 0) return true;

  actor.statusEffects = actor.statusEffects.filter((s) => s.id !== FIELD_CRAFT_ID);
  pushEvent(state, {
    type: 'STATUS_EXPIRED',
    actorId: actor.id,
    zoneId: actor.currentZoneId,
    importance: 'minor',
    message: `${actor.isPlayer ? '你' : actor.name}的野外工造充能用尽。`,
    metadata: { statusId: FIELD_CRAFT_ID, reason: 'charges_used' },
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* 释放                                                                */
/* ------------------------------------------------------------------ */

export interface SkillResult {
  ok: boolean;
  message: string;
  /** 实际恢复的生命 */
  hpHealed: number;
  /** 实际恢复的体力 */
  staminaRestored: number;
  /** 战场侦察实际查明的对手数量（其它技能为 0） */
  revealed: number;
}

function failSkill(message: string): SkillResult {
  return { ok: false, message, hpHealed: 0, staminaRestored: 0, revealed: 0 };
}

/**
 * 战场侦察：把当前区域与相邻区域里**还活着的**对手全部登记为已知。
 *
 * - 玩家使用：写进 `playerIntel`（界面情报面板会显示，并按 `INTEL_FRESH_WINDOW` 老化）；
 * - NPC 使用：写进 `knownEnemies`（NPC 决策据此选择目标）。
 *
 * 这不违反「信息不完全」不变量 —— 它是**花体力和一个行动换来的**一次性快照，
 * 而且会随时间过期，不是常驻上帝视角。
 */
function runReconnaissance(state: GameState, actor: Combatant): number {
  const originId = actor.currentZoneId;
  const zoneIds = new Set<string>([originId]);
  if (GAME_CONFIG.skillReconRadius >= 1) {
    for (const adj of getZoneDef(originId).adjacent) zoneIds.add(adj);
  }

  let revealed = 0;
  for (const zoneId of zoneIds) {
    const zone = state.zones[zoneId];
    if (!zone) continue;
    for (const id of zone.aliveCharacterIds) {
      if (id === actor.id) continue;
      const target = state.characters[id];
      if (!target || !target.alive) continue;
      revealed += 1;
      if (actor.isPlayer) {
        recordIntel(state, id, zoneId, 'sight');
      } else if (!actor.knownEnemies.includes(id)) {
        actor.knownEnemies.push(id);
      }
    }
  }
  return revealed;
}

/**
 * 释放技能。调用方（actorActions / commandHandlers）负责更上层的存活与
 * 对局状态校验；这里只做技能自身的前置与效果结算。
 */
export function useSkill(
  state: GameState,
  actor: Combatant,
  skillId: SkillId,
  _rng: import('./random').SeededRandom,
): SkillResult {
  const def = SKILLS[skillId];
  const cost = canUseSkill(actor, skillId);
  if (!cost.ok) return failSkill(cost.reason ?? '无法使用该技能。');

  spendStamina(actor, def.staminaCost);
  actor.skillCooldowns[skillId] = def.cooldown;

  let hpHealed = 0;
  const staminaRestored = 0;
  let revealed = 0;
  let detail = '';

  switch (skillId) {
    case 'scout_recon': {
      revealed = runReconnaissance(state, actor);
      const scope =
        GAME_CONFIG.skillReconRadius >= 1 ? '当前区域与相邻区域' : '当前区域';
      detail =
        revealed > 0
          ? `扫描${scope}，查明 ${revealed} 名对手的位置`
          : `扫描${scope}，附近暂时没有活人`;
      break;
    }

    case 'adrenaline': {
      addStatusEffect(actor, {
        id: ADRENALINE_ID,
        // remaining 只是兜底：正常由攻击次数耗尽来结束
        remaining: GAME_CONFIG.skillCooldown,
        hpPerTick: 0,
        label: '肾上腺素',
        remainingAttacks: GAME_CONFIG.skillAdrenalineAttacks,
        attackStaminaDelta: GAME_CONFIG.skillAdrenalineStaminaDelta,
        selfDamageTakenMult: GAME_CONFIG.skillAdrenalineSelfDamageMult,
      });
      detail =
        `接下来 ${GAME_CONFIG.skillAdrenalineAttacks} 次攻击体力 -1，` +
        `但这期间自己受到的伤害 +${Math.round(
          (GAME_CONFIG.skillAdrenalineSelfDamageMult - 1) * 100,
        )}%`;
      break;
    }

    case 'field_craft': {
      addStatusEffect(actor, {
        id: FIELD_CRAFT_ID,
        remaining: GAME_CONFIG.skillFieldCraftDuration,
        hpPerTick: 0,
        label: '野外工造',
        remainingCrafts: GAME_CONFIG.skillFieldCraftCharges,
      });
      detail = `接下来 ${GAME_CONFIG.skillFieldCraftCharges} 次合成不消耗体力`;
      break;
    }

    case 'emergency_treatment': {
      // 止血：清掉所有持续掉血的状态（风暴、流血……），这是「处置」的本义
      const bleeding = actor.statusEffects.filter((e) => (e.hpPerTick ?? 0) < 0);
      actor.statusEffects = actor.statusEffects.filter((e) => (e.hpPerTick ?? 0) >= 0);

      const amount = Math.round(
        actor.maxHp * GAME_CONFIG.skillTreatmentInstantHealRatio,
      );
      hpHealed = applyHealing(state, actor, amount);

      addStatusEffect(actor, {
        id: MEDICAL_FOCUS_ID,
        remaining: GAME_CONFIG.skillTreatmentDuration,
        hpPerTick: 0,
        label: '紧急处置',
        consumableHealMult: GAME_CONFIG.skillTreatmentConsumableMult,
      });
      detail =
        `止血并恢复 ${hpHealed} 点生命` +
        (bleeding.length > 0 ? `，解除 ${bleeding.length} 个持续伤害状态` : '') +
        `，${GAME_CONFIG.skillTreatmentDuration} 个时间单位内治疗品效果 +${Math.round(
          (GAME_CONFIG.skillTreatmentConsumableMult - 1) * 100,
        )}%`;
      break;
    }
  }

  const message = `${actor.isPlayer ? '你' : actor.name}使用了「${def.name}」：${detail}。`;
  pushEvent(state, {
    type: 'SKILL_USED',
    actorId: actor.id,
    zoneId: actor.currentZoneId,
    message,
    metadata: {
      skillId,
      dimension: def.dimension,
      hpHealed,
      revealed,
      staminaCost: def.staminaCost,
    },
  });

  return { ok: true, message, hpHealed, staminaRestored, revealed };
}
