import { areAdjacent, getZoneDef, ZONES } from '../../data/zones';
import { GAME_CONFIG } from '../../data/gameConfig';
import { noiseLevelOf, NOISE_LABEL } from '../../core/info';
import { zoneDamagePerTick } from '../../core/restrictedZones';
import type { Combatant, GameState } from '../../core/types';
import { cx } from '../../utils/format';
import { getZoneVisual } from '../visualAssets';
import { warningRemaining, zoneStatusMeta, zoneUrgencyMeta } from '../zonePresentation';
import { VisualImage } from './VisualImage';

interface ZoneIndicatorProps {
  state: GameState;
  player: Combatant;
  disabled: boolean;
  onMove: (zoneId: string) => void;
  onExpand: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement>;
}

/**
 * 小型常驻地图指示器（Phase 4D-2）。
 *
 * 只表达：当前区域 + 相邻可移动区域 + 警告/禁区状态。
 * 点击「地图」或当前区域展开完整六区地图（MapDrawer），展开后信息无损。
 * 不泄露远处地面库存、NPC 位置等未发现信息（与 4B-1 / 4C-9 一致）。
 */
export function ZoneIndicator({
  state,
  player,
  disabled,
  onMove,
  onExpand,
  triggerRef,
}: ZoneIndicatorProps): JSX.Element {
  const currentZoneId = player.currentZoneId;
  const currentStatus = state.zones[currentZoneId]?.status ?? 'safe';
  const currentVisual = getZoneVisual(currentZoneId);
  const currentMeta = zoneStatusMeta(currentStatus);

  const adjacent = ZONES.filter(
    (def) => def.id !== currentZoneId && areAdjacent(currentZoneId, def.id),
  );

  return (
    <nav className="zone-rail" aria-label="区域地图指示器">
      <button
        type="button"
        className="zone-rail-current"
        disabled={disabled}
        onClick={onExpand}
        aria-label={`当前区域：${getZoneDef(currentZoneId).name}（${currentMeta.label}），点击展开完整六区地图`}
      >
        <VisualImage visual={currentVisual} alt="" className="zone-rail-current-visual" />
        <span className="zone-rail-current-name">{getZoneDef(currentZoneId).name}</span>
        <span className={`zone-state-cue cue-${currentStatus}`}>
          <span className="zone-state-icon" aria-hidden="true">{currentMeta.icon}</span>
          <span>{currentMeta.label}</span>
        </span>
      </button>

      <div className="zone-rail-adjacent" role="group" aria-label="相邻可移动区域">
        {adjacent.map((def) => {
          const status = state.zones[def.id]?.status ?? 'safe';
          const meta = zoneStatusMeta(status);
          const visual = getZoneVisual(def.id);
          const noise = noiseLevelOf(state.zones[def.id]);
          const warningTimeRemaining = status === 'warning'
            ? warningRemaining(state.zones[def.id]?.warningAtTime, state.time, GAME_CONFIG.zoneWarningDuration)
            : null;
          const urgency = zoneUrgencyMeta(warningTimeRemaining);
          return (
            <button
              key={def.id}
              type="button"
              className={cx('zone-chip', `zone-chip-${status}`)}
              style={{ ['--zone-color' as string]: visual.color }}
              disabled={disabled}
              onClick={() => onMove(def.id)}
              aria-label={`移动到${def.name}，消耗 3 体力（${meta.label} · 噪音 ${NOISE_LABEL[noise]}）`}
            >
              <span className="zone-state-icon" aria-hidden="true">{meta.icon}</span>
              <span className="zone-chip-name">{def.name}</span>
              {status === 'restricted' && (
                <span className="zone-urgency zone-urgency-imminent" aria-hidden="true">
                  <span aria-hidden="true">☠</span>−{zoneDamagePerTick(state)}
                </span>
              )}
              {status === 'warning' && warningTimeRemaining !== null && (
                <span className={`zone-urgency zone-urgency-${urgency.urgency}`} aria-hidden="true">
                  <span aria-hidden="true">{urgency.icon}</span>{warningTimeRemaining}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        ref={triggerRef}
        className="btn btn-sm btn-ghost zone-rail-expand"
        onClick={onExpand}
        aria-label="展开完整六区地图"
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">▦</span> 地图
      </button>
    </nav>
  );
}
