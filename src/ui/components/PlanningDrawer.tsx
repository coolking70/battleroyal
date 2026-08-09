import type { ReactNode } from 'react';
import { cx } from '../../utils/format';

interface PlanningDrawerProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * 规划面板的响应式壳：桌面端是右侧常驻栏，平板/手机端变成可关闭抽屉。
 * 面板内容仍由 GameScreen 提供，避免移动布局复制或改变任何信息边界。
 */
export function PlanningDrawer({ open, onOpen, onClose, children }: PlanningDrawerProps): JSX.Element {
  return (
    <div className={cx('planning-slot', open && 'planning-slot-open')}>
      <button
        type="button"
        className="btn planning-drawer-trigger"
        aria-expanded={open}
        aria-controls="planning-drawer-panel"
        onClick={open ? onClose : onOpen}
      >
        <span aria-hidden="true">☷</span> 规划
      </button>

      {open && (
        <button
          type="button"
          className="planning-drawer-backdrop"
          aria-label="关闭规划面板"
          onClick={onClose}
        />
      )}

      <aside
        id="planning-drawer-panel"
        className="col col-right planning-rail planning-drawer-panel"
        aria-label="规划与历史"
      >
        <div className="planning-drawer-header">
          <strong>规划与历史</strong>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            关闭
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
