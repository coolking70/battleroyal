import { useState } from 'react';
import { getEquippedWeapon, totalAttack, totalDefense } from '../../core/inventory';
import { hasExposed } from '../../core/exposed';
import { getCharacterDef } from '../../data/characters';
import { getItem } from '../../data/items';
import { cx, hpDescriptor } from '../../utils/format';
import { Bar } from './Bar';
import { VisualImage } from './VisualImage';
import { getCharacterVisual } from '../visualAssets';
import { resolveCharacterVisualState } from '../characterVisualState';
import {
  COMBAT_STATUS_META,
  combatModeMeta,
  combatVisualStateMeta,
} from '../combatPresentation';
import { useDrawerFocus } from './useDrawerFocus';
import type { CombatActionBarView } from '../combatActionsPresentation';
import type { Combatant, EncounterState } from '../../core/types';

interface EncounterHeroProps {
  encounter: EncounterState;
  player: Combatant;
  enemy: Combatant;
  /** 行动栏视图模型（含脱离率 / 普通命中率），敌方合法可见字段与行动栏共享同一组数值 */
  combat: CombatActionBarView | null;
}

/**
 * 遭遇态主视觉（Phase 4D-3 §2.1）。
 *
 * 遭遇不再是主视觉下方的独立面板，而是 `.zone-hero` 的一种**状态**：
 * 区域背景照旧铺满，**敌方立绘居中**成为视觉焦点。
 * 玩家状态只来自顶栏 —— 这里不重复渲染玩家 HP / 体力（§2.1 去重）。
 *
 * 保留的敌方合法可见字段（§3，一个都不能少）：
 * 身份（显示名）+ 角色名、无数字的 HP 条 + 文字描述、武器、EXPOSED、
 * 共享的脱离率与命中率、行动的体力成本（在共用行动栏上）。
 * 不渲染敌方精确 HP 数值、未展示的装备 / 技能 / 意图 / 背包。
 *
 * 战斗记录是按需小入口（§2.4）：点「战斗记录」展开本次遭遇日志，
 * 焦点管理 / Escape 关闭 / 焦点陷阱复用 `useDrawerFocus`。
 *
 * 遭遇结束（resolved）时**没有「继续探索」按钮**（§2.3）：
 * 结果作为一行即时反馈留在主视觉上，玩家下一次行动时由 GameScreen 顺带清场。
 */
export function EncounterHero({
  encounter,
  player,
  enemy,
  combat,
}: EncounterHeroProps): JSX.Element {
  const resolved = encounter.resolved || !enemy.alive;
  const enemyVisualState = resolveCharacterVisualState(enemy, { activeEncounter: !resolved });
  const enemyVisualMeta = combatVisualStateMeta(enemyVisualState);
  const enemyExposed = hasExposed(enemy);
  const weapon = getEquippedWeapon(enemy);
  const modeMeta = combatModeMeta(resolved);
  const enemyClassName = getCharacterDef(enemy.characterId).name;
  const latestFeedback =
    encounter.log[encounter.log.length - 1] ??
    (resolved ? '遭遇已结束。' : '尚未交手，选择一项行动。');
  const normalHit = combat?.attacks.find((a) => a.style === 'normal')?.hitPct ?? null;

  const [logOpen, setLogOpen] = useState(false);
  const { triggerRef, closeRef, panelRef } = useDrawerFocus(logOpen, () => setLogOpen(false));

  return (
    <section
      className={cx('encounter-hero', resolved && 'encounter-hero-resolved')}
      data-encounter-state={resolved ? 'resolved' : 'active'}
      aria-label={modeMeta.label}
    >
      {/* 敌方立绘：主视觉焦点，居中 */}
      <div className="encounter-hero-portrait" data-visual-state={enemyVisualState}>
        <VisualImage
          visual={getCharacterVisual(enemy.characterId, enemyVisualState)}
          alt={`${enemy.name}${enemyVisualMeta.label}角色图`}
          className="encounter-enemy-visual"
        />
      </div>

      {/* 敌方合法可见字段：身份 / 角色名 / 无数字 HP / 武器 / EXPOSED / 共享率值 */}
      <div className="encounter-hero-enemyinfo" data-side="enemy">
        <div className="eh-kicker">
          <span className="combat-cue-icon" aria-hidden="true">{modeMeta.icon}</span>
          {resolved ? '已结束 · 上一个对手' : 'ENEMY · 当前可见目标'}
        </div>
        <div className="eh-name-line">
          <span className="badge badge-enemy">敌</span>
          <strong>{enemy.name}</strong>
          <span className="eh-class">{enemyClassName}</span>
        </div>
        {/* 复用全站共享的三态语汇（图标 + 文字，颜色只是补充） */}
        <div className={`combat-visual-state state-${enemyVisualState}`}>
          <span className="combat-cue-icon" aria-hidden="true">{enemyVisualMeta.icon}</span>
          <span>{enemyVisualMeta.label}</span>
        </div>
        <div className="eh-hp">
          <span>敌方生命状态</span>
          <Bar value={enemy.hp} max={enemy.maxHp} kind="hp" />
          <b>{hpDescriptor(enemy)}</b>
        </div>
        <div className="eh-line eh-weapon">武器：{weapon ? getItem(weapon.itemId).name : '徒手'}</div>
        <div className="eh-status-row">
          {enemyExposed ? (
            <span className="tag tag-exposed">
              <span className="combat-cue-icon" aria-hidden="true">{COMBAT_STATUS_META.exposed.icon}</span>
              {COMBAT_STATUS_META.exposed.label}
            </span>
          ) : (
            <span className="faint eh-status-empty">未见额外状态</span>
          )}
        </div>
        {combat && (
          <div className="eh-line eh-shared-rate">
            <span>脱离 {combat.flee.chancePct}%</span>
            {normalHit !== null && <span> · 命中 {normalHit}%</span>}
          </div>
        )}
        <div className="eh-line eh-player-power">你 攻 {totalAttack(player)} / 防 {totalDefense(player)}</div>
      </div>

      {/* 底部：一行即时反馈 + 战斗记录小入口 */}
      <div className="encounter-hero-bottom">
        <div className="encounter-hero-feedback" aria-live="polite">
          <span className="eh-feedback-kicker">即时反馈</span>
          <strong>{latestFeedback}</strong>
        </div>
        <button
          type="button"
          ref={triggerRef}
          className="btn btn-sm encounter-hero-log-toggle"
          aria-expanded={logOpen}
          aria-controls="encounter-hero-log"
          onClick={() => setLogOpen((open) => !open)}
        >
          战斗记录 <span className="eh-log-count">{encounter.log.length}</span>
        </button>
      </div>

      {logOpen && (
        <aside
          className="encounter-hero-log"
          id="encounter-hero-log"
          role="dialog"
          aria-label="本次遭遇战斗记录"
          ref={panelRef}
        >
          <div className="eh-log-head">
            <span>本次遭遇战斗记录</span>
            <button
              type="button"
              ref={closeRef}
              className="btn btn-sm eh-log-close"
              onClick={() => setLogOpen(false)}
            >
              关闭
            </button>
          </div>
          <div className="eh-log-body scroll">
            {encounter.log.length === 0 ? (
              <p className="faint">尚未交手。</p>
            ) : (
              encounter.log.map((line, i) => <p key={i}>{line}</p>)
            )}
          </div>
        </aside>
      )}
    </section>
  );
}
