import { createGame } from '../src/core/gameState';
import { createStack, addItem } from '../src/core/inventory';
import type { Combatant, GameState } from '../src/core/types';

export const TEST_SEED = 'BR-DEMO-001';

export function newGame(
  seed = TEST_SEED,
  characterId = 'scout',
): GameState {
  return createGame({ seed, playerCharacterId: characterId, playerName: '测试者' });
}

export function player(state: GameState): Combatant {
  const p = state.characters[state.playerId];
  if (!p) throw new Error('找不到玩家');
  return p;
}

export function npcs(state: GameState): Combatant[] {
  return state.turnOrder
    .map((id) => state.characters[id])
    .filter((c): c is Combatant => Boolean(c) && !c!.isPlayer);
}

/** 直接给角色发放物品（测试用） */
export function give(
  state: GameState,
  c: Combatant,
  itemId: string,
  count = 1,
): void {
  for (let i = 0; i < count; i++) {
    addItem(c, createStack(state, itemId, 1));
  }
}

/** 清空背包 */
export function clearInventory(c: Combatant): void {
  c.inventory = [];
  c.equipment = [];
  c.equippedWeaponId = null;
  c.equippedArmorId = null;
}
