import { createGame, getPlayer } from '../../src/core/gameState';
import { addItem, createStack } from '../../src/core/inventory';
import { GAME_CONFIG, GAME_VERSION } from '../../src/data/gameConfig';

/**
 * Deterministic, valid save for the pending-pickup surface.
 * Driving a live search until a full backpack is found is not used for
 * browser evidence: combat and zone closure can end a run first. This fixture
 * still goes through the real save/load and RESOLVE_PICKUP UI paths.
 */
export function pendingPickupFixture(seed = 'PHASE4C11-PENDING'): Record<string, unknown> {
  const state = createGame({
    seed,
    playerCharacterId: 'scout',
    playerName: '待处理拾取验证者',
  });
  const player = getPlayer(state);
  player.inventory = [];
  player.equipment = [];
  player.equippedWeaponId = null;
  player.equippedArmorId = null;

  // stick is non-stackable, so each instance occupies a real inventory slot.
  for (let i = 0; i < GAME_CONFIG.inventorySlots; i += 1) {
    const result = addItem(player, createStack(state, 'stick'));
    if (!result.ok) throw new Error('无法构造满背包夹具');
  }

  player.stamina = player.maxStamina;
  state.pendingPickup = {
    stack: createStack(state, 'iron_pipe'),
    source: 'search',
    zoneId: player.currentZoneId,
  };

  return {
    version: GAME_VERSION,
    savedAt: 1,
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state,
  };
}
