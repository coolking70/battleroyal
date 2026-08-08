import { GAME_CONFIG } from '../data/gameConfig';
import { ZONE_IDS, getZoneDef } from '../data/zones';
import { applyDamage } from './combat';
import { pushEvent } from './events';
import { aliveCharacters } from './gameState';
import type { SeededRandom } from './random';
import type { GameState, ZoneStatus } from './types';

/** 取某个区域的状态（不存在时按安全处理） */
export function zoneStatusOf(state: GameState, zoneId: string): ZoneStatus {
  return state.zones[zoneId]?.status ?? 'safe';
}

export function safeZoneIds(state: GameState): string[] {
  return ZONE_IDS.filter((id) => zoneStatusOf(state, id) === 'safe');
}

export function restrictedZoneIds(state: GameState): string[] {
  return ZONE_IDS.filter((id) => zoneStatusOf(state, id) === 'restricted');
}

/**
 * 在给定的「假想状态表」下，从 from 出发能否在 maxDepth 步内到达一个安全区域。
 * 正式禁区视为不可通行（预警区仍可通行）。
 */
function canReachSafe(
  statusMap: Record<string, ZoneStatus>,
  from: string,
  maxDepth: number,
): boolean {
  if (statusMap[from] === 'safe') return true;
  const visited = new Set<string>([from]);
  let frontier = [from];
  for (let depth = 0; depth < maxDepth; depth++) {
    const next: string[] = [];
    for (const zoneId of frontier) {
      for (const adj of getZoneDef(zoneId).adjacent) {
        if (visited.has(adj)) continue;
        visited.add(adj);
        if (statusMap[adj] === 'safe') return true;
        if (statusMap[adj] !== 'restricted') next.push(adj);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return false;
}

/**
 * 选出下一个进入预警的区域。
 *
 * 约束：
 * - 只能从当前仍为「安全」的区域中挑选
 * - 挑选后必须至少保留 minSafeZones 个安全区域
 * - 挑选后每名存活角色都要能在 2 步内到达某个安全区域，避免所有人无路可走
 * - 使用种子随机数
 */
export function pickNextWarningZone(
  state: GameState,
  rng: SeededRandom,
): string | null {
  const safe = safeZoneIds(state);
  if (safe.length <= GAME_CONFIG.minSafeZones) return null;

  const baseStatus: Record<string, ZoneStatus> = {};
  for (const id of ZONE_IDS) baseStatus[id] = zoneStatusOf(state, id);

  const alive = aliveCharacters(state);
  const candidates: string[] = [];

  for (const candidate of safe) {
    const hypothetical: Record<string, ZoneStatus> = { ...baseStatus };
    // 预警区最终会变成禁区，按最坏情况评估
    hypothetical[candidate] = 'restricted';
    const remainingSafe = ZONE_IDS.filter((id) => hypothetical[id] === 'safe');
    if (remainingSafe.length < GAME_CONFIG.minSafeZones) continue;

    const everyoneHasWayOut = alive.every((c) =>
      canReachSafe(hypothetical, c.currentZoneId, 2),
    );
    if (everyoneHasWayOut) candidates.push(candidate);
  }

  // 找不到「人人有路」的候选时，退化为只保证安全区数量下限
  const pool = candidates.length > 0 ? candidates : safe;
  return rng.pick(pool);
}

/** 公布一个新的预警区域 */
export function announceWarning(state: GameState, rng: SeededRandom): boolean {
  const zoneId = pickNextWarningZone(state, rng);
  if (!zoneId) return false;
  const zone = state.zones[zoneId];
  if (!zone) return false;

  zone.status = 'warning';
  zone.warningAtTime = state.time;
  pushEvent(state, {
    type: 'ZONE_WARNING',
    zoneId,
    message: `广播：${getZoneDef(zoneId).name} 将在 ${GAME_CONFIG.zoneWarningDuration} 个时间单位后封锁。`,
    metadata: { zoneId, effectiveAt: state.time + GAME_CONFIG.zoneWarningDuration },
  });
  return true;
}

/** 预警到期 -> 正式禁区 */
export function promoteWarnings(state: GameState): void {
  for (const zoneId of ZONE_IDS) {
    const zone = state.zones[zoneId];
    if (!zone || zone.status !== 'warning') continue;
    if (zone.warningAtTime === null) continue;
    if (state.time >= zone.warningAtTime + GAME_CONFIG.zoneWarningDuration) {
      zone.status = 'restricted';
      zone.restrictedAtTime = state.time;
      pushEvent(state, {
        type: 'ZONE_RESTRICTED',
        zoneId,
        message: `${getZoneDef(zoneId).name} 已成为禁区，停留将持续受到伤害。`,
        metadata: { zoneId },
      });
    }
  }
}

/** 当前禁区每时间单位的伤害（终局阶段会被放大） */
export function zoneDamagePerTick(state: GameState): number {
  const base = GAME_CONFIG.zoneDamagePerTick;
  return state.phase === 'finale'
    ? Math.round(base * GAME_CONFIG.zoneDamageFinaleMultiplier)
    : base;
}

/** 对停留在正式禁区中的角色造成伤害 */
export function applyZoneDamage(state: GameState): void {
  const damage = zoneDamagePerTick(state);
  for (const c of aliveCharacters(state)) {
    const zone = state.zones[c.currentZoneId];
    if (!zone || zone.status !== 'restricted') continue;
    const before = c.hp;
    const res = applyDamage(state, c, damage, null, '禁区侵蚀');
    pushEvent(state, {
      type: 'ZONE_DAMAGE',
      actorId: c.id,
      zoneId: zone.id,
      message: `${c.name} 在${getZoneDef(zone.id).name}的禁区中受到 ${res.damage} 点伤害（${before} → ${c.hp}）。`,
      metadata: { damage: res.damage, died: res.died },
    });
  }
}

/**
 * 每个时间单位的禁区更新。
 * 顺序：预警到期 -> 禁区伤害 -> 公布新预警。
 */
export function updateRestrictedZones(state: GameState, rng: SeededRandom): void {
  promoteWarnings(state);
  applyZoneDamage(state);

  if (state.time >= state.nextZoneEventTime) {
    const announced = announceWarning(state, rng);
    state.nextZoneEventTime = state.time + GAME_CONFIG.zoneEventInterval;
    if (!announced) {
      // 已经无法再封锁（安全区已到下限），把下一次事件推远，避免反复空转
      state.nextZoneEventTime = Number.MAX_SAFE_INTEGER;
    }
  }
}

/** 距离下一次禁区公布还有多少时间单位（无后续时返回 null） */
export function nextZoneCountdown(state: GameState): number | null {
  if (state.nextZoneEventTime === Number.MAX_SAFE_INTEGER) return null;
  return Math.max(0, state.nextZoneEventTime - state.time);
}
