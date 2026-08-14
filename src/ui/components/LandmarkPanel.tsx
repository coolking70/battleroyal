import { canUseFacility } from '../../core/facilities';
import { canSearchLandmark, landmarkStatus, landmarkState } from '../../core/landmarks';
import { getActionStaminaCost } from '../../core/actionCosts';
import type { Command, Combatant, GameState } from '../../core/types';
import { landmarksForZone } from '../../data/landmarks';

interface LandmarkPanelProps {
  state: GameState;
  player: Combatant;
  disabled: boolean;
  onCommand: (command: Command) => void;
}

const STATUS_LABEL = {
  untouched: '未探索', discovered: '已发现', partially_used: '部分消耗',
  exhausted: '已耗尽', activated: '已启用', repaired: '已修复',
} as const;

export function LandmarkPanel({ state, player, disabled, onCommand }: LandmarkPanelProps): JSX.Element {
  const defs = landmarksForZone(player.currentZoneId);
  return (
    <section className="stage-section landmark-panel" data-landmark-panel="true" aria-label="当前区域地标与设施">
      <div className="panel-title"><span>地标与设施</span><span className="faint">当前区域 · 隐藏物资不会预览</span></div>
      <div className="landmark-list">
        {defs.map((def) => {
          const runtime = landmarkState(state, def.id)!;
          const status = landmarkStatus(runtime);
          const search = canSearchLandmark(state, player.id, def.id);
          const facility = def.interaction ? canUseFacility(state, player, def.id, def.interaction.id) : null;
          return (
            <article className="landmark-card" key={def.id} data-landmark-id={def.id}>
              <div className="landmark-card-head"><span className="landmark-icon" aria-hidden="true">{def.icon}</span><strong>{def.name}</strong><span className="tag">{STATUS_LABEL[status]}</span></div>
              <div className="faint landmark-description">{def.description}</div>
              <div className="landmark-card-state">
                {def.searchable && <span>{runtime.exhausted ? '搜索资源耗尽' : `可搜索 ${runtime.remainingSearches} 次`}</span>}
                {def.interaction && <span>{runtime.charges > 0 ? `设施 ${runtime.charges}/${runtime.maxCharges} 次` : '设施次数耗尽'}</span>}
              </div>
              <div className="presence-actions">
                {def.searchable && (
                  <button className="btn btn-sm" data-action="search-landmark" disabled={disabled || !search.ok} onClick={() => onCommand({ type: 'SEARCH_LANDMARK', landmarkId: def.id })}>
                    定向搜索（体力 {getActionStaminaCost(player, 'SEARCH_LANDMARK')}）
                  </button>
                )}
                {def.interaction && (
                  <button className="btn btn-sm" data-action="interact-landmark" disabled={disabled || !facility?.ok} onClick={() => onCommand({ type: 'INTERACT_LANDMARK', landmarkId: def.id, interactionId: def.interaction!.id })}>
                    {def.interaction.label}{facility?.ok ? `（体力 ${facility.cost}）` : ''}
                  </button>
                )}
              </div>
              {!search.ok && !runtime.exhausted && def.searchable && <div className="faint">{search.reason}</div>}
              {facility && !facility.ok && <div className="faint">{facility.reason}</div>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
