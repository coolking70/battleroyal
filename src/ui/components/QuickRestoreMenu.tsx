import { useEffect, useState, type CSSProperties, type RefObject } from 'react';
import type { Combatant } from '../../core/types';
import { useDrawerFocus } from './useDrawerFocus';
import { quickRestoreCandidates, type RestoreSlot } from '../quickRestore';

interface QuickRestoreMenuProps {
  player: Combatant;
  slot: RestoreSlot;
  /** 触发此菜单的槽按钮 ref，用于关闭时焦点归还与"点击外部"判定排除 */
  triggerRef: RefObject<HTMLButtonElement>;
  /** 走既有 USE_ITEM 命令，不得绕过 */
  onUse: (uid: string) => void;
  onClose: () => void;
}

const MARGIN = 8;

/**
 * 点击生命 / 体力槽后的小型道具选择窗（Phase 4E-1 §3.3）。
 *
 * - 不遮挡 P0：浮层锚定在被点击槽位的**正下方**（按实际 bounding rect 计算并夹在视口内），
 *   因此顶部的生命 / 体力 / 禁区倒计时等 P0 生存信息始终露出；且**无全屏遮罩**——
 *   通过 document 上的 pointerdown 监听在"点击浮层与触发器之外"时关闭，
 *   这样战斗动作 / 生存信息始终可被点击，浮层只是叠加在它们之上。
 * - 焦点管理 / Esc 关闭 / 焦点陷阱复用 `useDrawerFocus`（关闭时焦点还给触发槽）。
 * - 双效物品在选择窗中**完整显示两项效果**（§3.4），由玩家自行判断是否浪费。
 * - 候选为空时给出明确说明，不静默无响应。
 */
export function QuickRestoreMenu({ player, slot, triggerRef, onUse, onClose }: QuickRestoreMenuProps): JSX.Element {
  const { closeRef, panelRef } = useDrawerFocus(true, onClose, triggerRef);
  const candidates = quickRestoreCandidates(player, slot);
  const deficit = slot === 'hp'
    ? Math.max(0, player.maxHp - player.hp)
    : Math.max(0, player.maxStamina - player.stamina);
  const slotLabel = slot === 'hp' ? '生命' : '体力';

  useEffect(() => {
    const onPointerDown = (event: globalThis.PointerEvent): void => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [panelRef, triggerRef, onClose]);

  // 本浮层用挂载 / 卸载表达开合，`useDrawerFocus` 的 open→false 焦点归还不会触发，
  // 因此在卸载时显式把焦点还给触发槽（Esc / 关闭按钮 / 点击外部 / 用掉道具都走这里）。
  useEffect(() => {
    const trigger = triggerRef.current;
    return () => trigger?.focus();
  }, [triggerRef]);

  // 锚定到触发槽正下方并夹进视口，避免在窄屏压住顶部 P0 生存信息
  const [anchor, setAnchor] = useState<CSSProperties | null>(null);
  useEffect(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!rect || !panel) return;
    const width = panel.offsetWidth || panel.getBoundingClientRect().width;
    const height = panel.offsetHeight || panel.getBoundingClientRect().height;
    if (width <= 0 || height <= 0) return; // jsdom / 未布局：退回 CSS 默认位置
    const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - width - MARGIN));
    const top = Math.max(MARGIN, Math.min(rect.bottom + 6, window.innerHeight - height - MARGIN));
    setAnchor({ top, left, right: 'auto' });
  }, [triggerRef, panelRef, candidates.length]);

  return (
    <aside
      className="quick-restore-menu"
      role="dialog"
      aria-label={`恢复${slotLabel}`}
      ref={panelRef}
      style={anchor ?? undefined}
    >
      <div className="quick-restore-head">
        <strong>恢复{slotLabel}</strong>
        <button
          ref={closeRef}
          type="button"
          className="quick-restore-close"
          onClick={onClose}
          aria-label={`关闭恢复${slotLabel}菜单`}
        >
          ×
        </button>
      </div>

      {candidates.length === 0 ? (
        <p className="quick-restore-empty">背包里没有可恢复{slotLabel}的道具。</p>
      ) : (
        <ul className="quick-restore-list">
          {candidates.map((c) => (
            <li key={c.uid}>
              <button
                type="button"
                className="quick-restore-item"
                data-quick-restore-uid={c.uid}
                onClick={() => onUse(c.uid)}
              >
                <span className="qri-name">
                  {c.name}
                  {c.count > 1 && <span className="qri-count"> ×{c.count}</span>}
                </span>
                <span className="qri-effects">
                  {c.healHp > 0 && <span className="qri-effect qri-hp">生命 +{c.healHp}</span>}
                  {c.healStamina > 0 && (
                    <span className="qri-effect qri-stamina">体力 +{c.healStamina}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {deficit <= 0 && candidates.length > 0 && (
        <p className="quick-restore-note">{slotLabel}已满，使用会浪费。</p>
      )}
    </aside>
  );
}
