import { useEffect, useRef, type ReactNode } from 'react';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      closeRef.current?.focus();
      return undefined;
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

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
