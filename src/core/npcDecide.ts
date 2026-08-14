import { GAME_CONFIG } from '../data/gameConfig';
import { getItem } from '../data/items';
import { tryGetRecipe } from '../data/recipes';
import { getZoneDef } from '../data/zones';
import { getWildEnemy } from '../data/wildEnemies';
import { canPayActionCost } from './actionCosts';
import { hasFieldCraftCharge, SKILLS } from './skills';
import { estimatePower } from './combat';
import { isZoneExhausted } from './zoneLoot';
import { findBestHealItem, findBestStaminaItem } from './consumables';
import {
  craftStaminaCost,
  findHealRecipe,
  findUpgradeRecipe,
  hasRoomForOutput,
} from './crafting';
import { enemiesInZone } from './gameState';
import { armorDefenseOf, hasIngredients, weaponAttackOf } from './inventory';
import { buildCraftPlan } from './craftPlan';
import { currentWorldSourcesForActor } from './worldSources';
import { canSearchLandmark } from './landmarks';
import { decideNpcAccessAction } from './npcAccessDecide';
import { hasPlannedWildSourceHere, hasRecommendedApexSource, npcSearchWeight, NPC_IDLE_WEIGHTS as IDLE_WEIGHTS } from './npcWildHunt';
import { wildCombatProfile } from './wildCombat';
import { npcCombatSkill, npcSurvivalSkill } from './npcSkillDecide';
import { decideNpcVictoryAction } from './npcVictoryDecide';
import type { SeededRandom } from './random';
import type { AttackStyle, Combatant, GameState, Personality } from './types';
/* ------------------------------------------------------------------ */
/* 决策结构                                                            */
/* ------------------------------------------------------------------ */

export type NpcActionKind =
  | 'evacuate' | 'heal' | 'rest' | 'craft' | 'attack' | 'flee_combat' | 'guard'
  | 'use_skill' | 'search' | 'search_landmark' | 'interact_landmark' | 'move'
  | 'call_extraction' | 'extract' | 'submit_research' | 'idle';

export interface NpcDecision {
  kind: NpcActionKind;
  reason: string;
  targetId?: string;
  targetKind?: 'contestant' | 'wild';
  zoneId?: string;
  recipeId?: string;
  uid?: string; landmarkId?: string; interactionId?: string;
  /** 进攻时选用的攻击风格（Phase 3 Step 1） */
  attackStyle?: AttackStyle;
  /** 释放的技能 id（Phase 3 Step 3） */
  skillId?: string;
}

/* ------------------------------------------------------------------ */
/* NPC 可见信息                                                        */
/* ------------------------------------------------------------------ */

/**
 * NPC 只能读取「公开」信息：
 * - 自己的完整状态
 * - 当前区域及其相邻区域的禁区状态（全场广播）
 * - 当前区域内的可见角色（属性 / 生命 / 已装备物品）
 * - 当前区域地面上的掉落物
 * - 公共事件日志中的击杀信息
 * 严禁读取其他角色的背包内容。
 */
function publiclyKnownCombatZones(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const e of state.events) {
    if (e.type !== 'CHARACTER_DIED') continue;
    // 只关心最近 8 个时间单位内的击杀
    if (state.time - e.time > 8) continue;
    if (e.zoneId) out.add(e.zoneId);
  }
  return out;
}

/**
 * 已被广播「搜空」的区域。
 *
 * 这仍然属于公开信息：`ZONE_EXHAUSTED` 是全场播报的事件，
 * NPC 不需要窥探区域内部数据就能知道"那边已经没东西了"。
 * 这样 NPC 才不会在空区域里反复空搜，把有限物资的策略压力真正传导出去。
 */
function publiclyExhaustedZones(state: GameState): Set<string> {
  const out = new Set<string>();
  for (const e of state.events) {
    if (e.type === 'ZONE_EXHAUSTED' && e.zoneId) out.add(e.zoneId);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 人格权重                                                            */
/* ------------------------------------------------------------------ */

interface CombatStance {
  /** 我方战力至少要达到对方的多少倍才愿意开打 */
  powerRatioToFight: number;
  /** 生命比例低于该值时优先避战 */
  avoidBelowHpRatio: number;
  /** 额外的主动攻击倾向 */
  aggressionBonus: number;
}

const STANCES: Record<Personality, CombatStance> = {
  aggressive: { powerRatioToFight: 0.7, avoidBelowHpRatio: 0.33, aggressionBonus: 0.12 },
  cautious: { powerRatioToFight: 1.15, avoidBelowHpRatio: GAME_CONFIG.cautiousAvoidHpRatio, aggressionBonus: -0.2 },
  collector: { powerRatioToFight: 1.3, avoidBelowHpRatio: 0.45, aggressionBonus: -0.1 },
  opportunist: { powerRatioToFight: 1.05, avoidBelowHpRatio: 0.35, aggressionBonus: 0.05 },
  random: { powerRatioToFight: 1.0, avoidBelowHpRatio: 0.25, aggressionBonus: 0 },
};

/* ------------------------------------------------------------------ */
/* 目标选择                                                            */
/* ------------------------------------------------------------------ */

function chooseTarget(
  npc: Combatant,
  enemies: Combatant[],
  rng: SeededRandom,
): Combatant | null {
  if (enemies.length === 0) return null;
  switch (npc.personality) {
    case 'opportunist':
    case 'aggressive':
      // 追逐受伤的目标
      return enemies.reduce((best, cur) =>
        cur.hp / cur.maxHp < best.hp / best.maxHp ? cur : best,
      );
    case 'cautious':
    case 'collector':
      // 挑战力最低的
      return enemies.reduce((best, cur) =>
        estimatePower(cur) < estimatePower(best) ? cur : best,
      );
    case 'random':
    default:
      return rng.pick(enemies);
  }
}

/**
 * 选择攻击风格（Phase 3 Step 1）。
 * 一般原则：占优时偏重击求速杀，体力紧张时偏速攻节省体力，残血谨慎型求稳。
 */
function chooseAttackStyle(
  npc: Combatant,
  target: Combatant,
  rng: SeededRandom,
): AttackStyle {
  const myPower = estimatePower(npc);
  const theirPower = estimatePower(target);
  const powerOk = myPower >= theirPower * 0.8;
  const lowStamina = npc.stamina < GAME_CONFIG.attackStyleStaminaCost.heavy + 1;
  switch (npc.personality) {
    case 'aggressive':
      return powerOk && !lowStamina ? 'heavy' : 'normal';
    case 'cautious':
      return npc.stamina < GAME_CONFIG.attackStyleStaminaCost.normal + 1
        ? 'quick'
        : 'normal';
    case 'collector':
      return lowStamina ? 'quick' : 'normal';
    case 'opportunist':
      return target.hp / target.maxHp < 0.4 && powerOk && !lowStamina
        ? 'heavy'
        : 'normal';
    case 'random':
    default:
      return rng.pick<AttackStyle>(['quick', 'normal', 'heavy']) ?? 'normal';
  }
}

/** 选择移动目的地：优先安全区，人格影响是否靠近战斗区域 */
function chooseMoveTarget(
  state: GameState,
  npc: Combatant,
  rng: SeededRandom,
): string | null {
  const adjacent = getZoneDef(npc.currentZoneId).adjacent;
  const combatZones = publiclyKnownCombatZones(state);
  const exhausted = publiclyExhaustedZones(state);

  const entries = adjacent.map((zoneId) => {
    const status = state.zones[zoneId]?.status ?? 'safe';
    let weight = status === 'safe' ? 10 : status === 'warning' ? 2 : 0.2;

    const hasCombat = combatZones.has(zoneId);
    if (hasCombat) {
      if (npc.personality === 'opportunist') weight *= 2.5;
      else if (npc.personality === 'aggressive') weight *= 1.8;
      else if (npc.personality === 'cautious') weight *= 0.35;
    }
    // 已被播报搜空的区域对搜集型 NPC 尤其没有吸引力
    if (exhausted.has(zoneId)) {
      weight *= npc.personality === 'collector' ? 0.15 : 0.4;
    }
    // Phase 2A-1：长期制作目标会真正影响移动——向推荐搜索区域靠拢
    if (npc.planRecommendedZoneId === zoneId && status !== 'restricted') {
      weight *= 5;
    }
    if (npc.personality === 'random') weight += 4;
    return { value: zoneId, weight };
  });

  return rng.pickWeighted(entries);
}

/** 撤离：找一个尽量安全的相邻区域 */
function chooseEvacuationTarget(
  state: GameState,
  npc: Combatant,
  rng: SeededRandom,
): string | null {
  const adjacent = getZoneDef(npc.currentZoneId).adjacent;
  const safe = adjacent.filter((id) => state.zones[id]?.status === 'safe');
  if (safe.length > 0) return rng.pick(safe);
  const warning = adjacent.filter((id) => state.zones[id]?.status === 'warning');
  if (warning.length > 0) return rng.pick(warning);
  return rng.pick(adjacent);
}

export { hasPlannedWildSourceHere, npcSearchWeight } from './npcWildHunt';

/* ------------------------------------------------------------------ */
/* 制作目标规划（Phase 3 Step 10 已拆至 npcGoalPlan.ts，此处保留出口）    */
/* ------------------------------------------------------------------ */

export { chooseNpcGoal, planNpcGoal } from './npcGoalPlan';

/* ------------------------------------------------------------------ */
/* 决策                                                                */
/* ------------------------------------------------------------------ */

/**
 * NPC 决策。硬性优先级在前，人格权重只影响最后的常规行动与战斗取舍。
 */
export function decideNpcAction(
  state: GameState,
  npc: Combatant,
  rng: SeededRandom,
): NpcDecision {
  // 1. 已死亡则不行动
  if (!npc.alive) return { kind: 'idle', reason: '已死亡' };

  const zone = state.zones[npc.currentZoneId];
  const hpRatio = npc.hp / npc.maxHp;

  // 2. 当前区域是禁区 / 预警区，优先离开
  if (zone && (zone.status === 'restricted' || zone.status === 'warning')) {
    const target = chooseEvacuationTarget(state, npc, rng);
    if (target && target !== npc.currentZoneId) {
      return {
        kind: 'evacuate',
        reason: zone.status === 'restricted' ? '身处禁区，必须撤离' : '所在区域已预警，提前撤离',
        zoneId: target,
      };
    }
  }

  // Alternative victory routes are real NPC goals, not player-only shortcuts.
  // Completion is checked before ordinary combat/recovery so an eligible NPC
  // can win while other contestants are still alive.
  const victoryDecision = decideNpcVictoryAction(state, npc);
  if (victoryDecision) return victoryDecision;

  // 3. 生命低于阈值且有治疗品 -> 治疗
  const healThreshold =
    npc.personality === 'cautious'
      ? Math.max(GAME_CONFIG.npcHealThreshold, 0.5)
      : GAME_CONFIG.npcHealThreshold;
  if (hpRatio < healThreshold) {
    const heal = findBestHealItem(npc);
    if (heal) {
      return { kind: 'heal', reason: `生命 ${Math.round(hpRatio * 100)}%，使用治疗品`, uid: heal.uid };
    }
    const healRecipe = findHealRecipe(npc);
    if (healRecipe) {
      return { kind: 'craft', reason: '生命偏低，现场制作治疗品', recipeId: healRecipe.id };
    }
  }

  // 4.5 战略技能：处置 / 工造 / 侦察（Phase 3A-2）
  // 工程师的 field_craft 机会必须先于低体力 REST 判断：技能本身只需 2 点体力，
  // 而它的价值正是让「材料已齐但正常合成付不起体力」的下一次 CRAFT 免费。
  // 这不是免费体力：readySkill 仍会检查技能冷却与技能自身成本。
  const survivalSkill = npcSurvivalSkill(state, npc);
  if (survivalSkill && !npc.explorationObjective) {
    return {
      kind: 'use_skill',
      reason: `释放生存技能（${SKILLS[survivalSkill].name}）`,
      skillId: survivalSkill,
    };
  }

  // field_craft 已经成功释放后，下一次行动即使体力为 0 也必须先完成这次
  // 合成；技能只免除 CRAFT 成本，不给 NPC 额外体力。
  const chargedPlan = npc.plannedRecipeId ? buildCraftPlan(state, npc, npc.plannedRecipeId) : null;
  const chargedStep = chargedPlan?.suggestedNextCraft;
  if (
    hasFieldCraftCharge(npc) &&
    chargedStep &&
    tryGetRecipe(chargedStep.recipeId) &&
    hasIngredients(npc, tryGetRecipe(chargedStep.recipeId)!.ingredients) &&
    hasRoomForOutput(npc, tryGetRecipe(chargedStep.recipeId)!)
  ) {
    return {
      kind: 'craft',
      reason: npc.planReason ?? `执行现场加工：${chargedStep.name}`,
      recipeId: chargedStep.recipeId,
    };
  }

  // 4.75 体力过低 -> 使用恢复品或休息
  if (npc.stamina < GAME_CONFIG.npcRestThreshold) {
    const drink = findBestStaminaItem(npc);
    if (drink) {
      return { kind: 'heal', reason: '体力不足，补充体力', uid: drink.uid };
    }
    return { kind: 'rest', reason: '体力不足，原地休整' };
  }

  // 5. 执行既定制作目标 / 能合成明显更强的装备 -> 合成
  //    优先按 planNpcGoal 规划的目标行事，让 NPC 行为有长期方向（搜集型会为差一点的配方去搜材料）
  //    但一个已经通过自己的 SEARCH 发现的 Apex 来源优先于现场加工；
  //    否则 NPC 可能先消耗基础材料，把正式 boss→loot 路线永远推迟。
  const knownApexTarget = state.events.some((event) => {
    if (event.type !== 'WILD_ENCOUNTER_STARTED' || event.actorId !== npc.id) return false;
    if (typeof event.metadata.wildUid !== 'string') return false;
    const wild = state.wildEnemies[event.metadata.wildUid];
    return Boolean(wild && wild.status === 'alive' && wild.zoneId === npc.currentZoneId && getWildEnemy(wild.defId).tier === 'apex');
  });
  const plan = npc.plannedRecipeId ? buildCraftPlan(state, npc, npc.plannedRecipeId) : null;
  const planStep = plan?.suggestedNextCraft;
  const planRecipe = planStep ? tryGetRecipe(planStep.recipeId) : null;
  if (
    !knownApexTarget &&
    planRecipe &&
    hasIngredients(npc, planRecipe.ingredients) &&
    hasRoomForOutput(npc, planRecipe) &&
    npc.stamina >= craftStaminaCost(npc)
  ) {
    return {
      kind: 'craft',
      reason: npc.planReason ?? `执行制作目标：${getItem(planRecipe.outputItemId).name}`,
      recipeId: planRecipe.id,
    };
  }
  const upgradeCandidate = knownApexTarget ? null : findUpgradeRecipe(npc, weaponAttackOf(npc), armorDefenseOf(npc));
  const upgrade = upgradeCandidate && !plan?.steps.some((step) =>
    step.recipeId === upgradeCandidate.id && step.status === 'complete',
  ) ? upgradeCandidate : null;
  if (upgrade) {
    return { kind: 'craft', reason: '可以做出更强的装备', recipeId: upgrade.id };
  }

  // 6. 同区域有敌人 -> 按人格与战力决定攻击或逃跑
  //    已在玩家行动阶段与玩家交过手的 NPC，本时间单位不再针对玩家
  const alreadyEngaged = state.engagedWithPlayer.includes(npc.id);
  const enemies = enemiesInZone(state, npc).filter(
    (e) => !(alreadyEngaged && e.isPlayer),
  );
  if (enemies.length > 0) {
    const stance = STANCES[npc.personality];
    const target = chooseTarget(npc, enemies, rng);
    if (target) {
      // 开打前先考虑战斗增益技能（破甲 / 疾影），增加胜算（Phase 3 Step 3）
      const combatSkill = npcCombatSkill(npc);
      if (combatSkill && rng.chance(0.7)) {
        return {
          kind: 'use_skill',
          reason: `开打前释放（${SKILLS[combatSkill].name}）`,
          skillId: combatSkill,
        };
      }

      const myPower = estimatePower(npc);
      const theirPower = estimatePower(target);
      const powerOk = myPower >= theirPower * stance.powerRatioToFight;
      const healthOk = hpRatio >= stance.avoidBelowHpRatio;

      let fightScore = (powerOk ? 0.6 : 0.15) + stance.aggressionBonus;
      if (!healthOk) fightScore -= 0.45;
      if (target.hp / target.maxHp < 0.4) fightScore += 0.25;
      if (npc.personality === 'random') fightScore = 0.5;
      // Phase 3A-1：「全域骚动」不再直接提高 NPC 攻击倾向（效果已改为噪音管理）

      if (rng.chance(Math.min(0.95, Math.max(0.05, fightScore)))) {
        return {
          kind: 'attack',
          reason: `${powerOk ? '战力占优' : '仍选择交战'}（我方${Math.round(myPower)} vs ${Math.round(theirPower)}）`,
          targetId: target.id,
          targetKind: 'contestant',
          attackStyle: chooseAttackStyle(npc, target, rng),
        };
      }
      // 不主动进攻：残血且可被重创时，摆出防御姿态以减小下一击伤害，
      // 否则脱离接触（Phase 3 Step 1 新增 guard 选项）
      if (hpRatio < 0.22 && canPayActionCost(npc, 'GUARD').ok && rng.chance(0.5)) {
        return {
          kind: 'guard',
          reason: `生命 ${Math.round(hpRatio * 100)}%，摆出防御姿态等待时机`,
        };
      }
      return {
        kind: 'flee_combat',
        reason: healthOk ? '战力不足，脱离接触' : `生命 ${Math.round(hpRatio * 100)}%，避战`,
        targetId: target.id,
        targetKind: 'contestant',
      };
    }
  }

  // 6.5 A SEARCH-discovered local wild target can be hunted through the same
  // ATTACK/GUARD/FLEE command vocabulary. Self-owned encounter events are the
  // knowledge boundary; this never scans remote live populations.
  const plannedWildDefs = new Set(plan?.rawGaps.flatMap((gap) => currentWorldSourcesForActor(state, npc, gap.itemId)
    .flatMap((source) => source.kind === 'wild_drop' ? source.enemyIds : [])) ?? []);
  const knownWild = state.events
    .filter((event) => event.type === 'WILD_ENCOUNTER_STARTED' && event.actorId === npc.id)
    .map((event) => typeof event.metadata.wildUid === 'string' ? state.wildEnemies[event.metadata.wildUid] : null)
    .filter((enemy) => enemy?.status === 'alive' && enemy.zoneId === npc.currentZoneId)
    .sort((a, b) => Number(plannedWildDefs.has(b!.defId)) - Number(plannedWildDefs.has(a!.defId)))[0];
  if (knownWild) {
    const knownDef = getWildEnemy(knownWild.defId);
    const target = wildCombatProfile(knownWild);
    const stance = STANCES[npc.personality];
    const powerOk = estimatePower(npc) >= estimatePower(target) * stance.powerRatioToFight;
    const apexRisk = knownDef.tier === 'apex' ? 0.18 : knownDef.tier === 'elite' ? 0.08 : 0;
    if ((hpRatio < stance.avoidBelowHpRatio + apexRisk || (knownDef.tier === 'apex' && !powerOk && hpRatio < 0.7)) && canPayActionCost(npc, 'FLEE').ok) {
      return { kind: 'flee_combat', reason: '生命不足，脱离野外威胁', targetId: knownWild.uid, targetKind: 'wild' };
    }
    if ((!powerOk || knownDef.tier === 'apex') && canPayActionCost(npc, 'GUARD').ok && rng.chance(knownDef.tier === 'apex' ? 0.65 : 0.4)) {
      return { kind: 'guard', reason: '野外目标威胁较高，先行防御', targetId: knownWild.uid, targetKind: 'wild' };
    }
    return {
      kind: 'attack', reason: plannedWildDefs.has(knownWild.defId) ? '制作目标需要该野外来源' : '清除已发现的野外威胁',
      targetId: knownWild.uid, targetKind: 'wild', attackStyle: chooseAttackStyle(npc, target, rng),
    };
  }

  // Local access objectives are committed by the existing craft planner. They
  // run after combat/Apex priorities and before generic search weighting.
  const accessDecision = decideNpcAccessAction(state, npc);
  if (accessDecision) return accessDecision;

  // 7. 常规行动
  const weights = IDLE_WEIGHTS[npc.personality];
  const canSearchNow = canPayActionCost(npc, 'SEARCH').ok;
  const zoneEmpty = zone ? isZoneExhausted(zone) : false;
  const searchWeight = npcSearchWeight(state, npc, plan);
  const goalZone = npc.planRecommendedZoneId;
  if (npc.planRecommendedLandmarkId && canSearchLandmark(state, npc.id, npc.planRecommendedLandmarkId).ok) {
    return { kind: 'search_landmark', landmarkId: npc.planRecommendedLandmarkId, reason: '沿制作目标前往当前区域的定向来源' };
  }
  // 区域已空时，"留在原地休息"也失去意义，移动权重相应抬高
  const moveWeight = zoneEmpty ? weights.move * 2.2 : weights.move;
  if (
    zoneEmpty &&
    hasRecommendedApexSource(state, plan, npc.currentZoneId, goalZone) &&
    goalZone !== null &&
    getZoneDef(npc.currentZoneId).adjacent.includes(goalZone) &&
    state.zones[goalZone]?.status !== 'restricted'
  ) {
    return { kind: 'move', zoneId: goalZone, reason: '前往制作目标所需的公开 Apex 来源区域' };
  }
  if (zoneEmpty && hasPlannedWildSourceHere(state, npc, plan) && canSearchNow) {
    return { kind: 'search', reason: '当前区域物资已空，但制作目标需要搜索这里的野外来源' };
  }
  const goalReachable = Boolean(
    goalZone && state.zones[goalZone]?.status !== 'restricted',
  );
  let finalMove = moveWeight;
  if (goalReachable && npc.currentZoneId !== goalZone) finalMove *= 1.6;

  const kind = rng.pickWeighted<'search' | 'move' | 'rest'>([
    { value: 'search', weight: searchWeight },
    { value: 'move', weight: finalMove },
    { value: 'rest', weight: weights.rest },
  ]);

  if (kind === 'move') {
    const target = chooseMoveTarget(state, npc, rng);
    if (target) {
      return {
        kind: 'move',
        reason: zoneEmpty ? '当前区域已被搜空，转移' : '前往相邻区域',
        zoneId: target,
      };
    }
  }
  if (kind === 'rest' || !canSearchNow) {
    return { kind: 'rest', reason: '保存体力' };
  }
  return { kind: 'search', reason: `搜索当前区域（物资 ${Math.round((zone?.supply ?? 1) * 100)}%）` };
}
