import { useMemo, useState } from 'react';
import { getCraftGoalRecommendations } from '../../core/craftGuide';
import { listRecipes } from '../../core/crafting';
import { recentEvents } from '../../core/events';
import { canPayActionCost, getActionStaminaCost } from '../../core/actionCosts';
import { GAME_CONFIG } from '../../data/gameConfig';
import { listIntel, PRESENCE_TEXT, zonePresence } from '../../core/info';
import { aliveCharacters } from '../../core/gameState';
import { activeWorldEvents } from '../../core/worldEvents';
import { zoneDamagePerTick } from '../../core/restrictedZones';
import {
  SKILLS,
  canUseSkill,
  getCharacterSkill,
  isSkillReady,
} from '../../core/skills';
import type { Combatant, Command, GameState } from '../../core/types';
import { LOG_DISPLAY_COUNT } from '../../data/gameConfig';
import { getZoneDef } from '../../data/zones';
import { cx, stackLabel } from '../../utils/format';
import { stackPresentation } from '../itemPresentation';
import { getCraftGoalSuggestion, latestPlayerCraftFeedback } from '../craftPathPresentation';
import { latestPlayerSearchFeedback } from '../searchPresentation';
import { getZoneVisual } from '../visualAssets';
import { zoneStatusMeta } from '../zonePresentation';
import { warningRemaining, zoneUrgencyMeta } from '../zonePresentation';
import { latestInstantWorldEvent, sortWorldEvents } from '../worldEventPresentation';
import { ActionBar } from '../components/ActionBar';
import { CraftPanel } from '../components/CraftPanel';
import { CraftingCodex } from '../components/CraftingCodex';
import { EncounterPanel } from '../components/EncounterPanel';
import { EventLog } from '../components/EventLog';
import { Inventory } from '../components/Inventory';
import { PendingPickupPanel } from '../components/PendingPickupPanel';
import { PlanningDrawer } from '../components/PlanningDrawer';
import { SearchResultFeedback } from '../components/SearchResultFeedback';
import { StatusBar } from '../components/StatusBar';
import { ZoneMap } from '../components/ZoneMap';
import { VisualImage } from '../components/VisualImage';
import { InstantWorldEventAnnouncement, WorldEventBanner } from '../components/WorldEventFeedback';

interface GameScreenProps {
  state: GameState;
  player: Combatant;
  dispatch: (command: Command) => void;
  onQuit: () => void;
}

type Tab = 'inventory' | 'craft' | 'codex';

/**
 * 世界事件横幅（Phase 3A Step 6）。
 * 图标统一取自 visualAssets 注册表（Step 11）：有图走图，没图回退 emoji。
 * `Record<WorldEventId, ...>` 保证新增事件类型时 TypeScript 强制补齐。
 */

/** 对局主界面：上状态栏 / 左地图 / 中舞台 / 右面板 / 下行动条 */
export function GameScreen({
  state,
  player,
  dispatch,
  onQuit,
}: GameScreenProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('inventory');
  const [planningOpen, setPlanningOpen] = useState(false);

  const zoneDef = getZoneDef(player.currentZoneId);
  const zoneState = state.zones[player.currentZoneId];
  const zoneStatus = zoneState?.status ?? 'safe';
  const zoneMeta = zoneStatusMeta(zoneStatus);
  const warningTimeRemaining = zoneStatus === 'warning'
    ? warningRemaining(zoneState?.warningAtTime, state.time, GAME_CONFIG.zoneWarningDuration)
    : null;
  const zoneUrgency = zoneUrgencyMeta(warningTimeRemaining);
  const alive = aliveCharacters(state);

  // 信息不完全：同区域只给"存在感"分档，精确数值只在遭遇中揭示
  const presence = zonePresence(state);

  // 最后已知位置情报（不全知：会过期、出局信息来自全场广播）
  const intel = useMemo(() => listIntel(state), [state]);
  const freshIntelZones = useMemo(
    () => new Set(intel.filter((i) => i.fresh && !i.dead).map((i) => i.zoneId)),
    [intel],
  );

  const encounter = state.encounter;
  const enemy = encounter ? (state.characters[encounter.enemyId] ?? null) : null;
  const inActiveEncounter = Boolean(encounter && !encounter.resolved && enemy?.alive);
  const pending = state.pendingPickup;

  // 世界事件横幅（Phase 3A Step 6）：展示当前生效中的事件
  const bannerEvents = sortWorldEvents(activeWorldEvents(state));
  const instantEvent = useMemo(() => latestInstantWorldEvent(state.events), [state.events]);

  // 有待处理拾取时锁定一切；遭遇战中只锁定通用行动
  const lockedAll = Boolean(pending);
  const lockedGeneral = lockedAll || inActiveEncounter;

  // 玩家专属技能（Phase 3 Step 3）：随时可用（自增益 / 治疗 / 修理）
  const playerSkillId = getCharacterSkill(player.characterId);
  const playerSkillReady = playerSkillId ? isSkillReady(player, playerSkillId) : false;
  const playerSkillUsable = playerSkillId ? canUseSkill(player, playerSkillId).ok : false;
  const playerSkillCooldown = playerSkillId ? player.skillCooldowns[playerSkillId] ?? 0 : 0;

  const recipeViews = useMemo(() => listRecipes(state, player), [state, player]);
  const craftGoalRecs = useMemo(
    () => getCraftGoalRecommendations(state, player),
    [state, player],
  );
  const craftGoalSuggestion = useMemo(
    () => getCraftGoalSuggestion(state, player),
    [state, player],
  );
  const latestCraftFeedback = useMemo(
    () => latestPlayerCraftFeedback(state, player),
    [state, player],
  );
  const logEvents = useMemo(
    () => recentEvents(state, LOG_DISPLAY_COUNT),
    [state],
  );
  const searchFeedback = useMemo(() => latestPlayerSearchFeedback(state), [state]);

  return (
    <div
      className={cx(
        'game',
        inActiveEncounter && 'game-encounter-active',
        encounter?.resolved && 'game-encounter-resolved',
      )}
      data-encounter-mode={inActiveEncounter ? 'active' : encounter?.resolved ? 'resolved' : 'none'}
    >
      <StatusBar
        state={state}
        player={player}
        aliveCount={alive.length}
        onQuit={onQuit}
      />

      <div className="board">
        {/* ---------- 左栏 ---------- */}
        <div className="col col-left">
          <ZoneMap
            state={state}
            player={player}
            disabled={lockedGeneral}
            freshIntelZones={freshIntelZones}
            onMove={(zoneId) => dispatch({ type: 'MOVE', zoneId })}
          />

          <section className="panel intel-panel">
            <div className="panel-title">
              <span>情报</span>
              <span className="faint">最后已知位置</span>
            </div>
            <div className="intel-list scroll">
              {intel.length === 0 ? (
                <div className="empty">还没有任何情报。</div>
              ) : (
                intel.map((i) => (
                  <div className="intel-item" key={i.characterId}>
                    <span className="who">
                      {i.name}
                      {i.dead ? '（已出局）' : ''}
                    </span>
                    <span className={cx(!i.fresh && !i.dead && 'stale')}>
                      {getZoneDef(i.zoneId).name}
                      {i.dead ? '' : i.fresh ? ' · 新' : ' · 陈旧'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* ---------- 中栏 ---------- */}
        <div className="col">
          <section
            className="panel stage scroll"
            data-stage-focus={inActiveEncounter ? 'encounter' : 'exploration'}
          >
            <div className={`zone-hero zone-hero-${zoneStatus}`} data-zone-status={zoneStatus}>
              <VisualImage
                visual={getZoneVisual(player.currentZoneId)}
                alt={`${zoneDef.name}区域背景`}
                className="zone-hero-image"
              />
              <div className="zone-hero-scrim" aria-hidden="true" />
              <div className="zone-hero-pattern" aria-hidden="true" />
              <div className="zone-hero-content">
                <div className="zone-hero-kicker">CURRENT ZONE · {player.currentZoneId.toUpperCase()}</div>
                <div className="zone-hero-heading">
                  <h2>{zoneDef.name}</h2>
                  <span className={`zone-hero-status status-${zoneStatus}`}>
                    <span className="zone-state-icon" aria-hidden="true">{zoneMeta.icon}</span>
                    <span>{zoneMeta.label}</span>
                  </span>
                </div>
                <p>{zoneDef.description}</p>
                <div className={`zone-hero-state-note zone-hero-urgency-${zoneUrgency.urgency}`}>
                  <span className="zone-state-icon" aria-hidden="true">{zoneMeta.icon}</span>
                  <span>{zoneMeta.description}</span>
                  {zoneStatus === 'warning' && warningTimeRemaining !== null && (
                    <strong className="zone-hero-countdown">
                      {zoneUrgency.icon} {zoneUrgency.label} · 剩余 {warningTimeRemaining} 回合
                    </strong>
                  )}
                  {zoneStatus === 'restricted' && (
                    <strong className="zone-hero-hazard">
                      ☠ 禁区侵蚀 · 每回合 −{zoneDamagePerTick(state)} 生命
                    </strong>
                  )}
                </div>
              </div>
            </div>

            <div
              className="stage-content"
              data-search-feedback={searchFeedback?.kind ?? 'none'}
            >

            <InstantWorldEventAnnouncement event={instantEvent} />

            {bannerEvents.length > 0 && (
              <div className="event-banner-wrap">
                {bannerEvents.map((ev) => <WorldEventBanner event={ev} key={ev.id} />)}
              </div>
            )}

            {searchFeedback && (
              <SearchResultFeedback
                feedback={searchFeedback}
                player={player}
                onEquip={(uid) => dispatch({ type: 'EQUIP', uid })}
              />
            )}

            {pending && (
              <PendingPickupPanel
                pending={pending}
                player={player}
                onResolve={(accept, dropUid) =>
                  dispatch({ type: 'RESOLVE_PICKUP', accept, ...(dropUid ? { dropUid } : {}) })
                }
              />
            )}

            {encounter && enemy && (
              <EncounterPanel
                state={state}
                encounter={encounter}
                player={player}
                enemy={enemy}
                onAttack={(style) => dispatch({ type: 'ATTACK', targetId: enemy.id, style })}
                onFlee={() => dispatch({ type: 'FLEE' })}
                onGuard={() => dispatch({ type: 'GUARD' })}
                onSkill={() => {
                  const sid = getCharacterSkill(player.characterId);
                  if (sid) dispatch({ type: 'USE_SKILL', skillId: sid });
                }}
                onClose={() => dispatch({ type: 'CLOSE_ENCOUNTER' })}
              />
            )}

            <div className="stage-section">
              <h4>同区域</h4>
              <div className="presence">
                <div className="presence-line">
                  <span className="who">{PRESENCE_TEXT[presence]}</span>
                </div>
                {presence !== 'none' && !inActiveEncounter && (
                  <div className="presence-actions">
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={lockedAll}
                      onClick={() => dispatch({ type: 'ATTACK_NEARBY', style: 'normal' })}
                      aria-label="尝试袭击同区域的未识别目标"
                    >
                      尝试袭击附近目标
                    </button>
                    <button
                      className="btn btn-sm"
                      disabled={lockedAll || !canPayActionCost(player, 'GUARD').ok}
                      onClick={() => dispatch({ type: 'GUARD' })}
                      aria-label={`防御姿态：下一击伤害减免，消耗 ${getActionStaminaCost(player, 'GUARD')} 点体力`}
                    >
                      防御
                    </button>
                    <button
                      className="btn btn-sm"
                      disabled={lockedAll}
                      onClick={() => dispatch({ type: 'FLEE' })}
                    >
                      脱离
                    </button>
                  </div>
                )}
              </div>
              <div className="faint mono" style={{ fontSize: 11, marginTop: 6 }}>
                未交手前无法辨认对手身份与人数；只有正在交手的对手才会暴露精确生命与武器。
              </div>
            </div>

            {playerSkillId && !inActiveEncounter && (
              <div className="presence-actions" style={{ marginTop: 8 }}>
                <button
                  className="btn btn-sm"
                  disabled={lockedAll || !playerSkillUsable}
                  onClick={() => dispatch({ type: 'USE_SKILL', skillId: playerSkillId })}
                  aria-label={
                    playerSkillReady
                      ? `${SKILLS[playerSkillId].name}：${SKILLS[playerSkillId].description}（消耗 ${SKILLS[playerSkillId].staminaCost} 点体力）`
                      : `${SKILLS[playerSkillId].name}冷却中（剩余 ${playerSkillCooldown} 回合）`
                  }
                >
                  {SKILLS[playerSkillId].name}（
                  {playerSkillReady ? `体力 ${SKILLS[playerSkillId].staminaCost}` : `冷却 ${playerSkillCooldown}`}
                  ）
                </button>
              </div>
            )}

            <div className="stage-section">
              <h4>地面掉落</h4>
              {(zoneState?.groundItems.length ?? 0) === 0 ? (
                <div className="empty">地上没有可拾取的东西。</div>
              ) : (
                <div className="ground-list">
                  {zoneState?.groundItems.map((stack) => (
                    <span className="ground-item" key={stack.uid} data-item-id={stack.itemId}>
                      <VisualImage
                        visual={stackPresentation(stack).visual}
                        alt={`${stackLabel(stack)}地面图标`}
                        className="ground-item-visual"
                      />
                      <span className="ground-item-name">{stackLabel(stack)}</span>
                      <button
                        className="btn btn-sm"
                        disabled={lockedAll}
                        onClick={() =>
                          dispatch({ type: 'PICKUP_GROUND', uid: stack.uid })
                        }
                      >
                        拾取
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="faint mono" style={{ fontSize: 11, marginTop: 6 }}>
                拾取不消耗时间单位。
              </div>
            </div>
            </div>
          </section>
        </div>

        {/* ---------- 规划 / 历史：桌面右栏，平板与手机抽屉 ---------- */}
        <PlanningDrawer
          open={planningOpen}
          onOpen={() => setPlanningOpen(true)}
          onClose={() => setPlanningOpen(false)}
        >
          <section className="panel planning-panel">
            <div className="panel-title">
              <span>规划区</span>
              <span className="faint">背包 · 合成 · 图鉴</span>
            </div>
            <div className="tabs planning-tabs" role="tablist" aria-label="规划面板">
              <button
                role="tab"
                aria-selected={tab === 'inventory'}
                className={cx(tab === 'inventory' && 'active')}
                onClick={() => setTab('inventory')}
              >
                背包
              </button>
              <button
                role="tab"
                aria-selected={tab === 'craft'}
                className={cx(tab === 'craft' && 'active')}
                onClick={() => setTab('craft')}
              >
                合成
              </button>
              <button
                role="tab"
                aria-selected={tab === 'codex'}
                className={cx(tab === 'codex' && 'active')}
                onClick={() => setTab('codex')}
              >
                图鉴
              </button>
            </div>

            {tab === 'inventory' && (
              <Inventory
                player={player}
                disabled={lockedAll}
                onUse={(uid) => dispatch({ type: 'USE_ITEM', uid })}
                onEquip={(uid) => dispatch({ type: 'EQUIP', uid })}
                onUnequip={(slot) => dispatch({ type: 'UNEQUIP', slot })}
                onDrop={(uid) => dispatch({ type: 'DROP_ITEM', uid })}
              />
            )}

            {tab === 'craft' && (
              <CraftPanel
                views={recipeViews}
                state={state}
                player={player}
                disabled={lockedGeneral}
                goalRecipeId={state.craftGoalRecipeId}
                goalCompleted={state.craftGoalCompleted}
                recommendations={craftGoalRecs}
                onSetGoal={(recipeId) =>
                  dispatch({ type: 'SET_CRAFT_GOAL', recipeId })
                }
                onCraft={(recipeId) => dispatch({ type: 'CRAFT', recipeId })}
                suggestion={craftGoalSuggestion}
                latestCraftFeedback={latestCraftFeedback}
                onEquip={(uid) => dispatch({ type: 'EQUIP', uid })}
              />
            )}

            {tab === 'codex' && (
              <CraftingCodex
                state={state}
                player={player}
                disabled={lockedGeneral}
                onSetGoal={(recipeId) => dispatch({ type: 'SET_CRAFT_GOAL', recipeId })}
              />
            )}

          </section>
          <section className="panel log-panel">
            <div className="panel-title">
              <span>历史日志</span>
              <span className="faint">最近 {logEvents.length} 条</span>
            </div>
            <EventLog events={logEvents} playerId={state.playerId} />
          </section>
        </PlanningDrawer>
      </div>

      <ActionBar
        state={state}
        player={player}
        locked={lockedGeneral}
        onSearch={() => dispatch({ type: 'SEARCH' })}
        onRest={() => dispatch({ type: 'REST' })}
      />
    </div>
  );
}
