import { canSearch } from '../../core/search';
import type { Combatant, GameState } from '../../core/types';
import { GAME_CONFIG } from '../../data/gameConfig';

interface ActionBarProps {
  state: GameState;
  player: Combatant;
  /** 遭遇战 / 待处理拾取时禁用通用行动 */
  locked: boolean;
  onSearch: () => void;
  onRest: () => void;
}

/** 底部行动条：搜索 / 休息，以及当前可用性提示 */
export function ActionBar({
  state,
  player,
  locked,
  onSearch,
  onRest,
}: ActionBarProps): JSX.Element {
  const search = canSearch(state, player);
  const zone = state.zones[player.currentZoneId];

  let hint = '每次行动推进 1 个时间单位，随后 NPC 行动。';
  if (locked) hint = '请先处理当前的遭遇 / 拾取。';
  else if (zone?.status === 'restricted') hint = '正处于禁区，尽快移动到安全区域。';
  else if (!search.ok && search.reason) hint = search.reason;

  return (
    <footer className="actionbar">
      <button
        className="btn btn-primary"
        disabled={locked || !search.ok}
        onClick={onSearch}
        title={search.ok ? `消耗 ${GAME_CONFIG.searchStaminaCost} 点体力` : (search.reason ?? '')}
      >
        搜索
      </button>
      <button
        className="btn"
        disabled={locked}
        onClick={onRest}
        title={`恢复 ${GAME_CONFIG.restStaminaGain} 点体力，可能被同区域敌人打断`}
      >
        休息
      </button>
      <span className="faint mono" style={{ fontSize: 11.5 }}>
        移动请点左侧相邻区域
      </span>
      <span className="hint">{hint}</span>
    </footer>
  );
}
