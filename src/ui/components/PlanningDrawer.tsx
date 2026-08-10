import type { ReactNode } from 'react';
import { cx } from '../../utils/format';
import { useDrawerFocus } from './useDrawerFocus';

interface PlanningDrawerProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * 规划面板的响应式壳：桌面端是右侧常驻栏，平板/手机端变成可关闭抽屉。
 * 面板内容仍由 GameScreen 提供，避免移动布局复制或改变任何信息边界。
 *
 * 焦点管理（打开移焦关闭按钮 / Escape 关闭 / 关闭回触发器 / Tab 环绕）
 * 统一由 useDrawerFocus 提供，与 MapDrawer 共用同一套 4B-5 / 4B-6 实现。
 */
export function PlanningDrawer({ open, onOpen, onClose, children }: PlanningDrawerProps): JSX.Element {
  const { triggerRef, closeRef, panelRef } = useDrawerFocus(open, onClose);

  return (
    <div className={cx('planning-slot', open && 'planning-slot-open')}>
      <button
        type="button"
        className="btn planning-drawer-trigger"
        ref={triggerRef}
        aria-expanded={open}
        aria-controls="planning-drawer-panel"
        aria-label={open ? '关闭规划与历史' : '打开规划与历史'}
        onClick={open ? onClose : onOpen}
      >
        <span aria-hidden="true">☷</span> 规划
      </button>

      {open && (
        <button
          type="button"
          className="drawer-backdrop planning-drawer-backdrop"
          aria-label="关闭规划面板"
          onClick={onClose}
        />
      )}

      <aside
        ref={panelRef}
        id="planning-drawer-panel"
        className="col col-right planning-rail planning-drawer-panel"
        aria-label="规划与历史"
        aria-labelledby="planning-drawer-title"
      >
        <div className="drawer-header planning-drawer-header">
          <strong id="planning-drawer-title">规划与历史</strong>
          <button
            type="button"
            className="btn btn-sm planning-drawer-close"
            ref={closeRef}
            aria-label="关闭规划与历史"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
