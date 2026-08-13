import type { WildSpecialAbilityId } from '../core/types';

export interface WildSpecialAbilityDef {
  id: WildSpecialAbilityId;
  name: string;
  telegraph: string;
  attackBonus: number;
  damageMult: number;
}

/** Data-only special moves. Execution remains in canonical wildCombat.ts. */
export const WILD_SPECIAL_ABILITIES: Readonly<Record<WildSpecialAbilityId, WildSpecialAbilityDef>> = {
  none: { id: 'none', name: '普通攻击', telegraph: '', attackBonus: 0, damageMult: 1 },
  shield_cycle: { id: 'shield_cycle', name: '护盾循环', telegraph: '护盾指示灯亮起，下一回合将进入护盾循环。', attackBonus: 0, damageMult: 1 },
  overcharge: { id: 'overcharge', name: '过载扑杀', telegraph: '战术项圈开始过载，下一回合将进行扑杀。', attackBonus: 5, damageMult: 1.25 },
  toxic_burst: { id: 'toxic_burst', name: '毒性喷发', telegraph: '污染囊体膨胀，下一回合将喷发毒性液体。', attackBonus: 4, damageMult: 1.2 },
  massive_charge: { id: 'massive_charge', name: '重型冲撞', telegraph: '地面传来蓄力震动，下一回合将进行重型冲撞。', attackBonus: 7, damageMult: 1.35 },
  suppression_fire: { id: 'suppression_fire', name: '压制射击', telegraph: '火控模块锁定目标，下一回合将执行压制射击。', attackBonus: 6, damageMult: 1.15 },
};
