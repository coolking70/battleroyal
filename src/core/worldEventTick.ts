/**
 * 世界事件 · 每 tick 实体伤害（Phase 3A-1）。
 *
 * RULE-WE-06：环境伤害必须走 `applyDamage` 唯一入口。
 * 放在独立文件的原因：`vitals → info → worldEvents` 存在既有依赖链，
 * 若 `worldEvents.ts` 直接 import `vitals` 会形成环；本模块作为叶子节点
 * 同时引用 `vitals` 与 `worldEvents`，环自然断开，行为上仍走统一伤害入口。
 *
 * 由 `gameEngine.advanceTime` 在每个时间单位调用。
 */

import { GAME_CONFIG } from '../data/gameConfig';
import { getZoneDef } from '../data/zones';
import { pushEvent } from './events';
import type { GameState } from './types';
import { activeWorldEvents } from './worldEvents';
import { applyDamage } from './vitals';

/**
 * 处理需要实体伤害的世界事件（目前：研究异常）。
 * 研究异常生效期间，每时间单位对**仍在 lab 中**的存活角色造成固定环境伤害。
 * 伤害走 applyDamage 唯一入口（RULE-WE-06），并写入 WORLD_EVENT_DAMAGE 事件。
 */
export function applyWorldEventTickDamage(state: GameState): void {
  const anomaly = activeWorldEvents(state).find(
    (e) => e.eventId === 'research_anomaly',
  );
  if (!anomaly) return;

  const labId = GAME_CONFIG.researchAnomalyZoneId;
  const lab = state.zones[labId];
  if (!lab) return;

  const amount = GAME_CONFIG.researchAnomalyDamagePerTick;
  // 遍历快照，避免 applyDamage 内部改 aliveCharacterIds 造成迭代副作用
  for (const id of [...lab.aliveCharacterIds]) {
    const actor = state.characters[id];
    if (!actor || !actor.alive) continue;
    if (actor.currentZoneId !== labId) continue; // 只有仍在 lab 的人受伤
    const res = applyDamage(state, actor, amount, null, '研究设施异常');
    if (res.damage > 0) {
      pushEvent(state, {
        type: 'WORLD_EVENT_DAMAGE',
        actorId: actor.id,
        zoneId: labId,
        message: `${actor.isPlayer ? '你' : actor.name}在「${getZoneDef(labId).name}」受到研究异常侵蚀，损失 ${res.damage} 点生命。`,
        metadata: { worldEventId: 'research_anomaly', damage: res.damage, died: res.died },
      });
    }
  }
}
