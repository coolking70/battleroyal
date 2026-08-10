import { getActionStaminaCost, getAttackStyleStaminaCost } from '../core/actionCosts';
import { ATTACK_STYLE_LABEL, fleeChanceIn, hitChanceIn } from '../core/combat';
import type { AttackStyle, Combatant, GameState } from '../core/types';
import {
  canUseSkill,
  getCharacterSkill,
  isSkillReady,
  SKILLS,
  type SkillId,
} from '../core/skills';

export interface AttackActionView {
  style: AttackStyle;
  label: string;
  hitPct: number;
  cost: number;
  disabled: boolean;
  isHeavy: boolean;
}

export interface CombatActionBarView {
  attacks: AttackActionView[];
  guard: { cost: number; disabled: boolean };
  flee: { chancePct: number; cost: number };
  skill: {
    id: SkillId;
    name: string;
    ready: boolean;
    cooldown: number;
    usable: boolean;
    cost: number;
  } | null;
  /** 行动栏下方的合法提示（零体力 / 体力不足等情形） */
  legalNote: string;
}

/**
 * 纯展示层：把核心的攻击 / 防御 / 脱离 / 技能结算口径收束成行动栏视图模型。
 *
 * 命中率 / 脱离率直接复用 core 的 `hitChanceIn` / `fleeChanceIn`，与结算同源，
 * 保证行动栏上提示的数字与实际战斗一致（Phase 3A 不变量）。
 * 不读取 `zone.loot`、NPC 位置或意图 —— 只呈现玩家自身与当前可见对手的合法字段。
 */
export function buildCombatActionBar(
  state: GameState,
  player: Combatant,
  enemy: Combatant,
): CombatActionBarView {
  const ATTACK_STYLES: AttackStyle[] = ['quick', 'normal', 'heavy'];

  const attacks: AttackActionView[] = ATTACK_STYLES.map((style) => {
    const cost = getAttackStyleStaminaCost(style);
    // Phase 3A 不变量：UI 命中率必须与核心结算同源（含世界事件修正）
    const hit = Math.round(hitChanceIn(state, player, enemy, style) * 100);
    const disabled = player.stamina < cost;
    return {
      style,
      label: ATTACK_STYLE_LABEL[style],
      hitPct: hit,
      cost,
      disabled,
      isHeavy: style === 'heavy',
    };
  });

  const guardCost = getActionStaminaCost(player, 'GUARD');
  const guardDisabled = player.stamina < guardCost;
  const flee = Math.round(fleeChanceIn(state, player, enemy) * 100);
  const fleeCost = getActionStaminaCost(player, 'FLEE');

  const skillId = getCharacterSkill(player.characterId);
  let skill: CombatActionBarView['skill'] = null;
  if (skillId) {
    const def = SKILLS[skillId];
    skill = {
      id: skillId,
      name: def.name,
      ready: isSkillReady(player, skillId),
      cooldown: player.skillCooldowns[skillId] ?? 0,
      usable: canUseSkill(player, skillId).ok,
      cost: def.staminaCost,
    };
  }

  // 行动栏下方的合法提示（与 4D-2 遭遇面板同源的措辞）
  const normalCost = getAttackStyleStaminaCost('normal');
  let legalNote: string;
  if (player.stamina >= normalCost) {
    legalNote = '遭遇中仍可在右侧使用消耗品或更换装备。';
  } else if (player.stamina === 0) {
    legalNote = '体力耗尽：防御本回合免费，或免费原地脱离；也可使用消耗品或更换装备。';
  } else if (player.stamina < guardCost) {
    legalNote = `体力不足：速攻或免费脱离仍可用；防御需要 ${guardCost} 点体力。`;
  } else {
    legalNote = '体力不足以普通攻击 —— 速攻、防御或免费脱离仍可用。';
  }

  return {
    attacks,
    guard: { cost: guardCost, disabled: guardDisabled },
    flee: { chancePct: flee, cost: fleeCost },
    skill,
    legalNote,
  };
}
