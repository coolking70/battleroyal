import { useEffect, useRef, type RefObject } from 'react';

/**
 * 抽屉焦点管理（Phase 4B-5 / 4B-6 既定实现，集中复用以避免分化）。
 *
 * - 打开时把焦点移到关闭按钮；
 * - 关闭时把焦点还给触发器（触发器可在组件外，例如地图指示器里的展开按钮）；
 * - Escape 关闭；
 * - Tab / Shift+Tab 在面板内环绕（焦点陷阱）。
 *
 * 用法：把返回的 triggerRef / closeRef / panelRef 分别挂到
 * 触发器按钮 / 关闭按钮 / 面板容器上。MapDrawer 这类触发器在组件外的场景，
 * 可传入 externalTriggerRef，关闭时焦点会回到那个外部触发器。
 */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface DrawerFocusRefs {
  triggerRef: RefObject<HTMLButtonElement>;
  closeRef: RefObject<HTMLButtonElement>;
  panelRef: RefObject<HTMLElement>;
}

export function useDrawerFocus(
  open: boolean,
  onClose: () => void,
  externalTriggerRef?: RefObject<HTMLButtonElement>,
): DrawerFocusRefs {
  const internalTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = externalTriggerRef ?? internalTriggerRef;
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
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
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return { triggerRef, closeRef, panelRef };
}
