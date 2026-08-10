import { canSearch } from '../../core/search';
import type { AttackStyle, Combatant, GameState } from '../../core/types';
import { GAME_CONFIG } from '../../data/gameConfig';
import { cx } from '../../utils/format';
import { COMBAT_STATUS_META } from '../combatPresentation';
import type { CombatActionBarView } from '../combatActionsPresentation';

interface ActionBarProps {
  state: GameState;
  player: Combatant;
  /** 待处理拾取时禁用通用行动（遭遇态改为切换到战斗动作，不再是禁用） */
  locked: boolean;
  onSearch: () => void;
  onRest: () => void;
  /**
   * 遭遇态视图模型（Phase 4D-3 §2.5）。
   * 非 null 时**整条行动栏**切换成 6 个战斗动作：速攻 / 普通 / 重击 / 防御 / 逃跑 / 技能。
   * 探索态传 null，显示搜索 / 休息 / 移动入口。
   */
  combat?: CombatActionBarView | null;
  onAttack?: (style: AttackStyle) => void;
  onGuard?: () => void;
  onFlee?: () => void;
  onSkill?: () => void;
}

/**
 * 底部行动条：**探索态与遭遇态共用同一条**，按上下文切换（Phase 4D-3 §2.5）。
 *
 * - 探索态：搜索 / 休息 + 移动入口提示。
 * - 遭遇态：速攻 / 普通 / 重击 / 防御 / 逃跑 / 技能，命中率、脱离率与体力成本
 *   全部来自 `buildCombatActionBar`（与核心结算同源），合法性提示落在 `#actionbar-hint`，
 *   所有战斗按钮用 `aria-describedby` 指向它。
 *
 * 行动栏在 `.game` 的 flex 布局里是 `flex: none` 的页脚，永远钉在视口底部 ——
 * 因此 6 个战斗动作**无需滚动**即可触达（§4 五视口约束）。
 */
export function ActionBar({
  state,
  player,
  locked,
  onSearch,
  onRest,
  combat = null,
  onAttack,
  onGuard,
  onFlee,
  onSkill,
}: ActionBarProps): JSX.Element {
  const search = canSearch(state, player);
  const zone = state.zones[player.currentZoneId];
  const inCombat = combat !== null;

  let hint: string;
  if (inCombat) hint = combat.legalNote;
  else if (locked) hint = '请先处理当前的遭遇 / 拾取。';
  else if (zone?.status === 'restricted') hint = '正处于禁区，尽快移动到安全区域。';
  else if (!search.ok && search.reason) hint = search.reason;
  else hint = '每次行动推进 1 个时间单位，随后 NPC 行动。';

  return (
    <footer
      className={cx('actionbar', inCombat && 'actionbar-combat')}
      data-action-mode={inCombat ? 'combat' : 'exploration'}
    >
      <div className="actionbar-heading">
        <span className="actionbar-kicker">{inCombat ? 'P0' : 'P1'}</span>
        <span className="actionbar-title">{inCombat ? '战斗行动' : '下一步行动'}</span>
      </div>

      {inCombat ? (
        <div className="actionbar-actions actionbar-combat-actions" aria-label="战斗行动">
          {combat.attacks.map((attack) => (
            <button
              key={attack.style}
              className={cx('btn', attack.isHeavy && 'btn-danger-heavy')}
              disabled={attack.disabled}
              data-attack-style={attack.style}
              onClick={() => onAttack?.(attack.style)}
              aria-label={`${attack.label}：命中 ${attack.hitPct}%，消耗 ${attack.cost} 点体力${attack.disabled ? '，当前体力不足' : ''}${attack.isHeavy ? '；挥空会露出破绽' : ''}`}
              aria-describedby="actionbar-hint"
            >
              <span>{attack.label}</span>
              <span className="action-cost">命中 {attack.hitPct}% · 体力 {attack.cost}</span>
              {attack.isHeavy && <span className="heavy-risk">挥空会露出破绽</span>}
            </button>
          ))}
          <button
            className="btn"
            data-action="guard"
            disabled={combat.guard.disabled}
            onClick={onGuard}
            aria-label={`防御姿态：下一击伤害减免，${combat.guard.cost === 0 ? '本回合免费' : `消耗 ${combat.guard.cost} 点体力`}${combat.guard.disabled ? '，当前体力不足' : ''}`}
            aria-describedby="actionbar-hint"
          >
            <span>防御</span>
            <span className="action-cost">
              <span className="combat-cue-icon" aria-hidden="true">{COMBAT_STATUS_META.guard.icon}</span>
              {combat.guard.cost === 0 ? '免费' : `体力 ${combat.guard.cost}`}
            </span>
          </button>
          <button
            className="btn"
            data-action="flee"
            onClick={onFlee}
            aria-label={`逃跑：脱离 ${combat.flee.chancePct}%${combat.flee.cost === 0 ? '，免费' : `，消耗 ${combat.flee.cost} 点体力`}；仍会消耗 1 个时间单位${combat.flee.cost === 0 ? '，有可退区域时失败可能被追击，无可退区域时原地脱离' : ''}`}
            aria-describedby="actionbar-hint"
          >
            <span>逃跑</span>
            <span className="action-cost">
              脱离 {combat.flee.chancePct}% · {combat.flee.cost === 0 ? '免费' : `体力 ${combat.flee.cost}`}
            </span>
          </button>
          {combat.skill && (
            <button
              className="btn"
              data-action="skill"
              disabled={!combat.skill.usable}
              onClick={onSkill}
              aria-label={
                combat.skill.ready
                  ? `${combat.skill.name}：消耗 ${combat.skill.cost} 点体力`
                  : `${combat.skill.name}冷却中（剩余 ${combat.skill.cooldown} 回合）`
              }
              aria-describedby="actionbar-hint"
            >
              <span>{combat.skill.name}</span>
              <span className="action-cost">
                <span className="combat-cue-icon" aria-hidden="true">
                  {combat.skill.ready
                    ? COMBAT_STATUS_META.skillReady.icon
                    : COMBAT_STATUS_META.skillCooldown.icon}
                </span>
                {combat.skill.ready ? `体力 ${combat.skill.cost}` : `冷却 ${combat.skill.cooldown}`}
              </span>
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="actionbar-actions" aria-label="探索行动">
            <button
              className="btn btn-primary"
              disabled={locked || !search.ok}
              onClick={onSearch}
              aria-label={`搜索，消耗 ${GAME_CONFIG.searchStaminaCost} 点体力${search.ok ? '' : `；${search.reason ?? '当前不可用'}`}`}
              aria-describedby="actionbar-hint"
            >
              搜索 <span className="action-cost">体力 {GAME_CONFIG.searchStaminaCost}</span>
            </button>
            <button
              className="btn"
              disabled={locked}
              onClick={onRest}
              aria-label={`休息，恢复 ${GAME_CONFIG.restStaminaGain} 点体力，可能被同区域敌人打断`}
              aria-describedby="actionbar-hint"
            >
              休息 <span className="action-cost">恢复 {GAME_CONFIG.restStaminaGain}</span>
            </button>
          </div>
          <div className="actionbar-route-note">
            <span className="route-icon" aria-hidden="true">↗</span>
            <span>移动：左侧路线规划中的相邻区域</span>
          </div>
        </>
      )}

      <span className="hint" id="actionbar-hint">{hint}</span>
    </footer>
  );
}
