import { type RefObject } from 'react';
import { percent } from '../../utils/format';

interface BarProps {
  value: number;
  max: number;
  kind: 'hp' | 'stamina' | 'growth';
  /** 提供后槽位变为真正可点击的按钮（Phase 4E-1 §3）；不提供则维持纯展示 */
  onActivate?: () => void;
  /** 仅交互模式使用：无障碍标签，说明点击行为与当前数值 */
  activateLabel?: string;
  /** 仅交互模式使用：把 ref 挂到按钮上，供弹出选择窗归还焦点 / 排除外部点击 */
  buttonRef?: RefObject<HTMLButtonElement>;
}

/** 生命 / 体力条 */
export function Bar({ value, max, kind, onActivate, activateLabel, buttonRef }: BarProps): JSX.Element {
  const ratio = max > 0 ? value / max : 0;
  const low = ratio > 0 && ratio < 0.3;
  const fill = <i style={{ width: `${percent(value, max)}%` }} />;

  if (onActivate) {
    return (
      <button
        type="button"
        ref={buttonRef}
        className={`bar bar-${kind}${low ? ' is-low' : ''} bar-button`}
        onClick={onActivate}
        aria-label={activateLabel ?? `点击使用恢复道具恢复${kind === 'hp' ? '生命' : '体力'}`}
      >
        {fill}
      </button>
    );
  }

  return (
    <div className={`bar bar-${kind}${low ? ' is-low' : ''}`} role="presentation">
      {fill}
    </div>
  );
}
