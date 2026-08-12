import type { RefObject } from 'react';
import type { Combatant, GameState } from '../../core/types';
import { cx } from '../../utils/format';
import { useDrawerFocus } from './useDrawerFocus';
import { ZoneMap } from './ZoneMap';

interface MapDrawerProps {
  open: boolean;
  onClose: () => void;
  state: GameState;
  player: Combatant;
  disabled: boolean;
  freshIntelZones?: Set<string>;
  onMove: (zoneId: string) => void;
  /** 在组件外（ZoneIndicator 的「地图」按钮）的触发器，关闭时焦点回到它 */
  triggerRef?: RefObject<HTMLButtonElement>;
}

/**
 * 完整区域地图抽屉（Phase 4D-2）。
 *
 * 由 ZoneIndicator 的「地图」按钮或当前区域按钮展开。
 * 内部复用 ZoneMap —— 4B-1 把地图压缩进紧凑网格时保留的全部信息
 * （区域 / 相邻性 / 噪音 / 情报标记 / 掉落提示）在此完整呈现，展开态与
 * 原常驻地图信息等价、无损。
 *
 * 焦点管理沿用 useDrawerFocus（与 PlanningDrawer 同一套 4B-5 / 4B-6 实现）。
 */
export function MapDrawer({
  open,
  onClose,
  state,
  player,
  disabled,
  freshIntelZones,
  onMove,
  triggerRef,
}: MapDrawerProps): JSX.Element {
  const { closeRef, panelRef } = useDrawerFocus(open, onClose, triggerRef);

  return (
    <div className={cx('map-slot', open && 'map-slot-open')}>
      {open && (
        <button
          type="button"
          className="drawer-backdrop map-drawer-backdrop"
          aria-label="关闭地图"
          onClick={onClose}
        />
      )}

      <aside
        ref={panelRef}
        id="map-drawer-panel"
        className="col col-right map-drawer-panel"
        aria-label="完整区域地图"
        aria-labelledby="map-drawer-title"
      >
        {/* 类名与规划抽屉刻意不共用：两个抽屉同时存在于 DOM 时，
            共用类名会让 `.planning-drawer-close` 这类既有选择器一次命中两个节点。 */}
        <div className="drawer-header map-drawer-header">
          <strong id="map-drawer-title">区域地图</strong>
          <button
            type="button"
            className="btn btn-sm map-drawer-close"
            ref={closeRef}
            aria-label="关闭地图"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
        <ZoneMap
          state={state}
          player={player}
          disabled={disabled}
          freshIntelZones={freshIntelZones}
          onMove={onMove}
        />
      </aside>
    </div>
  );
}
