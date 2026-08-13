import { EXTRACTION_ZONE_ID } from '../../data/victoryConditions';
import { isFiniteNumber, isRecord, type ValidationContext } from './types';

function rawItemCount(raw: Record<string, unknown>, itemId: string): number {
  const inventory = Array.isArray(raw.inventory) ? raw.inventory : [];
  return inventory.reduce((sum, stack) => {
    if (!isRecord(stack) || stack.itemId !== itemId || typeof stack.count !== 'number') return sum;
    return sum + stack.count;
  }, 0);
}

/** Validate the persisted winner latch and the public extraction session. */
export function validateVictoryReferences(ctx: ValidationContext): void {
  const { state, characters, charIds, fail } = ctx;
  const victory = state.victory;
  if (isRecord(victory)) {
    const winnerId = victory.winnerId;
    const type = victory.type;
    const declaredAtTime = victory.declaredAtTime;
    const validTypes = new Set(['last_survivor', 'extraction', 'research']);
    if (winnerId !== null && winnerId !== undefined && (typeof winnerId !== 'string' || !charIds.has(winnerId))) {
      fail(`state.victory.winnerId 引用了不存在的角色（${String(winnerId)}）`);
    }
    if (type !== null && type !== undefined && (typeof type !== 'string' || !validTypes.has(type))) {
      fail(`state.victory.type 非法（${String(type)}）`);
    }
    if ((winnerId === null) !== (type === null) || (winnerId === null) !== (declaredAtTime === null)) {
      fail('state.victory 的 winnerId/type/declaredAtTime 必须同时为空或同时存在');
    }
    if (typeof winnerId === 'string') {
      const winner = characters[winnerId];
      if (!isRecord(winner) || winner.alive !== true) fail('state.victory.winnerId 必须指向存活角色');
    }
  }

  const extraction = state.activeExtraction;
  if (extraction === null || extraction === undefined) return;
  if (!isRecord(extraction)) {
    fail('state.activeExtraction 结构损坏');
    return;
  }
  if (typeof extraction.callerId !== 'string' || !charIds.has(extraction.callerId)) {
    fail(`state.activeExtraction.callerId 非法（${String(extraction.callerId)}）`);
  }
  if (extraction.zoneId !== EXTRACTION_ZONE_ID) {
    fail(`state.activeExtraction.zoneId 必须是 ${EXTRACTION_ZONE_ID}`);
  }
  if (extraction.phase !== 'called' && extraction.phase !== 'ready') {
    fail(`state.activeExtraction.phase 非法（${String(extraction.phase)}）`);
  }
  const caller = typeof extraction.callerId === 'string' ? characters[extraction.callerId] : null;
  if (isRecord(caller)) {
    if (caller.alive !== true || caller.currentZoneId !== EXTRACTION_ZONE_ID) {
      fail('activeExtraction 的 caller 必须存活且位于车站');
    }
    if (rawItemCount(caller, 'extraction_beacon') < 1) {
      fail('activeExtraction 的 caller 必须持有撤离信标');
    }
  }
  if (isFiniteNumber(extraction.startedAtTime) && isFiniteNumber(extraction.readyAtTime) && extraction.readyAtTime <= extraction.startedAtTime) {
    fail('activeExtraction.readyAtTime 必须晚于 startedAtTime');
  }
}
