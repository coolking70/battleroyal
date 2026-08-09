import { useEffect, useRef } from 'react';
import { allCharacters } from '../../core/gameState';
import { PHASE_LABEL } from '../../core/phase';
import { getEquippedArmor, getEquippedWeapon } from '../../core/inventory';
import type { Combatant, GameState } from '../../core/types';
import { getCharacterDef } from '../../data/characters';
import { getItem, tryGetItem } from '../../data/items';
import { tryGetRecipe } from '../../data/recipes';
import { getZoneDef } from '../../data/zones';
import { personalityLabel } from '../../utils/format';
import { resolveCharacterVisualState } from '../characterVisualState';
import { VisualImage } from '../components/VisualImage';
import { visibleEventsForPlayer } from '../components/EventLog';
import { getCharacterVisual, getZoneVisual } from '../visualAssets';

/** 结束原因的展示文案 */
function endReasonLabel(reason: GameState['endReason']): string {
  switch (reason) {
    case 'player_won':
      return '胜利';
    case 'player_died':
      return '阵亡';
    case 'time_limit':
      return '时间耗尽';
    case 'draw':
      return '平局';
    default:
      return '—';
  }
}

interface ResultScreenProps {
  state: GameState;
  player: Combatant;
  onRestart: () => void;
  onBackToMenu: () => void;
}

interface RankRow {
  rank: number;
  c: Combatant;
  fate: string;
}

/** 时间线里要展示的关键事件类型 */
const TIMELINE_TYPES = new Set([
  'GAME_STARTED',
  'ZONE_WARNING',
  'ZONE_RESTRICTED',
  'ENCOUNTER_STARTED',
  'CHARACTER_ESCAPED',
  'CHARACTER_DIED',
  'FINALE_DECAY',
  'CRAFT_GOAL_SET',
  'GAME_ENDED',
]);

interface TimelineEntry {
  id: string;
  time: number;
  tag: string;
  cls: string;
  message: string;
}

/** 从事件流中提取关键节点，按时间升序，最多保留最近 20 条 */
function keyEvents(state: GameState, playerId: string): TimelineEntry[] {
  const TAG: Record<string, { label: string; cls: string }> = {
    GAME_STARTED: { label: '开局', cls: 'start' },
    ZONE_WARNING: { label: '预警', cls: 'warn' },
    ZONE_RESTRICTED: { label: '禁区', cls: 'danger' },
    ENCOUNTER_STARTED: { label: '遭遇', cls: 'fight' },
    CHARACTER_ESCAPED: { label: '撤离', cls: 'neutral' },
    CHARACTER_DIED: { label: '阵亡', cls: 'danger' },
    FINALE_DECAY: { label: '终局', cls: 'warn' },
    CRAFT_GOAL_SET: { label: '目标', cls: 'neutral' },
    GAME_ENDED: { label: '结束', cls: 'end' },
  };
  return visibleEventsForPlayer(state.events, playerId)
    .filter((e) => TIMELINE_TYPES.has(e.type))
    .map((e) => {
      const meta = TAG[e.type] ?? { label: e.type, cls: 'neutral' };
      return {
        id: e.id,
        time: e.time,
        tag: meta.label,
        cls: meta.cls,
        message: e.message,
      };
    })
    .sort((a, b) => a.time - b.time)
    .slice(-20);
}

/**
 * 排名规则：
 * 存活者排在最前（按击杀数降序），其余按死亡顺序倒序（越晚死排名越高）。
 */
function buildRanking(state: GameState): RankRow[] {
  const all = allCharacters(state);
  const survivors = all
    .filter((c) => c.alive)
    .sort((a, b) => b.kills - a.kills || a.id.localeCompare(b.id));
  const dead = all
    .filter((c) => !c.alive)
    .sort((a, b) => state.deathOrder.indexOf(b.id) - state.deathOrder.indexOf(a.id));

  const ordered = [...survivors, ...dead];
  return ordered.map((c, i) => {
    let fate: string;
    if (c.alive) {
      fate = '存活至终局';
    } else if (c.killedBy && state.characters[c.killedBy]) {
      fate = `第 ${c.diedAtTime} 时间单位被 ${state.characters[c.killedBy]?.name} 击杀`;
    } else {
      fate = `第 ${c.diedAtTime} 时间单位出局`;
    }
    return { rank: i + 1, c, fate };
  });
}

export function ResultScreen({
  state,
  player,
  onRestart,
  onBackToMenu,
}: ResultScreenProps): JSX.Element {
  const resultTitleRef = useRef<HTMLHeadingElement>(null);
  const won = state.status === 'won';
  const draw = state.status === 'draw';
  const ranking = buildRanking(state);
  const myRank = ranking.find((r) => r.c.id === player.id)?.rank ?? '—';
  const killer =
    player.killedBy && state.characters[player.killedBy]
      ? state.characters[player.killedBy]?.name
      : null;

  // 死亡顺序位置（存活者不在 deathOrder 中）
  const deathPos = state.deathOrder.indexOf(player.id);
  const deathOrderText =
    player.alive || deathPos < 0
      ? '存活'
      : `第 ${deathPos + 1} / ${state.turnOrder.length}`;
  const resultVisualState = resolveCharacterVisualState(player);
  const resultZone = getZoneDef(player.currentZoneId);

  useEffect(() => {
    resultTitleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <main className="result" aria-labelledby="result-title">
      <div className="result-inner">
        <section className={`result-hero result-hero-${won ? 'won' : draw ? 'draw' : 'lost'}`} aria-label="对局视觉收束">
          <VisualImage
            visual={getZoneVisual(player.currentZoneId)}
            alt={`${resultZone.name}区域背景`}
            className="result-zone-visual"
          />
          <div className="result-hero-scrim" aria-hidden="true" />
          <div className="result-hero-copy">
            <span className="result-hero-kicker">FINAL ZONE · {player.currentZoneId.toUpperCase()}</span>
            <strong>{resultZone.name}</strong>
            <span>{won ? '你在这里结束了这场生存竞赛。' : draw ? '时间耗尽，所有人都停在这片城市里。' : '这片区域记录了你的最后一段行动。'}</span>
          </div>
          <VisualImage
            visual={getCharacterVisual(player.characterId, resultVisualState)}
            alt={`${getCharacterDef(player.characterId).name}结算角色图`}
            className="result-character-visual"
          />
        </section>
        <div className="result-head" aria-describedby="result-summary">
          <h1
            id="result-title"
            ref={resultTitleRef}
            tabIndex={-1}
            className={`verdict ${won ? 'won' : draw ? 'draw' : 'lost'}`}
          >
            {won ? '最后生还' : draw ? '平局 · 时间耗尽' : '淘汰出局'}
          </h1>
          <div className="line" id="result-summary">
            {won
              ? `你在第 ${state.endedAtTime ?? state.time} 个时间单位成为唯一幸存者。`
              : draw
                ? `对局在第 ${state.endedAtTime ?? state.time} 个时间单位达到硬时限，无人胜出，判为平局。`
                : killer
                  ? `你在第 ${player.diedAtTime ?? state.time} 个时间单位倒在 ${getZoneDef(player.currentZoneId).name}，终结者是 ${killer}。`
                  : `你在第 ${player.diedAtTime ?? state.time} 个时间单位倒在 ${getZoneDef(player.currentZoneId).name}。`}
          </div>
          <div className="line faint mono" style={{ fontSize: 12 }}>
            角色 {getCharacterDef(player.characterId).name} · 种子 {state.seed}
          </div>
        </div>

        <div className="panel result-grid">
          <div className="result-cell">
            <div className="k">名次</div>
            <div className="v">
              {myRank}
              <span className="faint" style={{ fontSize: 13 }}>
                /{state.turnOrder.length}
              </span>
            </div>
          </div>
          <div className="result-cell">
            <div className="k">结束原因</div>
            <div className="v">{endReasonLabel(state.endReason)}</div>
          </div>
          <div className="result-cell">
            <div className="k">策略</div>
            <div className="v">{personalityLabel(player.personality)}</div>
          </div>
          <div className="result-cell">
            <div className="k">死亡顺序</div>
            <div className="v">{deathOrderText}</div>
          </div>
          <div className="result-cell">
            <div className="k">最远阶段</div>
            <div className="v">{PHASE_LABEL[player.furthestPhase]}</div>
          </div>
          <div className="result-cell">
            <div className="k">存活时间</div>
            <div className="v">{state.endedAtTime ?? state.time}</div>
          </div>
          <div className="result-cell">
            <div className="k">击杀</div>
            <div className="v">{player.kills}</div>
          </div>
          <div className="result-cell">
            <div className="k">搜索</div>
            <div className="v">{player.stats.searches}</div>
          </div>
          <div className="result-cell">
            <div className="k">合成</div>
            <div className="v">{player.stats.crafts}</div>
          </div>
          <div className="result-cell">
            <div className="k">移动</div>
            <div className="v">{player.stats.moves}</div>
          </div>
          <div className="result-cell">
            <div className="k">出手</div>
            <div className="v">{player.stats.attacks}</div>
          </div>
          <div className="result-cell">
            <div className="k">使用物品</div>
            <div className="v">{player.stats.itemsUsed}</div>
          </div>
          <div className="result-cell">
            <div className="k">造成伤害</div>
            <div className="v">{player.stats.damageDealt}</div>
          </div>
          <div className="result-cell">
            <div className="k">承受伤害</div>
            <div className="v">{player.stats.damageTaken}</div>
          </div>
        </div>

        <section className="panel" aria-labelledby="result-loadout-title">
          <h2 className="panel-title" id="result-loadout-title">装备 · 背包 · 制作目标</h2>
          <div className="result-grid">
            <div className="result-cell">
              <div className="k">最终武器</div>
              <div className="v">
                {(() => {
                  const w = getEquippedWeapon(player);
                  return w ? getItem(w.itemId).name : '徒手';
                })()}
              </div>
            </div>
            <div className="result-cell">
              <div className="k">最终防具</div>
              <div className="v">
                {(() => {
                  const a = getEquippedArmor(player);
                  return a ? getItem(a.itemId).name : '无';
                })()}
              </div>
            </div>
            <div className="result-cell">
              <div className="k">制作目标</div>
              <div className="v">
                {(() => {
                  if (!state.craftGoalRecipeId) return '未设定';
                  const r = tryGetRecipe(state.craftGoalRecipeId);
                  if (!r) return '未知配方';
                  const out = getItem(r.outputItemId);
                  return `${out.name}${state.craftGoalCompleted ? '（已达成）' : '（未完成）'}`;
                })()}
              </div>
            </div>
            <div className="result-cell">
              <div className="k">背包物品</div>
              <div className="v mono" style={{ fontSize: 13, lineHeight: 1.5 }}>
                {player.inventory.length === 0
                  ? '空'
                  : player.inventory
                      .map((s) => {
                        const def = tryGetItem(s.itemId);
                        const name = def?.name ?? s.itemId;
                        return `${name}×${s.count}`;
                      })
                      .join(' · ')}
              </div>
            </div>
          </div>
        </section>

        <section className="panel" aria-labelledby="result-ranking-title">
          <h2 className="panel-title" id="result-ranking-title">最终排名</h2>
          <table className="rank-table" aria-label="最终排名表">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>参赛者</th>
                <th style={{ width: 76 }}>击杀</th>
                <th>结局</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(({ rank, c, fate }) => (
                <tr key={c.id} className={c.isPlayer ? 'me' : undefined}>
                  <td className="mono">{rank}</td>
                  <td>
                    {c.name}
                    {c.isPlayer ? '（你）' : ''}
                    <span className="faint" style={{ fontSize: 11 }}>
                      {' '}
                      {getCharacterDef(c.characterId).name}
                    </span>
                  </td>
                  <td className="mono">{c.kills}</td>
                  <td>{fate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel" aria-labelledby="result-timeline-title">
          <h2 className="panel-title" id="result-timeline-title">关键事件时间线</h2>
          {keyEvents(state, player.id).length === 0 ? (
            <div className="empty">没有记录到关键事件。</div>
          ) : (
            <ul className="timeline" aria-label="关键事件时间线">
              {keyEvents(state, player.id).map((e) => (
                <li key={e.id}>
                  <span className="t mono">T{e.time}</span>
                  <span className={`tag-ev ${e.cls}`}>{e.tag}</span>
                  <span className="msg">{e.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="result-actions">
          <button className="btn btn-primary" onClick={onRestart}>
            用同一种子再来一局
          </button>
          <button className="btn" onClick={onBackToMenu}>
            返回主菜单
          </button>
        </div>
      </div>
    </main>
  );
}
