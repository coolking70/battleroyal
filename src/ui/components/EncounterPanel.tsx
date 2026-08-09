import { getActionStaminaCost, getAttackStyleStaminaCost } from '../../core/actionCosts';
import { ATTACK_STYLE_LABEL, fleeChanceIn, hitChanceIn } from '../../core/combat';
import { hasExposed, EXPOSED_LABEL } from '../../core/exposed';
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

  const ATTACK_STYLES: AttackStyle[] = ['quick', 'normal', 'heavy'];

  // 玩家专属技能（Phase 3 Step 3）
  const skillId: SkillId | null = getCharacterSkill(player.characterId);
  const skillDef = skillId ? SKILLS[skillId] : null;
  const skillReady = skillId ? isSkillReady(player, skillId) : false;
  const skillUsable = skillId ? canUseSkill(player, skillId).ok : false;
  const skillCooldown = skillId ? player.skillCooldowns[skillId] ?? 0 : 0;

  return (
    <div className="encounter">
      <h4>
        {resolved ? '遭遇结束' : '遭遇战'}
        {player.guarding && <span className="tag tag-guard" style={{ marginLeft: 8 }}>防御中</span>}
        {playerExposed && <span className="tag tag-exposed" style={{ marginLeft: 8 }}>{EXPOSED_LABEL}</span>}
      </h4>

      <div className="encounter-body">
        <div className="encounter-enemy">
          <div className="nm">
            <VisualImage
              visual={getCharacterVisual(enemy.characterId, enemyVisualState)}
              alt={`${enemy.name}角色图`}
              className="encounter-character-visual"
            />
            <span className="badge badge-enemy">敌</span>
            {enemy.name}
            {enemyExposed && (
              <span className="tag tag-exposed" style={{ marginLeft: 6 }}>{EXPOSED_LABEL}</span>
            )}
          </div>
          <div className="faint mono" style={{ fontSize: 11, marginBottom: 6 }}>
            {getCharacterDef(enemy.characterId).name} · {hpDescriptor(enemy)}
          </div>
          <Bar value={enemy.hp} max={enemy.maxHp} kind="hp" />
          <div className="dim mono" style={{ fontSize: 11, marginTop: 6 }}>
            武器：{weapon ? getItem(weapon.itemId).name : '徒手'}
          </div>
          <div className="dim mono" style={{ fontSize: 11 }}>
            你 攻 {totalAttack(player)} / 防 {totalDefense(player)}
          </div>
          {!resolved && (
            <div className="dim mono" style={{ fontSize: 11 }}>
              脱离 {flee}%
            </div>
          )}
        </div>

        <div className="encounter-log">
          {encounter.log.length === 0 ? (
            <p className="faint">尚未交手。</p>
          ) : (
            encounter.log.map((line, i) => <p key={i}>{line}</p>)
          )}
        </div>
      </div>

      <div className="encounter-actions">
        {resolved ? (
          <button className="btn btn-primary" onClick={onClose}>
            继续
          </button>
        ) : (
          <>
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
                    title={`${ATTACK_STYLE_LABEL[style]}：命中 ${hit}%，消耗 ${cost} 点体力${isHeavy ? '；挥空会露出破绽' : ''}`}
                    onClick={() => onAttack(style)}
                  >
                    {ATTACK_STYLE_LABEL[style]}（命中 {hit}% · 体力 {cost}）
                    {isHeavy && <span className="heavy-risk">挥空破绽</span>}
                  </button>
                );
              })}
            </div>
            <div className="encounter-side-actions">
              {skillDef && (
                <button
                  className="btn"
                  disabled={!skillUsable}
                  onClick={onSkill}
                  title={
                    skillReady
                      ? `${skillDef.name}：${skillDef.description}（消耗 ${skillDef.staminaCost} 点体力）`
                      : `${skillDef.name}冷却中（剩余 ${skillCooldown} 回合）`
                  }
                >
                  {skillDef.name}（{skillReady ? `体力 ${skillDef.staminaCost}` : `冷却 ${skillCooldown}`}）
                </button>
              )}
              <button
                className="btn"
                disabled={player.stamina < guardCost}
                onClick={onGuard}
                title={`防御姿态：下一击伤害减免，消耗 ${guardCost} 点体力`}
              >
                防御（{guardCost === 0 ? '免费' : `体力 ${guardCost}`}）
              </button>
              <button
                className="btn"
                onClick={onFlee}
                title="脱离是免费行动，但仍会消耗 1 个时间单位，失败还会被追击"
              >
                逃跑（{fleeCost === 0 ? '免费' : `体力 ${fleeCost}`}）
              </button>
            </div>
            <span className="faint mono" style={{ fontSize: 11, alignSelf: 'center' }}>
              {player.stamina >= getAttackStyleStaminaCost('normal')
                ? '遭遇中仍可在右侧使用消耗品或更换装备'
                : '体力不足以普通攻击 —— 速攻或防御仍可用，或逃跑'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
