import { INCIDENT_DEFINITIONS } from '../../data/incidents';
import { getZoneDef } from '../../data/zones';
import { getActionStaminaCost } from '../../core/actionCosts';
import { incidentMemory } from '../../core/incidentVisibility';
import { canResolveIncident } from '../../core/incidentEffects';
import { incidentRuntime } from '../../core/incidents';
import type { Command, Combatant, GameState } from '../../core/types';

interface IncidentPanelProps {
  state: GameState;
  player: Combatant;
  disabled: boolean;
  onCommand: (command: Command) => void;
}

const STATE_LABEL: Record<string, string> = {
  active: '进行中',
  resolved: '已处理',
  expired: '已结束',
};

/**
 * Phase 4T - player-visible incident surface.
 *
 * Information boundary: the panel only shows what THIS player is allowed to
 * know. PUBLIC_BROADCAST incidents the player has legally learned about show
 * as a coarse notice (title + zone + coarse state, never reward counts,
 * charges or other actors' progress). Incidents in the player's current zone
 * additionally offer the legal interaction when eligible. No other actor's
 * private memory, intent or progress is ever rendered here.
 */
export function IncidentPanel({ state, player, disabled, onCommand }: IncidentPanelProps): JSX.Element | null {
  const known = INCIDENT_DEFINITIONS
    .filter((def) => incidentMemory(player, def.id) !== null)
    .sort((a, b) => a.zoneId.localeCompare(b.zoneId) || a.id.localeCompare(b.id));
  if (known.length === 0) return null;

  return (
    <section className="stage-section incident-panel" data-incident-panel="true" aria-label="已知的局部事件">
      <div className="panel-title"><span>局部动态</span><span className="faint">只知道你已经合法获知的信息</span></div>
      <div className="landmark-list">
        {known.map((def) => {
          const memory = incidentMemory(player, def.id)!;
          const runtime = incidentRuntime(state, def.id);
          const here = def.zoneId === player.currentZoneId;
          const claimable = here && memory.observedState === 'active' && runtime?.status === 'ACTIVE';
          const check = claimable ? canResolveIncident(state, player, def.id) : null;
          const showClaim = claimable && check !== null && check.ok;
          return (
            <article className="landmark-card" key={def.id} data-incident-id={def.id}>
              <div className="landmark-card-head">
                <strong>{def.title}</strong>
                <span className="tag">{STATE_LABEL[memory.observedState] ?? memory.observedState}</span>
              </div>
              <div className="faint landmark-description">
                {def.visibility === 'PUBLIC_BROADCAST'
                  ? `${getZoneDef(def.zoneId).name} · 广播通知`
                  : `${getZoneDef(def.zoneId).name} · 现场获知`}
              </div>
              {showClaim && (
                <div className="presence-actions">
                  <button
                    className="btn btn-sm"
                    data-action="resolve-incident"
                    disabled={disabled}
                    onClick={() => onCommand({ type: 'RESOLVE_INCIDENT', incidentId: def.id })}
                  >
                    {def.actionLabel}（体力 {getActionStaminaCost(player, 'RESOLVE_INCIDENT')}）
                  </button>
                </div>
              )}
              {here && memory.observedState === 'active' && !showClaim && (
                <div className="faint">该事件当前无法由你处理（可能已被处理或奖励已领完）。</div>
              )}
              {!here && memory.observedState === 'active' && (
                <div className="faint">需要亲自抵达{getZoneDef(def.zoneId).name}才能确认现场状态。</div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
