import { nextZoneCountdown } from '../../core/restrictedZones';
import type { Combatant, GameState } from '../../core/types';
import { totalAttack, totalDefense } from '../../core/inventory';
import { getCharacterDef } from '../../data/characters';
import { getZoneDef } from '../../data/zones';
import { Bar } from './Bar';

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
      <span className="brand">区域大逃杀</span>

      <span className="stat">
        时间 <b>{state.time}</b>
      </span>
      <span className="stat">
        存活 <b>{aliveCount}</b>/{state.turnOrder.length}
      </span>

      <span className="stat">
        生命
        <Bar value={player.hp} max={player.maxHp} kind="hp" />
        <b>
          {player.hp}/{player.maxHp}
        </b>
      </span>
      <span className="stat">
        体力
        <Bar value={player.stamina} max={player.maxStamina} kind="stamina" />
        <b>
          {player.stamina}/{player.maxStamina}
        </b>
      </span>

      <span className="stat">
        攻 <b>{totalAttack(player)}</b> / 防 <b>{totalDefense(player)}</b>
      </span>

      <span className="spacer" />

      {alert && (
        <span className={`zone-alert${alert.danger ? ' danger' : ''}`}>
          {alert.text}
        </span>
      )}
      {!alert && countdown !== null && (
        <span className="stat faint">下次禁区 T+{countdown}</span>
      )}
      {countdown === null && <span className="stat faint">禁区已停止扩张</span>}

      <span className="stat faint">
        <span className="badge badge-you">你</span>{' '}
        {getCharacterDef(player.characterId).name} · {state.seed}
      </span>

      <button className="btn btn-sm btn-danger" onClick={onQuit}>
        退出
      </button>
    </header>
  );
}
