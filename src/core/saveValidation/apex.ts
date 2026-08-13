import { APEX_WILD_ENEMY_IDS, tryGetWildEnemy } from '../../data/wildEnemies';
import { isFiniteNumber, isRecord, type ValidationContext } from './types';

/** Validate the persisted schedule as a one-shot, bijective Apex registry. */
export function validateApexState(ctx: ValidationContext): void {
  const { state, zones, fail } = ctx;
  if (!Array.isArray(state.apexSchedule)) {
    fail('state.apexSchedule 必须是数组');
    return;
  }
  const entries = state.apexSchedule as unknown[];
  if (entries.length !== APEX_WILD_ENEMY_IDS.length) fail(`apexSchedule 必须包含 ${APEX_WILD_ENEMY_IDS.length} 个命名 Apex`);
  const seen = new Set<string>();
  const scheduledUids = new Set<string>();
  for (const raw of entries) {
    if (!isRecord(raw)) { fail('apexSchedule 含结构损坏条目'); continue; }
    const defId = raw.defId;
    if (typeof defId !== 'string' || !APEX_WILD_ENEMY_IDS.includes(defId as typeof APEX_WILD_ENEMY_IDS[number])) fail(`apexSchedule 引用了非 Apex 定义（${String(defId)}）`);
    if (typeof defId === 'string' && seen.has(defId)) fail(`apexSchedule 重复定义 ${defId}`);
    if (typeof defId === 'string') seen.add(defId);
    if (!isFiniteNumber(raw.scheduledAt) || !Number.isInteger(raw.scheduledAt) || (raw.scheduledAt as number) < 0) fail(`Apex ${String(defId)} scheduledAt 非法`);
    if (typeof raw.spawned !== 'boolean') fail(`Apex ${String(defId)} spawned 类型非法`);
    if (raw.spawned === false) {
      if (raw.spawnedAt !== null || raw.uid !== null || raw.zoneId !== null) fail(`未生成 Apex ${String(defId)} 不得带生成引用`);
      continue;
    }
    const def = typeof defId === 'string' ? tryGetWildEnemy(defId) : null;
    if (!isFiniteNumber(raw.spawnedAt) || !Number.isInteger(raw.spawnedAt) || (raw.spawnedAt as number) < (raw.scheduledAt as number) || (raw.spawnedAt as number) > (state.time as number)) fail(`Apex ${String(defId)} spawnedAt 非法`);
    if (typeof raw.uid !== 'string' || scheduledUids.has(raw.uid)) fail(`Apex ${String(defId)} UID 非法或重复`);
    if (typeof raw.uid === 'string') scheduledUids.add(raw.uid);
    if (typeof raw.zoneId !== 'string' || !Object.prototype.hasOwnProperty.call(zones, raw.zoneId)) fail(`Apex ${String(defId)} 生成区域非法`);
    if (def && typeof raw.zoneId === 'string' && !def.eligibleZones?.includes(raw.zoneId)) fail(`Apex ${String(defId)} 生成区域不在 eligibleZones`);
    const instance = typeof raw.uid === 'string' ? (state.wildEnemies as Record<string, unknown>)[raw.uid] : null;
    if (!isRecord(instance)) fail(`Apex ${String(defId)} schedule 未找到实例`);
    else if (instance.defId !== defId || instance.zoneId !== raw.zoneId) fail(`Apex ${String(defId)} schedule 与实例不一致`);
  }
  for (const defId of APEX_WILD_ENEMY_IDS) if (!seen.has(defId)) fail(`apexSchedule 缺少 ${defId}`);

  for (const [uid, raw] of Object.entries(state.wildEnemies ?? {})) {
    if (!isRecord(raw)) continue;
    const def = typeof raw.defId === 'string' ? tryGetWildEnemy(raw.defId) : null;
    if (def?.tier !== 'apex') continue;
    const matching = entries.filter((entry) => isRecord(entry) && entry.uid === uid);
    if (matching.length !== 1) fail(`Apex 实例 ${uid} 没有唯一 schedule 归属`);
    const schedule = matching[0];
    if (isRecord(schedule) && schedule.spawned !== true) fail(`Apex 实例 ${uid} 对应 schedule 未标记 spawned`);
    if (raw.status === 'defeated' && raw.dropResolved !== true) fail(`已击败 Apex ${uid} 必须完成掉落解析`);
    if (raw.status === 'defeated' && raw.pendingIntent !== null) fail(`已击败 Apex ${uid} 不得保留 pendingIntent`);
    if (def.signatureDropItemId === undefined) fail(`Apex ${def.id} 缺少签名材料定义`);
  }
}
