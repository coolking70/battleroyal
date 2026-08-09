import type { Toast as ToastData } from '../../utils/useGame';

interface ToastProps {
  toast: ToastData;
  onDismiss: () => void;
}

/** 轻量操作反馈条，点击即可关闭 */
export function Toast({ toast, onDismiss }: ToastProps): JSX.Element {
  return (
    <div
      className={`toast ${toast.tone}`}
      role="status"
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
