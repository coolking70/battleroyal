import type { Toast as ToastData } from '../../utils/useGame';

interface ToastProps {
  toast: ToastData;
  onDismiss: () => void;
}

/** 轻量操作反馈条，点击即可关闭 */
export function Toast({ toast, onDismiss }: ToastProps): JSX.Element {
  const isGrowthUpgrade = toast.text.includes('升级');
  return (
    <div
      className={`toast ${toast.tone}${isGrowthUpgrade ? ' toast-growth' : ''}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={0}
      aria-label="操作提示，按 Enter 或空格关闭"
      onClick={onDismiss}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onDismiss();
        }
      }}
    >
      {toast.text}
    </div>
  );
}
