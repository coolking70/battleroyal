import {
  attackActor,
  craftActor,
  fleeActor,
  guardActor,
  moveActor,
  resolveNpcOverflow,
  restActor,
  searchActor,
  searchLandmarkActor,
  interactFacilityActor,
  useItemActor,
  useSkillActor,
} from './actorActions';
import { pushEvent } from './events';
import { noteOwnActionCompleted } from './exposed';
import type { SkillId } from './skills';
import { decideNpcAction, planNpcGoal, type NpcDecision } from './npcDecide';
import { refreshNpcPlanRecommendation } from './npcGoalPlan';
import type { SeededRandom } from './random';
import type { AttackStyle, Combatant, GameState } from './types';
import { attackWildActor, fleeWildEncounter, resolveWildTurn } from './wildCombat';
import { performObjectiveAction } from './victory';
import { deriveNpcVictoryGoal } from './npcVictoryGoal';
import { tryGetRecipe } from '../data/recipes';
import { applyNpcPlanRecommendations } from './npcPlanRecommendation';
import { canSearchLandmark } from './landmarks';
import { syncNpcExplorationObjective } from './accessChains';
import { preserveExplorationObjectiveAfterPlan } from './npcObjectiveLifecycle';
import { maintainStrategicIntent } from './npcStrategicIntent';
import { observeActorSighting } from './npcKnowledge';
import { observeIncidentsInZone } from './incidentVisibility';
import { resolveIncidentActor } from './incidentEffects';
import { autoEquipNpc, autoLootNpc } from './npcInventoryMaintenance';

/* 决策相关 API 由 npcDecide.ts 提供，这里统一再导出，保持对外契约不变 */
export { decideNpcAction } from './npcDecide';
export type { NpcActionKind, NpcDecision } from './npcDecide';

/* ------------------------------------------------------------------ */
/* 执行                                                                */
/* ------------------------------------------------------------------ */

/** 执行一个 NPC 的一次行动 */
export function runNpcTurn(
  state: GameState,
  npc: Combatant,
  rng: SeededRandom,
): NpcDecision {
  if (!npc.alive || state.status !== 'playing') {
    return { kind: 'idle', reason: '无法行动' };
  }

  // 胜利意图属于正式 NPC 行为的一部分：首次行动时按 seed / 人格稳定激活，
  // 不让它改变旧的纯 chooseNpcGoal / planNpcGoal 调用者的默认评分。
  if (npc.victoryGoal === null) {
    npc.victoryGoal = deriveNpcVictoryGoal(state, npc);
    npc.victoryGoalMode = 'derived';
  }
  if (npc.victoryGoalMode === 'derived' && state.phase === 'finale') {
    npc.victoryGoalMode = 'explicit';
  }

  // 出手前先解除上一回合的防御姿态（防御只挡一次攻击）
  npc.guarding = false;

  // 免费动作
  autoEquipNpc(state, npc);
  autoLootNpc(state, npc);

  // 第二阶段：每回合按 TTL 维护 / 重规划 NPC 的制作目标
  // Phase 2A-1：随机型人格在规划时使用种子随机数（与对局同一 RNG 流隔离在调用方）
  const committedRecipeId = npc.plannedRecipeId;
  const committedExplorationObjective = npc.explorationObjective;
  planNpcGoal(state, npc, rng);
  preserveExplorationObjectiveAfterPlan(state, npc, committedRecipeId, committedExplorationObjective);
  // Commit an explicit gameplay recipe's access recommendation once.
  if (npc.plannedRecipeId && npc.planCreatedAt === state.time
    && npc.planRecommendedZoneId === null && npc.explorationObjective === null) {
    applyNpcPlanRecommendations(state, npc, tryGetRecipe(npc.plannedRecipeId), true);
  }
  // Refresh stale local landmarks only when the NPC is actually there.
  if (npc.planRecommendedLandmarkId) {
    const landmark = state.landmarks[npc.planRecommendedLandmarkId];
    if (landmark?.zoneId === npc.currentZoneId && !canSearchLandmark(state, npc.id, npc.planRecommendedLandmarkId).ok) {
      refreshNpcPlanRecommendation(state, npc);
    }
  }
  if (npc.explorationObjective) {
    const objective = syncNpcExplorationObjective(state, npc, npc.explorationObjective.targetLandmarkId);
    npc.planRecommendedLandmarkId = objective?.nextLandmarkId ?? npc.planRecommendedLandmarkId;
    const nextRuntime = npc.planRecommendedLandmarkId ? state.landmarks[npc.planRecommendedLandmarkId] : null;
    if (nextRuntime) npc.planRecommendedZoneId = nextRuntime.zoneId;
  }

  // The existing tactical resolver already sees contestants in the current
  // zone. Persist only a coarse local sighting before intent maintenance;
  // actors in every other zone remain untouched and cannot be tracked.
  for (const localActor of Object.values(state.characters)
    .filter((candidate) => candidate.id !== npc.id && candidate.alive
      && candidate.currentZoneId === npc.currentZoneId)
    .sort((a, b) => a.id.localeCompare(b.id))) {
    observeActorSighting(state, npc, localActor, 'DIRECT_LOCAL');
  }

  // Phase 4T: a legal local revisit refreshes incident memory from the live
  // authoritative state before planning/deciding.
  observeIncidentsInZone(state, npc);

  // Phase 4S intent is only a coarse planner context. Meaningful lifecycle
  // transitions may ask the existing recipe/source planner to refresh, but
  // the intent never emits MOVE/SEARCH/ATTACK or mutates world runtime.
  const wasAvoidingThreat = npc.strategicIntent?.type === 'avoid_threat';
  const intentMaintenance = maintainStrategicIntent(state, npc);
  if (npc.plannedRecipeId && (wasAvoidingThreat || intentMaintenance.intent?.type === 'avoid_threat'
    || intentMaintenance.intent?.type === 'respond_to_incident')
    && ['COMMIT', 'COMPLETE', 'INVALIDATE'].includes(intentMaintenance.lifecycle)) {
    refreshNpcPlanRecommendation(state, npc);
  }

  // Scout 的 SEARCH 先手只覆盖敌方紧接着的这一次 NPC 行动机会。
  // 在决策前捕获目标，行动结束后统一消费；这样 attack / guard / heal /
  // use_skill / flee / rest / craft / search / move 都不会把标记拖成长效状态。
  const reconResponseEncounter =
    state.encounter?.reconInitiative === true && state.encounter.enemyId === npc.id;

  const decision = decideNpcAction(state, npc, rng);
  npc.lastAction = decision.kind;
  npc.lastActionReason = decision.reason;

  // 决策被规则层驳回（体力不够、目标跑了、区域不相邻……）时的兜底。
  // NPC 与玩家共享「永远存在一个免费且推进时间的出口」这条不变量：
  // 玩家是 REST / FLEE，NPC 这里退化成 REST，绝不空转一个时间单位。
  let rejected: string | null = null;
  const fallbackToRest = (reason: string): void => {
    rejected = reason;
    restActor(state, npc);
    npc.lastAction = 'rest';
    npc.lastActionReason = `${decision.reason}（${reason}，改为休整）`;
  };

  switch (decision.kind) {
    case 'evacuate':
    case 'move': {
      const target = decision.zoneId;
      if (!target) break;
      // 统一行动服务：相邻性 + 存在性 + 体力闸门，与玩家完全同一套
      const res = moveActor(state, npc, target);
      if (!res.ok) fallbackToRest(res.message);
      break;
    }

    case 'heal': {
      if (decision.uid) useItemActor(state, npc, decision.uid);
      break;
    }

    case 'rest': {
      restActor(state, npc);
      break;
    }

    case 'craft': {
      if (decision.recipeId) craftActor(state, npc, decision.recipeId);
      autoEquipNpc(state, npc);
      break;
    }

    case 'call_extraction':
    case 'extract':
    case 'submit_research': {
      const res = performObjectiveAction(state, npc, decision.kind === 'call_extraction'
        ? 'CALL_EXTRACTION'
        : decision.kind === 'extract'
          ? 'EXTRACT'
          : 'SUBMIT_RESEARCH');
      if (!res.ok) fallbackToRest(res.message);
      if (res.ok && state.status !== 'playing' && decision.kind !== 'call_extraction') {
        // EXTRACT / SUBMIT_RESEARCH emit the complete terminal event sequence.
        // Keep GAME_ENDED as the last event and do not append NPC_ACTION,
        // clear recon state, or mark another post-action mutation afterward.
        return decision;
      }
      break;
    }

    case 'search': {
      const res = searchActor(state, npc, rng);
      if (!res.ok) {
        fallbackToRest(res.message);
        break;
      }
      const outcome = res.outcome;
      if (outcome?.kind === 'item' && outcome.pending) {
        // 背包已满：NPC 不能弹窗，按价值自动取舍（物品必落地，不蒸发）
        resolveNpcOverflow(state, npc, outcome.stack);
      }
      if (outcome?.kind === 'enemy') {
        // ⚠️ Phase 2A 修正：这里原本立即调用 `resolveNpcEngagement`，
        // 让 NPC 在「搜索」这一个行动里白赚一次攻击。玩家搜索撞见敌人时
        // 只会进入遭遇状态、必须再花一个行动才能出手，规则并不对等。
        //
        // 现在统一为：**遭遇 ≠ 开打**。撞见只登记为"已知敌人"，
        // 想动手就得在下一个行动里正式选择攻击——玩家与 NPC 一致。
        const enemy = state.characters[outcome.enemyId];
        if (enemy && enemy.alive && !npc.knownEnemies.includes(enemy.id)) {
          npc.knownEnemies.push(enemy.id);
        }
      }
      autoEquipNpc(state, npc);
      break;
    }

    case 'search_landmark': {
      const res = decision.landmarkId ? searchLandmarkActor(state, npc, decision.landmarkId, rng) : { ok: false, message: '缺少地标目标。', outcome: null, staminaSpent: 0 };
      if (!res.ok) {
        refreshNpcPlanRecommendation(state, npc);
        fallbackToRest(res.message);
        break;
      }
      (state.stats.npcLandmarkSearches ??= 0);
      state.stats.npcLandmarkSearches += 1;
      if (res.outcome?.kind === 'item' && res.outcome.stack && res.outcome.pending) resolveNpcOverflow(state, npc, res.outcome.stack);
      if (res.outcome?.kind === 'enemy') {
        (state.stats.landmarkWildEncounters ??= 0);
        state.stats.landmarkWildEncounters += 1;
      }
      autoEquipNpc(state, npc);
      break;
    }

    case 'interact_landmark': {
      const res = decision.landmarkId && decision.interactionId
        ? interactFacilityActor(state, npc, decision.landmarkId, decision.interactionId)
        : { ok: false, message: '缺少局部设施目标。', staminaSpent: 0, rejection: 'illegal_target' as const };
      if (!res.ok) {
        refreshNpcPlanRecommendation(state, npc);
        fallbackToRest(res.message);
        break;
      }
      autoEquipNpc(state, npc);
      break;
    }

    case 'resolve_incident': {
      if (!decision.incidentId) break;
      const res = resolveIncidentActor(state, npc, decision.incidentId, rng);
      if (!res.ok) {
        fallbackToRest(res.message);
        break;
      }
      autoEquipNpc(state, npc);
      break;
    }

    case 'attack': {
      if (decision.targetKind === 'wild' && decision.targetId) {
        const res = attackWildActor(state, npc, decision.targetId, rng, decision.attackStyle ?? 'normal', true);
        if (!res.ok) fallbackToRest(res.message);
        break;
      }
      const target = decision.targetId ? state.characters[decision.targetId] : null;
      // Phase 3A-1：警觉先手 —— 敌方在「遭遇建立瞬间」的首次立即攻击被抑制
      // （只抑制这一次；玩家的正常攻击 / 反击完全不受影响）。
      const enc = state.encounter;
      if (
        reconResponseEncounter &&
        enc &&
        enc.reconInitiative &&
        enc.enemyId === npc.id &&
        target?.isPlayer &&
        target.alive
      ) {
        enc.log.push(`${npc.name}因你的警觉先手谨慎观望，没有立即出手。`);
        guardActor(state, npc);
        npc.lastAction = 'guard';
        npc.lastActionReason = `${decision.reason}（警觉先手，转为防御观望）`;
        break;
      }
      if (target && target.alive) {
        const res = resolveNpcEngagement(
          state,
          npc,
          target,
          rng,
          decision.attackStyle ?? 'normal',
        );
        // 零体力打不出攻击：与玩家一样，必须先休整
        if (!res.ok && res.rejection === 'no_stamina') fallbackToRest(res.message);
      }
      break;
    }

    case 'guard': {
      guardActor(state, npc);
      if (decision.targetKind === 'wild' && decision.targetId) {
        const wild = state.wildEnemies[decision.targetId];
        if (wild?.status === 'alive') resolveWildTurn(state, npc, wild, rng);
      }
      break;
    }

    case 'use_skill': {
      if (decision.skillId) useSkillActor(state, npc, decision.skillId as SkillId, rng);
      break;
    }

    case 'flee_combat': {
      if (decision.targetKind === 'wild' && decision.targetId) {
        const wild = state.wildEnemies[decision.targetId];
        if (wild) fleeWildEncounter(state, npc, wild, rng);
        break;
      }
      const enemy = decision.targetId ? state.characters[decision.targetId] : null;
      if (enemy) {
        // 脱离是免费行动，NPC 同样永远付得起。
        // ⚠️ Phase 2A 修正：这里原本传 `allowPursuit: false`，
        // 等于"NPC 逃跑永不被追击、玩家逃跑必被追击"。追击是逃跑失败的代价，
        // 必须对所有角色一视同仁，否则玩家白白多挨一轮伤害。
        const res = fleeActor(state, npc, enemy, rng, { allowPursuit: true });
        // 玩家追击成功时，把结果写进遭遇日志，让玩家看得见自己的收益
        if (res.ok && res.pursued && enemy.isPlayer && state.encounter) {
          state.encounter.log.push(res.message);
          state.encounter.resolved = !npc.alive;
        }
      }
      break;
    }

    case 'idle':
    default:
      break;
  }

  if (rejected) {
    pushEvent(state, {
      type: 'NPC_ACTION',
      actorId: npc.id,
      zoneId: npc.currentZoneId,
      message: `${npc.name} 的「${decision.kind}」被规则驳回：${rejected}`,
      metadata: { kind: decision.kind, rejected: true, reason: rejected },
    });
  }

  pushEvent(state, {
    type: 'NPC_ACTION',
    actorId: npc.id,
    zoneId: npc.currentZoneId,
    message: `${npc.name}（${npc.lastAction}）：${npc.lastActionReason}`,
    metadata: { kind: npc.lastAction, reason: npc.lastActionReason },
  });

  // Phase 3A：NPC 侧的「有效行动完成」收口点。EXPOSED 条件B（一直没挨打，
  // 就靠自己下一次行动调整过来）在这里结算，与玩家侧 `executeCommand` 的
  // finish 共用同一个函数，保证规则只有一份实现。idle 不算有效行动。
  if (npc.lastAction !== 'idle') noteOwnActionCompleted(state, npc);

  // 必须在整次 NPC 行动机会结束后消费，而不是只在 attack 分支清除。
  if (reconResponseEncounter && state.encounter?.enemyId === npc.id) {
    state.encounter.reconInitiative = false;
  }

  return decision;
}

/**
 * NPC 发起的一次交手。
 *
 * 攻击本身完全走 `attackActor`（统一体力闸门 + 同区域校验 + 反击对称）。
 * 这里只额外处理"目标是玩家"这一 **UI 概念**：把交手写进 `encounter`，
 * 让玩家界面进入遭遇状态。
 *
 * ⚠️ Phase 2A 修正：`allowCounter` 不再区分目标是不是玩家。
 * 旧实现传 `!target.isPlayer`，等于"玩家挨打永不还手"——玩家是全场唯一
 * 享受不到反击的角色，实测受伤 2 倍于 NPC、输出仅 0.27 倍，
 * 5 种策略胜率全部 ≤1%。反击是被动结算，不占玩家的行动回合，
 * 因此开启它不会削弱"玩家自己决定下一步"的设计。
 */
function resolveNpcEngagement(
  state: GameState,
  npc: Combatant,
  target: Combatant,
  rng: SeededRandom,
  style: AttackStyle = 'normal',
): ReturnType<typeof attackActor> {
  const res = attackActor(state, npc, target, rng, { allowCounter: true, style });
  if (!res.ok) return res;

  if (target.isPlayer) {
    // 让玩家界面进入遭遇状态，玩家下一步自行决定
    if (!state.encounter || state.encounter.enemyId !== npc.id) {
      state.encounter = {
        targetKind: 'contestant',
        enemyId: npc.id,
        zoneId: target.currentZoneId,
        startedAtTime: state.time,
        log: [],
        resolved: false,
      };
    }
    // res.message 已经把反击文本拼在后面，玩家能看到自己是怎么还手的
    state.encounter.log.push(res.message);
    state.encounter.resolved = !npc.alive || !target.alive;
  }
  return res;
}
