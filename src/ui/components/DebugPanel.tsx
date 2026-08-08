import { Fragment, useState } from 'react';
import { auditItemIntegrity } from '../../core/itemIntegrity';
import {
  estimatePower,
  ATTACK_STYLE_LABEL,
  fleeChanceOf,
  hitChanceOf,
} from '../../core/combat';
import {
  getAttackStyleStaminaCost,
  getActionStaminaCost,
} from '../../core/actionCosts';
import {
  SKILLS,
  getCharacterSkill,
} from '../../core/skills';
import { listIntel, noiseLevelOf, NOISE_LABEL } from '../../core/info';
import { allCharacters, getPlayer } from '../../core/gameState';
import { nextZoneCountdown } from '../../core/restrictedZones';
import { validateSaveData, type ValidationReport } from '../../core/saveLoad';
import { tryGetRecipe } from '../../data/recipes';
import { missingIngredients } from '../../core/inventory';
import { tryGetItem } from '../../data/items';
import type { AttackStyle, Combatant, Command, GameState } from '../../core/types';
import { GAME_VERSION } from '../../data/gameConfig';
import { getZoneDef } from '../../data/zones';
import { ZONE_STATUS_LABEL, personalityLabel } from '../../utils/format';

/** 触发一个浏览器下载（非浏览器环境静默忽略） */
function downloadJson(filename: string, data: unknown): void {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // 非浏览器环境（测试）下忽略
  }
}

/** 导出完整存档 JSON */
function exportSaveJson(state: GameState): void {
  downloadJson(`zone-br-export-${state.seed}.json`, {
    version: GAME_VERSION,
    savedAt: Date.now(),
    seed: state.seed,
    time: state.time,
    rngState: state.rngState,
    state,
  });
}

/** 导出完整事件 JSON */
function exportEventsJson(state: GameState): void {
  downloadJson(`zone-br-events-${state.seed}.json`, state.events);
}

/** 导出对局摘要 JSON（Phase 2A-1：三种导出之一） */
function exportSummaryJson(state: GameState): void {
  const player = getPlayer(state);
  downloadJson(`zone-br-summary-${state.seed}.json`, {
    seed: state.seed,
    version: state.version,
    time: state.time,
    status: state.status,
    phase: state.phase,
    endReason: state.endReason,
    player: {
      id: player.id,
      name: player.name,
      characterId: player.characterId,
      hp: player.hp,
      maxHp: player.maxHp,
      stamina: player.stamina,
      zoneId: player.currentZoneId,
      kills: player.kills,
      alive: player.alive,
      stats: player.stats,
      inventory: player.inventory,
      equipment: player.equipment,
    },
    zones: Object.fromEntries(
      Object.entries(state.zones).map(([id, z]) => [
        id,
        {
          status: z.status,
          supply: z.supply,
          initialLootCount: z.initialLootCount,
          remainingLootCount: z.remainingLootCount,
          aliveCharacterIds: z.aliveCharacterIds,
          groundItems: z.groundItems.length,
          noise: z.noiseLevel,
        },
      ]),
    ),
    deathOrder: state.deathOrder,
    events: state.events.length,
  });
}

interface DebugPanelProps {
  state: GameState;
  saveError: string | null;
  onCommand: (command: Command) => void;
}

/**
 * 调试面板（仅在 URL 带 ?debug=1 时挂载）。
 * Phase 2A-1：三种 JSON 导出、复制种子、运行存档验证、物品完整性检查、
 * 区域可展开明细、NPC 计划详情。
 */
export function DebugPanel({
  state,
  saveError,
  onCommand,
}: DebugPanelProps): JSX.Element {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [validation, setValidation] = useState<ValidationReport | null>(null);

  if (!open) {
    return (
      <button className="btn btn-sm debug-toggle" onClick={() => setOpen(true)}>
        DEBUG
      </button>
    );
  }

  const player = getPlayer(state);
  const npcs = allCharacters(state).filter((c) => !c.isPlayer);
  const countdown = nextZoneCountdown(state);

  // 完整性检查：物品守恒不变量，纯本地审计
  const integrity = auditItemIntegrity(state);

  const copySeed = (): void => {
    try {
      void navigator.clipboard?.writeText(state.seed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* 非浏览器环境忽略 */
    }
  };

  const runSaveValidation = (): void => {
    setValidation(
      validateSaveData({
        version: GAME_VERSION,
        savedAt: Date.now(),
        seed: state.seed,
        time: state.time,
        rngState: state.rngState,
        state,
      }),
    );
  };

  return (
    <aside className="debug">
      <div className="debug-head">
        <span>DEBUG PANEL</span>
        <button className="btn btn-sm" onClick={() => setOpen(false)}>
          收起
        </button>
      </div>

      <div className="debug-body">
        <h5>运行时</h5>
        <div className="debug-kv">
          <span>seed</span>
          <span>
            {state.seed}
            <button
              className="btn btn-sm btn-ghost"
              style={{ marginLeft: 6, padding: '0 6px' }}
              onClick={copySeed}
              title="复制种子到剪贴板"
            >
              {copied ? '已复制' : '复制'}
            </button>
          </span>
          <span>rngState</span>
          <span>{state.rngState}</span>
          <span>time</span>
          <span>{state.time}</span>
          <span>status</span>
          <span>{state.status}</span>
          <span>eventSeq</span>
          <span>{state.eventSeq}</span>
          <span>uidSeq</span>
          <span>{state.uidSeq}</span>
          <span>nextZone</span>
          <span>{countdown === null ? '停止' : `T+${countdown}`}</span>
          <span>engaged</span>
          <span>{state.engagedWithPlayer.join(',') || '—'}</span>
          <span>save</span>
          <span>{saveError ? `失败：${saveError}` : '已写入 localStorage'}</span>
        </div>

        <h5>玩家</h5>
        <div className="debug-kv">
          <span>zone</span>
          <span>{getZoneDef(player.currentZoneId).name}</span>
          <span>hp / sta</span>
          <span>
            {player.hp}/{player.maxHp} · {player.stamina}/{player.maxStamina}
          </span>
          <span>power</span>
          <span>{estimatePower(player)}</span>
          <span>inv</span>
          <span>{player.inventory.length} 格</span>
        </div>

        <h5>技能冷却</h5>
        <div className="debug-kv">
          <span>玩家</span>
          <span>{skillCooldownText(player)}</span>
          {npcs.map((n) => (
            <Fragment key={`sk-${n.id}`}>
              <span>{n.alive ? n.name : `${n.name}（出局）`}</span>
              <span>{n.alive ? skillCooldownText(n) : '—'}</span>
            </Fragment>
          ))}
        </div>

        <h5>战斗风格概率</h5>
        <CombatOdds state={state} />

        <h5>事件</h5>
        <div className="debug-kv">
          <span>events</span>
          <span>{state.events.length}</span>
          <span>activeEvents</span>
          <span>{state.activeEvents.length}</span>
        </div>
        {state.activeEvents.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {state.activeEvents.map((ev) => (
              <div
                key={ev.id}
                className="faint"
                style={{ fontSize: 11, lineHeight: 1.5 }}
              >
                [{ev.type}] {ev.label} · 剩余 {ev.remaining} ·{' '}
                {state.zones[ev.zoneId] ? getZoneDef(ev.zoneId).name : ev.zoneId}
              </div>
            ))}
          </div>
        )}

        <h5>RNG 状态</h5>
        <div className="debug-kv">
          <span>seed</span>
          <span>{state.seed}</span>
          <span>rngState</span>
          <span>{state.rngState}</span>
          <span>确定性</span>
          <span>同种子可完全重放</span>
        </div>

        <h5>区域</h5>
        <div className="debug-kv">
          {Object.values(state.zones).map((z) => (
            <ExpandableZone key={z.id} zoneId={z.id} state={state} />
          ))}
        </div>

        <h5>玩家情报（最后已知位置）</h5>
        <div className="debug-kv">
          {(() => {
            const intel = listIntel(state);
            if (intel.length === 0) return <span>无</span>;
            return intel.flatMap((i) => [
              <span key={`n-${i.characterId}`}>
                {i.name}
                {i.dead ? '（出局）' : ''}
              </span>,
              <span key={`z-${i.characterId}`}>
                {getZoneDef(i.zoneId).name}
                {i.dead ? '' : i.fresh ? ' · 新' : ' · 陈旧'}
              </span>,
            ]);
          })()}
        </div>

        <h5>NPC 决策</h5>
        {npcs.map((n) => (
          <div className="debug-npc" key={n.id}>
            <div className="nm">
              {n.name}（{personalityLabel(n.personality)}）
              {n.alive ? '' : ' · 已出局'}
            </div>
            <div>
              {getZoneDef(n.currentZoneId).name} · hp {n.hp}/{n.maxHp} · sta{' '}
              {n.stamina} · pw {estimatePower(n)} · kills {n.kills}
            </div>
            {n.alive && <NpcPlanDetail state={state} npcId={n.id} />}
            <div className="faint">
              {n.lastAction ?? '—'}
              {n.lastActionReason ? ` / ${n.lastActionReason}` : ''}
            </div>
            {n.alive && (
              <button
                className="btn btn-sm"
                style={{ marginTop: 4 }}
                onClick={() => onCommand({ type: 'DEBUG_WEAKEN_NPC', npcId: n.id })}
              >
                削弱至 1 HP
              </button>
            )}
          </div>
        ))}

        <h5>存档校验</h5>
        <div className="debug-actions">
          <button className="btn btn-sm" onClick={runSaveValidation}>
            运行存档验证
          </button>
          <button className="btn btn-sm" onClick={() => exportSaveJson(state)}>
            导出存档 JSON
          </button>
          <button className="btn btn-sm" onClick={() => exportEventsJson(state)}>
            导出事件 JSON
          </button>
          <button className="btn btn-sm" onClick={() => exportSummaryJson(state)}>
            导出对局摘要 JSON
          </button>
        </div>
        {validation && (
          <div className={`debug-integrity ${validation.ok ? 'ok' : 'bad'}`}>
            {validation.ok ? (
              <span>✓ 存档校验通过（深度校验 13 组不变量）。</span>
            ) : (
              <div>
                <div>✗ 存档校验失败，共 {validation.errors.length} 条：</div>
                <ul className="debug-problems">
                  {validation.errors.slice(0, 8).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <h5>完整性检查（物品守恒）</h5>
        <div className={`debug-integrity ${integrity.ok ? 'ok' : 'bad'}`}>
          {integrity.ok ? (
            <span>✓ 通过：物品 UID 唯一、位置合法、背包/装备一致。</span>
          ) : (
            <div>
              <div>✗ 发现 {integrity.problems.length} 处问题：</div>
              <ul className="debug-problems">
                {integrity.problems.slice(0, 8).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <h5>指令</h5>
        <div className="debug-actions">
          <button
            className="btn btn-sm"
            onClick={() => onCommand({ type: 'DEBUG_ADVANCE_TIME' })}
          >
            推进时间
          </button>
          <button
            className="btn btn-sm"
            onClick={() => onCommand({ type: 'DEBUG_GIVE_MATERIAL' })}
          >
            给予材料
          </button>
          <button
            className="btn btn-sm"
            onClick={() => onCommand({ type: 'DEBUG_HEAL_PLAYER' })}
          >
            回满状态
          </button>
          <button
            className="btn btn-sm"
            onClick={() => onCommand({ type: 'DEBUG_TRIGGER_ZONE' })}
          >
            触发禁区
          </button>
        </div>
      </div>
    </aside>
  );
}

/** 技能冷却文案（Phase 3 Step 7 调试增强） */
function skillCooldownText(c: Combatant): string {
  const sid = getCharacterSkill(c.characterId);
  if (!sid) return '无专属技能';
  const cd = c.skillCooldowns[sid] ?? 0;
  const def = SKILLS[sid];
  if (cd <= 0) return `${def.name} · 就绪（耗 ${def.staminaCost} 体）`;
  return `${def.name} · 冷却 ${cd}/${def.cooldown}`;
}

/** 战斗风格概率面板（Phase 3 Step 7 调试增强） */
function CombatOdds({ state }: { state: GameState }): JSX.Element {
  const player = getPlayer(state);
  const enc = state.encounter;
  const enemy = enc ? state.characters[enc.enemyId] ?? null : null;
  if (!enemy || !enemy.alive) {
    return (
      <div className="faint" style={{ fontSize: 11 }}>
        （无进行中的遭遇，无法估算命中）
      </div>
    );
  }
  const styles: AttackStyle[] = ['quick', 'normal', 'heavy'];
  return (
    <div className="debug-kv">
      {styles.map((s) => {
        const cost = getAttackStyleStaminaCost(s);
        const hit = Math.round(hitChanceOf(player, enemy, s) * 100);
        return (
          <Fragment key={s}>
            <span>{ATTACK_STYLE_LABEL[s]}</span>
            <span>
              命中 {hit}% · 耗 {cost} 体
              {player.stamina < cost ? '（体力不足）' : ''}
            </span>
          </Fragment>
        );
      })}
      <span>逃跑</span>
      <span>
        {Math.round(fleeChanceOf(player, enemy) * 100)}% · 耗{' '}
        {getActionStaminaCost(player, 'FLEE')} 体
      </span>
    </div>
  );
}

/** NPC 制作计划详情（Phase 2A-1） */
function NpcPlanDetail({
  state,
  npcId,
}: {
  state: GameState;
  npcId: string;
}): JSX.Element {
  const n = state.characters[npcId];
  if (!n || !n.alive) return <></>;
  const recipe = n.plannedRecipeId ? tryGetRecipe(n.plannedRecipeId) : null;
  const missing = recipe ? missingIngredients(n, recipe.ingredients) : [];
  return (
    <div className="faint" style={{ marginTop: 2, fontSize: 11 }}>
      <div>
        计划：{recipe ? tryGetItem(recipe.outputItemId)?.name ?? recipe.outputItemId : '无'}
        {n.planReason ? `（${n.planReason}）` : ''}
      </div>
      <div>
        缺失材料：
        {missing.length === 0
          ? '无'
          : missing
              .map((m) => `${tryGetItem(m.itemId)?.name ?? m.itemId}×${m.count}`)
              .join('、')}
      </div>
      <div>
        完成度 {Math.round(n.planProgress * 100)}% · 无进展 {n.planNoProgressTurns} 回合
        {n.planRecommendedZoneId
          ? ` · 推荐 ${getZoneDef(n.planRecommendedZoneId).name}`
          : ''}
      </div>
      <div>
        定于 T{n.planCreatedAt ?? '—'} · 上次重规划：
        {n.lastReplanReason ?? '—'}
      </div>
    </div>
  );
}

/** 单个区域：可展开的完整明细（Phase 2A-1） */
function ExpandableZone({
  zoneId,
  state,
}: {
  zoneId: string;
  state: GameState;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const z = state.zones[zoneId];
  if (!z) return <></>;
  return (
    <>
      <span>{getZoneDef(zoneId).name}</span>
      <span>
        {ZONE_STATUS_LABEL[z.status]} · 物资 {z.supply.toFixed(2)} · 搜{z.searchCount} ·
        人{z.aliveCharacterIds.length} · 地{z.groundItems.length} · 噪音
        {NOISE_LABEL[noiseLevelOf(z)]}
        <button
          className="btn btn-sm btn-ghost"
          style={{ marginLeft: 6, padding: '0 6px' }}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? '收起' : '明细'}
        </button>
        {expanded && (
          <div className="debug-zone-detail">
            <div>initialLootCount: {z.initialLootCount}</div>
            <div>remainingLootCount: {z.remainingLootCount}</div>
            <div>supply: {z.supply.toFixed(4)}</div>
            <div>
              loot: [
              {z.loot
                .map((l) => `${tryGetItem(l.itemId)?.name ?? l.itemId}×${l.count}`)
                .join(', ') || '空'}
              ]
            </div>
            <div>
              groundItems: [
              {z.groundItems
                .map((s) => `${tryGetItem(s.itemId)?.name ?? s.itemId}×${s.count}`)
                .join(', ') || '空'}
              ]
            </div>
            <div>aliveCharacterIds: [{z.aliveCharacterIds.join(', ') || '空'}]</div>
            <div>noiseLevel: {z.noiseLevel}</div>
            <div>searchedEmpty: {z.searchedEmptyCount}</div>
          </div>
        )}
      </span>
    </>
  );
}
