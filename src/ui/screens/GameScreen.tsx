import { useEffect, useMemo, useRef, useState } from 'react';
import { getCraftGoalRecommendations } from '../../core/craftGuide';
import { listRecipes } from '../../core/crafting';
import { recentEvents } from '../../core/events';
import { canPayActionCost, getActionStaminaCost } from '../../core/actionCosts';
import { GAME_CONFIG } from '../../data/gameConfig';
import { listIntel, PRESENCE_TEXT, zonePresence } from '../../core/info';
import { aliveCharacters } from '../../core/gameState';
import { canAccessGroundItem } from '../../core/legalActions';
import { activeWorldEvents } from '../../core/worldEvents';
import { zoneDamagePerTick } from '../../core/restrictedZones';
import {
  SKILLS,
  canUseSkill,
  getCharacterSkills,
  isSkillReady,
} from '../../core/skills';
import type { AttackStyle, Combatant, Command, GameState } from '../../core/types';
import { LOG_DISPLAY_COUNT } from '../../data/gameConfig';
import { getZoneDef } from '../../data/zones';
import { cx, stackLabel } from '../../utils/format';
import { stackPresentation } from '../itemPresentation';
import {
  craftGoalBanner,
  getCraftGoalSuggestion,
  latestPlayerCraftFeedback,
} from '../craftPathPresentation';
import { latestPlayerSearchFeedback } from '../searchPresentation';
import { getZoneVisual } from '../visualAssets';
import { buildCombatActionBar } from '../combatActionsPresentation';
import { zoneStatusMeta } from '../zonePresentation';
import { warningRemaining, zoneUrgencyMeta } from '../zonePresentation';
import { latestInstantWorldEvent, sortWorldEvents } from '../worldEventPresentation';
import { ActionBar } from '../components/ActionBar';
import { CraftGoalBar } from '../components/CraftGoalBar';
import { CraftPanel } from '../components/CraftPanel';
import { CraftingCodex } from '../components/CraftingCodex';
import { EncounterHero } from '../components/EncounterHero';
import { EventLog, visibleEventsForPlayer } from '../components/EventLog';
import { Inventory } from '../components/Inventory';
import { PendingPickupPanel } from '../components/PendingPickupPanel';
import { PlanningDrawer } from '../components/PlanningDrawer';
import { SearchResultFeedback } from '../components/SearchResultFeedback';
import { StatusBar } from '../components/StatusBar';
import { ZoneIndicator } from '../components/ZoneIndicator';
import { MapDrawer } from '../components/MapDrawer';
import { VisualImage } from '../components/VisualImage';
import { InstantWorldEventAnnouncement, WorldEventBanner } from '../components/WorldEventFeedback';
import { detectCraftableHint } from '../craftableHint';
import { CraftableHint } from '../components/CraftableHint';
import { CraftEquipmentHint } from '../components/CraftEquipmentHint';
import {
  equipmentHandoffFor,
  shouldPromptCraftEquipment,
} from '../equipmentPresentation';

interface GameScreenProps {
  state: GameState;
  player: Combatant;
  dispatch: (command: Command) => void;
  onQuit: () => void;
}

type Tab = 'inventory' | 'craft' | 'codex';

/**
 * 对局主界面（Phase 4D-2 信息架构 + 4D-3 遭遇态并入主视觉）。
 *
 * 五块常驻：① 状态栏（生存 + 危险指示）② 地图指示器 ③ 主视觉 ④ 行动栏 + 合成目标条
 *          —— 外加中栏主视觉下的「上下文保留区」。
 *
 * 主视觉有两种状态（Phase 4D-3 §2.1）：
 * - **探索态**：只有区域背景 + 区域名 / 状态。玩家立绘已移除，玩家状态只在顶栏（§2.2）。
 * - **遭遇态**：区域背景 + **敌方立绘居中** + 敌方合法可见字段 + 一行即时反馈。
 *   遭遇不再是下方的独立面板，行动栏切换成 6 个战斗动作（§2.5）。
 *
 * 按需展开：完整六区地图、背包+装备、合成+图鉴、历史日志、本次遭遇战斗记录（§2.4）。
 * 上下文触发：情报 / 同区域存在感 / 地面掉落 / 搜索结果 / 世界事件 / 满包拾取
 *            —— 无内容时完全不渲染、不占位（首屏空态归零）。
 */
export function GameScreen({
  state,
  player,
  dispatch,
  onQuit,
}: GameScreenProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('inventory');
  const [planningOpen, setPlanningOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const mapTriggerRef = useRef<HTMLButtonElement>(null);

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
  const resolvedEncounter = Boolean(encounter?.resolved);
  const pending = state.pendingPickup;
  const visibleGroundItems = useMemo(
    () => (zoneState?.groundItems ?? []).filter((stack) => canAccessGroundItem(player, stack)),
    [player.id, zoneState?.groundItems],
  );
  const visibleCorpseGroundItems = useMemo(
    () => visibleGroundItems.filter((stack) => stack.revealedTo !== undefined),
    [visibleGroundItems],
  );

  /**
   * Phase 4D-3 §2.3：遭遇结束**不需要点击关闭**。
   * 结果作为一行即时反馈留在主视觉上，玩家的下一次行动顺带把结算态清掉 ——
   * 核心的 `resolved` 状态与 `CLOSE_ENCOUNTER` 命令都不变，
   * 变的只是「谁来派发它」：从玩家点按钮改成 UI 在下一次行动前自动补发。
   * `CLOSE_ENCOUNTER` 不推进时间，因此不影响任何结算口径。
   */
  const act = (command: Command): void => {
    if (resolvedEncounter) dispatch({ type: 'CLOSE_ENCOUNTER' });
    dispatch(command);
  };

  // Phase 4E-1 §3：点击生命 / 体力槽使用恢复道具，走既有 USE_ITEM 命令
  const handleUseItem = (uid: string): void => act({ type: 'USE_ITEM', uid });

  // 世界事件横幅（Phase 3A Step 6）：展示当前生效中的事件
  const bannerEvents = sortWorldEvents(activeWorldEvents(state));
  const instantEvent = useMemo(() => latestInstantWorldEvent(state.events), [state.events]);

  // 有待处理拾取时锁定一切；遭遇战中只锁定通用行动
  const lockedAll = Boolean(pending);
  const lockedGeneral = lockedAll || inActiveEncounter;

  // 玩家技能（主技能 + Lv.3 第二技能）：探索态也保留锁定入口，锁定原因直出文本。
  const playerSkills = getCharacterSkills(player.characterId).map((skillId) => {
    const def = SKILLS[skillId];
    const check = canUseSkill(player, skillId);
    return {
      id: skillId,
      name: def.name,
      description: def.description,
      cost: def.staminaCost,
      ready: isSkillReady(player, skillId),
      cooldown: player.skillCooldowns[skillId] ?? 0,
      usable: check.ok,
      unlocked: player.level >= def.unlockLevel,
      unlockLevel: def.unlockLevel,
      reason: check.reason,
    };
  });

  // 遭遇态共用行动栏的视图模型（Phase 4D-3 §2.5）。
  // 待处理拾取时核心只给拾取解决命令，所以那一刻不切战斗行动栏。
  const combatBar = useMemo(
    () =>
      inActiveEncounter && enemy && !pending
        ? buildCombatActionBar(state, player, enemy)
        : null,
    [inActiveEncounter, enemy, pending, state, player],
  );

  // 遭遇态（含结算态）时区域文案收成一条窄带，把主视觉让给敌方立绘
  const heroCompact = Boolean(encounter && enemy);

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
  const craftEquipmentHandoff = useMemo(
    () =>
      latestCraftFeedback
        ? equipmentHandoffFor(player, latestCraftFeedback.outputItemId)
        : null,
    [latestCraftFeedback, player],
  );
  // Phase 4D-1 改进 C：中栏常驻目标条。
  // 遭遇战进行中与待处理拾取时收起——那两个时刻中栏属于 P0，
  // 目标条再有用也不该跟主行动抢视线。
  const goalBanner = useMemo(
    () => craftGoalBanner(state, player),
    [state, player],
  );
  const logEvents = useMemo(
    () => recentEvents(state, LOG_DISPLAY_COUNT),
    [state],
  );
  const latestPlayerCorpseLoot = useMemo(
    () => visibleEventsForPlayer(state.events, state.playerId)
      .slice()
      .reverse()
      .find(
        (event) =>
          event.type === 'CHARACTER_DIED' &&
          event.actorId === state.playerId &&
          event.zoneId === player.currentZoneId &&
          Number(event.metadata.dropCount ?? 0) > 0,
      ) ?? null,
    [state.events, state.playerId, player.currentZoneId],
  );
  const encounterLootAvailable = useMemo(() => {
    if (!encounter || visibleCorpseGroundItems.length === 0) return false;
    const death = visibleEventsForPlayer(state.events, state.playerId)
      .slice()
      .reverse()
      .find(
        (event) =>
          event.type === 'CHARACTER_DIED' &&
          event.actorId === state.playerId &&
          event.targetId === encounter.enemyId &&
          event.zoneId === encounter.zoneId,
      );
    return Number(death?.metadata.dropCount ?? 0) > 0;
  }, [encounter, state.events, state.playerId, visibleCorpseGroundItems]);
  const searchFeedback = useMemo(() => latestPlayerSearchFeedback(state), [state]);

  // Phase 4E-1 改进 B：检测"新获得物品使某配方从不可做变为可做"，给出非阻塞提示。
  // 用 ref 维护上一帧快照，每次状态变化后调用纯函数 detectCraftableHint。
  const [hintRecipeId, setHintRecipeId] = useState<string | null>(null);
  const [dismissedCraftEquipmentEventId, setDismissedCraftEquipmentEventId] = useState<string | null>(null);
  const prevCraftableRef = useRef<Set<string> | null>(null);
  const prevInvRef = useRef<Record<string, number> | null>(null);
  useEffect(() => {
    const { recipeId, nextCraftableIds, nextInventory } = detectCraftableHint({
      recipeViews,
      inventory: player.inventory,
      prevCraftableIds: prevCraftableRef.current,
      prevInventory: prevInvRef.current,
      goalRecipeId: state.craftGoalRecipeId,
    });
    if (recipeId) setHintRecipeId(recipeId);
    prevCraftableRef.current = nextCraftableIds;
    prevInvRef.current = nextInventory;
  }, [state, player, recipeViews]);

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
        onUseItem={handleUseItem}
      />

      {/* ---------- 常驻地图指示器（小型） ---------- */}
      <ZoneIndicator
        state={state}
        player={player}
        disabled={lockedGeneral}
        onMove={(zoneId) => act({ type: 'MOVE', zoneId })}
        onExpand={() => setMapOpen(true)}
        triggerRef={mapTriggerRef}
      />

      {/* ---------- 中栏：主视觉 + 上下文保留区 ---------- */}
      <main className="board">
        <section
          className="panel stage scroll"
          data-stage-focus={inActiveEncounter ? 'encounter' : 'exploration'}
        >
          {!inActiveEncounter && !pending && (
            <CraftGoalBar
              banner={goalBanner}
              onOpenCraft={() => {
                setTab('craft');
                setPlanningOpen(true);
              }}
            />
          )}

          {/* 主视觉：探索态 = 区域背景；遭遇态 = 区域背景 + 敌方立绘居中（§2.1 / §2.2） */}
          <div
            className={cx(
              'zone-hero',
              `zone-hero-${zoneStatus}`,
              encounter && enemy && 'zone-hero-encounter',
              inActiveEncounter && 'zone-hero-encounter-active',
              resolvedEncounter && 'zone-hero-encounter-resolved',
            )}
            data-zone-status={zoneStatus}
            data-hero-mode={
              inActiveEncounter ? 'encounter' : resolvedEncounter ? 'encounter-resolved' : 'exploration'
            }
          >
            <VisualImage
              visual={getZoneVisual(player.currentZoneId)}
              alt={`${zoneDef.name}区域背景`}
              className="zone-hero-image"
            />
            <div className="zone-hero-scrim" aria-hidden="true" />
            <div className="zone-hero-pattern" aria-hidden="true" />
            <div className="zone-hero-content">
              {!heroCompact && (
                <div className="zone-hero-kicker">CURRENT ZONE · {player.currentZoneId.toUpperCase()}</div>
              )}
              <div className="zone-hero-heading">
                <h2>{zoneDef.name}</h2>
                <span className={`zone-hero-status status-${zoneStatus}`}>
                  <span className="zone-state-icon" aria-hidden="true">{zoneMeta.icon}</span>
                  <span>{zoneMeta.label}</span>
                </span>
                {bannerEvents.length > 0 && (
                  <div className="event-banner-wrap zone-hero-event-banners" aria-label="当前生效的世界事件">
                    {bannerEvents.map((ev) => <WorldEventBanner event={ev} compact key={ev.id} />)}
                  </div>
                )}
              </div>
              {/* 遭遇态收起区域描述这类风味文案，但危险倒计时 / 禁区侵蚀是战术信息，必须留 */}
              {!heroCompact && <p>{zoneDef.description}</p>}
              <div className={`zone-hero-state-note zone-hero-urgency-${zoneUrgency.urgency}`}>
                <span className="zone-state-icon" aria-hidden="true">{zoneMeta.icon}</span>
                {!heroCompact && <span>{zoneMeta.description}</span>}
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
                {heroCompact && zoneStatus === 'safe' && <span>{zoneMeta.label}</span>}
              </div>
            </div>

            {/* 遭遇态：主视觉本身变成遭遇（敌方立绘居中），不再有下方的独立对战窗口 */}
            {encounter && enemy && (
              <EncounterHero
                encounter={encounter}
                player={player}
                enemy={enemy}
                combat={combatBar}
                lootAvailable={encounterLootAvailable}
              />
            )}
          </div>

          {/* 上下文保留区：无内容时整段不渲染（空态归零，且不引发整页重排） */}
          <div
            className="stage-content"
            data-search-feedback={searchFeedback?.kind ?? 'none'}
          >
            <InstantWorldEventAnnouncement event={instantEvent} />

            {!inActiveEncounter && !pending &&
              latestCraftFeedback &&
              latestCraftFeedback.eventId !== dismissedCraftEquipmentEventId &&
              shouldPromptCraftEquipment(craftEquipmentHandoff) &&
              craftEquipmentHandoff && (
                <CraftEquipmentHint
                  handoff={craftEquipmentHandoff}
                  disabled={lockedAll}
                  onEquip={(uid) => dispatch({ type: 'EQUIP', uid })}
                  onDismiss={() => setDismissedCraftEquipmentEventId(latestCraftFeedback.eventId)}
                />
              )}

            {(() => {
              if (!hintRecipeId || inActiveEncounter || pending) return null;
              const view = recipeViews.find((v) => v.recipe.id === hintRecipeId);
              if (!view || !view.craftable) return null;
              return (
                <CraftableHint
                  view={view}
                  onCraft={(recipeId) => act({ type: 'CRAFT', recipeId })}
                  onDismiss={() => setHintRecipeId(null)}
                />
              );
            })()}

            {searchFeedback && (
              <SearchResultFeedback
                feedback={searchFeedback}
                player={player}
                onEquip={(uid) => dispatch({ type: 'EQUIP', uid })}
              />
            )}

            {latestPlayerCorpseLoot && visibleCorpseGroundItems.length > 0 && (
              <div className="stage-section corpse-loot-notice" aria-live="polite">
                <h4>击杀战利品</h4>
                <p>
                  {latestPlayerCorpseLoot.message} 该对手遗留的物资仍在地面，可拾取。
                </p>
              </div>
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

            {intel.length > 0 && (
              <div className="stage-section context-intel">
                <h4>情报</h4>
                <div className="intel-list scroll">
                  {intel.map((i) => (
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
                  ))}
                </div>
              </div>
            )}

            {presence !== 'none' && (
              <div className="stage-section">
                <h4>同区域</h4>
                <div className="presence">
                  <div className="presence-line">
                    <span className="who">{PRESENCE_TEXT[presence]}</span>
                  </div>
                  {/*
                    Phase 4D-3 §2.5：遭遇态由共用行动栏独占战斗动作。
                    这里的袭击 / 防御 / 脱离只在**未交手**时提供，避免与行动栏上的
                    速攻 / 普通 / 重击 / 防御 / 逃跑 / 技能重复成两套战斗入口。
                  */}
                  {!inActiveEncounter && (
                    <div className="presence-actions">
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={lockedAll}
                        onClick={() => act({ type: 'ATTACK_NEARBY', style: 'normal' })}
                        aria-label="尝试袭击同区域的未识别目标"
                      >
                        尝试袭击附近目标
                      </button>
                      <button
                        className="btn btn-sm"
                        disabled={lockedAll || !canPayActionCost(player, 'GUARD').ok}
                        onClick={() => act({ type: 'GUARD' })}
                        aria-label={`防御姿态：下一击伤害减免，消耗 ${getActionStaminaCost(player, 'GUARD')} 点体力`}
                      >
                        防御
                      </button>
                      <button
                        className="btn btn-sm"
                        disabled={lockedAll}
                        onClick={() => act({ type: 'FLEE' })}
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
            )}

            {playerSkills.length > 0 && !inActiveEncounter && (
              <div className="presence-actions" style={{ marginTop: 8 }}>
                {playerSkills.map((skill) => {
                  const status = !skill.unlocked
                    ? `Lv.${skill.unlockLevel} 解锁`
                    : skill.ready
                      ? `体力 ${skill.cost}`
                      : `冷却 ${skill.cooldown}`;
                  return (
                    <button
                      key={skill.id}
                      className="btn btn-sm"
                      data-skill-id={skill.id}
                      data-skill-locked={!skill.unlocked ? 'true' : 'false'}
                      disabled={lockedAll || !skill.usable}
                      onClick={() => act({ type: 'USE_SKILL', skillId: skill.id })}
                      aria-label={
                        !skill.unlocked
                          ? `${skill.name}：未解锁，需要达到 Lv.${skill.unlockLevel}`
                          : skill.usable
                            ? `${skill.name}：${skill.description}（消耗 ${skill.cost} 点体力）`
                            : `${skill.name}：${skill.reason ?? '当前不可用'}`
                      }
                    >
                      {skill.name}（{status}）
                    </button>
                  );
                })}
              </div>
            )}

            {visibleGroundItems.length > 0 && (
              <div className="stage-section">
                <h4>地面掉落</h4>
                <div className="ground-list">
                  {visibleGroundItems.map((stack) => (
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
                <div className="faint mono" style={{ fontSize: 11, marginTop: 6 }}>
                  拾取不消耗时间单位。
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* 共用同一条行动栏：遭遇态 6 个战斗动作 ↔ 探索态搜索 / 休息 / 移动入口（§2.5） */}
      <ActionBar
        state={state}
        player={player}
        locked={lockedGeneral}
        onSearch={() => act({ type: 'SEARCH' })}
        onRest={() => act({ type: 'REST' })}
        combat={combatBar}
        onAttack={(style: AttackStyle) => {
          if (enemy) dispatch({ type: 'ATTACK', targetId: enemy.id, style });
        }}
        onGuard={() => dispatch({ type: 'GUARD' })}
        onFlee={() => dispatch({ type: 'FLEE' })}
        onSkill={(skillId) => dispatch({ type: 'USE_SKILL', skillId })}
      />

      {/* ---------- 按需展开：规划抽屉（背包+装备 / 合成+图鉴 / 历史日志） ---------- */}
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
              id="planning-tab-inventory"
              role="tab"
              aria-selected={tab === 'inventory'}
              aria-controls="planning-tabpanel-inventory"
              className={cx(tab === 'inventory' && 'active')}
              onClick={() => setTab('inventory')}
            >
              背包·装备
            </button>
            <button
              id="planning-tab-craft"
              role="tab"
              aria-selected={tab === 'craft'}
              aria-controls="planning-tabpanel-craft"
              className={cx(tab === 'craft' && 'active')}
              onClick={() => setTab('craft')}
            >
              合成
            </button>
            <button
              id="planning-tab-codex"
              role="tab"
              aria-selected={tab === 'codex'}
              aria-controls="planning-tabpanel-codex"
              className={cx(tab === 'codex' && 'active')}
              onClick={() => setTab('codex')}
            >
              图鉴
            </button>
          </div>

          {tab === 'inventory' && (
            <div className="planning-tabpanel" role="tabpanel" id="planning-tabpanel-inventory" aria-labelledby="planning-tab-inventory">
              <Inventory
                player={player}
                disabled={lockedAll}
                onUse={(uid) => dispatch({ type: 'USE_ITEM', uid })}
                onEquip={(uid) => dispatch({ type: 'EQUIP', uid })}
                onUnequip={(slot) => dispatch({ type: 'UNEQUIP', slot })}
                onDrop={(uid) => dispatch({ type: 'DROP_ITEM', uid })}
              />
            </div>
          )}

          {tab === 'craft' && (
            <div className="planning-tabpanel" role="tabpanel" id="planning-tabpanel-craft" aria-labelledby="planning-tab-craft">
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
            </div>
          )}

          {tab === 'codex' && (
            <div className="planning-tabpanel" role="tabpanel" id="planning-tabpanel-codex" aria-labelledby="planning-tab-codex">
              <CraftingCodex
                state={state}
                player={player}
                disabled={lockedGeneral}
                onSetGoal={(recipeId) => dispatch({ type: 'SET_CRAFT_GOAL', recipeId })}
              />
            </div>
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

      {/* ---------- 按需展开：完整六区地图 ---------- */}
      <MapDrawer
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        state={state}
        player={player}
        disabled={lockedGeneral}
        freshIntelZones={freshIntelZones}
        onMove={(zoneId) => act({ type: 'MOVE', zoneId })}
        triggerRef={mapTriggerRef}
      />
    </div>
  );
}
