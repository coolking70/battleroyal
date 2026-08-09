import { getActionStaminaCost, getAttackStyleStaminaCost } from '../../core/actionCosts';
import { ATTACK_STYLE_LABEL, fleeChanceIn, hitChanceIn } from '../../core/combat';
import { hasExposed } from '../../core/exposed';
import { getEquippedWeapon, totalAttack, totalDefense } from '../../core/inventory';
import {
  SKILLS,
  canUseSkill,
  getCharacterSkill,
  isSkillReady,
  type SkillId,
} from '../../core/skills';
import type { AttackStyle, Combatant, EncounterState, GameState } from '../../core/types';
import { getCharacterDef } from '../../data/characters';
import { getItem } from '../../data/items';
import { cx, hpDescriptor } from '../../utils/format';
import { Bar } from './Bar';
import { VisualImage } from './VisualImage';
import { getCharacterVisual } from '../visualAssets';
import { resolveCharacterVisualState } from '../characterVisualState';
import {
  COMBAT_ACTION_GROUP_META,
  COMBAT_STATUS_META,
  combatModeMeta,
  combatVisualStateMeta,
} from '../combatPresentation';

interface EncounterPanelProps {
  state: GameState;
  encounter: EncounterState;
  player: Combatant;
  enemy: Combatant;
  onAttack: (style: AttackStyle) => void;
  onFlee: () => void;
  onGuard: () => void;
  onSkill: () => void;
  onClose: () => void;
}

/**
 * 遭遇战面板。
 * 命中率 / 逃跑率直接调用 core 的同一套函数（`hitChanceIn` / `fleeChanceIn`），
 * 与世界事件修正同源，保证提示与实际结算一致（Phase 3A 不变量）。
 * 攻击提供 quick / normal / heavy 三种风格（Phase 3 Step 1），各自命中率与体力成本不同；
 * 防御姿态可减免下一击伤害，但本回合放弃进攻。
 * EXPOSED（露出破绽）与防御姿态一样在面板上直接可见。
 */
export function EncounterPanel({
  state,
  encounter,
  player,
  enemy,
  onAttack,
  onFlee,
  onGuard,
  onSkill,
  onClose,
}: EncounterPanelProps): JSX.Element {
  const resolved = encounter.resolved || !enemy.alive;
  const flee = Math.round(fleeChanceIn(state, player, enemy) * 100);
  const weapon = getEquippedWeapon(enemy);
  const fleeCost = getActionStaminaCost(player, 'FLEE');
  const guardCost = getActionStaminaCost(player, 'GUARD');
  const playerExposed = hasExposed(player);
  const enemyExposed = hasExposed(enemy);
  const enemyVisualState = resolveCharacterVisualState(enemy, { activeEncounter: !resolved });
  const playerVisualState = resolveCharacterVisualState(player, { activeEncounter: !resolved });
  const modeMeta = combatModeMeta(resolved);
  const playerVisualMeta = combatVisualStateMeta(playerVisualState);
  const enemyVisualMeta = combatVisualStateMeta(enemyVisualState);
  const latestFeedback = encounter.log[encounter.log.length - 1] ?? (resolved ? '遭遇已结束，等待确认结果。' : '尚未交手，选择一项行动。');

  const ATTACK_STYLES: AttackStyle[] = ['quick', 'normal', 'heavy'];

  // 玩家专属技能（Phase 3 Step 3）
  const skillId: SkillId | null = getCharacterSkill(player.characterId);
  const skillDef = skillId ? SKILLS[skillId] : null;
  const skillReady = skillId ? isSkillReady(player, skillId) : false;
  const skillUsable = skillId ? canUseSkill(player, skillId).ok : false;
  const skillCooldown = skillId ? player.skillCooldowns[skillId] ?? 0 : 0;

  return (
    <section
      className={cx('encounter', resolved && 'encounter-resolved')}
      data-encounter-state={resolved ? 'resolved' : 'active'}
      aria-label={modeMeta.label}
    >
      <header className="encounter-heading">
        <div className="encounter-heading-main">
          <span className="encounter-mode-badge">
            <span className="combat-cue-icon" aria-hidden="true">{modeMeta.icon}</span>
            {modeMeta.label}
          </span>
          <h4>{resolved ? '结果确认' : '当前对手'}</h4>
        </div>
        <span className="encounter-heading-note">{modeMeta.description}</span>
      </header>

      <div className="encounter-composition">
        <section
          className="combatant-card combatant-player"
          data-side="player"
          data-visual-state={playerVisualState}
          aria-label={`玩家${playerVisualMeta.label}`}
        >
          <div className="combatant-card-kicker">PLAYER · 你</div>
          <div className="combatant-visual-frame">
            <VisualImage
              visual={getCharacterVisual(player.characterId, playerVisualState)}
              alt={`${getCharacterDef(player.characterId).name}${playerVisualMeta.label}角色图`}
              className="encounter-combat-visual encounter-player-visual"
            />
          </div>
          <div className="combatant-name-line">
            <span className="badge badge-you">你</span>
            <strong>{getCharacterDef(player.characterId).name}</strong>
          </div>
          <div className={`combat-visual-state state-player state-${playerVisualState}`}>
            <span className="combat-cue-icon" aria-hidden="true">{playerVisualMeta.icon}</span>
            <span>{playerVisualMeta.label}</span>
          </div>
          <p className="combat-visual-description">{playerVisualMeta.description}</p>
          <div className="combat-resource-row">
            <span>生命</span>
            <Bar value={player.hp} max={player.maxHp} kind="hp" />
            <b>{player.hp}/{player.maxHp}</b>
          </div>
          <div className="combat-resource-row">
            <span>体力</span>
            <Bar value={player.stamina} max={player.maxStamina} kind="stamina" />
            <b>{player.stamina}/{player.maxStamina}</b>
          </div>
          <div className="combat-stat-line">攻 {totalAttack(player)} · 防 {totalDefense(player)}</div>
          <div className="combat-status-row">
            {player.guarding && (
              <span className="tag tag-guard"><span className="combat-cue-icon" aria-hidden="true">{COMBAT_STATUS_META.guard.icon}</span>{COMBAT_STATUS_META.guard.label}</span>
            )}
            {playerExposed && (
              <span className="tag tag-exposed"><span className="combat-cue-icon" aria-hidden="true">{COMBAT_STATUS_META.exposed.icon}</span>{COMBAT_STATUS_META.exposed.label}</span>
            )}
            {!player.guarding && !playerExposed && <span className="faint combat-status-empty">无额外状态</span>}
          </div>
        </section>

        <section className="encounter-center" aria-label="遭遇反馈与行动">
          <div className="encounter-focus" aria-live="polite">
            <div className="encounter-focus-kicker">即时反馈 · LAST RESULT</div>
            <strong>{latestFeedback}</strong>
            <span className="encounter-focus-note">{resolved ? '确认后将恢复探索焦点。' : '结果会在这里突出显示，同时保留最近战斗记录。'}</span>
          </div>

          <div className="encounter-log" aria-label="本次遭遇战斗记录">
            {encounter.log.length === 0 ? (
              <p className="faint">尚未交手。</p>
            ) : (
              encounter.log.map((line, i) => <p key={i}>{line}</p>)
            )}
          </div>

          <div className="encounter-actions">
            {resolved ? (
              <button className="btn btn-primary encounter-continue" onClick={onClose}>
                继续探索
              </button>
            ) : (
              <>
                <div className="action-group attack-group">
                  <div className="action-group-heading">
                    <span><span className="combat-cue-icon" aria-hidden="true">{COMBAT_ACTION_GROUP_META.attack.icon}</span>{COMBAT_ACTION_GROUP_META.attack.label}</span>
                    <small>{COMBAT_ACTION_GROUP_META.attack.description}</small>
                  </div>
                  <div className="attack-styles">
                    {ATTACK_STYLES.map((style) => {
                      const cost = getAttackStyleStaminaCost(style);
                      // Phase 3A 不变量：UI 展示的命中率必须与核心结算同源（含世界事件修正）
                      const hit = Math.round(hitChanceIn(state, player, enemy, style) * 100);
                      const disabled = player.stamina < cost;
                      const isHeavy = style === 'heavy';
                      return (
                        <button
                          key={style}
                          className={cx('btn', isHeavy && 'btn-danger-heavy')}
                          disabled={disabled}
                          data-attack-style={style}
                          aria-label={`${ATTACK_STYLE_LABEL[style]}：命中 ${hit}%，消耗 ${cost} 点体力${disabled ? '，当前体力不足' : ''}${isHeavy ? '；挥空会露出破绽' : ''}`}
                          aria-describedby="encounter-legal-note"
                          onClick={() => onAttack(style)}
                        >
                          <span>{ATTACK_STYLE_LABEL[style]}</span>
                          <span className="action-button-detail">命中 {hit}% · 体力 {cost}</span>
                          {isHeavy && <span className="heavy-risk">挥空会露出破绽</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="action-group response-group">
                  <div className="action-group-heading">
                    <span><span className="combat-cue-icon" aria-hidden="true">{COMBAT_ACTION_GROUP_META.response.icon}</span>{COMBAT_ACTION_GROUP_META.response.label}</span>
                    <small>{COMBAT_ACTION_GROUP_META.response.description}</small>
                  </div>
                  <div className="encounter-side-actions">
                    {skillDef && (
                      <button
                        className="btn"
                        disabled={!skillUsable}
                        data-action="skill"
                        onClick={onSkill}
                        aria-label={
                          skillReady
                            ? `${skillDef.name}：${skillDef.description}（消耗 ${skillDef.staminaCost} 点体力）`
                            : `${skillDef.name}冷却中（剩余 ${skillCooldown} 回合）`
                        }
                        aria-describedby="encounter-legal-note"
                      >
                        <span>{skillDef.name}</span>
                        <span className="action-button-detail">
                          <span className="combat-cue-icon" aria-hidden="true">{skillReady ? COMBAT_STATUS_META.skillReady.icon : COMBAT_STATUS_META.skillCooldown.icon}</span>
                          {skillReady ? `技能就绪 · 体力 ${skillDef.staminaCost}` : `技能冷却 · ${skillCooldown} 回合`}
                        </span>
                      </button>
                    )}
                    <button
                      className="btn"
                      disabled={player.stamina < guardCost}
                      data-action="guard"
                      onClick={onGuard}
                      aria-label={`防御姿态：下一击伤害减免，消耗 ${guardCost} 点体力${player.stamina < guardCost ? '，当前体力不足' : ''}`}
                      aria-describedby="encounter-legal-note"
                    >
                      <span>防御</span>
                      <span className="action-button-detail"><span className="combat-cue-icon" aria-hidden="true">{COMBAT_STATUS_META.guard.icon}</span>{guardCost === 0 ? '免费' : `体力 ${guardCost}`}</span>
                    </button>
                    <button
                      className="btn"
                      data-action="flee"
                      onClick={onFlee}
                      aria-label={`逃跑：脱离 ${flee}%${fleeCost === 0 ? '，免费' : `，消耗 ${fleeCost} 点体力`}；仍会消耗 1 个时间单位${fleeCost === 0 ? '，有可退区域时失败可能被追击，无可退区域时原地脱离' : ''}`}
                      aria-describedby="encounter-legal-note"
                    >
                      <span>逃跑</span>
                      <span className="action-button-detail">脱离 {flee}% · {fleeCost === 0 ? '免费' : `体力 ${fleeCost}`}</span>
                    </button>
                  </div>
                </div>
                <span className="encounter-legal-note" id="encounter-legal-note">
                  {player.stamina >= getAttackStyleStaminaCost('normal')
                    ? '遭遇中仍可在右侧使用消耗品或更换装备。'
                    : player.stamina === 0
                      ? '体力耗尽：防御本回合免费，或免费原地脱离；也可使用消耗品或更换装备。'
                      : player.stamina < guardCost
                        ? `体力不足：速攻或免费脱离仍可用；防御需要 ${guardCost} 点体力。`
                        : '体力不足以普通攻击 —— 速攻、防御或免费脱离仍可用。'}
                </span>
              </>
            )}
          </div>
        </section>

        <section
          className="combatant-card combatant-enemy"
          data-side="enemy"
          data-visual-state={enemyVisualState}
          aria-label={`敌方${enemyVisualMeta.label}`}
        >
          <div className="combatant-card-kicker">ENEMY · 当前可见目标</div>
          <div className="combatant-visual-frame">
            <VisualImage
              visual={getCharacterVisual(enemy.characterId, enemyVisualState)}
              alt={`${enemy.name}${enemyVisualMeta.label}角色图`}
              className="encounter-combat-visual encounter-character-visual encounter-enemy-visual"
            />
          </div>
          <div className="combatant-name-line">
            <span className="badge badge-enemy">敌</span>
            <strong>{enemy.name}</strong>
          </div>
          <div className={`combat-visual-state state-enemy state-${enemyVisualState}`}>
            <span className="combat-cue-icon" aria-hidden="true">{enemyVisualMeta.icon}</span>
            <span>{enemyVisualMeta.label}</span>
          </div>
          <p className="combat-visual-description">{getCharacterDef(enemy.characterId).name} · {hpDescriptor(enemy)}</p>
          <div className="enemy-health-summary">
            <span>敌方生命状态</span>
            <Bar value={enemy.hp} max={enemy.maxHp} kind="hp" />
            <b>{hpDescriptor(enemy)}</b>
          </div>
          <div className="combat-status-row">
            {enemyExposed ? (
              <span className="tag tag-exposed"><span className="combat-cue-icon" aria-hidden="true">{COMBAT_STATUS_META.exposed.icon}</span>{COMBAT_STATUS_META.exposed.label}</span>
            ) : (
              <span className="faint combat-status-empty">未见额外状态</span>
            )}
          </div>
          <div className="combat-stat-line">武器：{weapon ? getItem(weapon.itemId).name : '徒手'}</div>
          <div className="combat-stat-line">你 攻 {totalAttack(player)} / 防 {totalDefense(player)}</div>
          {!resolved && <div className="combat-stat-line flee-line">脱离 {flee}%</div>}
        </section>
      </div>
    </section>
  );
}
