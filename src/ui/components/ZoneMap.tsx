import type { Combatant, GameState } from '../../core/types';
import { GAME_CONFIG } from '../../data/gameConfig';
import { noiseLevelOf, NOISE_LABEL } from '../../core/info';
import { canAccessGroundItem } from '../../core/legalActions';
import { zoneDamagePerTick } from '../../core/restrictedZones';
import { ZONES, areAdjacent } from '../../data/zones';
import { cx } from '../../utils/format';
import { getZoneVisual } from '../visualAssets';
import { warningRemaining, zoneStatusMeta, zoneUrgencyMeta } from '../zonePresentation';
import { VisualImage } from './VisualImage';

interface ZoneMapProps {
  state: GameState;
  player: Combatant;
  disabled: boolean;
  /** 拥有「新鲜」情报的区域集合，用于地图上打标记（不全知） */
  freshIntelZones?: Set<string>;
  onMove: (zoneId: string) => void;
}

/**
 * 左栏区域地图。
 * 用列表 + 色条表示 6 个区域，只有相邻区域可点击。
 *
 * 第二阶段起地图不再泄露"每个区域有几个人"：
 * - 取而代之显示**噪音等级**（安静 / 有动静 / 嘈杂），由搜索、战斗、死亡产生并衰减；
 * - 对拥有「最后已知位置」情报的区域打上"情报"标记，但仅对新鲜情报生效。
 * - 地面掉落只在当前所在区域显示数量；远处地面库存属于未发现信息。
 * 精确的对手位置仍然只在遭遇或被亲眼看见时揭示。
 */
export function ZoneMap({
  state,
  player,
  disabled,
  freshIntelZones,
  onMove,
}: ZoneMapProps): JSX.Element {
  return (
    <section className="panel zone-nav-panel col-grow">
      <div className="panel-title">
        <span>路线规划</span>
        <span className="faint">六区 · 相邻可移动</span>
      </div>

      <div className="zone-list scroll">
        {ZONES.map((def) => {
          const zs = state.zones[def.id];
          const isCurrent = def.id === player.currentZoneId;
          const adjacent = areAdjacent(player.currentZoneId, def.id);
          const status = zs?.status ?? 'safe';
          const noise = noiseLevelOf(zs);
          const hasIntel = freshIntelZones?.has(def.id) ?? false;
          const zoneVisual = getZoneVisual(def.id);
          const statusMeta = zoneStatusMeta(status);
          const warningTimeRemaining = status === 'warning'
            ? warningRemaining(zs?.warningAtTime, state.time, GAME_CONFIG.zoneWarningDuration)
            : null;
          const urgency = zoneUrgencyMeta(warningTimeRemaining);
          // 地面掉落不是全局公开情报：远处区域的库存只能留在 DebugPanel，
          // 玩家地图最多确认自己当前所在区域的可拾取物。
          const visibleGroundItems = isCurrent
            ? (zs?.groundItems ?? []).filter((stack) => canAccessGroundItem(player, stack))
            : [];
          const showGroundDropCue = visibleGroundItems.length > 0;

          return (
            <button
              key={def.id}
              className={cx('zone-item', isCurrent && 'current')}
              style={{ ['--zone-color' as string]: zoneVisual.color }}
              disabled={disabled || isCurrent || !adjacent}
              onClick={() => onMove(def.id)}
              aria-label={
                isCurrent
                  ? `${def.name}，当前所在区域`
                  : adjacent
                    ? `移动到${def.name}，消耗 3 体力`
                    : `${def.name}，不与当前区域相邻`
              }
            >
              <span className="row1">
                <span className="name">
                  <VisualImage visual={zoneVisual} alt={`${def.name}图标`} className="zone-visual" />{' '}
                  {def.name}
                </span>
                <span className={`zone-state-cue cue-${status}`}>
                  <span className="zone-state-icon" aria-hidden="true">{statusMeta.icon}</span>
                  <span>{statusMeta.label}</span>
                </span>
              </span>
              <span className="row2">
                <span>{isCurrent ? '● 你在这里' : adjacent ? '可前往' : '不相邻'}</span>
                <span className={`noise noise-${noise}`}>
                  噪音：{NOISE_LABEL[noise]}
                </span>
                {hasIntel && <span className="intel-tag">情报</span>}
                {status === 'warning' && warningTimeRemaining !== null && (
                  <span className={`zone-urgency zone-urgency-${urgency.urgency}`}>
                    <span aria-hidden="true">{urgency.icon}</span> {urgency.label} · {warningTimeRemaining} 回合
                  </span>
                )}
                {status === 'restricted' && (
                  <span className="zone-urgency zone-urgency-imminent">
                    <span aria-hidden="true">☠</span> 每回合 −{zoneDamagePerTick(state)} 生命
                  </span>
                )}
                {showGroundDropCue && (
                  <span>有地面物资</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="map-legend">
        <span className="tag tag-safe">安全</span>
        <span className="tag tag-warning">预警</span>
        <span className="tag tag-restricted">禁区</span>
        <span className="noise noise-quiet">安静</span>
        <span className="noise noise-active">有动静</span>
        <span className="noise noise-loud">嘈杂</span>
      </div>
    </section>
  );
}
