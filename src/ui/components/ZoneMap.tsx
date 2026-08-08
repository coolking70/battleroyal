import type { Combatant, GameState } from '../../core/types';
import { noiseLevelOf, NOISE_LABEL } from '../../core/info';
import { ZONES, areAdjacent } from '../../data/zones';
import { ZONE_STATUS_LABEL, cx } from '../../utils/format';

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
    <section className="panel col-grow">
      <div className="panel-title">
        <span>区域地图</span>
        <span className="faint">相邻可移动</span>
      </div>

      <div className="zone-list scroll">
        {ZONES.map((def) => {
          const zs = state.zones[def.id];
          const isCurrent = def.id === player.currentZoneId;
          const adjacent = areAdjacent(player.currentZoneId, def.id);
          const status = zs?.status ?? 'safe';
          const noise = noiseLevelOf(zs);
          const hasIntel = freshIntelZones?.has(def.id) ?? false;

          return (
            <button
              key={def.id}
              className={cx('zone-item', isCurrent && 'current')}
              style={{ ['--zone-color' as string]: def.color }}
              disabled={disabled || isCurrent || !adjacent}
              onClick={() => onMove(def.id)}
              title={
                isCurrent
                  ? '当前所在区域'
                  : adjacent
                    ? `移动到${def.name}（消耗 3 体力）`
                    : '不与当前区域相邻'
              }
            >
              <span className="row1">
                <span className="name">{def.name}</span>
                <span className={`tag tag-${status}`}>
                  {ZONE_STATUS_LABEL[status]}
                </span>
              </span>
              <span className="row2">
                <span>{isCurrent ? '● 你在这里' : adjacent ? '可前往' : '不相邻'}</span>
                <span className={`noise noise-${noise}`}>
                  噪音：{NOISE_LABEL[noise]}
                </span>
                {hasIntel && <span className="intel-tag">情报</span>}
                {(zs?.groundItems.length ?? 0) > 0 && (
                  <span>掉落 {zs?.groundItems.length}</span>
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
