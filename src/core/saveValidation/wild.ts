import { tryGetWildEnemy } from '../../data/wildEnemies';
import { isFiniteNumber, isRecord, type ValidationContext } from './types';

const WILD_STAT_FIELDS = [
  'wildEncounterCount', 'wildKillCount', 'wildFleeCount', 'wildDamageTaken',
  'wildDropsCreated', 'wildMaterialPickups', 'wildCrafts', 'wildPlayerDeaths',
  'eliteEncounterCount', 'eliteKillCount', 'apexSpawnedCount', 'apexEncounterCount',
  'apexKillCount', 'apexFleeCount', 'signatureDrops', 'signaturePickups', 'signatureCrafts',
] as const;
const INSTANCE_STATUS_IDS = new Set(['enraged', 'evasive', 'armored']);

export function validateWildState(ctx: ValidationContext): void {
  const { state, zones, characters, zoneIds, fail } = ctx;
  if (!isRecord(state.wildEnemies)) {
    fail('state.wildEnemies 必须是对象');
    return;
  }
  if (!isFiniteNumber(state.wildUidSeq) || !Number.isInteger(state.wildUidSeq) || (state.wildUidSeq as number) < 0) {
    fail('state.wildUidSeq 必须是非负整数');
  }
  const wild = state.wildEnemies as Record<string, unknown>;
  const listed = new Map<string, string>();
  for (const [zoneId, rawZone] of Object.entries(zones)) {
    if (!isRecord(rawZone) || !Array.isArray(rawZone.wildEnemyIds)) {
      fail(`区域 ${zoneId} 的 wildEnemyIds 类型错误`);
      continue;
    }
    const local = new Set<string>();
    for (const uid of rawZone.wildEnemyIds) {
      if (typeof uid !== 'string' || !Object.prototype.hasOwnProperty.call(wild, uid)) {
        fail(`区域 ${zoneId} 引用了未知野外敌人（${String(uid)}）`);
        continue;
      }
      if (local.has(uid)) fail(`区域 ${zoneId} 重复列出野外敌人 ${uid}`);
      local.add(uid);
      const first = listed.get(uid);
      if (first && first !== zoneId) fail(`野外敌人 ${uid} 同时出现在区域 ${first} 与 ${zoneId}`);
      listed.set(uid, zoneId);
    }
  }

  let maxSeq = -1;
  for (const [uid, raw] of Object.entries(wild)) {
    if (Object.prototype.hasOwnProperty.call(characters, uid)) fail(`野外敌人 ${uid} 与参赛者 id 冲突`);
    const match = /^w(\d+)$/.exec(uid);
    if (!match) fail(`野外敌人 UID 非法：${uid}`);
    else maxSeq = Math.max(maxSeq, Number.parseInt(match[1]!, 10));
    if (!isRecord(raw)) {
      fail(`野外敌人 ${uid} 结构损坏`);
      continue;
    }
    if (raw.uid !== uid) fail(`野外敌人键 ${uid} 与实例 uid 不一致`);
    const def = typeof raw.defId === 'string' ? tryGetWildEnemy(raw.defId) : null;
    if (!def) fail(`野外敌人 ${uid} 引用了未知定义（${String(raw.defId)}）`);
    if (typeof raw.zoneId !== 'string' || !zoneIds.has(raw.zoneId)) fail(`野外敌人 ${uid} 区域非法（${String(raw.zoneId)}）`);
    if (listed.get(uid) !== raw.zoneId) fail(`野外敌人 ${uid} 的 zoneId 与区域名单不一致`);
    if (!isFiniteNumber(raw.hp) || !Number.isInteger(raw.hp) || (raw.hp as number) < 0 || (def && (raw.hp as number) > def.maxHp)) fail(`野外敌人 ${uid} 的 hp 越界`);
    if (raw.status !== 'alive' && raw.status !== 'defeated') fail(`野外敌人 ${uid} 状态非法`);
    if (raw.status === 'alive' && raw.hp === 0) fail(`存活野外敌人 ${uid} 的 hp 不得为 0`);
    if (raw.status === 'defeated' && raw.hp !== 0) fail(`已击败野外敌人 ${uid} 的 hp 必须为 0`);
    if (typeof raw.guarding !== 'boolean' || typeof raw.dropResolved !== 'boolean') fail(`野外敌人 ${uid} 的布尔状态损坏`);
    if (raw.pendingIntent !== null && !['shield_cycle', 'overcharge', 'toxic_burst', 'massive_charge', 'suppression_fire'].includes(String(raw.pendingIntent))) fail(`野外敌人 ${uid} pendingIntent 非法`);
    if (def && def.specialAbilityId === 'none' && raw.pendingIntent !== null) fail(`野外敌人 ${uid} 无特殊技却携带 pendingIntent`);
    if (def && def.specialAbilityId !== 'none' && raw.pendingIntent !== null && raw.pendingIntent !== def.specialAbilityId) fail(`野外敌人 ${uid} pendingIntent 与自身特殊技不一致`);
    if (!isFiniteNumber(raw.abilityCharges) || !Number.isInteger(raw.abilityCharges) || (raw.abilityCharges as number) < 0) fail(`野外敌人 ${uid} abilityCharges 非法`);
    if (raw.defeatedAtTime !== null && (!isFiniteNumber(raw.defeatedAtTime) || !Number.isInteger(raw.defeatedAtTime) || (raw.defeatedAtTime as number) < 0 || (raw.defeatedAtTime as number) > (state.time as number))) fail(`野外敌人 ${uid} defeatedAtTime 非法`);
    if (raw.status === 'defeated' && raw.defeatedAtTime === null) fail(`已击败野外敌人 ${uid} 缺少 defeatedAtTime`);
    if (raw.status === 'defeated' && raw.pendingIntent !== null) fail(`已击败野外敌人 ${uid} 不得保留 pendingIntent`);
    if (!Array.isArray(raw.statusEffects)) {
      fail(`野外敌人 ${uid} statusEffects 类型错误`);
    } else {
      const seen = new Set<string>();
      for (const effect of raw.statusEffects) {
        if (!isRecord(effect) || typeof effect.id !== 'string' || !INSTANCE_STATUS_IDS.has(effect.id)) {
          fail(`野外敌人 ${uid} 含未知状态`);
          continue;
        }
        if (seen.has(effect.id)) fail(`野外敌人 ${uid} 状态重复`);
        seen.add(effect.id);
        if (!isFiniteNumber(effect.remaining) || !Number.isInteger(effect.remaining) || (effect.remaining as number) <= 0 || (effect.remaining as number) > 20) fail(`野外敌人 ${uid} 状态持续时间非法`);
      }
    }
  }
  for (const uid of Object.keys(wild)) if (!listed.has(uid)) fail(`野外敌人 ${uid} 未列入任何区域`);
  if (isFiniteNumber(state.wildUidSeq) && maxSeq >= (state.wildUidSeq as number)) fail('wildUidSeq 没有领先现存野外 UID');

  if (!isRecord(state.stats)) fail('state.stats 类型错误');
  else for (const field of WILD_STAT_FIELDS) {
    const value = state.stats[field];
    if (!isFiniteNumber(value) || (value as number) < 0) fail(`state.stats.${field} 必须为非负数`);
  }
  for (const [id, raw] of Object.entries(characters)) {
    if (!isRecord(raw) || !isRecord(raw.stats) || !isFiniteNumber(raw.stats.wildKills) || (raw.stats.wildKills as number) < 0) fail(`角色 ${id} 的 stats.wildKills 必须为非负数`);
  }

  const encounter = state.encounter;
  if (encounter !== null && encounter !== undefined) {
    if (!isRecord(encounter)) return;
    if (encounter.targetKind !== 'contestant' && encounter.targetKind !== 'wild') fail('encounter.targetKind 非法或缺失');
    if (encounter.targetKind === 'wild') {
      const enemy = typeof encounter.enemyId === 'string' ? wild[encounter.enemyId] : null;
      if (!isRecord(enemy)) fail(`野外遭遇指向未知 UID（${String(encounter.enemyId)}）`);
      else if (encounter.resolved === false) {
        if (enemy.status !== 'alive') fail('未解决的野外遭遇指向非存活敌人');
        if (enemy.zoneId !== encounter.zoneId) fail('野外遭遇区域与敌人区域不一致');
      }
    }
  }

  if (Array.isArray(state.events)) for (const event of state.events) {
    if (!isRecord(event) || typeof event.type !== 'string') continue;
    if (event.type.startsWith('WILD_')) {
      const uid = isRecord(event.metadata) ? event.metadata.wildUid : null;
      if (typeof uid !== 'string' || !Object.prototype.hasOwnProperty.call(wild, uid)) fail(`野外事件 ${String(event.id)} 引用了未知 UID`);
      continue;
    }
    if (event.type !== 'APEX_DEFEATED') continue;

    const metadata = isRecord(event.metadata) ? event.metadata : null;
    const defId = metadata?.wildDefId;
    const def = typeof defId === 'string' ? tryGetWildEnemy(defId) : null;
    if (!def || def.tier !== 'apex') fail(`APEX_DEFEATED 引用了非 Apex 定义（${String(defId)}）`);
    if (metadata?.tier !== 'apex') fail(`APEX_DEFEATED ${String(event.id)} 的 tier 必须为 apex`);
    if (metadata?.zoneId !== event.zoneId) fail(`APEX_DEFEATED ${String(event.id)} 的 metadata.zoneId 与 event.zoneId 不一致`);

    const schedule = Array.isArray(state.apexSchedule)
      ? (state.apexSchedule as unknown[]).find((entry) => isRecord(entry) && entry.defId === defId)
      : null;
    if (!isRecord(schedule) || schedule.spawned !== true || typeof schedule.uid !== 'string') {
      fail(`APEX_DEFEATED ${String(event.id)} 没有对应的已生成 schedule`);
    } else {
      if (event.zoneId !== schedule.zoneId) fail(`APEX_DEFEATED ${String(event.id)} 的区域与 schedule 不一致`);
      const instance = wild[schedule.uid];
      if (!isRecord(instance) || instance.status !== 'defeated') fail(`APEX_DEFEATED ${String(event.id)} 对应 Apex 实例未击败`);
    }
    for (const key of ['wildUid', 'itemId', 'count', 'hp', 'damage', 'pendingIntent', 'abilityCharges', 'killerInventory', 'signatureDropItemId', 'lootOwnership', 'groundItemUid']) {
      if (metadata && Object.prototype.hasOwnProperty.call(metadata, key)) fail(`APEX_DEFEATED ${String(event.id)} 不得暴露 ${key}`);
    }
  }
}
