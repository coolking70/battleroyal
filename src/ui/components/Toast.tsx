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
      onClick={onDismiss}
      title="点击关闭"
    >
      {toast.text}
    </div>
  );
}
