import { useMemo } from 'react';
import { buildCraftPlan } from '../../core/craftPlan';
import { countItem } from '../../core/inventory';
import { getLegalPlayerCommands } from '../../core/legalActions';
import type { Command, Combatant, GameState, VictoryType } from '../../core/types';
import { EXTRACTION_DELAY, VICTORY_CONDITION_MAP } from '../../data/victoryConditions';
import { getItem } from '../../data/items';

interface VictoryPathsProps {
  state: GameState;
  player: Combatant;
  onCommand: (command: Command) => void;
  disabled?: boolean;
}

function routeLabel(type: VictoryType): string {
  return VICTORY_CONDITION_MAP[type].label;
}

function countdown(state: GameState): string | null {
  const active = state.activeExtraction;
  if (!active) return null;
  if (active.phase === 'ready') return '窗口已就绪';
  return `公开倒计时 ${Math.max(0, active.readyAtTime - state.time)} 回合`;
}

/** Player-facing route summary; all progress comes from core state/plans. */
export function VictoryPaths({ state, player, onCommand, disabled = false }: VictoryPathsProps): JSX.Element {
  const legal = useMemo(() => getLegalPlayerCommands(state), [state]);
  const legalByType = useMemo(() => new Map(legal.map((action) => [action.command.type, action.command])), [legal]);
  const extractionPlan = useMemo(
    () => buildCraftPlan(state, player, 'r_extraction_beacon'),
    [state, player],
  );
  const researchPlan = useMemo(
    () => buildCraftPlan(state, player, 'r_research_package'),
    [state, player],
  );
  const extractionComplete = extractionPlan
    ? extractionPlan.steps.filter((step) => step.status === 'complete').length
    : countItem(player, 'extraction_beacon') > 0 ? 1 : 0;
  const extractionTotal = Math.max(1, extractionPlan?.steps.length ?? 0);
  const researchComplete = researchPlan
    ? researchPlan.steps.filter((step) => step.status === 'complete').length
    : countItem(player, 'research_package') > 0 ? 1 : 0;
  const researchTotal = Math.max(1, researchPlan?.steps.length ?? 0);
  const activeCaller = state.activeExtraction?.callerId
    ? state.characters[state.activeExtraction.callerId]
    : null;

  const button = (type: 'CALL_EXTRACTION' | 'EXTRACT' | 'SUBMIT_RESEARCH', label: string): JSX.Element | null => {
    const command = legalByType.get(type);
    if (!command) return null;
    return (
      <button className="btn btn-sm btn-primary" disabled={disabled} onClick={() => onCommand(command)}>
        {label}
      </button>
    );
  };

  return (
    <section className="panel victory-paths" aria-labelledby="victory-paths-title" data-victory-paths>
      <div className="panel-title">
        <span id="victory-paths-title">胜利路线</span>
        <span className="faint">三选一 · 首次完成即结算</span>
      </div>
      <div className="victory-path-grid">
        <article className="victory-path-card" data-victory-type="last_survivor">
          <div className="victory-path-kicker">ROUTE 01</div>
          <h3>{routeLabel('last_survivor')}</h3>
          <p>成为唯一存活的参赛者。</p>
          <span className="victory-path-status">持续进行</span>
        </article>
        <article className="victory-path-card" data-victory-type="extraction">
          <div className="victory-path-kicker">ROUTE 02 · PUBLIC</div>
          <h3>{routeLabel('extraction')}</h3>
          <p>携带 {getItem('extraction_beacon').name}，在车站呼叫并完成撤离。</p>
          <span className="victory-path-status">
            {state.activeExtraction
              ? `${activeCaller?.name ?? '未知呼叫者'} · ${countdown(state) ?? `等待 ${EXTRACTION_DELAY} 回合`}`
              : `信标 ${countItem(player, 'extraction_beacon')} · 合成进度 ${extractionComplete} / ${extractionTotal}`}
          </span>
          <div className="victory-path-action">
            {button('CALL_EXTRACTION', '呼叫撤离') ?? button('EXTRACT', '完成撤离')}
          </div>
        </article>
        <article className="victory-path-card" data-victory-type="research">
          <div className="victory-path-kicker">ROUTE 03 · PRIVATE</div>
          <h3>{routeLabel('research')}</h3>
          <p>以野外材料完成研究链，并在研究所提交成果。</p>
          <span className="victory-path-status">仅你可见 · 进度 {researchComplete} / {researchTotal}</span>
          <div className="victory-path-action">
            {button('SUBMIT_RESEARCH', '提交研究')}
          </div>
        </article>
      </div>
    </section>
  );
}
