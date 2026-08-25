import { isNpcRoleplayConfigUsable, sanitizeNpcLine } from './provider';
import type {
  NpcRoleplayConfig,
  NpcRoleplayContext,
  NpcRoleplayProvider,
} from './types';

/**
 * Phase 4W — OpenAI-compatible chat-completions provider.
 *
 * Presentation-only async enrichment: the request body is built solely from
 * the sanitized context (never GameState), the API key travels only in the
 * Authorization header of this request, and any failure (network / HTTP /
 * malformed / unusable content) rejects so the caller falls back silently.
 */

const SYSTEM_PROMPT = [
  '你是大逃杀游戏中一名 NPC 的台词生成器。',
  '根据给定的公开情境，输出该 NPC 说的一句中文短台词（约 10-60 字，最多两个短句）。',
  '禁止 Markdown、JSON、引号、系统说明、数字数值、地点方位、装备或体力信息。',
  '不要描述动作结果或复述战报，只写角色此刻的口吻。直接输出台词本身。',
].join('');

function userPromptOf(context: NpcRoleplayContext): string {
  const triggerLabel: Record<NpcRoleplayContext['trigger'], string> = {
    encounter_start: '与对手刚刚进入遭遇',
    npc_attack_hit: '刚刚命中了对手',
    npc_attack_miss: '攻击被对手避开',
    npc_guard: '转入防御姿态',
    npc_exposed: '被对手逼出了破绽',
    npc_flee: '选择脱离交战',
    encounter_resolved: '这场遭遇刚刚结束',
    local_incident_contest: '正在与对手争夺现场的事件物资',
  };
  return [
    `角色名：${context.npcName}`,
    `所在区域名：${context.zoneName}`,
    `此刻情境：${triggerLabel[context.trigger]}`,
    `语气提示：${context.tone}`,
    '请直接输出这句台词。',
  ].join('\n');
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
}

export function createOpenAiCompatibleProvider(config: NpcRoleplayConfig): NpcRoleplayProvider {
  const baseUrl = config.endpoint.replace(/\/+$/, '');
  return {
    id: 'openai-compatible',
    async generateNpcLine(context: NpcRoleplayContext, signal: AbortSignal): Promise<string> {
      // Defence in depth: an unusable config (disabled / blank endpoint /
      // blank model / missing-or-blank API key) must never reach the network,
      // even if this provider was constructed directly. Same rule set as the
      // resolver, so there is no second source of truth.
      if (!isNpcRoleplayConfigUsable(config)) {
        throw new Error('roleplay provider not configured');
      }
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPromptOf(context) },
          ],
          max_tokens: 120,
          temperature: 0.9,
        }),
      });
      if (!response.ok) {
        throw new Error(`roleplay provider HTTP ${response.status}`);
      }
      const data = (await response.json()) as ChatCompletionResponse;
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('roleplay provider malformed response');
      }
      const line = sanitizeNpcLine(content);
      if (line === null) {
        throw new Error('roleplay provider content rejected');
      }
      return line;
    },
  };
}
