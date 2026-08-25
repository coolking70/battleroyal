import { useState } from 'react';
import { npcRoleplaySettings } from '../npcLlm/roleplay';
import { isNpcRoleplayConfigUsable } from '../npcLlm/provider';

/**
 * Phase 4W — experimental "LLM NPC Roleplay" settings (menu screen).
 *
 * OFF by default. Everything typed here lives in browser memory only: the
 * store is a session singleton, the API key is never written to
 * localStorage / saves / events / URLs, and a page refresh clears it.
 * The layer is presentation-only; turning it OFF restores byte-identical
 * gameplay.
 */
export function NpcRoleplaySettings(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(npcRoleplaySettings.get());

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost"
        data-npc-roleplay-toggle="open"
        onClick={() => setOpen(true)}
      >
        实验：NPC 角色扮演（LLM）{config.enabled ? ' · ON' : ' · OFF'}
      </button>
    );
  }

  const patch = (next: Partial<typeof config>): void => {
    const merged = { ...config, ...next };
    setConfig(merged);
    npcRoleplaySettings.set(next);
  };

  return (
    <div className="npc-roleplay-settings" data-npc-roleplay-panel="">
      <div className="npc-roleplay-head">
        <b>实验：NPC 角色扮演（LLM）</b>
        <label>
          <input
            type="checkbox"
            checked={config.enabled}
            data-npc-roleplay-enabled=""
            onChange={(event) => patch({ enabled: event.target.checked })}
          />
          {config.enabled ? 'ON' : 'OFF'}
        </label>
      </div>
      <p className="npc-roleplay-note">
        仅影响战斗演出文案，不影响任何游戏规则。密钥只保存在当前页面内存，刷新后需重新输入。
      </p>
      {config.enabled && !isNpcRoleplayConfigUsable(config) ? (
        <p className="npc-roleplay-note" data-npc-roleplay-incomplete="">
          Endpoint、Model、API Key 三项缺一不可；未填全时不会发起任何请求。
        </p>
      ) : null}
      <label className="npc-roleplay-field">
        <span>OpenAI 兼容 Endpoint</span>
        <input
          type="text"
          value={config.endpoint}
          data-npc-roleplay-endpoint=""
          placeholder="https://api.example.com/v1"
          onChange={(event) => patch({ endpoint: event.target.value.trim() })}
        />
      </label>
      <label className="npc-roleplay-field">
        <span>Model</span>
        <input
          type="text"
          value={config.model}
          data-npc-roleplay-model=""
          placeholder="model-id"
          onChange={(event) => patch({ model: event.target.value.trim() })}
        />
      </label>
      <label className="npc-roleplay-field">
        <span>API Key（仅内存）</span>
        <input
          type="password"
          value={config.apiKey ?? ''}
          data-npc-roleplay-key=""
          placeholder="不写入存档 / 不持久化"
          onChange={(event) => patch({ apiKey: event.target.value === '' ? undefined : event.target.value })}
        />
      </label>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          npcRoleplaySettings.reset();
          setConfig(npcRoleplaySettings.get());
        }}
      >
        恢复默认（OFF）
      </button>
    </div>
  );
}
