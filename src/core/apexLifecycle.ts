import type { GameState, WildEnemyDef } from './types';
import { pushEvent } from './events';
import { getZoneDef } from '../data/zones';

/**
 * The only defeat fact that global acquisition planning may consume.
 * Combat-local WILD_DEFEATED events and live Wild instances are intentionally
 * not part of this public-information boundary.
 */
export function isApexPubliclyDefeated(state: GameState, wildDefId: string): boolean {
  return state.events.some((event) =>
    event.type === 'APEX_DEFEATED' && event.metadata.wildDefId === wildDefId,
  );
}

/** Publish the minimal global lifecycle transition for a named Apex. */
export function publishApexDefeat(
  state: GameState,
  def: WildEnemyDef,
  zoneId: string,
): void {
  if (def.tier !== 'apex' || isApexPubliclyDefeated(state, def.id)) return;
  pushEvent(state, {
    type: 'APEX_DEFEATED',
    zoneId,
    message: `公共广播：位于${getZoneDef(zoneId).name}的命名威胁「${def.name}」已被消灭。`,
    metadata: { wildDefId: def.id, tier: 'apex', zoneId },
    importance: 'critical',
  });
}
