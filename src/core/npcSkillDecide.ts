/**
 * NPC 技能决策（Phase 3A Step 4）。
 *
 * 从 `npcDecide.ts` 拆分出来（Step 13：单文件 ≤ 500 行不变量）。
 * 只负责「要不要在这个时机开技能」的判断，不产生任何副作用：
 *  - `npcSurvivalSkill`：非战斗时机的技能决策；
 *  - `npcCombatSkill`：开打前的技能决策（斗士肾上腺素）。
 *
 * 新技能不再是清一色的「回血 / 加伤」，触发条件必须贴着各自的战略维度：
 *  - 医学生「紧急处置」：**手里有药**且血量吃紧才开 —— 它放大的是治疗品，
 *    空着背包开等于浪费一个行动和一次冷却。
 *  - 工程师「野外工造」：**马上就要合成、但体力刚好不够**时开，
 *    这正是「免体力合成」唯一有价值的时刻。
 *  - 侦察员「警觉侦察」：**两眼一抹黑**（不知道任何对手在哪）时开，
 *    信息本身就是它的产出。
 *  - 斗士「肾上腺素」：纯战斗节奏技能，见 `npcCombatSkill` —— 它买的是
 *    **连续出手的体力**，只有在「打得动、但体力见底」时才划算；血量太低时
 *    开等于自杀（状态期间自身受伤 +25%），所以设了健康度下限。
 */

import { tryGetRecipe } from '../data/recipes';
import { SKILLS, getCharacterSkill, isSkillReady, type SkillId } from './skills';
import { findBestHealItem } from './consumables';
import { craftStaminaCost, hasRoomForOutput } from './crafting';
import { hasIngredients } from './inventory';
import type { Combatant, GameState } from './types';

/** 技能通用前置：拥有 + 冷却好了 + 付得起体力 */
function readySkill(npc: Combatant): SkillId | null {
  const skillId = getCharacterSkill(npc.characterId);
  if (!skillId || !isSkillReady(npc, skillId)) return null;
  if (npc.stamina < SKILLS[skillId].staminaCost) return null;
  return skillId;
}

/** 背包里是否有能回血的消耗品（决定「紧急处置」值不值得开） */
function hasHealingConsumable(npc: Combatant): boolean {
  return findBestHealItem(npc) != null;
}

/** 非战斗时机的技能决策 */
export function npcSurvivalSkill(state: GameState, npc: Combatant): SkillId | null {
  const skillId = readySkill(npc);
  if (!skillId) return null;
  const hpRatio = npc.hp / npc.maxHp;

  switch (skillId) {
    case 'emergency_treatment': {
      // emergency_treatment does not clear DoT; bleeding alone is not a valid
      // trigger. The skill is useful when the NPC is actually low on HP and
      // has a healing consumable to amplify afterward.
      return hpRatio < 0.6 && hasHealingConsumable(npc) ? skillId : null;
    }

    case 'field_craft': {
      const planRecipe = npc.plannedRecipeId ? tryGetRecipe(npc.plannedRecipeId) : null;
      const readyToCraft =
        planRecipe != null &&
        hasIngredients(npc, planRecipe.ingredients) &&
        hasRoomForOutput(npc, planRecipe);
      // 只在「材料齐了但体力不够付合成费」这一刻开，否则等于白扔一个行动
      return readyToCraft && npc.stamina < craftStaminaCost(npc) + 2 ? skillId : null;
    }

    case 'scout_recon': {
      // 只要还认得一个活着的对手，就没必要再花体力扫一遍
      const knowsSomeone = npc.knownEnemies.some(
        (id) => state.characters[id]?.alive === true,
      );
      return !knowsSomeone ? skillId : null;
    }

    default:
      return null;
  }
}

/** 开打前的技能决策（只剩斗士肾上腺素） */
export function npcCombatSkill(npc: Combatant): SkillId | null {
  const skillId = readySkill(npc);
  if (!skillId) return null;
  const hpRatio = npc.hp / npc.maxHp;

  if (skillId !== 'adrenaline') return null;
  const staminaRatio = npc.stamina / npc.maxStamina;
  // 健康 + 体力吃紧 = 肾上腺素的黄金窗口
  return hpRatio > 0.55 && staminaRatio < 0.6 ? skillId : null;
}
