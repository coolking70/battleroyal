import { nextZoneCountdown } from '../../core/restrictedZones';
import type { Combatant, GameState } from '../../core/types';
import { hasExposed, EXPOSED_LABEL } from '../../core/exposed';
import { totalAttack, totalDefense } from '../../core/inventory';
import { getCharacterDef } from '../../data/characters';
import { getZoneDef } from '../../data/zones';
import { getCharacterVisual } from '../visualAssets';
import { resolveCharacterVisualState } from '../characterVisualState';
import { zoneStatusMeta } from '../zonePresentation';
import { Bar } from './Bar';
import { VisualImage } from './VisualImage';

interface StatusBarProps {
  state: GameState;
  player: Combatant;
  aliveCount: number;
  onQuit: () => void;
}

/** 顶部状态栏：时间 / 存活人数 / 生命 / 体力 / 禁区倒计时 */
export function StatusBar({
  state,
  player,
  aliveCount,
  onQuit,
}: StatusBarProps): JSX.Element {
  const countdown = nextZoneCountdown(state);
  const zone = state.zones[player.currentZoneId];
  const zoneName = getZoneDef(player.currentZoneId).name;
  const characterVisualState = resolveCharacterVisualState(player, {
    activeEncounter: Boolean(state.encounter && !state.encounter.resolved),
  });

  const zoneStatus = zone?.status ?? 'safe';
  const zoneMeta = zoneStatusMeta(zoneStatus);
  let alert: { text: string; danger: boolean } | null = null;
  if (zone?.status === 'restricted') {
    alert = { text: `${zoneName} 已是禁区 · 每回合 -20 生命`, danger: true };
  } else if (zone?.status === 'warning') {
    alert = { text: `${zoneName} 即将封锁 · 尽快撤离`, danger: false };
  } else if (countdown !== null && countdown <= 2) {
    alert = { text: `${countdown} 时间单位后公布新禁区`, danger: false };
  }

  return (
    <header className="topbar">
      <div className="topbar-brand-block">
        <span className="brand">区域大逃杀</span>
        <span className="topbar-context">生存状态</span>
      </div>

      <div className="survival-metrics" aria-label="生存资源">
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
      </div>

      <div className="run-metrics">
        <span className="stat">时间 <b>{state.time}</b></span>
        <span className="stat">存活 <b>{aliveCount}</b>/{state.turnOrder.length}</span>
        <span className="stat">攻 <b>{totalAttack(player)}</b> / 防 <b>{totalDefense(player)}</b></span>
      </div>

      <div className={`topbar-danger topbar-danger-${zoneStatus}${alert?.danger ? ' is-critical' : ''}`}>
        <span className="zone-state-icon" aria-hidden="true">{zoneMeta.icon}</span>
        <span className="topbar-danger-copy">
          <b>{zoneName} · {zoneMeta.label}</b>
          <span>{alert?.text ?? (countdown !== null ? `下次禁区 T+${countdown}` : zoneMeta.description)}</span>
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
    </header>
  );
}
