import { experienceToNextLevel } from '../core/progression';
import type { Combatant, Command } from '../core/types';

/**
 * 只比较玩家命令前后的自身状态；不读取或格式化 NPC 的成长字段。
 * 用于把 4F-1 已结算的经验变化接到既有 Toast 提示，不改变核心事件流。
 */
function totalEarnedExperience(actor: Combatant): number {
  let total = actor.exp;
  for (let level = 1; level < actor.level; level += 1) {
    total += experienceToNextLevel(level);
  }
  return total;
}

export function playerExperienceDelta(before: Combatant, after: Combatant): number {
  return Math.max(0, totalEarnedExperience(after) - totalEarnedExperience(before));
}

function sourceLabel(command: Command): string | null {
  switch (command.type) {
    case 'ATTACK':
    case 'ATTACK_NEARBY':
      return '战斗结算';
    case 'CRAFT':
      return '合成成长';
    case 'SEARCH':
    case 'MOVE':
      return '探索成长';
    case 'REST':
      return '休息不会获得经验';
    default:
      return null;
  }
}

export interface GrowthFeedbackInput {
  command: Command;
  before: Combatant;
  after: Combatant;
  message: string | null;
  ok: boolean;
}

/** 为玩家操作拼接可感知的成长来源 / 升级收益；文本仍是 UI 层的临时反馈。 */
export function growthFeedbackText({
  command,
  before,
  after,
  message,
  ok,
}: GrowthFeedbackInput): string | null {
  const parts: string[] = [];
  if (message) parts.push(message);
  if (!ok) return parts.length > 0 ? parts.join(' · ') : null;

  const source = sourceLabel(command);
  const experienceDelta = playerExperienceDelta(before, after);
  if (source === '休息不会获得经验') {
    parts.push(source);
  } else if (source && experienceDelta > 0) {
    parts.push(`${source} +${experienceDelta} EXP`);
  }

  if (after.kills > before.kills) {
    parts.push('击杀额外奖励');
  }

  if (after.level > before.level) {
    parts.push(
      `升级 Lv.${after.level}！攻击 +${Math.max(0, after.attack - before.attack)} · ` +
      `防御 +${Math.max(0, after.defense - before.defense)} · ` +
      `最大生命 +${Math.max(0, after.maxHp - before.maxHp)}`,
    );
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}
