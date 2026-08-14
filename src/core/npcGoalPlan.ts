/**
 * NPC 制作目标规划（Phase 2A-1 引入，Phase 3 Step 10 从 npcDecide.ts 拆出）。
 *
 * 本文件只负责「长期做什么」：候选配方构建、人格评分、目标选择、重规划触发、
 * 推荐搜索区域。不含任何逐回合行动决策（那部分仍在 npcDecide.ts）。
 * 纯函数 + 原地写回 NPC 的 plan* 字段，除随机型人格外不消耗随机数。
 */
import { GAME_CONFIG } from '../data/gameConfig';
import { getItem } from '../data/items';
import { getWildEnemy } from '../data/wildEnemies';
import { RECIPES, tryGetRecipe } from '../data/recipes';
import { getZoneDef, ZONE_IDS } from '../data/zones';
import {
  armorDefenseOf,
  countItem,
  missingIngredients,
  weaponAttackOf,
} from './inventory';
import { buildCraftPlan } from './craftPlan';
import type { SeededRandom } from './random';
import type { Combatant, GameState, ItemDef, Personality, Recipe } from './types';
import { PHASE4P_WILD_MATERIAL_IDS } from '../data/phase4pItems';
import { PHASE4P_RECIPES } from '../data/phase4pRecipes';
import { currentWorldSourcesForActor } from './worldSources';
import { recommendedLandmarkForRecipe, refreshLandmarkRecommendation } from './npcLandmarkPlan';
import { tryGetLandmarkDef } from '../data/landmarks';
import { isZoneExhausted } from './zoneLoot';

const PHASE4P_RECIPE_IDS = new Set(PHASE4P_RECIPES.map((recipe) => recipe.id));

/* ------------------------------------------------------------------ */
/* 制作目标规划（Phase 2A-1：五种人格长期规划）                          */
/* ------------------------------------------------------------------ */

/**
 * 判断某升级配方对 NPC 是否还有意义：
 * 武器/防具类配方，若成品属性不高于当前装备，则做了也是浪费。
 */
function upgradeWorthless(
  attack: number,
  defense: number,
  recipeId: string,
): boolean {
  const r = tryGetRecipe(recipeId);
  if (!r) return true;
  const out = getItem(r.outputItemId);
  if (out.category === 'weapon') return (out.attack ?? 0) <= attack;
  if (out.category === 'armor') return (out.defense ?? 0) <= defense;
  return false;
}

/** 某物品是否是某个配方的成品（用于估算合成路线的深度） */
function isCraftableOutput(itemId: string): boolean {
  return RECIPES.some((r) => r.outputItemId === itemId);
}

/** 配方所需材料中仍缺少的部分（按单位计数） */
function recipeMissingCount(npc: Combatant, recipe: Recipe): number {
  return missingIngredients(npc, recipe.ingredients).reduce(
    (sum, ing) => sum + ing.count,
    0,
  );
}

/** 当前材料完成度 0..1（已持有单位 / 所需单位） */
function completionOf(npc: Combatant, recipe: Recipe): number {
  const required = recipe.ingredients.reduce((s, i) => s + i.count, 0);
  if (required <= 0) return 1;
  const missing = recipeMissingCount(npc, recipe);
  return Math.max(0, Math.min(1, 1 - missing / required));
}

/** 默认派生意图只在终局阶段进入制作竞争；显式场景目标立即生效。 */
function victoryRouteActivated(npc: Combatant): boolean {
  return npc.victoryGoalMode !== 'derived';
}

interface GoalCandidate {
  recipe: Recipe;
  out: ItemDef;
  /** 武器攻击提升 / 防具防御提升；消耗品为 0 */
  gain: number;
  missingCount: number;
  /** 仍缺失的材料种类数 */
  materialVariety: number;
  /** 合成路线长度：可合成的中间件按 2 计，普通材料按 1 计 */
  depth: number;
  /** 材料完成度 0..1 */
  completion: number;
  value: number;
}

/** 构建合理候选集：排除成品已拥有 / 升级无意义的配方 */
function buildGoalCandidates(npc: Combatant): GoalCandidate[] {
  const attack = weaponAttackOf(npc);
  const defense = armorDefenseOf(npc);
  const out: GoalCandidate[] = [];
  const hasPhase4PMaterial = PHASE4P_WILD_MATERIAL_IDS.some((itemId) => countItem(npc, itemId) > 0);
  for (const recipe of RECIPES) {
    // Keep the historical default objective planner stable until an NPC has
    // legally observed or picked up a Phase 4P material. Explicit craft goals
    // still bypass this selector and use the same public source planner.
    if (PHASE4P_RECIPE_IDS.has(recipe.id) && !hasPhase4PMaterial) continue;
    const item = getItem(recipe.outputItemId);
    const isVictoryObjective = item.category === 'objective';
    const matchesVictoryGoal =
      (npc.victoryGoal === 'extraction' && item.id === 'extraction_beacon')
      || (npc.victoryGoal === 'research' && item.id === 'research_package');
    if (isVictoryObjective && (!matchesVictoryGoal || !victoryRouteActivated(npc))) continue;
    if (item.category === 'weapon' || item.category === 'armor') {
      if (upgradeWorthless(attack, defense, recipe.id)) continue;
    } else if (item.category === 'utility') {
      // utility is a valid final route; its gain is evaluated below.
    } else if (item.category !== 'consumable' || (item.healHp ?? 0) <= 0) {
      // Alternative route intent is handled by npcDecide's explicit actions;
      // generic gear planning remains stable for legacy simulations.
      if (!isVictoryObjective) continue;
    }
    if (countItem(npc, recipe.outputItemId) > 0) continue; // 已有成品
    const missing = missingIngredients(npc, recipe.ingredients);
    out.push({
      recipe,
      out: item,
      gain:
        item.category === 'weapon'
          ? (item.attack ?? 0) - attack
          : item.category === 'armor'
            ? (item.defense ?? 0) - defense
            : item.category === 'utility'
              ? ((item.searchFindMult ?? 1) - 1) * 100
              : 0,
      missingCount: missing.reduce((s, i) => s + i.count, 0),
      materialVariety: new Set(missing.map((i) => i.itemId)).size,
      depth: recipe.ingredients.reduce(
        (s, i) => s + (isCraftableOutput(i.itemId) ? 2 : 1),
        0,
      ),
      completion: completionOf(npc, recipe),
      value: item.value,
    });
  }
  return out;
}

/**
 * 按人格给候选配方打分（数值全部可复现，不消耗随机数）。
 *
 * 规格 §四：
 * - 激进：武器优先，评分 = 攻击提升×3 − 缺失材料 − 合成步骤；
 * - 谨慎：防具 > 医疗 > 武器，低生命时医疗权重大幅提高；
 * - 收集：价值 ×2 + 材料种类 ×3 + 路线长度 ×2 − 缺失材料（不再只看"差一个"）；
 * - 投机：完成度 ×12 − 缺失数量 ×2 + 战力提升 ×1.5；
 * - 随机：按中性的完成度/价值打分，由调用方从前 5 名里用 SeededRandom 抽取。
 */
function scoreCandidate(
  cand: GoalCandidate,
  personality: Personality,
  hpRatio: number,
): number {
  const { out, gain, missingCount, materialVariety, depth, completion, value } = cand;
  // 材料已齐（现在就能做）的非收集型人格：强烈偏好立即可成的配方，
  // 避免"追着最强的装备跑、手里能做的却一直不做"。收集型除外——它就该追长线价值。
  const craftableBonus =
    missingCount === 0 && personality !== 'collector' ? 10 : 0;
  if (out.category === 'objective') {
    return 80 + completion * 20 - missingCount * 2 - depth + craftableBonus;
  }
  switch (personality) {
    case 'aggressive':
      if (out.category === 'weapon') {
        return gain * 3 - missingCount * 2 - depth * 2 + craftableBonus;
      }
      if (out.category === 'armor') return gain * 2 - missingCount * 2 - depth * 2;
      return -100; // 激进不考虑消耗品（除非没有其他候选）
    case 'cautious':
      if (out.category === 'armor') {
        return gain * 4 + 8 - missingCount * 2 - depth * 2 + craftableBonus;
      }
      if (out.category === 'consumable') {
        return (
          (out.healHp ?? 0) * 0.4 +
          (1 - hpRatio) * 12 -
          missingCount * 2 -
          depth +
          craftableBonus
        );
      }
      return gain * 2 - missingCount * 2 - depth * 2;
    case 'collector':
      return value * 2 + materialVariety * 3 + depth * 2 - missingCount;
    case 'opportunist':
      return completion * 12 - missingCount * 2 + gain * 1.5 + craftableBonus;
    case 'random':
    default:
      return completion * 10 - missingCount * 2 + value * 0.2 + craftableBonus;
  }
}

function goalOf(
  cand: GoalCandidate,
  personality: Personality,
): { recipeId: string; reason: string } {
  const name = cand.out.name;
  if (cand.out.category === 'consumable') {
    const hint = personality === 'cautious' ? '补充治疗' : '储备医疗';
    return { recipeId: cand.recipe.id, reason: `计划制作${name}（${hint}）` };
  }
  if (cand.out.category === 'objective') {
    const route = cand.out.id === 'research_package' ? '研究' : '撤离';
    return { recipeId: cand.recipe.id, reason: `选择${route}胜利路线，计划制作${name}` };
  }
  const kind = cand.out.category === 'weapon' ? '武器' : cand.out.category === 'armor' ? '防具' : '工具';
  return {
    recipeId: cand.recipe.id,
    reason: `计划强化为${name}（${kind}${cand.missingCount === 0 ? '，材料已齐' : ''}）`,
  };
}

/**
 * 为某个 NPC 选一个值得长期追求的制作目标。
 *
 * Phase 2A-1 重写：
 * - 五种人格各有独立评分，不再只有 collector 能建立长期目标；
 * - 普通开局（无装备、无材料）下五种人格都必须返回目标；
 * - 随机型人格在「前 5 名合理候选」中用 SeededRandom 抽取（严禁 Math.random）；
 * - 传入 rng 时随机型才真正随机；不传则取第一名（确定性，便于测试）。
 */
export function chooseNpcGoal(
  npc: Combatant,
  rng?: SeededRandom,
): { recipeId: string; reason: string } | null {
  const candidates = buildGoalCandidates(npc);
  if (candidates.length === 0) return null;

  const hpRatio = npc.hp / npc.maxHp;
  const scored = candidates
    .map((cand) => ({
      cand,
      score: scoreCandidate(cand, npc.personality, hpRatio),
    }))
    .filter((x) => Number.isFinite(x.score))
    .sort(
      (a, b) => b.score - a.score || a.cand.recipe.id.localeCompare(b.cand.recipe.id),
    );
  if (scored.length === 0) return null;

  if (npc.personality === 'random' && rng) {
    const top = scored.slice(0, 5);
    const pick = rng.pick(top);
    if (pick) return goalOf(pick.cand, npc.personality);
  }
  return goalOf(scored[0]!.cand, npc.personality);
}

/**
 * 计算多层目标的完成度（供 planProgress 字段）。
 *
 * 只看最终配方的直接材料会让 NPC 做出中间件后仍被判定为“没有进展”，
 * 最终在无进展阈值处放弃长链。这里把依赖树上的每个步骤纳入进度：
 * 已有成品记满分，材料已齐可制作记 75%，部分持有记 50%。这仍是纯
 * 规划指标，不会消费库存，也不会把 component 当成 raw。
 */
function computePlanProgress(state: GameState, npc: Combatant, recipe: Recipe): number {
  const plan = buildCraftPlan(state, npc, recipe.id);
  if (!plan || plan.steps.length === 0) return completionOf(npc, recipe);
  const score = plan.steps.reduce((sum, step) => {
    if (step.status === 'complete') return sum + 1;
    if (step.status === 'craftable') return sum + 0.75;
    return sum + (step.owned > 0 ? 0.5 : 0);
  }, 0);
  return score / plan.steps.length;
}

/** 推荐搜索区域：静态物资池覆盖缺失材料，禁区排除、预警区扣分、就近加分 */
function pickRecommendedZone(
  state: GameState,
  npc: Combatant,
  recipe: Recipe,
): string | null {
  const plan = buildCraftPlan(state, npc, recipe.id);
  const missing = plan?.rawGaps.filter((gap) => gap.missing > 0) ?? [];
  if (missing.length === 0) return null;

  const currentSourcesFor = (gap: (typeof missing)[number]) => currentWorldSourcesForActor(state, npc, gap.itemId);

  let best: { zoneId: string; score: number } | null = null;
  for (const zoneId of ZONE_IDS) {
    const zone = state.zones[zoneId];
    if (!zone || zone.status === 'restricted') continue; // 正式禁区直接排除
    const def = getZoneDef(zoneId);
    let score = 0;
    for (const gap of missing) {
      // Static raw provenance remains available to Craft Guide, while NPC
      // movement consumes the current public source resolver. A spawned Apex
      // therefore contributes only its announced zone, never old eligible
      // alternatives, and a defeated Apex contributes no future source.
      const currentSources = currentSourcesFor(gap);
      if (currentSources.some((source) => source.kind !== 'landmark_loot' && source.zoneIds.includes(zoneId))) score += 11;
      if (currentSources.some((source) => source.kind === 'wild_drop' && source.enemyIds.some((enemyId) =>
        getWildEnemy(enemyId).tier === 'apex' && state.apexSchedule.some((entry) =>
          entry.spawned && entry.defId === enemyId && entry.zoneId === zoneId,
        ),
      ))) score += 8;
    }
    if (score === 0) continue;
    if (zone.status === 'warning') score -= 4;
    if (zoneId === npc.currentZoneId) score += 6;
    else if (def.adjacent.includes(npc.currentZoneId)) score += 3;
    if (!best || score > best.score) best = { zoneId, score };
  }
  return best?.zoneId ?? null;
}

/** 目标所需的每种缺失材料，其所有供给区域是否都已是禁区 */
function allMissingZonesRestricted(
  state: GameState,
  npc: Combatant,
  recipe: Recipe,
): boolean {
  const missing = buildCraftPlan(state, npc, recipe.id)?.rawGaps.filter((gap) => gap.missing > 0) ?? [];
  if (missing.length === 0) return false;
  // Never reconstruct sources from zone pools here. Static worldSources stay
  // intact for provenance; the actor-scoped resolver is the shared runtime
  // contract for restrictions, Apex collapse, and local landmark state.
  return missing.every((gap) => !currentWorldSourcesForActor(state, npc, gap.itemId).some((source) => source.kind !== 'landmark_loot' &&
    source.zoneIds.some((zoneId) => state.zones[zoneId]?.status !== 'restricted'),
  ));
}

/** Keep an explicit public Apex hunt alive while the NPC is in its announced
 * source zone. SEARCH can legitimately make no progress for several turns
 * before the weighted encounter roll succeeds; abandoning the actor's own
 * route at that point would also remove its high-tier SEARCH bias. */
function hasCurrentApexSourceForPlan(
  state: GameState,
  npc: Combatant,
  recipe: Recipe,
): boolean {
  const plan = buildCraftPlan(state, npc, recipe.id);
  return plan?.rawGaps.some((gap) => gap.missing > 0 && currentWorldSourcesForActor(state, npc, gap.itemId).some((source) =>
    source.kind === 'wild_drop' &&
    source.zoneIds.includes(npc.currentZoneId) &&
    source.enemyIds.some((enemyId) => getWildEnemy(enemyId).tier === 'apex'),
  )) ?? false;
}

/** Once an NPC has personally defeated a named Apex for a Phase 4P route, its
 * no-progress counter must not make it abandon the drop it is about to loot
 * and process. The encounter/defeat pair is public event evidence and does
 * not reveal any other actor's inventory. */
function hasCompletedApexHuntForPlan(
  state: GameState,
  npc: Combatant,
  recipe: Recipe,
): boolean {
  if (!PHASE4P_RECIPE_IDS.has(recipe.id)) return false;
  const defeated = new Set(
    state.events
      .filter((event) => event.type === 'WILD_DEFEATED' && event.actorId === npc.id)
      .filter((event) => typeof event.metadata.wildUid === 'string' && typeof event.metadata.wildDefId === 'string' && getWildEnemy(event.metadata.wildDefId).tier === 'apex')
      .map((event) => event.metadata.wildUid as string),
  );
  return state.events.some((event) =>
    event.type === 'WILD_ENCOUNTER_STARTED' &&
    event.actorId === npc.id &&
    typeof event.metadata.wildUid === 'string' &&
    defeated.has(event.metadata.wildUid),
  );
}

/** Commit the route facets of an already-selected recipe exactly once. */
function applyNpcPlanRecommendations(
  state: GameState,
  npc: Combatant,
  recipe: Recipe | null,
): void {
  const recommendedZoneId = recipe ? pickRecommendedZone(state, npc, recipe) : null;
  npc.planRecommendedZoneId = recommendedZoneId;
  // Apex recipes retain dedicated wild-source planning. Promote a remote
  // landmark only after the current zone is exhausted, preserving legacy
  // zone choice and making the finite-loot hand-off explicit.
  const craftPlan = recipe ? buildCraftPlan(state, npc, recipe.id) : null;
  const hasWildDropGap = Boolean(craftPlan?.rawGaps.some((gap) => gap.worldSources.some((source) => source.kind === 'wild_drop')));
  const isObjectiveRoute = recipe ? getItem(recipe.outputItemId).category === 'objective' : false;
  if (recipe && !PHASE4P_RECIPE_IDS.has(recipe.id) && !hasWildDropGap && !isObjectiveRoute) {
    const landmarkId = recommendedLandmarkForRecipe(state, npc, recipe);
    const landmarkZoneId = landmarkId ? tryGetLandmarkDef(landmarkId)?.zoneId ?? null : null;
    const currentZoneIsExhausted = Boolean(state.zones[npc.currentZoneId] && isZoneExhausted(state.zones[npc.currentZoneId]!));
    if (landmarkId && currentZoneIsExhausted && (
      recommendedZoneId === null
      || recommendedZoneId === npc.currentZoneId
    )) {
      npc.planRecommendedLandmarkId = landmarkId;
      npc.planRecommendedZoneId = landmarkZoneId;
      return;
    }
  }
  npc.planRecommendedLandmarkId = null;
}

/**
 * NPC 制作目标规划（Phase 2A-1 重写）。
 *
 * 每回合调用（runNpcTurn 开头）：
 * 1. 刷新 planProgress / planNoProgressTurns；
 * 2. 依据重规划触发条件决定是否重规划：首次、TTL 过期、配方不存在、
 *    成品已拥有、已有更优装备、连续无进展、目标材料区域全部成为禁区、进入终局；
 * 3. 重规划时写入 plannedRecipeId / planCreatedAt / planReason /
 *    planRecommendedZoneId / lastReplanReason，并重置无进展计数。
 */
export function planNpcGoal(
  state: GameState,
  npc: Combatant,
  rng?: SeededRandom,
): void {
  const currentRecipe = npc.plannedRecipeId
    ? tryGetRecipe(npc.plannedRecipeId)
    : null;

  /* ---- 每回合刷新进度 / 无进展计数 ---- */
  if (currentRecipe) {
    const progress = computePlanProgress(state, npc, currentRecipe);
    if (progress <= npc.planProgress + 0.0001) {
      npc.planNoProgressTurns += 1;
    } else {
      npc.planNoProgressTurns = 0;
    }
    npc.planProgress = progress;
  } else {
    npc.planProgress = 0;
    npc.planNoProgressTurns = 0;
  }

  /* ---- 重规划触发条件 ---- */
  let replanReason: string | null = null;
  const ttl = GAME_CONFIG.npcPlanTtl;

  if (npc.plannedRecipeId == null || npc.planCreatedAt == null) {
    replanReason = '首次规划';
  } else if (state.time - npc.planCreatedAt >= ttl) {
    replanReason = 'TTL 过期，重新规划';
  } else if (!currentRecipe) {
    replanReason = '目标配方不存在';
  } else {
    const out = getItem(currentRecipe.outputItemId);
    if (countItem(npc, currentRecipe.outputItemId) > 0) {
      replanReason = '目标成品已拥有';
    } else if (
      (out.category === 'weapon' || out.category === 'armor') &&
      upgradeWorthless(weaponAttackOf(npc), armorDefenseOf(npc), currentRecipe.id)
    ) {
      replanReason = '已有更优装备';
    } else if (
      npc.planNoProgressTurns >= GAME_CONFIG.npcPlanNoProgressLimit &&
      !hasCurrentApexSourceForPlan(state, npc, currentRecipe) &&
      !hasCompletedApexHuntForPlan(state, npc, currentRecipe)
    ) {
      replanReason = '连续无进展';
    } else if (
      allMissingZonesRestricted(state, npc, currentRecipe) &&
      !hasCompletedApexHuntForPlan(state, npc, currentRecipe)
    ) {
      replanReason = '目标材料区域全部成为禁区';
    } else if (
      state.phase === 'finale' &&
      state.finaleStartedAt !== null &&
      npc.planCreatedAt < state.finaleStartedAt
    ) {
      replanReason = '进入终局，重新规划';
    }
  }

  if (replanReason === null) return;

  const goal = chooseNpcGoal(npc, rng);
  npc.plannedRecipeId = goal ? goal.recipeId : null;
  npc.planCreatedAt = goal ? state.time : null;
  npc.planReason = goal ? goal.reason : null;
  npc.lastReplanReason = replanReason;
  npc.planNoProgressTurns = 0;
  npc.planProgress = goal
    ? computePlanProgress(state, npc, tryGetRecipe(goal.recipeId)!)
    : 0;
  // Recommendation is part of this committed plan/replan transition. It is
  // deliberately not rebuilt on ordinary turns merely because the field is
  // null: null is valid for zone-loot, wild-drop, and Apex-only routes.
  applyNpcPlanRecommendations(state, npc, goal ? tryGetRecipe(goal.recipeId) : null);
}

/** Production planner hook for a caller that has already selected a recipe. */
export function refreshNpcPlanRecommendation(state: GameState, npc: Combatant): void {
  const recipe = npc.plannedRecipeId ? tryGetRecipe(npc.plannedRecipeId) : null;
  npc.planRecommendedZoneId = recipe ? pickRecommendedZone(state, npc, recipe) : null;
  // Explicit stale-local recovery keeps the historical refresh semantics: it
  // may move the recommendation to the newly selected landmark's zone.
  if (recipe && !PHASE4P_RECIPE_IDS.has(recipe.id)) refreshLandmarkRecommendation(state, npc, recipe);
  else npc.planRecommendedLandmarkId = null;
}
