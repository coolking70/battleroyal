import { useRef, useState, type RefObject } from 'react';
import { nextZoneCountdown } from '../../core/restrictedZones';
import { zoneDamagePerTick } from '../../core/restrictedZones';
import { GAME_CONFIG } from '../../data/gameConfig';
import type { Combatant, GameState } from '../../core/types';
import { hasExposed, EXPOSED_LABEL } from '../../core/exposed';
import { totalAttack, totalDefense } from '../../core/inventory';
import { getCharacterDef } from '../../data/characters';
import { getZoneDef } from '../../data/zones';
import { getCharacterVisual } from '../visualAssets';
import { resolveCharacterVisualState } from '../characterVisualState';
import { latestPlayerHazardFeedback, warningRemaining, zoneStatusMeta, zoneUrgencyMeta } from '../zonePresentation';
import { Bar } from './Bar';
import { VisualImage } from './VisualImage';
import { QuickRestoreMenu } from './QuickRestoreMenu';
import { decideQuickRestore, type RestoreSlot } from '../quickRestore';
import { GrowthProgress } from './GrowthProgress';

interface StatusBarProps {
  state: GameState;
  player: Combatant;
  aliveCount: number;
  onQuit: () => void;
  /** Phase 4E-1 §3：点击生命 / 体力槽使用恢复道具；走既有 USE_ITEM 命令 */
  onUseItem?: (uid: string) => void;
}

interface VitalMetricProps {
  kind: 'hp' | 'stamina';
  label: string;
  value: number;
  max: number;
  buttonRef: RefObject<HTMLButtonElement>;
  onActivate: () => void;
}

/** 整个视觉框都是触发器；内部 Bar 保持纯展示，避免留下细长点击条。 */
function VitalMetric({ kind, label, value, max, buttonRef, onActivate }: VitalMetricProps): JSX.Element {
  return (
    <div className={`survival-metric survival-metric-${kind} vital-metric-shell`}>
      <button
        type="button"
        ref={buttonRef}
        className="bar-button vital-metric-button"
        onClick={onActivate}
        aria-label={`点击使用恢复道具恢复${label}（当前 ${value}/${max}）`}
      >
        <span className="metric-label">{label}</span>
        <Bar value={value} max={max} kind={kind} />
        <b>{value}/{max}</b>
      </button>
    </div>
  );
}

/** 顶部状态栏：时间 / 存活人数 / 生命 / 体力 / 禁区倒计时 */
export function StatusBar({
  state,
  player,
  aliveCount,
  onQuit,
  onUseItem,
}: StatusBarProps): JSX.Element {
  const countdown = nextZoneCountdown(state);
  const zone = state.zones[player.currentZoneId];
  const zoneName = getZoneDef(player.currentZoneId).name;
  const characterVisualState = resolveCharacterVisualState(player, {
    activeEncounter: Boolean(state.encounter && !state.encounter.resolved),
  });

  // Phase 4E-1 §3：点击槽位后的小型选择窗；null 表示未打开
  const [restoreSlot, setRestoreSlot] = useState<RestoreSlot | null>(null);
  const hpRef = useRef<HTMLButtonElement>(null);
  const staminaRef = useRef<HTMLButtonElement>(null);

  const handleBarActivate = (slot: RestoreSlot): void => {
    if (!onUseItem) return;
    const decision = decideQuickRestore(player, slot);
    if (decision.mode === 'auto' && decision.autoUid) {
      onUseItem(decision.autoUid);
    } else {
      setRestoreSlot(slot);
    }
  };

  const zoneStatus = zone?.status ?? 'safe';
  const zoneMeta = zoneStatusMeta(zoneStatus);
  const warningTimeRemaining = zoneStatus === 'warning'
    ? warningRemaining(zone?.warningAtTime, state.time, GAME_CONFIG.zoneWarningDuration)
    : null;
  const zoneUrgency = zoneUrgencyMeta(warningTimeRemaining);
  const hazardFeedback = latestPlayerHazardFeedback(state.events, state.playerId, state.time);
  let alert: { text: string; danger: boolean } | null = null;
  if (zone?.status === 'restricted') {
    alert = { text: `${zoneName} 已是禁区 · 每回合 -${zoneDamagePerTick(state)} 生命`, danger: true };
  } else if (zone?.status === 'warning') {
    alert = {
      text: `${zoneName} ${zoneUrgency.label} · 剩余 ${warningTimeRemaining ?? 0} 回合`,
      danger: warningTimeRemaining === 0,
    };
  } else if (countdown !== null && countdown <= 2) {
    alert = { text: `${countdown} 时间单位后公布新禁区`, danger: false };
  }

  return (
    <header className="topbar">
      <div className="topbar-brand-block">
        <span className="brand">区域大逃杀</span>
        <span className="topbar-context">生存状态</span>
      </div>

      <div className="survival-metrics" aria-label="生存资源与成长">
        {onUseItem ? (
          <>
            <VitalMetric
              kind="hp"
              label="生命"
              value={player.hp}
              max={player.maxHp}
              buttonRef={hpRef}
              onActivate={() => handleBarActivate('hp')}
            />
            <VitalMetric
              kind="stamina"
              label="体力"
              value={player.stamina}
              max={player.maxStamina}
              buttonRef={staminaRef}
              onActivate={() => handleBarActivate('stamina')}
            />
          </>
        ) : (
          <>
            <div className="survival-metric survival-metric-hp">
              <span className="metric-label">生命</span>
              <Bar value={player.hp} max={player.maxHp} kind="hp" />
              <b>{player.hp}/{player.maxHp}</b>
            </div>
            <div className="survival-metric survival-metric-stamina">
              <span className="metric-label">体力</span>
              <Bar value={player.stamina} max={player.maxStamina} kind="stamina" />
              <b>{player.stamina}/{player.maxStamina}</b>
            </div>
          </>
        )}
        <GrowthProgress player={player} />
      </div>

      <div className="run-metrics">
        <span className="stat">时间 <b>{state.time}</b></span>
        <span className="stat">存活 <b>{aliveCount}</b>/{state.turnOrder.length}</span>
        <span className="stat">攻 <b>{totalAttack(player)}</b> / 防 <b>{totalDefense(player)}</b></span>
      </div>

      <div
        className={`topbar-danger topbar-danger-${zoneStatus}${alert?.danger ? ' is-critical' : ''} topbar-zone-urgency-${zoneUrgency.urgency}`}
        data-zone-urgency={zoneUrgency.urgency}
        data-zone-hazard-feedback={hazardFeedback?.eventId ?? 'none'}
      >
        <span className="zone-state-icon" aria-hidden="true">{zoneMeta.icon}</span>
        <span className="topbar-danger-copy">
          <b>{zoneName} · {zoneMeta.label}</b>
          <span>{alert?.text ?? (countdown !== null ? `下次禁区 T+${countdown}` : zoneMeta.description)}</span>
          {hazardFeedback && (
            <span className="topbar-hazard-feedback" role="status">
              <span aria-hidden="true">↘</span> {hazardFeedback.source} −{hazardFeedback.damage} 生命
            </span>
          )}
        </span>
      </div>

      {state.encounter && (
        <div className={`topbar-encounter-cue${state.encounter.resolved ? ' is-resolved' : ''}`}>
          <span className="combat-cue-icon" aria-hidden="true">{state.encounter.resolved ? '✓' : '⚔'}</span>
          <span>{state.encounter.resolved ? '遭遇已结束' : '遭遇战进行中'}</span>
        </div>
      )}

      <span className="spacer" />

      <div className="player-chip">
        <span className="badge badge-you">你</span>
        <VisualImage
          visual={getCharacterVisual(player.characterId, characterVisualState)}
          alt={`${getCharacterDef(player.characterId).name}头像`}
          className="status-visual"
        />
        <span>{getCharacterDef(player.characterId).name}</span>
        {player.guarding && <span className="tag tag-guard">防御</span>}
        {hasExposed(player) && <span className="tag tag-exposed">{EXPOSED_LABEL}</span>}
        <span className="faint mono seed-chip">{state.seed}</span>
      </div>

      <button className="btn btn-sm btn-danger" onClick={onQuit}>退出</button>

      {restoreSlot && onUseItem && (
        <QuickRestoreMenu
          player={player}
          slot={restoreSlot}
          triggerRef={restoreSlot === 'hp' ? hpRef : staminaRef}
          onUse={(uid) => {
            onUseItem(uid);
            setRestoreSlot(null);
          }}
          onClose={() => setRestoreSlot(null)}
        />
      )}
    </header>
  );
}
